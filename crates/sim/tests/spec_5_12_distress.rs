//! Spec 5.12 distress, bankruptcy and removal (Logan, batch 145; C30) and the 4.3 step 13
//! settle: build-plan M4.7, with a forced-failure test company that walks all three steps and
//! keeps its books balanced every month (M4.9).

use sim::economy::assets::sale_factor;
use sim::finance::balance::{Books, balance_sheet, check_month};
use sim::finance::credit::{CreditLine, review_line};
use sim::finance::distress::{
    BANKRUPT_AFTER_DISTRESS_MONTHS, CompanyStatus, DistressState, FROZEN_QUARTERS, SettleInputs,
    bankrupt, on_quarter_close, removal_due, remove, settle_month,
};
use sim::finance::sales::REMOVAL_SALE_FACTOR;
use sim::finance::statements::Ledger;
use sim::finance::tax::TaxBook;

/// A tax book with `accrued` of tax payable.
fn payable(accrued: f64) -> TaxBook {
    TaxBook {
        accrued,
        ..TaxBook::default()
    }
}
use sim::world::PhaseLabel;

#[track_caller]
fn near(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-6, "{a} vs {b}");
}

fn line(drawn: f64, limit: f64) -> CreditLine {
    CreditLine {
        drawn,
        limit,
        excess_months_left: 0,
    }
}

fn inputs(cash: f64, line: CreditLine) -> SettleInputs {
    SettleInputs {
        cash,
        line,
        min_cash: 0.5e6,
        gross_assets: 40.0e6,
        asset_book: 20.0e6,
        sale_factor: sale_factor(PhaseLabel::Normal),
        state: DistressState::default(),
    }
}

#[test]
fn auto_draw_keeps_a_company_active() {
    // Cash −$2M with $3M of the line undrawn: draw $2M, no distress.
    let s = settle_month(&inputs(-2.0e6, line(7.0e6, 10.0e6)));
    near(s.drawn, 2.0e6);
    near(s.cash, 0.0);
    near(s.line.drawn, 9.0e6);
    assert!(!s.distress_month);
    assert_eq!(s.state.status, CompanyStatus::Active);
    near(s.line_change(), 2.0e6);
}

#[test]
fn line_full_forces_sales_and_counts_a_distress_month() {
    // Cash −$5M with only $2M undrawn: draw $2M, sell $3M ÷ 0.85 of book at Normal.
    let s = settle_month(&inputs(-5.0e6, line(8.0e6, 10.0e6)));
    near(s.drawn, 2.0e6);
    near(s.forced_sale.proceeds, 3.0e6);
    near(s.forced_sale.book_sold, 3.0e6 / 0.85);
    near(s.asset_book, 20.0e6 - 3.0e6 / 0.85);
    near(s.gross_assets, 40.0e6 * (1.0 - 3.0e6 / 0.85 / 20.0e6));
    near(s.cash, 0.0);
    assert!(s.distress_month);
    assert_eq!(s.state.distress_months, 1);
    assert_eq!(s.state.status, CompanyStatus::Distressed);
    assert!(!s.state.status.may_buy_assets());
    assert!(!s.state.status.may_pay_dividends());
}

#[test]
fn a_good_month_resets_the_count() {
    // 5.12 step 1: a month ending with cash at or above 0 and the line within its limit resets
    // distress_months to 0. The line exactly full counts as within the limit.
    let mut i = inputs(0.5e6, line(10.0e6, 10.0e6));
    i.state = DistressState {
        status: CompanyStatus::Distressed,
        distress_months: 3,
        ..DistressState::default()
    };
    let s = settle_month(&i);
    assert_eq!(s.state.distress_months, 0);
    assert_eq!(s.state.status, CompanyStatus::Active);
}

#[test]
fn the_review_excess_is_repaid_over_three_months() {
    // A review cuts the limit from $30M to $18M with $24M drawn: $6M over, repaid a third, a
    // half and then all of what is left from cash (D224). Cash covers it, so no distress.
    let mut l = review_line(line(24.0e6, 30.0e6), 18.0e6);
    assert_eq!(l.excess_months_left, 3);
    let mut cash = 10.0e6;
    let mut repaid = Vec::new();
    let mut state = DistressState::default();
    for _ in 0..3 {
        let mut i = inputs(cash, l);
        i.min_cash = 50.0e6; // keeps the plan's own auto-repay out of the way
        i.state = state;
        let s = settle_month(&i);
        repaid.push(s.excess_repaid);
        assert!(!s.distress_month);
        cash = s.cash;
        l = s.line;
        state = s.state;
    }
    for r in &repaid {
        near(*r, 2.0e6);
    }
    near(l.drawn, 18.0e6);
    assert_eq!(l.excess_months_left, 0);
    near(cash, 4.0e6);
    assert_eq!(state.status, CompanyStatus::Active);
}

