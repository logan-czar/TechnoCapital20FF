// Port of crates/sim/tests/spec_5_12_distress.rs: spec 5.12 distress, bankruptcy and removal
// (Logan, batch 145; C30) and the 4.3 step 13 settle: build-plan M4.7, with a forced-failure test
// company that walks all three steps and keeps its books balanced every month (M4.9).
// Pure functions, no RNG.
//
// Expects:
//   ../../src/economy/assets.ts   saleFactor(phase)
//   ../../src/finance/balance.ts  type Books, balanceSheet(books, status), checkMonth(open, ledger,
//                                 close, status) -> Result
//   ../../src/finance/credit.ts   reviewLine(line, new_limit)
//   ../../src/finance/distress.ts BANKRUPT_AFTER_DISTRESS_MONTHS, FROZEN_QUARTERS, type
//                                 SettleInputs { cash, line, min_cash, gross_assets, asset_book,
//                                 sale_factor, state }, bankrupt(state), onQuarterClose(state),
//                                 removalDue(state), remove(state, books, gross) -> [state,
//                                 Removal], settleMonth(inputs) -> Settlement { drawn, cash, line,
//                                 distress_month, state, forced_sale, asset_book, gross_assets,
//                                 excess_repaid, went_bankrupt }, settlementLineChange(s)
//                                 [Settlement::line_change], companyStatusIsFrozen,
//                                 companyStatusMayBuyAssets, companyStatusMayPayDividends
//                                 [CompanyStatus methods]
//   ../../src/finance/sales.ts    REMOVAL_SALE_FACTOR
//   ../../src/finance/statements.ts  ledgerBookSold
// Rust Copy structs (DistressState, CreditLine, Books) are copied with a spread or structuredClone
// where the test keeps using the original.
import { describe, expect, it } from "vitest";
import { saleFactor } from "../../src/economy/assets.ts";
import { type Books, balanceSheet, checkMonth } from "../../src/finance/balance.ts";
import { reviewLine } from "../../src/finance/credit.ts";
import {
  BANKRUPT_AFTER_DISTRESS_MONTHS,
  bankrupt,
  companyStatusIsFrozen,
  companyStatusMayBuyAssets,
  companyStatusMayPayDividends,
  FROZEN_QUARTERS,
  onQuarterClose,
  removalDue,
  remove,
  type SettleInputs,
  settleMonth,
  settlementLineChange,
} from "../../src/finance/distress.ts";
import { REMOVAL_SALE_FACTOR } from "../../src/finance/sales.ts";
import { ledgerBookSold } from "../../src/finance/statements.ts";
import type { CreditLine, DistressState, Ledger, TaxBook } from "../../src/types/state/finance.ts";
import { zeroLedger, zeroTax } from "./common/defaults.ts";
import { numbersDiffer, unwrap } from "./common/index.ts";

/** DistressState::default(): Active, no counts. */
function freshState(over: Partial<DistressState> = {}): DistressState {
  return {
    status: "Active",
    distress_months: 0,
    frozen_quarters: 0,
    entry_quarter_open: false,
    ...over,
  };
}

/** A tax book with accrued of tax payable. */
function payable(accrued: number): TaxBook {
  return zeroTax({ accrued });
}

function near(a: number, b: number): void {
  expect(Math.abs(a - b) < 1e-6, `${a} vs ${b}`).toBe(true);
}

function line(drawn: number, limit: number): CreditLine {
  return { drawn, limit, excess_months_left: 0 };
}

function inputs(cash: number, l: CreditLine): SettleInputs {
  return {
    cash,
    line: l,
    min_cash: 0.5e6,
    gross_assets: 40.0e6,
    asset_book: 20.0e6,
    sale_factor: saleFactor("Normal"),
    state: freshState(),
  };
}

