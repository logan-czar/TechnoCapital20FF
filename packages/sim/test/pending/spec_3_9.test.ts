// Port of crates/sim/tests/spec_3_9.rs: spec 3.9 statements (light, 10.0.8), the 4.4 and 4.5
// rollups, the 7.1 synthetic history and the balance identity: build-plan M4.2 (golden
// statements for 5 sample companies) and the helper M4.9 calls every month. The expected values
// of the golden tests are finance-start.csv (the independent Python export, no RNG).
//
// Expects (Rust methods are free functions named type + method, camelCased):
//   ../../src/finance/balance.ts     type Books { cash, asset_book, line_drawn, tax: TaxBook },
//                                    balanceSheet(books, status) -> BalanceSheet,
//                                    checkIdentity(sheet, status) -> Result<void, BalanceError>,
//                                    checkMonth(open, ledger, close, status) -> Result<void,
//                                    BalanceError>; BalanceError has a "line" string
//   ../../src/finance/credit.ts      homeSpread(zone, sovereign), lineLimit(book, cash, line,
//                                    rating), lineRate(base, home, rating), monthlyCharges(line,
//                                    limit, cash, rate, base) -> { interest, undrawn_fee,
//                                    cash_interest, ... }
//   ../../src/finance/rating.ts      startingRating(StartRatingInputs) -> { implied, ... }
//   ../../src/finance/statements.ts  quarterStatement(quarter, months, close, key),
//                                    yearStatement(year, quarters), syntheticHistory(annual,
//                                    start, key) -> Statement[4], trailingFour(statements) ->
//                                    Ledger | null, archivePush(archive, statement, cap),
//                                    statementIncome(s) [Statement::income],
//                                    statementCashFlow(s) [Statement::cash_flow],
//                                    ledgerIncome, ledgerCashFlow, ledgerEbit, ledgerEbitda,
//                                    ledgerNetIncome, ledgerPreTaxIncome, ledgerBookSold,
//                                    ledgerFreeCashFlow, ledgerNetCashChange, ledgerScaled
//                                    (Ledger methods); IncomeStatement { operating_costs, ebit,
//                                    interest_expense, pre_tax_income, tax, net_income, revenue },
//                                    CashFlowStatement { operating_cash, net_change, dividends }
//   ../../src/finance/tax.ts         quarterTax(pre_tax, carryforward, rate) -> { tax, ... }
//   ./finance_common/index.ts        the fixture helpers
// Rating::A is the string "A", Period::Quarter(q) is { kind: "Quarter", quarter: q }.
import { describe, expect, it } from "vitest";
import { type Books, balanceSheet, checkIdentity, checkMonth } from "../../src/finance/balance.ts";
import { homeSpread, lineLimit, lineRate, monthlyCharges } from "../../src/finance/credit.ts";
import { startingRating } from "../../src/finance/rating.ts";
import {
  archivePush,
  ledgerBookSold,
  ledgerCashFlow,
  ledgerEbit,
  ledgerEbitda,
  ledgerFreeCashFlow,
  ledgerIncome,
  ledgerNetCashChange,
  ledgerNetIncome,
  ledgerPreTaxIncome,
  ledgerScaled,
  quarterStatement,
  statementCashFlow,
  statementIncome,
  syntheticHistory,
  trailingFour,
  yearStatement,
} from "../../src/finance/statements.ts";
import { quarterTax } from "../../src/finance/tax.ts";
import { maxF, minF } from "../../src/types/num.ts";
import {
  ARCHIVE_QUARTERS,
  type BalanceSheet,
  type KeyFigures,
  type Ledger,
  type Rating,
  type Statement,
  type TaxBook,
} from "../../src/types/state/finance.ts";
import { data, unwrap } from "./common/index.ts";
import {
  assertClose,
  BASE_RATE,
  type CompanyFacts,
  type FixtureRow,
  facts,
  financeStart,
  sovereign,
  sovereignSpread,
  zoneSpread,
} from "./finance_common/index.ts";

/** Ledger::default(): every line 0. */
function zeroLedger(over: Partial<Ledger> = {}): Ledger {
  return {
    revenue: 0,
    variable: 0,
    fixed_cash: 0,
    rd: 0,
    shared: 0,
    depreciation: 0,
    line_interest: 0,
    line_fee: 0,
    interest_income: 0,
    asset_sale_gain: 0,
    tax: 0,
    tax_paid: 0,
    asset_purchases: 0,
    asset_sale_proceeds: 0,
    line_drawn_or_repaid: 0,
    shares_issued_net: 0,
    dividends: 0,
    ...over,
  };
}

