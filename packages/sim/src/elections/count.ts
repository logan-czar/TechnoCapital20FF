// The vote (pivot 6.7, 9.1; D1040): each county or county share's support from politics/vote.ts's
// `utility` kernel with the share's mean lean, incumbency, the economy, each candidate's strength
// and a swing with national, state and county parts; its turnout from the county's; votes summed
// county to district to state, and the presidency's states to the Electoral College. Computed once,
// when the race's polls close; nothing here keeps state.
//
// Swings are drawn on the Count stream in a fixed order (national, then every state, then every
// county, in id order) once per election day, so every race of a day shares them: two races in one
// county move together (pivot 6.7 "correlated").

import { largestRemainder } from "../politics/state.ts";
import { type Contender, utility, type VoteClimate } from "../politics/vote.ts";
import type { DrawSource } from "../types/draws.ts";
import type { CountyId, PersonId, UsStateId } from "../types/ids.ts";
import { expF } from "../types/libm.ts";
import { roundHalfAway } from "../types/num.ts";
import type { RaceResult, StateTally } from "../types/state/elections.ts";
import type { CountyShare } from "../types/state/geo.ts";
import type { World } from "../types/world.ts";
import { shareLean, shareSize } from "./geography.ts";

/** The national swing's sd, toward party A, in utility (pivot 6.7, T): about 4 points of margin. */
export const NATIONAL_SWING_SD = 0.04;
/** Each state's own swing, shared by its races (pivot 6.7, T). */
export const STATE_SWING_SD = 0.04;
/** Each county's own swing, shared by its races (pivot 6.7, T). */
export const COUNTY_SWING_SD = 0.03;
/** A race's own noise by office (pivot 6.7, T): a statewide race turns more on its candidates. */
export const HOUSE_RACE_NOISE_SD = 0.06;
export const STATEWIDE_RACE_NOISE_SD = 0.1;
/** The presidency's extra national swing (pivot 6.7, T): the national name is less shielded. */
export const PRESIDENT_RACE_NOISE_SD = 0.05;
/** Turnout at a general without the presidency, as a share of a presidential year's (pivot 6.7, T). */
export const MIDTERM_TURNOUT_RATIO = 0.75;
/** Points per unit share (a margin is in points of the votes cast). */
const POINTS = 100;

/** One election day's swings toward party A (pivot 6.7), in utility. */
export interface Swings {
  national: number;
  /** By `UsStateId`. */
  states: number[];
  /** By `CountyId`. */
  counties: number[];
}

/** Draws a day's swings on the Count stream: national, then states, then counties, in id order. */
export function drawSwings(world: World, draws: DrawSource, tide: number): Swings {
  const national = draws.normal("Count") * NATIONAL_SWING_SD + tide;
  const states = world.politics.states.map(() => draws.normal("Count") * STATE_SWING_SD);
  const counties = world.geo.counties.map(() => draws.normal("Count") * COUNTY_SWING_SD);
  return { national, states, counties };
}

/** A race's units counted: votes by candidate (ballot order) by unit, and their sums. */
export interface UnitCount {
  /** The units' counties, in unit order. */
  counties: CountyId[];
  /** `votes[c][k]`: candidate `c`'s whole votes in unit `k`. */
  votes: number[][];
  /** Whole people who voted, by unit. */
  turnout: number[];
}

/**
 * Counts `units` for a ballot (pivot 6.7): in each, everyone who votes (`turnout × people ×
 * turnoutScale`, whole) is split between the candidates by the softmax of their utilities, as
 * whole votes by largest remainder. The swing in a unit is its county's elasticity times the
 * national, state and county parts plus the race's own noise.
 */
