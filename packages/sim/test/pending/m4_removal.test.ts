// Port of crates/sim/tests/m4_removal.rs: build-plan M4.7, removal with a drawn line (spec 5.12
// step 3; D233): everything left sells at the Bust factor (0.60), the cash repays the line, then
// the tax payable; the unpaid line is written off by the bank and any cash left leaves the game.
//
// The test company is the lowest-id company that starts with a drawn line. A test job raises its
// fixed cost rate before step 9 each month (an input the books post like any cost): while Active
// a month's extra cost is its cash, its undrawn limit and 4% of its book; then 4% of its book. It
// draws its line full, goes Distressed, Bankrupt and is removed at a release. On the Rust data
// (CO-0002, seed 12) the 0.60 sale covers the line, so nothing is written off; the assertions
// follow D233's order whatever the amounts.
//
// Expects:
//   ../../src/lib.ts           simNew, simStep, simNow, simWorld, simRegisterTestJob
//   ../../src/time/calendar.ts simDateYmd, dateTimeMidnight, dateTimeNext, dateTimeDate,
//                              dateTimeHour, simDateIsQuarterFirstMonth
//
// Changed from the Rust: the seed (12) feeds the new generator (D951). The walk is driven by the
// squeeze job and the books; the pick is the lowest-id company with a drawn line at load (load
// state, not draws). The status walk and the D233 amounts are checked against whatever the run
// produced.
import { describe, expect, it } from "vitest";
import { simNew, simNow, simRegisterTestJob, simStep, simWorld } from "../../src/lib.ts";
import {
  dateTimeDate,
  dateTimeHour,
  dateTimeMidnight,
  dateTimeNext,
  simDateIsQuarterFirstMonth,
  simDateYmd,
} from "../../src/time/calendar.ts";
import type { JobCtx } from "../../src/time/scheduler.ts";
import type { CompanyStatus } from "../../src/types/state/finance.ts";
import type { World } from "../../src/types/world.ts";
import { cloneWorld, isFrozen, lineAvailable, statusOf } from "./common/finance_live.ts";
import { data, unwrap } from "./common/index.ts";

let target = -1;
let baseRate = 0;
const LOSS_SHARE_OF_BOOK = 0.04;
/** Spec 5.12 step 3: the Bust factor. */
const BUST_FACTOR = 0.6;

function squeeze(w: World, _ctx: JobCtx): void {
  const c = w.companies[target];
  if (c === undefined) throw new Error("no target");
  if (isFrozen(statusOf(c))) return;
  const u = w.units[c.units[0] as number];
  if (u === undefined) throw new Error("no unit");
  if (u.gross_assets <= 0.0) return;
  let extra = LOSS_SHARE_OF_BOOK * u.asset_book;
  if (statusOf(c) === "Active") extra += Math.max(c.cash_usd, 0.0) + lineAvailable(c.finance.line);
  u.fixed_cost_rate = baseRate + (12.0 * extra) / u.gross_assets;
}

describe("m4 removal", () => {
  it("removal_repays_the_line_then_the_tax", { timeout: 600_000 }, () => {
    const sim = unwrap(simNew(data(), 12), "Sim::new");
    const w0 = simWorld(sim);
    const pick = w0.companies.findIndex((c) => c.finance.line.drawn > 0.0);
    expect(pick >= 0, "a company with a drawn line").toBe(true);
    target = pick;
    const unit = (w0.companies[pick] as NonNullable<(typeof w0.companies)[number]>).units[0] as number;
    baseRate = (w0.units[unit] as NonNullable<(typeof w0.units)[number]>).fixed_cost_rate;
    const key = (w0.companies[pick] as NonNullable<(typeof w0.companies)[number]>).key;
    simRegisterTestJob(sim, "MonthlyDemand", "test.squeeze", squeeze);
    // Step until the release tick that removes it, keeping the state just before each release.
    let before = cloneWorld(sim);
    const walk: CompanyStatus[] = [];
    const end = dateTimeMidnight(simDateYmd(2023, 1, 1));
    while (simNow(sim) < end) {
      const next = dateTimeNext(simNow(sim));
      const nd = dateTimeDate(next);
      if (dateTimeHour(next) === 0 && nd.day === 2 && simDateIsQuarterFirstMonth(nd)) {
        before = cloneWorld(sim);
      }
      simStep(sim);
      const s = statusOf(simWorld(sim).companies[pick] as NonNullable<(typeof w0.companies)[number]>);
      if (walk[walk.length - 1] !== s) walk.push(s);
      if (s === "Removed") break;
    }
    expect(walk, key).toEqual(["Active", "Distressed", "Bankrupt", "Removed"]);
    const w = simWorld(sim);
    const c = w.companies[pick] as NonNullable<(typeof w.companies)[number]>;
    const b = before.companies[pick] as NonNullable<(typeof w.companies)[number]>;
    const r = c.finance.removal;
    if (r === null) throw new Error("removal recorded");
    const drawn = b.finance.line.drawn;
    expect(drawn > 0.0, `${key} holds a drawn line into removal`).toBe(true);
    // Everything sells at 0.60 of book (5.12 step 3).
    const book = (before.units[unit] as NonNullable<(typeof w.units)[number]>).asset_book;
    expect(Math.abs(r.sale.proceeds - BUST_FACTOR * book) < 1e-6 * Math.max(book, 1.0)).toBe(true);
    // The cash repays the line first, the bank writes off the rest (A), then tax (D233).
    const cash = b.cash_usd + r.sale.proceeds;
    const repaid = Math.min(drawn, Math.max(cash, 0.0));
    expect(Math.abs(r.line_repaid - repaid) < 1e-6).toBe(true);
    expect(Math.abs(r.line_written_off - (drawn - repaid)) < 1e-6).toBe(true);
    const left = cash - repaid;
    const payable = Math.max(b.finance.tax.accrued, 0.0);
    const tax = Math.min(payable, Math.max(left, 0.0));
    expect(Math.abs(r.tax_paid - tax) < 1e-6).toBe(true);
    expect(Math.abs(r.residual_cash - Math.max(left - tax, 0.0)) < 1e-6).toBe(true);
    expect(Math.abs(r.other_written_off - (payable - tax + Math.max(-(left - tax), 0.0))) < 1e-6).toBe(true);
    // The removed company's books are cleared; its capacity went to the fringe (C30).
    expect(c.finance.line.drawn).toBe(0.0);
    expect(c.cash_usd).toBe(0.0);
    expect(r.capacity_to_fringe).toBe(
      (before.units[unit] as NonNullable<(typeof w.units)[number]>).gross_assets,
    );
    expect(w.books_check.failures, `${w.books_check.first_failure}`).toBe(0);
  });
});
