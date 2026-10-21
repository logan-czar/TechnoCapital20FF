//! The 26 zone exchanges' headline indices (spec 5.14; batches 152, 154; 3-markets 3.2.3): a
//! market-cap weighted index of the exchange's listed companies, 1,000 at load, kept by a
//! divisor so that a listing, a removal or a share issue never moves the level. An exchange
//! with no listed company shows no level (A).

use serde::{Deserialize, Serialize};

/// Spec 5.14: every headline index starts at 1,000.
pub const INDEX_BASE: f64 = 1000.0;
/// Spec 5.1.2: the index return feeds confidence in %.
pub const PERCENT: f64 = 100.0;

/// Market cap (spec 5.14): `price × shares_out`.
pub fn market_cap(price: f64, shares_out: u64) -> f64 {
    price * shares_out as f64
}

/// One exchange's headline index (spec 5.14; D250).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ExchangeIndex {
    /// `Σ cap ÷ divisor` is the level; `None` while the exchange has no listed company.
    pub divisor: Option<f64>,
    /// The last level shown, kept when the last company leaves so a later first listing
    /// resumes from it (D250); `INDEX_BASE` before any listing.
    pub last_level: f64,
    /// The level at the last daily close (00:00), for the day's return (5.1.2); `None` if the
    /// exchange showed no level then.
    pub prev_close: Option<f64>,
}

impl ExchangeIndex {
    /// The index at load (spec 5.14): 1,000 at the listed companies' total cap, or no level.
    pub fn at_load(total_cap: f64) -> ExchangeIndex {
        let mut i = ExchangeIndex {
            divisor: None,
            last_level: INDEX_BASE,
            prev_close: None,
        };
        i.rebase(total_cap, INDEX_BASE);
        i.prev_close = i.level(total_cap);
        i
    }

    fn rebase(&mut self, total_cap: f64, level: f64) {
        self.divisor = (total_cap > 0.0).then(|| total_cap / level);
    }

    /// The level at `total_cap` (spec 5.14): `Σ cap ÷ divisor`; `None` with no listing.
    pub fn level(&self, total_cap: f64) -> Option<f64> {
        self.divisor.map(|d| total_cap / d)
    }

    /// Keeps the level when the constituents change (a listing, a removal or delisting, a share
    /// issue): call with the total cap just before and just after the change, at the same prices
    /// (spec 5.14 "divisor kept on new listings"; D250). The new divisor is
    /// `old divisor × cap after ÷ cap before`, so the level does not jump. A first listing on an
    /// empty exchange starts at the last level shown (1,000 if none); the last company leaving
    /// keeps that level and shows none.
    pub fn reweight(&mut self, cap_before: f64, cap_after: f64) {
        let level = match self.level(cap_before) {
            Some(l) if cap_before > 0.0 => l,
            _ => self.last_level,
        };
        if cap_after > 0.0 {
            self.rebase(cap_after, level);
        } else {
            self.divisor = None;
        }
        self.last_level = level;
    }

    /// The daily return in % at the 00:00 close (spec 5.1.2 r_z): `(level ÷ previous close − 1)
    /// × 100`, 0 when either has no level (an exchange with no listed company has r 0); then the
    /// close moves to today's level.
    pub fn close_day(&mut self, total_cap: f64) -> f64 {
        let now = self.level(total_cap);
        if let Some(l) = now {
            self.last_level = l;
        }
        let r = match (self.prev_close, now) {
            (Some(prev), Some(now)) if prev > 0.0 => (now / prev - 1.0) * PERCENT,
            _ => 0.0,
        };
        self.prev_close = now;
        r
    }
}
