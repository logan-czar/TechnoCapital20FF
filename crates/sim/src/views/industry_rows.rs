//! v_industry_row: `list_industries` (spec 9.2), the spec 8 Industries table of 42: demand,
//! supply, S, M, phase label, long-term growth, this quarter's growth a year, fringe share and the
//! top 5 companies. Rebuilt monthly and on load (spec 9.4), and when Omniscient is toggled
//! (D423). The top 5 are ranked by the revenue shown (a private company's estimate, D420), so
//! the ranking cannot give a hidden revenue away.
//!
//! The industry tables are published figures (spec 1), with one exception (Logan's ruling,
//! D432): an industry with one or two companies whose figures are bands would let its exact
//! totals, less the published parts, isolate them. Such an industry shows its named revenue as
//! the sum of the revenues shown, and its supply, S, M, fringe revenue and fringe share as
//! bands, since any of those would rebuild the named total through the 5.2 and 5.4 identities.

use super::estimate::{
    ESTIMATE_FLOOR_RATIO, ESTIMATE_FLOOR_SHARE, ESTIMATE_FLOOR_USD, Estimator, Figure, Kind,
    Subject,
};
use super::units::revenue_figure;
use super::{Cadence, ViewData, ViewInput};
use crate::economy::supply::fringe_supply;
use crate::world::{CompanyId, IndustryId, Ordinal, PhaseLabel, World};

/// Companies shown per industry row (spec 8).
pub const TOP_COMPANIES: usize = 5;
/// An industry with at least one and fewer than this many banded companies (not frozen) shows
/// its totals as bands (Logan's ruling, D432).
pub const INDUSTRY_BANDED_BELOW: usize = 3;

#[derive(Debug, Clone, PartialEq)]
pub struct IndustryRow {
    pub id: IndustryId,
    pub key: String,
    pub name: String,
    pub sector: String,
    /// Effective demand, USD a year (spec 5.1).
    pub demand: f64,
    pub trend_demand: f64,
    /// Supply, USD a year (spec 5.2); a band in an estimated industry (D432).
    pub supply: Figure,
    pub supply_ratio: Figure,
    pub market_factor: Figure,
    pub phase_label: PhaseLabel,
    /// This quarter's long-term rate, a year.
    pub lt: f64,
    /// This quarter's growth a year, `(1 + q_growth)^4 − 1` (spec 8).
    pub growth_annual: f64,
    /// The fringe's share of supply.
    pub fringe_share: Figure,
    /// Last month's revenue of the named units (the sum of the revenues shown in an estimated
    /// industry) and of the fringe, USD.
    pub named_revenue_m: Figure,
    pub fringe_revenue_m: Figure,
    /// The biggest companies by last month's revenue shown (exact or estimated, D420), ties to
    /// the lower id.
    pub top_companies: Vec<CompanyId>,
    /// The totals are bands (D432).
    pub estimated: bool,
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

/// One industry's companies with last month's revenue as shown (one estimate per figure,
/// D429), biggest shown first, ties to the lower id: the order of the Industries table's top 5
/// and the detail view's list.
pub fn ranked_as_shown(
    est: &Estimator,
    w: &World,
    list: &[(CompanyId, f64)],
) -> Vec<(CompanyId, Figure)> {
    let mut shown: Vec<(CompanyId, Figure)> = list
        .iter()
        .map(|&(c, r)| (c, revenue_figure(est, est.banded(w, c), c, r)))
        .collect();
    shown.sort_by(|a, b| b.1.shown().total_cmp(&a.1.shown()).then(a.0.cmp(&b.0)));
    shown
}

/// Whether industry `id`'s totals are bands (D432): it has at least one and fewer than
/// [`INDUSTRY_BANDED_BELOW`] companies not frozen whose figures are bands.
pub fn industry_estimated(est: &Estimator, w: &World, list: &[(CompanyId, f64)]) -> bool {
    let n = list
        .iter()
        .filter(|&&(c, _)| {
            est.banded(w, c) && !w.companies[c].finance.status().is_frozen()
        })
        .count();
    (1..INDUSTRY_BANDED_BELOW).contains(&n)
}

/// An industry-level figure: a band in an estimated industry (D432).
pub fn industry_figure(
    est: &Estimator,
    estimated: bool,
    id: IndustryId,
    kind: Kind,
    truth: f64,
    floor: f64,
) -> Figure {
    est.current(estimated, Subject::Industry(id), kind, truth, floor)
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
                let estimated = industry_estimated(&est, w, list);
                let shown = ranked_as_shown(&est, w, list);
                let fig = |kind, truth, floor| industry_figure(&est, estimated, id, kind, truth, floor);
                let fringe = fringe_supply(ind.fringe_assets, ind.params.asset_turnover);
                let supply = fig(Kind::Supply, ind.supply, ESTIMATE_FLOOR_USD);
                IndustryRow {
                    id,
                    key: ind.key.clone(),
                    name: ind.name.clone(),
                    sector: ind.sector.clone(),
                    demand: ind.demand,
                    trend_demand: ind.trend_demand,
                    supply,
                    // S is the supply band over the demand (D430).
                    supply_ratio: if estimated && ind.demand > 0.0 {
                        supply.over(ind.demand)
                    } else {
                        Figure::Exact(ind.supply_ratio)
                    },
                    market_factor: fig(
                        Kind::MarketFactor,
                        ind.market_factor,
                        ESTIMATE_FLOOR_RATIO,
                    ),
                    phase_label: ind.phase_label,
                    lt: ind.lt,
                    growth_annual: (1.0 + ind.q_growth).powi(4) - 1.0,
                    fringe_share: fig(
                        Kind::FringeShare,
                        if ind.supply > 0.0 {
                            fringe / ind.supply
                        } else {
                            0.0
                        },
                        ESTIMATE_FLOOR_SHARE,
                    ),
                    named_revenue_m: if estimated {
                        Figure::sum(shown.iter().map(|(_, f)| *f))
                    } else {
                        Figure::Exact(list.iter().map(|(_, r)| r).sum())
                    },
                    fringe_revenue_m: fig(
                        Kind::FringeRevenue,
                        ind.fringe_revenue_m,
                        ESTIMATE_FLOOR_USD,
                    ),
                    top_companies: shown.iter().take(TOP_COMPANIES).map(|(c, _)| *c).collect(),
                    estimated,
                }
            })
            .collect();
        IndustryRowsView { rows }
    }
}
