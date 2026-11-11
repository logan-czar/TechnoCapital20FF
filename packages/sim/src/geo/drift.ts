// County drift (pivot 5.2; D1039): on 1 January, after the politics job's `driftYear` has moved each
// state's lean and people (politics/era.ts, 1995-rework 7.3, 7.4), each county's people grow with its
// state's rate, the `state_growth` lever and a county term, and its lean takes a county term of
// noise; then each state's county leans are re-centred so their people-weighted mean is the state's
// lean exactly (by re-centring, not by construction). Elasticity and turnout drift slowly.
// Every draw is from the Governing stream, states first, then counties in id order.

import type { DrawSource } from "../types/draws.ts";
import { expF } from "../types/libm.ts";
import { clamp, maxF, roundHalfAway } from "../types/num.ts";
import type { County, GeoState } from "../types/state/geo.ts";
import type { World } from "../types/world.ts";

/** The sd of a state's yearly growth around its rate, as the politics job's `POP_SHOCK_SD` (pivot 5.2, T). */
export const STATE_POP_SD = 0.002;
/** The sd of a county's yearly growth around its state's (pivot 5.2 "a county term", T). */
export const COUNTY_POP_SD = 0.01;
/** Yearly growth added per point of the `state_growth` lever to the state's counties (pivot 4.3, 5.2, T). */
export const STATE_GROWTH_POP_K = 1.0;
/** A state's yearly growth when the world has no era table to give one (pivot 5.2, T). */
export const STATE_GROWTH_DEFAULT = 0.0;
/** The sd of a county's yearly lean noise around its state's trend, in points (pivot 5.2, T). */
export const COUNTY_LEAN_SD_PTS = 0.8;
/** The sd of a county's yearly elasticity drift, as a log ratio (pivot 5.2 "slowly", T). */
export const ELASTICITY_DRIFT_SD = 0.01;
/** Elasticity is held in this range (pivot 5.2, T). */
export const ELASTICITY_MIN = 0.5;
export const ELASTICITY_MAX = 1.5;
/** The sd of a county's yearly turnout drift, in shares (pivot 5.2 "slowly", T). */
export const TURNOUT_DRIFT_SD = 0.004;
/** Turnout is held in this range, the load's clamp (D1030 (3)). */
export const TURNOUT_MIN = 0.15;
export const TURNOUT_MAX = 0.7;
/** A county's lean plus its spread stays within this many points (D1030 `LEAN_LIMIT_PTS`). */
export const LEAN_LIMIT_PTS = 100.0;
/** Re-centre and clamp passes; a clamp that binds moves the mean, and the next pass puts it back. */
const RECENTRE_PASSES = 3;

/**
 * Re-centres the leans of `ids` (one state's counties) on `target`, people-weighted, keeping each
 * within `LEAN_LIMIT_PTS` with its spread (pivot 5.2).
 */
export function recentreLeans(counties: County[], ids: readonly number[], target: number): void {
  for (let pass = 0; pass < RECENTRE_PASSES; pass++) {
    let w = 0.0;
    let l = 0.0;
    for (const i of ids) {
      const c = counties[i] as County;
      w += c.population;
      l += c.population * c.lean;
    }
    if (w <= 0.0) return;
    const shift = target - l / w;
    if (shift === 0.0) return;
    for (const i of ids) {
      const c = counties[i] as County;
      const room = maxF(LEAN_LIMIT_PTS - c.spread, 0.0);
      c.lean = clamp(c.lean + shift, -room, room);
    }
  }
}

/** One year of county drift (pivot 5.2). `byState` is `countiesByState`. */
export function driftCountiesYear(
  world: World,
  geo: GeoState,
  byState: readonly number[][],
  g: DrawSource,
): void {
  const states = world.politics.states;
  const era = world.era?.politics;
  // pivot 5.2: each state's yearly growth, the lever and a state shock.
  const stateRate = byState.map((ids, s) => {
    if (ids.length === 0) return 0.0;
    const base = era?.states[s]?.growth ?? STATE_GROWTH_DEFAULT;
    const lever = world.levers.state_growth[s] ?? 0.0;
    return base + STATE_GROWTH_POP_K * lever + g.normal("Governing") * STATE_POP_SD;
  });
  // pivot 5.2: each county's own terms, in id order.
  const popTerm: number[] = [];
  for (const c of geo.counties) {
    popTerm.push(g.normal("Governing") * COUNTY_POP_SD);
    c.lean += g.normal("Governing") * COUNTY_LEAN_SD_PTS;
    c.elasticity = clamp(
      c.elasticity * expF(g.normal("Governing") * ELASTICITY_DRIFT_SD),
      ELASTICITY_MIN,
      ELASTICITY_MAX,
    );
    c.turnout = clamp(c.turnout + g.normal("Governing") * TURNOUT_DRIFT_SD, TURNOUT_MIN, TURNOUT_MAX);
  }
  byState.forEach((ids, s) => {
    if (ids.length === 0) return;
    let before = 0.0;
    let raw = 0.0;
    const grown = ids.map((i) => {
      const c = geo.counties[i] as County;
      before += c.population;
      const v = c.population * expF(popTerm[i] as number);
      raw += v;
      return v;
    });
    // The county terms move people inside the state; the state's total grows by its own rate.
    const scale = raw > 0.0 ? (before * expF(stateRate[s] as number)) / raw : 0.0;
    ids.forEach((i, j) => {
      (geo.counties[i] as County).population = maxF(roundHalfAway((grown[j] as number) * scale), 0.0);
    });
    recentreLeans(geo.counties, ids, states[s]?.lean_pts ?? 0.0);
  });
}
