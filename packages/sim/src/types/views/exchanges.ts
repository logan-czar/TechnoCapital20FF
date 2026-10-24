// v_exchanges (crates/sim/src/views/exchanges.rs): `list_exchanges()` and `get_exchange(code)`
// (spec 9.2; batches 152 and 154): the 26 zone exchanges with their code, name, zone, hub city
// and hub province, headline index name and level, listed company count and investor confidence
// (5.1.2), the constituents, and the index's daily closes from 2020, 10 years kept (D540; design
// fix 462). Rebuilt daily (spec 9.4 has no row for it; the index closes and confidence move at
// 00:00, D146); the live level each tick is in v_quotes.
//
// Not ported: ExchangesView::get (by code), ::of_zone and the `ViewData` build (logic).

import type { CompanyId, ProvinceId, ZoneId } from "../ids.ts";
import type { IndexHistory } from "./shared.ts";

/** One zone exchange (spec 9.2 `list_exchanges` row and `get_exchange` detail). */
export interface ExchangeRow {
  zone: ZoneId;
  /** Logan's zone number, 1 to 26. */
  zone_number: number;
  zone_key: string;
  code: string;
  name: string;
  hub_city: string;
  hub_province: ProvinceId;
  index_name: string;
  /** The headline index level at this tick; null with no quoted company (spec 5.14). */
  level: number | null;
  /** The listed companies quoted now: those whose HQ country is in the zone (spec 5.14). */
  listed_count: number;
  /** Investor confidence, −100 to +100 (spec 5.1.2). */
  confidence: number;
  /** The index constituents (the quoted listed companies), in company id order. */
  constituents: CompanyId[];
  /**
   * The index's daily closes, oldest first: the load level on 1 January 2020, then each
   * 00:00 close, 10 years kept (D540). Shares its chunks with the World (D148).
   */
  closes: IndexHistory;
}

export interface ExchangesView {
  /** In zone id order. */
  exchanges: ExchangeRow[];
}