/** TaxBook::default(). */
function zeroTax(): TaxBook {
  return { carryforward: 0, quarter_pre_tax: 0, accrued: 0 };
}

/** BalanceSheet::default(). */
function zeroSheet(): BalanceSheet {
  return {
    cash: 0,
    asset_book: 0,
    total_assets: 0,
    line_drawn: 0,
    tax_payable: 0,
    total_liabilities: 0,
    estate: 0,
    equity: 0,
  };
}

/** A tax book with accrued of tax payable. */
function payable(accrued: number): TaxBook {
  return { ...zeroTax(), accrued };
}

function key(rating: Rating): KeyFigures {
  return {
    productivity: 100.0,
    pc_bonus: 2,
    labor_units: 392,
    held_tb: 8.6,
    free_rd_pct: 1,
    management_score: 34.0,
    rating,
    guidance: [0.0, 0.0],
  };
}

/** A month with every line set, as 4.3 steps 9 to 14 would post it. */
function sampleMonth(): Ledger {
  return {
    revenue: 10.0e6,
    variable: 5.0e6,
    fixed_cash: 3.5e6,
    rd: 0.3e6,
    shared: 0.05e6,
    depreciation: 0.1e6,
    line_interest: 0.2e6,
    line_fee: 0.01e6,
    interest_income: 0.04e6,
    asset_sale_gain: -0.15e6,
    tax: 0.2e6,
    tax_paid: 0.0,
    asset_purchases: 0.4e6,
    asset_sale_proceeds: 0.85e6,
    line_drawn_or_repaid: -0.5e6,
    shares_issued_net: 0.0,
    dividends: 0.3e6,
  };
}

function quarterPeriod(year: number, q: number) {
  return { kind: "Quarter", quarter: { year, q } } as const;
}

