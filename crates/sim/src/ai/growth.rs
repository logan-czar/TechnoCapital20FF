//! The growth plan (spec 6.2): the annual net rate g from the situation table, the trait nudges,
//! the −20% to +30% clamp and the funding cap on the quarter's purchases (5.10).

use super::archetype::ArchetypeParams;
use super::inputs::has;
use crate::people::traits::Trait;

/// Spec 6.2 row 1: loss_q ≥ 4 sells down at −15% (2.23.2).
pub const SELL_DOWN_LOSS_QUARTERS: u32 = 4;
pub const SELL_DOWN_GROWTH: f64 = -0.15;
/// Spec 6.2 row 2: loss_q 2 to 3 shrinks at −5%.
pub const SHRINK_LOSS_QUARTERS: u32 = 2;
pub const SHRINK_GROWTH: f64 = -0.05;
/// Spec 6.2: `10 × max(0, S − 1)` comes off g_dem for an oversupplied industry.
pub const OVERSUPPLY_PENALTY: f64 = 10.0;
/// Spec 6.2 row 4: below the hurdle, growth is at most 2%.
pub const BELOW_HURDLE_MAX_GROWTH: f64 = 0.02;
/// Spec 6.2 row 5: ROA below 0 and loss_q under 2 holds at 0%.
pub const LOSS_HOLD_GROWTH: f64 = 0.0;
/// Spec 6.2 trait nudges (T), fractions a year.
pub const NUDGE_AMBITIOUS: f64 = 0.03;
pub const NUDGE_CONTENT: f64 = -0.01;
pub const NUDGE_CAUTIOUS: f64 = -0.02;
pub const NUDGE_BRAVE: f64 = 0.01;
/// Visionary +1 pp, in Tech only.
pub const NUDGE_VISIONARY_TECH: f64 = 0.01;
/// Spec 6.2 clamp.
pub const GROWTH_MIN: f64 = -0.20;
pub const GROWTH_MAX: f64 = 0.30;
/// Spec 6.2 funding cap: the quarter's purchases use at most 50% of liquidity above min_cash.
pub const FUNDING_CAP_SHARE: f64 = 0.5;
/// Quarters a year: the quarter's purchases are a quarter of the yearly rate (5.10).
pub const QUARTERS_PER_YEAR: f64 = 4.0;

/// The situation row's growth (spec 6.2 table), before the trait nudges.
///
/// | Situation | Growth |
/// |---|---|
/// | loss_q ≥ 4 | −15% |
/// | loss_q 2 to 3 | −5% |
/// | ROA ≥ hurdle | `g_dem − 10 × max(0, S − 1) + archetype adj` |
/// | 0 ≤ ROA < hurdle | `min(2%, g_dem − 10 × max(0, S − 1))` |
/// | ROA < 0 and loss_q < 2 | 0% |
pub fn situation_growth(
    loss_q: u32,
    roa: f64,
    g_dem: f64,
    supply_ratio: f64,
    archetype: &ArchetypeParams,
) -> f64 {
    if loss_q >= SELL_DOWN_LOSS_QUARTERS {
        return SELL_DOWN_GROWTH;
    }
    if loss_q >= SHRINK_LOSS_QUARTERS {
        return SHRINK_GROWTH;
    }
    let demand_led = g_dem - OVERSUPPLY_PENALTY * (supply_ratio - 1.0).max(0.0);
    if roa >= archetype.hurdle_roa {
        demand_led + archetype.growth_adj
    } else if roa >= 0.0 {
        BELOW_HURDLE_MAX_GROWTH.min(demand_led)
    } else {
        LOSS_HOLD_GROWTH
    }
}

/// The trait nudges (spec 6.2, T), summed: Ambitious +3 pp, Content −1 pp, Cautious −2 pp,
/// Brave +1 pp, Visionary +1 pp in Tech. `traits` are the ones the AI reads (the named
/// controller's; none for a born company, 5.19.5). They apply after every row (D263).
pub fn trait_nudge(traits: &[Trait], tech: bool) -> f64 {
    let mut n = 0.0;
    if has(traits, Trait::Ambitious) {
        n += NUDGE_AMBITIOUS;
    }
    if has(traits, Trait::Content) {
        n += NUDGE_CONTENT;
    }
    if has(traits, Trait::Cautious) {
        n += NUDGE_CAUTIOUS;
    }
    if has(traits, Trait::Brave) {
        n += NUDGE_BRAVE;
    }
    if tech && has(traits, Trait::Visionary) {
        n += NUDGE_VISIONARY_TECH;
    }
    n
}

/// What the funding cap reads (spec 6.2, 5.10).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FundingInputs {
    pub gross_assets: f64,
    /// `d_eff` of the unit (5.10): replacement, a fraction a year.
    pub d_eff: f64,
    /// Own cash + undrawn line (spec 6).
    pub liquidity: f64,
    pub min_cash: f64,
    /// Purchases are stopped (spec 5.12 step 1 Distressed, "g = −d_eff at most"; 6.6 "until a
    /// raise succeeds, 6.2 holds g at −d_eff"): g is capped at −d_eff.
    pub purchases_stopped: bool,
}

/// The quarter's planned purchases at growth `g` (spec 6.2, 5.10): `gross × (d_eff + g) ÷ 4`;
/// negative is a sale.
pub fn quarter_purchases(gross_assets: f64, d_eff: f64, g: f64) -> f64 {
    gross_assets * (d_eff + g) / QUARTERS_PER_YEAR
}

/// The funding cap (spec 6.2): the quarter's purchases may use at most 50% of liquidity above
/// min_cash; g is scaled down to fit, but not below −d_eff (no purchases). A g already at or
/// below −d_eff buys nothing and is left alone. With `purchases_stopped`, g is at most −d_eff.
pub fn funding_cap(g: f64, i: &FundingInputs) -> f64 {
    let floor = -i.d_eff;
    if i.purchases_stopped {
        return g.min(floor);
    }
    if g <= floor || i.gross_assets <= 0.0 {
        return g;
    }
    let budget = FUNDING_CAP_SHARE * (i.liquidity - i.min_cash).max(0.0);
    if quarter_purchases(i.gross_assets, i.d_eff, g) <= budget {
        return g;
    }
    (budget * QUARTERS_PER_YEAR / i.gross_assets - i.d_eff).clamp(floor, g)
}

/// Everything 6.2 reads.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GrowthInputs<'a> {
    pub loss_q: u32,
    pub roa: f64,
    pub g_dem: f64,
    pub supply_ratio: f64,
    pub archetype: ArchetypeParams,
    pub traits: &'a [Trait],
    pub tech: bool,
    pub funding: FundingInputs,
}

/// The locked growth plan g (spec 6.2): the situation row, plus the trait nudges, clamped to
/// −20% to +30%, then the funding cap.
pub fn growth_plan(i: &GrowthInputs<'_>) -> f64 {
    let g = situation_growth(i.loss_q, i.roa, i.g_dem, i.supply_ratio, &i.archetype)
        + trait_nudge(i.traits, i.tech);
    funding_cap(g.clamp(GROWTH_MIN, GROWTH_MAX), &i.funding)
}
