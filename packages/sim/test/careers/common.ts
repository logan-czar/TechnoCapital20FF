// Shared helpers for the careers tests (lane C, D1041): worlds at their start, and a stand-in for
// lane E's elections that drives the careers API the way lane E is expected to (declare, vote,
// hand over), so careers can be run for years without the elections lane.

import { simNew, simWorld } from "../../src/lib.ts";
import {
  candidacyLost,
  declareCycle,
  governorCycleOf,
  houseSeatsOf,
  personAward,
  type SeatDeclared,
  termEndsOf,
} from "../../src/politics/careers.ts";
import {
  officeHolderOf,
  officeLeave,
  officeSeatOrder,
  officesOf,
  officeTake,
} from "../../src/politics/people.ts";
import type { SimDate } from "../../src/types/calendar.ts";
import type { DrawSource } from "../../src/types/draws.ts";
import { ordinal, type PersonId, type UsStateId } from "../../src/types/ids.ts";
import type { OfficeExit, OfficeSeat } from "../../src/types/state/persons.ts";
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

/** What happened at one stand-in general. */
export interface GeneralResult {
  declared: SeatDeclared[];
  winners: PersonId[];
}

/**
 * A stand-in general on `date`: `declareCycle`, then a winner per seat (an incumbent who runs keeps
 * the seat with `holdChance`, else a candidate is picked uniformly), and the handover at once, top
 * of the ladder first: what lane E does over two months, done in one day.
 */
export function standInGeneral(
  w: World,
  draws: DrawSource,
  date: SimDate,
  pick: DrawSource,
  holdChance = 0.85,
): GeneralResult {
  const s = w.persons;
  const seats = seatsUp(w, date.year);
  const declared = declareCycle(w, draws, seats, date);
  const winners = declared.map((d) => {
    const inc = d.candidates.find((c) => c.incumbent);
    if (inc !== undefined && pick.chance("Count", holdChance)) return inc.person;
    const others = d.candidates.filter((c) => !c.incumbent);
    const pool = others.length > 0 ? others : d.candidates;
    return (pool[pick.intInclusive("Count", 0, pool.length - 1)] as { person: PersonId }).person;
  });
  const wonSeat = new Map<PersonId, OfficeSeat>();
  declared.forEach((d, i) => {
    wonSeat.set(winners[i] as PersonId, d.seat);
  });
  const upKeys = new Set(seats.map((x) => JSON.stringify(x)));
  declared.forEach((d, i) => {
    const winner = winners[i] as PersonId;
    const seat = d.seat;
    const holder = officeHolderOf(s, seat);
    if (holder !== undefined && holder.person === winner) {
      holder.term_ends = termEndsOf(w, seat, date);
      personAward(w, draws, winner, "ReElected");
    } else {
      if (holder !== undefined) {
        const exit: OfficeExit =
          d.incumbent_out === null
            ? "Defeated"
            : d.incumbent_out === "Retiring"
              ? "Retired"
              : wonSeat.has(holder.person)
                ? "Promoted"
                : "TermEnded";
        officeLeave(s, seat, exit, date, false);
      }
      officeTake(s, winner, seat, "Elected", date, termEndsOf(w, seat, date));
      personAward(w, draws, winner, "ElectionWon");
      // A winner leaves a seat that is not up this cycle (a governor elected senator).
      for (const o of officesOf(s, winner)) {
        if (officeSeatOrder(o.seat, seat) === 0 || upKeys.has(JSON.stringify(o.seat))) continue;
        officeLeave(s, o.seat, "Promoted", date);
      }
    }
    for (const c of d.candidates) if (c.person !== winner) candidacyLost(w, c.person);
  });
  return { declared, winners };
}
