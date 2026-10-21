//! Each startup (spec 5.19.3, A, T): the size cap, the carve from the fringe, stations by the
//! 7.1 rules, the newborn fixed cost rate, the run rate its rating is implied from, the seed
//! round, shares by the 7.1 rule for private companies, the cap table and the archetype.

use serde::{Deserialize, Serialize};

use crate::ai::archetype::{Archetype, ArchetypeInputs, archetype};
use crate::economy::revenue::month_expenses;
use crate::economy::start::{fixed_cost_rate_at_load, shared_costs_at_load_hook};
use crate::finance::rating::{Rating, StartRatingInputs, starting_rating};
use crate::market::engine_value::{EngineValueInputs, engine_value_at_load};
use crate::ops::compute::compute_bill;
use crate::ops::labor::labor_units;
use crate::ops::stations::{
    LOADOUT_ENTERPRISE_DIVISOR_TB, LOADOUT_ENTERPRISE_SHARE, START_PRODUCTIVITY, Stations,
    loadout_productivity_stations, pc_bonus, productive_compute,
};
use crate::world::IndustryParams;
use crate::world::units::USD_PER_MILLION;

/// Spec 5.19.3: a startup under $1M of target revenue is skipped.
pub const MIN_STARTUP_REVENUE_USD: f64 = 1.0e6;
/// Spec 5.19.3: target revenue is capped at 2% of the fringe's revenue.
pub const FRINGE_REVENUE_CAP_SHARE: f64 = 0.02;
/// Spec 5.19.3 seed round: cash = 0.5 × gross_assets from the seed investors.
pub const SEED_CASH_SHARE: f64 = 0.5;
/// Spec 5.19.3 cap table: the founders hold 60% ...
pub const FOUNDERS_SHARE: f64 = 0.6;
/// ... the lead founder half of it, the others the rest in equal parts.
pub const LEAD_SHARE_OF_FOUNDERS: f64 = 0.5;
/// Spec 7.1 Shares row (batch 161; gen.py `PRICE_*`): `open_price = clamp(round($25 ×
/// (engine value ÷ $1B)^0.35 × jitter), $5, $200)`.
pub const PRICE_BASE_USD: f64 = 25.0;
pub const PRICE_REF_USD: f64 = 1.0e9;
pub const PRICE_EXP: f64 = 0.35;
pub const PRICE_MIN_USD: f64 = 5.0;
pub const PRICE_MAX_USD: f64 = 200.0;
/// Spec 7.1: jitter up to ±10%, seeded by the company id: gen.py's
/// `1 + 0.10 × (2 × (crc32("price:" + id) mod 10001) ÷ 10000 − 1)`.
pub const PRICE_JITTER: f64 = 0.10;
pub const PRICE_JITTER_KEY_PREFIX: &str = "price:";
pub const PRICE_JITTER_BUCKETS: u32 = 10_001;
pub const PRICE_JITTER_SCALE: f64 = 10_000.0;
/// Months a year.
pub const MONTHS_PER_YEAR: f64 = 12.0;

/// The fringe's revenue for the 5.19.3 cap: `fringe_assets × turnover`, a year at productivity
/// 100 and M 1.0, the same scale as the target revenue (D268).
pub fn fringe_revenue(fringe_assets: f64, turnover: f64) -> f64 {
    fringe_assets.max(0.0) * turnover
}

/// The startup's revenue (spec 5.19.3): the target capped at 2% of the fringe's revenue; None
/// (skipped) under $1M.
pub fn sized_revenue(target_revenue: f64, fringe_revenue: f64) -> Option<f64> {
    let r = target_revenue.min(FRINGE_REVENUE_CAP_SHARE * fringe_revenue.max(0.0));
    (r >= MIN_STARTUP_REVENUE_USD).then_some(r)
}

/// The carve (spec 5.19.3): `gross_assets = revenue × capital_per_dollar`, taken out of the
/// industry's fringe_assets, so supply is conserved before PC bonuses (the fringe and a unit at
/// productivity 100 supply the same per dollar, 5.2). Never more than the fringe holds.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Carve {
    pub gross_assets: f64,
    pub fringe_assets_after: f64,
}

pub fn carve(revenue: f64, capital_per_dollar: f64, fringe_assets: f64) -> Carve {
    let gross = (revenue * capital_per_dollar)
        .min(fringe_assets.max(0.0))
        .max(0.0);
    Carve {
        gross_assets: gross,
        fringe_assets_after: fringe_assets - gross,
    }
}

