//! Stations, productive compute and the PC bonus (spec 5.8), the Lite AI station split (6.4)
//! and the starting loadout (7.1; C16).

use serde::{Deserialize, Serialize};

use super::data::{CONVERT_TB_PER_STATION, FIFTY_FIFTY_SHARE};
use super::labor::labor_units;

/// How a corporation's labor units are assigned (spec 3.5 `labor_assignment`): one station per
/// labor unit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Stations {
    pub productivity: u64,
    pub enterprise: u64,
    /// Half productivity, half enterprise (the CEO's split at L = 1, 6.4 step 5).
    pub fifty_fifty: u64,
    pub research: u64,
    pub idle: u64,
}

impl Stations {
    pub fn total(&self) -> u64 {
        self.productivity + self.enterprise + self.fifty_fifty + self.research + self.idle
    }

    /// Enterprise licences (spec 3.8): one per enterprise or 50/50 station.
    pub fn licences(&self) -> u64 {
        self.enterprise + self.fifty_fifty
    }
}

/// Productive compute (spec 5.8): `(productivity stations + 0.5 × 50/50 stations) × pc_modifier`,
/// with the main industry's modifier since stations are pooled.
pub fn productive_compute(stations: &Stations, pc_modifier: f64) -> f64 {
    (stations.productivity as f64 + FIFTY_FIFTY_SHARE * stations.fifty_fifty as f64) * pc_modifier
}

/// Spec 5.8: PC at which the bonus starts (+1).
pub const PC_BONUS_FIRST_STEP: f64 = 1.0;
/// Spec 5.8: one more point per 10× of PC.
pub const PC_BONUS_STEP_FACTOR: f64 = 10.0;

/// The stepped PC bonus (spec 5.8): `floor(1 + log10(PC))` for PC ≥ 1, else 0, in points of
/// productivity. Counted by comparing with exact powers of ten, so PC 10, 100, ... land on their
/// step whatever `log10` rounds to.
pub fn pc_bonus(pc: f64) -> u32 {
    decade_steps(pc, PC_BONUS_FIRST_STEP, PC_BONUS_STEP_FACTOR)
}

/// `floor(1 + log10(x / first))` for x ≥ first, else 0, by exact comparisons (5.8, 5.9 steps).
pub(crate) fn decade_steps(x: f64, first: f64, factor: f64) -> u32 {
    if x.is_nan() || x < first {
        return 0;
    }
    let mut steps = 1;
    let mut next = first * factor;
    while x >= next && next.is_finite() {
        steps += 1;
        next *= factor;
    }
    steps
}

/// Spec 6.4 step 1: productivity stations are the largest power of ten at most this share of L.
pub const SPLIT_PRODUCTIVITY_SHARE: f64 = 0.4;
/// Spec 6.4 step 3: a Visionary controller puts this percent of what is left into research.
pub const SPLIT_VISIONARY_RESEARCH_PERCENT: u64 = 10;
/// Integer percent divisor for the 6.4 shares.
const PERCENT: u64 = 100;
/// Spec 6.4 step 4: keep at least this share of L idle (decay 0.4)...
pub const SPLIT_MIN_IDLE_PERCENT: u64 = 10;
/// ...once L is at least this.
pub const SPLIT_MIN_IDLE_FROM_LABOR: u64 = 10;
/// Spec 6.4 step 5: the CEO splits 50/50 only at full data coverage.
pub const SPLIT_FIFTY_FIFTY_COVERAGE: f64 = 1.0;

/// What the 6.4 split reads.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SplitInputs {
    /// Labor units L.
    pub labor: u64,
    /// Data coverage from the archetype table (6.1): 0.25, 0.5 or 1.0.
    pub coverage: f64,
    /// Monthly unstructured inflow, TB (5.9 step 2: revenue $M × data_tb_per_musd ÷ 12).
    pub inflow_tb: f64,
    /// The named controller is Visionary (6.4 step 3).
    pub visionary: bool,
}

