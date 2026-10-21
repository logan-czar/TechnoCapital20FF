//! v_industry_detail: `get_industry` (spec 9.2), the spec 8 Industries detail view: the
//! 20-quarter history of demand, supply and growth against the long-term rate, the company list
//! and the fringe row. Rebuilt monthly and on load (spec 9.4).

use super::industry_rows::companies_by_revenue;
use super::{Cadence, ViewData, ViewInput};
use crate::world::{CompanyId, IndustryId, IndustryQuarter, Ordinal};

#[derive(Debug, Clone, PartialEq)]
pub struct IndustryCompany {
    pub company: CompanyId,
    pub name: String,
    /// Last month's revenue, USD.
    pub revenue_m: f64,
    /// Share of the industry's revenue (named plus fringe).
    pub share: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct IndustryDetail {
    pub id: IndustryId,
    /// Closed quarters, oldest first (up to 20).
    pub history: Vec<IndustryQuarter>,
    /// Every named company, biggest first, ties to the lower id.
    pub companies: Vec<IndustryCompany>,
    /// The "Fringe (unnamed)" row (spec 5.3).
    pub fringe_revenue_m: f64,
    pub fringe_share: f64,
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

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let ranked = companies_by_revenue(w);
        let industries = w
            .industries
            .iter()
            .map(|(id, ind)| {
                let list = &ranked[id.index()];
                let total: f64 = list.iter().map(|(_, r)| r).sum::<f64>() + ind.fringe_revenue_m;
                let share = |r: f64| if total > 0.0 { r / total } else { 0.0 };
                IndustryDetail {
                    id,
                    history: ind.history.clone(),
                    companies: list
                        .iter()
                        .map(|&(c, r)| IndustryCompany {
                            company: c,
                            name: w.companies[c].name.clone(),
                            revenue_m: r,
                            share: share(r),
                        })
                        .collect(),
                    fringe_revenue_m: ind.fringe_revenue_m,
                    fringe_share: share(ind.fringe_revenue_m),
                }
            })
            .collect();
        IndustryDetailView { industries }
    }
}
