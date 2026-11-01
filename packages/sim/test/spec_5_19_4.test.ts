// Port of crates/sim/tests/spec_5_19_4.rs: spec 5.19.4 (the cast), build-plan M6.8, with full
// characters removed (D989): partials fill the open labor seats in order, the leftovers are
// directors, and no labor seat is left empty.
//
// Expects:
//   ../src/births/cast.ts      seatCast(draws, book, labor, partial) -> Cast { seats, directors },
//                                 castLaborSeatsFull(cast, labor) -> boolean [Cast::labor_seats_full].
//                                 CastSeat is { kind: "Partial"; character } | { kind: "Filler"; character }.
//   ../src/people/names.ts     nameBooksGet(books, country) -> NameBook | null [NameBooks::get]
//   ../src/lib.ts              simNew, simWorld
//
// Changed from the Rust: RngStreams::new(seed) is the new generator (D951). The cast checks are
// structural (who sits where, counts, same seed gives an equal cast) and hold for any draws.
// `seat_cast` takes a DrawSource, so each cast gets a fresh newRng(seed).
import { describe, expect, it } from "vitest";
import { type Cast, castLaborSeatsFull, seatCast } from "../src/births/cast.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { nameBooksGet } from "../src/people/names.ts";
import type { CountryId } from "../src/types/ids.ts";
import type { NameBook } from "../src/types/state/people.ts";
import { SEAT_LABOR } from "../src/types/state/people.ts";
import { data, unwrap } from "./common/index.ts";
import { newRng } from "./common/rng.ts";

function usaBook(): NameBook {
  const sim = unwrap(simNew(data(), 1), "Sim::new");
  const w = simWorld(sim);
  const usa = w.countries.findIndex((c) => c.key === "USA") as CountryId;
  const book = nameBooksGet(w.name_books, usa);
  if (book === null) throw new Error("no USA name book");
  return structuredClone(book);
}

function cast(seed: number, labor: number, partial: number): Cast {
  return seatCast(newRng(seed), usaBook(), labor, partial);
}

describe("spec 5.19.4 the cast", () => {
  it("two_partials_take_the_first_seats_and_fillers_the_rest", () => {
    // 2 partial on 50 labor units: partials take the CEO and CFO seats in seat order, and the CIO,
    // CMO and COO are filled by 3.7.1.
    const c = cast(1, 50, 2);
    expect(c.seats[0]?.kind).toBe("Partial");
    expect(c.seats[1]?.kind).toBe("Partial");
    expect(c.seats[2]?.kind).toBe("Filler");
    expect(c.seats[3]?.kind).toBe("Filler");
    expect(c.seats[4]?.kind).toBe("Filler");
    expect(c.directors.length).toBe(0);
    expect(castLaborSeatsFull(c, 50)).toBe(true);
    // Partials and fillers are small-company simple characters for their seat (5.19.4 step 3).
    c.seats.forEach((s, i) => {
      if (s === null || (s.kind !== "Partial" && s.kind !== "Filler")) throw new Error("a partial or filler");
      expect(s.character.seat).toBe(SEAT_LABOR[i]);
      expect(s.character.size).toBe("Small");
    });
  });

  it("extra_partials_sit_as_directors", () => {
    // 5 partial seat the five labor seats; 3 more are directors drawn from the Chair's role list.
    const c = cast(2, 100, 8);
    expect(c.seats.every((s) => s?.kind === "Partial")).toBe(true);
    expect(c.directors.length).toBe(3);
    expect(c.directors.every((d) => d.kind === "Partial" && d.character.seat === "Chair")).toBe(true);
  });

  it("few_labor_units_open_few_seats", () => {
    // D200: with L = 2 only the CEO and CFO open; the other partials sit as directors.
    const c = cast(3, 2, 4);
    expect(c.seats[0]?.kind).toBe("Partial");
    expect(c.seats[1]?.kind).toBe("Partial");
    expect(c.seats.slice(2).every((s) => s === null)).toBe(true);
    expect(c.directors.length).toBe(2);
    expect(castLaborSeatsFull(c, 2)).toBe(true);
  });

  it("same_seed_same_cast", () => {
    expect(cast(9, 50, 3)).toEqual(cast(9, 50, 3));
  });
});
