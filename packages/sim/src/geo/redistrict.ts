// Who draws a state's map and how hard (pivot 5.5), and the courts that may strike it (pivot 5.6).
//
// The drawer is the governor's party (lane C's offices: `officeHolderOf` with a Governor seat). Until
// a world has governors, the stand-in is the politics POC's state leadership (D1039): the party
// holding most of the state's House seats (ties to its Senate seats, then to the state's lean, a
// lean of 0 to party A), and for the strength that party's senator of lowest id (else its House
// member of lowest id), whose integrity reads as `INTEGRITY_MID`.

import { officeHolderOf, personGet } from "../politics/people.ts";
import type { DrawSource } from "../types/draws.ts";
import type { UsStateId } from "../types/ids.ts";
import { clamp } from "../types/num.ts";
import type { Trait } from "../types/state/people.ts";
import type { JudgeLeaning, Party, Politician } from "../types/state/politics.ts";
import type { World } from "../types/world.ts";

/** The strength of a drawer of middling intrigue and integrity and no telling trait (pivot 5.5, T). */
export const STRENGTH_BASE = 0.5;
/** Strength added from intrigue `SKILL_MID` to twice that (and taken from it to 0) (pivot 5.5, T). */
export const STRENGTH_INTRIGUE_K = 0.35;
/** Strength taken from integrity 50 to 100 (and added from 50 to 0) (pivot 5.5, T). */
export const STRENGTH_INTEGRITY_K = 0.3;
/**
 * A middling politician's skill (pivot 5.5, T): the middle of the skills elected officials are drawn
 * with (D980's House and Senate ranges run from 2 to 16), not of the 0 to 30 scale.
 */
export const SKILL_MID = 10.0;
/** The middle of integrity (0 to 100), and a stand-in's integrity. */
export const INTEGRITY_MID = 50.0;
/** Strength added by a trait (pivot 5.5 "falls with integrity traits", T). Traits not listed add 0. */
export const TRAIT_STRENGTH: readonly (readonly [Trait, number])[] = [
  ["Deceitful", 0.15],
  ["Ruthless", 0.1],
  ["Honest", -0.15],
  ["Compassionate", -0.05],
];

/** A map stronger than this may be challenged in court (pivot 5.6 `CHALLENGE_STRENGTH`, T). */
export const CHALLENGE_STRENGTH = 0.6;
/** The chance a map above `CHALLENGE_STRENGTH` is challenged (pivot 5.6 "may be", T). */
export const CHALLENGE_FILE_CHANCE = 0.8;
/** Judges on a challenge's panel (pivot 5.6, T): a majority strikes. */
export const CHALLENGE_PANEL = 3;
/** The month and day of the year it was filed in that the court rules (pivot 5.6, T). */
export const CHALLENGE_RULING_MONTH = 11;
export const CHALLENGE_RULING_DAY = 1;
/** A judge's chance to strike a map just over the line, with middling integrity and no party (pivot 5.6, T). */
export const STRIKE_BASE = 0.3;
/** Added from just over `CHALLENGE_STRENGTH` to strength 1 (pivot 5.6, T). */
export const STRIKE_EXCESS_K = 0.4;
/** Added from integrity 50 to 100 (taken from 50 to 0) (pivot 5.6 "by integrity", T). */
export const STRIKE_INTEGRITY_K = 0.25;
/** Taken when the judge is of the drawer's party, added when of the other (pivot 5.6 "and leaning", T). */
export const STRIKE_PARTY_K = 0.15;
/** Taken for a judge who leans to the State (4.21.1's leanings; pivot 5.6, T). */
export const STRIKE_DEFERENCE_K = 0.1;
/** A judge's chance to strike is held in this range (T). */
export const STRIKE_P_MIN = 0.02;
export const STRIKE_P_MAX = 0.98;
/** A struck map is redrawn at this share of its strength, below `CHALLENGE_STRENGTH` (pivot 5.6, T). */
export const STRUCK_STRENGTH_MULT = 0.5;

/** How hard a drawer gerrymanders (pivot 5.5): up with intrigue, down with integrity and its traits. */
export function gerrymanderStrength(intrigue: number, integrity: number, traits: readonly Trait[]): number {
  let s =
    STRENGTH_BASE +
    (STRENGTH_INTRIGUE_K * (intrigue - SKILL_MID)) / SKILL_MID -
    (STRENGTH_INTEGRITY_K * (integrity - INTEGRITY_MID)) / INTEGRITY_MID;
  for (const [t, k] of TRAIT_STRENGTH) if (traits.includes(t)) s += k;
  return clamp(s, 0.0, 1.0);
}

