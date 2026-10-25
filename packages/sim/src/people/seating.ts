// Board seating on the World (build-plan M3.2, M3.3): simple characters for the open labor seats
// at load (spec 7.1 "Board", 3.7.1) and for the seats a recount opens (5.10, 4.3 step 11), and
// the monthly management score (5.7). Ported from crates/sim/src/people/seating.rs.
//
// The formulas are lane F's (`generateSimple`, `managementScore`); this file reads the World,
// calls them in id order and writes the results back. Every draw is a gen-stream draw through the
// job's DrawSource, companies in id order and seats in opening order, so the seating is part of
// the seeded run.
//
import { MONTHS_PER_YEAR } from "../economy/index.ts";
import { trailingRevenue as financeTrailingRevenue } from "../finance/jobs.ts";
import { companyFinanceQuarters } from "../finance/state.ts";
import { openSeats } from "../ops/labor.ts";
import type { JobCtx } from "../time/scheduler.ts";
import type { DrawSource } from "../types/draws.ts";
import type { CompanyId } from "../types/ids.ts";
import { ordinal } from "../types/ids.ts";
import type { CompanySize, Seat } from "../types/state/people.ts";
import { SEAT_LABOR } from "../types/state/people.ts";
import type { Company, World } from "../types/world.ts";
import { type Board, boardDefault, boardSet, managementScore } from "./management.ts";
import { nameBooksGet } from "./names.ts";
import { companySizeFromRevenue, generateSimple } from "./simple.ts";

/**
 * Seats every company's open labor seats at load (spec 7.1 "Board": seats 1 to min(5, L), each
 * with a generated simple character; 3.7.1 size from the starting revenue), then sets every
 * management score. No full character sits at load: the named controllers own and do not hold
 * seats (design fix 200), so all 3,207 open seats get simple characters. Call once, after
 * `economy.start` (whose pop roll is the first gen-stream draw, D111).
 */
export function start(world: World, draws: DrawSource): void {
  for (let i = 0; i < world.companies.length; i++) {
    const id = ordinal<CompanyId>(i);
    const c = world.companies[i]!;
    const seats = [...openSeats(c.labor_units)];
    const size = companySizeFromRevenue(c.revenue_usd);
    for (const seat of seats) {
      seatSimple(world, id, seat, size, draws);
    }
  }
  setManagementScores(world);
}

/** Generates the simple character for `seat` of company `id` and seats it (spec 3.7.1). */
export function seatSimple(
  world: World,
  id: CompanyId,
  seat: Seat,
  size: CompanySize,
  draws: DrawSource,
): void {
  const country = world.companies[id]!.hq_country;
  const names = nameBooksGet(world.name_books, country);
  if (names === null) throw new Error("every country has a name book (checked at load)");
  const character = generateSimple(draws, names, size, seat);
  const sid = world.simple_characters_made;
  world.simple_characters_made += 1;
  const slot = seatIndex(seat);
  world.companies[id]!.board[slot] = { kind: "Simple", seat: { id: sid, character } };
}

/** The board index of a labor seat. */
export function seatIndex(seat: Seat): number {
  const i = (SEAT_LABOR as readonly Seat[]).indexOf(seat);
  if (i < 0) throw new Error("a labor seat");
  return i;
}

/**
 * Trailing annual revenue for the 3.7.1 size of a seat opened in play: the trailing four
 * quarters' revenue from the statements (D129, which replaces D116's run rate now that M4
 * keeps them); the run rate of the month just closed, 12 x its units' revenue, for a company
 * with no statements.
 */
export function trailingRevenue(world: World, company: Company): number {
  if (companyFinanceQuarters(company.finance).length === 0) {
    let sum = 0;
    for (const u of company.units) sum += world.units[u]!.revenue_m;
    return MONTHS_PER_YEAR * sum;
  }
  return financeTrailingRevenue(company);
}

/**
 * 4.3 step 11 (people part, after the economy's asset step): a simple character for each seat
 * this month's recount opened (spec 3.7.1, 5.10), companies in id order, seats in opening order.
 */
export function newSeatsJob(world: World, ctx: JobCtx): void {
  for (let i = 0; i < world.companies.length; i++) {
    const c = world.companies[i]!;
    if (c.seats_to_fill.length === 0) continue;
    const id = ordinal<CompanyId>(i);
    const seats = c.seats_to_fill;
    c.seats_to_fill = [];
    const size = companySizeFromRevenue(trailingRevenue(world, c));
    for (const seat of seats) {
      seatSimple(world, id, seat, size, ctx.draws);
    }
  }
}

/**
 * The 5.7 board of a company: each filled labor seat with its holder's drawn skills and traits
 * (simple or full); closed and waiting seats and the Chair count skill 3 (D205).
 */
export function boardOf(world: World, company: Company): Board {
  const board = boardDefault();
  for (let i = 0; i < company.board.length; i++) {
    const holder = company.board[i];
    if (holder === null || holder === undefined) continue;
    const seat = SEAT_LABOR[i] as Seat;
    if (holder.kind === "Simple") {
      boardSet(board, seat, { skills: holder.seat.character.skills, traits: holder.seat.character.traits });
    } else {
      const ch = world.characters[holder.character]!;
      boardSet(board, seat, { skills: ch.skills, traits: ch.traits });
    }
  }
  return board;
}

/** Sets every company's management score from its seated board (spec 5.7). */
export function setManagementScores(world: World): void {
  for (const c of world.companies) {
    c.management_score = managementScore(boardOf(world, c));
  }
}
