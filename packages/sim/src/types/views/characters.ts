// v_characters (crates/sim/src/views/characters.rs): `list_characters(filter)` and
// `get_character(id)` (spec 9.2; 3.7.1, 3.7.2; 8 Board tab founders' cards): the full characters
// (the 296 of characters.csv and those made in play) and the partial (simple) characters seated
// on boards, with name, age, skills, traits, home province and country (full characters only:
// 3.7.1 gives a simple character none), their roles (seats, directorships, control, owner of
// record, founder) and holdings (cap table lines, D425). Rebuilt monthly and at the plan lock
// (spec 9.4: seats fill at 4.3 step 11, casts at the lock, D159). Removed companies are left out
// of roles and holdings (5.12 step 3). A character's cash is private and not shown.
//
// Not ported: CharactersView::get, ::partial (binary search by CharacterRef), ::list, partial_row
// and the `ViewData` build (logic).

import type { CharacterId, CompanyId, CountryId, ProvinceId } from "../ids.ts";
import type { Seat, Skills, Trait } from "./shared.ts";

/**
 * Which character a row is: a full one by id, or a partial one by its 3.7.1 `id` (u32). Rust
 * derives `Ord`: every Full sorts before every Partial, then by id.
 */
export type CharacterRef = { kind: "Full"; id: CharacterId } | { kind: "Partial"; id: number };

/** A full character's home (spec 3.7.2 home province). */
export interface Home {
  province: ProvinceId;
  province_name: string;
  country: CountryId;
  country_name: string;
}

/** One thing a character does at a company. */
export type Role =
  /** A labor seat (spec 3.7). */
  | { kind: "Seat"; company: CompanyId; seat: Seat }
  /** A board seat with no labor unit (5.19.4 step 4). */
  | { kind: "Director"; company: CompanyId }
  /** The company's named controller (companies.csv, or a startup's lead founder, 5.19.3). */
  | { kind: "Controller"; company: CompanyId }
  /** companies.csv `owner_of_record` (D425). */
  | { kind: "OwnerOfRecord"; company: CompanyId }
  /** A founder of a born company (spec 3.5 `founders`), the lead first. */
  | { kind: "Founder"; company: CompanyId; lead: boolean };

/** Shares a character holds in one company (spec 3.5 `holders`; D425). */
export interface CharacterHolding {
  company: CompanyId;
  /** Whole number (u64). */
  shares: number;
  /** Share of the company's shares outstanding. */
  share: number;
}

/** One character. */
export interface CharacterRow {
  id: CharacterRef;
  /** characters.csv `id` for a full character from the data, empty otherwise. */
  key: string;
  name: string;
  /** u8. */
  age: number;
  skills: Skills;
  traits: Trait[];
  /**
   * A full character (3.7.2); false for a partial one (3.7.1; spec 8 "partial characters
   * are marked").
   */
  full: boolean;
  /** player, rival, holder or generated (full characters); empty for partial ones. */
  tier: string;
  home: Home | null;
  /** In company id order, then seat order. */
  roles: Role[];
  /** In company id order. */
  holdings: CharacterHolding[];
}

export interface CharactersView {
  /** Every full character, in character id order. */
  full: CharacterRow[];
  /** Every partial character seated now, in 3.7.1 id order. */
  partial: CharacterRow[];
}