/** Who draws a state's map, and how hard (pivot 5.5). */
export interface Drawer {
  /** Null for a map no party draws (an independent governor): neutral. */
  party: Party | null;
  strength: number;
  /** Where it came from: the governor, or the POC's stand-in (D1039). */
  source: "Governor" | "Delegation";
}

function pocParty(world: World, state: UsStateId): Party {
  const count = (kind: "House" | "Senate"): [number, number] => {
    let a = 0;
    let b = 0;
    for (const c of world.politics.politicians) {
      if (c.office.kind === kind && c.office.state === state) {
        if (c.party === "Democrats") a++;
        else b++;
      }
    }
    return [a, b];
  };
  for (const kind of ["House", "Senate"] as const) {
    const [a, b] = count(kind);
    if (a !== b) return a > b ? "Democrats" : "Republicans";
  }
  return (world.politics.states[state]?.lean_pts ?? 0.0) >= 0.0 ? "Democrats" : "Republicans";
}

function pocStandIn(world: World, state: UsStateId, party: Party): Politician | undefined {
  for (const kind of ["Senate", "House"] as const) {
    const c = world.politics.politicians.find(
      (p) => p.office.kind === kind && p.office.state === state && p.party === party,
    );
    if (c !== undefined) return c;
  }
  return undefined;
}

/** The drawer of `state`'s map (pivot 5.5): its governor, else the POC's stand-in (D1039). */
export function drawerOf(world: World, state: UsStateId): Drawer {
  const held = officeHolderOf(world.persons, { kind: "Governor", state });
  const gov = held === undefined ? undefined : personGet(world.persons, held.person);
  if (gov !== undefined) {
    return {
      party: gov.party,
      strength:
        gov.party === null ? 0.0 : gerrymanderStrength(gov.skills.intrigue, gov.integrity, gov.traits),
      source: "Governor",
    };
  }
  const party = pocParty(world, state);
  const c = pocStandIn(world, state, party);
  const strength =
    c === undefined
      ? STRENGTH_BASE
      : gerrymanderStrength(c.skills.intrigue, c.integrity ?? INTEGRITY_MID, c.traits);
  return { party, strength, source: "Delegation" };
}

/** A judge as a challenge sees one (pivot 5.6). */
export interface Judge {
  integrity: number;
  party: Party | null;
  leaning: JudgeLeaning | null;
}

/** Every sitting judge: lane C's offices when it has any, else the politics POC's (in id order). */
export function judgesOf(world: World): Judge[] {
  const out: Judge[] = [];
  for (const h of world.persons.offices) {
    if (h.seat.kind !== "Judge") continue;
    const p = personGet(world.persons, h.person);
    if (p !== undefined) out.push({ integrity: p.integrity, party: p.party, leaning: null });
  }
  if (out.length > 0) return out;
  for (const c of world.politics.politicians) {
    if (c.office.kind === "Judge") {
      out.push({ integrity: c.integrity ?? INTEGRITY_MID, party: c.party, leaning: c.leaning });
    }
  }
  return out;
}

/** One judge's chance to strike a map of strength `s` drawn by `drawnBy` (pivot 5.6). */
export function strikeChance(j: Judge, s: number, drawnBy: Party | null): number {
  const excess = clamp((s - CHALLENGE_STRENGTH) / (1.0 - CHALLENGE_STRENGTH), 0.0, 1.0);
  let p =
    STRIKE_BASE +
    STRIKE_EXCESS_K * excess +
    (STRIKE_INTEGRITY_K * (j.integrity - INTEGRITY_MID)) / INTEGRITY_MID;
  if (drawnBy !== null && j.party !== null) p += j.party === drawnBy ? -STRIKE_PARTY_K : STRIKE_PARTY_K;
  if (j.leaning === "State") p -= STRIKE_DEFERENCE_K;
  return clamp(p, STRIKE_P_MIN, STRIKE_P_MAX);
}

/**
 * A court's ruling (pivot 5.6): a panel of `CHALLENGE_PANEL` judges drawn without repeats (all of
 * them if fewer; one judge of middling integrity and no party if none sit), each votes, a majority
 * strikes. Governing stream.
 */
export function courtStrikes(
  judges: readonly Judge[],
  s: number,
  drawnBy: Party | null,
  g: DrawSource,
): boolean {
  const pool = judges.length > 0 ? [...judges] : [{ integrity: INTEGRITY_MID, party: null, leaning: null }];
  const panel: Judge[] = [];
  while (panel.length < CHALLENGE_PANEL && pool.length > 0) {
    const k = g.intInclusive("Governing", 0, pool.length - 1);
    panel.push(pool.splice(k, 1)[0] as Judge);
  }
  let strike = 0;
  for (const j of panel) if (g.chance("Governing", strikeChance(j, s, drawnBy))) strike++;
  return 2 * strike > panel.length;
}
