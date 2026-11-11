// Generated US politicians: base characters of class Politician (spec 3.7.1 extended, D980). Reuses
// the 3.7.1 draws through a DrawSource that sends them to the Politics stream, so politics never
// moves the Gen stream the boards and startups read (D9).

import { weightedPick } from "../births/weights.ts";
import { nameBookDrawUnique } from "../people/names.ts";
import { drawBaseFields, type Range, rangeDraw, rangeNew } from "../people/simple.ts";
import { pinnedDraws } from "../rng.ts";
import type { DrawSource } from "../types/draws.ts";
import { expF } from "../types/libm.ts";
import type { BaseCharacter, NameBook, SkillKind, Trait } from "../types/state/people.ts";
import type { Ideology, JudgeLeaning, Party } from "../types/state/politics.ts";

/** Every draw of a politician comes from the Politics stream, whatever stream the helper names. */
export function politicsDraws(draws: DrawSource): DrawSource {
  return pinnedDraws(draws, "Politics");
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
export type BlocTable = Readonly<Record<Party, readonly (readonly [Ideology, number])[]>>;

export const PARTY_BLOCS: BlocTable = {
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

/** Who a person can be: the name book and the party blocs. */
export interface PersonPool {
  names: NameBook;
  blocs: BlocTable;
  /** The names in office, kept unique in a historical world (1995-rework 7.2); null leaves the draws frozen. */
  taken: Set<string> | null;
}

/**
 * Draws a person for a kind of office, in a frozen order: name, age, skills in column order, trait
 * count, traits, ideology. `g` is a `politicsDraws` source. A name in use is drawn again last.
 */
export function drawPerson(
  g: DrawSource,
  pool: PersonPool,
  ranges: OfficeRanges,
  keySkill: SkillKind,
  party: Party,
): Drawn {
  const skillRange = (kind: SkillKind): Range => (kind === keySkill ? ranges.key_skill : ranges.other_skills);
  const base = drawBaseFields(g, pool.names, ranges.age, skillRange, ranges.traits);
  const taken = pool.taken;
  if (taken !== null) {
    if (taken.has(base.name)) base.name = nameBookDrawUnique(pool.names, g, (n) => taken.has(n));
    taken.add(base.name);
  }
  return { ...base, ideology: drawIdeology(g, pool.blocs, party) };
}

/** An ideology from `party`'s blocs in `table`, weighted by their chances (D981). */
export function drawIdeology(g: DrawSource, table: BlocTable, party: Party): Ideology {
  const blocs = table[party];
  const i = weightedPick(
    blocs.map(([, chance]) => chance),
    g,
  ) as number;
  return (blocs[i] as readonly [Ideology, number])[0];
}

// ---------------------------------------------------------------- careers (pivot 5.7 to 5.9; D1041)

/** A governor (pivot 5.8, T): elected, so Persuasion is the key skill; 35 is a common floor. */
export const GOVERNOR_RANGES: OfficeRanges = {
  age: rangeNew(36, 72),
  key_skill: rangeNew(8, 16),
  other_skills: rangeNew(3, 10),
  traits: ELECTED_TRAITS,
};
/** The Fed chair (pivot 5.8, T): appointed for Finance, older than a cabinet secretary. */
export const FED_CHAIR_RANGES: OfficeRanges = {
  age: rangeNew(50, 72),
  key_skill: rangeNew(14, 20),
  other_skills: rangeNew(4, 12),
  traits: APPOINTED_TRAITS,
};

/** Bench traits (pivot 5.9: ambition is a trait): both sides of ambition, so some never run. */
const BENCH_TRAITS: readonly Trait[] = [
  "Ambitious",
  "Content",
  "Gregarious",
  "Shy",
  "Honest",
  "Deceitful",
  "Ruthless",
  "Compassionate",
  "Zealot",
  "Cynic",
  "Narcissist",
  "Humble",
];

/** The four kinds of rising figure on a state's bench (pivot 5.9 item 1). */
export type BenchOrigin = "Mayor" | "StateLegislator" | "Business" | "Celebrity";

/** How a kind of bench figure is drawn (T): its share of the bench, its key skill and its ranges. */
export interface BenchKind {
  origin: BenchOrigin;
  weight: number;
  key: SkillKind;
  ranges: OfficeRanges;
}

/** The bench kinds in draw order (pivot 5.9 item 1, T). */
export const BENCH_KINDS: readonly BenchKind[] = [
  {
    origin: "Mayor",
    weight: 0.3,
    key: "operations",
    ranges: {
      age: rangeNew(32, 62),
      key_skill: rangeNew(6, 13),
      other_skills: rangeNew(2, 9),
      traits: BENCH_TRAITS,
    },
  },
  {
    origin: "StateLegislator",
    weight: 0.4,
    key: "persuasion",
    ranges: {
      age: rangeNew(28, 60),
      key_skill: rangeNew(5, 12),
      other_skills: rangeNew(2, 8),
      traits: BENCH_TRAITS,
    },
  },
  {
    origin: "Business",
    weight: 0.2,
    key: "finance",
    ranges: {
      age: rangeNew(35, 65),
      key_skill: rangeNew(8, 15),
      other_skills: rangeNew(2, 9),
      traits: BENCH_TRAITS,
    },
  },
  {
    origin: "Celebrity",
    weight: 0.1,
    key: "persuasion",
    ranges: {
      age: rangeNew(30, 65),
      key_skill: rangeNew(8, 16),
      other_skills: rangeNew(1, 7),
      traits: BENCH_TRAITS,
    },
  },
];

/** A person's integrity, 0 to 100 (pivot 5.5, 5.6, 5.11; T): the 4.21.1 range, as judges'. */
export const PERSON_INTEGRITY: Range = rangeNew(20, 95);

/**
 * How far each ideology sits from its party's centre (pivot 5.12, T): 0 mainstream, 1 a hard wing.
 * A state that leans toward a party sends more of its wings (`blocsForLean`).
 */
export const IDEOLOGY_WING: Readonly<Record<Ideology, number>> = {
  Liberals: 0,
  Communists: 1,
  Accelerationists: 0.5,
  EffectiveAltruists: 0.5,
  Transhumanists: 0.5,
  NeoLuddites: 0.5,
  Sovereigntists: 0.5,
  Landites: 0,
  Chuds: 1,
};
/** The wing tilt per 10 points of lean toward the person's party (T): exp(0.3) is about 1.35. */
export const IDEOLOGY_LEAN_TILT = 0.3;
/** The points of lean that make a party's draw e times likelier than the other's (T). */
export const LEAN_PARTY_SCALE_PTS = 8;

/**
 * A party's blocs for a person from a place leaning `leanPts` toward party A (pivot 5.7: ideology
 * consistent with party and home state): each bloc's chance times `exp(tilt × lean × wing ÷ 10)`,
 * where lean counts toward the person's own party. Weights only; `drawPerson` normalises.
 */
export function blocsForLean(base: BlocTable, leanPts: number): BlocTable {
  const tilt = (party: Party): readonly (readonly [Ideology, number])[] => {
    const toward = party === "Democrats" ? leanPts : -leanPts;
    return base[party].map(
      ([i, w]) => [i, w * expF((IDEOLOGY_LEAN_TILT * toward * IDEOLOGY_WING[i]) / 10)] as const,
    );
  };
  return { Democrats: tilt("Democrats"), Republicans: tilt("Republicans") };
}

/** A party drawn for a place leaning `leanPts` toward party A (pivot 5.7, T): a logistic in the lean. */
export function partyForLean(g: DrawSource, leanPts: number): Party {
  const a = 1 / (1 + expF(-leanPts / LEAN_PARTY_SCALE_PTS));
  return g.chance("Politics", a) ? "Democrats" : "Republicans";
}

/** Integrity (pivot 5.11, T): drawn in `PERSON_INTEGRITY`, then nudged by an honesty trait. */
export const HONESTY_INTEGRITY_SHIFT = 15;

export function drawIntegrity(
  g: DrawSource,
  traits: readonly Trait[],
  range: Range = PERSON_INTEGRITY,
): number {
  const base = rangeDraw(range, g);
  const shift = traits.includes("Honest")
    ? HONESTY_INTEGRITY_SHIFT
    : traits.includes("Deceitful")
      ? -HONESTY_INTEGRITY_SHIFT
      : 0;
  return Math.min(100, Math.max(0, base + shift));
}

/** The four leanings, equally likely (4.21.1, T). */
const LEANINGS: readonly JudgeLeaning[] = ["Business", "Neutral", "State", "Labor"];
/** 4.21.1 Integrity, 0 to 100 (as agency heads). */
export const JUDGE_INTEGRITY: Range = rangeNew(20, 95);

export function drawJudgeLeaning(g: DrawSource): JudgeLeaning {
  return LEANINGS[g.intInclusive("Politics", 0, LEANINGS.length - 1)] as JudgeLeaning;
}
