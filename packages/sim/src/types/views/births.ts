// v_births (crates/sim/src/views/births.rs): `list_startup_events(since)`, `list_births(since)`
// and `list_listings(since)` (spec 9.2; 8 Startups and listings), each event with its name (the
// Company header's "Founded [date] ([event])"), and the Industries table's births column: births
// per industry over the last 4 quarters (spec 8). Rebuilt quarterly: events, births and listings
// happen only at the plan lock (spec 9.4 Quarterly, 4.4 row 3).
//
// Not ported: BirthsView::list_startup_events, ::list_births, ::list_listings, ::event (binary
// search by id), ::births_last_four_quarters and the `ViewData` build (logic).

import type { Quarter, SimDate } from "../calendar.ts";
import type { CompanyId, IndustryId, ProvinceId, StartupEventId, ZoneId } from "../ids.ts";
import type { Figure } from "./estimate.ts";
import type { EventKind } from "./shared.ts";

/** Spec 8 Industries table: the births column counts the last 4 quarters. */
export const BIRTHS_COLUMN_QUARTERS = 4;

/** A startup event that fired (spec 9.2 `list_startup_events`). */
export interface EventRow {
  id: StartupEventId;
  /** Fixed (its startup-events.csv id) or random (its type). */
  kind: EventKind;
  /** A fixed event's startup-events.csv `name`, a random event's type name (5.19.1). */
  name: string;
  date: SimDate;
  industries: IndustryId[];
  startups: CompanyId[];
}

/** A company born in play (spec 9.2 `list_births`). */
export interface BirthRow {
  id: CompanyId;
  name: string;
  industry: IndustryId;
  hq: ProvinceId;
  date: SimDate;
  /** Revenue it was sized for, USD a year (5.19.3); a band while it does not publish (D420). */
  size_usd: Figure;
  event: StartupEventId;
}

/** A listing in play (spec 9.2 `list_listings`). */
export interface ListingRow {
  id: CompanyId;
  ticker: string;
  exchange: ZoneId;
  date: SimDate;
  ipo_price: number;
}

export interface BirthsView {
  events: EventRow[];
  births: BirthRow[];
  listings: ListingRow[];
  /** Full characters made in play so far (3.7.2; the spec 10 world population check). */
  full_characters_made: number;
  /** Full characters in the world: the 296 and those made in play. */
  full_characters: number;
  /** The quarters the births column counts, oldest first: this quarter and the 3 before. */
  births_column_quarters: Quarter[];
  /** Companies born per industry in those quarters, in industry id order (spec 8). */
  births_by_industry: number[];
}
