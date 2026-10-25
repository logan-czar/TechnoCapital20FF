// Port of crates/sim/tests/m4_statements.rs: build-plan M4.2 against the live engine: quarterly
// and yearly statements, the synthetic Q4 2019 and four history quarters at load (spec 3.9, 4.4,
// 4.5, 7.1) and the 20-quarter archive.
//
// Done line: golden statements for 5 sample companies. The expected Q4 2019 and 2019 lines are
// finance-start.csv (the independent Python export of 3.9, 5.11, 5.12 and 7.1 on validate.py
// run rate and company-start.csv), with revenue, EBIT and EBITDA also derived here from the CSVs.
// Arrowhead R&D is spec 7.1 (0.72M a year, the 2.8% Cash cow target less the engine 1% free R&D);
// the fixture validate.py model gives it 2% free (design fix 208), so its R&D, pre-tax and tax
// lines are worked from the spec instead.
//
// Expects (Rust methods are free functions named type + method, camelCased):
//   ../src/lib.ts                 simNew(data, seed) -> Result<Sim, LoadError>, simWorld(sim)
//                                    [Sim::world, test hook], simStep, simNow (via ./common/ops.ts)
//   ../src/finance/statements.ts  ledgerSum(ledgers), ledgerEbit, ledgerEbitda,
//                                    ledgerInterestExpense, ledgerPreTaxIncome, ledgerNetIncome,
//                                    ledgerOperatingCash, ledgerNetCashChange
//   ../src/finance/jobs.ts        sheet(world, company) -> BalanceSheet
//   ../src/time/calendar.ts       simDateYmd
// The archive is read from c.finance.archive.quarters and .years (CompanyFinance::quarters and
// ::years are the same slices); in_game is status !== "Removed", is_frozen is Bankrupt or Removed.
// Ledger and balance equalities use numbersDiffer (Rust == on f64), not toEqual (0 vs -0).
//
// Changed from the Rust: the seeds (1, 2, 3) now seed the new generator (D951). The 651 starting
// statements and Q4 2019 lines do not depend on draws; the Q1 2020 and archive tests assert
// structure (sums, periods, lengths), which hold for any draws.
import { describe, expect, it } from "vitest";
import { sheet } from "../src/finance/jobs.ts";
import {
  ledgerEbit,
  ledgerEbitda,
  ledgerInterestExpense,
  ledgerNetCashChange,
  ledgerNetIncome,
  ledgerOperatingCash,
  ledgerPreTaxIncome,
  ledgerSum,
} from "../src/finance/statements.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import { maxF } from "../src/types/num.ts";
import type { Ledger, Period, Statement } from "../src/types/state/finance.ts";
import type { World } from "../src/types/world.ts";
import { data, numbersDiffer, unwrap } from "./common/index.ts";
import { company, runTo } from "./common/ops.ts";
import { type FixtureRow, financeStart } from "./finance_common/index.ts";

function close(what: string, actual: number, expected: number, rel: number): void {
  expect(
    Math.abs(actual - expected) <= maxF(rel * maxF(Math.abs(expected), Math.abs(actual)), 1.0),
    `${what}: engine ${actual} vs expected ${expected}`,
  ).toBe(true);
}

/**
 * Engine revenue sits within 1e-6 of companies.csv revenue (M2.6), so lines derived from it agree
 * to this relative tolerance.
 */
const REL = 1.0e-5;
/**
 * A barebones company revenue a year: 100,000 dollars of assets at turnover 1, productivity 100
 * and PC bonus +1 (7.1, 10.0.11.1; D107).
 */
const BAREBONES_REVENUE_USD = 101_000.0;

function quarter(year: number, q: number): Period {
  return { kind: "Quarter", quarter: { year, q } };
}

function same(what: string, a: unknown, b: unknown): void {
  expect(numbersDiffer(a, b), what).toBeNull();
}

function newSim(seed: number) {
  return unwrap(simNew(data(), seed), "Sim::new");
}

