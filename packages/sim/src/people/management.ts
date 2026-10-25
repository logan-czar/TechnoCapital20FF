// Management score and confidence factor (spec 5.7; 10.5.1, 10.5.2). Ported from
// crates/sim/src/people/management.rs.

import { clamp, minF } from "../types/num.ts";
import type { Seat, Skills, Trait } from "../types/state/people.ts";
import { SKILL_MAX, SKILL_MIN, seatIndexInOrder, skillsSeatSkill } from "./board.ts";
import { traitManagementShift } from "./traits.ts";

/** Spec 5.7: an empty seat counts skill 3. */
export const EMPTY_SEAT_SKILL = 3.0;
/** Spec 5.7: the skill that scores 100 (`skill ÷ 20 × 100`). */
export const FULL_SCORE_SKILL = 20.0;
/** Spec 5.7: `× 100` turns the weighted skill share into a score. */
export const SCORE_SCALE = 100.0;
/** Spec 5.7: the score cap. */
export const MAX_SCORE = 100.0;
/** Spec 5.7 weights: CEO 30%, COO 20%, CFO 20%, CIO 10%, Chair 10%, other seats 10% (the CMO). */
export const CEO_WEIGHT = 0.3;
export const COO_WEIGHT = 0.2;
export const CFO_WEIGHT = 0.2;
export const CIO_WEIGHT = 0.1;
export const CHAIR_WEIGHT = 0.1;
export const OTHER_WEIGHT = 0.1;
/** Spec 5.7: confidence factor `0.8 + score ÷ 250`. */
export const CONFIDENCE_BASE = 0.8;
export const CONFIDENCE_SCORE_DIVISOR = 250.0;
/** Spec 5.6: management factor `0.5 + score ÷ 100`. */
export const MGMT_FACTOR_BASE = 0.5;
export const MGMT_FACTOR_SCORE_DIVISOR = 100.0;

/** The weight of a seat in the management score (spec 5.7). The CMO is the MVP's one "other seat". */
export function seatWeight(seat: Seat): number {
  switch (seat) {
    case "Ceo":
      return CEO_WEIGHT;
    case "Coo":
      return COO_WEIGHT;
    case "Cfo":
      return CFO_WEIGHT;
    case "Cio":
      return CIO_WEIGHT;
    case "Chair":
      return CHAIR_WEIGHT;
    case "Cmo":
      return OTHER_WEIGHT;
  }
}

/** A seated board member as the score reads it: drawn skills and traits, simple or full. */
export interface Member {
  skills: Skills;
  traits: readonly Trait[];
}

/**
 * The board the score reads (spec 3.7, 5.7): one entry per seat in `Seat` order (CEO, CFO, CIO,
 * CMO, COO, Chair). A labor seat that is closed (fewer labor units) or unfilled is null and counts
 * skill 3, like the Chair, which is empty in the MVP (spec 3.7; D205).
 */
export interface Board {
  seats: (Member | null)[];
}

/** Rust `Board::default()`: every seat empty. */
export function boardDefault(): Board {
  return { seats: [null, null, null, null, null, null] };
}

/** Rust `Board::set`. */
export function boardSet(board: Board, seat: Seat, member: Member): void {
  board.seats[seatIndexInOrder(seat)] = member;
}

/** Rust `Board::get`. */
export function boardGet(board: Board, seat: Seat): Member | null {
  return board.seats[seatIndexInOrder(seat)] ?? null;
}

/**
 * The skill a member adds in `seat` (spec 5.7, 3.7.1): the seat's skill as drawn plus the traits'
 * management shifts (Diligent +2, Lazy -2, Ambitious +1, Greedy -1 as CFO), clamped to 0 to 30.
 * The traits' other skill effects are not added here (D206).
 */
export function memberSkill(member: Member, seat: Seat): number {
  let shift = 0;
  for (const t of member.traits) shift += traitManagementShift(t, seat);
  return clamp(skillsSeatSkill(member.skills, seat) + shift, SKILL_MIN, SKILL_MAX);
}

const ORDER: readonly Seat[] = ["Ceo", "Cfo", "Cio", "Cmo", "Coo", "Chair"];

/** The management score, 0 to 100 (spec 5.7): `min(100, Σ weight × skill ÷ 20 × 100)`. */
export function managementScore(board: Board): number {
  let weighted = 0.0;
  for (const seat of ORDER) {
    const m = boardGet(board, seat);
    const skill = m === null ? EMPTY_SEAT_SKILL : memberSkill(m, seat);
    weighted += seatWeight(seat) * skill;
  }
  return minF((weighted / FULL_SCORE_SKILL) * SCORE_SCALE, MAX_SCORE);
}

/** Investor confidence factor (spec 5.7; 10.0.8, 10.5.2): `0.8 + score ÷ 250`. */
export function confidenceFactor(score: number): number {
  return CONFIDENCE_BASE + score / CONFIDENCE_SCORE_DIVISOR;
}

/** Management factor on the R&D effect (spec 5.6; 10.5.2): `0.5 + score ÷ 100`. */
export function mgmtFactor(score: number): number {
  return MGMT_FACTOR_BASE + score / MGMT_FACTOR_SCORE_DIVISOR;
}
