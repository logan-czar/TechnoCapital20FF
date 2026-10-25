// Port of crates/sim/tests/m5_load.rs: build-plan M5.1 and M5.2 on the live engine (spec 7.1
// Shares row, 5.13, 5.14): the market the load builds. Every company's fair value at load is its
// engine value and matches company-start.csv engine_value_usd; P is the 7.1 open price ($5 to
// $200), worked out here from the engine value with gen.py's id-seeded jitter; V = engine value
// / shares sits at P up to the share rounding; the stored basis is the load basis (E_norm =
// run-rate NI, G at g 0); every exchange with a listed company starts at 1,000 and the others
// show no level; private companies have a value and no quote.
//
// Expects:
//   ../../src/lib.ts              simNew, simWorld, simViews, simApply
//                                 (control { kind: "SetOmniscient", on: true })
//   views: quotes.data { rows: QuoteRow[], indices: IndexQuote[] } and exchanges.data, company_detail
//   .data.companies[id].shown_value_per_share (Figure) as in types/views
//   "@tc20ff/sim-data"            WorldData.company_start.rows { id, engine_value_usd, shares,
//                                 open_price }
//
// Changed from the Rust: none of the assertions use draws (Sim::new(.., 1) seeds the new generator,
// D951, but the load state is draw-free). The println lines are dropped.
import { describe, expect, it } from "vitest";
import { simApply, simNew, simViews, simWorld } from "../../src/lib.ts";
import type { CompanyId, ZoneId } from "../../src/types/ids.ts";
import { clamp, roundTiesEven } from "../../src/types/num.ts";
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
/** Spec 5.14: every headline index starts at 1,000. */
const INDEX_BASE = 1000.0;
/** Spec 5.13 step 6: private companies show 0.7 x fair value. */
const PRIVATE_DISCOUNT = 0.7;

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

  it("every_exchange_with_a_listing_opens_at_1000", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const w = simWorld(sim);
    const quotes = simViews(sim).quotes.data;
    const exchanges = simViews(sim).exchanges.data;
    expect(w.zones.length).toBe(26);
    expect(exchanges.exchanges.length).toBe(26);
    let withListing = 0;
    w.zones.forEach((zone, i) => {
      const z = i as ZoneId;
      const listed = w.market.stocks.filter((s) => s.exchange === z);
      const level = (quotes.indices.find((q) => q.zone === z) as (typeof quotes.indices)[number]).level;
      const row = exchanges.exchanges[z] as (typeof exchanges.exchanges)[number];
      expect(row.listed_count).toBe(listed.length);
      expect(row.code).toBe(zone.exchange_code);
      if (listed.length === 0) {
        expect(level, `${row.code}: no listing shows no level`).toBeNull();
      } else {
        withListing += 1;
        expect(Math.abs((level as number) - INDEX_BASE) < 1e-9, `${row.code}: ${level}`).toBe(true);
      }
    });
    expect(withListing).toBeGreaterThan(0);
  });

  it("private_companies_show_seventy_percent_of_fair_value", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    // The observer sees a band around an estimate of 0.7 x V (D420); Omniscient the value.
    const banded = structuredClone(simViews(sim).company_detail.data.companies);
    unwrap(simApply(sim, { kind: "SetOmniscient", on: true }), "SetOmniscient");
    const w = simWorld(sim);
    const detail = simViews(sim).company_detail.data.companies;
    const quoteIds = new Set(simViews(sim).quotes.data.rows.map((r) => r.id));
    w.companies.forEach((c, i) => {
      if (c.public) return;
      const s = w.market.stocks[i] as (typeof w.market.stocks)[number];
      const want = PRIVATE_DISCOUNT * s.value;
      const shown = (detail[i] as (typeof detail)[number]).shown_value_per_share;
      if (shown.kind !== "Exact") throw new Error("Omniscient shows the exact value");
      expect(Math.abs(shown.value - want) < 1e-9 * Math.max(s.value, 1.0)).toBe(true);
      const b = (banded[i] as (typeof banded)[number]).shown_value_per_share;
      if (b.kind !== "Band") throw new Error("the observer sees a band");
      expect(b.band.low < want && want < b.band.high && b.band.estimate !== want).toBe(true);
      expect(quoteIds.has(i as CompanyId), "no quote").toBe(false);
    });
  });
});
