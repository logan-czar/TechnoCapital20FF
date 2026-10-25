// Port of crates/sim/tests/spec_5_19_4.rs: spec 5.19.4 (the cast) and 3.7.2 (full characters),
// build-plan M6.8: the lead founder is CEO, other founders take open labor seats with their seat's
// skill as best, partials fill the rest, the leftovers are directors, and no labor seat is left
// empty.
//
// Expects:
//   ../src/births/cast.ts      seatCast(draws, book, taken(name) -> boolean, labor, full,
//                                 partial, home: HomeChoice) -> Cast { founders, seats,
//                                 directors }, castLaborSeatsFull(cast, labor) -> boolean
//                                 [Cast::labor_seats_full]. CastSeat is a tagged union:
//                                 { kind: "Founder"; index } | { kind: "Partial"; simple } |
//                                 { kind: "Filler"; simple } where simple is a SimpleSeat-like
//                                 { seat: Seat, size: CompanySize, ... }. The Rust enum has tuple
//                                 variants, so the payload names `index` and `simple` are this
//                                 file's guess; rename here if the port picks others.
//                                 Founder { name, best, age, home_province, cash_usd, ... }
//   ../src/people/board.ts     CEO_SKILLS, seatSkills(seat) -> { kind: "One", skill } |
//                                 { kind: "Average", skills }                    [Seat::skills]
//   ../src/people/full.ts      type HomeChoice { hq, others: [ProvinceId, weight][] }
//   ../src/people/names.ts     nameBooksGet(books, country) -> NameBook | null
//                                 [NameBooks::get]
//   ../src/lib.ts              simNew, simWorld
//
// Changed from the Rust: RngStreams::new(seed) is the new generator (D951). The cast checks are
// structural (who sits where, counts, ranges, same seed gives an equal cast) and hold for any
// draws; the home-province and cash ranges are the spec's. `seat_cast` takes a DrawSource, so each
// cast gets a fresh newRng(seed).
import { describe, expect, it } from "vitest";
import { type Cast, castLaborSeatsFull, seatCast } from "../src/births/cast.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { CEO_SKILLS, seatSkills } from "../src/people/board.ts";
import type { HomeChoice } from "../src/people/full.ts";
import { nameBooksGet } from "../src/people/names.ts";
import type { CountryId, ProvinceId } from "../src/types/ids.ts";
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

function cast(
  seed: number,
  labor: number,
  full: number,
  partial: number,
  taken: (n: string) => boolean,
): Cast {
  const book = usaBook();
  const home: HomeChoice = {
    hq: 1 as ProvinceId,
    others: [
      [2 as ProvinceId, 1.0],
      [3 as ProvinceId, 3.0],
    ],
  };
  return seatCast(newRng(seed), book, taken, labor, full, partial, home);
}

function bestMatchesSeat(c: Cast): void {
  c.seats.forEach((holder, i) => {
    if (holder !== null && holder.kind === "Founder") {
      const f = c.founders[holder.index];
      if (f === undefined) throw new Error("founder index out of range");
      const skills = seatSkills(SEAT_LABOR[i] as (typeof SEAT_LABOR)[number]);
      if (skills.kind === "One") expect(f.best).toBe(skills.skill);
      else expect(CEO_SKILLS).toContain(f.best);
    }
  });
}

describe("spec 5.19.4 the cast", () => {
  it("garage_founder_cast", () => {
    // 1 full, 2 partial on 50 labor units: the founder is CEO, partials take the CFO and CIO seats
    // in seat order, and the CMO and COO are filled by 3.7.1.
    const c = cast(1, 50, 1, 2, () => false);
    expect(c.founders.length).toBe(1);
    expect(c.seats[0]).toEqual({ kind: "Founder", index: 0 });
    expect(c.seats[1]?.kind).toBe("Partial");
    expect(c.seats[2]?.kind).toBe("Partial");
    expect(c.seats[3]?.kind).toBe("Filler");
    expect(c.seats[4]?.kind).toBe("Filler");
    expect(c.directors.length).toBe(0);
    expect(castLaborSeatsFull(c, 50)).toBe(true);
    bestMatchesSeat(c);
    // Partials and fillers are small-company simple characters for their seat (5.19.4 step 3).
    c.seats.forEach((s, i) => {
      if (i === 0) return;
      if (s === null || (s.kind !== "Partial" && s.kind !== "Filler")) throw new Error("a partial or filler");
      expect(s.character.seat).toBe(SEAT_LABOR[i]);
      expect(s.character.size).toBe("Small");
    });
    // 3.7.2: the lead founder is 22 to 55.
    const age = (c.founders[0] as (typeof c.founders)[number]).age;
    expect(age >= 22 && age <= 55).toBe(true);
  });

  it("backed_venture_fills_every_seat_with_founders_and_directors", () => {
    // 5 full and 5 partial: the lead is CEO, the other four take the four other seats (each cast
    // for its seat, D204), so every partial sits as a director.
    const c = cast(2, 100, 5, 5, () => false);
    expect(c.founders.length).toBe(5);
    const founders = c.seats.map((s) => {
      if (s === null || s.kind !== "Founder") throw new Error(`not a founder: ${JSON.stringify(s)}`);
      return s.index;
    });
    founders.sort((a, b) => a - b);
    expect(founders).toEqual([0, 1, 2, 3, 4]);
    expect(c.seats[0]).toEqual({ kind: "Founder", index: 0 });
    expect(c.directors.length).toBe(5);
    expect(c.directors.every((d) => d.kind === "Partial" && d.character.seat === "Chair")).toBe(true);
    bestMatchesSeat(c);
    // Names are unique within the cast.
    const names = c.founders.map((f) => f.name);
    expect(new Set(names).size).toBe(5);
  });

  it("few_labor_units_open_few_seats", () => {
    // D200: with L = 2 only the CEO and CFO open; a third founder sits as a director with any best
    // skill (5.19.4 step 4).
    const c = cast(3, 2, 3, 1, () => false);
    expect(c.seats[0]).toEqual({ kind: "Founder", index: 0 });
    expect(c.seats[1]).toEqual({ kind: "Founder", index: 1 });
    expect(c.seats.slice(2).every((s) => s === null)).toBe(true);
    expect(c.directors.length).toBe(2);
    expect(c.directors[0]).toEqual({ kind: "Founder", index: 2 });
    expect(c.directors[1]?.kind).toBe("Partial");
    expect(castLaborSeatsFull(c, 2)).toBe(true);
  });

  it("names_avoid_taken_and_same_seed_same_cast", () => {
    const a = cast(9, 50, 3, 3, () => false);
    const b = cast(9, 50, 3, 3, () => false);
    expect(a).toEqual(b);
    // A taken name is never reused for a founder.
    const first = (a.founders[0] as (typeof a.founders)[number]).name;
    const c = cast(9, 50, 3, 3, (n) => n === first);
    expect(c.founders.every((f) => f.name !== first)).toBe(true);
    // Home province: the HQ or another province of the HQ country (3.7.2).
    for (const f of a.founders) {
      expect([1, 2, 3]).toContain(f.home_province);
      expect(f.cash_usd >= 100_000.0 && f.cash_usd <= 1_000_000.0).toBe(true);
    }
  });
});
