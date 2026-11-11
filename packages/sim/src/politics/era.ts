// A historical world's US politics (1995-rework 7): the state tables behind the start's Congress, the
// yearly lean drift and population, the census, and when each ideology emerges. Pure helpers and
// state changes on the tables: the job that calls them is politics/jobs.ts.

import type { WorldData } from "@tc20ff/sim-data";
import { worldDataAllProvinces } from "@tc20ff/sim-data";
import { usGdpShare } from "../governing/levers.ts";
import type { DrawSource } from "../types/draws.ts";
import { ordinal, type ProvinceId, type UsStateId } from "../types/ids.ts";
import { expF } from "../types/libm.ts";
import { clamp, cmpStr } from "../types/num.ts";
import type { EraIdeology, EraPolitics, EraUsState } from "../types/state/era.ts";
import type { District, Ideology, Party, PoliticsState } from "../types/state/politics.ts";
import type { World } from "../types/world.ts";
import { type BlocTable, PARTY_BLOCS } from "./generate.ts";
import { DISTRICT_LEAN_SD_PTS, districtHomes } from "./state.ts";

/** Each region's yearly swing in its states' leans, sd in points (1995-rework 7.3, T). */
export const REGION_DRIFT_SD_PTS = 1.5;
/** Each state's own yearly swing, sd in points (1995-rework 7.3, T). */
export const STATE_DRIFT_SD_PTS = 1.0;
/** The sd of a state's yearly population growth around its own rate (1995-rework 7.4, T). */
export const POP_SHOCK_SD = 0.002;
/** The years a census's new seats are worked out, on 1 January (1995-rework 7.4). */
export const CENSUS_YEARS: readonly number[] = [2001, 2011];
/** The House's size (1995-rework 7.4). */
export const HOUSE_SEATS = 435;
/** A people count per million of `pop_1990_m`. */
const PEOPLE_PER_M = 1.0e6;
/** The census regions, in the order their yearly draws are made (1995-rework 7.3). */
export const CENSUS_REGIONS: readonly string[] = ["Northeast", "Midwest", "South", "West"];

/**
 * The ideologies not yet in US politics at the start, and the years each emerges in (1995-rework
 * 7.6, T). Every other bloc is active from the start.
 */
export const IDEOLOGY_WINDOWS: readonly (readonly [Ideology, number, number])[] = [
  ["EffectiveAltruists", 2004, 2012],
  ["Accelerationists", 2010, 2018],
];
/** Years a new ideology takes to reach its full bloc weight (1995-rework 7.6, T). */
export const IDEOLOGY_RAMP_YEARS = 4;
/** What 1995 calls the blocs whose game names are later movements' (1995-rework 7.6). */
export const ERA_IDEOLOGY_NAMES: Readonly<Partial<Record<Ideology, string>>> = {
  Communists: "Labor Left",
  Landites: "Free Marketeers",
  Chuds: "Social Conservatives",
  EffectiveAltruists: "Effective Altruists",
};

/** The era tables from the data, with each state's vote weight set to its people (1995-rework 7.2). */
export function startEraPolitics(world: World, data: WorldData, draws: DrawSource): EraPolitics {
  const ids = new Map(world.provinces.map((p, i) => [p.key, ordinal<ProvinceId>(i)] as const));
  const provinces = worldDataAllProvinces(data)
    .map(([, , p]) => p)
    .filter((p) => p.country === "USA");
  const states = world.politics.states.map((s): EraUsState => {
    const row = data.politics_era.rows.find((r) => r.state === s.name);
    if (row === undefined) throw new Error(`no era row for ${s.name}`);
    const population = row.pop_1990_m * PEOPLE_PER_M;
    s.weight = population;
    return {
      region: CENSUS_REGIONS.indexOf(row.census_region),
      population,
      growth: row.pop_growth,
      start_house_dem: row.start_house_dem,
      start_senate_dem: row.start_senate_dem,
      provinces: provinces
        .filter((p) => p.region === s.name)
        .sort((a, b) => cmpStr(a.id, b.id))
        .map((p) => ({ id: ids.get(p.id) as ProvinceId, population: p.population })),
    };
  });
  const ideologies = IDEOLOGY_WINDOWS.map(
    ([ideology, first, last]): EraIdeology => ({
      ideology,
      from_year: draws.intInclusive("Era", first, last),
    }),
  );
  return {
    states,
    ideologies,
    us_share: usGdpShare(world),
    next_districts: null,
  };
}

/** How far into its ramp a bloc is in `year`: 0 before it emerges, then up to 1 (1995-rework 7.6). */
function blocRamp(ideologies: readonly EraIdeology[], ideology: Ideology, year: number): number {
  const row = ideologies.find((i) => i.ideology === ideology);
  if (row === undefined) return 1.0;
  if (year < row.from_year) return 0.0;
  return clamp((year - row.from_year + 1) / IDEOLOGY_RAMP_YEARS, 0.0, 1.0);
}

