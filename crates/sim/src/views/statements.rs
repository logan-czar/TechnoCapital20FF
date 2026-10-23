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
//! [`EstimatedStatement`]s, one figure per line keyed by the statement's period, so a quarter's
//! estimate does not move from release to release, and a year's flows sum its quarters' (D420,
//! D430). Their exact archive is not
//! in the view at all, so a screen cannot show it; Omniscient serves it.

use std::sync::Arc;

use super::estimate::{
    ESTIMATE_FLOOR_TB, ESTIMATE_FLOOR_USD, Estimator, Figure, Kind, StatementLine, Subject,
};
use super::{Cadence, ViewData, ViewInput};
use crate::finance::distress::CompanyStatus;
use crate::finance::rating::Rating;
use crate::finance::state::{Archive, PostedMonth};
use crate::finance::statements::{Period, QUARTERS_PER_YEAR, Statement, trailing_four};
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

/// A statement's figures that are not money (spec 3.9 key figures), shown exactly as
/// operations, but for held TB, a band (it would give the revenue away, D431).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct OperatingFigures {
    pub productivity: f64,
    pub pc_bonus: u32,
    pub labor_units: u64,
    pub held_tb: Figure,
    pub free_rd_pct: u32,
    pub management_score: f64,
    pub rating: Rating,
}

/// A statement of a company that does not publish: every line of [`StatementLine::ALL`] as a
/// figure (D420): a band, but the compute and licences line, which follows the published
/// station counts and stays exact (D434). Lines are estimated one by one, so the bands need not
/// add up; a year's flows are the sums of its quarters' bands (D430).
#[derive(Debug, Clone, PartialEq)]
pub struct EstimatedStatement {
    pub period: Period,
    pub synthetic: bool,
    /// One figure per [`StatementLine::ALL`] entry, in that order.
    pub lines: Vec<Figure>,
    pub operating: OperatingFigures,
}

impl EstimatedStatement {
    /// The figure of one line.
    pub fn line(&self, line: StatementLine) -> Figure {
        self.lines[line as usize]
    }
}

/// One line of a quarter's (or a lone year's) statement as the views show it (D420, D430): the
/// one estimate of that figure for that period, so v_statements, v_filings and the TTM agree.
/// The compute and licences line is exact (D434); the guidance high end is the low end's band
/// moved by the guidance's width, so the two ends share one error.
pub fn statement_line(
    est: &Estimator,
    banded: bool,
    id: CompanyId,
    s: &Statement,
    l: StatementLine,
) -> Figure {
    match l {
        StatementLine::Shared => Figure::Exact(l.of(s)),
        StatementLine::GuidanceHigh => {
            let width = s.key.guidance.1 - s.key.guidance.0;
            statement_line(est, banded, id, s, StatementLine::GuidanceLow).map(|x| x + width)
        }
        _ => est.of_period(
            banded,
            Subject::Company(id),
            Kind::Line(l),
            s.period,
            l.of(s),
            ESTIMATE_FLOOR_USD,
        ),
    }
}

fn operating(est: &Estimator, banded: bool, id: CompanyId, s: &Statement) -> OperatingFigures {
    let k = &s.key;
    OperatingFigures {
        productivity: k.productivity,
        pc_bonus: k.pc_bonus,
        labor_units: k.labor_units,
        held_tb: est.of_period(
            banded,
            Subject::Company(id),
            Kind::HeldTb,
            s.period,
            k.held_tb,
            ESTIMATE_FLOOR_TB,
        ),
        free_rd_pct: k.free_rd_pct,
        management_score: k.management_score,
        rating: k.rating,
    }
}

/// The estimated statement of quarter statement `s` for company `id` (D420).
pub fn estimated_quarter(est: &Estimator, id: CompanyId, s: &Statement) -> EstimatedStatement {
    EstimatedStatement {
        period: s.period,
        synthetic: s.synthetic,
        lines: StatementLine::ALL
            .iter()
            .map(|&l| statement_line(est, true, id, s, l))
            .collect(),
        operating: operating(est, true, id, s),
    }
}

