// Shared helpers for the careers tests (lane C, D1041): worlds at their start, and the seats up at a
// general for the ladder's unit tests. Runs of years use lane E's real elections
// (../elections/harness.ts; D1052) in place of the stand-in general the lane built against.

import { simNew, simWorld } from "../../src/lib.ts";
import { governorCycleOf, houseSeatsOf } from "../../src/politics/careers.ts";
import { officeHolderOf, officeSeatOrder } from "../../src/politics/people.ts";
import { ordinal, type UsStateId } from "../../src/types/ids.ts";
import type { OfficeSeat } from "../../src/types/state/persons.ts";
import type { World } from "../../src/types/world.ts";
import { data, data1995, unwrap } from "../common/index.ts";

/** A new 1995 game's world at its start (the real Congress; stable scenario). */
export function world1995(seed: number): World {
  return simWorld(unwrap(simNew(data1995(), seed, { scenario: "stable" }), "1995 world"));
}

/** A new game of the frozen mini world (no era, no counties). */
export function worldMini(seed: number): World {
  return simWorld(unwrap(simNew(data(), seed), "mini world"));
}

/** The seats up at a November general in `year` (a stand-in for lane E's calendar). */
export function seatsUp(w: World, year: number): OfficeSeat[] {
  const s = w.persons;
  const out: OfficeSeat[] = [];
  const up = (seat: OfficeSeat): boolean => {
    const h = officeHolderOf(s, seat);
    return h === undefined || h.term_ends === null || h.term_ends.year === year + 1;
  };
  if (year % 4 === 0) out.push({ kind: "President" });
  w.politics.states.forEach((st, i) => {
    const state = ordinal<UsStateId>(i);
    if (year % 2 === 0) {
      for (const c of st.senate_classes) {
        const seat: OfficeSeat = { kind: "Senate", state, senate_class: c };
        if (up(seat)) out.push(seat);
      }
      for (let d = 1; d <= houseSeatsOf(w, state); d++) out.push({ kind: "House", state, district: d });
    }
    const cycle = governorCycleOf(w, state);
    if (cycle !== null) {
      const seat: OfficeSeat = { kind: "Governor", state };
      const h = officeHolderOf(s, seat);
      if (h !== undefined && h.term_ends !== null && h.term_ends.year === year + 1) out.push(seat);
    }
  });
  return out.sort(officeSeatOrder);
}
