// Board-seat events (drift plan lane W, spec v1.5 5.21, D1024). Each plan lock, under a profile with
// `seat_events`, every open labor seat of every company not frozen rolls d30 plus the seat's skill
// (5.7's seat skill; an open seat with no holder counts 3) against a difficulty that rises with the
// log of the company's trailing revenue. A success helps and a failure hurts, through its role:
// the CEO the growth plan, the CFO the line rate, the CIO productivity and held data (at once), the
// CMO revenue and the COO the variable cost share. Gains shrink with size and harms grow with it.
// Every effect but the CIO's is a temporary multiplier that fades over a few plan locks, so events
// steer the trend without breaking the books. A natural 30 or 1 is critical (doubled), and a big
// company's critical roll posts a Wire headline (5.18). All draws are on the Events stream.

import { companyIsFrozen } from "../economy/index.ts";
import { profileOf } from "../economy/profiles.ts";
import { newsWireQueue, seatEvent } from "../news.ts";
import { PRODUCTIVITY_MAX, PRODUCTIVITY_MIN } from "../ops/productivity.ts";
import { EMPTY_SEAT_SKILL, memberSkill } from "../people/management.ts";
import { trailingRevenue } from "../people/seating.ts";
import type { JobCtx } from "../time/scheduler.ts";
import type { CompanyId } from "../types/ids.ts";
import { log10F } from "../types/libm.ts";
import { clamp, maxF } from "../types/num.ts";
import type { SeatEffect, SeatEffectKind, SeatTally } from "../types/state/events.ts";
import { LABOR_SEAT_COUNT, SEAT_LABOR, type Seat } from "../types/state/people.ts";
import type { Company, World } from "../types/world.ts";

/** The die each seat rolls (drift plan: d30, T). */
export const SEAT_DIE = 30;
/** The difficulty for a company with $100M of trailing revenue (T; fitted to 2020's seat skills). */
export const SEAT_DC_AT_100M = 13.0;
/** The difficulty added per tenfold of trailing revenue (T). */
export const SEAT_DC_PER_DECADE = 8.5;
/** log10 of $100M, where the difficulty is SEAT_DC_AT_100M and the size position is 0. */
export const SEAT_SIZE_FROM_LOG10 = 8.0;
/** Tenfolds from $100M to $100B, where the size position is 1. */
export const SEAT_SIZE_DECADES = 3.0;
/** Revenue under this counts as this for the difficulty (a newborn has none). */
export const SEAT_MIN_REVENUE_USD = 1e6;
/** A success's scale for the smallest and the largest company (gains shrink with size, T). */
export const SEAT_SUCCESS_SMALL = 1.5;
export const SEAT_SUCCESS_LARGE = 0.5;
/** A failure's scale for the smallest and the largest company (harms grow with size, T). */
export const SEAT_FAILURE_SMALL = 0.5;
export const SEAT_FAILURE_LARGE = 1.5;
/** A natural 30 or 1 doubles the outcome (T). */
export const SEAT_CRITICAL_SCALE = 2.0;
/** The CEO's effect on the growth plan, a fraction a year, and the plan locks it fades over (T). */
export const SEAT_CEO_GROWTH = 0.04;
export const SEAT_CEO_QUARTERS = 4;
/** The CFO's effect on the line rate, a fraction a year (a success lowers it), and its plan locks (T). */
export const SEAT_CFO_SPREAD = 0.005;
export const SEAT_CFO_QUARTERS = 4;
/** The CMO's effect on revenue, a fraction, and its plan locks (T). */
export const SEAT_CMO_REVENUE = 0.03;
export const SEAT_CMO_QUARTERS = 4;
/** The COO's effect on the variable cost share, a fraction of revenue, and its plan locks (T). */
export const SEAT_COO_MARGIN = 0.015;
export const SEAT_COO_QUARTERS = 3;
/** The CIO's productivity points and share of held data, applied at once (T). */
export const SEAT_CIO_PRODUCTIVITY = 4.0;
export const SEAT_CIO_DATA_SHARE = 0.1;
/** A critical roll posts a headline from this much trailing revenue (T). */
export const SEAT_HEADLINE_MIN_REVENUE_USD = 50e9;

/** The difficulty a seat of a company with `revenue` of trailing revenue rolls against. */
export function seatDifficulty(revenue: number): number {
  return (
    SEAT_DC_AT_100M +
    SEAT_DC_PER_DECADE * (log10F(maxF(revenue, SEAT_MIN_REVENUE_USD)) - SEAT_SIZE_FROM_LOG10)
  );
}

/** Where a company sits from $100M (0) to $100B (1) of trailing revenue. */
export function sizePosition(revenue: number): number {
  return clamp(
    (log10F(maxF(revenue, SEAT_MIN_REVENUE_USD)) - SEAT_SIZE_FROM_LOG10) / SEAT_SIZE_DECADES,
    0.0,
    1.0,
  );
}

