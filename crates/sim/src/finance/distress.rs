//! Cash settling, distress, bankruptcy and removal (spec 5.12 "Auto-draw", "Distress, bankruptcy
//! and removal", Logan batch 145; conflict C30; 4.3 step 13, the 4.4 close and release).
//!
//! The status walks Active → Distressed (forced sales) → Bankrupt (frozen 2 quarters,
//! shareholders wiped) → Removed (assets sold at the Bust factor, the line repaid or written
//! off, the capacity returned to the fringe). Every transition is a pure function of explicit
//! inputs; the caller writes the outputs back to the world.

use serde::{Deserialize, Serialize};

use super::balance::Books;
use super::credit::{CreditLine, auto_draw, excess_instalment, plan_repay};
use super::sales::{AssetSale, REMOVAL_SALE_FACTOR, sell_all, sell_for_cash};

/// Spec 5.12 step 2 (T): Bankrupt after this many distress months.
pub const BANKRUPT_AFTER_DISTRESS_MONTHS: u32 = 6;
/// Spec 5.12 step 2 (T): a Bankrupt company is frozen this many quarters, then removed at the
/// next release.
pub const FROZEN_QUARTERS: u32 = 2;

/// A company's status (spec 3.5, 5.12).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub enum CompanyStatus {
    #[default]
    Active,
    /// Cash below 0 with the line full (or an overdue excess): forced sales, no dividends,
    /// purchases stop (g = −d_eff at most).
    Distressed,
    /// Frozen: no revenue, no expenses, no decay, no line charges (D231); out of supply; price
    /// $0.00; equity 0.
    Bankrupt,
    /// Off lists, the map and the screens; filings stay in the archive.
    Removed,
}

impl CompanyStatus {
    /// Frozen or gone: the monthly jobs skip the company (spec 5.12 step 2; D231).
    pub fn is_frozen(self) -> bool {
        matches!(self, CompanyStatus::Bankrupt | CompanyStatus::Removed)
    }

    /// Spec 5.12 step 1: a Distressed company buys nothing (g = −d_eff at most).
    pub fn may_buy_assets(self) -> bool {
        self == CompanyStatus::Active
    }

    /// Spec 5.12 step 1, 5.17: only an Active company pays dividends.
    pub fn may_pay_dividends(self) -> bool {
        self == CompanyStatus::Active
    }
}

/// The distress counters (spec 3.5 `distress_months`, `status`, `frozen_quarters`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct DistressState {
    pub status: CompanyStatus,
    /// Consecutive months with cash below 0 after the line is exhausted (5.12 step 1).
    pub distress_months: u32,
    /// Full quarters spent Bankrupt (5.12 step 2).
    pub frozen_quarters: u32,
    /// True from bankruptcy until the close of the quarter it happened in, which does not
    /// count as a frozen quarter (D232).
    pub entry_quarter_open: bool,
}

/// What step 13 reads for one company (spec 4.3 step 13). Cash is after every flow of the
/// month (steps 9 to 12); gross and book are the company's (one unit in the MVP).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SettleInputs {
    pub cash: f64,
    pub line: CreditLine,
    /// Spec 6 min_cash ([`super::credit::min_cash`]).
    pub min_cash: f64,
    pub gross_assets: f64,
    pub asset_book: f64,
    /// The industry's sale factor this month (5.10).
    pub sale_factor: f64,
    pub state: DistressState,
}

/// What step 13 did. The ledger takes `line_change()`, the forced sale's proceeds and gain.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Settlement {
    /// Auto-draw (5.12).
    pub drawn: f64,
    /// Repaid on the excess over the limit, from cash and then from forced sale proceeds.
    pub excess_repaid: f64,
    /// The plan's auto-repay (6.5).
    pub plan_repaid: f64,
    /// Forced sale of a Distressed company (5.12 step 1); default when none.
    pub forced_sale: AssetSale,
    pub cash: f64,
    pub line: CreditLine,
    pub gross_assets: f64,
    pub asset_book: f64,
    pub state: DistressState,
    /// This month counted as a distress month.
    pub distress_month: bool,
    /// The company went Bankrupt this month (alert, headline, price $0.00, wipe).
    pub went_bankrupt: bool,
}

impl Settlement {
    /// Net line movement for the ledger: drawn less repaid.
    pub fn line_change(&self) -> f64 {
        self.drawn - self.excess_repaid - self.plan_repaid
    }
}

