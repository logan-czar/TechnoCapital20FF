// The cast of a startup and where it sits (spec 5.19.4; Logan, batch 165): the event's partial
// characters (simple, 3.7.1), seated on the open labor seats, the rest as directors, and any labor
// seat still empty filled by 3.7.1. Full characters (founders, 3.7.2) are removed (D989). Ported
// from crates/sim/src/births/cast.rs.
//
// Draw order (D274; gen stream): each partial in turn; then a simple character for each labor
// seat still empty, in seat order.

import { openSeats } from "../ops/labor.ts";
import { LABOR_SEAT_COUNT, SEAT_LABOR } from "../people/board.ts";
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
  /** One of the event's partial characters (5.19.4 step 3). */
  | { kind: "Partial"; character: SimpleCharacter }
  /** A simple character for a labor seat the cast left empty (5.19.4 step 4, "filled by 3.7.1 as usual"). */
  | { kind: "Filler"; character: SimpleCharacter };

/** A startup's cast, seated (spec 5.19.4). */
export interface Cast {
  /**
   * The five labor seats in `SEAT_LABOR` order; null only for a seat that is closed (fewer than 5
   * labor units, D200).
   */
  seats: (CastSeat | null)[];
  /**
   * Directors: board seats with no labor unit and no effect in the MVP (5.19.4 step 4), in cast
   * order.
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
 * 1. Partial characters fill the labor seats still open, in seat order, each generated for its
 *    seat as for a small company; the rest are directors (drawn from the Chair's role list, D274).
 * 2. A labor seat still empty is filled by 3.7.1 as usual.
 *
 * `labor` opens min(5, L) seats (D200: a startup has 10 or more labor units, so all five).
 */
export function seatCast(draws: DrawSource, names: NameBook, labor: number, partial: number): Cast {
  const open = [...openSeats(labor)];
  const seats: (CastSeat | null)[] = new Array<CastSeat | null>(LABOR_SEAT_COUNT).fill(null);
  const directors: CastSeat[] = [];

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

  return { seats, directors };
}