/// Labor units and stations by the 7.1 rules (spec 5.19.3 "Stations by the 7.1 rules"):
/// `L = floor(gross ÷ labor_value)`, productivity `max(1, round(0.25 × L))`, enterprise
/// `ceil(0.5 × R($M) × data_tb_per_musd ÷ 10.95)` capped at the labor left (D208), idle the
/// rest. The plan lock's 6.4 split replaces them the same day.
pub fn birth_stations(gross_assets: f64, revenue: f64, p: &IndustryParams) -> (u64, Stations) {
    let labor = labor_units(gross_assets, p.labor_value_usd);
    let prod = loadout_productivity_stations(labor).min(labor);
    let want = (LOADOUT_ENTERPRISE_SHARE * revenue / USD_PER_MILLION * p.data_tb_per_musd
        / LOADOUT_ENTERPRISE_DIVISOR_TB)
        .ceil()
        .max(0.0) as u64;
    let ent = want.min(labor - prod);
    (
        labor,
        Stations {
            productivity: prod,
            enterprise: ent,
            idle: labor - prod - ent,
            ..Stations::default()
        },
    )
}

/// The newborn's fixed cost rate (D269): the 7.1 rule at birth, `f × turnover − d_eff −
/// shared costs ÷ gross`, with the shared costs a year of the 3.8 bill on its birth stations
/// at 0 TB stored, so it breaks even at productivity 100 and M 1.0 like the 651.
pub fn birth_fixed_cost_rate(gross_assets: f64, stations: &Stations, p: &IndustryParams) -> f64 {
    let bill = compute_bill(stations, 0.0);
    fixed_cost_rate_at_load(gross_assets, shared_costs_at_load_hook(&bill), p)
}

/// The archetype of a startup (spec 5.19.3, 5.19.5): 6.1 without the trait rows, so a Tech
/// startup under $50M is a Startup, else Incumbent.
pub fn startup_archetype(revenue: f64, tech: bool) -> Archetype {
    archetype(&ArchetypeInputs {
        state_controlled: false,
        revenue_usd: revenue,
        tech,
        traits: &[],
    })
}

/// A year at the run rate (spec 5.19.3 "rating implied from the run rate"; 7.1).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct RunRate {
    pub pc_bonus: u32,
    pub revenue: f64,
    pub ebit: f64,
    pub ebitda: f64,
}

/// The newborn's run rate (D271): a year at productivity 100 plus its PC bonus, M 1.0 (the 7.1
/// run rate), with R&D at `rd_plan` and the 3.8 bill at 0 TB as shared costs.
pub fn birth_run_rate(
    gross_assets: f64,
    stations: &Stations,
    fixed_cost_rate: f64,
    rd_plan: f64,
    p: &IndustryParams,
) -> RunRate {
    let bonus = pc_bonus(productive_compute(stations, p.pc_modifier));
    let revenue = gross_assets * p.asset_turnover * (START_PRODUCTIVITY + f64::from(bonus))
        / START_PRODUCTIVITY;
    let shared = compute_bill(stations, 0.0).monthly_usd;
    let m = month_expenses(
        revenue / MONTHS_PER_YEAR,
        gross_assets,
        gross_assets,
        fixed_cost_rate,
        rd_plan,
        p,
        shared,
    );
    let ebit = revenue - MONTHS_PER_YEAR * m.total();
    RunRate {
        pc_bonus: bonus,
        revenue,
        ebit,
        ebitda: ebit + MONTHS_PER_YEAR * m.depreciation,
    }
}

/// The 7.1 price jitter of a company key (gen.py `price_jitter`): CRC-32 of `"price:" + key`.
pub fn price_jitter(key: &str) -> f64 {
    let mut crc = flate2::Crc::new();
    crc.update(PRICE_JITTER_KEY_PREFIX.as_bytes());
    crc.update(key.as_bytes());
    let bucket = crc.sum() % PRICE_JITTER_BUCKETS;
    1.0 + PRICE_JITTER * (2.0 * f64::from(bucket) / PRICE_JITTER_SCALE - 1.0)
}

/// The open price (spec 7.1 Shares row, batch 161): `clamp(round($25 × (value ÷ $1B)^0.35 ×
/// jitter), $5, $200)`, halves to even as gen.py's Python `round`.
pub fn open_price(engine_value: f64, key: &str) -> f64 {
    let p = PRICE_BASE_USD
        * (engine_value.max(0.0) / PRICE_REF_USD).powf(PRICE_EXP)
        * price_jitter(key);
    p.round_ties_even().clamp(PRICE_MIN_USD, PRICE_MAX_USD)
}

/// Shares for a value at a price (spec 7.1): `max(1, round(value ÷ open_price))`.
pub fn shares_for(value: f64, open_price: f64) -> u64 {
    ((value / open_price).round_ties_even() as u64).max(1)
}

/// The startup cap table (spec 5.19.3): founders 60% (the lead half of it, the others the rest
/// in equal parts), unnamed seed investors 40%. A lone founder holds all 60%; each founder's
/// shares round down and the seed investors take the remainder, so the parts sum to shares_out
/// (D270).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CapTable {
    /// Shares per founder, lead first.
    pub founders: Vec<u64>,
    pub seed_investors: u64,
}

