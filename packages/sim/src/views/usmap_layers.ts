// v_usmap_layers's builder slot (D1037), owned by lane G (geo). Its `build` is to give
// the county columns and states from `World.geo`, the last presidential result by county from
// `World.elections.county_results`, and each governor's party from `World.persons`.
//
// The contracts change left it unported: the sim holds the empty value below and never posts it
// (views/patch.ts). The lane sets `build` (and `rebuildFrom` or `slice` where the view needs them)
// on this one object; views/index.ts `VIEW_BUILDERS` names it and is not edited.

import type { UsMapLayersView } from "../types/views/usmap_layers.ts";
import type { ViewBuilder } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyUsMapLayers(): UsMapLayersView {
  return {
    counties: {
      fips: [],
      state: [],
      name: [],
      population: [],
      district: [],
      turnout: [],
      last_votes: [],
      last_winner: [],
      last_margin: [],
      lean: null,
    },
    states: [],
  };
}

/** v_usmap_layers's slot in `VIEW_BUILDERS`. */
export const usMapLayersBuilder: ViewBuilder<UsMapLayersView> = {
  rust: "(none: pivot 15.3)",
  empty: emptyUsMapLayers,
  build: null,
};
