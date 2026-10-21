//! v_filings: `get_filings(filter)` (spec 9.2), Pdoomberg F5 Filings (spec 8): the newest
//! published quarter's statement of every company that filed it, the release's list. A quarter
//! appears from its release (spec 4.4 row 1; D130). Older quarters are each company's archive in
//! v_statements (20 quarters), so this view does not copy them again (D130). Rebuilt quarterly
//! (spec 9.4).

use super::statements::published;
use super::{Cadence, ViewData, ViewInput};
use crate::finance::rating::Rating;
use crate::finance::statements::Period;
use crate::time::Quarter;
use crate::world::CompanyId;

/// One published quarter of one company (spec 3.9 headline lines).
#[derive(Debug, Clone, PartialEq)]
pub struct Filing {
    pub company: CompanyId,
    pub quarter: Quarter,
    pub revenue: f64,
    pub ebit: f64,
    pub ebitda: f64,
    pub net_income: f64,
    pub operating_cash: f64,
    pub cash: f64,
    pub line_drawn: f64,
    pub equity: f64,
    pub rating: Rating,
    /// Built from the starting run rate (the 2019 history, spec 4.4, 7.1).
    pub synthetic: bool,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct FilingsView {
    /// The newest published quarter (Q4 2019 from the 2 January 2020 release; Q3 2019 at load).
    pub quarter: Option<Quarter>,
    /// That quarter's filings in company id order.
    pub filings: Vec<Filing>,
}

impl FilingsView {
    /// `get_filings` for one company: its filing of the newest quarter, if it filed one.
    pub fn of_company(&self, id: CompanyId) -> Option<&Filing> {
        self.filings.iter().find(|f| f.company == id)
    }
}

impl ViewData for FilingsView {
    const CADENCE: Cadence = Cadence::Quarterly;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        // The newest published quarter of any company (all file the same quarters).
        let latest = w
            .companies
            .iter()
            .flat_map(|(_, c)| c.finance.quarters().iter().rev())
            .filter(|s| published(s, w.clock))
            .filter_map(|s| match s.period {
                Period::Quarter(q) => Some(q),
                Period::Year(_) => None,
            })
            .max();
        let Some(quarter) = latest else {
            return FilingsView::default();
        };
        let filings = w
            .companies
            .iter()
            .filter_map(|(id, c)| {
                let s = c
                    .finance
                    .quarters()
                    .iter()
                    .rev()
                    .find(|s| s.period == Period::Quarter(quarter))?;
                Some(Filing {
                    company: id,
                    quarter,
                    revenue: s.lines.revenue,
                    ebit: s.lines.ebit(),
                    ebitda: s.lines.ebitda(),
                    net_income: s.lines.net_income(),
                    operating_cash: s.lines.operating_cash(),
                    cash: s.balance.cash,
                    line_drawn: s.balance.line_drawn,
                    equity: s.balance.equity,
                    rating: s.key.rating,
                    synthetic: s.synthetic,
                })
            })
            .collect();
        FilingsView {
            quarter: Some(quarter),
            filings,
        }
    }
}