describe("m4 statements", () => {
  it("synthetic_history_at_load_for_all_651", () => {
    const d = data();
    const sim = newSim(1);
    const w = simWorld(sim);
    const rows = financeStart();
    for (const row of rows) {
      const c = w.companies[company(w, row.id())];
      if (c === undefined) throw new Error(`no company ${row.id()}`);
      const qs = c.finance.archive.quarters;
      // 7.1 History: four synthetic quarters; 4.4: Q4 2019 released on 2 January 2020.
      expect(qs.length, row.id()).toBe(4);
      qs.forEach((s, i) => {
        expect(s.period).toEqual(quarter(2019, i + 1));
        expect(s.synthetic).toBe(true);
        same("a flat history", s.lines, (qs[0] as Statement).lines);
      });
      const y = c.finance.archive.years;
      expect(y.length).toBe(1);
      expect((y[0] as Statement).period).toEqual({ kind: "Year", year: 2019 });
      const q4 = qs[3] as Statement;
      // Revenue / 4 (4.4), from companies.csv; the barebones loadout (7.1, R below 0.1M) has
      // 100,000 dollars of assets at the PC bonus +1, so 101,000 a year (D107).
      const csv = d.companies.rows.find((x) => x.id === row.id());
      if (csv === undefined) throw new Error(`no companies.csv row ${row.id()}`);
      const csvM = csv.revenue_usd_m;
      const r = csvM < 0.1 ? BAREBONES_REVENUE_USD : csvM * 1.0e6;
      close(`${row.id()} Q4 revenue`, q4.lines.revenue, r / 4.0, REL);
      expect((y[0] as Statement).lines.revenue).toBe(4.0 * q4.lines.revenue);
      // A flat history buys back its depreciation (D228) and pays its tax in the quarter.
      expect(q4.lines.asset_purchases).toBe(q4.lines.depreciation);
      expect(q4.lines.tax_paid).toBe(q4.lines.tax);
      // The starting balance sheet: company-start.csv cash + book - line (3.5, 7.1).
      close(`${row.id()} total assets`, q4.balance.total_assets, row.num("bs_total_assets"), 1e-12);
      close(`${row.id()} equity`, q4.balance.equity, row.num("bs_equity"), 1e-12);
      // Interest and fees at the starting rating (the fixture rating matches, M4.5).
      close(`${row.id()} Q4 line interest`, q4.lines.line_interest, row.num("line_interest") / 4.0, 1e-9);
      close(
        `${row.id()} Q4 interest income`,
        q4.lines.interest_income,
        row.num("interest_income") / 4.0,
        1e-9,
      );
    }
  });
});

/** One fixture company Q4 2019 against the fixture. */
function golden(w: World, row: FixtureRow, rdYear: number): Statement {
  const id = row.id();
  const c = w.companies[company(w, id)];
  if (c === undefined) throw new Error(`no company ${id}`);
  const q4 = c.finance.archive.quarters[3] as Statement;
  const l = q4.lines;
  const what = (line: string): string => `${id} Q4 2019 ${line}`;
  close(what("revenue"), l.revenue, row.num("q4_revenue"), REL);
  close(what("variable"), l.variable, row.num("variable") / 4.0, REL);
  close(what("R&D"), l.rd, rdYear / 4.0, REL);
  // EBIT + R&D: the operating lines before R&D (5.5), which the fixture and the engine both hold
  // at f x turnover x gross for fixed cash, depreciation and shared costs (7.1).
  close(what("EBIT before R&D"), ledgerEbit(l) + l.rd, row.num("q4_ebit") + row.num("rd") / 4.0, REL);
  close(what("EBITDA - EBIT"), ledgerEbitda(l) - ledgerEbit(l), row.num("depreciation") / 4.0, REL);
  close(
    what("interest expense"),
    ledgerInterestExpense(l),
    (row.num("line_interest") + row.num("line_fee")) / 4.0,
    1e-9,
  );
  close(what("interest income"), l.interest_income, row.num("interest_income") / 4.0, 1e-9);
  return q4;
}

