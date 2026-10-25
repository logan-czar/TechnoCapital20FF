// Port of crates/sim/tests/m5_load.rs: build-plan M5.1 and M5.2 on the live engine (spec 7.1
// Shares row, 5.13, 5.14): the market the load builds. Every company's fair value at load is its
// engine value and matches company-start.csv engine_value_usd; P is the 7.1 open price ($5 to
// $200), worked out here from the engine value with gen.py's id-seeded jitter; V = engine value
// / shares sits at P up to the share rounding; the stored basis is the load basis (E_norm =
// run-rate NI, G at g 0). The exchange and private-value checks read views and wait in
// pending/views/m5_load_views.test.ts.
//
// Expects:
//   ../src/lib.ts                 simNew, simWorld
//   "@tc20ff/sim-data"            WorldData.company_start.rows { id, engine_value_usd, shares,
//                                 open_price }
//
// Changed from the Rust: none of the assertions use draws (Sim::new(.., 1) seeds the new generator,
// D951, but the load state is draw-free). The println lines are dropped.
import { describe, expect, it } from "vitest";
import { simNew, simWorld } from "../src/lib.ts";
import type { CompanyId } from "../src/types/ids.ts";
import { clamp, roundTiesEven } from "../src/types/num.ts";
import { data, unwrap } from "./common/index.ts";

/**
 * Spec 7.1 (batch 161; gen.py PRICE_*): open_price = clamp(round($25 x (value / $1B)^0.35 x
 * jitter), $5, $200), jitter up to +-10% seeded by the company id.
 */
const PRICE_BASE = 25.0;
const PRICE_REF_USD = 1e9;
const PRICE_EXP = 0.35;
const PRICE_MIN = 5.0;
const PRICE_MAX = 200.0;
const PRICE_JITTER = 0.1;

/** CRC-32 (IEEE, reflected), as Python's zlib.crc32. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc = (crc ^ b) >>> 0;
    for (let i = 0; i < 8; i++) {
      const mask = -(crc & 1) >>> 0;
      crc = ((crc >>> 1) ^ (0xedb88320 & mask)) >>> 0;
    }
  }
  return ~crc >>> 0;
}

/** gen.py price_jitter: 1 + 0.10 x (2 x (crc32("price:" + id) mod 10001) / 10000 - 1). */
function jitter(id: string): number {
  const h = crc32(new TextEncoder().encode(`price:${id}`)) % 10001;
  return 1.0 + PRICE_JITTER * ((2.0 * h) / 10000.0 - 1.0);
}

/** The 7.1 open price of a value (Python's round rounds halves to even). */
function openPrice(value: number, id: string): number {
  const p = PRICE_BASE * (value / PRICE_REF_USD) ** PRICE_EXP * jitter(id);
  return clamp(roundTiesEven(p), PRICE_MIN, PRICE_MAX);
}

describe("m5 load", () => {
  it("crc32_matches_python", () => {
    // The CRC-32 check value (zlib.crc32(b"123456789")).
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("load_values_match_company_start_and_open_at_v", () => {
    const d = data();
    const sim = unwrap(simNew(structuredClone(d), 1), "Sim::new");
    const w = simWorld(sim);
    const csv = new Map(d.company_start.rows.map((r) => [r.id, r]));
    let listed = 0;
    w.companies.forEach((c, i) => {
      const id = i as CompanyId;
      const s = w.market.stocks[id] as (typeof w.market.stocks)[number];
      const row = csv.get(c.key);
      if (row === undefined) throw new Error(`no company-start row ${c.key}`);
      // M5.2: the engine value at load is company-start.csv's, to the dollar it was rounded to.
      const diff = Math.abs(s.fair_value - row.engine_value_usd);
      expect(
        diff <= 1.0 + 1e-9 * row.engine_value_usd,
        `${c.key}: engine value ${s.fair_value} vs company-start.csv ${row.engine_value_usd}`,
      ).toBe(true);
      expect(c.shares_out, c.key).toBe(row.shares);
      // V = fair value / shares_out (5.13 step 6).
      expect(Math.abs(s.value - s.fair_value / c.shares_out) < 1e-12 * Math.max(s.value, 1.0)).toBe(true);
      // The load basis (D244): g 0, so E_norm = 0.6 NI + 0.4 NI = NI, and G = clamp(1 - 2.5 x lt,
      // 0.5, 2.5) with lt the industry's trend_growth at load.
      const lt = (w.industries[c.industry] as (typeof w.industries)[number]).params.trend_growth;
      const g = clamp(1.0 - 2.5 * lt, 0.5, 2.5);
      expect(Math.abs(s.basis.growth_factor - g) < 1e-12, c.key).toBe(true);
      expect(s.basis.e_norm, c.key).not.toBeNull();
      expect(s.buzz).toBe(0.0);
      if (c.public) {
        listed += 1;
        expect(s.quoted && s.exchange !== null, c.key).toBe(true);
        expect(s.exchange).toBe((w.countries[c.hq_country] as (typeof w.countries)[number]).zone);
        // The 7.1 open price, from the engine value, is P; $5 to $200.
        expect(s.price, c.key).toBe(row.open_price);
        expect(openPrice(s.fair_value, c.key), c.key).toBe(s.price);
        expect(s.price >= PRICE_MIN && s.price <= PRICE_MAX, c.key).toBe(true);
        // P = V up to shares = round(value / open_price): |V / P - 1| <= 0.5 / shares, plus the
        // dollar the CSV value was rounded to.
        const gap = Math.abs(s.value / s.price - 1.0);
        const bound = 0.5 / c.shares_out + 1.0 / row.engine_value_usd + 1e-12;
        expect(gap <= bound, `${c.key}: |V/P - 1| = ${gap} > ${bound}`).toBe(true);
        // The first bar opens at P on 1 January; the day's change starts at 0.
        expect(s.bar.open).toBe(s.price);
        expect(s.prev_close).toBe(s.price);
      } else {
        expect(!s.quoted && s.exchange === null, c.key).toBe(true);
        expect(s.price).toBe(0.0);
      }
    });
    expect(listed).toBe(467);

    // Arrowhead (ARDR): $9 x about 6.67M shares = $60M, its 0.6 x book floor (7.1).
    const ardr = w.companies.findIndex((c) => c.key === "CO-0001");
    expect(ardr).toBeGreaterThanOrEqual(0);
    const s = w.market.stocks[ardr] as (typeof w.market.stocks)[number];
    expect(s.price).toBe(9.0);
    expect((w.companies[ardr] as (typeof w.companies)[number]).shares_out).toBe(6_666_667);
    expect(Math.abs(s.fair_value - 60_000_000.0)).toBeLessThan(1.0);
  });
});