/// Step 13 (spec 5.12, 4.3 step 13): cash settles, then
///
/// 1. auto-draw: cash below 0 draws the shortfall, up to the limit;
/// 2. a review excess is repaid from cash, a third, a half and then all of it over its 3 months
///    (D224);
/// 3. the plan's auto-repay (6.5);
/// 4. distress: if cash is still below 0 with the line full, or the excess is overdue, the
///    company sells assets at the sale factor to cover it, counts a distress month and repays
///    the overdue excess from the proceeds; after 6 distress months, or with no assets left, it
///    is Bankrupt. A month that ends with cash at or above 0 and the line within its limit
///    resets the count. A month whose only problem is an excess still inside its repayment
///    window neither counts nor resets (D224); a month with cash below 0 and the line full
///    still counts, window or not.
///
/// Bankrupt and Removed companies are frozen and come back unchanged.
pub fn settle_month(i: &SettleInputs) -> Settlement {
    let mut out = Settlement {
        drawn: 0.0,
        excess_repaid: 0.0,
        plan_repaid: 0.0,
        forced_sale: AssetSale::default(),
        cash: i.cash,
        line: i.line,
        gross_assets: i.gross_assets,
        asset_book: i.asset_book,
        state: i.state,
        distress_month: false,
        went_bankrupt: false,
    };
    if i.state.status.is_frozen() {
        return out;
    }
    // 1. Auto-draw.
    out.drawn = auto_draw(out.cash, &out.line);
    out.cash += out.drawn;
    out.line.drawn += out.drawn;
    // 2. The review excess, from cash first.
    if out.line.excess() > 0.0 {
        let pay = excess_instalment(&out.line).min(out.cash.max(0.0));
        out.cash -= pay;
        out.line.drawn -= pay;
        out.excess_repaid += pay;
        out.line.excess_months_left = out.line.excess_months_left.saturating_sub(1);
    }
    // 3. The plan's auto-repay.
    out.plan_repaid = plan_repay(out.cash, out.line.drawn, i.min_cash);
    out.cash -= out.plan_repaid;
    out.line.drawn -= out.plan_repaid;
    // 4. Distress.
    let overdue = if out.line.excess_overdue() {
        out.line.excess()
    } else {
        0.0
    };
    let shortfall = (-out.cash).max(0.0) + overdue;
    if shortfall > 0.0 {
        let sale = sell_for_cash(out.gross_assets, out.asset_book, shortfall, i.sale_factor);
        out.gross_assets -= sale.capacity_sold;
        out.asset_book -= sale.book_sold;
        if sale.share >= 1.0 {
            out.gross_assets = 0.0;
            out.asset_book = 0.0;
        }
        out.cash += sale.proceeds;
        out.forced_sale = sale;
        let pay = overdue.min(out.cash.max(0.0));
        out.cash -= pay;
        out.line.drawn -= pay;
        out.excess_repaid += pay;
        out.distress_month = true;
        out.state.distress_months += 1;
        out.state.status = CompanyStatus::Distressed;
        if out.gross_assets <= 0.0 || out.state.distress_months >= BANKRUPT_AFTER_DISTRESS_MONTHS {
            out.state = bankrupt(out.state);
            out.went_bankrupt = true;
        }
    } else if out.cash >= 0.0 && out.line.drawn <= out.line.limit {
        out.state.distress_months = 0;
        out.state.status = CompanyStatus::Active;
    }
    if out.line.excess() <= 0.0 {
        out.line.excess_months_left = 0;
    }
    out
}

/// Enters Bankrupt (spec 5.12 step 2): frozen, the frozen count starts; the wipe itself is the
/// balance sheet's (equity 0, D230).
pub fn bankrupt(state: DistressState) -> DistressState {
    DistressState {
        status: CompanyStatus::Bankrupt,
        distress_months: state.distress_months,
        frozen_quarters: 0,
        entry_quarter_open: true,
    }
}

/// The quarter close (spec 4.4 Close and compile): a Bankrupt company counts a frozen quarter,
/// except for the quarter it went bankrupt in (D232).
pub fn on_quarter_close(state: DistressState) -> DistressState {
    let mut s = state;
    if s.status == CompanyStatus::Bankrupt {
        if s.entry_quarter_open {
            s.entry_quarter_open = false;
        } else {
            s.frozen_quarters += 1;
        }
    }
    s
}

/// Spec 5.12 step 3: removed at the first release after its 2 frozen quarters.
pub fn removal_due(state: DistressState) -> bool {
    state.status == CompanyStatus::Bankrupt && state.frozen_quarters >= FROZEN_QUARTERS
}

/// What removal did (spec 5.12 step 3, C30).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Removal {
    /// Everything sold at the Bust factor.
    pub sale: AssetSale,
    pub line_repaid: f64,
    /// Unpaid line written off by the bank (A).
    pub line_written_off: f64,
    /// Tax payable paid from what is left after the line.
    pub tax_paid: f64,
    /// Unpaid tax payable and negative cash written off with the line (D233).
    pub other_written_off: f64,
    /// Cash left after the line and tax, which leaves the game with the company (D233).
    pub residual_cash: f64,
    /// Gross assets returned to the industry's fringe_assets (C30): every unit's remaining
    /// capacity at cost.
    pub capacity_to_fringe: f64,
}

/// Removes a Bankrupt company (spec 5.12 step 3): its remaining assets sell at the Bust factor
/// (0.60) to repay the line, any unpaid line is written off, and its remaining gross assets go
/// back to the industry's fringe pool (C30; the one sale whose capacity stays in the game).
pub fn remove(state: DistressState, books: &Books, gross_assets: f64) -> (DistressState, Removal) {
    let sale = sell_all(gross_assets, books.asset_book, REMOVAL_SALE_FACTOR);
    let mut cash = books.cash + sale.proceeds;
    let line_repaid = books.line_drawn.max(0.0).min(cash.max(0.0));
    cash -= line_repaid;
    let tax_paid = books.tax_payable().max(0.0).min(cash.max(0.0));
    cash -= tax_paid;
    let removal = Removal {
        sale,
        line_repaid,
        line_written_off: books.line_drawn.max(0.0) - line_repaid,
        tax_paid,
        other_written_off: (books.tax_payable().max(0.0) - tax_paid) + (-cash).max(0.0),
        residual_cash: cash.max(0.0),
        capacity_to_fringe: gross_assets.max(0.0),
    };
    let state = DistressState {
        status: CompanyStatus::Removed,
        ..state
    };
    (state, removal)
}