describe("spec 3.9 statements", () => {
  it("income_and_cash_flow_lines", () => {
    // 3.9 income: revenue; operating costs (variable, fixed cash); R&D; shared; depreciation;
    // EBIT; interest expense; interest income; (5.10 gain or loss on sales); pre-tax; tax; NI.
    const m = sampleMonth();
    const i = ledgerIncome(m);
    assertClose("operating costs", i.operating_costs, 8.5e6);
    assertClose("EBIT", i.ebit, 10.0e6 - 8.5e6 - 0.3e6 - 0.05e6 - 0.1e6);
    assertClose("EBITDA", ledgerEbitda(m), 1.05e6 + 0.1e6);
    assertClose("interest expense", i.interest_expense, 0.21e6);
    assertClose("pre-tax", i.pre_tax_income, 1.05e6 - 0.21e6 + 0.04e6 - 0.15e6);
    assertClose("net income", i.net_income, 0.73e6 - 0.2e6);
    // 3.9 cash flow: operating cash; purchases; sales; line; shares; dividends; net change.
    const c = ledgerCashFlow(m);
    // Operating cash = NI + depreciation - gain on sales + tax accrued - tax paid.
    assertClose("operating cash", c.operating_cash, 0.53e6 + 0.1e6 + 0.15e6 + 0.2e6 - 0.0);
    assertClose("net change", c.net_change, c.operating_cash - 0.4e6 + 0.85e6 - 0.5e6 + 0.0 - 0.3e6);
    assertClose("book sold", ledgerBookSold(m), 1.0e6);
    assertClose("free cash flow", ledgerFreeCashFlow(m), c.operating_cash - 0.4e6);
  });

  it("a_quarter_sums_its_months_and_a_year_its_quarters", () => {
    const m = sampleMonth();
    const m2: Ledger = { ...m, revenue: 11.0e6, tax_paid: 0.6e6 };
    const m3: Ledger = { ...m, revenue: 9.0e6 };
    const close = zeroSheet();
    const q = quarterStatement({ year: 2020, q: 1 }, [m, m2, m3], close, key("A"));
    expect(q.period).toEqual(quarterPeriod(2020, 1));
    expect(q.synthetic).toBe(false);
    assertClose("Q revenue", statementIncome(q).revenue, 30.0e6);
    assertClose("Q tax paid", q.lines.tax_paid, 0.6e6);
    assertClose(
      "Q net income",
      statementIncome(q).net_income,
      ledgerNetIncome(m) + ledgerNetIncome(m2) + ledgerNetIncome(m3),
    );
    // A year is four quarters; balance and key figures are Q4 (4.5 step 1).
    const q4: Statement = {
      ...q,
      period: quarterPeriod(2020, 4),
      key: key("Bbb"),
      balance: { ...q.balance, cash: 7.0 },
    };
    const y = yearStatement(2020, [q, q, q, q4]);
    expect(y.period).toEqual({ kind: "Year", year: 2020 });
    assertClose("Y revenue", statementIncome(y).revenue, 120.0e6);
    assertClose("Y dividends", statementCashFlow(y).dividends, 3.6e6);
    expect(y.key.rating).toBe("Bbb");
    expect(y.balance.cash).toBe(7.0);
  });

  it("synthetic_history_is_a_quarter_of_the_run_rate", () => {
    // 4.4: the synthetic Q4 2019 is built from the starting run rate (revenue / 4 and so on);
    // 7.1: four synthetic quarters at the run rate.
    const annual = ledgerScaled(sampleMonth(), 12.0);
    const start = balanceSheet(
      { cash: 80.4e6, asset_book: 19.6e6, line_drawn: 0.0, tax: zeroTax() },
      "Active",
    );
    const h = syntheticHistory(annual, start, key("Aaa"));
    h.forEach((s, i) => {
      expect(s.period).toEqual(quarterPeriod(2019, i + 1));
      expect(s.synthetic).toBe(true);
      expect(s.balance).toEqual(start);
      assertClose("quarter revenue", statementIncome(s).revenue, 30.0e6);
      assertClose("quarter EBIT", statementIncome(s).ebit, ledgerEbit(annual) / 4.0);
    });
    const y = yearStatement(2019, h);
    expect(y.synthetic).toBe(true);
    assertClose("2019 revenue", statementIncome(y).revenue, annual.revenue);
    assertClose("2019 NI", statementIncome(y).net_income, ledgerNetIncome(annual));
    // TTM at load is the run rate.
    const ttm = trailingFour(h);
    expect(ttm).not.toBeNull();
    if (ttm === null) return;
    assertClose("TTM EBITDA", ledgerEbitda(ttm), ledgerEbitda(annual));
  });

  it("trailing_four_and_the_archive", () => {
    const q = (rev: number): Statement => ({
      period: quarterPeriod(2020, 1),
      lines: zeroLedger({ revenue: rev }),
      balance: zeroSheet(),
      key: key("A"),
      synthetic: false,
    });
    const six: Statement[] = [1, 2, 3, 4, 5, 6].map((i) => q(i));
    expect(trailingFour(six)?.revenue).toBe(3.0 + 4.0 + 5.0 + 6.0);
    // Fewer than four (a company born in play) are annualized (D228).
    expect(trailingFour(six.slice(0, 2))?.revenue).toBe((1.0 + 2.0) * 2.0);
    expect(trailingFour([])).toBeNull();
    // 4.5 step 2: keep 20 quarters, oldest dropped first.
    const archive: Statement[] = [];
    for (let i = 1; i <= 25; i++) {
      archivePush(archive, q(i), ARCHIVE_QUARTERS);
    }
    expect(archive.length).toBe(20);
    expect(archive[0]?.lines.revenue).toBe(6.0);
    expect(archive[19]?.lines.revenue).toBe(25.0);
  });
});

/**
 * The run-rate year of one company: the fixture operating lines with the engine credit line,
 * cash interest and tax on top (5.11, 5.12, 7.1). Returns the ledger, the starting balance sheet
 * and the starting rating.
 */
