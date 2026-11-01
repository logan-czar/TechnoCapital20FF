// v_characters (crates/sim/src/views/characters.rs): the partial (simple) characters seated on
// boards (spec 9.2; 3.7.1; 8 Board tab), with name, age, skills, traits and their role. Rebuilt
// monthly and at the plan lock (spec 9.4: seats fill at 4.3 step 11, casts at the lock, D159).
// Removed companies are left out of roles (5.12 step 3). Full characters (the 296 of
// characters.csv and the founders startup events made) are removed (D989), so there is no home,
// holdings, controller, owner or founder role.
//
// Not ported: CharactersView::partial (binary search by CharacterRef), ::list, partial_row and
// the `ViewData` build (logic).

import type { CompanyId } from "../ids.ts";
import type { Seat, Skills, Trait } from "./shared.ts";

/** Which character a row is: a partial one by its 3.7.1 `id` (u32). */
export type CharacterRef = { kind: "Partial"; id: number };

/** One thing a character does at a company. */
export type Role =
  /** A labor seat (spec 3.7). */
  | { kind: "Seat"; company: CompanyId; seat: Seat }
  /** A board seat with no labor unit (5.19.4 step 4). */
  | { kind: "Director"; company: CompanyId };

/** One character. */
export interface CharacterRow {
  id: CharacterRef;
  name: string;
  /** u8. */
  age: number;
  skills: Skills;
  traits: Trait[];
  /** In company id order, then seat order. */
  roles: Role[];
}

export interface CharactersView {
  /** Every partial character seated now, in 3.7.1 id order. */
  partial: CharacterRow[];
}