describe("m4 golden statements", () => {
  it("golden_statements_for_five_sample_companies", () => {
    const d = data();
    const sim = newSim(1);
    const w = simWorld(sim);
    const rows = financeStart();
    const row = (id: string): FixtureRow => {
      const r = rows.find((x) => x.id() === id);
      if (r === undefined) throw new Error(`no fixture row ${id}`);
      return r;
    };
    const compOf = (id: string) => {
      const c = w.companies[company(w, id)];
      if (c === undefined) throw new Error(`no company ${id}`);
      return c;
    };
    // CO-0002 (private, a drawn line), Andes Cobre (Mining, Chile, 312 bps home spread), Gulf
    // Coast Grid (Power utilities), Changcheng Grid (CC, a loss after interest): every line
    // against the fixture.
    for (const id of ["CO-0002", "CO-0179", "CO-0053", "CO-0044"]) {
      const r = row(id);
      const q4 = golden(w, r, r.num("rd"));
      const what = (line: string): string => `${id} Q4 2019 ${line}`;
      close(what("EBIT"), ledgerEbit(q4.lines), r.num("q4_ebit"), REL);
      close(what("EBITDA"), ledgerEbitda(q4.lines), r.num("q4_ebitda"), REL);
      close(what("pre-tax"), ledgerPreTaxIncome(q4.lines), r.num("q4_pre_tax_income"), REL);
      close(what("tax"), q4.lines.tax, r.num("q4_tax"), REL);
      close(what("net income"), ledgerNetIncome(q4.lines), r.num("q4_net_income"), REL);
      close(what("operating cash"), ledgerOperatingCash(q4.lines), r.num("q4_operating_cash"), REL);
      close(what("net change"), ledgerNetCashChange(q4.lines), r.num("q4_net_change"), REL);
      // 2019 is the four quarters (4.5 step 1).
      const y = compOf(id).finance.archive.years[0] as Statement;
      close(what("2019 tax"), y.lines.tax, r.num("tax"), REL);
      close(what("2019 net income"), ledgerNetIncome(y.lines), r.num("net_income"), REL);
    }
    // Changcheng starts at the fixture rating (CC), and a quarter tax is 5.11
    // max(0, pre-tax) x rate (no carryforward at load): 0 for a loss.
    const cc = compOf("CO-0044");
    expect(cc.finance.rating).toBe(row("CO-0044").rating("start_rating"));
    const china = d.country_economy.rows.find((e) => e.iso3 === "CHN");
    if (china === undefined) throw new Error("no CHN economy");
    const l = (cc.finance.archive.quarters[3] as Statement).lines;
    expect(Math.abs(l.tax - maxF(ledgerPreTaxIncome(l), 0.0) * china.corp_tax_rate) < 1e-6).toBe(true);

    // Arrowhead (7.1): 40M revenue, paid R&D 0.72M a year (0.05 x 0.7 x 0.8 = 2.8% less 1%
    // free), no line, 80.4M of cash at base - 0.25% (5.12), the Canada 26.5% tax (country-economy).
    const r = row("CO-0001");
    const q4 = golden(w, r, 0.018 * 40.0e6);
    const canada = d.country_economy.rows.find((e) => e.iso3 === "CAN");
    if (canada === undefined) throw new Error("no CAN economy");
    const pti = ledgerEbit(q4.lines) + q4.lines.interest_income - ledgerInterestExpense(q4.lines);
    close("CO-0001 Q4 2019 pre-tax", ledgerPreTaxIncome(q4.lines), pti, 1e-12);
    close("CO-0001 Q4 2019 tax", q4.lines.tax, canada.corp_tax_rate * pti, 1e-12);
    // EBIT after R&D about 1.6M a year (7.1), so 0.4M in the quarter.
    expect(
      Math.abs(4.0 * ledgerEbit(q4.lines) - 1.6e6) < 0.05e6,
      `Arrowhead EBIT ${4.0 * ledgerEbit(q4.lines)}`,
    ).toBe(true);
    expect(Math.abs(q4.balance.cash - 80.4e6) < 0.01e6).toBe(true);
    expect(q4.balance.line_drawn).toBe(0.0);
  });
});

