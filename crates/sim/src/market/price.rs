//! The hourly share price (spec 5.14; 3-markets 3.3.3, flow removed):
//! `P_next = P × (1 + 0.0003 × (V* ÷ P − 1) + noise)`, with
//! `noise = σh × (ρ × z_market + sqrt(1 − ρ²) × z_stock)`, one z_market per tick shared by all
//! 26 exchanges, 2% of draws 3 times as wide, the buzz term in V*, the reaction-week volatility
//! (21.3.1) and the market calendar: closed all of 1 January (3.1.0) and frozen on the 00:00
//! release tick (4.4, 21.2).

use crate::rng::{DrawSource, Stream};
use crate::time::DateTime;
use crate::time::calendar::QUARTER_FIRST_MONTHS;
use crate::time::quarter::{PRICE_MOVE_HOUR, REACTION_LAST_DAY, RELEASE_DAY};

/// Spec 5.14 (3.3.3): the pull toward V* per tick.
pub const PULL_PER_TICK: f64 = 0.0003;
/// Spec 5.14 (3.3.3): daily volatility is annual ÷ 19.1 (the square root of 365 trading days).
pub const DAYS_VOLATILITY_DIVISOR: f64 = 19.1;
/// Spec 5.14 (3.1.0): 24 ticks a day; hourly volatility is daily ÷ sqrt(24).
pub const TICKS_PER_DAY: f64 = 24.0;
/// Spec 5.14: `ρ = min(0.8, 0.5 × beta)`.
pub const RHO_PER_BETA: f64 = 0.5;
pub const RHO_MAX: f64 = 0.8;
/// Spec 5.14 (3.3.3): 2% of draws come from a distribution 3 times as wide (D246).
pub const FAT_TAIL_CHANCE: f64 = 0.02;
pub const FAT_TAIL_WIDTH: f64 = 3.0;
/// Spec 5.14: `V* = V × (1 + 0.10 × buzz ÷ 100)`.
pub const BUZZ_WEIGHT: f64 = 0.10;
/// Spec 3.10: buzz runs −100 to +100.
pub const BUZZ_MAX: f64 = 100.0;
/// Spec 21.3.1, 4.4: reaction-week hourly volatility ×2 on the release day ...
pub const REACTION_VOLATILITY_START: f64 = 2.0;
/// ... falling back to ×1 by day 7 of the week, the 8th (linear by day, D247).
pub const REACTION_VOLATILITY_END: f64 = 1.0;
/// Days from the release day (day 1 of the week) to day 7, over which the multiplier falls.
pub const REACTION_VOLATILITY_FADE_DAYS: f64 = 6.0;
/// The lowest price a step can leave, USD (the 5.13 per-share floor; D246).
pub const MIN_PRICE_USD: f64 = 0.01;

/// The sector table's annual volatility (3-markets 3.3.2), one shared default for all 42
/// industries (D1): 26%, the median of the 3.3.2 column (D245). Not industries.csv
/// `volatility`, which is the sd of the quarterly growth shock (5.1).
pub const SECTOR_VOLATILITY: f64 = 0.26;
/// The sector table's beta (3-markets 3.3.2), one shared default (D1): 1.0, the median of the
/// 3.3.2 column (D245).
pub const SECTOR_BETA: f64 = 1.0;

/// Hourly volatility σh (spec 5.14): `annual volatility ÷ 19.1 ÷ sqrt(24)`.
pub fn sigma_hourly(annual_volatility: f64) -> f64 {
    annual_volatility / DAYS_VOLATILITY_DIVISOR / TICKS_PER_DAY.sqrt()
}

/// Market correlation ρ (spec 5.14): `min(0.8, 0.5 × beta)`.
pub fn rho(beta: f64) -> f64 {
    (RHO_PER_BETA * beta).min(RHO_MAX)
}

/// True if prices move this tick (spec 4.1 step 2, 3.1.0, 4.4, 21.2): never on 1 January
/// (markets closed), nor on the 00:00 release tick of the 2nd of January, April, July and
/// October (prices frozen while the statements are read).
pub fn prices_move(t: DateTime) -> bool {
    let d = t.date();
    let holiday = d.month == 1 && d.day == 1;
    let release = QUARTER_FIRST_MONTHS.contains(&d.month) && d.day == RELEASE_DAY && t.hour() == 0;
    !holiday && !release
}

