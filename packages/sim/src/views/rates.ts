// v_rates: `get_rates()` (spec 9.2; 8 Pdoomberg F7 Bonds, batch 155): the world base rate, every
// zone's base and effective credit spread, every country's sovereign rating and spread, and the
// rating-to-corporate-spread table of the credit line (5.12). Rebuilt monthly (the zone spreads
// move at the quarter's first monthly close, 4.3 step 1d) and on load. Ported from
// crates/sim/src/views/rates.rs.

import { corporateSpread, RATING_ALL } from "../finance/rating.ts";
import { type CountryId, ordinal, type ZoneId } from "../types/ids.ts";
import type { RatesView } from "../types/views/rates.ts";
import type { ViewInput } from "./index.ts";

/** Rust `impl ViewData for RatesView`: `build`. */
export function buildRates(input: ViewInput): RatesView {
  const w = input.world;
  return {
    base_rate: w.base_rate,
    zones: w.zones.map((z, i) => ({
      zone: ordinal<ZoneId>(i),
      number: z.number,
      name: z.name,
      base: z.credit_spread_base,
      effective: z.credit_spread,
    })),
    sovereigns: w.countries.map((c, i) => ({
      country: ordinal<CountryId>(i),
      iso3: c.key,
      name: c.name,
      zone: c.zone,
      rating: c.sovereign_rating,
      spread: c.sovereign_spread,
    })),
    rating_spreads: RATING_ALL.map((rating) => ({ rating, spread: corporateSpread(rating) })),
  };
}