/// The estimated statement of year statement `y` (D430): with its four quarters' estimates at
/// hand, its flows are their sums and its balance sheet, guidance and held TB are Q4's (one
/// estimate per figure); a year whose quarters have left the archive is estimated on its own.
pub fn estimated_year(
    est: &Estimator,
    id: CompanyId,
    y: &Statement,
    quarters: &[EstimatedStatement],
) -> EstimatedStatement {
    let Period::Year(year) = y.period else {
        return estimated_quarter(est, id, y);
    };
    let of_year: Vec<&EstimatedStatement> = quarters
        .iter()
        .filter(|q| matches!(q.period, Period::Quarter(q) if q.year == year))
        .collect();
    if of_year.len() != QUARTERS_PER_YEAR {
        return estimated_quarter(est, id, y);
    }
    let q4 = of_year[QUARTERS_PER_YEAR - 1];
    EstimatedStatement {
        period: y.period,
        synthetic: y.synthetic,
        lines: StatementLine::ALL
            .iter()
            .map(|&l| {
                if l == StatementLine::Shared {
                    Figure::Exact(l.of(y))
                } else if l.is_flow() {
                    Figure::sum(of_year.iter().map(|q| q.line(l)))
                } else {
                    q4.line(l)
                }
            })
            .collect(),
        operating: q4.operating,
    }
}

/// A trailing-four-quarters revenue or net income (spec 5.13 TTM, D228) from the published quarters, as
/// `trailing_four` makes it: exact for a publishing company, else the sum of the quarters'
/// bands (scaled up for fewer than four, D430); a company with none shows a band of 0.
pub fn ttm_line(
    est: &Estimator,
    banded: bool,
    id: CompanyId,
    published: &[Statement],
    l: StatementLine,
) -> Figure {
    let n = published.len().min(QUARTERS_PER_YEAR);
    if !banded {
        let ttm = trailing_four(published).unwrap_or_default();
        return Figure::Exact(match l {
            StatementLine::Revenue => ttm.revenue,
            StatementLine::NetIncome => ttm.net_income(),
            _ => panic!("a TTM of revenue or net income"),
        });
    }
    if n == 0 {
        return est.company_now(true, id, Kind::Line(l), 0.0);
    }
    let sum = Figure::sum(
        published[published.len() - n..]
            .iter()
            .map(|s| statement_line(est, true, id, s, l)),
    );
    let k = QUARTERS_PER_YEAR as f64 / n as f64;
    if n == QUARTERS_PER_YEAR {
        sum
    } else {
        sum.map(|x| x * k)
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
        build_with(input, &[])
    }

    const REBUILD_IN_PLACE: bool = true;

    /// Reuses the last build's estimates of quarters still in the archive (D435): an archived
    /// quarter never changes, and its estimate is a function of the seed, the company and the
    /// statement, so the result equals `build`'s. Years are summed again (a year whose
    /// quarters leave the archive is estimated on its own).
    fn rebuild(&mut self, input: &ViewInput<'_>) {
        let prev = std::mem::take(&mut self.companies);
        *self = build_with(input, &prev);
    }

    fn rebuild_from(prev: &Self, input: &ViewInput<'_>) -> Self {
        build_with(input, &prev.companies)
    }
}

fn build_with(input: &ViewInput<'_>, prev: &[CompanyStatements]) -> StatementsView {
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
                let old: &[EstimatedStatement] = prev
                    .get(id.index())
                    .filter(|p| p.id == id && p.estimated)
                    .map_or(&[], |p| &p.estimated_quarters[..]);
                let estimated_quarters: Vec<EstimatedStatement> = if banded {
                    c.finance.quarters()[..quarters]
                        .iter()
                        .map(|s| {
                            old.iter()
                                .find(|e| e.period == s.period)
                                .cloned()
                                .unwrap_or_else(|| estimated_quarter(&est, id, s))
                        })
                        .collect()
                } else {
                    Vec::new()
                };
                let estimated_years: Vec<EstimatedStatement> = if banded {
                    c.finance.years()[..years]
                        .iter()
                        .map(|y| estimated_year(&est, id, y, &estimated_quarters))
                        .collect()
                } else {
                    Vec::new()
                };
                CompanyStatements {
                    id,
                    key: c.key.clone(),
                    status: c.finance.status(),
                    estimated: banded,
                    archive: (!banded).then(|| Arc::clone(&c.finance.archive)),
                    published_quarters: if banded { 0 } else { quarters },
                    published_years: if banded { 0 } else { years },
                    estimated_quarters,
                    estimated_years,
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
