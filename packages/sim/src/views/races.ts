// v_races's builder slot (D1037), owned by lane E (elections; D1040): the races of the open cycle and
// of the latest general, from `World.elections`, titled with the states' names. A candidate's
// strength is hidden (pivot 5.11) unless Omniscient; money is null until a first filing (M3's full
// campaigns: Coarse races file nothing).
//
// views/index.ts `VIEW_BUILDERS` names this one object and is not edited.

import { countiesByState, houseSeats, electors as stateElectors } from "../elections/geography.ts";
import { ordinal, type UsStateId } from "../types/ids.ts";
import type { Race } from "../types/state/elections.ts";
import type { CandidateRow, RaceRow, RacesView } from "../types/views/races.ts";
import type { ViewBuilder, ViewInput } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyRaces(): RacesView {
  return { cycle: null, races: [] };
}

/** "Texas 12", "Ohio Senate", "Ohio Governor", "President"; a special says so. */
export function raceTitle(input: ViewInput, r: Race): string {
  const state = r.state === null ? "" : (input.world.politics.states[r.state]?.name ?? "");
  const seats = r.state === null ? 0 : houseSeats(input.world, r.state);
  const base =
    r.office === "President"
      ? "President"
      : r.office === "House"
        ? seats <= 1
          ? `${state} at-large`
          : `${state} ${r.district}`
        : `${state} ${r.office}`;
  return r.special ? `${base} (special)` : base;
}

/** The college's votes to win (a majority of every state's electors). */
function collegeMajority(input: ViewInput): number {
  const byState = countiesByState(input.world);
  let all = 0;
  input.world.politics.states.forEach((_, i) => {
    all += stateElectors(input.world, ordinal<UsStateId>(i), byState[i] ?? []);
  });
  return Math.floor(all / 2) + 1;
}

/** The races shown: the newest cycle's, and the latest general's if that is older. */
export function shownRaces(input: ViewInput): { cycle: number | null; races: Race[] } {
  const e = input.world.elections;
  const all = e.races;
  const last = all.at(-1);
  if (last === undefined) return { cycle: null, races: [] };
  let cycle = 0;
  for (const r of all) if (!r.special && r.cycle > cycle) cycle = r.cycle;
  const latest = e.latest_general?.year ?? cycle;
  const open = all.some((r) => r.status !== "Certified");
  const races: Race[] = [];
  for (let i = all.length - 1; i >= 0; i--) {
    const r = all[i] as Race;
    if (r.cycle < Math.min(cycle, latest)) break;
    races.push(r);
  }
  races.reverse();
  return { cycle: open ? cycle : null, races };
}

function row(input: ViewInput, r: Race, majority: number): RaceRow {
  const omniscient = input.controls.omniscient;
  const candidates: CandidateRow[] = r.candidacies.map((c) => ({
    person: c.person,
    party: c.party,
    status: c.status,
    incumbent: c.incumbent,
    raised: null,
    cash: null,
    strength: omniscient ? c.strength : null,
  }));
  return {
    id: r.id,
    office: r.office,
    state: r.state,
    district: r.district,
    senate_class: r.senate_class,
    special: r.special,
    title: raceTitle(input, r),
    status: r.status,
    primaries: r.primaries.map((p) => ({
      party: p.party,
      date: p.date,
      ballot: p.ballot.slice(),
      winner: p.result?.winner ?? null,
    })),
    general: r.general,
    polls_close: r.polls_close,
    certify: r.certify,
    incumbent_party: r.incumbent_party,
    electoral_votes: r.office === "President" ? majority : null,
    candidates,
    ballot: r.ballot.slice(),
    winner: r.status === "Certified" ? (r.result?.winner ?? null) : null,
  };
}

/** v_races (pivot 6.1, 6.2). */
export function buildRaces(input: ViewInput): RacesView {
  const { cycle, races } = shownRaces(input);
  if (races.length === 0) return { cycle, races: [] };
  const majority = races.some((r) => r.office === "President") ? collegeMajority(input) : 0;
  return { cycle, races: races.map((r) => row(input, r, majority)) };
}

/** v_races's slot in `VIEW_BUILDERS`. */
export const racesBuilder: ViewBuilder<RacesView> = {
  rust: "(none: pivot 6.2)",
  empty: emptyRaces,
  build: buildRaces,
};
