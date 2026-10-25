// Port of crates/sim/tests/spec_3_7_2.rs: spec 3.7.2 full characters made in play (build-plan
// M3.2): skill, age and cash ranges hold, three traits with no opposite pair, a unique name, and
// the same draws for a fixed seed.
//
// The ranges and pairs below are copied from the spec text, not read from the code.
//
// Expects (Rust methods are free functions named type + method, camelCased):
//   ../../src/people/full.ts   generateFull(rng, names, taken, lead, seat | null, home) ->
//                              FullCharacter { name, age, skills, traits, cash_usd,
//                              home_province }, HomeChoice { hq, others: [ProvinceId, weight][] },
//                              pickCastSeat(rng, open) -> Seat | null, characterKey(n) -> string,
//                              fullCharacterTier(c) -> string  [FullCharacter::tier]
//                              (taken is a (name) => boolean callback; Option<Seat> is Seat | null)
//   ../../src/people/names.ts  nameBookForCountry(data, iso3) -> NameBook | null
//   ./common/rng.ts            newRng
// Trait values are their names (string union).
//
// Changed from the Rust: the seeded RNG is new (D951), so seeds 165, 3, 8, 9 and 1 draw other
// values than in Rust. Every assertion is a range, a rate with the Rust tolerance or a
// determinism check.
import { describe, expect, it } from "vitest";
import {
  characterKey,
  fullCharacterTier,
  generateFull,
  type HomeChoice,
  pickCastSeat,
} from "../src/people/full.ts";
import { nameBookForCountry } from "../src/people/names.ts";
import type { ProvinceId } from "../src/types/ids.ts";
import { SEAT_LABOR, type Seat, type Skills } from "../src/types/state/people.ts";
import { data } from "./common/index.ts";
import { newRng } from "./common/rng.ts";

type SkillField = keyof Skills;
const ALL_SKILLS: readonly SkillField[] = [
  "finance",
  "operations",
  "persuasion",
  "intrigue",
  "tech",
  "hustle",
];

type R = readonly [number, number];

/** Spec 3.7.2: one best skill 10 to 18, one second skill 7 to 13, the other four 2 to 9. */
const SPEC_BEST: R = [10, 18];
const SPEC_SECOND: R = [7, 13];
const SPEC_OTHER: R = [2, 9];
/** Spec 3.7.2: lead founder 22 to 55, others 25 to 60; cash 0.1M to 1M dollars. */
const SPEC_LEAD_AGE: R = [22, 55];
const SPEC_OTHER_AGE: R = [25, 60];
const SPEC_CASH: R = [100_000.0, 1_000_000.0];

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

function within(v: number, [lo, hi]: R): boolean {
  return v >= lo && v <= hi;
}

/**
 * Checks a full character skills against the 3.7.2 rule with the best skill one of bestPool:
 * some skill of the pool is in the best range, and the other five hold one second skill (7 to
 * 13) and four others (2 to 9).
 */
function specSkillsOk(skills: Skills, bestPool: readonly SkillField[]): boolean {
  return bestPool.some((best) => {
    if (!within(skills[best], SPEC_BEST)) return false;
    const rest = ALL_SKILLS.filter((k) => k !== best);
    return rest.some(
      (second) =>
        within(skills[second], SPEC_SECOND) &&
        rest.filter((k) => k !== second).every((k) => within(skills[k], SPEC_OTHER)),
    );
  });
}

const HQ = 10 as ProvinceId;
const OTHERS: readonly (readonly [ProvinceId, number])[] = [
  [11 as ProvinceId, 1.0],
  [12 as ProvinceId, 3.0],
  [13 as ProvinceId, 0.0],
];

function home(others: readonly (readonly [ProvinceId, number])[]): HomeChoice {
  return { hq: HQ, others: others.map(([p, w]) => [p, w] as [ProvinceId, number]) };
}

function book(iso3: string) {
  const b = nameBookForCountry(data(), iso3);
  if (b === null) throw new Error(`no name book for ${iso3}`);
  return b;
}