impl CapTable {
    pub fn total(&self) -> u64 {
        self.founders.iter().sum::<u64>() + self.seed_investors
    }
}

pub fn cap_table(shares_out: u64, founders: usize) -> CapTable {
    let s = shares_out as f64;
    let shares: Vec<u64> = match founders {
        0 => Vec::new(),
        1 => vec![(FOUNDERS_SHARE * s).floor() as u64],
        n => {
            let lead = (FOUNDERS_SHARE * LEAD_SHARE_OF_FOUNDERS * s).floor() as u64;
            let each = (FOUNDERS_SHARE * (1.0 - LEAD_SHARE_OF_FOUNDERS) * s / (n - 1) as f64)
                .floor() as u64;
            std::iter::once(lead)
                .chain(std::iter::repeat_n(each, n - 1))
                .collect()
        }
    };
    let held: u64 = shares.iter().sum();
    CapTable {
        founders: shares,
        seed_investors: shares_out - held,
    }
}

/// What one startup's build reads besides its draft (spec 5.19.3).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BirthInputs<'a> {
    /// The new company's key (next CO- id); it seeds the 7.1 price jitter.
    pub key: &'a str,
    /// [`sized_revenue`], USD a year.
    pub revenue: f64,
    pub params: &'a IndustryParams,
    /// industries.csv id (the 5.12 sector notches).
    pub industry_key: &'a str,
    /// The industry's sector is Tech (6.1).
    pub tech: bool,
    /// The industry's fringe_assets before the carve.
    pub fringe_assets: f64,
    /// The HQ country's corporate tax rate and sovereign rating.
    pub tax_rate: f64,
    pub sovereign: Rating,
    pub base_rate: f64,
    /// The home spread at birth (effective zone spread, D271).
    pub home_spread: f64,
    /// The industry's current lt (g_sector, D1).
    pub g_sector: f64,
    /// `market::fair_value::book_floor_share` of the industry.
    pub book_floor_share: f64,
}

/// A built startup (spec 5.19.3), before its cast.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Birth {
    pub gross_assets: f64,
    /// = gross (newly bought), no ramping, productivity 100.
    pub asset_book: f64,
    /// The seed round, 0.5 × gross; no line drawn.
    pub cash: f64,
    pub fringe_assets_after: f64,
    pub labor: u64,
    pub stations: Stations,
    pub fixed_cost_rate: f64,
    pub archetype: Archetype,
    /// R&D at the 6.3 target with no traits, productivity 100 and no free R&D (0 TB), for the
    /// run rate.
    pub rd_plan: f64,
    pub run_rate: RunRate,
    pub rating: Rating,
    pub engine_value: f64,
    pub open_price: f64,
    pub shares_out: u64,
}

/// Builds a startup (spec 5.19.3): carve, stations, fixed cost rate, archetype, run rate,
/// rating implied from it (5.12, `starting_rating` with no line), engine value by the 7.1 rule
/// for a private company (X 1.0, Normal cycle, confidence 1.0), open price and shares.
pub fn build_startup(i: &BirthInputs<'_>) -> Birth {
    let c = carve(i.revenue, i.params.capital_per_dollar, i.fringe_assets);
    let gross = c.gross_assets;
    let (labor, stations) = birth_stations(gross, i.revenue, i.params);
    let fcr = birth_fixed_cost_rate(gross, &stations, i.params);
    let arch = startup_archetype(i.revenue, i.tech);
    let rd_plan = i.params.rd_norm * arch.params().rd_mult;
    let run = birth_run_rate(gross, &stations, fcr, rd_plan, i.params);
    let cash = SEED_CASH_SHARE * gross;
    let rating = starting_rating(&StartRatingInputs {
        cash,
        line_drawn: 0.0,
        ebitda: run.ebitda,
        revenue: run.revenue,
        industry_key: i.industry_key,
        sovereign: i.sovereign,
        base_rate: i.base_rate,
        home_spread: i.home_spread,
    })
    .implied;
    let value = engine_value_at_load(&EngineValueInputs {
        book_equity: cash + gross,
        run_rate_ebit: run.ebit,
        tax_rate: i.tax_rate,
        sector_multiple: i.params.earnings_multiple,
        g_sector: i.g_sector,
        home_spread: i.home_spread,
        listing_confidence: None,
        book_floor_share: i.book_floor_share,
    });
    let price = open_price(value, i.key);
    Birth {
        gross_assets: gross,
        asset_book: gross,
        cash,
        fringe_assets_after: c.fringe_assets_after,
        labor,
        stations,
        fixed_cost_rate: fcr,
        archetype: arch,
        rd_plan,
        run_rate: run,
        rating,
        engine_value: value,
        open_price: price,
        shares_out: shares_for(value, price),
    }
}
