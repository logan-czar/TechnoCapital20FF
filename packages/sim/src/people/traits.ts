// Personality traits: the 12 opposite pairs, their skill effects and the management score shifts
// (spec 3.7.1, 3.7.2; 1-corporate-core 1.1.2; 10.5.1). Ported from crates/sim/src/people/traits.rs.
// The `Trait` type and `TRAIT_VALUES` (Rust `Trait::ALL`) are in types/state/people.ts.

import { clamp } from "../types/num.ts";
import { type Seat, type Skills, TRAIT_VALUES, type Trait } from "../types/state/people.ts";
import { SKILL_KIND_ALL, SKILL_MAX, SKILL_MIN, type SkillKind } from "./board.ts";

export type { Trait } from "../types/state/people.ts";
export { TRAIT_VALUES as TRAIT_ALL } from "../types/state/people.ts";

/** Number of opposite pairs (1-corporate-core 1.1.2). */
export const TRAIT_PAIR_COUNT = 12;

/** The index of a trait in enum order. */
function traitIndex(t: Trait): number {
  return TRAIT_VALUES.indexOf(t);
}

/** The opposite trait of the pair (1.1.2). Rust `Trait::opposite`. */
export function traitOpposite(t: Trait): Trait {
  return TRAIT_VALUES[traitIndex(t) ^ 1] as Trait;
}

/** The pair number, 0 to 11. Rust `Trait::pair`. */
export function traitPair(t: Trait): number {
  return Math.trunc(traitIndex(t) / 2);
}

/** The trait's name as characters.csv writes it (the value itself). Rust `Trait::name`. */
export function traitName(t: Trait): string {
  return t;
}

/**
 * The trait named `name` (characters.csv spelling), if it is one of the 24. characters.csv also
 * holds unique traits and perks outside the 12 pairs (1-corporate-core 1.1.2, such as
 * "Operational Excellence"); they give null here, so whoever loads full characters filters them
 * out (they have no skill effect or management shift in the MVP). Rust `Trait::from_name`.
 */
export function traitFromName(name: string): Trait | null {
  return (TRAIT_VALUES as readonly string[]).includes(name) ? (name as Trait) : null;
}

/**
 * The trait's lasting skill effects (1-corporate-core 1.1.2 "Skill effect" column), as (skill,
 * points). Conditional effects are left out: Paranoid's +3 Intrigue is for defense only, Zealot's
 * +2 Persuasion only with the same ideology and Narcissist's +2 in public is cancelled by its -2
 * in private; Diligent's "+2 management score skill" is the management shift
 * (`traitManagementShift`), not a skill (decision D206). Rust `Trait::skill_effects`.
 */
export function traitSkillEffects(t: Trait): readonly (readonly [SkillKind, number])[] {
  switch (t) {
    case "Ambitious":
      return [
        ["finance", 1],
        ["operations", 1],
        ["persuasion", 1],
        ["intrigue", 1],
        ["tech", 1],
        ["hustle", 1],
      ];
    case "Greedy":
      return [["finance", 2]];
    case "Ruthless":
      return [["intrigue", 2]];
    case "Visionary":
      return [["tech", 2]];
    case "Honest":
      return [["intrigue", -2]];
    case "Brave":
      return [["persuasion", 1]];
    case "Diligent":
      return [["operations", 1]];
    case "Hedonist":
      return [
        ["operations", -1],
        ["persuasion", 1],
      ];
    case "Gregarious":
      return [["persuasion", 2]];
    default:
      return [];
  }
}

/** Spec 3.7.1, 10.5.1: Diligent +2 management score skill. */
export const DILIGENT_MANAGEMENT_SHIFT = 2;
/** Spec 3.7.1, 10.5.1: Lazy -2. */
export const LAZY_MANAGEMENT_SHIFT = -2;
/** Spec 3.7.1, 10.5.1: Ambitious +1. */
export const AMBITIOUS_MANAGEMENT_SHIFT = 1;
/** Spec 3.7.1, 10.5.1: Greedy -1, as CFO only. */
export const GREEDY_CFO_MANAGEMENT_SHIFT = -1;

/**
 * The trait's shift to its holder's contribution to the management score, in skill points, when
 * the holder sits in `seat` (spec 3.7.1, 10.5.1): Diligent +2, Lazy -2 and Ambitious +1 in any
 * seat; Greedy -1 in the CFO seat only. 10.5.1's Deceitful -1 and Honest's investor confidence +1
 * are not in the spec's 3.7.1 list and are not applied (D206). Rust `Trait::management_shift`.
 */
export function traitManagementShift(t: Trait, seat: Seat): number {
  switch (t) {
    case "Diligent":
      return DILIGENT_MANAGEMENT_SHIFT;
    case "Lazy":
      return LAZY_MANAGEMENT_SHIFT;
    case "Ambitious":
      return AMBITIOUS_MANAGEMENT_SHIFT;
    case "Greedy":
      return seat === "Cfo" ? GREEDY_CFO_MANAGEMENT_SHIFT : 0;
    default:
      return 0;
  }
}

/** True if no two of `traits` are opposites (and none repeats). */
export function noOppositePair(traits: readonly Trait[]): boolean {
  return traits.every((a, i) => traits.slice(i + 1).every((b) => traitPair(a) !== traitPair(b)));
}

/**
 * Skills with the traits' lasting skill effects added, clamped to 0 to 30 (spec 3.7.1 "traits
 * apply only their skill effects"; 1.1.2). For rolls and votes; the management score reads the
 * drawn skills plus the management shifts instead (D206).
 */
export function withTraitEffects(skills: Skills, traits: readonly Trait[]): Skills {
  const out: Skills = { ...skills };
  for (const kind of SKILL_KIND_ALL) {
    let delta = 0;
    for (const t of traits) {
      for (const [k, d] of traitSkillEffects(t)) {
        if (k === kind) delta += d;
      }
    }
    out[kind] = clamp(skills[kind] + delta, SKILL_MIN, SKILL_MAX);
  }
  return out;
}
