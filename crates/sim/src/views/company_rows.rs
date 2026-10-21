//! v_company_row: `list_companies(filter)` (spec 9.2). M4 fills the rows the books allow: id,
//! name, ticker, industry, HQ, public, revenue TTM, net income TTM, rating and status, from the
//! published statements (D130). Price, change and value are M5's; exchange and archetype filters
//! read the company tables. Removed companies are left out (5.12 step 3: off the lists). Rebuilt
//! monthly and on load (spec 9.4).

use super::statements::published;
use super::{Cadence, ViewData, ViewInput};
use crate::finance::distress::CompanyStatus;
use crate::finance::rating::Rating;
use crate::finance::statements::trailing_four;
use crate::world::{CompanyId, CountryId, IndustryId};

/// One row of the company list.
#[derive(Debug, Clone, PartialEq)]
pub struct CompanyRow {
    pub id: CompanyId,
    pub key: String,
    pub name: String,
    pub ticker: String,
    pub industry: IndustryId,
    pub hq_country: CountryId,
    pub public: bool,
    /// Trailing four published quarters (spec 5.13 TTM; D228).
    pub revenue_ttm: f64,
    pub net_income_ttm: f64,
    pub rating: Rating,
    pub status: CompanyStatus,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct CompanyRowsView {
    /// Every company still in the game, in company id order.
    pub rows: Vec<CompanyRow>,
}

impl ViewData for CompanyRowsView {
    const CADENCE: Cadence = Cadence::Monthly;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let rows = w
            .companies
            .iter()
            .filter(|(_, c)| c.finance.in_game())
            .map(|(id, c)| {
                let quarters = c.finance.quarters();
                let n = quarters
                    .iter()
                    .take_while(|s| published(s, w.clock))
                    .count();
                let ttm = trailing_four(&quarters[..n]).unwrap_or_default();
                CompanyRow {
                    id,
                    key: c.key.clone(),
                    name: c.name.clone(),
                    ticker: c.ticker.clone(),
                    industry: c.industry,
                    hq_country: c.hq_country,
                    public: c.public,
                    revenue_ttm: ttm.revenue,
                    net_income_ttm: ttm.net_income(),
                    rating: c.finance.rating,
                    status: c.finance.status(),
                }
            })
            .collect();
        CompanyRowsView { rows }
    }
}