/** The party blocs in `year`: spec 4.4.7's weights, each new ideology's ramping in (1995-rework 7.6). */
export function eraBlocs(ideologies: readonly EraIdeology[], year: number): BlocTable {
  const of = (party: Party): readonly (readonly [Ideology, number])[] =>
    PARTY_BLOCS[party].map(([i, w]) => [i, w * blocRamp(ideologies, i, year)] as const);
  return { Democrats: of("Democrats"), Republicans: of("Republicans") };
}

/**
 * Each state's Democratic seats at the start (1995-rework 7.2): its most Democratic-leaning districts,
 * ties to the lower number, as indexes into `p.districts`.
 */
export function startDemDistricts(p: PoliticsState, era: EraPolitics): Set<number> {
  const out = new Set<number>();
  p.states.forEach((_, si) => {
    const own = p.districts
      .map((d, i) => [d.lean_pts, i, d.state] as const)
      .filter(([, , state]) => state === si)
      .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const dem = (era.states[si] as EraUsState).start_house_dem;
    for (const [, i] of own.slice(0, dem)) out.add(i);
  });
  return out;
}

/**
 * Equal proportions (1995-rework 7.4): one seat per state with `people > 0`, then each seat to the
 * highest `people / √(n(n + 1))`; ties to the lower index. `people` 0 is a state with no House seat.
 */
export function equalProportions(people: readonly number[], total: number): number[] {
  const seats: number[] = people.map((n) => (n > 0.0 ? 1 : 0));
  let left = total - seats.reduce((a, b) => a + b, 0);
  for (; left > 0; left--) {
    let best = -1;
    let score = -1.0;
    people.forEach((n, i) => {
      if (n <= 0.0) return;
      const have = seats[i] as number;
      const priority = n / Math.sqrt(have * (have + 1));
      if (priority > score) {
        score = priority;
        best = i;
      }
    });
    seats[best] = (seats[best] as number) + 1;
  }
  return seats;
}

/**
 * 1 January (1995-rework 7.3): each state's and its districts' leans move by its region's swing and
 * its own, and its people grow. The districts a census has drawn move too. `g` is a `politicsDraws`
 * source.
 */
export function driftYear(p: PoliticsState, era: EraPolitics, g: DrawSource): void {
  const swing = CENSUS_REGIONS.map(() => g.normal("Politics") * REGION_DRIFT_SD_PTS);
  const by = p.states.map((s, i) => {
    const row = era.states[i] as EraUsState;
    const d = (swing[row.region] as number) + g.normal("Politics") * STATE_DRIFT_SD_PTS;
    s.lean_pts += d;
    row.population *= expF(row.growth + g.normal("Politics") * POP_SHOCK_SD);
    s.weight = row.population;
    return d;
  });
  const move = (districts: District[]): void => {
    for (const d of districts) d.lean_pts += by[d.state] as number;
  };
  move(p.districts);
  if (era.next_districts !== null) move(era.next_districts.table);
}

/**
 * 1 January of a census year (1995-rework 7.4): the next House, by equal proportions from the states'
 * people. A district that stays keeps its lean; a new one takes the state's plus a drawn offset. It
 * applies from the next November's races. The states with no seat at the start stay without one.
 * Returns the seats that moved between states.
 */
export function drawCensus(p: PoliticsState, era: EraPolitics, g: DrawSource): number {
  const people = p.states.map((s, i) => (s.house_seats > 0 ? (era.states[i] as EraUsState).population : 0.0));
  const seats = equalProportions(people, HOUSE_SEATS);
  const table: District[] = [];
  seats.forEach((n, si) => {
    if (n === 0) return;
    const state = ordinal<UsStateId>(si);
    const old = p.districts.filter((d) => d.state === si);
    const homes = districtHomes((era.states[si] as EraUsState).provinces, n);
    homes.forEach((home_province, k) => {
      const kept = old[k];
      const lean_pts =
        kept?.lean_pts ?? (p.states[si]?.lean_pts ?? 0.0) + g.normal("Politics") * DISTRICT_LEAN_SD_PTS;
      table.push({ state, number: k + 1, lean_pts, home_province });
    });
  });
  era.next_districts = { table, voted: false };
  let gained = 0;
  seats.forEach((n, i) => {
    gained += Math.max(0, n - (p.states[i]?.house_seats ?? 0));
  });
  return gained;
}

/** A district's place in `table` by its state and number; holders follow these (1995-rework 7.4). */
export function districtIndex(table: readonly District[]): Map<string, number> {
  return new Map(table.map((d, i) => [`${d.state}/${d.number}`, i] as const));
}

/**
 * 3 January after the vote on a new House (1995-rework 7.4): the table takes over, sitting members
 * follow their `(state, number)`, and a member whose seat is gone leaves. Called before the new
 * members take their seats, whose offices already point into the new table.
 */
export function applyDistricts(p: PoliticsState, table: District[]): void {
  const at = districtIndex(table);
  const old = p.districts;
  p.politicians = p.politicians.filter((c) => {
    if (c.office.kind !== "House") return true;
    const d = old[c.office.district] as District;
    const next = at.get(`${d.state}/${d.number}`);
    if (next === undefined) return false;
    c.office = { ...c.office, district: ordinal(next) };
    return true;
  });
  p.districts = table;
  p.states.forEach((s, si) => {
    s.house_seats = table.filter((d) => d.state === si).length;
  });
}
