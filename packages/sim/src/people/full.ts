// Full characters made in play by startup events (spec 3.7.2, 5.19.4). Ported from
// crates/sim/src/people/full.rs.

import type { DrawSource } from "../types/draws.ts";
import type { ProvinceId } from "../types/ids.ts";
import { maxF } from "../types/num.ts";
import type { NameBook, Seat, Skills, Trait } from "../types/state/people.ts";
import { SEAT_LABOR } from "../types/state/people.ts";
import { SKILL_KIND_ALL, type SkillKind, seatSkills, skillsDefault } from "./board.ts";
import { nameBookDrawUnique } from "./names.ts";
import { drawTrait, type Range, rangeDraw, rangeNew } from "./simple.ts";
import { TRAIT_ALL } from "./traits.ts";

/** Spec 3.7.2: the tier of a character made in play. */
export const GENERATED_TIER = "generated";
/** Spec 3.7.2: lead founder age 22 to 55. */
export const LEAD_AGE: Range = rangeNew(22, 55);
/** Spec 3.7.2: other founders 25 to 60. */
export const OTHER_AGE: Range = rangeNew(25, 60);
/** Spec 3.7.2: one best skill 10 to 18. */
export const BEST_SKILL: Range = rangeNew(10, 18);
/** Spec 3.7.2: one second skill 7 to 13. */
export const SECOND_SKILL: Range = rangeNew(7, 13);
/** Spec 3.7.2: the other four 2 to 9. */
export const OTHER_SKILLS: Range = rangeNew(2, 9);
/** Spec 3.7.2: 3 traits from the 12 pairs. */
export const FULL_TRAIT_COUNT = 3;
/**
 * Spec 3.7.2: home province is the startup's HQ province with this chance, else another province
 * of the HQ country by province weight.
 */
export const HOME_AT_HQ_CHANCE = 0.7;
/** Spec 3.7.2: cash_usd $0.1M to $1M (whole dollars, uniform, D204). */
export const CASH_MIN_USD = 100_000;
export const CASH_MAX_USD = 1_000_000;
/** characters.csv id prefix (spec 3.7.2 "Next CH- id"). */
export const CHARACTER_KEY_PREFIX = "CH-";

/**
 * A full character made in play (spec 3.7.2). The id, company and seat are kept by whoever stores
 * it; net worth adds the value of the stake (5.13) and is not stored here.
 */
export interface FullCharacter {
  name: string;
  age: number;
  skills: Skills;
  best: SkillKind;
  second: SkillKind;
  traits: [Trait, Trait, Trait];
  home_province: ProvinceId;
  cash_usd: number;
}

/** Always `GENERATED_TIER` (spec 3.7.2). Rust `FullCharacter::tier`. */
export function fullCharacterTier(_c: FullCharacter): string {
  return GENERATED_TIER;
}

/** What the generator needs about where the character lives (spec 3.7.2 home province). */
export interface HomeChoice {
  /** The startup's HQ province. */
  hq: ProvinceId;
  /**
   * The other provinces of the HQ country with their province weights (2-map 2.3.1), in id order.
   * Empty means the country has only the HQ province.
   */
  others: readonly (readonly [ProvinceId, number])[];
}

/**
 * Generates a full character cast for `seat` (spec 3.7.2, T). The best skill is the seat's skill;
 * for the CEO (always the lead founder in 5.19.4) it is one of Finance, Operations or Persuasion,
 * drawn uniformly; for a director (`seat` null, 5.19.4 step 4) any of the six, drawn uniformly
 * (D204). The second skill is drawn uniformly from the other five.
 *
 * Draw order (frozen, D204): name (`nameBookDrawUnique`), age, best skill pick (CEO and directors
 * only), second skill pick, the six skills in column order, the three traits, home province, cash.
 */
export function generateFull(
  draws: DrawSource,
  names: NameBook,
  taken: (name: string) => boolean,
  lead: boolean,
  seat: Seat | null,
  home: HomeChoice,
): FullCharacter {
  const name = nameBookDrawUnique(names, draws, taken);
  const age = rangeDraw(lead ? LEAD_AGE : OTHER_AGE, draws);
  let best: SkillKind;
  if (seat === null) {
    best = pickSkill(draws, SKILL_KIND_ALL);
  } else {
    const s = seatSkills(seat);
    best = s.kind === "One" ? s.skill : pickSkill(draws, s.skills);
  }
  const rest = SKILL_KIND_ALL.filter((k) => k !== best);
  const second = pickSkill(draws, rest);
  const skills = skillsDefault();
  for (const kind of SKILL_KIND_ALL) {
    const range = kind === best ? BEST_SKILL : kind === second ? SECOND_SKILL : OTHER_SKILLS;
    skills[kind] = rangeDraw(range, draws);
  }
  const traits: Trait[] = [];
  for (let i = 0; i < FULL_TRAIT_COUNT; i++) {
    traits.push(drawTrait(draws, TRAIT_ALL, traits));
  }
  const homeProvince = drawHome(draws, home);
  const cash = draws.intInclusive("Gen", CASH_MIN_USD, CASH_MAX_USD);
  return {
    name,
    age,
    skills,
    best,
    second,
    traits: [traits[0] as Trait, traits[1] as Trait, traits[2] as Trait],
    home_province: homeProvince,
    cash_usd: cash,
  };
}

function pickSkill(draws: DrawSource, pool: readonly SkillKind[]): SkillKind {
  return pool[draws.intInclusive("Gen", 0, pool.length - 1)] as SkillKind;
}

/**
 * The home province (spec 3.7.2): the HQ with `HOME_AT_HQ_CHANCE`, else another province of the HQ
 * country by weight. With no other province (or all weights 0) it is the HQ (D204). The weight
 * roll is skipped when the HQ wins, so the draw count varies.
 */
function drawHome(draws: DrawSource, home: HomeChoice): ProvinceId {
  if (draws.chance("Gen", HOME_AT_HQ_CHANCE)) return home.hq;
  let total = 0.0;
  for (const [, w] of home.others) total += maxF(w, 0.0);
  if (total <= 0.0) return home.hq;
  const target = draws.uniform("Gen") * total;
  let acc = 0.0;
  for (const [id, w] of home.others) {
    acc += maxF(w, 0.0);
    if (target < acc) return id;
  }
  const last = home.others[home.others.length - 1];
  return last === undefined ? home.hq : last[0];
}

/**
 * The seat a non-lead full character is cast for (spec 5.19.4 step 2, D204): uniform among the
 * open labor seats other than the CEO (the lead founder's), in seat order. null when none is open:
 * the character sits as a director (5.19.4 step 4) and is generated with `seat` null.
 */
export function pickCastSeat(draws: DrawSource, open: readonly Seat[]): Seat | null {
  const seats = SEAT_LABOR.filter((s) => s !== "Ceo" && open.includes(s));
  if (seats.length === 0) return null;
  const i = draws.intInclusive("Gen", 0, seats.length - 1);
  return seats[i] as Seat;
}

/**
 * The key of the `n`th character, 1-based (spec 3.7.2 "Next CH- id"; characters.csv uses CH-0001
 * to CH-0296).
 */
export function characterKey(n: number): string {
  return `${CHARACTER_KEY_PREFIX}${String(n).padStart(4, "0")}`;
}
