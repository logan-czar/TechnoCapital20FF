// Simple (partial) characters: generated filler executives for board seats (spec 3.7.1). Ported
// from crates/sim/src/people/simple.rs. The `CompanySize` and `SimpleCharacter` types are in
// types/state/people.ts.

import type { DrawSource } from "../types/draws.ts";
import type { CompanySize, NameBook, Seat, SimpleCharacter, Trait } from "../types/state/people.ts";
import { SKILL_KIND_ALL, type SkillKind, seatSkills, skillsDefault } from "./board.ts";
import { nameBookDraw } from "./names.ts";
import { traitPair } from "./traits.ts";

export type { CompanySize, SimpleCharacter } from "../types/state/people.ts";
export { COMPANY_SIZE_VALUES } from "../types/state/people.ts";

/** Revenue at which a company is Mid (spec 3.7.1: "Mid: $100M to $10B"), USD a year. */
export const MID_REVENUE_USD = 100.0e6;
/** Revenue at which a company is Large (spec 3.7.1: "Large: $10B and up"), USD a year. */
export const LARGE_REVENUE_USD = 10.0e9;
/** Chance of two role traits rather than one (spec 3.7.1: one 60%, two 40%). */
export const TWO_TRAIT_CHANCE = 0.4;

/** An inclusive integer range for a uniform draw. */
export interface Range {
  lo: number;
  hi: number;
}

/** Rust `Range::new`. */
export function rangeNew(lo: number, hi: number): Range {
  return { lo, hi };
}

/** Rust `Range::contains`. */
export function rangeContains(r: Range, v: number): boolean {
  return v >= r.lo && v <= r.hi;
}

/** A uniform integer draw from the gen stream (spec 3.7.1 "uniform integer draws"). Rust `Range::draw`. */
export function rangeDraw(r: Range, draws: DrawSource): number {
  return draws.intInclusive("Gen", r.lo, r.hi);
}

/** The generation ranges of one size (spec 3.7.1 table, T). */
export interface SizeRanges {
  seat_skill: Range;
  other_skills: Range;
  age: Range;
}

/** Spec 3.7.1 table: Small (under $100M). */
export const SMALL_RANGES: SizeRanges = {
  seat_skill: rangeNew(4, 10),
  other_skills: rangeNew(2, 8),
  age: rangeNew(25, 55),
};
/** Spec 3.7.1 table: Mid ($100M to $10B). */
export const MID_RANGES: SizeRanges = {
  seat_skill: rangeNew(7, 13),
  other_skills: rangeNew(3, 9),
  age: rangeNew(30, 62),
};
/** Spec 3.7.1 table: Large ($10B and up). */
export const LARGE_RANGES: SizeRanges = {
  seat_skill: rangeNew(10, 16),
  other_skills: rangeNew(4, 10),
  age: rangeNew(38, 68),
};

/**
 * The size of a company with `revenueUsd` of trailing annual revenue (spec 3.7.1). $100M exactly
 * is Mid and $10B exactly is Large (D202). Rust `CompanySize::from_revenue`.
 */
export function companySizeFromRevenue(revenueUsd: number): CompanySize {
  if (revenueUsd >= LARGE_REVENUE_USD) return "Large";
  if (revenueUsd >= MID_REVENUE_USD) return "Mid";
  return "Small";
}

/** Rust `CompanySize::ranges`. */
export function companySizeRanges(size: CompanySize): SizeRanges {
  switch (size) {
    case "Small":
      return SMALL_RANGES;
    case "Mid":
      return MID_RANGES;
    case "Large":
      return LARGE_RANGES;
  }
}

/** Spec 3.7.1 role trait lists, by seat. */
export const CEO_TRAITS: readonly Trait[] = [
  "Ambitious",
  "Diligent",
  "Brave",
  "Visionary",
  "Cautious",
  "Gregarious",
];
export const COO_TRAITS: readonly Trait[] = ["Diligent", "Ruthless", "Cautious", "Compassionate", "Lazy"];
export const CFO_TRAITS: readonly Trait[] = ["Greedy", "Cautious", "Diligent", "Honest", "Deceitful"];
export const CMO_TRAITS: readonly Trait[] = ["Gregarious", "Narcissist", "Brave", "Hedonist"];
export const CIO_TRAITS: readonly Trait[] = ["Paranoid", "Deceitful", "Ruthless", "Cautious"];
/** Chair, General Counsel, Chief Strategy Officer (post-MVP seats; spec 3.7.1). */
export const CHAIR_TRAITS: readonly Trait[] = ["Paranoid", "Ruthless", "Honest", "Ambitious", "Cautious"];

/** The seat's role trait list (spec 3.7.1). */
export function roleTraits(seat: Seat): readonly Trait[] {
  switch (seat) {
    case "Ceo":
      return CEO_TRAITS;
    case "Coo":
      return COO_TRAITS;
    case "Cfo":
      return CFO_TRAITS;
    case "Cmo":
      return CMO_TRAITS;
    case "Cio":
      return CIO_TRAITS;
    case "Chair":
      return CHAIR_TRAITS;
  }
}

/** Draws one trait uniformly from `list`, skipping `excluded` traits and their opposites. */
export function drawTrait(draws: DrawSource, list: readonly Trait[], excluded: readonly Trait[]): Trait {
  const allowed = list.filter((t) => excluded.every((e) => traitPair(e) !== traitPair(t)));
  if (allowed.length === 0) throw new Error("no trait left to draw");
  const i = draws.intInclusive("Gen", 0, allowed.length - 1);
  return allowed[i] as Trait;
}

/** True if `seat` uses `kind` (spec 3.7). */
export function usesSkill(seat: Seat, kind: SkillKind): boolean {
  const s = seatSkills(seat);
  return s.kind === "One" ? s.skill === kind : s.skills.includes(kind);
}

/**
 * Generates the simple character for `seat` of a company of `size` (spec 3.7.1, T): uniform
 * integer draws from the gen stream, in a frozen order (D202): the name (`nameBookDraw`), the
 * age, the six skills in column order (each seat skill in the seat range, the rest in the other
 * range; the CEO's Finance, Operations and Persuasion all in the seat range), then the trait
 * count (two with `TWO_TRAIT_CHANCE`), then the traits from the seat's list with no opposite pair
 * (the first uniform, the second uniform over the rest less its opposite).
 */
export function generateSimple(
  draws: DrawSource,
  names: NameBook,
  size: CompanySize,
  seat: Seat,
): SimpleCharacter {
  const ranges = companySizeRanges(size);
  const name = nameBookDraw(names, draws);
  const age = rangeDraw(ranges.age, draws);
  const skills = skillsDefault();
  for (const kind of SKILL_KIND_ALL) {
    const range = usesSkill(seat, kind) ? ranges.seat_skill : ranges.other_skills;
    skills[kind] = rangeDraw(range, draws);
  }
  const list = roleTraits(seat);
  const two = draws.chance("Gen", TWO_TRAIT_CHANCE);
  const first = drawTrait(draws, list, []);
  const traits = [first];
  if (two) traits.push(drawTrait(draws, list, [first]));
  return { name, age, skills, traits, seat, size };
}
