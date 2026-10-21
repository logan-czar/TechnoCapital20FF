//! Asset decay and growth plan purchases and sales (spec 5.10, Logan batches 145 and 149; 4.3
//! step 11).
//!
//! - Yearly decay `decay_usd = asset_decay × max(0, gross_assets − threshold)`: 1% on the part
//!   above $10M only, so $50M decays $400k a year. Monthly the unit loses `decay_usd ÷ 12` of
//!   capacity at cost; the same amount comes off asset_book as depreciation, capped at the book.
//!   Ramping tranches decay with the rest (A).
//! - Purchases `= gross_assets × (d_eff + g) ÷ 12` with g the plan's annual net growth rate:
//!   above 0 buy (the growth part ramps at 80% for 6 months, replacement does not); below 0 sell
//!   `gross_assets × |d_eff + g| ÷ 12` of capacity, the same share of the book, for
//!   `book sold × sale factor` in cash. Cash moves at the 4.3 step 13 settle (M4); this step
//!   records the month's purchases, proceeds, gain and depreciation, which finance posts.

use super::MONTHS_PER_YEAR;
use crate::time::JobCtx;
use crate::world::{BusinessUnit, IndustryParams, PhaseLabel, Tranche, World};

/// New assets work at 80% while they ramp: `assets_eff = gross − 0.2 × ramping` (spec 5.2,
/// 10.0.4).
pub const RAMP_SHORTFALL: f64 = 0.2;
/// Month closes a growth purchase ramps for (spec 5.10, 10.0.4).
pub const RAMP_MONTHS: u32 = 6;
/// Cash per $1 of book sold, by the industry's phase label (spec 5.10, 10.0.7).
pub const SALE_FACTOR_BOOM: f64 = 1.00;
pub const SALE_FACTOR_NORMAL: f64 = 0.85;
pub const SALE_FACTOR_GLUT: f64 = 0.70;
pub const SALE_FACTOR_BUST: f64 = 0.60;

/// **Growth plan hook until the M6 Lite AI** (spec 6.2): the annual net growth rate every unit
/// runs before plans are locked. g = 0 holds the asset base flat, buying back each month's decay
/// (spec 5.10). The M6 plan lock (4.4 row 3) overwrites `growth_plan` and `rd_plan`.
pub const PLACEHOLDER_GROWTH_PLAN: f64 = 0.0;

/// The plan a unit runs until the Lite AI sets one (spec 6: "at load, plans use ... rd_norm for
/// R&D"): growth [`PLACEHOLDER_GROWTH_PLAN`], R&D at the norm. Returns `(growth_plan, rd_plan)`.
pub fn placeholder_plan(params: &IndustryParams) -> (f64, f64) {
    (PLACEHOLDER_GROWTH_PLAN, params.rd_norm)
}

/// Yearly asset decay in USD (spec 5.10).
pub fn decay_usd(gross_assets: f64, p: &IndustryParams) -> f64 {
    p.asset_decay * (gross_assets - p.asset_decay_threshold_usd).max(0.0)
}

/// `d_eff = decay_usd ÷ gross_assets` (spec 5.10); 0 for a unit with no assets.
pub fn d_eff(gross_assets: f64, p: &IndustryParams) -> f64 {
    if gross_assets > 0.0 {
        decay_usd(gross_assets, p) / gross_assets
    } else {
        0.0
    }
}

/// Cash per $1 of book sold (spec 5.10).
pub fn sale_factor(label: PhaseLabel) -> f64 {
    match label {
        PhaseLabel::Boom => SALE_FACTOR_BOOM,
        PhaseLabel::Normal => SALE_FACTOR_NORMAL,
        PhaseLabel::Glut => SALE_FACTOR_GLUT,
        PhaseLabel::Bust => SALE_FACTOR_BUST,
    }
}

/// What one unit's step 11 did.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct AssetMonth {
    /// Capacity lost to decay, at cost.
    pub decay: f64,
    /// Depreciation taken off the book.
    pub depreciation: f64,
    /// Purchases at cost (replacement plus growth).
    pub purchases: f64,
    /// The growth part, which ramps.
    pub ramping_added: f64,
    /// Capacity sold, at cost.
    pub sold: f64,
    pub book_sold: f64,
    pub proceeds: f64,
    /// proceeds − book sold.
    pub gain: f64,
}

