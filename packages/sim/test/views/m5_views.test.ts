// Port of crates/sim/tests/m5_views.rs: the M5 views (spec 9.2, 9.4): v_quotes (every tick),
// v_price_bars (daily), v_exchanges (daily), v_market_stats (daily), the zone confidence in v_cycle
// (daily) and the prices in v_company_row and v_company_detail, each read against the World after
// a 100-day run. True V shows only in Omniscient (spec 8), and a private company has a value but
// no quote.
//
// Expects:
//   ../../src/lib.ts                  simNew, simApply, simStep, simNow, simWorld, simViews
//   ../../src/views/price_bars.ts     priceBarsViewGetPriceHistory(view, company, resolution,
//                                        from, to) -> DailyBar[] [PriceBarsView::get_price_history;
//                                        weekly bars dated the Monday, monthly the first bar's
//                                        month; open of the first, close of the last, high/low
//                                        extremes, the last day's efv]
//   ../../src/world/log.ts            chunkLogRows, chunkLogIsEmpty (exist)
//
// Changed from the Rust: the seed (8) seeds the new generator (D951); nothing asserted names a
// draw. The EFV error checks (|e| <= 0.15, at least one nonzero) hold for any draws (3.14.2).
// `if cfg!(debug_assertions)` becomes "when SetOmniscient is accepted".
import { describe, expect, it } from "vitest";
import { type Sim, simApply, simNew, simNow, simStep, simViews, simWorld } from "../../src/lib.ts";
import { dateTimeAt, simDateWeekday, simDateYmd, weekdayIndex } from "../../src/time/calendar.ts";
import { cmpDate, type DateTime } from "../../src/types/calendar.ts";
import type { CompanyId, ZoneId } from "../../src/types/ids.ts";
import type { DailyBar } from "../../src/types/state/market.ts";
import { priceBarsViewGetPriceHistory } from "../../src/views/price_bars.ts";
import { chunkLogIsEmpty, chunkLogRows } from "../../src/world/log.ts";
import { data, unwrap } from "../common/index.ts";
import { byField } from "../common/views.ts";

function runTo(sim: Sim, t: DateTime): void {
  while (simNow(sim) < t) simStep(sim);
}

function mk(): Sim {
  return unwrap(simNew(data(), 8), "Sim::new");
}

