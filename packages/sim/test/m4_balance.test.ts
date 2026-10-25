// Port of crates/sim/tests/m4_balance.rs: build-plan M4.9, the spec M4 done line: the balance
// sheet balances every month for every company still in the game, over a multi-year run of the
// live engine, Bankrupt companies included (their residual on the estate line, D230).
//
// The test keeps its own opening sheet per company and, at every monthly close, reads the closing
// balances straight from the World (cash, sum of asset book, line drawn, tax payable) and the
// month the engine posted. It checks spec 3.9's identity and rolls every balance forward through
// the posted lines, so a balance that moved outside the ledger fails. The engine's own run of the
// same check (world.books_check) must also report no failure.
//
// Expects:
//   ../src/lib.ts            simNew, simStep, simNow, simWorld
//   ../src/finance/jobs.ts   sheet(world, company) -> BalanceSheet
//   ../src/time/calendar.ts  simDateYmd, dateTimeMidnight, dateTimeDate, dateTimeHour,
//                               simDateMonthOf, monthPrev, simDateIsQuarterFirstMonth, formatMonth
// CompanyFinance::status / in_game / is_frozen are helpers in ./common/finance_live.ts.
//
// Changed from the Rust: the seeds feed the new generator (D951), so the run differs from
// Rust's. The identity and roll-forward checks hold for any draws. The closing statistical
// assertions (some company-months Bankrupt, some removed, 120 x 500 company-months) were true on
// every Rust seed; with the new generator they are checked again and may need other seeds.
import { describe, expect, it } from "vitest";
import { sheet as engineSheet } from "../src/finance/jobs.ts";
import { simNew, simNow, simStep, simWorld } from "../src/lib.ts";
import {
  dateTimeDate,
  dateTimeHour,
  dateTimeMidnight,
  formatMonth,
  monthPrev,
  simDateIsQuarterFirstMonth,
  simDateMonthOf,
  simDateYmd,
} from "../src/time/calendar.ts";
import type { Ledger } from "../src/types/state/finance.ts";
import type { World } from "../src/types/world.ts";
import { inGame, isFrozen, statusOf } from "./common/finance_live.ts";
import { data, macrotask, unwrap } from "./common/index.ts";

/** The run: 10 years (120 monthly closes) for each seed. */
const YEARS = 10;
const SEEDS = [1, 2, 3];
/** Absolute tolerance, USD, and relative to the company's largest balance (f64 sums of $1T books). */
const TOL_USD = 0.01;
const TOL_REL = 1.0e-11;

/** One company's balance sheet lines, read from the World (spec 3.9; D227 tax payable, D230 estate). */
interface Sheet {
  cash: number;
  book: number;
  line: number;
  tax_payable: number;
  /** Equity plus estate: what the owners' roll-forward tracks across the wipe (D230). */
  residual: number;
  bankrupt: boolean;
}

function sheetOf(w: World, i: number): Sheet {
  const c = w.companies[i];
  if (c === undefined) throw new Error(`no company ${i}`);
  let book = 0;
  for (const u of c.units) book += (w.units[u] as (typeof w.units)[number]).asset_book;
  const line = c.finance.line.drawn;
  const taxPayable = c.finance.tax.accrued;
  const assets = c.cash_usd + book;
  const liabilities = line + taxPayable;
  return {
    cash: c.cash_usd,
    book,
    line,
    tax_payable: taxPayable,
    residual: assets - liabilities,
    bankrupt: statusOf(c) === "Bankrupt",
  };
}

function tol(a: Sheet, b: Sheet): number {
  let scale = 0.0;
  for (const x of [a.cash, a.book, a.line, b.cash, b.book, b.line]) scale = Math.max(scale, Math.abs(x));
  return Math.max(TOL_USD, TOL_REL * scale);
}

