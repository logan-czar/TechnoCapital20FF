// Port of crates/sim/tests/m4_distress.rs: build-plan M4.6 and M4.7 against the live engine:
// forced asset sales at the sale factor with their gain or loss (5.10), and a forced-failure test
// company that walks Distressed (6 months of forced sales) -> Bankrupt (frozen 2 quarters, equity
// 0, out of supply, the watchlist alert) -> Removed (sold at the Bust factor, capacity back to its
// industry's fringe pool, which the next supply step counts; spec 5.12, C30).
//
// The test company is the lowest-id company that starts rated CCC or CC with no drawn line (a
// limit of 0, so it never draws and no review excess muddies the walk). A test job raises its
// fixed cost rate before step 9 each month, an input the books post through the ledger like any
// cost: while Active, a month's extra cost is its cash plus 4% of its asset book; while
// Distressed, 4% of its book. So it goes Distressed in the January close and Bankrupt in the July
// close, the D232 example: frozen quarters counted on 1 October and 1 January, removed at the
// 2 January 2021 release.
//
// Expects:
//   ../../src/lib.ts           simNew, simApply(sim, control) -> Result, simStep, simNow, simWorld,
//                              simRegisterTestJob(sim, slot, name, job)
//   ../../src/finance/jobs.ts  sheet(world, company)
//   ../../src/finance/rating.ts ratingBand(r)
//   ../../src/time/calendar.ts simDateYmd, dateTimeMidnight
// Test-job state that Rust kept in static atomics is module-level variables here. Status helpers
// are in ./common/finance_live.ts; Default::default() for a Ledger is zeroLedger().
//
// Changed from the Rust: the seed (11) feeds the new generator (D951). The walk is driven by the
// squeeze job and the books, not by draws, so every assertion is kept; if a draw-dependent price
// or review ever moved the test company's pick, the EXPECTED_TARGET assertion names it.
import { describe, expect, it } from "vitest";
import { sheet } from "../../src/finance/jobs.ts";
import { ratingBand } from "../../src/finance/rating.ts";
import { simApply, simNew, simRegisterTestJob, simWorld } from "../../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../../src/time/calendar.ts";
import type { JobCtx } from "../../src/time/scheduler.ts";
import type { CompanyId } from "../../src/types/ids.ts";
import type { Notice } from "../../src/types/notice.ts";
import type { PhaseLabel, World } from "../../src/types/world.ts";
import { zeroLedger } from "./common/defaults.ts";
import { cloneWorld, inGame, isFrozen, lineAvailable, statusOf, stepTo } from "./common/finance_live.ts";
import { data, numbersDiffer, unwrap } from "./common/index.ts";

/** Spec 5.10 sale factors by phase label (10.0.7), written out. */
function specSaleFactor(label: PhaseLabel): number {
  switch (label) {
    case "Boom":
      return 1.0;
    case "Normal":
      return 0.85;
    case "Glut":
      return 0.7;
    case "Bust":
      return 0.6;
  }
}

/**
 * The company the walk is written for: the lowest-id company that starts rated CCC or CC with no
 * line on today's data (company-start.csv after D241).
 */
const EXPECTED_TARGET = "CO-0008";

/** The test company's index, and its fixed cost rate at load. */
let target = -1;
let baseRate = 0;
/** A distress month's extra cost, as a share of the asset book. */
const LOSS_SHARE_OF_BOOK = 0.04;

/** Runs before step 9 (registered in step 2): the squeeze. */
function squeeze(w: World, _ctx: JobCtx): void {
  const c = w.companies[target];
  if (c === undefined) throw new Error("no target");
  if (isFrozen(statusOf(c))) return;
  const u = w.units[c.units[0] as number];
  if (u === undefined) throw new Error("no unit");
  let extra = LOSS_SHARE_OF_BOOK * u.asset_book;
  if (statusOf(c) === "Active") extra += Math.max(c.cash_usd, 0.0) + lineAvailable(c.finance.line);
  u.fixed_cost_rate = baseRate + (12.0 * extra) / u.gross_assets;
}

/**
 * Spec 5.2 supply of one industry, written out: fringe x turnover + sum of units not frozen
 * (assets_eff x turnover x p_pre / 100).
 */
function specSupply(w: World, ind: number): number {
  const i = w.industries[ind];
  if (i === undefined) throw new Error("no industry");
  const t = i.params.asset_turnover;
  let s = i.fringe_assets * t;
  for (const u of w.units) {
    const c = w.companies[u.company];
    if (c === undefined) throw new Error("no company");
    if (u.industry !== ind || isFrozen(statusOf(c))) continue;
    let ramping = 0;
    for (const r of u.ramping) ramping += r.amount;
    s += ((u.gross_assets - 0.2 * ramping) * t * (u.productivity + c.pc_bonus + u.location_bonus)) / 100.0;
  }
  return s;
}

/**
 * Worst relative gap between the engine's supply of the test company's industry and specSupply,
 * measured right after step 6 each month, and the checks made.
 */
let supplyGap = 0;
let supplyChecks = 0;

