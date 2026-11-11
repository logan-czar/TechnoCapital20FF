// Lane G's module (pivot 5.1 to 5.6; D1037, D1039): county drift, the census and apportionment,
// districts of whole counties and `CountyShare` intervals, redistricting by the governor's party with
// strength s, and court challenges. The algorithm notes are tools/spikes/districts/README.md.
// Every draw comes from the Governing stream (pivot-lanes.md "RNG streams").
//
// The calendar (pivot 5.2, 5.3, 5.5, 5.6; T, D1039), all at 00:00 in the `DailyGeo` slot, after the
// politics job of the same tick:
// - 1 January: county drift (drift.ts), after the politics job's `driftYear` has moved the states.
// - 1 April of a census year (2000, 2010, ...): the census counts the counties' people and
//   apportions the House by equal proportions (`Census`); the seats in force do not change yet.
// - 1 July of the year after: every state is redrawn for the new seats (the next November's House
//   is elected on them); the new seats take force with the plans. A map stronger than
//   `CHALLENGE_STRENGTH` may be challenged the same day.
// - 1 November of that year: the court rules; a struck map is redrawn at once at lower strength.
// A world with no counties draws nothing and changes nothing.

import { newsWireQueue, politicsHeadline } from "../news.ts";
import { equalProportions, HOUSE_SEATS, isCensusYear } from "../politics/era.ts";
import { dateTimeDate } from "../time/calendar.ts";
import { type JobCtx, type Scheduler, schedulerRegister } from "../time/scheduler.ts";
import type { SimDate } from "../types/calendar.ts";
import { dateEq } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import type { UsStateId } from "../types/ids.ts";
import type { Census, Challenge, County, District, DistrictPlan, GeoState } from "../types/state/geo.ts";
import type { World } from "../types/world.ts";
import { type DrawStats, SWEEP_ANGLES } from "./district.ts";
import { driftCountiesYear } from "./drift.ts";
import { countiesByState, drawStatePlan, drawStatsNew, stateId } from "./plans.ts";
import {
  CHALLENGE_FILE_CHANCE,
  CHALLENGE_RULING_DAY,
  CHALLENGE_RULING_MONTH,
  CHALLENGE_STRENGTH,
  courtStrikes,
  drawerOf,
  judgesOf,
  STRUCK_STRENGTH_MULT,
} from "./redistrict.ts";

export { geoStateEmpty, geoStateFromData, geoStateOf } from "./load.ts";

/** The census's day in a census year (pivot 5.3, T): Census Day. */
export const CENSUS_MONTH = 4;
export const CENSUS_DAY = 1;
/** The redraw's day in the year after a census (pivot 5.5, T). */
export const REDRAW_MONTH = 7;
export const REDRAW_DAY = 1;

/** Work counters of the last draws, for the measurements; not world state. */
export const GEO_STATS: DrawStats = drawStatsNew();

/** The angle a map's sweep fan starts at (district.ts): one Governing draw per multi-seat map. */
function drawTheta(g: DrawSource): number {
  return (g.uniform("Governing") * Math.PI) / SWEEP_ANGLES;
}

function stateName(world: World, s: number): string {
  return world.politics.states[s]?.name ?? `state ${s}`;
}

/** People by state now: the sum of each state's counties (pivot 5.3). Whole numbers. */
export function statePeople(geo: GeoState, states: number): number[] {
  const out = new Array<number>(states).fill(0);
  for (const c of geo.counties) out[c.state] = (out[c.state] as number) + c.population;
  return out;
}

/**
 * The census (pivot 5.3): people by state from the counties, and the House by equal proportions over
 * the states that have seats now (a state without one, DC, stays without).
 */
export function takeCensus(geo: GeoState, year: number, states: number): Census {
  const population = statePeople(geo, states);
  const seats = equalProportions(
    population.map((n, s) => ((geo.seats[s] ?? 0) > 0 ? n : 0.0)),
    HOUSE_SEATS,
  );
  const census: Census = { year, population, seats };
  geo.censuses.push(census);
  return census;
}

/**
 * Draws every state's plan for `seats` (pivot 5.4, 5.5): a state with one seat is one district of
 * all its counties; a state with more is drawn by `drawer(state)` (null: neutral). The plans in force
 * go to `history`, and `seats` takes force with the new plans.
 */
export function redrawAll(
  world: World,
  seats: readonly number[],
  censusYear: number,
  since: SimDate,
  g: DrawSource,
  drawer: (s: UsStateId) => { party: DistrictPlan["drawn_by"]; strength: number },
): void {
  const geo = world.geo;
  const byState = countiesByState(geo, world.politics.states.length);
  const plans: DistrictPlan[] = [];
  byState.forEach((ids, si) => {
    const n = seats[si] ?? 0;
    if (n < 1 || ids.length === 0) return;
    const s = stateId(si);
    const d = n > 1 ? drawer(s) : { party: null, strength: 0.0 };
    const theta = n > 1 ? drawTheta(g) : 0.0;
    plans.push(drawStatePlan(geo, ids, s, n, d.party, d.strength, theta, censusYear, since, GEO_STATS));
  });
  for (const p of geo.plans) geo.history.push(p);
  geo.plans = plans;
  geo.seats = [...seats];
}

