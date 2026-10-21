//! v_industry_row: `list_industries` (spec 9.2), the spec 8 Industries table of 42: demand,
//! supply, S, M, phase label, long-term growth, this quarter's growth a year, fringe share and the
//! top 5 companies. Rebuilt monthly and on load (spec 9.4), and when Omniscient is toggled
//! (D423): the top 5 are ranked by the revenue shown (a private company's estimate, D420), so
//! the ranking cannot give a hidden revenue away. The industry totals are published figures
//! (spec 1: industry tables are exact).

use super::estimate::{Estimator, Field};
use super::{Cadence, ViewData, ViewInput};
use crate::economy::supply::fringe_supply;
use crate::world::{CompanyId, IndustryId, Ordinal, PhaseLabel, World};

/// Companies shown per industry row (spec 8).
pub const TOP_COMPANIES: usize = 5;

#[derive(Debug, Clone, PartialEq)]
pub struct IndustryRow {
    pub id: IndustryId,
    pub key: String,
    pub name: String,
    pub sector: String,
    /// Effective demand, USD a year (spec 5.1).
    pub demand: f64,
    pub trend_demand: f64,
    /// Supply, USD a year (spec 5.2).
    pub supply: f64,
    pub supply_ratio: f64,
    pub market_factor: f64,
    pub phase_label: PhaseLabel,
    /// This quarter's long-term rate, a year.
    pub lt: f64,
    /// This quarter's growth a year, `(1 + q_growth)^4 − 1` (spec 8).
    pub growth_annual: f64,
    /// The fringe's share of supply.
    pub fringe_share: f64,
    /// Last month's revenue of the named units and of the fringe, USD.
    pub named_revenue_m: f64,
    pub fringe_revenue_m: f64,
    /// The biggest companies by last month's revenue shown (exact or estimated, D420), ties to
    /// the lower id.
    pub top_companies: Vec<CompanyId>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct IndustryRowsView {
    pub rows: Vec<IndustryRow>,
}

impl IndustryRowsView {
    pub fn get(&self, id: IndustryId) -> Option<&IndustryRow> {
        self.rows.get(id.index())
    }
}

/// Every industry's companies with last month's revenue, biggest first, ties to the lower id.
pub fn companies_by_revenue(w: &World) -> Vec<Vec<(CompanyId, f64)>> {
    let mut out = vec![Vec::new(); w.industries.len()];
    for (_, u) in w.units.iter() {
        out[u.industry.index()].push((u.company, u.revenue_m));
    }
    for list in &mut out {
        list.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
    }
    out
}

/// One industry's companies by last month's revenue as shown (the exact revenue, or the
/// estimate when banded; D420), biggest first, ties to the lower id: the order of the
/// Industries table's top 5 and the detail view's list.
pub fn ranked_as_shown(
    est: &Estimator,
    w: &World,
    list: &[(CompanyId, f64)],
) -> Vec<(CompanyId, f64)> {
    let mut shown: Vec<(CompanyId, f64)> = list
        .iter()
        .map(|&(c, r)| {
            let banded = est.banded(w, c);
            (c, est.current(banded, c, Field::UnitRevenue, r).shown())
        })
        .collect();
    shown.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
    shown
}

impl ViewData for IndustryRowsView {
    const CADENCE: Cadence = Cadence::Monthly;
    const ON_OMNISCIENT: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
        let ranked = companies_by_revenue(w);
        let rows = w
            .industries
            .iter()
            .map(|(id, ind)| {
                let list = &ranked[id.index()];
                let fringe = fringe_supply(ind.fringe_assets, ind.params.asset_turnover);
                IndustryRow {
                    id,
                    key: ind.key.clone(),
                    name: ind.name.clone(),
                    sector: ind.sector.clone(),
                    demand: ind.demand,
                    trend_demand: ind.trend_demand,
                    supply: ind.supply,
                    supply_ratio: ind.supply_ratio,
                    market_factor: ind.market_factor,
                    phase_label: ind.phase_label,
                    lt: ind.lt,
                    growth_annual: (1.0 + ind.q_growth).powi(4) - 1.0,
                    fringe_share: if ind.supply > 0.0 {
                        fringe / ind.supply
                    } else {
                        0.0
                    },
                    named_revenue_m: list.iter().map(|(_, r)| r).sum(),
                    fringe_revenue_m: ind.fringe_revenue_m,
                    top_companies: ranked_as_shown(&est, w, list)
                        .iter()
                        .take(TOP_COMPANIES)
                        .map(|(c, _)| *c)
                        .collect(),
                }
            })
            .collect();
        IndustryRowsView { rows }
    }
}
