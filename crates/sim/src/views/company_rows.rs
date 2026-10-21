//! v_company_row: `list_companies(filter)` (spec 9.2). M4 fills the rows the books allow: id,
//! name, ticker, industry, HQ, public, revenue TTM, net income TTM, rating and status, from the
//! published statements (D130). M5 adds the exchange, price, day change and shown value at the
//! rebuild (the live price is in v_quotes). Removed companies are left out (5.12 step 3: off the
//! lists). Rebuilt monthly and on load (spec 9.4).

use super::statements::published;
use super::{Cadence, ViewData, ViewInput};
use crate::finance::distress::CompanyStatus;
use crate::finance::rating::Rating;
use crate::finance::statements::trailing_four;
use crate::market::fair_value::shown_value;
use crate::world::{CompanyId, CountryId, IndustryId, ZoneId};

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
    /// The listing exchange (spec 5.14), `None` while private.
    pub exchange: Option<ZoneId>,
    /// P and the day's change at the rebuild (5.14); 0 for a private or delisted company.
    pub price: f64,
    pub change: f64,
    /// The value shown (spec 5.13 step 6): a listed company's market cap at its estimated fair
    /// value (3.14.2), a private company's 0.7 × fair value; 0 once Bankrupt.
    pub value: f64,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct CompanyRowsView {
    /// Every company still in the game, in company id order.
    pub rows: Vec<CompanyRow>,
}

impl ViewData for CompanyRowsView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;

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
                let s = &w.market.stocks[id];
                let value = match s.exchange {
                    Some(_) => s.fair_value * (1.0 + s.efv_error),
                    None => shown_value(s.fair_value, false),
                };
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
                    exchange: s.exchange,
                    price: s.price,
                    change: s.price - s.prev_close,
                    value,
                }
            })
            .collect();
        CompanyRowsView { rows }
    }
}
