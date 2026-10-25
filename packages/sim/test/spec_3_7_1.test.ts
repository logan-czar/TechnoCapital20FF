// Port of crates/sim/tests/spec_3_7_1.rs: spec 3.7.1 simple characters and their names
// (build-plan M3.2): skill and age ranges hold over many draws, traits come from the seat list
// with no opposite pair, the draw is deterministic for a fixed seed, and every starting seat can
// be filled.
//
// The ranges and trait lists below are copied from the spec text, not read from the code, so the
// test checks the code against the spec.
//
// Expects (Rust methods are free functions named type + method, camelCased):
//   ../../src/ops/labor.ts      laborUnits(gross_assets_usd, labor_value_usd), openSeats(labor)
//   ../../src/people/names.ts   nameBookForCountry(data, iso3) -> NameBook | null
//                               [NameBook::for_country], nameBookDraw(book, rng) -> string,
//                               nameBooksBuild(data, countryKeys) -> Result<NameBooks, ...>,
//                               nameBooksFromData(data) -> Result<NameBooks, ...>,
//                               nameBooksLen, nameBooksDistinct, nameBooksGet(books, countryId)
//                               -> NameBook | null
//   ../../src/people/simple.ts  companySizeFromRevenue(revenue), generateSimple(rng, names, size,
//                               seat) -> SimpleCharacter
//   ../../src/people/traits.ts  traitFromName(name) -> Trait | null, traitOpposite(t),
//                               noOppositePair(traits), withTraitEffects(skills, traits)
//   ../../src/world/load.ts     worldFromData
//   ./common/rng.ts             newRng, newNoNoise
// Trait and Seat are string unions, so Trait::name() is the value itself; skills are read by
// field name instead of Skills::get(SkillKind).
//
// Changed from the Rust: the seeded RNG is new (D951), so the seeds 145, 11, 9 and 42 draw other
// values than in Rust. Every assertion here is a range, a rate with the Rust tolerance or a
// determinism check, which hold for any sound generator. name_books...: the postcard round trip
// is a JSON round trip (D953).
import { describe, expect, it } from "vitest";
import { nameBookDraw, nameBookForCountry } from "../src/people/names.ts";
import { companySizeFromRevenue, generateSimple } from "../src/people/simple.ts";
import { noOppositePair, traitFromName, traitOpposite, withTraitEffects } from "../src/people/traits.ts";
import {
  type CompanySize,
  type NameBook,
  SEAT_LABOR,
  type Seat,
  type Skills,
  TRAIT_VALUES,
} from "../src/types/state/people.ts";
import { data } from "./common/index.ts";
import { newNoNoise, newRng } from "./common/rng.ts";

type SkillField = keyof Skills;
const ALL_SKILLS: readonly SkillField[] = [
  "finance",
  "operations",
  "persuasion",
  "intrigue",
  "tech",
  "hustle",
];

/** An inclusive range. */
type R = readonly [number, number];

/** Spec 3.7.1 generation table: (size, seat skill, other five skills, age), inclusive. */
const SPEC_SIZES: readonly (readonly [CompanySize, R, R, R])[] = [
  ["Small", [4, 10], [2, 8], [25, 55]],
  ["Mid", [7, 13], [3, 9], [30, 62]],
  ["Large", [10, 16], [4, 10], [38, 68]],
];

/**
 * Spec 3.7 "Skill used" column (and 10.5.1 for the Chair): the skills each seat draws in the
 * seat range.
 */
function specSeatSkills(seat: Seat): readonly SkillField[] {
  switch (seat) {
    case "Ceo":
      return ["finance", "operations", "persuasion"];
    case "Cfo":
      return ["finance"];
    case "Cio":
      return ["intrigue"];
    case "Cmo":
      return ["persuasion"];
    case "Coo":
      return ["operations"];
    case "Chair":
      return ["persuasion"];
  }
}