function runRate(f: CompanyFacts, row: FixtureRow): [Ledger, BalanceSheet, Rating] {
  const cash = f.start.cash_usd;
  const book = f.start.asset_book_usd;
  const line = f.start.credit_drawn_usd;
  const home = homeSpread(zoneSpread(f), sovereignSpread(f));
  const rating = startingRating({
    cash,
    line_drawn: line,
    ebitda: row.num("ebit") + row.num("depreciation"),
    revenue: row.num("revenue"),
    industry_key: f.industry.id,
    sovereign: sovereign(f),
    base_rate: BASE_RATE,
    home_spread: home,
  }).implied;
  const rate = lineRate(BASE_RATE, home, rating);
  const limit = lineLimit(book, cash, line, rating);
  const c = monthlyCharges(line, limit, cash, rate, BASE_RATE);
  const l = zeroLedger({
    revenue: row.num("revenue"),
    variable: row.num("variable"),
    fixed_cash: row.num("fixed_cash"),
    rd: row.num("rd"),
    shared: row.num("shared"),
    depreciation: row.num("depreciation"),
    line_interest: 12.0 * c.interest,
    line_fee: 12.0 * c.undrawn_fee,
    interest_income: 12.0 * c.cash_interest,
  });
  // Each run-rate quarter pays tax on a quarter of the pre-tax income, no carryforward.
  const tax = 4.0 * quarterTax(ledgerPreTaxIncome(l) / 4.0, 0.0, f.economy.corp_tax_rate).tax;
  l.tax = tax;
  l.tax_paid = tax;
  // A flat history buys back its depreciation (D228).
  l.asset_purchases = l.depreciation;
  const start = balanceSheet({ cash, asset_book: book, line_drawn: line, tax: zeroTax() }, "Active");
  return [l, start, rating];
}

function checkAgainstFixture(id: string, f: CompanyFacts, row: FixtureRow, full: boolean): void {
  const [annual, start, rating] = runRate(f, row);
  const h = syntheticHistory(annual, start, key(rating));
  const q4 = h[3] as Statement;
  expect(q4.period).toEqual(quarterPeriod(2019, 4));
  const i = statementIncome(q4);
  const cf = statementCashFlow(q4);
  const what = (line: string): string => `${id} ${line}`;
  // Revenue, EBIT and EBITDA are checked against values derived here from the CSVs, not against
  // the fixture that supplied the lines. Revenue: companies.csv revenue_usd_m (the 0.1M barebones
  // floor of 7.1), a quarter of it.
  const r = maxF(f.company.revenue_usd_m, 0.1) * 1.0e6;
  expect(i.revenue, `${id} Q4 revenue`).toBe(r / 4.0);
  // EBITDA - EBIT is depreciation, the 5.10 decay on company-start.csv gross assets:
  // asset_decay x max(0, gross - threshold), capped at the asset book (5.5).
  const ind = f.industry;
  const gross = f.start.gross_assets_usd;
  const decay = minF(
    ind.asset_decay * maxF(gross - ind.asset_decay_threshold_usd, 0.0),
    f.start.asset_book_usd,
  );
  const dep = ledgerEbitda(q4.lines) - i.ebit;
  expect(Math.abs(dep - decay / 4.0) < 1.0, `${id} Q4 EBITDA - EBIT ${dep} vs decay / 4 ${decay / 4.0}`).toBe(
    true,
  );
  // EBIT (5.5 at load, M 1.0): revenue less variable R x (1 - margin - f), less fixed cash +
  // depreciation + shared, which 7.1 fixed cost rate holds at f x turnover x gross, less paid
  // R&D. Barebones companies (R below 0.1M) carry the loadout 100,000 dollars and are left out.
  if (f.company.revenue_usd_m >= 0.1) {
    const ebit =
      r * (ind.margin_full_use + ind.fixed_cost_share) -
      ind.fixed_cost_share * ind.asset_turnover * gross -
      row.num("rd");
    expect(Math.abs(i.ebit - ebit / 4.0) < 1.0, `${id} Q4 EBIT ${i.ebit} vs ${ebit / 4.0}`).toBe(true);
  }
  assertClose(what("Q4 pre-tax"), i.pre_tax_income, row.num("q4_pre_tax_income"));
  assertClose(what("Q4 tax"), i.tax, row.num("q4_tax"));
  assertClose(what("Q4 net income"), i.net_income, row.num("q4_net_income"));
  assertClose(what("Q4 operating cash"), cf.operating_cash, row.num("q4_operating_cash"));
  assertClose(what("Q4 net change"), cf.net_change, row.num("q4_net_change"));
  const bs = q4.balance;
  assertClose(what("total assets"), bs.total_assets, row.num("bs_total_assets"));
  assertClose(what("total liabilities"), bs.total_liabilities, row.num("bs_total_liabilities"));
  assertClose(what("equity"), bs.equity, row.num("bs_equity"));
  // 3.5 book_equity = cash + asset book - line drawn: company-start.csv rounds each column to the
  // dollar.
  expect(
    Math.abs(bs.equity - f.start.book_equity_usd) <= 1.5,
    `${id} book equity ${bs.equity} vs ${f.start.book_equity_usd}`,
  ).toBe(true);
  unwrap(checkIdentity(bs, "Active"), "check_identity");
  if (full) {
    assertClose(
      what("Q4 interest expense"),
      i.interest_expense,
      (row.num("line_interest") + row.num("line_fee")) / 4.0,
    );
    assertClose(what("Q4 interest income"), i.interest_income, row.num("interest_income") / 4.0);
    const y = yearStatement(2019, h);
    assertClose(what("2019 revenue"), statementIncome(y).revenue, r);
    assertClose(what("2019 EBIT"), statementIncome(y).ebit, 4.0 * i.ebit);
    assertClose(what("2019 pre-tax"), statementIncome(y).pre_tax_income, row.num("pre_tax_income"));
    assertClose(what("2019 tax"), statementIncome(y).tax, row.num("tax"));
    assertClose(what("2019 net income"), statementIncome(y).net_income, row.num("net_income"));
    assertClose(what("2019 operating cash"), statementCashFlow(y).operating_cash, row.num("operating_cash"));
  }
}

