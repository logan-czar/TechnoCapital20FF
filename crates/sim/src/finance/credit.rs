//! The credit line (spec 5.12; 10.0.9; conflicts C9, C10, C23): limit, home spread and rate,
//! monthly interest, undrawn fee and interest on cash, auto-draw, auto-repay (6.5) and the
//! quarterly review with its 3-month excess repayment.

use serde::{Deserialize, Serialize};

use super::rating::{Rating, corporate_spread, rating_factor};
use crate::world::units::BPS_PER_UNIT;

/// Months in a year: the monthly charges are a twelfth of the yearly rate (spec 5.12).
pub const MONTHS_PER_YEAR: f64 = 12.0;
/// Spec 5.12 limit: `0.5 × asset_book`.
pub const ASSET_BOOK_ADVANCE: f64 = 0.5;
/// Spec 5.12 undrawn fee: 0.25% a year on the undrawn limit.
pub const UNDRAWN_FEE_RATE: f64 = 0.0025;
/// Spec 5.12 interest on own cash: `base_rate − 0.25%` (3.6.5 savings).
pub const CASH_RATE_DISCOUNT: f64 = 0.0025;
/// Spec 5.12 review (10.0.9): the excess over a new limit is repaid within 3 months.
pub const EXCESS_REPAY_MONTHS: u32 = 3;
/// Spec 5.1.2 home spread weights: half the zone's effective credit spread, half the HQ
/// country's sovereign spread.
pub const HOME_SPREAD_ZONE_WEIGHT: f64 = 0.5;
pub const HOME_SPREAD_SOVEREIGN_WEIGHT: f64 = 0.5;
/// Spec 6 min_cash: 5% of trailing annual revenue (T).
pub const MIN_CASH_SHARE_OF_REVENUE: f64 = 0.05;
/// Spec 6.5 repay row: own cash above 2 × min_cash and line drawn.
pub const REPAY_FROM_MIN_CASH_MULT: f64 = 2.0;
/// Spec 6.5 repay row: repay `min(drawn, own cash − 1.5 × min_cash)`.
pub const REPAY_KEEP_MIN_CASH_MULT: f64 = 1.5;

/// Own cash (spec 5.12, C10): `cash − line_drawn`, floored at 0.
pub fn own_cash(cash: f64, line_drawn: f64) -> f64 {
    (cash - line_drawn).max(0.0)
}

/// Credit line limit (spec 5.12, C10):
/// `max(0, 0.5 × asset_book + own cash) × rating_factor`.
pub fn line_limit(asset_book: f64, cash: f64, line_drawn: f64, rating: Rating) -> f64 {
    (ASSET_BOOK_ADVANCE * asset_book + own_cash(cash, line_drawn)).max(0.0) * rating_factor(rating)
}

/// Home spread, a fraction (spec 5.1.2 batch 156, 5.12): `0.5 × zone credit spread + 0.5 ×
/// sovereign spread`, rounded to whole basis points. `zone_spread` is the zone's effective spread
/// this quarter. Both inputs are whole bps in the data, so each is snapped to its bps first and
/// the half-bps result rounds half away from zero, as the effective zone spread does (D109,
/// D223): a Chilean company pays round((591 + 32) ÷ 2) = 312 bps.
pub fn home_spread(zone_spread: f64, sovereign_spread: f64) -> f64 {
    let zone_bps = (zone_spread * BPS_PER_UNIT).round();
    let sov_bps = (sovereign_spread * BPS_PER_UNIT).round();
    let bps = (HOME_SPREAD_ZONE_WEIGHT * zone_bps + HOME_SPREAD_SOVEREIGN_WEIGHT * sov_bps)
        .round();
    bps / BPS_PER_UNIT
}

/// Credit line rate, a year (spec 5.12, C9, C23): `base_rate + home_spread + corporate
/// spread(rating)`.
pub fn line_rate(base_rate: f64, home_spread: f64, rating: Rating) -> f64 {
    base_rate + home_spread + corporate_spread(rating)
}

