// v_races's builder slot (D1037), owned by lane E (elections). Its `build` is to give
// the races of the open cycle and the latest, from `World.elections` (and the people's names from
// `World.persons`).
//
// The contracts change left it unported: the sim holds the empty value below and never posts it
// (views/patch.ts). The lane sets `build` (and `rebuildFrom` or `slice` where the view needs them)
// on this one object; views/index.ts `VIEW_BUILDERS` names it and is not edited.

import type { RacesView } from "../types/views/races.ts";
import type { ViewBuilder } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyRaces(): RacesView {
  return { cycle: null, races: [] };
}

/** v_races's slot in `VIEW_BUILDERS`. */
export const racesBuilder: ViewBuilder<RacesView> = {
  rust: "(none: pivot 6.2)",
  empty: emptyRaces,
  build: null,
};
