// v_province_card (crates/sim/src/views/province_cards.rs): `get_province(id)` (spec 9.2), the
// province card of spec 8's Map row: development, resource, terrain, Metro, key city, and the HQs
// and units there. Rebuilt monthly and on load (spec 9.4); companies born in play show at the
// next monthly rebuild.
//
// Units are listed by id only: their money figures (assets) come from v_units, which bands a
// company that does not publish (D420), so no second path can print a band's truth. Removed
// companies (5.12 step 3) are left out of both lists.
//
// Not ported: ProvinceCardsView::get, largest_track (spec 3.3; ties count for both, 10.3.1) and
// the `ViewData` build (logic).

import type { CompanyId, CountryId, ProvinceId, UnitId } from "../ids.ts";

/**
 * Which development track is the largest (spec 3.3 `largest_track`; ties count for both,
 * 10.3.1).
 */
export type LargestTrack =
  | "Commerce"
  | "Industry"
  /** Commerce and Industry tie. */
  | "Both";

/** One province card (spec 8 Map row, 9.2 `get_province`). */
export interface ProvinceCard {
  id: ProvinceId;
  /** provinces-*.csv `id`. */
  key: string;
  name: string;
  country: CountryId;
  region: string;
  area: string;
  /** Development tracks, 1 to 30 each, and their sum (spec 3.3). */
  commerce: number;
  industry: number;
  population: number;
  total: number;
  largest_track: LargestTrack;
  resource: string;
  terrain: string;
  coastal: boolean;
  /** The `contested` tag, if any (decision C). */
  contested: string | null;
  metro: string | null;
  city_rank: string;
  key_city: string | null;
  /** Companies headquartered here, in id order. */
  hqs: CompanyId[];
  /** Business units based here, in id order. */
  units: UnitId[];
}

export interface ProvinceCardsView {
  /** By province ordinal. */
  cards: ProvinceCard[];
}
