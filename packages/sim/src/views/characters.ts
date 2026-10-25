// v_characters: `list_characters(filter)` and `get_character(id)` (spec 9.2; 3.7.1, 3.7.2; 8 Board
// tab founders' cards): the full characters (the 296 of characters.csv and those made in play) and
// the partial (simple) characters seated on boards, with name, age, skills, traits, home province
// and country (full characters only: 3.7.1 gives a simple character none), their roles (seats,
// directorships, control, owner of record, founder) and holdings (cap table lines, D425). Rebuilt
// monthly and at the plan lock (spec 9.4: seats fill at 4.3 step 11, casts at the lock, D159).
// Removed companies are left out of roles and holdings (5.12 step 3). A character's cash is
// private and not shown. Ported from crates/sim/src/views/characters.rs; the types are in
// types/views/characters.ts.

import { companyFinanceStatus } from "../finance/state.ts";
import type { CharacterId, CompanyId } from "../types/ids.ts";
import { SEAT_LABOR } from "../types/state/people.ts";
import type { CharacterRef, CharacterRow, CharactersView, Role } from "../types/views/characters.ts";
import type { SimpleSeat } from "../types/world.ts";
import { controllerShares } from "./cap_table.ts";
import type { ViewInput } from "./index.ts";

/** `get_character(id)`. */
export function charactersViewGet(v: CharactersView, id: CharacterId): CharacterRow | undefined {
  return v.full[id];
}

/** Rust `CharacterRef`'s order: every Full before every Partial, then by id. */
export function cmpCharacterRef(a: CharacterRef, b: CharacterRef): number {
  if (a.kind !== b.kind) return a.kind === "Full" ? -1 : 1;
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

/** `list_characters(filter)`: full characters, then partial ones. */
export function charactersViewList(v: CharactersView): CharacterRow[] {
  return [...v.full, ...v.partial];
}

function partialRow(s: SimpleSeat, role: Role): CharacterRow {
  const ch = s.character;
  return {
    id: { kind: "Partial", id: s.id },
    key: "",
    name: ch.name,
    age: ch.age,
    skills: { ...ch.skills },
    traits: ch.traits.slice(),
    full: false,
    tier: "",
    home: null,
    roles: [role],
    holdings: [],
  };
}

/** Rust `ViewData::build`. */
export function buildCharacters(input: ViewInput): CharactersView {
  const w = input.world;
  const full: CharacterRow[] = w.characters.map((ch, i): CharacterRow => {
    const province = w.provinces[ch.home_province]!;
    return {
      id: { kind: "Full", id: i as CharacterId },
      key: ch.key,
      name: ch.name,
      age: ch.age,
      skills: { ...ch.skills },
      traits: ch.traits.slice(),
      full: true,
      tier: ch.tier,
      home: {
        province: ch.home_province,
        province_name: province.name,
        country: province.country,
        country_name: w.countries[province.country]!.name,
      },
      roles: [],
      holdings: [],
    };
  });
  const partial: CharacterRow[] = [];
  w.companies.forEach((c, ci) => {
    const company = ci as CompanyId;
    if (companyFinanceStatus(c.finance) === "Removed") return;
    c.board.forEach((holder, i) => {
      const role: Role = { kind: "Seat", company, seat: SEAT_LABOR[i]! };
      if (holder === null) return;
      if (holder.kind === "Full") full[holder.character]!.roles.push(role);
      else partial.push(partialRow(holder.seat, role));
    });
    for (const d of c.directors) {
      const role: Role = { kind: "Director", company };
      if (d.kind === "Full") full[d.character]!.roles.push(role);
      else partial.push(partialRow(d.seat, role));
    }
    if (c.controller !== null) full[c.controller]!.roles.push({ kind: "Controller", company });
    const owner = c.start_control?.owner_of_record ?? null;
    if (owner !== null) full[owner]!.roles.push({ kind: "OwnerOfRecord", company });
    c.founders.forEach((ch, i) => {
      full[ch]!.roles.push({ kind: "Founder", company, lead: i === 0 });
    });
    const total = Math.max(c.shares_out, 1);
    for (const h of c.holders) {
      let held: [CharacterId, number] | null = null;
      if (h.holder.kind === "Founder") held = [h.holder.character, h.shares];
      else if (h.holder.kind === "Existing") {
        const ctl = c.start_control?.controller;
        if (ctl !== undefined && ctl.kind === "Character")
          held = [ctl.character, controllerShares(c, h.shares)];
      }
      if (held !== null && held[1] > 0) {
        full[held[0]]!.holdings.push({ company, shares: held[1], share: held[1] / total });
      }
    }
  });
  // Rust `sort_by_key(|r| r.id)`: a stable sort, every row Partial here.
  partial.sort((a, b) => cmpCharacterRef(a.id, b.id));
  return { full, partial };
}