describe("spec 3.7.2 full characters", () => {
  it("ranges_and_traits_hold_over_many_draws", () => {
    const names = book("USA");
    const taken = (_name: string): boolean => false;
    const h = home(OTHERS);
    const rng = newRng(165);
    let atHq = 0;
    const homes = [0, 0, 0, 0];
    let finLo = false;
    let finHi = false;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const lead = i % 2 === 0;
      const seat: Seat | null = lead ? "Ceo" : ((["Cfo", "Coo", null] as const)[i % 3] ?? null);
      const c = generateFull(rng, names, taken, lead, seat, h);
      const age = lead ? SPEC_LEAD_AGE : SPEC_OTHER_AGE;
      expect(within(c.age, age), `age ${c.age}`).toBe(true);
      const pool: readonly SkillField[] =
        seat === "Ceo"
          ? ["finance", "operations", "persuasion"]
          : seat === "Cfo"
            ? ["finance"]
            : seat === "Coo"
              ? ["operations"]
              : ALL_SKILLS;
      expect(specSkillsOk(c.skills, pool), `${seat} ${JSON.stringify(c.skills)}`).toBe(true);
      if (seat === "Cfo") {
        finLo ||= c.skills.finance === SPEC_BEST[0];
        finHi ||= c.skills.finance === SPEC_BEST[1];
      }
      const traits: string[] = [...c.traits];
      expect(traits.length, "3 traits").toBe(3);
      const inPairs = (t: string): boolean => SPEC_PAIRS.some(([a, b]) => a === t || b === t);
      expect(traits.every(inPairs), JSON.stringify(traits)).toBe(true);
      expect(
        SPEC_PAIRS.some(([a, b]) => traits.includes(a) && traits.includes(b)),
        JSON.stringify(traits),
      ).toBe(false);
      expect(new Set(traits).size).toBe(3);
      expect(c.cash_usd >= SPEC_CASH[0] && c.cash_usd <= SPEC_CASH[1]).toBe(true);
      expect(fullCharacterTier(c)).toBe("generated");
      atHq += c.home_province === HQ ? 1 : 0;
      const slot = c.home_province - 10;
      homes[slot] = (homes[slot] ?? 0) + 1;
    }
    expect(finLo && finHi, "the whole best range is drawn").toBe(true);
    const share = atHq / n;
    expect(Math.abs(share - 0.7) < 0.03, `home at HQ ${share}`).toBe(true);
    expect(homes[3], "a weight-0 province is never home").toBe(0);
    const ratio = (homes[2] ?? 0) / (homes[1] ?? 1);
    expect(Math.abs(ratio - 3.0) < 0.6, `weights 1 and 3: ${ratio}`).toBe(true);
  });

  it("names_are_unique_against_taken_ones", () => {
    const d = data();
    const names = book("CAN");
    const existing: string[] = d.characters.rows.map((c) => c.name);
    const made: string[] = [];
    const rng = newRng(3);
    for (let i = 0; i < 300; i++) {
      const taken = (n: string): boolean => existing.includes(n) || made.includes(n);
      const c = generateFull(rng, names, taken, false, "Cmo", home([]));
      expect(taken(c.name), c.name).toBe(false);
      expect(c.home_province, "no other province: home is the HQ").toBe(HQ);
      made.push(c.name);
    }
    // With every plain name taken the generator falls back to a numeral suffix (D203).
    const allTaken = (n: string): boolean => !n.endsWith(" II");
    const c = generateFull(rng, names, allTaken, true, "Ceo", home([]));
    expect(c.name.endsWith(" II"), c.name).toBe(true);
  });

  it("deterministic_for_a_fixed_seed", () => {
    const names = book("IND");
    const run = (seed: number) => {
      const rng = newRng(seed);
      const h = home(OTHERS);
      return Array.from({ length: 100 }, (_, i) => generateFull(rng, names, () => false, i === 0, "Cio", h));
    };
    expect(run(8)).toEqual(run(8));
    expect(run(8)).not.toEqual(run(9));
  });

  it("cast_seats_and_keys", () => {
    const rng = newRng(1);
    const open: readonly Seat[] = SEAT_LABOR;
    for (let i = 0; i < 200; i++) {
      const s = pickCastSeat(rng, open);
      expect(s).not.toBeNull();
      expect(s, "the CEO seat is the lead founder").not.toBe("Ceo");
    }
    expect(pickCastSeat(rng, ["Ceo"]), "a director").toBeNull();
    expect(pickCastSeat(rng, ["Coo"])).toBe("Coo");
    expect(characterKey(297)).toBe("CH-0297");
  });
});