describe("spec 3.9 golden statements", () => {
  it("golden_statements_for_five_sample_companies", () => {
    // Arrowhead (Oil, Canada, cash, no line), CO-0002 (private, a drawn line sized to its 5.12
    // limit, D15), Andes Cobre (Mining, Chile, 312 bps home spread), Gulf Coast Grid (Power
    // utilities), Zhuravel Drones (CO-0186, B, a loss after its line interest, no tax). Expected
    // values: the independent Python export (export_finance_fixtures.py).
    const d = data();
    const rows = financeStart();
    const find = (id: string): FixtureRow => {
      const r = rows.find((x) => x.id() === id);
      if (r === undefined) throw new Error(`no fixture row ${id}`);
      return r;
    };
    for (const id of ["CO-0001", "CO-0002", "CO-0179", "CO-0053", "CO-0186"]) {
      checkAgainstFixture(id, facts(d, id), find(id), true);
    }
    // Arrowhead by hand from 7.1: 19.6M asset book, 80.4M cash, no line, 100M equity; Q4 2019
    // revenue is 40M / 4.
    const [annual, start] = runRate(facts(d, "CO-0001"), find("CO-0001"));
    expect(Math.abs(start.asset_book - 19.6e6) < 0.01e6).toBe(true);
    expect(Math.abs(start.cash - 80.4e6) < 0.01e6).toBe(true);
    expect(start.line_drawn).toBe(0.0);
    expect(Math.abs(start.equity - 100.0e6) < 1.0).toBe(true);
    expect(annual.revenue / 4.0).toBe(10.0e6);
    // Zhuravel earns an EBIT but loses money after its B line interest: no tax in the quarter
    // (5.11). Since D16 no company starts rated CCC or CC with a drawn line.
    const [zAnnual, , zRating] = runRate(facts(d, "CO-0186"), find("CO-0186"));
    expect(zRating).toBe("B");
    expect(ledgerEbit(zAnnual)).toBeGreaterThan(0.0);
    expect(ledgerPreTaxIncome(zAnnual)).toBeLessThan(0.0);
    expect(zAnnual.tax).toBe(0.0);
  });

  it("synthetic_q4_2019_for_all_651", () => {
    const d = data();
    for (const row of financeStart()) {
      const id = row.id();
      checkAgainstFixture(id, facts(d, id), row, false);
    }
  });
});