#[test]
fn an_overdue_excess_forces_sales() {
    // $6M over with cash 0: while the excess is its only problem and the window is open it is a
    // grace month (no count, no reset, D224); the third month the rest is overdue and assets are
    // sold to repay it.
    let mut l = review_line(line(24.0e6, 30.0e6), 18.0e6);
    let mut state = DistressState {
        status: CompanyStatus::Distressed,
        distress_months: 2,
        ..DistressState::default()
    };
    for month in 1..=3 {
        let mut i = inputs(0.0, l);
        i.state = state;
        let s = settle_month(&i);
        l = s.line;
        state = s.state;
        if month < 3 {
            assert!(!s.distress_month, "grace month {month}");
            assert_eq!(state.distress_months, 2);
        } else {
            assert!(s.distress_month);
            assert_eq!(state.distress_months, 3);
            near(s.forced_sale.proceeds, 6.0e6);
            near(s.excess_repaid, 6.0e6);
            near(s.line.drawn, 18.0e6);
            near(s.cash, 0.0);
        }
    }
}

#[test]
fn negative_cash_inside_the_window_still_counts() {
    // The window only spares a month whose only problem is the excess: cash below 0 with the
    // line full (drawn above the limit, nothing to draw) is a distress month, window or not.
    let l = review_line(line(24.0e6, 30.0e6), 18.0e6);
    let mut i = inputs(-1.0e6, l);
    i.state = DistressState {
        status: CompanyStatus::Distressed,
        distress_months: 2,
        ..DistressState::default()
    };
    let s = settle_month(&i);
    assert_eq!(s.drawn, 0.0);
    assert!(s.distress_month);
    assert_eq!(s.state.distress_months, 3);
    near(s.forced_sale.proceeds, 1.0e6);
    near(s.cash, 0.0);
    assert_eq!(s.line.excess_months_left, 2, "the window keeps running");
}

#[test]
fn no_assets_left_is_bankrupt_at_once() {
    // A $10M shortfall at Bust from a $5M book sells everything for $3M: no assets left, so
    // Bankrupt in its first distress month (5.12 step 2).
    let mut i = inputs(-10.0e6, line(10.0e6, 10.0e6));
    i.asset_book = 5.0e6;
    i.gross_assets = 9.0e6;
    i.sale_factor = sale_factor(PhaseLabel::Bust);
    let s = settle_month(&i);
    assert_eq!((s.gross_assets, s.asset_book), (0.0, 0.0));
    near(s.forced_sale.proceeds, 3.0e6);
    near(s.cash, -7.0e6);
    assert!(s.went_bankrupt);
    assert_eq!(s.state.status, CompanyStatus::Bankrupt);
    assert_eq!(s.state.distress_months, 1);
    // A unit with no book raises nothing (D225); the month still counts.
    let mut i = inputs(-1.0e6, line(10.0e6, 10.0e6));
    i.asset_book = 0.0;
    let s = settle_month(&i);
    assert_eq!(s.forced_sale.proceeds, 0.0);
    assert_eq!(s.gross_assets, 40.0e6);
    assert!(s.distress_month);
    assert!(!s.went_bankrupt);
}

#[test]
fn frozen_companies_settle_nothing() {
    let mut i = inputs(-3.0e6, line(5.0e6, 10.0e6));
    i.state = bankrupt(DistressState::default());
    let s = settle_month(&i);
    assert_eq!((s.drawn, s.cash, s.line), (0.0, -3.0e6, i.line));
    assert!(!s.distress_month);
    assert!(CompanyStatus::Bankrupt.is_frozen());
    assert!(CompanyStatus::Removed.is_frozen());
    assert!(!CompanyStatus::Distressed.is_frozen());
}

