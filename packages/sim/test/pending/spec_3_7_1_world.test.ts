// BLOCKED: these two cases of crates/sim/tests/spec_3_7_1.rs need `worldFromData`, whose load
// calls still throw: market/state `stockAtLoad` (Stock::at_load, lane W2b market) is not ported.
// Promote them into spec_3_7_1.test.ts (next to the other cases) once market/state is on main.
// Port of crates/sim/tests/spec_3_7_1.rs (the two cases that load a World; the rest are in
// ../spec_3_7_1.test.ts).
import { describe, expect, it } from "vitest";
import { laborUnits, openSeats } from "../../src/ops/labor.ts";
import {
  nameBookForCountry,
  nameBooksBuild,
  nameBooksDistinct,
  nameBooksFromData,
  nameBooksGet,
  nameBooksLen,
} from "../../src/people/names.ts";
import { companySizeFromRevenue, generateSimple } from "../../src/people/simple.ts";
import type { CountryId } from "../../src/types/ids.ts";
import type { CompanySize, Seat, Skills } from "../../src/types/state/people.ts";
import { worldFromData } from "../../src/world/load.ts";
import { data, unwrap } from "../common/index.ts";
import { newRng } from "../common/rng.ts";

type SkillField = keyof Skills;
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

function within(v: number, [lo, hi]: R): boolean {
  return v >= lo && v <= hi;
}

describe("spec 3.7.1 simple characters (world load)", () => {
  it("name_books_are_cached_per_country_in_world_order_and_save", () => {
    const d = data();
    const world = unwrap(worldFromData(structuredClone(d)));
    const books = unwrap(
      nameBooksBuild(
        d,
        world.countries.map((c) => c.key),
      ),
    );
    expect(nameBooksLen(books)).toBe(world.countries.length);
    expect(books, "D4 order").toEqual(unwrap(nameBooksFromData(d)));
    expect(nameBooksDistinct(books), `${nameBooksDistinct(books)} distinct books`).toBeLessThan(40);
    world.countries.forEach((c, i) => {
      expect(nameBooksGet(books, i as CountryId), c.key).toEqual(nameBookForCountry(d, c.key));
    });
    // Saves load without the CSVs (D13): the cache round-trips through the save format. Rust used
    // postcard; the TS save is versioned JSON (D953).
    const back = JSON.parse(JSON.stringify(books));
    expect(back).toEqual(books);
  });

  it("every_starting_seat_can_be_filled", () => {
    // Spec 7.1: seats 1 to min(5, L), each with a generated simple character. With
    // company-start.csv gross assets that is 3,207 seats (16 companies have fewer than 5
    // labor units); design fix 200 notes the spec "about 2,700".
    const d = data();
    const world = unwrap(worldFromData(structuredClone(d)));
    const books = unwrap(nameBooksFromData(d));
    const rng = newRng(7);
    let seats = 0;
    d.companies.rows.forEach((co, i) => {
      const start = d.company_start.rows[i];
      const wco = world.companies[i];
      if (start === undefined || wco === undefined) throw new Error(`row ${i}`);
      expect([co.id, start.id]).toEqual([wco.key, co.id]);
      const ind = d.industries.rows.find((x) => x.name === co.industry);
      if (ind === undefined) throw new Error(`no industry ${co.industry}`);
      const labor = laborUnits(start.gross_assets_usd, ind.labor_value_usd);
      const book = nameBooksGet(books, wco.hq_country);
      if (book === null) throw new Error(`no book for ${wco.key}`);
      const size = companySizeFromRevenue(co.revenue_usd_m * 1.0e6);
      const entry = SPEC_SIZES.find((s) => s[0] === size);
      if (entry === undefined) throw new Error(`size ${size}`);
      const seatRange = entry[1];
      for (const seat of openSeats(labor)) {
        const c = generateSimple(rng, book, size, seat);
        for (const k of specSeatSkills(seat)) {
          expect(within(c.skills[k], seatRange)).toBe(true);
        }
        seats += 1;
      }
    });
    expect(seats).toBe(3207);
  });
});
