// v_districts's builder slot (D1037), owned by lane G (geo). Its `build` is to give
// each state's plan in force and its districts from `World.geo`, with each seat's member from
// `World.persons`.
//
// The contracts change left it unported: the sim holds the empty value below and never posts it
// (views/patch.ts). The lane sets `build` (and `rebuildFrom` or `slice` where the view needs them)
// on this one object; views/index.ts `VIEW_BUILDERS` names it and is not edited.

import type { DistrictsView } from "../types/views/districts.ts";
import type { ViewBuilder } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyDistricts(): DistrictsView {
  return { plans: [], districts: [] };
}

/** v_districts's slot in `VIEW_BUILDERS`. */
export const districtsBuilder: ViewBuilder<DistrictsView> = {
  rust: "(none: pivot 5.4)",
  empty: emptyDistricts,
  build: null,
};
