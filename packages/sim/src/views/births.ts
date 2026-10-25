// v_births: `list_startup_events(since)`, `list_births(since)` and `list_listings(since)` (spec
// 9.2; 8 Startups and listings), each event with its name (the Company header's "Founded [date]
// ([event])"), and the Industries table's births column: births per industry over the last 4
// quarters (spec 8). Rebuilt quarterly: events, births and listings happen only at the plan lock
// (spec 9.4 Quarterly, 4.4 row 3). Ported from crates/sim/src/views/births.rs; the types are in
// types/views/births.ts.

import { eventTypeName } from "../births/random.ts";
import { GENERATED_TIER } from "../people/full.ts";
import { dateTimeDate, quarterPrev, simDateQuarter } from "../time/calendar.ts";
import { cmpDate, type Quarter, quarterEq, type SimDate } from "../types/calendar.ts";
import { type CompanyId, type IndustryId, ordinal, type StartupEventId } from "../types/ids.ts";
import {
  BIRTHS_COLUMN_QUARTERS,
  type BirthRow,
  type BirthsView,
  type EventRow,
  type ListingRow,
} from "../types/views/births.ts";
import { ESTIMATE_FLOOR_USD } from "../types/views/estimate.ts";
import { estimatorBanded, estimatorOfPeriod, viewInputEstimator } from "./estimate.ts";
import type { ViewInput } from "./index.ts";

export { BIRTHS_COLUMN_QUARTERS };

/** Rust `BirthsView::list_startup_events`. */
export function birthsViewListStartupEvents(v: BirthsView, since: SimDate): EventRow[] {
  return v.events.filter((e) => cmpDate(e.date, since) >= 0);
}

/** Rust `BirthsView::list_births`. */
export function birthsViewListBirths(v: BirthsView, since: SimDate): BirthRow[] {
  return v.births.filter((b) => cmpDate(b.date, since) >= 0);
}

/** Rust `BirthsView::list_listings`. */
export function birthsViewListListings(v: BirthsView, since: SimDate): ListingRow[] {
  return v.listings.filter((l) => cmpDate(l.date, since) >= 0);
}

/** Rust `BirthsView::event`: the event with id `id`, a binary search (events are in id order). */
export function birthsViewEvent(v: BirthsView, id: StartupEventId): EventRow | null {
  let lo = 0;
  let hi = v.events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const e = v.events[mid] as EventRow;
    if (e.id === id) return e;
    if (e.id < id) lo = mid + 1;
    else hi = mid;
  }
  return null;
}

/** Rust `BirthsView::births_last_four_quarters`: the births column of industry `id` (spec 8). */
export function birthsViewBirthsLastFourQuarters(v: BirthsView, id: IndustryId): number {
  return v.births_by_industry[id] ?? 0;
}

/** Rust `impl ViewData for BirthsView`: `build`. */
export function buildBirths(input: ViewInput): BirthsView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const events = w.births.events.map(
    (e): EventRow => ({
      id: e.id,
      kind: structuredClone(e.kind),
      name:
        e.kind.kind === "Random"
          ? eventTypeName(e.kind.event_type)
          : (() => {
              const key = e.kind.id;
              const f = w.births.fixed.find((f) => f.id === key);
              return f === undefined ? key : f.name;
            })(),
      date: e.date,
      industries: [...e.industries],
      startups: [...e.companies],
    }),
  );
  const nowQ = simDateQuarter(dateTimeDate(w.clock));
  const births_column_quarters: Quarter[] = [];
  for (let back = BIRTHS_COLUMN_QUARTERS - 1; back >= 0; back--) {
    let q = nowQ;
    for (let k = 0; k < back; k++) q = quarterPrev(q);
    births_column_quarters.push(q);
  }
  const births: BirthRow[] = [];
  w.companies.forEach((c, i) => {
    if (c.origin.kind !== "Born") return;
    const id = ordinal<CompanyId>(i);
    const date = c.origin.date;
    births.push({
      id,
      name: c.name,
      industry: c.industry,
      hq: c.hq_province,
      date,
      size_usd: estimatorOfPeriod(
        est,
        estimatorBanded(est, w, id),
        { kind: "Company", company: id },
        { kind: "BirthSize" },
        { kind: "Quarter", quarter: simDateQuarter(date) },
        c.revenue_usd,
        ESTIMATE_FLOOR_USD,
      ),
      event: c.origin.event,
    });
  });
  const births_by_industry: number[] = new Array<number>(w.industries.length).fill(0);
  for (const b of births) {
    const q = simDateQuarter(b.date);
    if (births_column_quarters.some((x) => quarterEq(x, q))) {
      births_by_industry[b.industry] = (births_by_industry[b.industry] as number) + 1;
    }
  }
  const listings: ListingRow[] = [];
  w.companies.forEach((c, i) => {
    const s = w.market.stocks[i] as (typeof w.market.stocks)[number];
    if (s.exchange === null || s.listed_on === null) return;
    listings.push({
      id: ordinal<CompanyId>(i),
      ticker: c.ticker,
      exchange: s.exchange,
      date: s.listed_on,
      ipo_price: s.ipo_price,
    });
  });
  return {
    events,
    births,
    listings,
    full_characters_made: w.characters.filter((c) => c.tier === GENERATED_TIER).length,
    full_characters: w.characters.length,
    births_column_quarters,
    births_by_industry,
  };
}
