// v_usmap_layers (pivot 15.3, 5.1; D1037), owned by lane G (geo): the county columns and the states
// from `World.geo`, the last certified presidential vote by county from `World.elections`
// (`county_results`, which keeps the latest general's and the latest presidential race's columns,
// D1040, D1052) and by state from its college, and each
// governor's party from `World.persons`. A county's true lean is hidden (pivot 5.11): null unless
// Omniscient.

import { officeHolderOf, personGet } from "../politics/people.ts";
import { roundHalfAway } from "../types/num.ts";
import type { CountyResult, Race } from "../types/state/elections.ts";
import type { Party } from "../types/state/politics.ts";
import type { UsMapCounties, UsMapLayersView, UsMapState } from "../types/views/usmap_layers.ts";
import type { World } from "../types/world.ts";
import type { ViewBuilder, ViewInput } from "./index.ts";

/** Electoral votes for a state's two senators (US Constitution art. II). */
export const SENATE_ELECTORS = 2;
/** The District of Columbia's electoral votes, a state with no House seat and counties (23rd amendment). */
export const DC_ELECTORAL_VOTES = 3;
/** Points per share of the vote. */
const PTS = 100.0;

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

/** The latest presidential general certified, or undefined. */
function lastPresidential(w: World): Race | undefined {
  for (let i = w.elections.races.length - 1; i >= 0; i--) {
    const r = w.elections.races[i] as Race;
    if (r.office === "President" && !r.special && r.result?.certified != null) return r;
  }
  return undefined;
}

/** The party of each ballot candidate of a race. */
function ballotParties(r: Race): (Party | null)[] {
  return r.ballot.map((id) => r.candidacies.find((c) => c.person === id)?.party ?? null);
}

/** A tally's winner and its margin toward party A in points (votes in ballot order). */
function tallyOf(
  votes: readonly number[],
  parties: readonly (Party | null)[],
): [Party | null, number | null] {
  let total = 0;
  let a = 0;
  let b = 0;
  let best = -1;
  votes.forEach((v, c) => {
    total += v;
    if (parties[c] === "Democrats") a += v;
    if (parties[c] === "Republicans") b += v;
    if (best < 0 || v > (votes[best] as number)) best = c;
  });
  if (total <= 0 || best < 0) return [null, null];
  return [parties[best] ?? null, (PTS * (a - b)) / total];
}

/** The county columns and the states (pivot 15.3). */
export function buildUsMapLayers(input: ViewInput): UsMapLayersView {
  const w = input.world;
  const geo = w.geo;
  const n = geo.counties.length;
  const counties: UsMapCounties = {
    fips: geo.counties.map((c) => c.fips),
    state: geo.counties.map((c) => c.state as number),
    name: geo.counties.map((c) => c.name),
    population: geo.counties.map((c) => c.population),
    district: new Array<number>(n).fill(0),
    turnout: geo.counties.map((c) => c.turnout),
    last_votes: new Array<number>(n).fill(0),
    last_winner: new Array<Party | null>(n).fill(null),
    last_margin: new Array<number | null>(n).fill(null),
    lean: input.controls.omniscient ? geo.counties.map((c) => c.lean) : null,
  };
  // The district holding the largest share of each county; ties to the lower number.
  const held = new Array<number>(n).fill(0);
  for (const p of geo.plans) {
    for (const d of p.districts) {
      for (const s of d.shares) {
        if (s.to - s.from > (held[s.county] as number)) {
          held[s.county] = s.to - s.from;
          counties.district[s.county] = d.number;
        }
      }
    }
  }
  const race = lastPresidential(w);
  const parties = race === undefined ? [] : ballotParties(race);
  const byCounty: CountyResult | undefined =
    race === undefined ? undefined : w.elections.county_results.find((r) => r.race === race.id);
  if (byCounty !== undefined) {
    byCounty.counties.forEach((c, k) => {
      const votes = byCounty.votes.map((col) => col[k] ?? 0);
      const [winner, margin] = tallyOf(votes, parties);
      counties.last_votes[c] = votes.reduce((x, y) => x + y, 0);
      counties.last_winner[c] = winner;
      counties.last_margin[c] = margin;
    });
  }
  const college = race === undefined ? undefined : w.elections.colleges.find((c) => c.race === race.id);
  const people = new Array<number>(w.politics.states.length).fill(0);
  const hasCounties = new Array<boolean>(w.politics.states.length).fill(false);
  for (const c of geo.counties) {
    people[c.state] = (people[c.state] as number) + c.population;
    hasCounties[c.state] = true;
  }
  const states: UsMapState[] = w.politics.states.map((st, s) => {
    const seats = geo.seats.length > 0 ? (geo.seats[s] ?? 0) : st.house_seats;
    const gov = officeHolderOf(w.persons, { kind: "Governor", state: s as UsMapState["id"] });
    const tally = college?.states.find((t) => t.state === s);
    const [winner, margin] = tally === undefined ? [null, null] : tallyOf(tally.votes, parties);
    return {
      id: s as UsMapState["id"],
      name: st.name,
      // A world with no counties gives the politics table's people (its provinces').
      population: hasCounties[s] ? (people[s] as number) : roundHalfAway(st.weight),
      house_seats: seats,
      electoral_votes: seats > 0 ? seats + SENATE_ELECTORS : hasCounties[s] ? DC_ELECTORAL_VOTES : 0,
      governor: gov === undefined ? null : (personGet(w.persons, gov.person)?.party ?? null),
      last_winner: winner,
      last_margin: margin,
    };
  });
  return { counties, states };
}

/** v_usmap_layers's slot in `VIEW_BUILDERS`. */
export const usMapLayersBuilder: ViewBuilder<UsMapLayersView> = {
  rust: "(none: pivot 15.3)",
  empty: emptyUsMapLayers,
  build: buildUsMapLayers,
};
