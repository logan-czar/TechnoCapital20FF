//! The plan lock (spec 4.4 row 3, 21.7): the order of the lock's steps, the order of one
//! company's plan (6.1 to 6.6) and the composed locked plan.

use serde::{Deserialize, Serialize};

use super::archetype::{Archetype, ArchetypeInputs, archetype};
use super::financing::{Financing, FinancingInputs, financing};
use super::growth::{FundingInputs, GrowthInputs, growth_plan, quarter_purchases};
use super::inputs::{g_dem, liquidity, min_cash, plan_traits, roa};
use super::rd::{RdInputs, rd_plan};
use super::split::{monthly_inflow_tb, plan_stations};
use crate::finance::credit::CreditLine;
use crate::finance::distress::CompanyStatus;
use crate::ops::stations::Stations;
use crate::people::traits::Trait;
use crate::world::CompanyId;

/// The steps of the 4.4 plan lock, in the spec's order: startup events (5.19: fixed events due,
/// then random events, each startup with its cast), then IPO board votes and listings
/// (5.20.1), then every company's Lite AI plan in one batch, new companies included (section
/// 6), then consensus (5.16).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum LockStep {
    FixedStartupEvents,
    RandomStartupEvents,
    IpoVotes,
    Listings,
    LiteAiBatch,
    Consensus,
}

/// Spec 4.4 row 3: the lock's steps in order.
pub const PLAN_LOCK_ORDER: [LockStep; 6] = [
    LockStep::FixedStartupEvents,
    LockStep::RandomStartupEvents,
    LockStep::IpoVotes,
    LockStep::Listings,
    LockStep::LiteAiBatch,
    LockStep::Consensus,
];

/// The steps of one company's plan inside the batch (spec 6.1 to 6.6): the 6.6 raise is
/// checked after 6.2 to 6.4 and before 6.5.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum PlanStep {
    Archetype,
    Growth,
    Rd,
    StationSplit,
    Raise,
    FinancingAndDividend,
}

/// Spec 6, 6.6: one company's plan steps in order.
pub const COMPANY_PLAN_ORDER: [PlanStep; 6] = [
    PlanStep::Archetype,
    PlanStep::Growth,
    PlanStep::Rd,
    PlanStep::StationSplit,
    PlanStep::Raise,
    PlanStep::FinancingAndDividend,
];

/// The companies the Lite AI batch plans (spec 6 "every company ... in one batch", 4.4 "new
/// companies included"), in id order (D2): every company that is not frozen (5.12 step 2: a
/// Bankrupt or Removed company makes no plan).
pub fn batch_order(companies: &[(CompanyId, CompanyStatus)]) -> Vec<CompanyId> {
    let mut ids: Vec<CompanyId> = companies
        .iter()
        .filter(|(_, s)| !s.is_frozen())
        .map(|(id, _)| *id)
        .collect();
    ids.sort_unstable();
    ids
}

/// Everything one company's plan reads at the lock (spec 6 inputs, 6.1 to 6.5).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PlanInputs<'a> {
    /// companies.csv `control_basis` is `state`.
    pub state_controlled: bool,
    /// The named controller's traits, when the controller is a character.
    pub controller_traits: Option<&'a [Trait]>,
    /// Born in play (5.19): its founders' traits are not read (5.19.5).
    pub born_in_play: bool,
    /// The industry's sector is Tech.
    pub tech: bool,
    /// Trailing annual revenue, USD (starting revenue at load; run rate at birth).
    pub ttm_revenue: f64,
    /// Trailing 4-quarter EBIT, USD (run rate at load and at birth, D262).
    pub ttm_ebit: f64,
    /// The industry's current lt and q_growth (5.1).
    pub lt: f64,
    pub q_growth: f64,
    /// The industry's supply ratio S (5.2).
    pub supply_ratio: f64,
    pub loss_q: u32,
    pub gross_assets: f64,
    /// d_eff of the unit (5.10).
    pub d_eff: f64,
    pub cash: f64,
    pub line: CreditLine,
    pub status: CompanyStatus,
    /// A raise failed and none has succeeded since (6.6): g is held at −d_eff.
    pub raise_pending: bool,
    /// industries.csv `rd_norm`, `data_tb_per_musd`.
    pub rd_norm: f64,
    pub data_tb_per_musd: f64,
    pub productivity: f64,
    /// This month's free R&D, whole percent (5.9).
    pub free_rd_pct: u32,
    /// Labor units L (5.10).
    pub labor: u64,
    /// Net income of the quarter just released (5.17).
    pub last_quarter_net_income: f64,
}

