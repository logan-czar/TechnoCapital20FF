//! The weights that place a random startup event (spec 5.19.1): the industry weight
//! `w = f × (0.02 + h)²` and the HQ province weight `province weight × (1 + named companies of
//! the industry with HQ there) × 3 if a key city there lists the industry`, with the province
//! weight of 2-map 2.3.1 (`total development × $0.3B × G`).

use crate::rng::{DrawSource, Stream};
use crate::world::PhaseLabel;

/// Spec 5.19.1: h is this quarter's growth a year above a flat 6%.
pub const HEAT_HURDLE: f64 = 0.06;
/// Spec 5.19.1: `w = f × (0.02 + h)²`.
pub const HEAT_BASE: f64 = 0.02;
/// Spec 5.19.1: the fringe factor `clamp(1 + log10(fringe revenue in $B), 0.5, 5)`.
pub const FRINGE_FACTOR_MIN: f64 = 0.5;
pub const FRINGE_FACTOR_MAX: f64 = 5.0;
pub const USD_PER_BILLION: f64 = 1.0e9;
/// Quarters a year: `(1 + q_growth)^4 − 1` is the quarter's growth a year.
pub const QUARTERS_PER_YEAR: i32 = 4;
/// 2-map 2.3.1 (batch 119): province weight is total development × $0.3B × G.
pub const PROVINCE_WEIGHT_PER_DEVELOPMENT_USD: f64 = 0.3e9;
/// 2-map 2.3.1 (batch 160): G = sqrt(country GDP per head ÷ world GDP per head), clamped to
/// 0.1 to 4 as a safety only (D260; design fix 3: the README's batch 159 clamp of 0.2 to 3 on
/// the plain ratio is superseded).
pub const G_MIN: f64 = 0.1;
pub const G_MAX: f64 = 4.0;
/// Spec 5.19.1: a key city in the province that lists the industry triples the weight.
pub const KEY_CITY_MULT: f64 = 3.0;

/// h (spec 5.19.1): `max(0, (1 + q_growth)^4 − 1 − 6%)`.
pub fn heat(q_growth: f64) -> f64 {
    ((1.0 + q_growth).powi(QUARTERS_PER_YEAR) - 1.0 - HEAT_HURDLE).max(0.0)
}

/// The fringe factor f (spec 5.19.1): `clamp(1 + log10(fringe revenue in $B), 0.5, 5)`. A
/// fringe with no revenue reads the clamp floor, 0.5 (log10 of 0 is −∞; D261).
pub fn fringe_factor(fringe_revenue_usd: f64) -> f64 {
    if fringe_revenue_usd <= 0.0 {
        return FRINGE_FACTOR_MIN;
    }
    (1.0 + (fringe_revenue_usd / USD_PER_BILLION).log10())
        .clamp(FRINGE_FACTOR_MIN, FRINGE_FACTOR_MAX)
}

/// The industry weight w (spec 5.19.1): `f × (0.02 + h)²`, 0 for industries labeled Glut or
/// Bust.
pub fn industry_weight(q_growth: f64, fringe_revenue_usd: f64, label: PhaseLabel) -> f64 {
    if matches!(label, PhaseLabel::Glut | PhaseLabel::Bust) {
        return 0.0;
    }
    fringe_factor(fringe_revenue_usd) * (HEAT_BASE + heat(q_growth)).powi(2)
}

/// GDP per head (2-map 2.3.1): `gdp_usd_bn ÷ population_m` from countries.csv, in thousands of
/// USD a head; only its ratio to the world figure is used.
pub fn gdp_per_head(gdp_usd: f64, population: f64) -> f64 {
    if population > 0.0 {
        gdp_usd / population
    } else {
        0.0
    }
}

/// G (2-map 2.3.1, batch 160): `clamp(sqrt(country GDP per head ÷ world GDP per head), 0.1,
/// 4)`; the world figure is total GDP over total population (about $11,209).
pub fn wealth_factor(country_gdp_per_head: f64, world_gdp_per_head: f64) -> f64 {
    if world_gdp_per_head <= 0.0 {
        return G_MIN;
    }
    (country_gdp_per_head.max(0.0) / world_gdp_per_head)
        .sqrt()
        .clamp(G_MIN, G_MAX)
}

/// Province weight, USD (2-map 2.3.1): `total development × $0.3B × G`, with total
/// development = Commerce + Industry + Population.
pub fn province_weight(total_development: u32, g: f64) -> f64 {
    f64::from(total_development) * PROVINCE_WEIGHT_PER_DEVELOPMENT_USD * g
}

/// The HQ weight of a province for a startup in an industry (spec 5.19.1): `province weight ×
/// (1 + named companies of the industry with HQ there) × 3 if a key city there lists the
/// industry`.
pub fn hq_weight(province_weight: f64, named_here: u32, key_city_lists_industry: bool) -> f64 {
    let key = if key_city_lists_industry {
        KEY_CITY_MULT
    } else {
        1.0
    };
    province_weight.max(0.0) * (1.0 + f64::from(named_here)) * key
}

/// A weighted pick (gen stream): one uniform times the total, walked in the given order (id
/// order), so ties and float edges go to the earlier (lower id) entry. None, with no draw, when
/// the total weight is 0 (D261: an event with every industry weighing 0 does not fire).
pub fn weighted_pick(weights: &[f64], draws: &mut dyn DrawSource) -> Option<usize> {
    let total: f64 = weights.iter().map(|w| w.max(0.0)).sum();
    if total <= 0.0 || !total.is_finite() {
        return None;
    }
    let target = draws.uniform(Stream::Gen) * total;
    let mut acc = 0.0;
    let mut last = None;
    for (i, w) in weights.iter().enumerate() {
        let w = w.max(0.0);
        if w <= 0.0 {
            continue;
        }
        acc += w;
        last = Some(i);
        if target < acc {
            return Some(i);
        }
    }
    last
}
