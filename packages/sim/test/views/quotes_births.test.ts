// Checks for the quotes and births views (Step 3 chunk B2); the Rust files have no in-file tests.
import { describe, expect, it } from "vitest";
import { simApply, simNew, simStep, simViews, simWorld } from "../../src/lib.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import {
  birthsViewBirthsLastFourQuarters,
  birthsViewEvent,
  birthsViewListBirths,
} from "../../src/views/births.ts";
import { quotesViewGet, quotesViewIndex, quotesViewOnExchange } from "../../src/views/quotes.ts";
import { data, unwrap } from "../common/index.ts";

describe("quotes and births views", () => {
  it("quotes: one row per quoted stock; the true V only in Omniscient", () => {
    const sim = unwrap(simNew(data(), 4, { debug: true }), "Sim::new");
    for (let i = 0; i < 30; i++) simStep(sim);
    const w = simWorld(sim);
    const q = simViews(sim).quotes.data;
    expect(q.rows.length).toBe(w.market.stocks.filter((s) => s.quoted).length);
    expect(q.indices.length).toBe(26);
    expect(q.rows.every((r) => r.value === null && r.volume === 0)).toBe(true);
    const r = q.rows[0];
    expect(quotesViewGet(q, r?.id as never)).toBe(r);
    expect(quotesViewOnExchange(q, r?.exchange as never)).toContain(r);
    expect(quotesViewIndex(q, 0 as never)).toBe(q.indices[0]);
    expect(r?.efv_low).toBeLessThan(r?.efv as number);
    // Omniscient follows a control (spec 9.4, D423).
    unwrap(simApply(sim, { kind: "SetOmniscient", on: true }), "SetOmniscient");
    const q2 = simViews(sim).quotes.data;
    expect(q2).not.toBe(q);
    expect(q2.rows.every((x) => x.value !== null)).toBe(true);
    expect(q.rows[0]?.value, "the earlier build is untouched").toBeNull();
  });

  it("births: nothing born at load; the column covers four quarters", () => {
    const sim = unwrap(simNew(data(), 4), "Sim::new");
    const b = simViews(sim).births.data;
    expect(b.births).toEqual([]);
    expect(b.births_column_quarters.length).toBe(4);
    expect(b.births_by_industry.length).toBe(simWorld(sim).industries.length);
    expect(b.full_characters).toBe(simWorld(sim).characters.length);
    expect(birthsViewListBirths(b, simDateYmd(2019, 1, 1))).toEqual([]);
    expect(birthsViewEvent(b, 0 as never)).toBeNull();
    expect(birthsViewBirthsLastFourQuarters(b, 0 as never)).toBe(0);
  });
});
