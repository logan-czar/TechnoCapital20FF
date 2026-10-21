//! The archetype (spec 6.1; 2.23.1): first match on the control basis, size and sector, then the
//! named controller's traits, with each archetype's hurdle ROA, growth adjustment, R&D mult,
//! payout mult and data coverage.

use serde::{Deserialize, Serialize};

use crate::people::traits::Trait;

/// Spec 6.1: the Startup row is for revenue below $50M, USD a year.
pub const STARTUP_REVENUE_BELOW_USD: f64 = 50.0e6;
/// Spec 6.1: the Startup row is for industries in the Tech sector (industries.csv `sector`).
pub const TECH_SECTOR: &str = "Tech";
/// Spec 6.1: companies.csv `control_basis` of a state-controlled company.
pub const STATE_CONTROL_BASIS: &str = "state";

/// The five archetypes (spec 6.1, 3.5 `archetype`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Archetype {
    StateChampion,
    Startup,
    AggressiveGrower,
    CashCow,
    Incumbent,
}

/// One row of the 6.1 table (all T).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ArchetypeParams {
    pub hurdle_roa: f64,
    /// Added to the 6.2 growth when ROA meets the hurdle, a fraction a year.
    pub growth_adj: f64,
    pub rd_mult: f64,
    pub payout_mult: f64,
    /// Share of the monthly unstructured inflow the 6.4 split covers with enterprise stations.
    pub data_coverage: f64,
}

/// Spec 6.1 table rows (T).
pub const STATE_CHAMPION: ArchetypeParams = ArchetypeParams {
    hurdle_roa: 0.06,
    growth_adj: 0.02,
    rd_mult: 1.0,
    payout_mult: 1.0,
    data_coverage: 0.5,
};
pub const STARTUP: ArchetypeParams = ArchetypeParams {
    hurdle_roa: 0.12,
    growth_adj: 0.04,
    rd_mult: 1.2,
    payout_mult: 0.0,
    data_coverage: 1.0,
};
pub const AGGRESSIVE_GROWER: ArchetypeParams = ArchetypeParams {
    hurdle_roa: 0.08,
    growth_adj: 0.05,
    rd_mult: 1.3,
    payout_mult: 0.5,
    data_coverage: 1.0,
};
pub const CASH_COW: ArchetypeParams = ArchetypeParams {
    hurdle_roa: 0.15,
    growth_adj: -0.03,
    rd_mult: 0.7,
    payout_mult: 1.3,
    data_coverage: 0.25,
};
pub const INCUMBENT: ArchetypeParams = ArchetypeParams {
    hurdle_roa: 0.10,
    growth_adj: 0.0,
    rd_mult: 1.0,
    payout_mult: 1.0,
    data_coverage: 0.5,
};

impl Archetype {
    pub fn params(self) -> ArchetypeParams {
        match self {
            Archetype::StateChampion => STATE_CHAMPION,
            Archetype::Startup => STARTUP,
            Archetype::AggressiveGrower => AGGRESSIVE_GROWER,
            Archetype::CashCow => CASH_COW,
            Archetype::Incumbent => INCUMBENT,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Archetype::StateChampion => "State champion",
            Archetype::Startup => "Startup",
            Archetype::AggressiveGrower => "Aggressive grower",
            Archetype::CashCow => "Cash cow",
            Archetype::Incumbent => "Incumbent",
        }
    }
}

/// What the archetype reads (spec 6.1).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ArchetypeInputs<'a> {
    /// companies.csv `control_basis` is `state` (a born company is founder-controlled, never
    /// state).
    pub state_controlled: bool,
    /// Trailing annual revenue, USD (starting revenue at load; the target revenue at birth).
    pub revenue_usd: f64,
    /// The industry's sector is Tech (industries.csv `sector`).
    pub tech: bool,
    /// The traits the AI reads ([`super::inputs::plan_traits`]): the named controller's, or none
    /// for widely held companies and companies born in play (5.19.5).
    pub traits: &'a [Trait],
}

/// The archetype (spec 6.1), first match: State champion; Startup (revenue below $50M in Tech);
/// then the controller's traits, Ambitious or Brave giving Aggressive grower and Greedy or
/// Cautious Cash cow, read in the order the controller's list holds them, so a controller with
/// both Ambitious and Greedy takes the one listed first (spec 6.1 A); otherwise Incumbent. A
/// born company passes no traits, so it is a Startup or an Incumbent (5.19.3).
pub fn archetype(i: &ArchetypeInputs<'_>) -> Archetype {
    if i.state_controlled {
        return Archetype::StateChampion;
    }
    if i.tech && i.revenue_usd < STARTUP_REVENUE_BELOW_USD {
        return Archetype::Startup;
    }
    for t in i.traits {
        match t {
            Trait::Ambitious | Trait::Brave => return Archetype::AggressiveGrower,
            Trait::Greedy | Trait::Cautious => return Archetype::CashCow,
            _ => {}
        }
    }
    Archetype::Incumbent
}
