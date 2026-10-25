// Board seats and the six skills (spec 3.7; 1-corporate-core 1.1.1). Ported from
// crates/sim/src/people/board.rs. The `Skills`, `Seat`, `LABOR_SEAT_COUNT` and `SEAT_LABOR` types
// and constants are in types/state/people.ts.
//
// A `SkillKind` is the field name of `Skills` (Rust `Skills::get(SkillKind)` becomes `skills[kind]`).

import { SEAT_LABOR, type Seat, type Skills } from "../types/state/people.ts";

export type { Seat, Skills } from "../types/state/people.ts";
export { LABOR_SEAT_COUNT, SEAT_LABOR, SEAT_VALUES } from "../types/state/people.ts";

/** Lowest skill value (spec 3.7.1: skills run 0 to 30). */
export const SKILL_MIN = 0;
/** Highest skill value (spec 3.7.1). */
export const SKILL_MAX = 30;

/** One of the six skills (spec 3.7.1; 1-corporate-core 1.1.1): the `Skills` field name. */
export type SkillKind = keyof Skills;

/** All six, in the spec's column order (3.7.1). Generators draw in this order. Rust `SkillKind::ALL`. */
export const SKILL_KIND_ALL: readonly SkillKind[] = [
  "finance",
  "operations",
  "persuasion",
  "intrigue",
  "tech",
  "hustle",
];

/** Rust `Skills::default()`: all zero. */
export function skillsDefault(): Skills {
  return { finance: 0, operations: 0, persuasion: 0, intrigue: 0, tech: 0, hustle: 0 };
}

/** Rust `Skills::get`. */
export function skillsGet(s: Skills, kind: SkillKind): number {
  return s[kind];
}

/** Rust `Skills::set`. */
export function skillsSet(s: Skills, kind: SkillKind, value: number): void {
  s[kind] = value;
}

/** What a seat reads from its holder (spec 3.7; 10.5.1). */
export type SeatSkill = { kind: "One"; skill: SkillKind } | { kind: "Average"; skills: readonly SkillKind[] };

/** The CEO's three skills (spec 3.7). */
export const CEO_SKILLS: readonly SkillKind[] = ["finance", "operations", "persuasion"];

/**
 * The skill a seat uses (spec 3.7; 10.5.1): the CEO uses the average of Finance, Operations and
 * Persuasion.
 */
export function skillsSeatSkill(s: Skills, seat: Seat): number {
  const sk = seatSkills(seat);
  if (sk.kind === "One") return s[sk.skill];
  let sum = 0.0;
  for (const k of sk.skills) sum += s[k];
  return sum / sk.skills.length;
}

/** The skill the seat uses (spec 3.7 table; 10.5.1 for the Chair's Persuasion). Rust `Seat::skills`. */
export function seatSkills(seat: Seat): SeatSkill {
  switch (seat) {
    case "Ceo":
      return { kind: "Average", skills: CEO_SKILLS };
    case "Cfo":
      return { kind: "One", skill: "finance" };
    case "Cio":
      return { kind: "One", skill: "intrigue" };
    case "Cmo":
      return { kind: "One", skill: "persuasion" };
    case "Coo":
      return { kind: "One", skill: "operations" };
    case "Chair":
      return { kind: "One", skill: "persuasion" };
  }
}

/** The labor unit that opens this seat (1 to 5), or null for the Chair (spec 3.7). Rust `Seat::labor_unit`. */
export function seatLaborUnit(seat: Seat): number | null {
  const i = (SEAT_LABOR as readonly Seat[]).indexOf(seat);
  return i < 0 ? null : i + 1;
}

/** True for the five labor seats. Rust `Seat::is_labor`. */
export function seatIsLabor(seat: Seat): boolean {
  return seat !== "Chair";
}

/** Rust `Seat::index`: the position in enum order (CEO, CFO, CIO, CMO, COO, Chair). */
export function seatIndexInOrder(seat: Seat): number {
  switch (seat) {
    case "Ceo":
      return 0;
    case "Cfo":
      return 1;
    case "Cio":
      return 2;
    case "Cmo":
      return 3;
    case "Coo":
      return 4;
    case "Chair":
      return 5;
  }
}
