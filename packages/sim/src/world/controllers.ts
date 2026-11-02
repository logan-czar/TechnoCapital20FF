// The named controllers (spec 3.7.2 rows of characters.csv), kept as base characters (D989): the
// name, age, skills and the traits of the 12 pairs (D113). Nothing else of the row is read, and no
// character table is kept.

import type { WorldData } from "@tc20ff/sim-data";
import { traitFromName } from "../people/traits.ts";
import type { BaseCharacter, Skills, Trait } from "../types/state/people.ts";

/** Every row of characters.csv as a base character, by id. */
export function controllerBook(data: WorldData): Map<string, BaseCharacter> {
  const book = new Map<string, BaseCharacter>();
  for (const c of data.characters.rows) {
    const skills: Skills = {
      finance: c.finance,
      operations: c.operations,
      persuasion: c.persuasion,
      intrigue: c.intrigue,
      tech: c.tech,
      hustle: c.hustle,
    };
    const traits: Trait[] = [];
    for (const name of c.traits) {
      const t = traitFromName(name.trim());
      if (t !== null) traits.push(t);
    }
    book.set(c.id, { class: "Executive", name: c.name, age: c.age, skills, traits });
  }
  return book;
}
