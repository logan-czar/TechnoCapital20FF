// People types the World holds (spec 3.7, 3.7.1, 3.7.2; 1-corporate-core 1.1.1, 1.1.2). Ported
// from crates/sim/src/people/: board.rs (Skills, Seat, LABOR_SEAT_COUNT), traits.rs (Trait),
// simple.rs (CompanySize, SimpleCharacter) and names.rs (NameBook, NameBooks). Types only.
//
// Not ported (logic and types no World field reaches): board.rs SkillKind, SeatSkill,
// CEO_SKILLS, SKILL_MIN/SKILL_MAX, Seat::{skills, labor_unit, is_labor}, Skills::{get, set,
// seat_skill}; traits.rs TRAIT_PAIR_COUNT, Trait::{opposite, pair, name, from_name,
// skill_effects, management_shift}, the *_MANAGEMENT_SHIFT constants, no_opposite_pair and
// with_trait_effects; simple.rs Range, SizeRanges and the size tables, the role trait lists,
// CompanySize::from_revenue and the simple character draw; names.rs NameBook::{from_rows,
// for_country, draw, draw_unique}, NameBooks::{build, from_data, get, len, is_empty, distinct},
// NoNameBook, FEMALE_CHANCE, UNIQUE_NAME_TRIES; full.rs
// (FullCharacter, HomeChoice and the full character draw: the World keeps a full character as
// world `Character`); management.rs (Member, Board and the management score); seating.rs.

// ---------------------------------------------------------------- board.rs

/** A character's six skills, 0 to 30 each (spec 3.7.1, 3.7.2). Each a u8. */
export interface Skills {
  finance: number;
  operations: number;
  persuasion: number;
  intrigue: number;
  tech: number;
  hustle: number;
}

/**
 * A board seat (spec 3.7). The five labor seats open with labor units 1 to 5 in this order
 * (CEO, CFO, CIO, CMO, COO; spec 3.7 "A for order"); the Chair is a non-labor seat, empty in
 * the MVP, kept so the management score can name it (5.7).
 */
export type Seat = "Ceo" | "Cfo" | "Cio" | "Cmo" | "Coo" | "Chair";

/** Every seat in Rust enum order (`Seat::index`; the derived Ord). */
export const SEAT_VALUES = ["Ceo", "Cfo", "Cio", "Cmo", "Coo", "Chair"] as const;

/** Number of labor seats (spec 3.7: labor units 1 to 5): the length of `Company.board`. */
export const LABOR_SEAT_COUNT = 5;

/** The labor seats in opening order: labor unit 1 opens the CEO, 5 the COO (spec 3.7; `Seat::LABOR`). */
export const SEAT_LABOR = ["Ceo", "Cfo", "Cio", "Cmo", "Coo"] as const;

// ---------------------------------------------------------------- traits.rs

/**
 * One of the 24 traits of the 12 pairs (1-corporate-core 1.1.2). Each pair is listed first
 * trait then opposite, in the 1.1.2 table order.
 */
export type Trait =
  | "Ambitious"
  | "Content"
  | "Greedy"
  | "Generous"
  | "Paranoid"
  | "Trusting"
  | "Ruthless"
  | "Compassionate"
  | "Visionary"
  | "Conservative"
  | "Honest"
  | "Deceitful"
  | "Brave"
  | "Cautious"
  | "Diligent"
  | "Lazy"
  | "Hedonist"
  | "Ascetic"
  | "Zealot"
  | "Cynic"
  | "Narcissist"
  | "Humble"
  | "Gregarious"
  | "Shy";

/** The traits in Rust enum order (`Trait::ALL`; pairs adjacent: index 2k and 2k + 1 are opposites). */
export const TRAIT_VALUES = [
  "Ambitious",
  "Content",
  "Greedy",
  "Generous",
  "Paranoid",
  "Trusting",
  "Ruthless",
  "Compassionate",
  "Visionary",
  "Conservative",
  "Honest",
  "Deceitful",
  "Brave",
  "Cautious",
  "Diligent",
  "Lazy",
  "Hedonist",
  "Ascetic",
  "Zealot",
  "Cynic",
  "Narcissist",
  "Humble",
  "Gregarious",
  "Shy",
] as const;

// ---------------------------------------------------------------- simple.rs

/**
 * Company size for character generation (spec 3.7.1), from trailing annual revenue (starting
 * revenue at load): Small under $100M, Mid $100M to $10B, Large $10B and up (D202).
 */
export type CompanySize = "Small" | "Mid" | "Large";

/** CompanySize in declaration (Ord) order. */
export const COMPANY_SIZE_VALUES = ["Small", "Mid", "Large"] as const;

/**
 * A simple character (spec 3.7.1). The id, company and seat are kept by whoever stores it
 * (`seat` is here because the draw depends on it).
 */
export interface SimpleCharacter {
  name: string;
  /** Whole number (u8). */
  age: number;
  /**
   * The skills as drawn (spec 3.7.1); traits.rs `with_trait_effects` adds the traits' skill
   * effects for rolls.
   */
  skills: Skills;
  /** One or two role traits, never an opposite pair. */
  traits: Trait[];
  seat: Seat;
  size: CompanySize;
}

// ---------------------------------------------------------------- names.rs

/** The name parts of one culture (spec 3.7.1), in file order. */
export interface NameBook {
  culture: string;
  /** The surname comes first (as world-gen gen.py `person_name` does). */
  family_first: boolean;
  male: string[];
  female: string[];
  surnames: string[];
}

/**
 * One NameBook per country, built once at load and stored on the World (spec 3.7.1, 3.7.2;
 * D203, D13). Countries sharing a superregion and culture share one book. Both fields are
 * private in Rust.
 */
export interface NameBooks {
  /** Distinct books, in the order first needed. */
  books: NameBook[];
  /** For each country ordinal, its index in `books` (u32). */
  by_country: number[];
}
