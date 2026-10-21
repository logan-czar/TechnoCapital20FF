//! Fair value (spec 5.13; 10.0.8, 3.3.1; conflict C8): normalized earnings, the G, R and X
//! factors, the cycle and company confidence factors, the loss-maker path, the book and per-share
//! floors, and the private discount.
//!
//! The full recalculation at each release builds a [`FairValueBasis`] (E_norm and G) from the
//! statements; the daily refresh (4.2 step 2) reruns [`fair_value`] on that basis with the day's
//! book equity, cycle label, management confidence, home spread and exchange confidence (D243).

use serde::{Deserialize, Serialize};

use crate::world::PhaseLabel;

/// Spec 5.13 step 1: weight of TTM net income in E_norm.
pub const E_NORM_TTM_WEIGHT: f64 = 0.6;
/// Spec 5.13 step 1: weight of forward earnings, `TTM × (1 + g)`, in E_norm.
pub const E_NORM_FORWARD_WEIGHT: f64 = 0.4;
/// Spec 5.13 step 1: the 4-quarter revenue growth g is clamped to −30% to +60%.
pub const GROWTH_MIN: f64 = -0.30;
pub const GROWTH_MAX: f64 = 0.60;
/// Spec 5.13 step 2: `G = clamp(1 + 2.5 × (g − g_sector), 0.5, 2.5)`.
pub const G_SLOPE: f64 = 2.5;
pub const G_MIN: f64 = 0.5;
pub const G_MAX: f64 = 2.5;
/// Spec 5.13 step 2: `R = clamp(9% ÷ (y10 + 5%), 0.4, 1.6)`.
pub const R_NUMERATOR: f64 = 0.09;
pub const R_YIELD_ADD: f64 = 0.05;
pub const R_MIN: f64 = 0.4;
pub const R_MAX: f64 = 1.6;
/// Spec 5.13 step 2 (C24): `y10 = 3.5% + home_spread`.
pub const Y10_BASE: f64 = 0.035;
/// Spec 5.1.2, 5.13 step 2: `X = 1 + 0.10 × confidence_z ÷ 100` (T).
pub const X_CONFIDENCE_WEIGHT: f64 = 0.10;
/// Spec 5.1.2: the confidence scale is −100 to +100.
pub const CONFIDENCE_SCALE: f64 = 100.0;
/// Spec 5.13 step 3 (10.0.8): `0.3 × book equity + 0.7 × earnings value`.
pub const BOOK_WEIGHT: f64 = 0.3;
pub const EARNINGS_WEIGHT: f64 = 0.7;
/// Spec 5.13 step 3: cycle factor by the industry's phase label.
pub const CYCLE_FACTOR_BOOM: f64 = 1.2;
pub const CYCLE_FACTOR_NORMAL: f64 = 1.0;
pub const CYCLE_FACTOR_GLUT: f64 = 0.85;
pub const CYCLE_FACTOR_BUST: f64 = 0.7;
/// Spec 5.13 step 5 (3.3.1 step 6): floor at 0.6 × book equity, 0.9 for Real estate.
pub const BOOK_FLOOR_SHARE: f64 = 0.6;
pub const REAL_ESTATE_BOOK_FLOOR_SHARE: f64 = 0.9;
/// industries.csv id of the Real estate industry (the 0.9 floor of 5.13 step 5).
pub const REAL_ESTATE_KEY: &str = "real_estate";
/// Spec 5.13 step 5: never below $0.01 per share.
pub const MIN_VALUE_PER_SHARE_USD: f64 = 0.01;
/// Spec 5.13 step 6 (10.5.4): private companies show 0.7 × fair value.
pub const PRIVATE_DISCOUNT: f64 = 0.7;

/// The quarters of statements kept oldest first, as the archive holds them (4.5 step 2).
pub const QUARTERS_PER_YEAR: usize = 4;

/// g clamped to −30% to +60% (spec 5.13 step 1).
pub fn clamp_growth(g: f64) -> f64 {
    g.clamp(GROWTH_MIN, GROWTH_MAX)
}