/// Scales every tranche by `keep` (decay and sales take the same share of ramping assets).
fn scale_ramping(ramping: &mut [Tranche], keep: f64) {
    for t in ramping {
        t.amount *= keep;
    }
}

/// One unit's month of 5.10: decay, ramping ages, then the plan buys or sells. Purchases and
/// sales are sized on the gross assets before this month's decay, so g = 0 buys back exactly the
/// decay and holds the base flat.
pub fn apply_asset_month(
    unit: &mut BusinessUnit,
    params: &IndustryParams,
    label: PhaseLabel,
) -> AssetMonth {
    apply_asset_month_buying(unit, params, label, true)
}

/// [`apply_asset_month`] with `may_buy` false for a Distressed company (spec 5.12 step 1:
/// purchases stop, g = −d_eff at most): the plan's month is capped at 0, so a plan that would buy
/// buys nothing (the base shrinks by decay alone) and one that sells still sells.
pub fn apply_asset_month_buying(
    unit: &mut BusinessUnit,
    params: &IndustryParams,
    label: PhaseLabel,
    may_buy: bool,
) -> AssetMonth {
    let mut out = AssetMonth::default();
    let g = unit.growth_plan;
    let gross0 = unit.gross_assets;
    let yearly_decay = decay_usd(gross0, params);
    // Decay: a real loss of capacity at cost; depreciation off the book (5.5, 5.10).
    out.decay = yearly_decay / MONTHS_PER_YEAR;
    out.depreciation = unit.asset_book.min(out.decay);
    if gross0 > 0.0 {
        scale_ramping(&mut unit.ramping, 1.0 - out.decay / gross0);
    }
    unit.gross_assets -= out.decay;
    unit.asset_book -= out.depreciation;
    // Ramping tranches age one month.
    for t in &mut unit.ramping {
        t.months_left = t.months_left.saturating_sub(1);
    }
    unit.ramping.retain(|t| t.months_left > 0);
    // The plan: replacement first, then growth (spec 5.10).
    let mut plan = (yearly_decay + gross0 * g) / MONTHS_PER_YEAR;
    if !may_buy {
        plan = plan.min(0.0);
    }
    if plan > 0.0 {
        out.purchases = plan;
        unit.gross_assets += plan;
        unit.asset_book += plan;
        if g > 0.0 {
            out.ramping_added = gross0 * g / MONTHS_PER_YEAR;
            unit.ramping.push(Tranche {
                amount: out.ramping_added,
                months_left: RAMP_MONTHS,
            });
        }
    } else if plan < 0.0 && unit.gross_assets > 0.0 {
        out.sold = (-plan).min(unit.gross_assets);
        let share = out.sold / unit.gross_assets;
        out.book_sold = unit.asset_book * share;
        out.proceeds = out.book_sold * sale_factor(label);
        out.gain = out.proceeds - out.book_sold;
        unit.gross_assets -= out.sold;
        unit.asset_book -= out.book_sold;
        scale_ramping(&mut unit.ramping, 1.0 - share);
    }
    unit.capex_m = out.purchases;
    unit.sale_proceeds_m = out.proceeds;
    unit.sale_gain_m = out.gain;
    // The depreciation the book actually lost, which the ledger posts (5.5; equal to step 9's).
    unit.dep_m = out.depreciation;
    out
}

/// 4.3 step 11 (economy part): asset decay, the growth plan's buys and sells, ramping. A
/// Distressed company buys nothing (g = −d_eff at most, spec 5.12 step 1); a frozen one (Bankrupt
/// or Removed) has no decay and no plan (5.12 step 2, D231, D123).
pub fn assets_job(world: &mut World, _: &mut JobCtx<'_>) {
    for (_, unit) in world.units.iter_mut() {
        let ind = &world.industries[unit.industry];
        let status = world.companies[unit.company].finance.status();
        if status.is_frozen() {
            unit.capex_m = 0.0;
            unit.sale_proceeds_m = 0.0;
            unit.sale_gain_m = 0.0;
            unit.dep_m = 0.0;
            continue;
        }
        apply_asset_month_buying(unit, &ind.params, ind.phase_label, status.may_buy_assets());
    }
}
