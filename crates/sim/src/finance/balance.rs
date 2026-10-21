//! The balance sheet and its identity (spec 3.9, 3.5 `book_equity`; build-plan M4.9: the balance
//! sheet balances every month for every company still in the game).
//!
//! `total assets = total liabilities + estate + equity`. Liabilities are the drawn line and the
//! tax accrued but not yet paid (5.11, D227). Equity is the residual for an Active or Distressed
//! company. A Bankrupt company's shareholders are wiped (5.12 step 2), so its equity is exactly
//! 0 and the residual sits on the **estate** line, the bankruptcy estate that the removal sale
//! settles with the bank (D230); estate is 0 for every other company.
//!
//! [`check_month`] is what M4.9 calls: besides the identity it rolls each balance forward
//! through the month's ledger, so a cash, book, line or tax movement that skipped the ledger
//! shows up as an error.

use serde::{Deserialize, Serialize};

use super::distress::CompanyStatus;
use super::statements::Ledger;

/// Absolute tolerance of the balance checks, USD.
pub const BALANCE_TOLERANCE_USD: f64 = 0.01;
/// Relative tolerance on the largest balance (f64 sums of $1T books drift in the 4th decimal).
pub const BALANCE_TOLERANCE_RELATIVE: f64 = 1.0e-12;

/// The balances a company holds (spec 3.5): the raw state the balance sheet is read from.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct Books {
    /// Cash; below 0 only for a company that went bankrupt with no assets left to sell.
    pub cash: f64,
    /// Business assets at book (Σ units asset_book).
    pub asset_book: f64,
    pub line_drawn: f64,
    /// Tax accrued this quarter, not yet paid (5.11).
    pub tax_payable: f64,
}

/// Balance sheet lines (spec 3.9: cash; business assets at book; total assets; credit line
/// drawn; equity), with tax payable and the estate line (D227, D230).
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct BalanceSheet {
    pub cash: f64,
    pub asset_book: f64,
    pub total_assets: f64,
    pub line_drawn: f64,
    pub tax_payable: f64,
    pub total_liabilities: f64,
    /// A Bankrupt company's residual (assets − liabilities), held for the removal sale; 0
    /// otherwise.
    pub estate: f64,
    pub equity: f64,
}

impl BalanceSheet {
    /// Equity plus estate: what the owners' roll-forward tracks (the wipe moves equity to the
    /// estate and leaves this unchanged).
    pub fn residual(&self) -> f64 {
        self.equity + self.estate
    }
}

/// The balance sheet of `books` for a company in `status` (spec 3.9; D230).
pub fn balance_sheet(books: &Books, status: CompanyStatus) -> BalanceSheet {
    let total_assets = books.cash + books.asset_book;
    let total_liabilities = books.line_drawn + books.tax_payable;
    let residual = total_assets - total_liabilities;
    let (estate, equity) = if status == CompanyStatus::Bankrupt {
        (residual, 0.0)
    } else {
        (0.0, residual)
    };
    BalanceSheet {
        cash: books.cash,
        asset_book: books.asset_book,
        total_assets,
        line_drawn: books.line_drawn,
        tax_payable: books.tax_payable,
        total_liabilities,
        estate,
        equity,
    }
}

/// A balance check that failed: which line, what it should be and what it is.
#[derive(Debug, Clone, PartialEq)]
pub struct BalanceError {
    pub line: &'static str,
    pub expected: f64,
    pub actual: f64,
}

impl std::fmt::Display for BalanceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}: expected {} but found {} (off by {})",
            self.line,
            self.expected,
            self.actual,
            self.actual - self.expected
        )
    }
}

impl std::error::Error for BalanceError {}

fn tolerance(scale: f64) -> f64 {
    BALANCE_TOLERANCE_USD.max(BALANCE_TOLERANCE_RELATIVE * scale.abs())
}

fn scale_of(sheets: &[&BalanceSheet]) -> f64 {
    sheets
        .iter()
        .flat_map(|s| [s.cash, s.asset_book, s.line_drawn, s.tax_payable])
        .fold(0.0_f64, |m, x| m.max(x.abs()))
}

fn same(line: &'static str, expected: f64, actual: f64, scale: f64) -> Result<(), BalanceError> {
    if (expected - actual).abs() <= tolerance(scale) && expected.is_finite() && actual.is_finite() {
        Ok(())
    } else {
        Err(BalanceError {
            line,
            expected,
            actual,
        })
    }
}

/// The identity on one sheet: the totals add up, `total assets = total liabilities + estate +
/// equity`, and a Bankrupt company (`status`) has equity exactly 0 while others have no estate.
pub fn check_identity(s: &BalanceSheet, status: CompanyStatus) -> Result<(), BalanceError> {
    let scale = scale_of(&[s]);
    same("total assets", s.cash + s.asset_book, s.total_assets, scale)?;
    same(
        "total liabilities",
        s.line_drawn + s.tax_payable,
        s.total_liabilities,
        scale,
    )?;
    same(
        "assets = liabilities + estate + equity",
        s.total_assets,
        s.total_liabilities + s.estate + s.equity,
        scale,
    )?;
    if status == CompanyStatus::Bankrupt {
        same("bankrupt equity", 0.0, s.equity, scale)?;
    } else {
        same("estate", 0.0, s.estate, scale)?;
    }
    Ok(())
}

/// The month check of M4.9: the closing sheet satisfies the identity, and every balance rolls
/// forward from the opening sheet through the month's ledger (spec 3.9, 4.3 steps 9 to 14):
///
/// - cash: `opening + net change in cash`;
/// - assets at book: `opening + purchases − depreciation − book sold`;
/// - line: `opening + drawn or repaid`;
/// - tax payable: `opening + tax accrued − tax paid`;
/// - equity plus estate: `opening + net income + shares issued − dividends`.
pub fn check_month(
    opening: &BalanceSheet,
    month: &Ledger,
    closing: &BalanceSheet,
    closing_status: CompanyStatus,
) -> Result<(), BalanceError> {
    check_identity(closing, closing_status)?;
    let scale = scale_of(&[opening, closing]);
    same(
        "cash roll-forward",
        opening.cash + month.net_cash_change(),
        closing.cash,
        scale,
    )?;
    same(
        "asset book roll-forward",
        opening.asset_book + month.asset_purchases - month.depreciation - month.book_sold(),
        closing.asset_book,
        scale,
    )?;
    same(
        "credit line roll-forward",
        opening.line_drawn + month.line_drawn_or_repaid,
        closing.line_drawn,
        scale,
    )?;
    same(
        "tax payable roll-forward",
        opening.tax_payable + month.tax - month.tax_paid,
        closing.tax_payable,
        scale,
    )?;
    same(
        "equity roll-forward",
        opening.residual() + month.net_income() + month.shares_issued_net - month.dividends,
        closing.residual(),
        scale,
    )
}
