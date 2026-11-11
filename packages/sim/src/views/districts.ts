// v_districts (pivot 5.4 to 5.6, 8.6; D1037), owned by lane G (geo): each state's plan in force and
// its districts from `World.geo`, with each seat's member from `World.persons`. The plan's strength
// and a district's lean are hidden (pivot 5.11): null unless Omniscient.

import { districtNow } from "../geo/plans.ts";
import { officeHolderOf } from "../politics/people.ts";
import {
  type DistrictPlanRow,
  type DistrictRow,
  type DistrictsView,
  districtRefId,
} from "../types/views/districts.ts";
import type { ViewBuilder, ViewInput } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyDistricts(): DistrictsView {
  return { plans: [], districts: [] };
}

/** The plans in force and their districts, in state order then district number. */
export function buildDistricts(input: ViewInput): DistrictsView {
  const w = input.world;
  const omniscient = input.controls.omniscient;
  const plans: DistrictPlanRow[] = [];
  const districts: DistrictRow[] = [];
  for (const p of w.geo.plans) {
    plans.push({
      state: p.state,
      census_year: p.census_year,
      since: { ...p.since },
      drawn_by: p.drawn_by,
      struck: p.struck,
      strength: omniscient ? p.strength : null,
    });
    for (const d of p.districts) {
      const held = officeHolderOf(w.persons, { kind: "House", state: d.state, district: d.number });
      districts.push({
        id: districtRefId(d.state, d.number),
        state: d.state,
        number: d.number,
        shares: d.shares.map((s) => ({ ...s })),
        population: d.population,
        member: held?.person ?? null,
        // pivot 5.2, 5.11: its people's lean as the counties stand now, for the Omniscient eye only.
        lean: omniscient ? districtNow(w.geo, d).lean : null,
      });
    }
  }
  return { plans, districts };
}

/** v_districts's slot in `VIEW_BUILDERS`. */
export const districtsBuilder: ViewBuilder<DistrictsView> = {
  rust: "(none: pivot 5.4)",
  empty: emptyDistricts,
  build: buildDistricts,
};
