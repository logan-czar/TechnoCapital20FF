//! v_statements: `get_company_statements(id, period, count)` (spec 9.2), the Company screen's
//! Financials tab (spec 8): each company's published quarterly and yearly statements (3.9),
//! newest last, and in Omniscient the posted months of the open quarter. Rebuilt quarterly
//! (spec 9.4: compile, release, lock and recap ticks) and when Omniscient is toggled (D423).
//!
//! A quarter's statement is built at the close and published at the next release (spec 4.4), so
//! between the two it is held back (D130); the four synthetic 2019 quarters are history at load,
//! Q4 2019 published on 2 January 2020 (spec 4.4). Removed companies keep their filings (5.12
//! step 3).
//!
//! A private company publishes no statements (spec 1, 5.20.1 Listing step 4), nor does a new
//! listing before its first release after listing: their statements are served as
//! [`EstimatedStatement`]s, one band per money line, keyed by the statement's period so a
//! quarter's estimate does not move from release to release (D420). Their exact archive is not
//! in the view at all, so a screen cannot show it; Omniscient serves it.

use std::sync::Arc;

use super::estimate::{Band, Estimator, Field, StatementLine};
use super::{Cadence, ViewData, ViewInput};
use crate::finance::distress::CompanyStatus;
use crate::finance::rating::Rating;
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

/// A statement's figures that are not money (spec 3.9 key figures), shown exactly: the observer
/// sees operations, not the books (D420).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct OperatingFigures {
    pub productivity: f64,
    pub pc_bonus: u32,
    pub labor_units: u64,
    pub held_tb: f64,
    pub free_rd_pct: u32,
    pub management_score: f64,
    pub rating: Rating,
}

/// A statement of a company that does not publish: every money line of [`StatementLine::ALL`]
/// as a band (D420). Lines are estimated one by one, so the bands need not add up.
#[derive(Debug, Clone, PartialEq)]
pub struct EstimatedStatement {
    pub period: Period,
    pub synthetic: bool,
    /// One band per [`StatementLine::ALL`] entry, in that order.
    pub lines: Vec<Band>,
    pub operating: OperatingFigures,
}

impl EstimatedStatement {
    /// The band of one line.
    pub fn line(&self, line: StatementLine) -> Band {
        self.lines[line as usize]
    }
}

/// The estimated statement of `s` for company `id` (D420): each line keyed by the statement's
/// period and the line, so v_filings shows the same bands.
pub fn estimated_statement(est: &Estimator, id: CompanyId, s: &Statement) -> EstimatedStatement {
    let lines = StatementLine::ALL
        .iter()
        .map(|&l| {
            est.of_period(true, id, s.period, Field::Line(l.error_key()), l.of(s))
                .band()
                .expect("a banded figure is a band")
        })
        .collect();
    let k = &s.key;
    EstimatedStatement {
        period: s.period,
        synthetic: s.synthetic,
        lines,
        operating: OperatingFigures {
            productivity: k.productivity,
            pc_bonus: k.pc_bonus,
            labor_units: k.labor_units,
            held_tb: k.held_tb,
            free_rd_pct: k.free_rd_pct,
            management_score: k.management_score,
            rating: k.rating,
        },
    }
}

/// One company's statements: its archive, shared with the World (D130), and how much of it is
/// published; or, for a company that does not publish, the estimates of its published-by-date
/// statements.
#[derive(Debug, Clone, PartialEq)]
pub struct CompanyStatements {
    pub id: CompanyId,
    pub key: String,
    pub status: CompanyStatus,
    /// The figures are estimate bands (D420): `quarters()` and `years()` are empty and the
    /// statements are in `estimated_quarters` and `estimated_years`.
    pub estimated: bool,
    /// None when estimated: the true archive never enters the view.
    archive: Option<Arc<Archive>>,
    /// How many of the archive's quarters and years are published (a prefix: the archive is in
    /// time order); all of them in Omniscient.
    published_quarters: usize,
    published_years: usize,
    /// The estimates of the quarters and years a published company would have published by
    /// now, oldest first (D420).
    pub estimated_quarters: Vec<EstimatedStatement>,
    pub estimated_years: Vec<EstimatedStatement>,
    /// Posted months of the open quarter, oldest first: Omniscient only (monthly ledgers are not
    /// published, spec 1).
    pub months: Vec<PostedMonth>,
}

impl CompanyStatements {
    /// Published quarters, oldest first (at most 20, spec 4.5); empty when estimated.
    pub fn quarters(&self) -> &[Statement] {
        self.archive
            .as_ref()
            .map_or(&[][..], |a| &a.quarters[..self.published_quarters])
    }

    /// Published years, oldest first (at most 5, D228); empty when estimated.
    pub fn years(&self) -> &[Statement] {
        self.archive
            .as_ref()
            .map_or(&[][..], |a| &a.years[..self.published_years])
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
    /// published statements, oldest first; empty for a company that does not publish (see
    /// [`StatementsView::estimated`]).
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

    /// The estimated statements of a company that does not publish, the last `count`, oldest
    /// first (D420); empty for a publishing company.
    pub fn estimated(
        &self,
        id: CompanyId,
        period: StatementPeriod,
        count: usize,
    ) -> &[EstimatedStatement] {
        let Some(c) = self.get(id) else {
            return &[];
        };
        let all = match period {
            StatementPeriod::Quarter => &c.estimated_quarters[..],
            StatementPeriod::Year => &c.estimated_years[..],
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
    const ON_OMNISCIENT: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let omniscient = input.controls.omniscient;
        let est = input.estimator();
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
            .map(|(id, c)| {
                let banded = est.banded(w, id);
                let quarters = count(c.finance.quarters());
                let years = count(c.finance.years());
                let estimate = |all: &[Statement]| -> Vec<EstimatedStatement> {
                    all.iter()
                        .map(|s| estimated_statement(&est, id, s))
                        .collect()
                };
                CompanyStatements {
                    id,
                    key: c.key.clone(),
                    status: c.finance.status(),
                    estimated: banded,
                    archive: (!banded).then(|| Arc::clone(&c.finance.archive)),
                    published_quarters: if banded { 0 } else { quarters },
                    published_years: if banded { 0 } else { years },
                    estimated_quarters: if banded {
                        estimate(&c.finance.quarters()[..quarters])
                    } else {
                        Vec::new()
                    },
                    estimated_years: if banded {
                        estimate(&c.finance.years()[..years])
                    } else {
                        Vec::new()
                    },
                    months: if omniscient {
                        c.finance.months.clone()
                    } else {
                        Vec::new()
                    },
                }
            })
            .collect();
        StatementsView { companies }
    }
}