describe("spec 5.12 distress", () => {
  it("auto_draw_keeps_a_company_active", () => {
    // Cash -2M with 3M of the line undrawn: draw 2M, no distress.
    const s = settleMonth(inputs(-2.0e6, line(7.0e6, 10.0e6)));
    near(s.drawn, 2.0e6);
    near(s.cash, 0.0);
    near(s.line.drawn, 9.0e6);
    expect(s.distress_month).toBe(false);
    expect(s.state.status).toBe("Active");
    near(settlementLineChange(s), 2.0e6);
  });

  it("line_full_forces_sales_and_counts_a_distress_month", () => {
    // Cash -5M with only 2M undrawn: draw 2M, sell 3M / 0.85 of book at Normal.
    const s = settleMonth(inputs(-5.0e6, line(8.0e6, 10.0e6)));
    near(s.drawn, 2.0e6);
    near(s.forced_sale.proceeds, 3.0e6);
    near(s.forced_sale.book_sold, 3.0e6 / 0.85);
    near(s.asset_book, 20.0e6 - 3.0e6 / 0.85);
    near(s.gross_assets, 40.0e6 * (1.0 - 3.0e6 / 0.85 / 20.0e6));
    near(s.cash, 0.0);
    expect(s.distress_month).toBe(true);
    expect(s.state.distress_months).toBe(1);
    expect(s.state.status).toBe("Distressed");
    expect(companyStatusMayBuyAssets(s.state.status)).toBe(false);
    expect(companyStatusMayPayDividends(s.state.status)).toBe(false);
  });

  it("a_good_month_resets_the_count", () => {
    // 5.12 step 1: a month ending with cash at or above 0 and the line within its limit resets
    // distress_months to 0. The line exactly full counts as within the limit.
    const i = inputs(0.5e6, line(10.0e6, 10.0e6));
    i.state = freshState({ status: "Distressed", distress_months: 3 });
    const s = settleMonth(i);
    expect(s.state.distress_months).toBe(0);
    expect(s.state.status).toBe("Active");
  });

  it("the_review_excess_is_repaid_over_three_months", () => {
    // A review cuts the limit from 30M to 18M with 24M drawn: 6M over, repaid a third, a half and
    // then all of what is left from cash (D224). Cash covers it, so no distress.
    let l = reviewLine(line(24.0e6, 30.0e6), 18.0e6);
    expect(l.excess_months_left).toBe(3);
    let cash = 10.0e6;
    const repaid: number[] = [];
    let state = freshState();
    for (let i = 0; i < 3; i++) {
      const inp = inputs(cash, l);
      inp.min_cash = 50.0e6; // keeps the plan own auto-repay out of the way
      inp.state = { ...state };
      const s = settleMonth(inp);
      repaid.push(s.excess_repaid);
      expect(s.distress_month).toBe(false);
      cash = s.cash;
      l = s.line;
      state = s.state;
    }
    for (const r of repaid) {
      near(r, 2.0e6);
    }
    near(l.drawn, 18.0e6);
    expect(l.excess_months_left).toBe(0);
    near(cash, 4.0e6);
    expect(state.status).toBe("Active");
  });

  it("an_overdue_excess_forces_sales", () => {
    // 6M over with cash 0: while the excess is its only problem and the window is open it is a
    // grace month (no count, no reset, D224); the third month the rest is overdue and assets are
    // sold to repay it.
    let l = reviewLine(line(24.0e6, 30.0e6), 18.0e6);
    let state = freshState({ status: "Distressed", distress_months: 2 });
    for (let month = 1; month <= 3; month++) {
      const i = inputs(0.0, l);
      i.state = { ...state };
      const s = settleMonth(i);
      l = s.line;
      state = s.state;
      if (month < 3) {
        expect(s.distress_month, `grace month ${month}`).toBe(false);
        expect(state.distress_months).toBe(2);
      } else {
        expect(s.distress_month).toBe(true);
        expect(state.distress_months).toBe(3);
        near(s.forced_sale.proceeds, 6.0e6);
        near(s.excess_repaid, 6.0e6);
        near(s.line.drawn, 18.0e6);
        near(s.cash, 0.0);
      }
    }
  });

  it("negative_cash_inside_the_window_still_counts", () => {
    // The window only spares a month whose only problem is the excess: cash below 0 with the line
    // full (drawn above the limit, nothing to draw) is a distress month, window or not.
    const l = reviewLine(line(24.0e6, 30.0e6), 18.0e6);
    const i = inputs(-1.0e6, l);
    i.state = freshState({ status: "Distressed", distress_months: 2 });
    const s = settleMonth(i);
    expect(s.drawn).toBe(0.0);
    expect(s.distress_month).toBe(true);
    expect(s.state.distress_months).toBe(3);
    near(s.forced_sale.proceeds, 1.0e6);
    near(s.cash, 0.0);
    expect(s.line.excess_months_left, "the window keeps running").toBe(2);
  });

  it("no_assets_left_is_bankrupt_at_once", () => {
    // A 10M shortfall at Bust from a 5M book sells everything for 3M: no assets left, so
    // Bankrupt in its first distress month (5.12 step 2).
    let i = inputs(-10.0e6, line(10.0e6, 10.0e6));
    i.asset_book = 5.0e6;
    i.gross_assets = 9.0e6;
    i.sale_factor = saleFactor("Bust");
    let s = settleMonth(i);
    expect([s.gross_assets, s.asset_book]).toEqual([0.0, 0.0]);
    near(s.forced_sale.proceeds, 3.0e6);
    near(s.cash, -7.0e6);
    expect(s.went_bankrupt).toBe(true);
    expect(s.state.status).toBe("Bankrupt");
    expect(s.state.distress_months).toBe(1);
    // A unit with no book raises nothing (D225); the month still counts.
    i = inputs(-1.0e6, line(10.0e6, 10.0e6));
    i.asset_book = 0.0;
    s = settleMonth(i);
    expect(s.forced_sale.proceeds).toBe(0.0);
    expect(s.gross_assets).toBe(40.0e6);
    expect(s.distress_month).toBe(true);
    expect(s.went_bankrupt).toBe(false);
  });

  it("frozen_companies_settle_nothing", () => {
    const i = inputs(-3.0e6, line(5.0e6, 10.0e6));
    i.state = bankrupt(freshState());
    const s = settleMonth(i);
    expect([s.drawn, s.cash]).toEqual([0.0, -3.0e6]);
    expect(numbersDiffer(s.line, i.line)).toBeNull();
    expect(s.distress_month).toBe(false);
    expect(companyStatusIsFrozen("Bankrupt")).toBe(true);
    expect(companyStatusIsFrozen("Removed")).toBe(true);
    expect(companyStatusIsFrozen("Distressed")).toBe(false);
  });

  it("frozen_quarters_skip_the_entry_quarter", () => {
    // D232: the quarter the company went bankrupt in does not count; removal comes at the first
    // release after 2 full frozen quarters.
    let s = bankrupt(freshState());
    expect(removalDue(s)).toBe(false);
    s = onQuarterClose(s);
    expect(s.frozen_quarters, "entry quarter").toBe(0);
    s = onQuarterClose(s);
    expect(s.frozen_quarters).toBe(1);
    expect(removalDue(s)).toBe(false);
    s = onQuarterClose(s);
    expect(s.frozen_quarters).toBe(FROZEN_QUARTERS);
    expect(removalDue(s)).toBe(true);
    // Quarter closes do nothing for other statuses.
    const a = onQuarterClose(freshState());
    expect(a).toEqual(freshState());
  });

  it("removal_settles_the_estate_and_returns_capacity_to_the_fringe", () => {
    // 5.12 step 3: sold at the Bust factor (0.60) to repay the line; the unpaid line is written
    // off; the gross assets go back to the fringe (C30).
    const state = freshState({ status: "Bankrupt", frozen_quarters: 2 });
    const books: Books = {
      cash: 1.0e6,
      asset_book: 10.0e6,
      line_drawn: 12.0e6,
      tax: payable(0.2e6),
    };
    let [after, r] = remove({ ...state }, books, 25.0e6);
    expect(after.status).toBe("Removed");
    near(r.sale.proceeds, 10.0e6 * REMOVAL_SALE_FACTOR);
    near(r.sale.gain, -4.0e6);
    near(r.line_repaid, 7.0e6);
    near(r.line_written_off, 5.0e6);
    near(r.other_written_off, 0.2e6);
    expect(r.residual_cash).toBe(0.0);
    expect(r.capacity_to_fringe).toBe(25.0e6);
    // Proceeds above the line pay the tax payable; the rest leaves with the company (D233).
    const rich: Books = {
      cash: 5.0e6,
      asset_book: 10.0e6,
      line_drawn: 2.0e6,
      tax: payable(0.5e6),
    };
    [, r] = remove({ ...state }, rich, 25.0e6);
    near(r.line_repaid, 2.0e6);
    near(r.tax_paid, 0.5e6);
    near(r.residual_cash, 5.0e6 + 6.0e6 - 2.5e6);
    expect([r.line_written_off, r.other_written_off]).toEqual([0.0, 0.0]);
    // Negative cash is written off with the line.
    const empty: Books = { cash: -3.0e6, asset_book: 0.0, line_drawn: 4.0e6, tax: zeroTax() };
    [, r] = remove({ ...state }, empty, 0.0);
    expect(r.line_repaid).toBe(0.0);
    near(r.line_written_off, 4.0e6);
    near(r.other_written_off, 3.0e6);
    expect(r.capacity_to_fringe).toBe(0.0);
  });
});

