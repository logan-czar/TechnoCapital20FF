// Generated US politicians: base characters of class Politician (spec 3.7.1 extended, D980). Reuses
// the 3.7.1 draws through a DrawSource that sends them to the Politics stream, so politics never
// moves the Gen stream the boards and startups read (D9).

import { weightedPick } from "../births/weights.ts";
import { drawBaseFields, type Range, rangeNew } from "../people/simple.ts";
import type { DrawSource } from "../types/draws.ts";
import type { BaseCharacter, NameBook, SkillKind, Trait } from "../types/state/people.ts";
import type { Ideology, JudgeLeaning, Party } from "../types/state/politics.ts";

/** Every draw of a politician comes from the Politics stream, whatever stream the helper names. */
export function politicsDraws(draws: DrawSource): DrawSource {
  return {
    nextU32: () => draws.nextU32("Politics"),
    uniform: () => draws.uniform("Politics"),
    normal: () => draws.normal("Politics"),
    poisson: (_s, mean) => draws.poisson("Politics", mean),
    intInclusive: (_s, lo, hi) => draws.intInclusive("Politics", lo, hi),
    chance: (_s, p) => draws.chance("Politics", p),
  };
}

/** The generation ranges of a kind of office (T). */
export interface OfficeRanges {
  /** Floors are 4.7.1's: legislator 25, head of state 35; senator 30 is the real one (A). */
  age: Range;
  /** The office's key skill: Persuasion for the elected, the post's skill when appointed. */
  key_skill: Range;
  other_skills: Range;
  traits: readonly Trait[];
}

const ELECTED_TRAITS: readonly Trait[] = [
  "Ambitious",
  "Gregarious",
  "Narcissist",
  "Honest",
  "Deceitful",
  "Ruthless",
  "Cautious",
  "Zealot",
  "Cynic",
];
const APPOINTED_TRAITS: readonly Trait[] = [
  "Diligent",
  "Ambitious",
  "Cautious",
  "Honest",
  "Deceitful",
  "Ruthless",
];
const JUDGE_TRAITS: readonly Trait[] = [
  "Honest",
  "Deceitful",
  "Cautious",
  "Diligent",
  "Conservative",
  "Ambitious",
];

/** D980 (T). */
export const HOUSE_RANGES: OfficeRanges = {
  age: rangeNew(30, 70),
  key_skill: rangeNew(6, 14),
  other_skills: rangeNew(2, 9),
  traits: ELECTED_TRAITS,
};
export const SENATE_RANGES: OfficeRanges = {
  age: rangeNew(38, 74),
  key_skill: rangeNew(8, 16),
  other_skills: rangeNew(3, 10),
  traits: ELECTED_TRAITS,
};
export const PRESIDENT_RANGES: OfficeRanges = {
  age: rangeNew(45, 72),
  key_skill: rangeNew(12, 20),
  other_skills: rangeNew(4, 12),
  traits: ELECTED_TRAITS,
};
/** 4.7.1 Minister: relevant skill at least 12. */
export const CABINET_RANGES: OfficeRanges = {
  age: rangeNew(40, 72),
  key_skill: rangeNew(12, 18),
  other_skills: rangeNew(3, 10),
  traits: APPOINTED_TRAITS,
};
export const JUDGE_RANGES: OfficeRanges = {
  age: rangeNew(42, 66),
  key_skill: rangeNew(10, 18),
  other_skills: rangeNew(3, 10),
  traits: JUDGE_TRAITS,
};

/** Each party's blocs, 1 to 3 (4.4.7), with the chance a member believes in each (D981, T). */
export const PARTY_BLOCS: Readonly<Record<Party, readonly (readonly [Ideology, number])[]>> = {
  Democrats: [
    ["Liberals", 0.7],
    ["EffectiveAltruists", 0.15],
    ["Communists", 0.15],
  ],
  Republicans: [
    ["Chuds", 0.45],
    ["Landites", 0.4],
    ["Accelerationists", 0.15],
  ],
};

/** What every generated person has before they take a seat. */
export interface Drawn extends Omit<BaseCharacter, "class"> {
  ideology: Ideology;
}

/**
 * Draws a person for a kind of office, in a frozen order: name, age, skills in column order, trait
 * count, traits, ideology. `g` is a `politicsDraws` source.
 */
export function drawPerson(
  g: DrawSource,
  names: NameBook,
  ranges: OfficeRanges,
  keySkill: SkillKind,
  party: Party,
): Drawn {
  const skillRange = (kind: SkillKind): Range => (kind === keySkill ? ranges.key_skill : ranges.other_skills);
  const base = drawBaseFields(g, names, ranges.age, skillRange, ranges.traits);
  return { ...base, ideology: drawIdeology(g, party) };
}

function drawIdeology(g: DrawSource, party: Party): Ideology {
  const blocs = PARTY_BLOCS[party];
  const i = weightedPick(
    blocs.map(([, chance]) => chance),
    g,
  ) as number;
  return (blocs[i] as readonly [Ideology, number])[0];
}

/** The four leanings, equally likely (4.21.1, T). */
const LEANINGS: readonly JudgeLeaning[] = ["Business", "Neutral", "State", "Labor"];
/** 4.21.1 Integrity, 0 to 100 (as agency heads). */
export const JUDGE_INTEGRITY: Range = rangeNew(20, 95);

export function drawJudgeLeaning(g: DrawSource): JudgeLeaning {
  return LEANINGS[g.intInclusive("Politics", 0, LEANINGS.length - 1)] as JudgeLeaning;
}
