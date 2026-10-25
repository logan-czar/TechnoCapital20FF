// The cast of a startup and where it sits (spec 5.19.4; Logan, batch 165): the event's full
// characters (founders, 3.7.2) and partial characters (simple, 3.7.1), seated on the open labor
// seats, the rest as directors, and any labor seat still empty filled by 3.7.1. Ported from
// crates/sim/src/births/cast.rs.
//
// Draw order, frozen (D274; gen stream): the lead founder (CEO); each other founder in turn (its
// seat pick, `pickCastSeat`, then the character); each partial in turn; then a simple character
// for each labor seat still empty, in seat order.

import { openSeats } from "../ops/labor.ts";
import { LABOR_SEAT_COUNT, SEAT_LABOR } from "../people/board.ts";
import { type FullCharacter, generateFull, type HomeChoice, pickCastSeat } from "../people/full.ts";
import { generateSimple } from "../people/simple.ts";
import type { DrawSource } from "../types/draws.ts";
import type { CompanySize, NameBook, Seat, SimpleCharacter } from "../types/state/people.ts";

/** Spec 5.19.4 step 3: partial characters are generated as for a small company (3.7.1). */
export const CAST_SIZE: CompanySize = "Small";
/**
 * The role list a partial director is drawn from (D274): 3.7.1's row for the seats beyond the five
 * (Chair, General Counsel, Chief Strategy Officer).
 */
export const DIRECTOR_ROLE_SEAT: Seat = "Chair";

/** Who holds a startup's seat (spec 5.19.4). */
export type CastSeat =
  /** A founder: index into `Cast.founders` (0 is the lead). */
  | { kind: "Founder"; index: number }
  /** One of the event's partial characters (5.19.4 step 3). */
  | { kind: "Partial"; character: SimpleCharacter }
  /** A simple character for a labor seat the cast left empty (5.19.4 step 4, "filled by 3.7.1 as usual"). */
  | { kind: "Filler"; character: SimpleCharacter };

/** A startup's cast, seated (spec 5.19.4). */
export interface Cast {
  /** The full characters, lead founder first (3.5 `founders`). */
  founders: FullCharacter[];
  /**
   * The five labor seats in `SEAT_LABOR` order; null only for a seat that is closed (fewer than 5
   * labor units, D200).
   */
  seats: (CastSeat | null)[];
  /**
   * Directors: board seats with no labor unit and no effect in the MVP (5.19.4 step 4), in cast
   * order (founders, then partials).
   */
  directors: CastSeat[];
}

function seatIndex(seat: Seat): number {
  const i = (SEAT_LABOR as readonly Seat[]).indexOf(seat);
  if (i < 0) throw new Error("a labor seat");
  return i;
}

/** True if every open labor seat is held (build-plan M6.8 "no empty labor seat"; Rust `Cast::labor_seats_full`). */
export function castLaborSeatsFull(cast: Cast, labor: number): boolean {
  return openSeats(labor).every((s) => cast.seats[seatIndex(s)] !== null);
}

/**
 * Seats a startup's cast (spec 5.19.4):
 *
 * 1. The lead founder (the first full character) is CEO.
 * 2. Each other full character is cast for an open labor seat, picked uniformly among those still
 *    open other than the CEO's (D204), and made with that seat's skill as best; with none open it
 *    is a director.
 * 3. Partial characters fill the labor seats still open, in seat order, each generated for its
 *    seat as for a small company; the rest are directors (drawn from the Chair's role list, D274).
 * 4. A labor seat still empty is filled by 3.7.1 as usual.
 *
 * `labor` opens min(5, L) seats (D200: a startup has 10 or more labor units, so all five); `taken`
 * says whether a full name is already used in the world; names made in this cast are checked too.
 */
export function seatCast(
  draws: DrawSource,
  names: NameBook,
  taken: (name: string) => boolean,
  labor: number,
  full: number,
  partial: number,
  home: HomeChoice,
): Cast {
  const open = [...openSeats(labor)];
  const seats: (CastSeat | null)[] = new Array<CastSeat | null>(LABOR_SEAT_COUNT).fill(null);
  const directors: CastSeat[] = [];
  const founders: FullCharacter[] = [];

  for (let n = 0; n < full; n++) {
    const made = founders.map((f) => f.name);
    const isTaken = (name: string): boolean => taken(name) || made.some((m) => m === name);
    const still_open = open.filter((s) => seats[seatIndex(s)] === null);
    const seat: Seat | null =
      n === 0 ? (still_open.includes("Ceo") ? "Ceo" : null) : pickCastSeat(draws, still_open);
    const character = generateFull(draws, names, isTaken, n === 0, seat, home);
    founders.push(character);
    if (seat !== null) seats[seatIndex(seat)] = { kind: "Founder", index: n };
    else directors.push({ kind: "Founder", index: n });
  }

  for (let k = 0; k < partial; k++) {
    const next = open.find((s) => seats[seatIndex(s)] === null);
    if (next !== undefined) {
      const c = generateSimple(draws, names, CAST_SIZE, next);
      seats[seatIndex(next)] = { kind: "Partial", character: c };
    } else {
      const c = generateSimple(draws, names, CAST_SIZE, DIRECTOR_ROLE_SEAT);
      directors.push({ kind: "Partial", character: c });
    }
  }

  for (const s of open) {
    if (seats[seatIndex(s)] === null) {
      const c = generateSimple(draws, names, CAST_SIZE, s);
      seats[seatIndex(s)] = { kind: "Filler", character: c };
    }
  }

  return { founders, seats, directors };
}
