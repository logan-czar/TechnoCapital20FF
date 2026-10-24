// v_zones (crates/sim/src/views/zones.rs): the Zone page (M9 plan, spec 8 Financial zones hover,
// 9.2 `get_cycle`): each of the 26 financial zones with its number, name, base and effective
// credit spread, investor confidence (5.1.2), its exchange and headline index level at the last
// daily close (5.14), its GDP share and its member countries. Rebuilt daily: confidence moves at
// 00:00 (5.1.2, D146).
//
// Not ported: ZonesView::get and the `ViewData` build (logic).

import type { CountryId, ZoneId } from "../ids.ts";

/** One financial zone (spec 3.2.1, 5.1.2). */
export interface ZoneRow {
  id: ZoneId;
  /** Logan's zone number, 1 to 26. */
  number: number;
  key: string;
  name: string;
  exchange_code: string;
  exchange_name: string;
  index_name: string;
  /** The headline index at its last daily close; null with no listing (5.14). */
  index_close: number | null;
  /** Base and effective credit spread, fractions (spec 5.1.2). */
  credit_spread_base: number;
  credit_spread: number;
  /** Investor confidence, −100 to +100 (spec 5.1.2). */
  confidence: number;
  /** The zone's share of world GDP (spec 5.1). */
  gdp_share: number;
  /** `intensity × g(t − lag)` plus any own shock, a yearly rate (spec 5.1). */
  effect: number;
  /** Member countries in country id order (spec 3.2.1). */
  members: CountryId[];
}

export interface ZonesView {
  /** In zone id order. */
  zones: ZoneRow[];
}