/** The month check, written from spec 3.9 and the ledger's cash flow lines. */
function check(
  key: string,
  open: Sheet,
  m: Ledger,
  close: Sheet,
  sheetView: [equity: number, estate: number],
): void {
  const t = tol(open, close);
  const ok = (what: string, want: number, got: number): void => {
    expect(Math.abs(want - got) <= t, `${key} ${what}: expected ${want}, found ${got}`).toBe(true);
  };
  // Cash: + revenue - variable - fixed cash - R&D - shared - interest - fee + interest income
  // - tax paid - purchases + sale proceeds + line drawn (- repaid) + shares issued - dividends.
  const cashChange =
    m.revenue -
    m.variable -
    m.fixed_cash -
    m.rd -
    m.shared -
    m.line_interest -
    m.line_fee +
    m.interest_income -
    m.tax_paid -
    m.asset_purchases +
    m.asset_sale_proceeds +
    m.line_drawn_or_repaid +
    m.shares_issued_net -
    m.dividends;
  ok("cash", open.cash + cashChange, close.cash);
  // Book: + purchases - depreciation - book sold (proceeds - gain, 5.10).
  const bookSold = m.asset_sale_proceeds - m.asset_sale_gain;
  ok("asset book", open.book + m.asset_purchases - m.depreciation - bookSold, close.book);
  ok("line", open.line + m.line_drawn_or_repaid, close.line);
  ok("tax payable", open.tax_payable + m.tax - m.tax_paid, close.tax_payable);
  // Equity + estate: + net income + shares issued - dividends. Net income is revenue less every
  // cost line, interest, plus interest income and the sale gain, less tax (3.9, D229).
  const ni =
    m.revenue -
    m.variable -
    m.fixed_cash -
    m.rd -
    m.shared -
    m.depreciation -
    m.line_interest -
    m.line_fee +
    m.interest_income +
    m.asset_sale_gain -
    m.tax;
  ok("equity + estate", open.residual + ni + m.shares_issued_net - m.dividends, close.residual);
  // The engine's sheet (equity, estate) agrees: equity 0 when Bankrupt, no estate otherwise.
  const [equity, estate] = sheetView;
  if (close.bankrupt) {
    expect(equity, `${key} Bankrupt equity`).toBe(0.0);
    ok("estate", close.residual, estate);
  } else {
    expect(estate, `${key} estate`).toBe(0.0);
    ok("equity", close.residual, equity);
  }
}

/** Returns [company-months checked, [ever bankrupt, bankrupt months, removed, dipped]]. */
async function run(seed: number): Promise<[number, [number, number, number, number]]> {
  const sim = unwrap(simNew(data(), seed), "Sim::new");
  const n = simWorld(sim).companies.length;
  const open: Sheet[] = [];
  for (let i = 0; i < n; i++) open.push(sheetOf(simWorld(sim), i));
  const end = dateTimeMidnight(simDateYmd(2020 + YEARS, 1, 1));
  let checked = 0;
  let bankruptMonths = 0;
  let dipped = 0;
  const everBankrupt: boolean[] = new Array(n).fill(false);
  while (simNow(sim) < end) {
    simStep(sim);
    const now = simNow(sim);
    const date = dateTimeDate(now);
    if (!(dateTimeHour(now) === 0 && date.day === 1)) continue;
    await macrotask();
    const w = simWorld(sim);
    for (let i = 0; i < n; i++) {
      const c = w.companies[i];
      if (c === undefined) throw new Error(`no company ${i}`);
      if (!inGame(c)) continue;
      const posted = c.finance.last_month;
      if (posted === null) throw new Error("a posted month");
      expect(posted.month, c.key).toEqual(monthPrev(simDateMonthOf(date)));
      const close = sheetOf(w, i);
      const bs = engineSheet(w, c);
      const o = open[i] as Sheet;
      check(`${c.key} ${formatMonth(posted.month)} seed ${seed}`, o, posted.lines, close, [
        bs.equity,
        bs.estate,
      ]);
      if (close.bankrupt) {
        bankruptMonths += 1;
        everBankrupt[i] = true;
      }
      // Cash after a close (D122): the step 13 settle leaves a company not frozen at or above 0
      // (auto-draw, then forced sales). At a quarter end the 4.4 close then pays the quarter's
      // tax, which can leave cash below 0 by at most that tax; the next month's settle (an
      // ordinary month, checked here next time) draws or sells for it.
      if (!isFrozen(statusOf(c))) {
        const t = tol(o, close);
        if (simDateIsQuarterFirstMonth(date)) {
          expect(
            close.cash >= -posted.lines.tax_paid - t,
            `${c.key} ${formatMonth(posted.month)}: cash ${close.cash} below its tax paid`,
          ).toBe(true);
          if (close.cash < -t) dipped += 1;
        } else {
          expect(
            close.cash >= -t,
            `${c.key} ${formatMonth(posted.month)}: cash ${close.cash} after the settle`,
          ).toBe(true);
        }
      }
      open[i] = close;
      checked += 1;
    }
    // Removal at a release (the 2nd) takes a company out between two closes; its last checked
    // month stands.
  }
  const w = simWorld(sim);
  expect(w.books_check.failures, `engine check: ${w.books_check.first_failure}`).toBe(0);
  const removed = w.companies.filter((c) => !inGame(c)).length;
  return [checked, [everBankrupt.filter((b) => b).length, bankruptMonths, removed, dipped]];
}

describe("m4 balance", () => {
  it("every_company_balances_every_month_for_ten_years", { timeout: 1_800_000 }, async () => {
    for (const seed of SEEDS) {
      const [checked, [, bankruptMonths, removed]] = await run(seed);
      // The run is long enough to cover the whole walk: some companies are checked while
      // Bankrupt and some are removed (the M4.7 path on the starting data).
      expect(bankruptMonths > 0 && removed > 0, `seed ${seed}`).toBe(true);
      expect(checked >= 120 * 500, `seed ${seed}: ${checked}`).toBe(true);
    }
  });
});
