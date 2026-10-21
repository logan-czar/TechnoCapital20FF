//! The daily market jobs at 00:00 (spec 4.2 steps 1 and 3; 3.10): the daily price bar, buzz
//! decay, and the reaction-week reversion toward V (21.3.1). The fair value refresh of step 2
//! is [`super::fair_value::fair_value`] on the stored basis (D243).

use serde::{Deserialize, Serialize};

use crate::time::Date;
use crate::time::calendar::QUARTER_FIRST_MONTHS;
use crate::time::quarter::{REACTION_FIRST_DAY, REACTION_LAST_DAY};

use super::jobs::EFV_ERROR_WIDTH;
use super::price::BUZZ_MAX;

/// Spec 4.2 step 1, 3.10 (3.3.5): buzz decays 25% a day.
pub const BUZZ_DAILY_DECAY: f64 = 0.25;
/// Spec 4.2 step 3 (21.3.1): each reaction-week day closes 20% of the gap between P and V.
pub const REACTION_REVERSION: f64 = 0.20;

/// A daily price bar (spec 3.10 `bars`): open, high, low and close, USD a share, and the
/// estimated fair value a share at the close (spec 8 Pdoomberg F3 "daily bars with the estimated
/// fair value band"; D424).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct DailyBar {
    /// The day the bar covers: the bar closed at 00:00 the next day.
    pub date: Date,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    /// EFV = V × (1 + e) at the close (3.14.2, D140, D150): the EFV in force through the day,
    /// read before the 4.2 step 2 fair value refresh. Its band is [`DailyBar::efv_low`] to
    /// [`DailyBar::efv_high`].
    pub efv: f64,
}

impl DailyBar {
    /// The bottom of the EFV band, EFV × (1 − 15%) (spec 8 F3, 3.14.2; D140).
    pub fn efv_low(&self) -> f64 {
        self.efv * (1.0 - EFV_ERROR_WIDTH)
    }

    /// The top of the EFV band, EFV × (1 + 15%).
    pub fn efv_high(&self) -> f64 {
        self.efv * (1.0 + EFV_ERROR_WIDTH)
    }
}

/// The bar being built through the day (spec 4.2 step 1; D248). Started at 00:00 after the
/// daily jobs with the price they leave; each hourly step that moves prices adds its price;
/// the 00:00 step that ends the day adds its price, then the daily job closes the bar.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct BarBuilder {
    pub date: Date,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub last: f64,
    /// True once an hourly step moved prices in the day (a market holiday has none).
    pub traded: bool,
}

impl BarBuilder {
    /// A new bar for `date` opening at `price` (the price after the 00:00 daily jobs).
    pub fn start(date: Date, price: f64) -> BarBuilder {
        BarBuilder {
            date,
            open: price,
            high: price,
            low: price,
            last: price,
            traded: false,
        }
    }

    /// Adds the price of an hourly step that moved prices (5.14).
    pub fn tick(&mut self, price: f64) {
        self.high = self.high.max(price);
        self.low = self.low.min(price);
        self.last = price;
        self.traded = true;
    }

    /// Closes the bar at 00:00 (spec 4.2 step 1) with the day's EFV a share (D424). A day with
    /// no trading tick (1 January, 3.1.0) leaves no bar (D248).
    pub fn close(self, efv: f64) -> Option<DailyBar> {
        self.traded.then_some(DailyBar {
            date: self.date,
            open: self.open,
            high: self.high,
            low: self.low,
            close: self.last,
            efv,
        })
    }
}

/// Buzz after a day's decay (spec 4.2 step 1): `buzz × (1 − 0.25)`, kept in −100 to +100.
pub fn decay_buzz(buzz: f64) -> f64 {
    (buzz * (1.0 - BUZZ_DAILY_DECAY)).clamp(-BUZZ_MAX, BUZZ_MAX)
}

/// True on the reaction-week reversion days (spec 4.2 step 3): the 3rd to the 8th of January,
/// April, July and October.
pub fn is_reversion_day(date: Date) -> bool {
    QUARTER_FIRST_MONTHS.contains(&date.month)
        && (REACTION_FIRST_DAY..=REACTION_LAST_DAY).contains(&date.day)
}

/// The reaction-week reversion (spec 4.2 step 3, 21.3.1): `P + 0.20 × (V − P)`, toward the
/// post-earnings fair value V (not V*: buzz moves only the hourly pull).
pub fn revert_toward_value(p: f64, v: f64) -> f64 {
    p + REACTION_REVERSION * (v - p)
}