#[test]
fn frozen_quarters_skip_the_entry_quarter() {
    // D232: the quarter the company went bankrupt in does not count; removal comes at the
    // first release after 2 full frozen quarters.
    let mut s = bankrupt(DistressState::default());
    assert!(!removal_due(s));
    s = on_quarter_close(s);
    assert_eq!(s.frozen_quarters, 0, "entry quarter");
    s = on_quarter_close(s);
    assert_eq!(s.frozen_quarters, 1);
    assert!(!removal_due(s));
    s = on_quarter_close(s);
    assert_eq!(s.frozen_quarters, FROZEN_QUARTERS);
    assert!(removal_due(s));
    // Quarter closes do nothing for other statuses.
    let a = on_quarter_close(DistressState::default());
    assert_eq!(a, DistressState::default());
}

#[test]
fn removal_settles_the_estate_and_returns_capacity_to_the_fringe() {
    // 5.12 step 3: sold at the Bust factor (0.60) to repay the line; the unpaid line is written
    // off; the gross assets go back to the fringe (C30).
    let state = DistressState {
        status: CompanyStatus::Bankrupt,
        frozen_quarters: 2,
        ..DistressState::default()
    };
    let books = Books {
        cash: 1.0e6,
        asset_book: 10.0e6,
        line_drawn: 12.0e6,
        tax: payable(0.2e6),
    };
    let (after, r) = remove(state, &books, 25.0e6);
    assert_eq!(after.status, CompanyStatus::Removed);
    near(r.sale.proceeds, 10.0e6 * REMOVAL_SALE_FACTOR);
    near(r.sale.gain, -4.0e6);
    near(r.line_repaid, 7.0e6);
    near(r.line_written_off, 5.0e6);
    near(r.other_written_off, 0.2e6);
    assert_eq!(r.residual_cash, 0.0);
    assert_eq!(r.capacity_to_fringe, 25.0e6);
    // Proceeds above the line pay the tax payable; the rest leaves with the company (D233).
    let rich = Books {
        cash: 5.0e6,
        asset_book: 10.0e6,
        line_drawn: 2.0e6,
        tax: payable(0.5e6),
    };
    let (_, r) = remove(state, &rich, 25.0e6);
    near(r.line_repaid, 2.0e6);
    near(r.tax_paid, 0.5e6);
    near(r.residual_cash, 5.0e6 + 6.0e6 - 2.5e6);
    assert_eq!((r.line_written_off, r.other_written_off), (0.0, 0.0));
    // Negative cash is written off with the line.
    let empty = Books {
        cash: -3.0e6,
        asset_book: 0.0,
        line_drawn: 4.0e6,
        tax: TaxBook::default(),
    };
    let (_, r) = remove(state, &empty, 0.0);
    assert_eq!(r.line_repaid, 0.0);
    near(r.line_written_off, 4.0e6);
    near(r.other_written_off, 3.0e6);
    assert_eq!(r.capacity_to_fringe, 0.0);
}

/// One month of the forced-failure company: its operating flows, then step 13, then the ledger
/// and the balance check.
struct Company {
    books: Books,
    gross: f64,
    line: CreditLine,
    state: DistressState,
}

impl Company {
    fn month(&mut self, revenue: f64, costs: f64) -> (Ledger, bool) {
        let opening = balance_sheet(&self.books, self.state.status);
        let frozen = self.state.status.is_frozen();
        // Frozen: no revenue, no expenses (5.12 step 2).
        let (revenue, costs) = if frozen { (0.0, 0.0) } else { (revenue, costs) };
        let s = settle_month(&SettleInputs {
            cash: self.books.cash + revenue - costs,
            line: self.line,
            min_cash: 0.05 * 12.0 * revenue,
            gross_assets: self.gross,
            asset_book: self.books.asset_book,
            sale_factor: sale_factor(PhaseLabel::Normal),
            state: self.state,
        });
        let ledger = Ledger {
            revenue,
            fixed_cash: costs,
            asset_sale_proceeds: s.forced_sale.proceeds,
            asset_sale_gain: s.forced_sale.gain,
            line_drawn_or_repaid: s.line_change(),
            ..Ledger::default()
        };
        self.books.cash = s.cash;
        self.books.asset_book = s.asset_book;
        self.books.line_drawn = s.line.drawn;
        self.gross = s.gross_assets;
        self.line = s.line;
        self.state = s.state;
        let closing = balance_sheet(&self.books, self.state.status);
        check_month(&opening, &ledger, &closing, self.state.status).unwrap();
        (ledger, s.went_bankrupt)
    }
}