/** Whether a roll passes: a natural 30 always does, a natural 1 never, else roll + skill ≥ difficulty. */
export function seatPasses(roll: number, skill: number, difficulty: number): boolean {
  if (roll === SEAT_DIE) return true;
  if (roll === 1) return false;
  return roll + skill >= difficulty;
}

/** The signed outcome of a roll, 1 being a success's base size: scaled by size and criticals. */
export function seatOutcome(success: boolean, critical: boolean, size: number): number {
  const scale = success
    ? SEAT_SUCCESS_SMALL + (SEAT_SUCCESS_LARGE - SEAT_SUCCESS_SMALL) * size
    : SEAT_FAILURE_SMALL + (SEAT_FAILURE_LARGE - SEAT_FAILURE_SMALL) * size;
  return (success ? 1.0 : -1.0) * scale * (critical ? SEAT_CRITICAL_SCALE : 1.0);
}

export { seatEffectNow } from "./effects.ts";

function push(c: Company, kind: SeatEffectKind, value: number, quarters: number): void {
  const e: SeatEffect = { kind, value, quarters_left: quarters, quarters };
  if (c.seat_effects === undefined) c.seat_effects = [e];
  else c.seat_effects.push(e);
}

/** The CIO's outcome, at once: productivity points on every unit and a share of held data. */
function applyCio(world: World, c: Company, outcome: number): void {
  for (const uid of c.units) {
    const u = world.units[uid] as World["units"][number];
    u.productivity = clamp(
      u.productivity + SEAT_CIO_PRODUCTIVITY * outcome,
      PRODUCTIVITY_MIN,
      PRODUCTIVITY_MAX,
    );
  }
  for (const d of c.data) d.book.held *= maxF(1.0 + SEAT_CIO_DATA_SHARE * outcome, 0.0);
}

function apply(world: World, c: Company, seat: Seat, outcome: number): void {
  switch (seat) {
    case "Ceo":
      push(c, "Growth", SEAT_CEO_GROWTH * outcome, SEAT_CEO_QUARTERS);
      break;
    case "Cfo":
      push(c, "Spread", -SEAT_CFO_SPREAD * outcome, SEAT_CFO_QUARTERS);
      break;
    case "Cio":
      applyCio(world, c, outcome);
      break;
    case "Cmo":
      push(c, "Revenue", SEAT_CMO_REVENUE * outcome, SEAT_CMO_QUARTERS);
      break;
    case "Coo":
      push(c, "Margin", SEAT_COO_MARGIN * outcome, SEAT_COO_QUARTERS);
      break;
    case "Chair":
      break;
  }
}

/** The seats' skills for the roll: each open labor seat's 5.7 skill, 3 for one with no holder. */
function openSeatSkills(c: Company): [Seat, number][] {
  const open = Math.min(c.labor_units, LABOR_SEAT_COUNT);
  const out: [Seat, number][] = [];
  for (let i = 0; i < open; i++) {
    const seat = SEAT_LABOR[i] as Seat;
    const h = c.board[i];
    const skill =
      h === null || h === undefined
        ? EMPTY_SEAT_SKILL
        : memberSkill({ skills: h.seat.character.skills, traits: h.seat.character.traits }, seat);
    out.push([seat, skill]);
  }
  return out;
}

function tallyNew(): SeatTally {
  return { ok: SEAT_LABOR.map(() => 0), fail: SEAT_LABOR.map(() => 0) };
}

/**
 * Plan lock, before the AI plans (spec v1.5 5.21, D1024): the effects still fading lose a lock,
 * then every open seat of every company not frozen rolls, companies in id order and seats in
 * opening order.
 */
export function seatEventsJob(world: World, ctx: JobCtx): void {
  if (profileOf(world).seat_events !== true) return;
  if (world.seat_tally === undefined) world.seat_tally = tallyNew();
  const tally = world.seat_tally;
  for (let id = 0; id < world.companies.length; id++) {
    const c = world.companies[id] as Company;
    if (c.seat_effects !== undefined) {
      for (const e of c.seat_effects) e.quarters_left -= 1;
      c.seat_effects = c.seat_effects.filter((e) => e.quarters_left > 0);
    }
    if (companyIsFrozen(c)) continue;
    const revenue = trailingRevenue(world, c);
    const difficulty = seatDifficulty(revenue);
    const size = sizePosition(revenue);
    for (const [seat, skill] of openSeatSkills(c)) {
      const roll = ctx.draws.intInclusive("Events", 1, SEAT_DIE);
      const success = seatPasses(roll, skill, difficulty);
      const critical = roll === SEAT_DIE || roll === 1;
      apply(world, c, seat, seatOutcome(success, critical, size));
      const i = SEAT_LABOR.indexOf(seat as (typeof SEAT_LABOR)[number]);
      if (success) tally.ok[i] = (tally.ok[i] ?? 0) + 1;
      else tally.fail[i] = (tally.fail[i] ?? 0) + 1;
      if (critical && revenue >= SEAT_HEADLINE_MIN_REVENUE_USD) {
        newsWireQueue(
          world.news,
          seatEvent(ctx.facts.date, c.industry, id as CompanyId, c.name, seat, success),
        );
      }
    }
  }
}
