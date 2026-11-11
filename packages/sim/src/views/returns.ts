// v_returns's builder slot (D1037), owned by lane E (elections). Its `build` is to give
// the latest general's count from `World.elections` (counted at once at Coarse, M2), and its
// county slice (`ViewBuilder.slice`, key `{ view: "returns", slice: "counties", race }`) from
// `county_results`.
//
// The contracts change left it unported: the sim holds the empty value below and never posts it
// (views/patch.ts). The lane sets `build` (and `rebuildFrom` or `slice` where the view needs them)
// on this one object; views/index.ts `VIEW_BUILDERS` names it and is not edited.

import type { ReturnsView } from "../types/views/returns.ts";
import type { ViewBuilder } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyReturns(): ReturnsView {
  return { election: null, races: [] };
}

/** v_returns's slot in `VIEW_BUILDERS`. */
export const returnsBuilder: ViewBuilder<ReturnsView> = {
  rust: "(none: pivot 9)",
  empty: emptyReturns,
  build: null,
};
