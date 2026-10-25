// The view half of crates/sim/tests/m5_load.rs (the rest is test/m5_load.test.ts): every exchange
// with a listing opens at 1,000 and the others show no level, and private companies show 70% of
// fair value with no quote. Pending until the quotes, exchanges and company detail views are
// ported (Step 3).
//
// Expects:
//   ../../src/lib.ts   simNew, simWorld, simViews, simApply (SetOmniscient needs { debug: true })
//   views: quotes.data { rows: QuoteRow[], indices: IndexQuote[] } and exchanges.data, company_detail
//   .data.companies[id].shown_value_per_share (Figure) as in types/views
import { describe, expect, it } from "vitest";
import { simApply, simNew, simViews, simWorld } from "../../src/lib.ts";
import type { CompanyId, ZoneId } from "../../src/types/ids.ts";
import { data, unwrap } from "../common/index.ts";

/** Spec 5.14: every headline index starts at 1,000. */
const INDEX_BASE = 1000.0;
/** Spec 5.13 step 6: private companies show 0.7 x fair value. */
const PRIVATE_DISCOUNT = 0.7;

describe("m5 load views", () => {
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
    // SetOmniscient is debug-only (Rust cfg!(debug_assertions), on in tests).
    const sim = unwrap(simNew(data(), 1, { debug: true }), "Sim::new");
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