/** Spec 3.7.1 role trait table. */
function specRoleTraits(seat: Seat): readonly string[] {
  switch (seat) {
    case "Ceo":
      return ["Ambitious", "Diligent", "Brave", "Visionary", "Cautious", "Gregarious"];
    case "Coo":
      return ["Diligent", "Ruthless", "Cautious", "Compassionate", "Lazy"];
    case "Cfo":
      return ["Greedy", "Cautious", "Diligent", "Honest", "Deceitful"];
    case "Cmo":
      return ["Gregarious", "Narcissist", "Brave", "Hedonist"];
    case "Cio":
      return ["Paranoid", "Deceitful", "Ruthless", "Cautious"];
    case "Chair":
      return ["Paranoid", "Ruthless", "Honest", "Ambitious", "Cautious"];
  }
}

/** 1-corporate-core 1.1.2: the 12 pairs. */
const SPEC_PAIRS: readonly (readonly [string, string])[] = [
  ["Ambitious", "Content"],
  ["Greedy", "Generous"],
  ["Paranoid", "Trusting"],
  ["Ruthless", "Compassionate"],
  ["Visionary", "Conservative"],
  ["Honest", "Deceitful"],
  ["Brave", "Cautious"],
  ["Diligent", "Lazy"],
  ["Hedonist", "Ascetic"],
  ["Zealot", "Cynic"],
  ["Narcissist", "Humble"],
  ["Gregarious", "Shy"],
];

/** True if two of names form a pair of the spec table. */
function specHasOpposites(names: readonly string[]): boolean {
  return SPEC_PAIRS.some(([a, b]) => names.includes(a) && names.includes(b));
}

const ALL_SEATS: readonly Seat[] = ["Ceo", "Cfo", "Cio", "Cmo", "Coo", "Chair"];

function within(v: number, [lo, hi]: R): boolean {
  return v >= lo && v <= hi;
}

function names(d: ReturnType<typeof data>, iso3: string): NameBook {
  const b = nameBookForCountry(d, iso3);
  if (b === null) throw new Error(`no name book for ${iso3}`);
  return b;
}