#[test]
fn a_forced_failure_walks_distress_bankrupt_removed() {
    // The test company: $40M of capacity at cost, $20M book, $1M cash, its $4M line full, and
    // a business that burns $2M a month ($1M revenue, $3M costs) in a Normal market.
    let mut co = Company {
        books: Books {
            cash: 1.0e6,
            asset_book: 20.0e6,
            line_drawn: 4.0e6,
            tax: TaxBook::default(),
        },
        gross: 40.0e6,
        line: line(4.0e6, 4.0e6),
        state: DistressState::default(),
    };
    let equity_at_start = balance_sheet(&co.books, co.state.status).equity;
    assert!(equity_at_start > 0.0);

    // Step 1, Distressed: the first month spends the $1M cash, then each month sells assets at
    // 0.85 to bring cash back to 0. Months of 2020: Jan is settled on 1 Feb, ... Jun on 1 Jul.
    let mut history = Vec::new();
    for month in 1..=BANKRUPT_AFTER_DISTRESS_MONTHS {
        let (ledger, went) = co.month(1.0e6, 3.0e6);
        history.push(ledger);
        assert_eq!(co.state.distress_months, month);
        near(co.books.cash, 0.0);
        if month < BANKRUPT_AFTER_DISTRESS_MONTHS {
            assert_eq!(co.state.status, CompanyStatus::Distressed, "month {month}");
            assert!(!went);
        } else {
            // Step 2, Bankrupt after 6 distress months: frozen, equity wiped to 0.
            assert!(went);
            assert_eq!(co.state.status, CompanyStatus::Bankrupt);
            let bs = balance_sheet(&co.books, co.state.status);
            assert_eq!(bs.equity, 0.0);
            assert_eq!(bs.total_assets, bs.total_liabilities + bs.estate);
        }
    }
    // Every forced sale was at a loss of 15% of the book sold.
    let sold_book: f64 = history.iter().map(|l| l.book_sold()).sum();
    let proceeds: f64 = history.iter().map(|l| l.asset_sale_proceeds).sum();
    near(proceeds, 0.85 * sold_book);
    // $1M cash then $2M a month: $11M raised over six months.
    near(proceeds, 11.0e6);
    near(co.books.asset_book, 20.0e6 - 11.0e6 / 0.85);
    let gross_left = co.gross;
    near(gross_left, 40.0e6 * co.books.asset_book / 20.0e6);

    // Frozen. It went Bankrupt at the 1 Jul settle (closing June, Q2); the close that runs
    // after that monthly job ends its entry quarter (D232). The settles of 1 Aug to 1 Jan 2021
    // post nothing, move nothing and still balance; the 1 Oct close counts one frozen quarter,
    // 1 Jan 2021 the second, so the 2 Jan 2021 release removes it.
    co.state = on_quarter_close(co.state);
    assert_eq!(co.state.frozen_quarters, 0);
    let frozen_books = co.books;
    for (settle, close) in [
        ("1 Aug", false),
        ("1 Sep", false),
        ("1 Oct", true),
        ("1 Nov", false),
        ("1 Dec", false),
        ("1 Jan 2021", true),
    ] {
        let (ledger, _) = co.month(1.0e6, 3.0e6);
        assert_eq!(ledger, Ledger::default(), "{settle}");
        assert_eq!(co.books, frozen_books, "{settle}");
        if close {
            co.state = on_quarter_close(co.state);
        }
        assert_eq!(removal_due(co.state), settle == "1 Jan 2021", "{settle}");
    }
    assert_eq!(co.state.frozen_quarters, FROZEN_QUARTERS);

    // Step 3, Removed at the release: the rest sells at 0.60 to repay the $4M line, the
    // unpaid part is written off, and the capacity goes back to the fringe (C30).
    let (state, r) = remove(co.state, &co.books, co.gross);
    assert_eq!(state.status, CompanyStatus::Removed);
    let book_left = 20.0e6 - 11.0e6 / 0.85;
    near(r.sale.proceeds, 0.60 * book_left);
    near(r.line_repaid, (0.60 * book_left).min(4.0e6));
    near(r.line_written_off, 4.0e6 - r.line_repaid);
    near(r.capacity_to_fringe, gross_left);
    assert!(r.capacity_to_fringe > 0.0);
}
