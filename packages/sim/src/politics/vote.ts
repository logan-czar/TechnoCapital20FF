// The POC vote (D986): 4-politics 4.6.3 with only the terms whose systems exist. The strata,
// ideology fit, campaign, media, ads, psyops and scandal terms wait for those systems.

import { expF } from "../types/libm.ts";
import { PARTY_VALUES, type Party } from "../types/state/politics.ts";

/** 4.6.3 and D986: the weight on a place's party lean (4.6.3 Ideology weight, 5.6.4 says 2). */
export const LEAN_WEIGHT = 2;
/** D986: lean points to lean units, so a 10-point lean is about a 10-point margin in the softmax (T). */
export const LEAN_PER_POINT = 0.005;
/** 4.6.3 Incumbency: +0.3 for the incumbent party or candidate. */
export const INCUMBENCY = 0.3;
/**
 * 4.6.3 Economy, incumbent party only: a quarter of 4.6.3's 0.1 per point (D986, T). The term reads
 * the cycle, which runs -6% to +4%, and at 0.1 a recession alone moved a race's margin 30 points.
 */
export const ECONOMY_PER_POINT = 0.025;
/** 4.6.3 Candidate: `0.03 × (Persuasion − 10)`. */
export const CANDIDATE_PER_PERSUASION = 0.03;
export const CANDIDATE_PERSUASION_BASE = 10;
/** D986: sd of the national swing, shared by every race of one November, in utility (T). */
export const NATIONAL_SWING_SD = 0.06;
/** D986: sd of one race's own noise, in utility (T). */
export const RACE_NOISE_SD = 0.12;
/** D986: a Senate race's own noise, wider than a district's: statewide races turn on the candidate (T). */
export const SENATE_NOISE_SD = 0.4;
/**
 * D986: a presidential race's own national swing, in utility (T): a national name is less shielded
 * by the seat than a district's member, so the race moves more than Congress does.
 */
export const PRESIDENT_SWING_SD = 0.05;
/** D986: a sitting president's incumbency in the national vote, below 4.6.3's seat value (T). */
export const PRESIDENT_INCUMBENCY = 0.05;

/** One side of a race. */
export interface Contender {
  party: Party;
  persuasion: number;
  /** The incumbency term this side gets: INCUMBENCY, PRESIDENT_INCUMBENCY or 0. */
  incumbency: number;
}

/** What every race of one November shares. */
export interface VoteClimate {
  /** The party of the sitting president (4.6.3 Economy reads the incumbent party). */
  incumbent_party: Party;
  /** The US zone's cycle effect, a yearly rate (spec 5.1). 0 at the start's seating. */
  growth: number;
  /** Toward Democrats, in utility. */
  swing: number;
}

/** A place's lean as the party sees it: Democrats plus, Republicans minus. */
function partyLean(leanPts: number, party: Party): number {
  const lean = leanPts * LEAN_PER_POINT;
  return party === PARTY_VALUES[0] ? lean : -lean;
}

/** `U(p)` of the D986 formula (4.6.3), before the race's noise. */
export function utility(leanPts: number, c: Contender, climate: VoteClimate): number {
  const economy =
    c.party === climate.incumbent_party ? ECONOMY_PER_POINT * climate.growth * PERCENT_PER_UNIT : 0;
  const candidate = CANDIDATE_PER_PERSUASION * (c.persuasion - CANDIDATE_PERSUASION_BASE);
  const swing = c.party === PARTY_VALUES[0] ? climate.swing : -climate.swing;
  return LEAN_WEIGHT * partyLean(leanPts, c.party) + c.incumbency + economy + candidate + swing;
}

/** Percentage points per unit of a rate. */
const PERCENT_PER_UNIT = 100;

/**
 * 4.6.3 `Share(p) = exp U(p) / Σ exp U(q)`. `noise` is added to the first contender and taken from
 * the second, so one draw sets a race.
 */
export function shares(
  leanPts: number,
  a: Contender,
  b: Contender,
  climate: VoteClimate,
  noise: number,
): [number, number] {
  const ua = utility(leanPts, a, climate) + noise;
  const ub = utility(leanPts, b, climate) - noise;
  const ea = expF(ua);
  const eb = expF(ub);
  return [ea / (ea + eb), eb / (ea + eb)];
}