/// The 4-quarter revenue growth g of spec 5.13 step 1, from quarterly revenues oldest first (the
/// archive, synthetic 2019 quarters included), unclamped (D241):
///
/// - with 8 or more quarters: the last four ÷ the four before − 1 (TTM over the prior TTM);
/// - with 5 to 7: the last `n − 4` quarters ÷ the same quarters a year earlier − 1;
/// - with 4 or fewer there is no year-ago figure and g is 0.
///
/// A year-ago revenue at or below 0 gives 0 if this year's is also at or below 0, else the top
/// of the clamp (+60%), so a company with no prior revenue never divides by 0.
pub fn revenue_growth(quarter_revenues: &[f64]) -> f64 {
    let n = quarter_revenues.len();
    if n <= QUARTERS_PER_YEAR {
        return 0.0;
    }
    let k = (n - QUARTERS_PER_YEAR).min(QUARTERS_PER_YEAR);
    let now: f64 = quarter_revenues[n - k..].iter().sum();
    let ago: f64 = quarter_revenues[n - k - QUARTERS_PER_YEAR..n - QUARTERS_PER_YEAR]
        .iter()
        .sum();
    if ago <= 0.0 {
        return if now <= 0.0 { 0.0 } else { GROWTH_MAX };
    }
    now / ago - 1.0
}

/// Normalized earnings (spec 5.13 step 1): `0.6 × TTM + 0.4 × TTM × (1 + g)`, g clamped.
pub fn e_norm(ttm_net_income: f64, g: f64) -> f64 {
    E_NORM_TTM_WEIGHT * ttm_net_income
        + E_NORM_FORWARD_WEIGHT * ttm_net_income * (1.0 + clamp_growth(g))
}

/// Growth factor (spec 5.13 step 2): `clamp(1 + 2.5 × (g − g_sector), 0.5, 2.5)`, g clamped
/// first; g_sector is the industry's lt (D1).
pub fn growth_factor(g: f64, g_sector: f64) -> f64 {
    (1.0 + G_SLOPE * (clamp_growth(g) - g_sector)).clamp(G_MIN, G_MAX)
}

/// The 10-year yield (spec 5.13 step 2, C24): `3.5% + home_spread`.
pub fn y10(home_spread: f64) -> f64 {
    Y10_BASE + home_spread
}

/// Rate factor (spec 5.13 step 2): `clamp(9% ÷ (y10 + 5%), 0.4, 1.6)`.
pub fn rate_factor(home_spread: f64) -> f64 {
    (R_NUMERATOR / (y10(home_spread) + R_YIELD_ADD)).clamp(R_MIN, R_MAX)
}

/// Exchange confidence factor (spec 5.1.2, 5.13 step 2): `1 + 0.10 × confidence_z ÷ 100` of
/// the listing exchange (0.9 to 1.1); `None` (a private company, which lists nowhere) is 1.0.
pub fn exchange_factor(listing_confidence: Option<f64>) -> f64 {
    listing_confidence.map_or(1.0, |c| {
        1.0 + X_CONFIDENCE_WEIGHT * c.clamp(-CONFIDENCE_SCALE, CONFIDENCE_SCALE) / CONFIDENCE_SCALE
    })
}

/// Cycle factor (spec 5.13 step 3): Boom 1.2, Normal 1.0, Glut 0.85, Bust 0.7.
pub fn cycle_factor(label: PhaseLabel) -> f64 {
    match label {
        PhaseLabel::Boom => CYCLE_FACTOR_BOOM,
        PhaseLabel::Normal => CYCLE_FACTOR_NORMAL,
        PhaseLabel::Glut => CYCLE_FACTOR_GLUT,
        PhaseLabel::Bust => CYCLE_FACTOR_BUST,
    }
}

/// Book floor share (spec 5.13 step 5): 0.9 for Real estate, else 0.6.
pub fn book_floor_share(industry_key: &str) -> f64 {
    if industry_key == REAL_ESTATE_KEY {
        REAL_ESTATE_BOOK_FLOOR_SHARE
    } else {
        BOOK_FLOOR_SHARE
    }
}