/** Runs right after the step 6 supply job. */
function checkSupply(w: World, _ctx: JobCtx): void {
  const c = w.companies[target];
  const u = w.units[(c as NonNullable<typeof c>).units[0] as number];
  const ind = (u as NonNullable<typeof u>).industry;
  const s = (w.industries[ind] as NonNullable<(typeof w.industries)[number]>).supply;
  const gap = Math.abs(s - specSupply(w, ind)) / s;
  supplyGap = Math.max(supplyGap, gap);
  supplyChecks += 1;
}

describe("m4 distress", () => {
  it("a_forced_failure_walks_distressed_bankrupt_removed", { timeout: 300_000 }, () => {
    supplyGap = 0;
    supplyChecks = 0;
    const sim = unwrap(simNew(data(), 11), "Sim::new");
    const w0 = simWorld(sim);
    const pickIdx = w0.companies.findIndex((c) => {
      const b = ratingBand(c.finance.rating);
      return (b === "Ccc" || b === "Cc") && c.finance.line.drawn === 0.0 && c.finance.line.limit === 0.0;
    });
    expect(pickIdx >= 0, "a company rated CCC or CC with no line").toBe(true);
    target = pickIdx;
    const pick = pickIdx as CompanyId;
    const unit = (w0.companies[pickIdx] as NonNullable<(typeof w0.companies)[number]>).units[0] as number;
    const industry = (w0.units[unit] as NonNullable<(typeof w0.units)[number]>).industry;
    baseRate = (w0.units[unit] as NonNullable<(typeof w0.units)[number]>).fixed_cost_rate;
    const key = (w0.companies[pickIdx] as NonNullable<(typeof w0.companies)[number]>).key;
    expect(key, "the starting data moved: re-pick the test company").toBe(EXPECTED_TARGET);
    simRegisterTestJob(sim, "MonthlyDemand", "test.squeeze", squeeze);
    simRegisterTestJob(sim, "MonthlySupply", "test.supply", checkSupply);
    unwrap(simApply(sim, { kind: "WatchlistAdd", company: pick }), "WatchlistAdd");

    // 1. Distressed: the January to June closes each count a distress month and force a sale at
    //    the industry's sale factor, just enough to bring cash back to 0 (5.12 step 1).
    const notices: Notice[] = [];
    let prev = cloneWorld(sim);
    for (let n = 0; n < 6; n++) {
      const m = n + 2;
      notices.length = 0;
      stepTo(sim, dateTimeMidnight(simDateYmd(2020, m, 1)), notices);
      const w = simWorld(sim);
      const c = w.companies[pickIdx] as NonNullable<(typeof w.companies)[number]>;
      const l = (c.finance.last_month as NonNullable<typeof c.finance.last_month>).lines;
      const u0 = prev.units[unit] as NonNullable<(typeof w.units)[number]>;
      const u1 = w.units[unit] as NonNullable<(typeof w.units)[number]>;
      // M4.6: the book sold is what left the book (no decay below $10M of assets), the cash is
      // book sold x the sale factor of this month's label, the gain the difference.
      const bookSold = u0.asset_book - l.depreciation - u1.asset_book;
      expect(bookSold > 0.0, `${key} month ${m}: a forced sale`).toBe(true);
      const factor = specSaleFactor(
        (w.industries[industry] as NonNullable<(typeof w.industries)[number]>).phase_label,
      );
      const proceeds = bookSold * factor;
      expect(Math.abs(l.asset_sale_proceeds - proceeds) < 1e-6 * Math.max(proceeds, 1.0)).toBe(true);
      expect(Math.abs(l.asset_sale_gain - (proceeds - bookSold)) < 1e-6 * bookSold).toBe(true);
      expect(l.asset_sale_gain < 0.0 || factor === 1.0, "a loss below Boom").toBe(true);
      // The same share of gross and book is sold (5.10).
      const shareG = 1.0 - u1.gross_assets / (u0.gross_assets - l.depreciation);
      const shareB = bookSold / (u0.asset_book - l.depreciation);
      expect(Math.abs(shareG - shareB) < 1e-9).toBe(true);
      const months = n + 1;
      expect(c.finance.distress.distress_months, `${key} ${m}`).toBe(months);
      if (months < 6) {
        expect(statusOf(c)).toBe("Distressed");
        // Just enough: cash back to 0 (5.12 step 1; D225).
        expect(Math.abs(c.cash_usd) < 1e-3, `${key} cash ${c.cash_usd}`).toBe(true);
        // No purchases while Distressed (5.12 step 1).
        if (months > 1) expect(l.asset_purchases).toBe(0.0);
      }
      prev = cloneWorld(sim);
    }

    // 2. Bankrupt at the July close (the 6th distress month): frozen, wiped, alert raised.
    let w = simWorld(sim);
    let c = w.companies[pickIdx] as NonNullable<(typeof w.companies)[number]>;
    expect(statusOf(c)).toBe("Bankrupt");
    expect(c.finance.bankrupt_on).toEqual(simDateYmd(2020, 7, 1));
    const bs = sheet(w, c);
    expect(bs.equity, "shareholders wiped").toBe(0.0);
    expect(bs.estate).toBe(bs.total_assets - bs.total_liabilities);
    expect(
      notices.some(
        (n) =>
          n.kind === "Alert" &&
          n.alert_kind === "BankruptcyInWatchlist" &&
          n.payload.kind === "Company" &&
          n.payload.company === pick,
      ),
      "the watchlist alert fires",
    ).toBe(true);
    const grossAtBankruptcy = (w.units[unit] as NonNullable<(typeof w.units)[number]>).gross_assets;
    expect(grossAtBankruptcy > 0.0, "assets left to return").toBe(true);
    const cashAtBankruptcy = c.cash_usd;

    // Frozen for 2 quarters: nothing posts, nothing decays, it leaves supply (5.12 step 2).
    for (const m of [8, 9, 10, 11, 12]) {
      stepTo(sim, dateTimeMidnight(simDateYmd(2020, m, 1)), notices);
      w = simWorld(sim);
      c = w.companies[pickIdx] as NonNullable<(typeof w.companies)[number]>;
      expect(statusOf(c)).toBe("Bankrupt");
      expect(
        numbersDiffer((c.finance.last_month as NonNullable<typeof c.finance.last_month>).lines, zeroLedger()),
        `${m}`,
      ).toBeNull();
      const u = w.units[unit] as NonNullable<(typeof w.units)[number]>;
      expect(u.gross_assets).toBe(grossAtBankruptcy);
      expect(u.revenue_m).toBe(0.0);
      expect(c.cash_usd).toBe(cashAtBankruptcy);
      // Step 6 counted every unit but the frozen one (checked right after it).
      expect(supplyGap < 1e-12, `out of supply: ${supplyGap}`).toBe(true);
      // The quarter of the bankruptcy does not count (D232): 1 at the October close.
      expect(c.finance.distress.frozen_quarters, `${m}`).toBe(m >= 10 ? 1 : 0);
    }
    stepTo(sim, dateTimeMidnight(simDateYmd(2021, 1, 1)), notices);
    expect((simWorld(sim).companies[pickIdx] as NonNullable<typeof c>).finance.distress.frozen_quarters).toBe(
      2,
    );
    expect(statusOf(simWorld(sim).companies[pickIdx] as NonNullable<typeof c>)).toBe("Bankrupt");

    // 3. Removed at the 2 January 2021 release: sold at the Bust factor, the capacity back to the
    //    fringe (5.12 step 3, C30), the board discarded, the filings kept.
    const before = cloneWorld(sim);
    stepTo(sim, dateTimeMidnight(simDateYmd(2021, 1, 2)), notices);
    w = simWorld(sim);
    c = w.companies[pickIdx] as NonNullable<(typeof w.companies)[number]>;
    expect(statusOf(c)).toBe("Removed");
    expect(inGame(c)).toBe(false);
    expect(c.finance.removed_on).toEqual(simDateYmd(2021, 1, 2));
    const r = c.finance.removal as NonNullable<typeof c.finance.removal>;
    const book = (before.units[unit] as NonNullable<(typeof w.units)[number]>).asset_book;
    expect(Math.abs(r.sale.proceeds - 0.6 * book) < 1e-6 * book).toBe(true);
    expect(r.capacity_to_fringe).toBe(grossAtBankruptcy);
    const fringeGain =
      (w.industries[industry] as NonNullable<(typeof w.industries)[number]>).fringe_assets -
      (before.industries[industry] as NonNullable<(typeof w.industries)[number]>).fringe_assets;
    expect(Math.abs(fringeGain - grossAtBankruptcy) < 1e-6 * grossAtBankruptcy).toBe(true);
    expect((w.units[unit] as NonNullable<(typeof w.units)[number]>).gross_assets).toBe(0.0);
    expect(c.board.every((s) => s === null)).toBe(true);
    expect(c.finance.archive.quarters.length > 0, "filings stay").toBe(true);
    // No line to repay (limit 0 at CC); removal with a drawn line is m4_removal. The tax payable
    // came out of the sale first (D233).
    const bc = before.companies[pickIdx] as NonNullable<typeof c>;
    expect(bc.finance.line.drawn).toBe(0.0);
    const payable = bc.finance.tax.accrued;
    expect(
      Math.abs(r.tax_paid - Math.min(Math.max(payable, 0.0), Math.max(bc.cash_usd + r.sale.proceeds, 0.0))) <
        1e-6,
    ).toBe(true);
    // The next supply step counts the returned capacity in the fringe (M2 supply, 5.2).
    stepTo(sim, dateTimeMidnight(simDateYmd(2021, 2, 1)), notices);
    w = simWorld(sim);
    expect(supplyGap < 1e-12, `${supplyGap}`).toBe(true);
    expect(supplyChecks, "a check each month").toBe(13);
    // The books balanced every month of the walk (M4.9), in the engine's own check.
    expect(w.books_check.failures, `${w.books_check.first_failure}`).toBe(0);
  });
});