describe("m5 views", () => {
  it("market_views_show_the_world", () => {
    const sim = mk();
    // A plain hour mid-April, after the Q1 release (EFV errors drawn).
    runTo(sim, dateTimeAt(simDateYmd(2020, 4, 20), 13));
    const w = simWorld(sim);
    const v = simViews(sim);

    // v_quotes: every quoted stock, live this tick.
    const quotes = v.quotes.data;
    const quoted = w.market.stocks.map((s, i) => [i as CompanyId, s] as const).filter(([, s]) => s.quoted);
    expect(quotes.rows.length).toBe(quoted.length);
    for (const [id, s] of quoted) {
      const qt = byField(quotes.rows, "id", id);
      if (qt === undefined) throw new Error(`no quote for ${id}`);
      expect(qt.last).toBe(s.price);
      expect(qt.change).toBe(s.price - s.prev_close);
      expect(qt.volume).toBe(0);
      // 3.14.2: EFV = V x (1 + e), e within +-15%, the band +-15% around it.
      expect(Math.abs(s.efv_error) <= 0.15).toBe(true);
      expect(Math.abs(qt.efv - s.value * (1.0 + s.efv_error)) < 1e-9 * qt.efv).toBe(true);
      expect(Math.abs(qt.efv_high / qt.efv - 1.15) < 1e-12).toBe(true);
      expect(Math.abs(qt.efv_low / qt.efv - 0.85) < 1e-12).toBe(true);
      expect(qt.value, "true V is never shown outside Omniscient").toBeNull();
    }
    expect(
      quoted.some(([, s]) => s.efv_error !== 0.0),
      "errors drawn at the release",
    ).toBe(true);
    expect(quotes.indices.length).toBe(26);

    // v_company_row and v_company_detail: the price at the last monthly rebuild (1 April).
    const rows = v.company_rows.data.rows;
    const detail = v.company_detail.data.companies;
    for (const r of rows) {
      const s = w.market.stocks[r.id];
      if (s === undefined) throw new Error(`no stock ${r.id}`);
      expect(r.exchange).toBe(s.exchange);
      const d = detail[r.id];
      if (d === undefined) throw new Error(`no detail ${r.id}`);
      expect(d.exchange).toBe(s.exchange);
      expect(d.shares_out).toBe(w.companies[r.id]?.shares_out);
      if (s.exchange === null) expect(r.price).toBe(0.0);
    }

    // v_price_bars: every listed company's bars (none on 1 January); weekly and monthly bars
    // aggregate the daily ones.
    const bars = v.price_bars.data;
    // The 467 listed at load and any listed in play since (5.20.1).
    const withBars = w.market.stocks.filter((s) => !chunkLogIsEmpty(s.bars.log)).length;
    expect(withBars >= 467).toBe(true);
    expect(bars.companies.length).toBe(withBars);
    const first = quoted[0];
    if (first === undefined) throw new Error("no quoted stock");
    const id = first[0];
    const from = simDateYmd(2020, 1, 1);
    const to = simDateYmd(2020, 4, 19);
    const daily = priceBarsViewGetPriceHistory(bars, id, "Daily", from, to);
    const history = chunkLogRows(w.market.stocks[id]?.bars.log as never) as DailyBar[];
    expect(daily.length).toBe(
      history.filter((b) => cmpDate(b.date, from) >= 0 && cmpDate(b.date, to) <= 0).length,
    );
    expect(daily[0]?.date).toEqual(simDateYmd(2020, 1, 2));
    expect(daily.at(-1)?.date).toEqual(to);
    const monthly = priceBarsViewGetPriceHistory(bars, id, "Monthly", from, to);
    expect(monthly.length).toBe(4);
    const march = daily.filter((b) => b.date.month === 3);
    const m = monthly[2] as DailyBar;
    expect(m.open).toBe((march[0] as DailyBar).open);
    expect(m.close).toBe((march[march.length - 1] as DailyBar).close);
    expect(m.high).toBe(Math.max(...march.map((b) => b.high)));
    expect(m.low).toBe(Math.min(...march.map((b) => b.low)));
    const weekly = priceBarsViewGetPriceHistory(bars, id, "Weekly", from, to);
    expect(weekly.slice(1).every((b) => weekdayIndex(simDateWeekday(b.date)) === 0)).toBe(true);

    // v_exchanges and v_cycle: confidence and the index at the last daily close.
    const ex = v.exchanges.data;
    const cycle = v.cycle.data;
    w.zones.forEach((zone, zi) => {
      const z = zi as ZoneId;
      const row = ex.exchanges[zi];
      if (row === undefined) throw new Error(`no exchange row ${zi}`);
      expect(row.confidence).toBe(zone.confidence);
      expect(row.name).toBe(zone.exchange_name);
      expect(cycle.zones[zi]?.confidence).toBe(zone.confidence);
      expect(cycle.zones[zi]?.index_close).toBe(w.market.indices[z]?.prev_close);
    });
    expect(byField(ex.exchanges, "code", "ATX")?.index_name).toBe("Atlantic 500");

    // v_market_stats: the quoted count and the tracking count.
    const stats = v.market_stats.data;
    expect(stats.quoted).toBe(quoted.length);
    expect(stats.listed).toBe(w.market.stocks.filter((s) => s.exchange !== null).length);
    expect(stats.listed >= 467, "the 467 at load and any listed in play").toBe(true);
    expect(stats.within_band <= stats.quoted).toBe(true);

    // Omniscient (debug builds) shows the true V.
    if (simApply(sim, { kind: "SetOmniscient", on: true }).ok) {
      const q0 = simViews(sim).quotes.data.rows[0];
      if (q0 === undefined) throw new Error("no quotes");
      expect(q0.value).toBe(simWorld(sim).market.stocks[q0.id]?.value);
    }
  }, 120_000);
});
