// v_zones: the Zone page (M9 plan, spec 8 Financial zones hover, 9.2 `get_cycle`): each of the 26
// financial zones with its number, name, base and effective credit spread, investor confidence
// (5.1.2), its exchange and headline index level at the last daily close (5.14), its GDP share
// and its member countries. Rebuilt daily: confidence moves at 00:00 (5.1.2, D146). Ported from
// crates/sim/src/views/zones.rs.

import { type CountryId, ordinal, type ZoneId } from "../types/ids.ts";
import type { ZoneRow, ZonesView } from "../types/views/zones.ts";
import type { ViewInput } from "./index.ts";

/** Rust `ZonesView::get`. */
export function zonesViewGet(v: ZonesView, id: ZoneId): ZoneRow | null {
  return v.zones[id] ?? null;
}

/** Rust `impl ViewData for ZonesView`: `build`. */
export function buildZones(input: ViewInput): ZonesView {
  const w = input.world;
  const members: CountryId[][] = w.zones.map(() => []);
  w.countries.forEach((c, i) => {
    (members[c.zone] as CountryId[]).push(ordinal<CountryId>(i));
  });
  const zones = w.zones.map(
    (z, i): ZoneRow => ({
      id: ordinal<ZoneId>(i),
      number: z.number,
      key: z.key,
      name: z.name,
      exchange_code: z.exchange_code,
      exchange_name: z.exchange_name,
      index_name: z.headline_index,
      index_close: (w.market.indices[i] as (typeof w.market.indices)[number]).prev_close,
      credit_spread_base: z.credit_spread_base,
      credit_spread: z.credit_spread,
      confidence: z.confidence,
      gdp_share: z.gdp_share,
      effect: z.effect,
      members: members[i] as CountryId[],
    }),
  );
  return { zones };
}
