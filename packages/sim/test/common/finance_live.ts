// Helpers shared by the M4 live-engine tests (m4_*): what the Rust tests did with methods the TS
// contracts leave out (CompanyFinance::status, in_game, CreditLine::available), a world clone, a
// step-and-collect loop, and the spec 5.12 spread table that m4_credit and m4_ledger both write out.
//
// Expects:
//   ../../src/finance/rating.ts  ratingBand(r), ratingLabel(r)        [Rating::band, label]
//   ../../src/lib.ts             simStep(sim) -> Notice[], simNow(sim), simWorld(sim)
import { ratingBand, ratingLabel } from "../../src/finance/rating.ts";
import { type Sim, simNow, simStep, simWorld } from "../../src/lib.ts";
import type { Notice } from "../../src/types/notice.ts";
import type { Band, CompanyStatus, CreditLine, Rating } from "../../src/types/state/finance.ts";
import type { Company, World } from "../../src/types/world.ts";

/** CompanyFinance::status. */
export function statusOf(c: Company): CompanyStatus {
  return c.finance.distress.status;
}

/** CompanyStatus::is_frozen: Bankrupt or Removed. */
export function isFrozen(s: CompanyStatus): boolean {
  return s === "Bankrupt" || s === "Removed";
}

/** CompanyFinance::in_game: not Removed. */
export function inGame(c: Company): boolean {
  return statusOf(c) !== "Removed";
}

/** CreditLine::available: undrawn limit left to draw. */
export function lineAvailable(l: CreditLine): number {
  return Math.max(l.limit - l.drawn, 0.0);
}

/** A deep copy of the live world (Rust `sim.world().clone()`; the TS world is mutated in place). */
export function cloneWorld(sim: Sim): World {
  return structuredClone(simWorld(sim));
}

/** Steps the sim until its clock reaches t (hours), appending every step's notices to out. */
export function stepTo(sim: Sim, t: number, out: Notice[]): void {
  while (simNow(sim) < t) out.push(...simStep(sim));
}

/** Spec 5.12 corporate spreads by band (3.6.2), with the D220 notch thirds, written out. */
export function specSpread(r: Rating): number {
  const order: [Band, number][] = [
    ["Aaa", 0.004],
    ["Aa", 0.006],
    ["A", 0.009],
    ["Bbb", 0.015],
    ["Bb", 0.028],
    ["B", 0.045],
    ["Ccc", 0.09],
    ["Cc", 0.16],
  ];
  const band = ratingBand(r);
  const i = order.findIndex(([b]) => b === band);
  const cur = order[i];
  if (cur === undefined) throw new Error(`no band ${band}`);
  const s = cur[1];
  const label = ratingLabel(r);
  const prev = order[i - 1];
  const next = order[i + 1];
  if (label.endsWith("+") && prev !== undefined) return s - (s - prev[1]) / 3.0;
  if (label.endsWith("-") && next !== undefined) return s + (next[1] - s) / 3.0;
  return s;
}