/// The operating half of a plan (spec 6.1 to 6.4).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct OperatingPlan {
    pub archetype: Archetype,
    /// Annual net growth rate g (6.2), for every unit (3.6 `growth_plan`).
    pub growth: f64,
    /// R&D share of revenue (6.3), for every unit (3.6 `rd_plan`).
    pub rd_plan: f64,
    /// The 6.4 split, fitted to L each month from now on (5.10, D118).
    pub stations: Stations,
    /// The quarter's planned purchases at g, USD (6.2, 5.10).
    pub planned_purchases: f64,
    pub min_cash: f64,
}

/// A locked plan (spec 3.5 `plan`): the operating plan and the 6.5 moves.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct LockedPlan {
    pub operating: OperatingPlan,
    pub financing: FinancingPlan,
}

/// The 6.5 moves, stored with the plan.
#[derive(Debug, Clone, Copy, PartialEq, Default, Serialize, Deserialize)]
pub struct FinancingPlan {
    pub draw: f64,
    pub repay: f64,
    pub dividend: f64,
}

impl From<Financing> for FinancingPlan {
    fn from(f: Financing) -> Self {
        FinancingPlan {
            draw: f.draw,
            repay: f.repay,
            dividend: f.dividend,
        }
    }
}

/// Spec 6.1 to 6.4 for one company: archetype, growth plan (with the funding cap), R&D plan and
/// station split. The traits read are the controller's, none for a born company (5.19.5).
pub fn plan_operations(i: &PlanInputs<'_>) -> OperatingPlan {
    let traits = plan_traits(i.controller_traits, i.born_in_play);
    let arch = archetype(&ArchetypeInputs {
        state_controlled: i.state_controlled,
        revenue_usd: i.ttm_revenue,
        tech: i.tech,
        traits,
    });
    let params = arch.params();
    let min_cash = min_cash(i.ttm_revenue);
    let growth = growth_plan(&GrowthInputs {
        loss_q: i.loss_q,
        roa: roa(i.ttm_ebit, i.gross_assets),
        g_dem: g_dem(i.lt, i.q_growth),
        supply_ratio: i.supply_ratio,
        archetype: params,
        traits,
        tech: i.tech,
        funding: FundingInputs {
            gross_assets: i.gross_assets,
            d_eff: i.d_eff,
            liquidity: liquidity(i.cash, &i.line),
            min_cash,
            purchases_stopped: !i.status.may_buy_assets() || i.raise_pending,
        },
    });
    let rd = rd_plan(&RdInputs {
        rd_norm: i.rd_norm,
        archetype_rd_mult: params.rd_mult,
        productivity: i.productivity,
        traits,
        loss_q: i.loss_q,
        free_rd_pct: i.free_rd_pct,
    });
    let inflow = monthly_inflow_tb(i.ttm_revenue, i.data_tb_per_musd);
    OperatingPlan {
        archetype: arch,
        growth,
        rd_plan: rd,
        stations: plan_stations(i.labor, &params, inflow, traits),
        planned_purchases: quarter_purchases(i.gross_assets, i.d_eff, growth),
        min_cash,
    }
}

/// Spec 6.5 for one company after its operating plan (and after any 6.6 raise, whose cash and
/// line the caller passes in `cash` and `line`).
pub fn plan_financing(
    i: &PlanInputs<'_>,
    op: &OperatingPlan,
    cash: f64,
    line: CreditLine,
) -> Financing {
    financing(&FinancingInputs {
        cash,
        line,
        min_cash: op.min_cash,
        planned_purchases: op.planned_purchases,
        traits: plan_traits(i.controller_traits, i.born_in_play),
        last_quarter_net_income: i.last_quarter_net_income,
        archetype_payout_mult: op.archetype.params().payout_mult,
        status: i.status,
    })
}

/// One company's locked plan with no 6.6 raise (spec 6.1 to 6.5; every company in the MVP,
/// where no industry is cash_burning). Also the plan at load (7.1 Plan row: loss_q 0, D119).
pub fn lock_plan(i: &PlanInputs<'_>) -> LockedPlan {
    let operating = plan_operations(i);
    let financing = plan_financing(i, &operating, i.cash, i.line);
    LockedPlan {
        operating,
        financing: financing.into(),
    }
}