/// What the full recalculation at the release fixes until the next one (spec 4.2 step 2 "full
/// recalculation only at the release"; D243): normalized earnings and the growth factor.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct FairValueBasis {
    /// E_norm (5.13 step 1); `None` for a company with no statements yet (D253).
    pub e_norm: Option<f64>,
    /// G (5.13 step 2).
    pub growth_factor: f64,
}

impl FairValueBasis {
    /// The basis at a release (spec 5.13 steps 1 and 2): `ttm_net_income` is the trailing four
    /// quarters' net income (finance::statements::trailing_four, annualized `× 4 ÷ n` for a
    /// company born in play, `None` with no quarter, D228), `g` the [`revenue_growth`] and
    /// `g_sector` the industry's lt (D1).
    pub fn at_release(ttm_net_income: Option<f64>, g: f64, g_sector: f64) -> FairValueBasis {
        FairValueBasis {
            e_norm: ttm_net_income.map(|ni| e_norm(ni, g)),
            growth_factor: growth_factor(g, g_sector),
        }
    }
}

/// What a fair value reads besides its basis (spec 5.13).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FairValueInputs {
    pub basis: FairValueBasis,
    /// Book equity (3.5): cash + asset book − line drawn − tax payable (D227), the estate apart
    /// (D230).
    pub book_equity: f64,
    /// M_sector: industries.csv `earnings_multiple`.
    pub sector_multiple: f64,
    /// The HQ home spread (5.12, D223), a fraction.
    pub home_spread: f64,
    /// The company's industry phase label (5.1).
    pub label: PhaseLabel,
    /// The company's own confidence factor (5.7): `0.8 + score ÷ 250`.
    pub company_confidence: f64,
    /// The listing exchange's confidence, −100 to +100 (5.1.2); `None` for a private company.
    pub listing_confidence: Option<f64>,
    /// [`book_floor_share`] of the company's industry.
    pub book_floor_share: f64,
    pub shares_out: u64,
}

/// Total fair value (spec 5.13 steps 2 to 5):
///
/// - profit (E_norm above 0): `(0.3 × book + 0.7 × E_norm × M_sector × G × R × cycle ×
///   confidence) × X`;
/// - loss (E_norm at or below 0, or no statements, D253): `book × cycle × X`;
/// - then the floors: at least `floor share × book` (a negative book has no book floor, D242)
///   and at least $0.01 a share.
pub fn fair_value(i: &FairValueInputs) -> f64 {
    let x = exchange_factor(i.listing_confidence);
    let cycle = cycle_factor(i.label);
    let value = match i.basis.e_norm {
        Some(e) if e > 0.0 => {
            let multiple = i.sector_multiple * i.basis.growth_factor * rate_factor(i.home_spread);
            (BOOK_WEIGHT * i.book_equity
                + EARNINGS_WEIGHT * e * multiple * cycle * i.company_confidence)
                * x
        }
        _ => i.book_equity * cycle * x,
    };
    floored(value, i.book_equity, i.book_floor_share, i.shares_out)
}

/// The 5.13 step 5 floors: `max(value, floor share × max(book, 0), $0.01 × shares_out)` (D242).
pub fn floored(value: f64, book_equity: f64, book_floor_share: f64, shares_out: u64) -> f64 {
    value
        .max(book_floor_share * book_equity.max(0.0))
        .max(MIN_VALUE_PER_SHARE_USD * shares_out as f64)
}

/// Per-share value V (spec 5.13 step 6): `fair value ÷ shares_out`; 0 with no shares.
pub fn per_share(fair_value: f64, shares_out: u64) -> f64 {
    if shares_out == 0 {
        0.0
    } else {
        fair_value / shares_out as f64
    }
}

/// The value a company shows (spec 5.13 step 6, 10.5.4): a listed company its fair value, a
/// private one `0.7 × fair value`.
pub fn shown_value(fair_value: f64, listed: bool) -> f64 {
    if listed {
        fair_value
    } else {
        PRIVATE_DISCOUNT * fair_value
    }
}