describe("m4 quarters, years and the archive", () => {
  it("quarters_sum_their_months_and_years_their_quarters", () => {
    const sim = newSim(2);
    // Collect each company three posted months of Q1 2020 as the monthly closes post them.
    const months: Ledger[][] = [];
    for (const m of [2, 3, 4]) {
      runTo(sim, simDateYmd(2020, m, 1));
      const w = simWorld(sim);
      // Companies born at the 9 January lock join the tables.
      while (months.length < w.companies.length) months.push([]);
      w.companies.forEach((c, i) => {
        const p = c.finance.last_month;
        if (p !== null) {
          expect(p.month.month).toBe(m - 1);
          (months[i] as Ledger[]).push(p.lines);
        }
      });
    }
    const w = simWorld(sim);
    w.companies.forEach((c, i) => {
      if (c.finance.distress.status === "Removed") return;
      const qs = c.finance.archive.quarters;
      const q1 = qs[qs.length - 1] as Statement;
      expect(q1.period, c.key).toEqual(quarter(2020, 1));
      expect(q1.synthetic).toBe(false);
      const mine = months[i] as Ledger[];
      expect(mine.length, c.key).toBe(3);
      same(`${c.key} Q1 2020 is its three months`, q1.lines, ledgerSum(mine));
      // The close paid the quarter tax (5.11): three accruals, paid once in March.
      expect((mine[0] as Ledger).tax_paid + (mine[1] as Ledger).tax_paid).toBe(0.0);
      const status = c.finance.distress.status;
      // (A Removed company returned above.)
      if (status !== "Bankrupt") {
        expect(Math.abs(q1.lines.tax_paid - q1.lines.tax) < 1e-6, c.key).toBe(true);
        expect(q1.balance.tax_payable, c.key).toBe(0.0);
      }
      // The closing balance sheet is the company after the close.
      same(c.key, q1.balance, sheet(w, c));
    });
    // Run to the end of 2020: 2020 is the sum of its four quarters (4.5 step 1).
    runTo(sim, simDateYmd(2021, 1, 1));
    const w2 = simWorld(sim);
    for (const c of w2.companies) {
      // A company born in 2020 has no whole 2020 to compile (4.5 step 1).
      if (c.finance.distress.status === "Removed" || c.origin.kind === "Born") continue;
      const ys = c.finance.archive.years;
      const y = ys[ys.length - 1] as Statement;
      expect(y.period, c.key).toEqual({ kind: "Year", year: 2020 });
      const all = c.finance.archive.quarters;
      const last4 = all.slice(all.length - 4);
      same(c.key, y.lines, ledgerSum(last4.map((s) => s.lines)));
      same(c.key, y.balance, (last4[3] as Statement).balance);
    }
  });

  it("the_archive_keeps_twenty_quarters_and_five_years", () => {
    const sim = newSim(3);
    runTo(sim, simDateYmd(2026, 1, 1));
    const w = simWorld(sim);
    const a = w.companies[company(w, "CO-0001")];
    if (a === undefined) throw new Error("no CO-0001");
    const qs = a.finance.archive.quarters;
    // 4 synthetic + 24 closed quarters, the oldest 8 dropped (4.5 step 2).
    expect(qs.length).toBe(20);
    expect((qs[0] as Statement).period).toEqual(quarter(2021, 1));
    expect((qs[19] as Statement).period).toEqual(quarter(2025, 4));
    const ys = a.finance.archive.years;
    expect(ys.length).toBe(5);
    expect((ys[0] as Statement).period).toEqual({ kind: "Year", year: 2021 });
    expect((ys[4] as Statement).period).toEqual({ kind: "Year", year: 2025 });
  }, 180_000); // Six years with the ported views built on their cadence (Step 3).
});
