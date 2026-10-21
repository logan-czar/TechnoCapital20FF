//! The books a company carries in the World (spec 3.5 finance rows; build-plan M4): the credit
//! line, the rating, the distress counters, the tax book, the month being posted, the posted
//! months of the open quarter and the statement archives. The jobs in [`super::jobs`] move them;
//! every field derives serde, so saves and the state hash cover them.

use std::sync::Arc;

use serde::{Deserialize, Serialize};

use super::balance::BalanceSheet;
use super::credit::CreditLine;
use super::distress::{CompanyStatus, DistressState, Removal};
use super::rating::{ImpliedRating, Rating};
use super::statements::{ARCHIVE_QUARTERS, ARCHIVE_YEARS, Ledger, Statement, archive_push};
use super::tax::TaxBook;
use crate::time::{Date, Month};

/// One posted month (spec 3.5 `ledger_month`), with the month it closes.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct PostedMonth {
    pub month: Month,
    pub lines: Ledger,
}

/// A company's finance state (spec 3.5: cash sits on the company; line_drawn, line_limit,
/// rating, ledger_month, statements, distress_months, status, frozen_quarters here).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompanyFinance {
    /// Drawn, limit and the review's repayment window (spec 5.12).
    pub line: CreditLine,
    /// The current rating (spec 5.12), moved at the 01:00 release-day review.
    pub rating: Rating,
    /// The implied rating at the last review (or at load), with its breakdown (spec 5.12).
    pub implied: ImpliedRating,
    /// Notches the last review moved, better above 0 (spec 5.12, 3.6.4; the 2+ notch headline
    /// and confidence rule of 5.1.2 and 5.18 read it from M5).
    pub last_review_notches: i32,
    /// Status, distress months and frozen quarters (spec 3.5, 5.12).
    pub distress: DistressState,
    /// Loss carryforward and the quarter's accrual, the one tax payable (spec 5.11, D227).
    pub tax: TaxBook,
    /// Flows booked between monthly closes, whose cash already moved: a dividend paid at the
    /// plan lock (5.17, M6.3), shares issued (6.6). The next monthly close posts them in the
    /// month they fell in (D125).
    pub pending: Ledger,
    /// The month being posted through 4.3 steps 9 to 14.
    pub month: Ledger,
    /// The month runs: the company was not frozen when step 9 opened it (D231).
    pub month_active: bool,
    /// The posted months of the open quarter, oldest first (spec 4.4 compiles them).
    pub months: Vec<PostedMonth>,
    /// The last posted month (its tax paid includes the close's payment at a quarter end).
    pub last_month: Option<PostedMonth>,
    /// The balance sheet at the last month's close: the opening of the month being posted
    /// (build-plan M4.9).
    pub opening: BalanceSheet,
    /// The statement archive, shared with the statements view (copy on write, D130).
    pub archive: Arc<Archive>,
    /// The day the company went Bankrupt (spec 5.12 step 2).
    pub bankrupt_on: Option<Date>,
    /// The day it was removed (spec 5.12 step 3), with what removal did.
    pub removed_on: Option<Date>,
    pub removal: Option<Removal>,
}

impl CompanyFinance {
    /// The state before [`super::jobs::start`] sets the rating, limit and history: the line as
    /// drawn in company-start.csv, with no limit yet.
    pub fn at_load(line_drawn: f64) -> CompanyFinance {
        let unrated = ImpliedRating {
            leverage: Rating::WORST,
            cover_notches: 0,
            size_notches: 0,
            sector_notches: 0,
            adjusted: Rating::WORST,
            ceiling: Rating::WORST,
            implied: Rating::WORST,
        };
        CompanyFinance {
            line: CreditLine {
                drawn: line_drawn,
                limit: 0.0,
                excess_months_left: 0,
            },
            rating: Rating::WORST,
            implied: unrated,
            last_review_notches: 0,
            distress: DistressState::default(),
            tax: TaxBook::default(),
            pending: Ledger::default(),
            month: Ledger::default(),
            month_active: false,
            months: Vec::new(),
            last_month: None,
            opening: BalanceSheet::default(),
            archive: Arc::default(),
            bankrupt_on: None,
            removed_on: None,
            removal: None,
        }
    }

    /// Quarterly statements, oldest first (spec 4.5 step 2).
    pub fn quarters(&self) -> &[Statement] {
        &self.archive.quarters
    }

    /// Yearly statements, oldest first (D228).
    pub fn years(&self) -> &[Statement] {
        &self.archive.years
    }

    /// Archives a quarter's statement, keeping 20 (spec 4.5 step 2).
    pub fn push_quarter(&mut self, s: Statement) {
        archive_push(
            &mut Arc::make_mut(&mut self.archive).quarters,
            s,
            ARCHIVE_QUARTERS,
        );
    }

    /// Archives a year's statement, keeping 5 (D228).
    pub fn push_year(&mut self, s: Statement) {
        archive_push(
            &mut Arc::make_mut(&mut self.archive).years,
            s,
            ARCHIVE_YEARS,
        );
    }

    pub fn status(&self) -> CompanyStatus {
        self.distress.status
    }

    /// Still in the game: not Removed (build-plan M4.9 "every company still in the game").
    pub fn in_game(&self) -> bool {
        self.distress.status != CompanyStatus::Removed
    }
}

/// A company's statements (spec 3.5 `statements`, 4.5 step 2): quarters oldest first, at most
/// 20 (four synthetic 2019 quarters at load, 7.1, then one per close), and years oldest first,
/// at most 5. Held behind an `Arc` so the quarterly statements view shares it rather than
/// copying 651 archives five times a quarter (D130).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Archive {
    pub quarters: Vec<Statement>,
    pub years: Vec<Statement>,
}

/// The engine's own run of the build-plan M4.9 check: every company still in the game, every
/// month, `assets = liabilities + estate + equity` and every balance rolled through the month's
/// ledger ([`super::balance::check_month`]).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct BooksCheck {
    /// Company months checked.
    pub checked: u64,
    pub failures: u64,
    /// The first failure: company key, month and the check's message.
    pub first_failure: Option<String>,
}