describe("spec 3.7.1 simple characters", () => {
  it("size_bands_follow_revenue", () => {
    expect(companySizeFromRevenue(0.0)).toBe("Small");
    expect(companySizeFromRevenue(40.0e6), "Arrowhead").toBe("Small");
    expect(companySizeFromRevenue(99.9e6)).toBe("Small");
    expect(companySizeFromRevenue(100.0e6)).toBe("Mid");
    expect(companySizeFromRevenue(9.99e9)).toBe("Mid");
    expect(companySizeFromRevenue(10.0e9)).toBe("Large");
  });

  it("trait_pairs_match_the_spec", () => {
    for (const [a, b] of SPEC_PAIRS) {
      const ta = traitFromName(a);
      const tb = traitFromName(b);
      expect(ta).not.toBeNull();
      expect(tb).not.toBeNull();
      if (ta === null || tb === null) return;
      expect(traitOpposite(ta), a).toBe(tb);
      expect(traitOpposite(tb), b).toBe(ta);
    }
    expect(TRAIT_VALUES.length).toBe(24);
    expect(traitFromName("Operational Excellence")).toBeNull();
  });

  it("skill_age_and_trait_rules_hold_over_many_draws", () => {
    const d = data();
    const book = names(d, "USA");
    const rng = newRng(145);
    for (const [size, seatRange, otherRange, ageRange] of SPEC_SIZES) {
      for (const seat of ALL_SEATS) {
        const seatSkills = specSeatSkills(seat);
        let seenLo = false;
        let seenHi = false;
        let two = 0;
        const n = 3000;
        for (let i = 0; i < n; i++) {
          const c = generateSimple(rng, book, size, seat);
          expect(within(c.age, ageRange), `${size} age ${c.age}`).toBe(true);
          for (const kind of ALL_SKILLS) {
            const v = c.skills[kind];
            const range = seatSkills.includes(kind) ? seatRange : otherRange;
            expect(within(v, range), `${size} ${seat} ${kind} ${v}`).toBe(true);
            if (seatSkills.includes(kind)) {
              seenLo ||= v === range[0];
              seenHi ||= v === range[1];
            }
          }
          const traits: string[] = [...c.traits];
          expect(traits.length >= 1 && traits.length <= 2).toBe(true);
          expect(specHasOpposites(traits), JSON.stringify(traits)).toBe(false);
          expect(noOppositePair(c.traits)).toBe(true);
          expect(
            traits.every((t) => specRoleTraits(seat).includes(t)),
            `${seat} ${JSON.stringify(traits)}`,
          ).toBe(true);
          two += traits.length === 2 ? 1 : 0;
        }
        expect(seenLo && seenHi, `${size} ${seat}: whole seat range drawn`).toBe(true);
        // Spec 3.7.1: one trait 60%, two 40%.
        const share = two / n;
        expect(Math.abs(share - 0.4) < 0.04, `two traits ${share}`).toBe(true);
      }
    }
  });

  it("every_listed_role_trait_is_drawn", () => {
    const d = data();
    const book = names(d, "AUS");
    const rng = newRng(11);
    for (const seat of ALL_SEATS) {
      const seen: string[] = [];
      for (let i = 0; i < 2000; i++) {
        const c = generateSimple(rng, book, "Mid", seat);
        for (const t of c.traits) {
          if (!seen.includes(t)) seen.push(t);
        }
      }
      seen.sort();
      const want = [...specRoleTraits(seat)].sort();
      expect(seen, seat).toEqual(want);
    }
  });

  it("opposite_pairs_never_appear_even_where_the_list_has_one", () => {
    // The CEO list holds Brave and Cautious, the COO list Diligent and Lazy and Ruthless and
    // Compassionate, the CFO list Honest and Deceitful.
    const d = data();
    const book = names(d, "GBR");
    const rng = newRng(9);
    for (const seat of ["Ceo", "Coo", "Cfo"] as const) {
      for (let i = 0; i < 5000; i++) {
        const c = generateSimple(rng, book, "Mid", seat);
        const traits: string[] = [...c.traits];
        expect(specHasOpposites(traits), `${seat} ${JSON.stringify(traits)}`).toBe(false);
      }
    }
  });

  it("deterministic_for_a_fixed_seed", () => {
    const d = data();
    const book = names(d, "JPN");
    const run = (seed: number) => {
      const rng = newRng(seed);
      return Array.from({ length: 200 }, (_, i) =>
        generateSimple(rng, book, "Mid", SEAT_LABOR[i % 5] as Seat),
      );
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
    // No rolls (spec 5.16) also works: every draw is the middle of its range.
    const c = generateSimple(newNoNoise(), book, "Small", "Cfo");
    expect(c.age, "25 to 55").toBe(40);
    expect(c.skills.finance, "4 to 10").toBe(7);
    expect(c.skills.operations, "2 to 8").toBe(5);
  });

  it("names_come_from_the_hq_country_culture", () => {
    const d = data();
    const china = names(d, "CHN");
    expect(china.culture).toBe("chinese");
    expect(china.family_first).toBe(true);
    const rng = newRng(5);
    const splitOnce = (s: string): [string, string] => {
      const at = s.indexOf(" ");
      if (at < 0) throw new Error(`no space in ${s}`);
      return [s.slice(0, at), s.slice(at + 1)];
    };
    for (let i = 0; i < 100; i++) {
      const name = nameBookDraw(china, rng);
      const [sur, first] = splitOnce(name);
      expect(china.surnames.includes(sur), name).toBe(true);
      expect([...china.male, ...china.female].includes(first), name).toBe(true);
    }
    const canada = names(d, "CAN");
    expect(canada.family_first).toBe(false);
    const name = nameBookDraw(canada, rng);
    const [first, sur] = splitOnce(name);
    expect([...canada.male, ...canada.female].includes(first)).toBe(true);
    expect(canada.surnames.includes(sur)).toBe(true);
  });

  it("trait_skill_effects_add_and_clamp", () => {
    const base: Skills = {
      finance: 29,
      operations: 5,
      persuasion: 5,
      intrigue: 1,
      tech: 5,
      hustle: 5,
    };
    // 1.1.2: Greedy +2 Finance, Honest -2 Intrigue, Ambitious +1 all, Gregarious +2 Persuasion.
    const eff = withTraitEffects(base, ["Greedy", "Honest"]);
    expect(eff.finance, "29 + 2 clamps at 30").toBe(30);
    expect(eff.intrigue, "1 - 2 clamps at 0").toBe(0);
    const amb = withTraitEffects(base, ["Ambitious", "Gregarious"]);
    expect([amb.operations, amb.persuasion, amb.tech]).toEqual([6, 8, 6]);
  });
});
