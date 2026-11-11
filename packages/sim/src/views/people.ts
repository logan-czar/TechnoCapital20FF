// v_people's builder slot (D1037), owned by lane C (careers). Its `build` is to give
// every person from `World.persons`, hidden stats null unless Omniscient (pivot 5.11), and the
// chambers' make-up.
//
// The contracts change left it unported: the sim holds the empty value below and never posts it
// (views/patch.ts). The lane sets `build` (and `rebuildFrom` or `slice` where the view needs them)
// on this one object; views/index.ts `VIEW_BUILDERS` names it and is not edited.

import type { PeopleView } from "../types/views/people.ts";
import type { ViewBuilder } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyPeople(): PeopleView {
  return { people: [], chambers: [] };
}

/** v_people's slot in `VIEW_BUILDERS`. */
export const peopleBuilder: ViewBuilder<PeopleView> = {
  rust: "(none: pivot 5.7)",
  empty: emptyPeople,
  build: null,
};