/** 1 July after a census (pivot 5.5, 5.6): redraw every state and file the challenges. */
function redistrict(world: World, census: Census, date: SimDate, g: DrawSource): void {
  redrawAll(world, census.seats, census.year, date, g, (s) => drawerOf(world, s));
  const geo = world.geo;
  let drawn = 0;
  for (const p of geo.plans) {
    if (p.drawn_by !== null) drawn++;
    if (p.strength <= CHALLENGE_STRENGTH || !g.chance("Governing", CHALLENGE_FILE_CHANCE)) continue;
    const c: Challenge = {
      state: p.state,
      census_year: p.census_year,
      filed: date,
      ruling: { year: date.year, month: CHALLENGE_RULING_MONTH, day: CHALLENGE_RULING_DAY },
      status: "Filed",
    };
    geo.challenges.push(c);
    newsWireQueue(
      world.news,
      politicsHeadline(date, `${stateName(world, p.state)}'s new House map is challenged in court`),
    );
  }
  newsWireQueue(
    world.news,
    politicsHeadline(date, `${drawn} states redraw their House districts after the ${census.year} census`),
  );
}

/** A court rules on a challenge filed against a plan (pivot 5.6). */
function rule(world: World, c: Challenge, date: SimDate, g: DrawSource): void {
  const geo = world.geo;
  const at = geo.plans.findIndex((p) => p.state === c.state);
  const plan = at < 0 ? undefined : (geo.plans[at] as DistrictPlan);
  if (plan === undefined || plan.census_year !== c.census_year) {
    c.status = "Upheld";
    return;
  }
  const name = stateName(world, c.state);
  if (!courtStrikes(judgesOf(world), plan.strength, plan.drawn_by, g)) {
    c.status = "Upheld";
    newsWireQueue(world.news, politicsHeadline(date, `A court upholds ${name}'s House map`));
    return;
  }
  c.status = "Struck";
  plan.struck = true;
  const ids = countiesByState(geo, world.politics.states.length)[c.state] as number[];
  const redrawn = drawStatePlan(
    geo,
    ids,
    c.state,
    plan.districts.length,
    plan.drawn_by,
    plan.strength * STRUCK_STRENGTH_MULT,
    drawTheta(g),
    plan.census_year,
    date,
    GEO_STATS,
  );
  geo.history.push(plan);
  geo.plans[at] = redrawn;
  newsWireQueue(
    world.news,
    politicsHeadline(date, `A court strikes down ${name}'s House map; it is redrawn`),
  );
}

/** The daily job (pivot 5.2, 5.3, 5.5, 5.6): acts on the calendar's days only. */
export function geoJob(world: World, ctx: JobCtx): void {
  const geo = world.geo;
  if (geo.counties.length === 0) return;
  const date = ctx.facts.date;
  const g = ctx.draws;
  const states = world.politics.states.length;
  if (date.month === 1 && date.day === 1) driftCountiesYear(world, geo, countiesByState(geo, states), g);
  if (
    isCensusYear(date.year) &&
    date.month === CENSUS_MONTH &&
    date.day === CENSUS_DAY &&
    !geo.censuses.some((c) => c.year === date.year)
  ) {
    takeCensus(geo, date.year, states);
  }
  if (date.month === REDRAW_MONTH && date.day === REDRAW_DAY) {
    const census = geo.censuses.at(-1);
    const drawnOn = geo.plans.reduce((y, p) => Math.max(y, p.census_year), 0);
    if (census !== undefined && census.year === date.year - 1 && drawnOn < census.year) {
      redistrict(world, census, date, g);
    }
  }
  for (const c of geo.challenges) {
    if (c.status === "Filed" && dateEq(c.ruling, date)) rule(world, c, date, g);
  }
}

/**
 * Lane G's jobs (pivot 3.3: counties, the census and redistricting run at both fidelities, so no
 * tag), in the `DailyGeo` slot.
 */
export function registerGeoJobs(s: Scheduler): void {
  schedulerRegister(s, "DailyGeo", "geo.calendar", geoJob);
}

/**
 * The map at a world's start (pivot 5.3, 5.4), after the POC's `politicsStart`: the House
 * apportioned by equal proportions from the counties' people at load (the 1990 census for the 1995
 * world) over the states the POC gives seats, and every state's neutral plan, drawn by no party, on
 * the census of the start's decade. Governing stream only; nothing for a world with no counties.
 */
export function geoStart(world: World, draws: DrawSource): void {
  const geo = world.geo;
  if (geo.counties.length === 0) return;
  const states = world.politics.states;
  const people = statePeople(geo, states.length);
  const seats = equalProportions(
    people.map((n, s) => ((states[s]?.house_seats ?? 0) > 0 ? n : 0.0)),
    HOUSE_SEATS,
  );
  const date = dateTimeDate(world.clock);
  const decade = date.year - (date.year % 10);
  redrawAll(world, seats, decade, date, draws, () => ({ party: null, strength: 0.0 }));
}

/** The plan in force for `state`, or undefined (no plans yet, or a state with no seat). */
export function geoPlanOf(geo: GeoState, state: UsStateId): DistrictPlan | undefined {
  return geo.plans.find((p) => p.state === state);
}

/** District `number` (1 up) of `state` in the plan in force, or undefined. */
export function geoDistrict(geo: GeoState, state: UsStateId, number: number): District | undefined {
  return geoPlanOf(geo, state)?.districts[number - 1];
}

/** The county of `id`, for readers of shares. */
export function geoCounty(geo: GeoState, id: number): County | undefined {
  return geo.counties[id];
}
