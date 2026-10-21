//! v_filings: `get_filings(filter)` (spec 9.2), Pdoomberg F5 Filings (spec 8): the newest
//! published quarter's statement of every company that filed it, the release's list. A quarter
//! appears from its release (spec 4.4 row 1; D130). Older quarters are each company's archive in
//! v_statements (20 quarters), so this view does not copy them again (D130). Rebuilt quarterly
//! (spec 9.4) and when Omniscient is toggled (D423). A company that does not publish (private,
//! or a new listing before its first release) files bands, the same as its v_statements
//! estimate of that quarter (D420).

use super::statements::published;
use super::estimate::{Figure, StatementLine};
use super::statements::statement_line;
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
    pub revenue: Figure,
    pub ebit: Figure,
    pub ebitda: Figure,
    pub net_income: Figure,
    pub operating_cash: Figure,
    pub cash: Figure,
    pub line_drawn: Figure,
    pub equity: Figure,
    pub rating: Rating,
    /// The figures are estimate bands (D420).
    pub estimated: bool,
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
    const ON_OMNISCIENT: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
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
                let banded = est.banded(w, id);
                let fig = |l: StatementLine| statement_line(&est, banded, id, s, l);
                Some(Filing {
                    company: id,
                    quarter,
                    revenue: fig(StatementLine::Revenue),
                    ebit: fig(StatementLine::Ebit),
                    ebitda: fig(StatementLine::Ebitda),
                    net_income: fig(StatementLine::NetIncome),
                    operating_cash: fig(StatementLine::OperatingCash),
                    cash: fig(StatementLine::Cash),
                    line_drawn: fig(StatementLine::BalanceLineDrawn),
                    equity: fig(StatementLine::Equity),
                    rating: s.key.rating,
                    estimated: banded,
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