export function countUnits(
  world: World,
  units: readonly CountyShare[],
  contenders: readonly Contender[],
  climate: VoteClimate,
  swings: Swings,
  raceNoise: number,
  turnoutScale: number,
): UnitCount {
  const counties: CountyId[] = [];
  const votes: number[][] = contenders.map(() => []);
  const turnout: number[] = [];
  for (const s of units) {
    const c = world.geo.counties[s.county];
    if (c === undefined) continue;
    const swing =
      c.elasticity *
        ((swings.national + (swings.states[c.state] ?? 0) + (swings.counties[s.county] ?? 0)) as number) +
      raceNoise;
    const here: VoteClimate = { ...climate, swing: climate.swing + swing };
    const lean = shareLean(c, s);
    const u = contenders.map((k) => utility(lean, k, here));
    const top = Math.max(...u);
    const e = u.map((x) => expF(x - top));
    const sum = e.reduce((a, b) => a + b, 0);
    const people = roundHalfAway(shareSize(c, s) * c.turnout * turnoutScale);
    const split =
      people > 0
        ? largestRemainder(
            e.map((x) => x / sum),
            people,
          )
        : e.map(() => 0);
    counties.push(s.county);
    turnout.push(people);
    split.forEach((v, i) => {
      (votes[i] as number[]).push(v);
    });
  }
  return { counties, votes, turnout };
}

/** Sums a count's columns: votes by candidate and the turnout. */
export function sumCount(c: UnitCount): { votes: number[]; turnout: number } {
  return {
    votes: c.votes.map((col) => col.reduce((a, b) => a + b, 0)),
    turnout: c.turnout.reduce((a, b) => a + b, 0),
  };
}

/** The candidate with the most votes; ties to the earlier on the ballot (D2). */
export function plurality(votes: readonly number[]): number {
  let best = 0;
  votes.forEach((v, i) => {
    if (v > (votes[best] as number)) best = i;
  });
  return best;
}

/** The first and second place's shares less each other, in points; `winner` set apart (it may trail, for the presidency). */
export function marginOf(votes: readonly number[], turnout: number, winner: number): number {
  if (turnout <= 0) return 0;
  let other = -1;
  votes.forEach((v, i) => {
    if (i !== winner && (other < 0 || v > (votes[other] as number))) other = i;
  });
  const runner = other < 0 ? 0 : (votes[other] as number);
  return ((votes[winner] as number) - runner) * (POINTS / turnout);
}

/** A race result from summed votes (pivot 6.7, 9.4); `winner` overrides the plurality (the college). */
export function raceResultOf(
  ballot: readonly PersonId[],
  votes: number[],
  turnout: number,
  winner: number | null = null,
): RaceResult {
  const w = winner ?? plurality(votes);
  return {
    votes,
    turnout,
    winner: ballot[w] as PersonId,
    margin: marginOf(votes, turnout, w),
    recount: false,
    certified: null,
  };
}

/**
 * The presidency's states (pivot 6.7): each state's votes summed from its units, carried whole by
 * its plurality winner (ties to the earlier on the ballot), worth `electors`. States with no
 * electors are left out.
 */
export function stateTallies(
  count: UnitCount,
  stateOfCounty: (c: CountyId) => UsStateId,
  ballot: readonly PersonId[],
  electorsOf: (s: UsStateId) => number,
  states: number,
): StateTally[] {
  const by: number[][] = [];
  for (let s = 0; s < states; s++) by.push(ballot.map(() => 0));
  count.counties.forEach((county, k) => {
    const row = by[stateOfCounty(county)] as number[];
    count.votes.forEach((col, c) => {
      row[c] = (row[c] as number) + (col[k] as number);
    });
  });
  const out: StateTally[] = [];
  by.forEach((votes, s) => {
    const state = s as UsStateId;
    const ev = electorsOf(state);
    if (ev <= 0) return;
    out.push({ state, votes, electoral_votes: ev, winner: ballot[plurality(votes)] as PersonId });
  });
  return out;
}

/** Electoral votes by ballot candidate, and the majority winner's index or null (pivot 6.7). */
export function collegeTotals(
  tallies: readonly StateTally[],
  ballot: readonly PersonId[],
): { totals: number[]; winner: number | null } {
  const totals = ballot.map(() => 0);
  let all = 0;
  for (const t of tallies) {
    const i = ballot.indexOf(t.winner);
    totals[i] = (totals[i] as number) + t.electoral_votes;
    all += t.electoral_votes;
  }
  const need = Math.floor(all / 2) + 1;
  const winner = totals.findIndex((v) => v >= need);
  return { totals, winner: winner < 0 ? null : winner };
}

/** A race's own noise (pivot 6.7), on the Count stream. */
export function raceNoise(draws: DrawSource, sd: number): number {
  return draws.normal("Count") * sd;
}