/// The reaction-week multiplier on hourly volatility (spec 4.4 row 2, 21.3.1): ×2 from the
/// 01:00 price move on the release day (day 1), falling linearly by day to ×1 on the 8th
/// (day 7) and after (D247). 1.0 outside the week.
pub fn reaction_volatility_mult(t: DateTime) -> f64 {
    let d = t.date();
    if !QUARTER_FIRST_MONTHS.contains(&d.month) || d.day < RELEASE_DAY || d.day > REACTION_LAST_DAY
    {
        return REACTION_VOLATILITY_END;
    }
    if d.day == RELEASE_DAY && t.hour() < PRICE_MOVE_HOUR {
        return REACTION_VOLATILITY_END;
    }
    let days_in = f64::from(d.day - RELEASE_DAY);
    REACTION_VOLATILITY_START
        - (REACTION_VOLATILITY_START - REACTION_VOLATILITY_END) * days_in
            / REACTION_VOLATILITY_FADE_DAYS
}

/// The buzz-adjusted target V* (spec 5.14): `V × (1 + 0.10 × buzz ÷ 100)`.
pub fn target_value(v: f64, buzz: f64) -> f64 {
    v * (1.0 + BUZZ_WEIGHT * buzz.clamp(-BUZZ_MAX, BUZZ_MAX) / BUZZ_MAX)
}

/// One fat-tailed standard draw (spec 5.14, D246): a prices-stream uniform decides the 2% wide
/// draw, then a prices-stream normal, ×3 when wide. The order (uniform, then normal) is frozen.
pub fn fat_tailed_normal(draws: &mut dyn DrawSource) -> f64 {
    let wide = draws.chance(Stream::Prices, FAT_TAIL_CHANCE);
    let z = draws.normal(Stream::Prices);
    if wide { FAT_TAIL_WIDTH * z } else { z }
}

/// The hourly noise of one stock (spec 5.14): `σh × m × (ρ × z_market + sqrt(1 − ρ²) × z_stock)`,
/// with m the [`reaction_volatility_mult`].
pub fn noise(sigma_h: f64, rho: f64, volatility_mult: f64, z_market: f64, z_stock: f64) -> f64 {
    sigma_h * volatility_mult * (rho * z_market + (1.0 - rho * rho).max(0.0).sqrt() * z_stock)
}

/// One hourly price step (spec 5.14): `P × (1 + 0.0003 × (V* ÷ P − 1) + noise)`, never below
/// $0.01 (D246).
pub fn step_price(p: f64, v_star: f64, noise: f64) -> f64 {
    let pull = if p > 0.0 {
        PULL_PER_TICK * (v_star / p - 1.0)
    } else {
        0.0
    };
    (p * (1.0 + pull + noise)).max(MIN_PRICE_USD)
}

/// What one listed stock reads on an hourly tick (spec 5.14).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StockTick {
    pub price: f64,
    /// Per-share fair value V (5.13).
    pub value: f64,
    pub buzz: f64,
    /// Annual volatility ([`SECTOR_VOLATILITY`] in the MVP).
    pub annual_volatility: f64,
    /// Beta ([`SECTOR_BETA`] in the MVP).
    pub beta: f64,
}

/// One tick's prices for every listed stock, in the order given (company id order, D2): the
/// shared z_market is drawn first, then each stock's z_stock in turn (spec 5.14; D246). Returns
/// the new prices; a closed tick ([`prices_move`] false) returns them unchanged and draws nothing.
pub fn step_prices(t: DateTime, stocks: &[StockTick], draws: &mut dyn DrawSource) -> Vec<f64> {
    if !prices_move(t) {
        return stocks.iter().map(|s| s.price).collect();
    }
    let mult = reaction_volatility_mult(t);
    let z_market = fat_tailed_normal(draws);
    stocks
        .iter()
        .map(|s| {
            let z_stock = fat_tailed_normal(draws);
            let n = noise(
                sigma_hourly(s.annual_volatility),
                rho(s.beta),
                mult,
                z_market,
                z_stock,
            );
            step_price(s.price, target_value(s.value, s.buzz), n)
        })
        .collect()
}
