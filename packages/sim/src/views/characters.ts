// v_characters (crates/sim/src/views/characters.rs): the partial (simple) characters seated on
// boards, with name, age, skills, traits and their role (spec 9.2; 3.7.1; 8 Board tab). Rebuilt
// monthly and at the plan lock (spec 9.4: seats fill at 4.3 step 11, casts at the lock, D159).
// Removed companies are left out of roles (5.12 step 3). Full characters are removed (D989).
// Ported from crates/sim/src/views/characters.rs; the types are in types/views/characters.ts.

import { companyFinanceStatus } from "../finance/state.ts";
import type { CompanyId } from "../types/ids.ts";
import { SEAT_LABOR } from "../types/state/people.ts";
import type { CharacterRef, CharacterRow, CharactersView, Role } from "../types/views/characters.ts";
import type { SimpleSeat } from "../types/world.ts";
import type { ViewInput } from "./index.ts";

/** Rust `CharacterRef`'s order: by id. */
export function cmpCharacterRef(a: CharacterRef, b: CharacterRef): number {
  return a.id - b.id;
}

/** A partial character by its 3.7.1 id (the rows are sorted by id: a binary search). */
export function charactersViewPartial(v: CharactersView, id: number): CharacterRow | undefined {
  const key: CharacterRef = { kind: "Partial", id };
  let lo = 0;
  let hi = v.partial.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const c = cmpCharacterRef(v.partial[mid]!.id, key);
    if (c === 0) return v.partial[mid];
    if (c < 0) lo = mid + 1;
    else hi = mid;
  }
  return undefined;
}

/** `list_characters(filter)`. */
export function charactersViewList(v: CharactersView): CharacterRow[] {
  return [...v.partial];
}

function partialRow(s: SimpleSeat, role: Role): CharacterRow {
  const ch = s.character;
  return {
    id: { kind: "Partial", id: s.id },
    name: ch.name,
    age: ch.age,
    skills: { ...ch.skills },
    traits: ch.traits.slice(),
    roles: [role],
  };
}

/** Rust `ViewData::build`. */
export function buildCharacters(input: ViewInput): CharactersView {
  const w = input.world;
  const partial: CharacterRow[] = [];
  w.companies.forEach((c, ci) => {
    const company = ci as CompanyId;
    if (companyFinanceStatus(c.finance) === "Removed") return;
    c.board.forEach((holder, i) => {
      const role: Role = { kind: "Seat", company, seat: SEAT_LABOR[i]! };
      if (holder === null) return;
      partial.push(partialRow(holder.seat, role));
    });
    for (const d of c.directors) {
      const role: Role = { kind: "Director", company };
      partial.push(partialRow(d.seat, role));
    }
  });
  // Rust `sort_by_key(|r| r.id)`: a stable sort.
  partial.sort((a, b) => cmpCharacterRef(a.id, b.id));
  return { partial };
}
