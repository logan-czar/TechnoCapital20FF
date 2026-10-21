//! v_industry_detail: `get_industry` (spec 9.2), the spec 8 Industries detail view: the
//! 20-quarter history of demand, supply and growth against the long-term rate, the company list
//! and the fringe row. Rebuilt monthly and on load (spec 9.4), and when Omniscient is toggled
//! (D423). A private company's or new listing's revenue is its one revenue estimate and its
//! share that band over the industry's total shown (D429, D430); the list is ranked by the
//! revenue shown, so its order cannot give the truth away (D420). An industry estimated by
//! D432 shows its total, fringe and history supply as bands, as v_industry_row does.

use super::estimate::{ESTIMATE_FLOOR_USD, Figure, Kind, Subject};
use super::industry_rows::{
    companies_by_revenue, industry_estimated, industry_figure, ranked_as_shown,
};
use super::{Cadence, ViewData, ViewInput};
use crate::finance::statements::Period;
use crate::time::Quarter;
use crate::world::{CompanyId, IndustryId, Ordinal};

#[derive(Debug, Clone, PartialEq)]
pub struct IndustryCompany {
    pub company: CompanyId,
    pub name: String,
    /// Last month's revenue, USD (the same figure as v_units' revenue).
    pub revenue_m: Figure,
    /// Share of the industry's revenue (named plus fringe) shown.
    pub share: Figure,
}

/// One closed quarter of the industry (spec 8 chart): demand, supply, growth and lt.
#[derive(Debug, Clone, PartialEq)]
pub struct IndustryQuarterRow {
    pub quarter: Quarter,
    /// Effective demand at the quarter's end, USD a year.
    pub demand: f64,
    /// Supply at the quarter's end, USD a year; a band in an estimated industry (D432).
    pub supply: Figure,
    pub q_growth: f64,
    pub lt: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct IndustryDetail {
    pub id: IndustryId,
    /// Closed quarters, oldest first (up to 20).
    pub history: Vec<IndustryQuarterRow>,
    /// Every named company, biggest revenue shown first, ties to the lower id.
    pub companies: Vec<IndustryCompany>,
    /// The "Fringe (unnamed)" row (spec 5.3).
    pub fringe_revenue_m: Figure,
    pub fringe_share: Figure,
    /// The totals are bands (D432).
    pub estimated: bool,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct IndustryDetailView {
    pub industries: Vec<IndustryDetail>,
}

impl IndustryDetailView {
    pub fn get(&self, id: IndustryId) -> Option<&IndustryDetail> {
        self.industries.get(id.index())
    }
}

impl ViewData for IndustryDetailView {
    const CADENCE: Cadence = Cadence::Monthly;
    const ON_OMNISCIENT: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
        let ranked = companies_by_revenue(w);
        let industries = w
            .industries
            .iter()
            .map(|(id, ind)| {
                let list = &ranked[id.index()];
                let estimated = industry_estimated(&est, w, list);
                let shown = ranked_as_shown(&est, w, list);
                let fringe = industry_figure(
                    &est,
                    estimated,
                    id,
                    Kind::FringeRevenue,
                    ind.fringe_revenue_m,
                    ESTIMATE_FLOOR_USD,
                );
                // The whole the shares are of: exact, or the sum of what is shown (D432).
                let total = if estimated {
                    Figure::sum(shown.iter().map(|(_, f)| *f).chain([fringe]))
                } else {
                    Figure::Exact(list.iter().map(|(_, r)| r).sum::<f64>() + ind.fringe_revenue_m)
                };
                IndustryDetail {
                    id,
                    history: ind
                        .history
                        .iter()
                        .map(|h| IndustryQuarterRow {
                            quarter: h.quarter,
                            demand: h.demand,
                            supply: est.of_period(
                                estimated,
                                Subject::Industry(id),
                                Kind::Supply,
                                Period::Quarter(h.quarter),
                                h.supply,
                                ESTIMATE_FLOOR_USD,
                            ),
                            q_growth: h.q_growth,
                            lt: h.lt,
                        })
                        .collect(),
                    companies: shown
                        .iter()
                        .map(|&(c, revenue_m)| IndustryCompany {
                            company: c,
                            name: w.companies[c].name.clone(),
                            revenue_m,
                            share: Figure::ratio(revenue_m, total),
                        })
                        .collect(),
                    fringe_revenue_m: fringe,
                    fringe_share: Figure::ratio(fringe, total),
                    estimated,
                }
            })
            .collect();
        IndustryDetailView { industries }
    }
}