describe("spec 3.9 balance identity", () => {
  it("balance_identity_active_and_bankrupt", () => {
    const books: Books = {
      cash: 12.0e6,
      asset_book: 40.0e6,
      line_drawn: 30.0e6,
      tax: payable(0.5e6),
    };
    // Active: equity is the residual, no estate.
    const a = balanceSheet(books, "Active");
    expect(a.total_assets).toBe(52.0e6);
    expect(a.total_liabilities).toBe(30.5e6);
    expect([a.equity, a.estate]).toEqual([21.5e6, 0.0]);
    unwrap(checkIdentity(a, "Active"));
    // Bankrupt (5.12 step 2): shareholders wiped, equity exactly 0; the residual sits on the
    // estate line, here a deficit, and the sheet still balances (D230).
    const deficit: Books = {
      cash: -2.0e6,
      asset_book: 10.0e6,
      line_drawn: 30.0e6,
      tax: zeroTax(),
    };
    const b = balanceSheet(deficit, "Bankrupt");
    expect(b.equity).toBe(0.0);
    expect(b.estate).toBe(-22.0e6);
    expect(b.total_assets).toBe(b.total_liabilities + b.estate + b.equity);
    unwrap(checkIdentity(b, "Bankrupt"));
    // A Bankrupt sheet that still shows equity, or an Active one with an estate, fails.
    expect(checkIdentity(a, "Bankrupt").ok).toBe(false);
    expect(checkIdentity(b, "Active").ok).toBe(false);
    const broken: BalanceSheet = { ...a, total_assets: a.total_assets + 1.0 };
    expect(checkIdentity(broken, "Active").ok).toBe(false);
  });

  it("month_check_rolls_every_balance_through_the_ledger", () => {
    const openingBooks: Books = {
      cash: 20.0e6,
      asset_book: 50.0e6,
      line_drawn: 10.0e6,
      tax: payable(0.3e6),
    };
    const m = sampleMonth();
    // Apply the month to the books the way steps 9 to 14 do. Tax payable is the accrued tax (D227).
    const closingBooks: Books = {
      cash: openingBooks.cash + ledgerNetCashChange(m),
      asset_book: openingBooks.asset_book + m.asset_purchases - m.depreciation - ledgerBookSold(m),
      line_drawn: openingBooks.line_drawn + m.line_drawn_or_repaid,
      tax: payable(openingBooks.tax.accrued + m.tax - m.tax_paid),
    };
    const open = balanceSheet(openingBooks, "Active");
    const close = balanceSheet(closingBooks, "Active");
    unwrap(checkMonth(open, m, close, "Active"));
    // Equity moved by NI + shares - dividends.
    assertClose("equity", close.equity - open.equity, ledgerNetIncome(m) - m.dividends);
    // A cash movement that skipped the ledger is caught.
    const leakedCash = balanceSheet({ ...closingBooks, cash: closingBooks.cash + 1.0e6 }, "Active");
    const cashErr = checkMonth(open, m, leakedCash, "Active");
    expect(cashErr.ok).toBe(false);
    if (!cashErr.ok) expect(cashErr.error.line).toBe("cash roll-forward");
    // So is a book change that skipped it.
    const leakedBook = balanceSheet(
      { ...closingBooks, asset_book: closingBooks.asset_book - 1.0e6 },
      "Active",
    );
    const bookErr = checkMonth(open, m, leakedBook, "Active");
    expect(bookErr.ok).toBe(false);
    if (!bookErr.ok) expect(bookErr.error.line).toBe("asset book roll-forward");
  });

  it("month_check_through_the_wipe_and_a_frozen_month", () => {
    // The month a Distressed company goes Bankrupt: its residual moves from equity to the
    // estate, so equity + estate rolls forward through the month NI (D230).
    const opening: Books = {
      cash: 0.0,
      asset_book: 8.0e6,
      line_drawn: 10.0e6,
      tax: zeroTax(),
    };
    const m = zeroLedger({
      revenue: 1.0e6,
      variable: 0.8e6,
      fixed_cash: 0.6e6,
      line_interest: 0.1e6,
      asset_sale_gain: -0.3e6,
      asset_sale_proceeds: 1.7e6,
      line_drawn_or_repaid: 0.0,
    });
    const closing: Books = {
      cash: opening.cash + ledgerNetCashChange(m),
      asset_book: opening.asset_book - ledgerBookSold(m),
      line_drawn: opening.line_drawn,
      tax: zeroTax(),
    };
    const open = balanceSheet(opening, "Distressed");
    const close = balanceSheet(closing, "Bankrupt");
    expect(close.equity).toBe(0.0);
    unwrap(checkMonth(open, m, close, "Bankrupt"));
    // Frozen months post nothing and move nothing; the books still balance.
    unwrap(checkMonth(close, zeroLedger(), close, "Bankrupt"));
  });
});