/**
 * One month of the forced-failure company: its operating flows, then step 13, then the ledger and
 * the balance check.
 */
class FailingCompany {
  constructor(
    public books: Books,
    public gross: number,
    public line: CreditLine,
    public state: DistressState,
  ) {}

  month(revenueIn: number, costsIn: number): [Ledger, boolean] {
    const opening = balanceSheet(this.books, this.state.status);
    const frozen = companyStatusIsFrozen(this.state.status);
    // Frozen: no revenue, no expenses (5.12 step 2).
    const [revenue, costs] = frozen ? [0.0, 0.0] : [revenueIn, costsIn];
    const s = settleMonth({
      cash: this.books.cash + revenue - costs,
      line: { ...this.line },
      min_cash: 0.05 * 12.0 * revenue,
      gross_assets: this.gross,
      asset_book: this.books.asset_book,
      sale_factor: saleFactor("Normal"),
      state: { ...this.state },
    });
    const ledger = zeroLedger({
      revenue,
      fixed_cash: costs,
      asset_sale_proceeds: s.forced_sale.proceeds,
      asset_sale_gain: s.forced_sale.gain,
      line_drawn_or_repaid: settlementLineChange(s),
    });
    this.books.cash = s.cash;
    this.books.asset_book = s.asset_book;
    this.books.line_drawn = s.line.drawn;
    this.gross = s.gross_assets;
    this.line = s.line;
    this.state = s.state;
    const closing = balanceSheet(this.books, this.state.status);
    unwrap(checkMonth(opening, ledger, closing, this.state.status), "check_month");
    return [ledger, s.went_bankrupt];
  }
}