/// The Lite AI station split (spec 6.4).
///
/// 1. P: the largest 10^k at most 40% of L, minimum 1.
/// 2. E: `ceil(coverage × inflow ÷ 0.9125)`, capped at the labor left.
/// 3. R: Visionary controllers put 10% of what is left (rounded down, D207) into research.
/// 4. Idle: the rest; if it would fall under 10% of L (rounded up, so the 0.4 idle decay of 5.6
///    holds; D207) and L ≥ 10, cut E first, then R.
/// 5. 50/50: at L = 1 and coverage 100%, the CEO's one station is 50/50 instead of
///    productivity (D207).
pub fn station_split(inp: SplitInputs) -> Stations {
    let l = inp.labor.max(1);
    if l == 1 {
        let split = inp.coverage >= SPLIT_FIFTY_FIFTY_COVERAGE;
        return Stations {
            productivity: u64::from(!split),
            fifty_fifty: u64::from(split),
            ..Stations::default()
        };
    }
    let p = largest_power_of_ten_at_most(SPLIT_PRODUCTIVITY_SHARE * l as f64).max(1);
    let left = l - p;
    let e_want = (inp.coverage * inp.inflow_tb / CONVERT_TB_PER_STATION).ceil();
    let mut e = if e_want.is_finite() && e_want > 0.0 {
        (e_want as u64).min(left)
    } else {
        0
    };
    let mut r = if inp.visionary {
        (left - e) * SPLIT_VISIONARY_RESEARCH_PERCENT / PERCENT
    } else {
        0
    };
    if l >= SPLIT_MIN_IDLE_FROM_LABOR {
        let min_idle = (l * SPLIT_MIN_IDLE_PERCENT).div_ceil(PERCENT);
        let mut short = min_idle.saturating_sub(left - e - r);
        let cut_e = short.min(e);
        e -= cut_e;
        short -= cut_e;
        r -= short.min(r);
    }
    Stations {
        productivity: p,
        enterprise: e,
        fifty_fifty: 0,
        research: r,
        idle: l - p - e - r,
    }
}

/// The largest 1, 10, 100, ... at most `x`, or 0 when x < 1 (spec 6.4 step 1).
fn largest_power_of_ten_at_most(x: f64) -> u64 {
    if x.is_nan() || x < 1.0 {
        return 0;
    }
    let mut p: u64 = 1;
    while let Some(next) = p.checked_mul(10) {
        if next as f64 > x {
            break;
        }
        p = next;
    }
    p
}

/// Spec 7.1: starting productivity stations `max(1, round(0.25 × L))`.
pub const LOADOUT_PRODUCTIVITY_SHARE: f64 = 0.25;
/// Spec 7.1, C16: starting enterprise stations `ceil(0.5 × R × data_tb_per_musd ÷ 10.95)`.
pub const LOADOUT_ENTERPRISE_SHARE: f64 = 0.5;
/// Spec 7.1: Arrowhead (CO-0001) uses 0.1 in place of 0.5, for its enterprise stations and its
/// structured data share.
pub const ARROWHEAD_ENTERPRISE_SHARE: f64 = 0.1;
/// Spec 7.1: the company that uses [`ARROWHEAD_ENTERPRISE_SHARE`].
pub const ARROWHEAD_KEY: &str = "CO-0001";
/// Spec C16: a station's yearly conversion, TB (12 × 0.9125).
pub const LOADOUT_ENTERPRISE_DIVISOR_TB: f64 = 10.95;
/// Spec 7.1: revenue below which a company gets the barebones loadout ($0.1M), USD.
pub const BAREBONES_REVENUE_USD: f64 = 0.1e6;
/// Spec 7.1, 10.0.11.1: the barebones company's one asset, USD.
pub const BAREBONES_ASSETS_USD: f64 = 100_000.0;
/// Spec 7.1: productivity at load.
pub const START_PRODUCTIVITY: f64 = 100.0;
/// Spec 7.1: the PC bonus is found by iterating the station rule twice.
pub const LOADOUT_BONUS_PASSES: usize = 2;

/// What the 7.1 loadout reads about one company and its industry.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LoadoutInputs {
    /// Starting revenue R, USD a year.
    pub revenue_usd: f64,
    pub capital_per_dollar: f64,
    pub labor_value_usd: f64,
    pub pc_modifier: f64,
    pub data_tb_per_musd: f64,
    /// Location bonus points (5.4; 0 for every unit in the MVP).
    pub location_bonus: f64,
    /// 0.5, or [`ARROWHEAD_ENTERPRISE_SHARE`] for Arrowhead (7.1).
    pub enterprise_share: f64,
}

