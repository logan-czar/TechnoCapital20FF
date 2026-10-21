//! Corporate tax (spec 5.11; 10.5.5; 5.1.2 and C28: tax is national): each quarter
//! `tax = max(0, pre-tax income − loss carryforward used) × corp_tax_rate` of the HQ country,
//! with losses carried forward without limit, accrued monthly (4.3 step 14) and paid at the
//! quarter close (4.4 Close and compile).
//!
//! The monthly accrual is cumulative (D227): each month accrues the quarter-to-date tax less
//! what earlier months of the quarter accrued, so a loss month after a profit month reverses
//! some accrual, and the three accruals always sum to exactly the tax paid at the close.

use serde::{Deserialize, Serialize};

/// One quarter's tax (spec 5.11).
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct QuarterTax {
    /// The quarter's pre-tax income.
    pub pre_tax_income: f64,
    /// Loss carryforward used against it: `min(carryforward, max(0, pre-tax income))`.
    pub carryforward_used: f64,
    /// `max(0, pre-tax income − carryforward used) × rate`.
    pub tax: f64,
    /// The quarter's loss, added to the carryforward.
    pub carryforward_added: f64,
    /// Carryforward after the quarter.
    pub carryforward_after: f64,
}

/// The tax on a quarter's pre-tax income with `carryforward` of past losses (spec 5.11).
pub fn quarter_tax(pre_tax_income: f64, carryforward: f64, rate: f64) -> QuarterTax {
    let cf = carryforward.max(0.0);
    let used = cf.min(pre_tax_income.max(0.0));
    let added = (-pre_tax_income).max(0.0);
    QuarterTax {
        pre_tax_income,
        carryforward_used: used,
        tax: (pre_tax_income - used).max(0.0) * rate,
        carryforward_added: added,
        carryforward_after: cf - used + added,
    }
}

/// A company's tax position (spec 5.11).
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct TaxBook {
    /// Unused losses, carried forward without limit.
    pub carryforward: f64,
    /// Pre-tax income of the quarter so far.
    pub quarter_pre_tax: f64,
    /// Tax accrued in the quarter so far (the balance sheet's tax payable).
    pub accrued: f64,
}

/// Accrues one month (spec 5.11, 4.3 step 14): adds the month's pre-tax income to the quarter and
/// returns this month's accrual (the tax line of its ledger), which may be below 0 (D227).
pub fn accrue_month(book: &mut TaxBook, month_pre_tax: f64, rate: f64) -> f64 {
    book.quarter_pre_tax += month_pre_tax;
    let to_date = quarter_tax(book.quarter_pre_tax, book.carryforward, rate).tax;
    let accrual = to_date - book.accrued;
    book.accrued = to_date;
    accrual
}

/// Closes the quarter (spec 5.11, 4.4 Close and compile): the tax paid is what was accrued; the
/// carryforward moves; the quarter's running figures reset.
pub fn close_quarter(book: &mut TaxBook, rate: f64) -> QuarterTax {
    let q = quarter_tax(book.quarter_pre_tax, book.carryforward, rate);
    book.carryforward = q.carryforward_after;
    book.quarter_pre_tax = 0.0;
    book.accrued = 0.0;
    q
}