describe("spec 5.12 forced failure", () => {
  it("a_forced_failure_walks_distress_bankrupt_removed", () => {
    // The test company: 40M of capacity at cost, 20M book, 1M cash, its 4M line full, and a
    // business that burns 2M a month (1M revenue, 3M costs) in a Normal market.
    const co = new FailingCompany(
      { cash: 1.0e6, asset_book: 20.0e6, line_drawn: 4.0e6, tax: zeroTax() },
      40.0e6,
      line(4.0e6, 4.0e6),
      freshState(),
    );
    const equityAtStart = balanceSheet(co.books, co.state.status).equity;
    expect(equityAtStart > 0.0).toBe(true);

    // Step 1, Distressed: the first month spends the 1M cash, then each month sells assets at
    // 0.85 to bring cash back to 0. Months of 2020: Jan is settled on 1 Feb, ... Jun on 1 Jul.
    const history: Ledger[] = [];
    for (let month = 1; month <= BANKRUPT_AFTER_DISTRESS_MONTHS; month++) {
      const [ledger, went] = co.month(1.0e6, 3.0e6);
      history.push(ledger);
      expect(co.state.distress_months).toBe(month);
      near(co.books.cash, 0.0);
      if (month < BANKRUPT_AFTER_DISTRESS_MONTHS) {
        expect(co.state.status, `month ${month}`).toBe("Distressed");
        expect(went).toBe(false);
      } else {
        // Step 2, Bankrupt after 6 distress months: frozen, equity wiped to 0.
        expect(went).toBe(true);
        expect(co.state.status).toBe("Bankrupt");
        const bs = balanceSheet(co.books, co.state.status);
        expect(bs.equity).toBe(0.0);
        expect(bs.total_assets).toBe(bs.total_liabilities + bs.estate);
      }
    }
    // Every forced sale was at a loss of 15% of the book sold.
    let soldBook = 0;
    let proceeds = 0;
    for (const l of history) {
      soldBook += ledgerBookSold(l);
      proceeds += l.asset_sale_proceeds;
    }
    near(proceeds, 0.85 * soldBook);
    // 1M cash then 2M a month: 11M raised over six months.
    near(proceeds, 11.0e6);
    near(co.books.asset_book, 20.0e6 - 11.0e6 / 0.85);
    const grossLeft = co.gross;
    near(grossLeft, (40.0e6 * co.books.asset_book) / 20.0e6);

    // Frozen. It went Bankrupt at the 1 Jul settle (closing June, Q2); the close that runs after
    // that monthly job ends its entry quarter (D232). The settles of 1 Aug to 1 Jan 2021 post
    // nothing, move nothing and still balance; the 1 Oct close counts one frozen quarter,
    // 1 Jan 2021 the second, so the 2 Jan 2021 release removes it.
    co.state = onQuarterClose(co.state);
    expect(co.state.frozen_quarters).toBe(0);
    const frozenBooks = structuredClone(co.books);
    const steps: [string, boolean][] = [
      ["1 Aug", false],
      ["1 Sep", false],
      ["1 Oct", true],
      ["1 Nov", false],
      ["1 Dec", false],
      ["1 Jan 2021", true],
    ];
    for (const [settle, close] of steps) {
      const [ledger] = co.month(1.0e6, 3.0e6);
      expect(numbersDiffer(ledger, zeroLedger()), settle).toBeNull();
      expect(numbersDiffer(co.books, frozenBooks), settle).toBeNull();
      if (close) co.state = onQuarterClose(co.state);
      expect(removalDue(co.state), settle).toBe(settle === "1 Jan 2021");
    }
    expect(co.state.frozen_quarters).toBe(FROZEN_QUARTERS);

    // Step 3, Removed at the release: the rest sells at 0.60 to repay the 4M line, the unpaid part
    // is written off, and the capacity goes back to the fringe (C30).
    const [state, r] = remove(co.state, co.books, co.gross);
    expect(state.status).toBe("Removed");
    const bookLeft = 20.0e6 - 11.0e6 / 0.85;
    near(r.sale.proceeds, 0.6 * bookLeft);
    near(r.line_repaid, Math.min(0.6 * bookLeft, 4.0e6));
    near(r.line_written_off, 4.0e6 - r.line_repaid);
    near(r.capacity_to_fringe, grossLeft);
    expect(r.capacity_to_fringe > 0.0).toBe(true);
  });
});
