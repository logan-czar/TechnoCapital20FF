// v_returns's builder slot (D1037), owned by lane E (elections; D1040): the latest general's count
// from `World.elections`. In M2 a race is counted at once when its polls close (pivot 9.1), so a
// counted race is fully reported; election night's batches, the outlets' calls and recounts are M5's
// (calls empty, `called` null). The county slice (`{ view: "returns", slice: "counties", race }`)
// comes from `county_results`, kept for the latest general and the latest presidential race.
//
// The view's cadence is every tick, so `rebuildFrom` hands back the last build while nothing it
// shows has moved (the latest general, its races counted and certified): its result equals `build`'s.
//
// views/index.ts `VIEW_BUILDERS` names this one object and is not edited.

import type { SimDate } from "../types/calendar.ts";
import { dateEq } from "../types/calendar.ts";
import type { SliceData, SliceKey } from "../types/protocol.ts";
import type { Race } from "../types/state/elections.ts";
import type { RaceReturns, ReturnsView, StateReturns } from "../types/views/returns.ts";
import type { ViewBuilder, ViewInput } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyReturns(): ReturnsView {
  return { election: null, races: [] };
}

/** The races of `general` that have been counted, in id order (they sit at the table's tail). */
function countedOn(input: ViewInput, general: SimDate): Race[] {
  const all = input.world.elections.races;
  const out: Race[] = [];
  for (let i = all.length - 1; i >= 0; i--) {
    const r = all[i] as Race;
    if (r.cycle < general.year - 1) break;
    if (r.result !== null && dateEq(r.general, general)) out.push(r);
  }
  return out.reverse();
}

function raceReturns(input: ViewInput, r: Race): RaceReturns {
  const result = r.result as NonNullable<Race["result"]>;
  const votes = r.ballot.map((person, i) => ({ person, votes: result.votes[i] ?? 0 }));
  let electoral: RaceReturns["electoral_votes"] = null;
  let states: StateReturns[] | null = null;
  if (r.office === "President") {
    const college = input.world.elections.colleges.find((c) => c.race === r.id);
    if (college !== undefined) {
      electoral = r.ballot.map((person, i) => ({ person, votes: college.totals[i] ?? 0 }));
      states = college.states.map((t) => ({
        state: t.state,
        polls_closed: r.polls_close,
        reporting: 1,
        votes: r.ballot.map((person, i) => ({ person, votes: t.votes[i] ?? 0 })),
        electoral_votes: t.electoral_votes,
        called: null,
        certified: result.certified,
      }));
    }
  }
  return {
    race: r.id,
    polls_closed: r.polls_close,
    reporting: 1,
    votes,
    electoral_votes: electoral,
    states,
    calls: [],
    recount: result.recount,
    certified: result.certified,
  };
}

/** v_returns (pivot 9, 8.6). */
export function buildReturns(input: ViewInput): ReturnsView {
  const general = input.world.elections.latest_general;
  if (general === null) return emptyReturns();
  return { election: general, races: countedOn(input, general).map((r) => raceReturns(input, r)) };
}

/** Whether `prev` still shows the state: the same general, races and certifications. */
function unchanged(prev: ReturnsView, input: ViewInput): boolean {
  const general = input.world.elections.latest_general;
  if (general === null || prev.election === null) return general === prev.election;
  if (!dateEq(general, prev.election)) return false;
  const races = countedOn(input, general);
  if (races.length !== prev.races.length) return false;
  return races.every((r, i) => {
    const p = prev.races[i] as RaceReturns;
    const a = p.certified;
    const b = r.result?.certified ?? null;
    const same = a === null || b === null ? a === b : dateEq(a, b);
    return p.race === r.id && same && p.recount === r.result?.recount;
  });
}

/** One race's county count (pivot 9.2, 8.6): fully reported once counted. */
export function returnsCountySlice(input: ViewInput, key: SliceKey): SliceData {
  if (key.view !== "returns") return null;
  const row = input.world.elections.county_results.find((c) => c.race === key.race);
  if (row === undefined) return null;
  return {
    race: row.race,
    counties: row.counties.slice(),
    reporting: row.counties.map(() => 1),
    votes: row.counties.map((_, k) => row.votes.map((col) => col[k] ?? 0)),
  };
}

/** v_returns's slot in `VIEW_BUILDERS`. */
export const returnsBuilder: ViewBuilder<ReturnsView> = {
  rust: "(none: pivot 9)",
  empty: emptyReturns,
  build: buildReturns,
  rebuildFrom: (prev, input) => (unchanged(prev, input) ? prev : buildReturns(input)),
  slice: returnsCountySlice,
};