/// One month's line charges and interest on cash (spec 5.12 "Monthly").
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct LineCharges {
    /// `line_drawn × rate ÷ 12`.
    pub interest: f64,
    /// `(limit − line_drawn) × 0.25% ÷ 12`; 0 when drawn at or over the limit.
    pub undrawn_fee: f64,
    /// `own cash × (base_rate − 0.25%) ÷ 12`, on positive own cash; never below 0.
    pub cash_interest: f64,
}

/// The month's charges (spec 5.12 "Monthly", 4.3 step 12) on the balances given (the month's
/// opening balances: cash settles only at step 13).
pub fn monthly_charges(
    line_drawn: f64,
    limit: f64,
    cash: f64,
    rate: f64,
    base_rate: f64,
) -> LineCharges {
    let drawn = line_drawn.max(0.0);
    LineCharges {
        interest: drawn * rate / MONTHS_PER_YEAR,
        undrawn_fee: (limit - drawn).max(0.0) * UNDRAWN_FEE_RATE / MONTHS_PER_YEAR,
        cash_interest: own_cash(cash, drawn) * (base_rate - CASH_RATE_DISCOUNT).max(0.0)
            / MONTHS_PER_YEAR,
    }
}

/// Minimum cash (spec 6): 5% of trailing annual revenue. 0 for a company with no revenue
/// (D226).
pub fn min_cash(trailing_revenue: f64) -> f64 {
    MIN_CASH_SHARE_OF_REVENUE * trailing_revenue.max(0.0)
}

/// The plan's auto-repay (spec 5.12 "per the plan", 6.5 base row): with own cash above
/// 2 × min_cash and the line drawn, repay `min(drawn, own cash − 1.5 × min_cash)`. The trait
/// rows of 6.5 (Cautious, Greedy, Brave) are the Lite AI's (M6). With min_cash 0 any own cash
/// repays (D226).
pub fn plan_repay(cash: f64, line_drawn: f64, min_cash: f64) -> f64 {
    let own = own_cash(cash, line_drawn);
    if line_drawn <= 0.0 || own <= REPAY_FROM_MIN_CASH_MULT * min_cash {
        return 0.0;
    }
    line_drawn
        .min(own - REPAY_KEEP_MIN_CASH_MULT * min_cash)
        .max(0.0)
}

/// A company's credit line (spec 3.5 `line_drawn`, `line_limit`).
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct CreditLine {
    pub drawn: f64,
    pub limit: f64,
    /// Months left to repay the excess over the limit set at the last review (spec 5.12,
    /// 10.0.9); 0 with no repayment window open. The excess itself is always
    /// `max(0, drawn − limit)`.
    pub excess_months_left: u32,
}

impl CreditLine {
    /// Drawn above the limit.
    pub fn excess(&self) -> f64 {
        (self.drawn - self.limit).max(0.0)
    }

    /// Undrawn limit left to draw.
    pub fn available(&self) -> f64 {
        (self.limit - self.drawn).max(0.0)
    }

    /// True when the excess over the limit is past its 3-month window (spec 5.12 review).
    pub fn excess_overdue(&self) -> bool {
        self.excess() > 0.0 && self.excess_months_left == 0
    }
}

/// The review at 01:00 on release days (spec 5.12, 4.4 price move): the limit is recomputed;
/// a company over its new limit gets 3 months to repay the excess. A review restarts the window
/// for the excess as it now stands (D224).
pub fn review_line(line: CreditLine, new_limit: f64) -> CreditLine {
    let mut out = CreditLine {
        limit: new_limit.max(0.0),
        ..line
    };
    out.excess_months_left = if out.excess() > 0.0 {
        EXCESS_REPAY_MONTHS
    } else {
        0
    };
    out
}

/// Auto-draw (spec 5.12): cash below 0 after the month draws the shortfall, up to the limit.
pub fn auto_draw(cash: f64, line: &CreditLine) -> f64 {
    if cash >= 0.0 {
        0.0
    } else {
        (-cash).min(line.available())
    }
}

/// This month's instalment of the excess over the limit (spec 5.12 review, 10.0.9): the excess
/// spread evenly over the months left in the window (D224); all of it once overdue.
pub fn excess_instalment(line: &CreditLine) -> f64 {
    let excess = line.excess();
    if line.excess_months_left == 0 {
        excess
    } else {
        excess / f64::from(line.excess_months_left)
    }
}
