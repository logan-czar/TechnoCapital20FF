//! v_statements: `get_company_statements(id, period, count)` (spec 9.2), the Company screen's
//! Financials tab (spec 8): each company's published quarterly and yearly statements (3.9),
//! newest last, and in Omniscient the posted months of the open quarter. Rebuilt quarterly
//! (spec 9.4: compile, release, lock and recap ticks).
//!
//! A quarter's statement is built at the close and published at the next release (spec 4.4), so
//! between the two it is held back (D130); the four synthetic 2019 quarters are history at load,
//! Q4 2019 published on 2 January 2020 (spec 4.4). Removed companies keep their filings (5.12
//! step 3).

use std::sync::Arc;

use super::{Cadence, ViewData, ViewInput};
use crate::finance::distress::CompanyStatus;
use crate::finance::state::{Archive, PostedMonth};
use crate::finance::statements::{Period, Statement};
use crate::time::quarter::RELEASE_DAY;
use crate::time::{Date, DateTime, Quarter};
use crate::world::{CompanyId, Ordinal};

/// Whether the statements of quarter `q` are published at `now`: from 00:00 on the release day
/// of the next quarter (spec 4.4 row 1; D130).
pub fn quarter_published(q: Quarter, now: DateTime) -> bool {
    let first = q.next().first_month();
    now.date() >= Date::ymd(first.year, first.month, RELEASE_DAY)
}

/// Whether a statement is published at `now` (a year with its Q4).
pub fn published(s: &Statement, now: DateTime) -> bool {
    match s.period {
        Period::Quarter(q) => quarter_published(q, now),
        Period::Year(y) => quarter_published(Quarter { year: y, q: 4 }, now),
    }
}

/// The period asked of `get_company_statements` (spec 9.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatementPeriod {
    Month,
    Quarter,
    Year,
}

/// One company's statements: its archive, shared with the World (D130), and how much of it is
/// published.
#[derive(Debug, Clone, PartialEq)]
pub struct CompanyStatements {
    pub id: CompanyId,
    pub key: String,
    pub status: CompanyStatus,
    archive: Arc<Archive>,
    /// How many of the archive's quarters and years are published (a prefix: the archive is in
    /// time order); all of them in Omniscient.
    published_quarters: usize,
    published_years: usize,
    /// Posted months of the open quarter, oldest first: Omniscient only (monthly ledgers are not
    /// published, spec 1).
    pub months: Vec<PostedMonth>,
}

impl CompanyStatements {
    /// Published quarters, oldest first (at most 20, spec 4.5).
    pub fn quarters(&self) -> &[Statement] {
        &self.archive.quarters[..self.published_quarters]
    }

    /// Published years, oldest first (at most 5, D228).
    pub fn years(&self) -> &[Statement] {
        &self.archive.years[..self.published_years]
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct StatementsView {
    /// Every company in company id order.
    pub companies: Vec<CompanyStatements>,
}

impl StatementsView {
    pub fn get(&self, id: CompanyId) -> Option<&CompanyStatements> {
        self.companies.get(id.index())
    }

    /// `get_company_statements(id, period, count)` for quarters and years: the last `count`
    /// published statements, oldest first.
    pub fn statements(&self, id: CompanyId, period: StatementPeriod, count: usize) -> &[Statement] {
        let Some(c) = self.get(id) else {
            return &[];
        };
        let all = match period {
            StatementPeriod::Quarter => c.quarters(),
            StatementPeriod::Year => c.years(),
            StatementPeriod::Month => return &[],
        };
        &all[all.len().saturating_sub(count)..]
    }

    /// The months of the open quarter (Omniscient), the last `count`.
    pub fn months(&self, id: CompanyId, count: usize) -> &[PostedMonth] {
        self.get(id)
            .map_or(&[][..], |c| &c.months[c.months.len().saturating_sub(count)..])
    }
}

impl ViewData for StatementsView {
    const CADENCE: Cadence = Cadence::Quarterly;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let omniscient = input.controls.omniscient;
        let count = |all: &[Statement]| {
            if omniscient {
                all.len()
            } else {
                all.iter().take_while(|s| published(s, w.clock)).count()
            }
        };
        let companies = w
            .companies
            .iter()
            .map(|(id, c)| CompanyStatements {
                id,
                key: c.key.clone(),
                status: c.finance.status(),
                archive: Arc::clone(&c.finance.archive),
                published_quarters: count(c.finance.quarters()),
                published_years: count(c.finance.years()),
                months: if omniscient {
                    c.finance.months.clone()
                } else {
                    Vec::new()
                },
            })
            .collect();
        StatementsView { companies }
    }
}