/// The starting loadout of one company (spec 7.1).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Loadout {
    pub gross_assets_usd: f64,
    pub labor: u64,
    pub stations: Stations,
    pub pc: f64,
    /// The PC bonus of the final stations (what 5.8 gives from now on).
    pub pc_bonus: u32,
    /// The second-pass bonus the gross assets were set with (7.1); equal to `pc_bonus` unless
    /// the two passes have not settled (design fix 201). It holds until the first monthly
    /// recount, and the load revenue check (M2.6) reads it. 0 for the barebones loadout, whose
    /// $100,000 asset is fixed rather than sized from a bonus (its live `pc_bonus` is +1 from
    /// PC 1).
    pub assets_bonus: u32,
    /// The first-pass bonus (from gross assets at bonus 0), for checks; 0 for barebones.
    pub first_pass_bonus: u32,
    pub barebones: bool,
}

/// The 7.1 starting productivity stations for `labor` units: `max(1, round(0.25 × L))`, rounding
/// halves to even as validate.py and gen.py do (Python `round`; D208).
pub fn loadout_productivity_stations(labor: u64) -> u64 {
    ((LOADOUT_PRODUCTIVITY_SHARE * labor as f64).round_ties_even() as u64).max(1)
}

/// The PC bonus of the 7.1 station rule at `gross` assets (productivity stations only).
fn loadout_bonus(gross: f64, inp: &LoadoutInputs) -> u32 {
    let labor = labor_units(gross, inp.labor_value_usd);
    let p = loadout_productivity_stations(labor);
    pc_bonus(p as f64 * inp.pc_modifier)
}

/// Gross assets that make exactly R at M 1.0 (spec 7.1):
/// `R × capital_per_dollar × 100 ÷ (100 + PC bonus + location bonus)`.
fn loadout_gross(inp: &LoadoutInputs, bonus: u32) -> f64 {
    inp.revenue_usd * inp.capital_per_dollar * START_PRODUCTIVITY
        / (START_PRODUCTIVITY + f64::from(bonus) + inp.location_bonus)
}

/// The starting loadout (spec 7.1): the PC bonus from the station rule at productivity 100,
/// iterated twice (first pass at bonus 0, second at the first pass's bonus, D208); gross assets
/// from the second-pass bonus; labor units; productivity stations `max(1, round(0.25 × L))`;
/// enterprise stations `ceil(share × R($M) × data_tb_per_musd ÷ 10.95)` (C16), capped at the
/// labor left (D208); idle the rest. Below $0.1M of revenue: the barebones loadout, one $100,000
/// asset, one labor unit with the CEO on productivity (10.0.11.1).
pub fn starting_loadout(inp: LoadoutInputs) -> Loadout {
    if inp.revenue_usd < BAREBONES_REVENUE_USD {
        let stations = Stations {
            productivity: 1,
            ..Stations::default()
        };
        let pc = productive_compute(&stations, inp.pc_modifier);
        return Loadout {
            gross_assets_usd: BAREBONES_ASSETS_USD,
            labor: 1,
            stations,
            pc,
            pc_bonus: pc_bonus(pc),
            // The fixed $100,000 asset is not sized from any bonus, so no pass ran.
            assets_bonus: 0,
            first_pass_bonus: 0,
            barebones: true,
        };
    }
    let mut bonus = 0;
    let mut first_pass_bonus = 0;
    for pass in 0..LOADOUT_BONUS_PASSES {
        bonus = loadout_bonus(loadout_gross(&inp, bonus), &inp);
        if pass == 0 {
            first_pass_bonus = bonus;
        }
    }
    let gross = loadout_gross(&inp, bonus);
    let labor = labor_units(gross, inp.labor_value_usd);
    let p = loadout_productivity_stations(labor).min(labor);
    let r_musd = inp.revenue_usd / crate::world::units::USD_PER_MILLION;
    let e_want = (inp.enterprise_share * r_musd * inp.data_tb_per_musd
        / LOADOUT_ENTERPRISE_DIVISOR_TB)
        .ceil()
        .max(0.0) as u64;
    let e = e_want.min(labor - p);
    let stations = Stations {
        productivity: p,
        enterprise: e,
        idle: labor - p - e,
        ..Stations::default()
    };
    let pc = productive_compute(&stations, inp.pc_modifier);
    Loadout {
        gross_assets_usd: gross,
        labor,
        stations,
        pc,
        pc_bonus: pc_bonus(pc),
        assets_bonus: bonus,
        first_pass_bonus,
        barebones: false,
    }
}
