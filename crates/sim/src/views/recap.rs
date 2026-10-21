//! v_recap: `get_recap(quarter, scope)` (spec 9.2; 8 Quarterly recap: the world page and the
//! watchlist companies' pages; m9-plan section 1: past recaps by quarter). Rebuilt quarterly
//! (spec 9.4) and after a control (the watchlist).
//!
//! Each recap is built at the start of its pre-quarter-end week (`recap::jobs`) and the World
//! keeps the last 20 (D433). The view copies their pages with each money figure as a
//! [`Figure`]: a company that does not publish shows its consensus and projection as its one
//! estimate of each for the quarter (the consensus is v_projection's), the anticipated range as
//! `range()` of the consensus band, and the expected surprise and reaction worked out from the
//! two estimates (D420, D430), so the true recap never reaches a screen. Confidence and the
//! outlook are shown as they are.

use super::estimate::{ESTIMATE_FLOOR_USD, Estimator, Figure, Kind, Subject};
use super::projection::{consensus_figure, range_of};
use super::{Cadence, ViewData, ViewInput};
use crate::finance::statements::Period;
use crate::market::earnings::{jumped_price, surprise};
use crate::market::projection::{RangeViewer, elapsed_share, range_width};
use crate::recap::jobs::Recap;
use crate::recap::{CompanyRecap, ExpectedResult, Outlook};
use crate::time::Quarter;
use crate::time::quarter::recap_tick;
use crate::world::{CompanyId, CyclePhase, IndustryId, PhaseLabel, World};

/// A company's expected result (spec 8 "by projection"; D280) as the observer sees it.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ExpectedRow {
    pub company: CompanyId,
    pub projection: Figure,
    pub consensus: Figure,
    /// The surprise s the projection would make (5.15), a ratio; from the estimates when the
    /// figures are bands.
    pub expected_surprise: f64,
}

/// The world page (spec 8, 21.6.2).
#[derive(Debug, Clone, PartialEq)]
pub struct WorldRecapPage {
    pub quarter: Quarter,
    pub phase: CyclePhase,
    pub g_t: f64,
    pub industries_by_label: Vec<(PhaseLabel, Vec<IndustryId>)>,
    pub expected_beats: Vec<ExpectedRow>,
    pub expected_misses: Vec<ExpectedRow>,
}

/// A company page (spec 8, 21.6.2).
#[derive(Debug, Clone, PartialEq)]
pub struct RecapPage {
    pub company: CompanyId,
    pub quarter: Quarter,
    /// The anticipated earnings range (5.16), low then high.
    pub range: (Figure, Figure),
    pub expected: ExpectedRow,
    /// The expected price move at the release (5.15), a fraction.
    pub expected_reaction: f64,
    pub confidence_factor: f64,
    pub exchange_confidence: Option<f64>,
    pub outlook: Outlook,
    /// The figures are estimate bands (D420).
    pub estimated: bool,
}

/// One quarter's recap.
#[derive(Debug, Clone, PartialEq)]
pub struct RecapQuarter {
    pub world: WorldRecapPage,
    /// Every company page, in company id order.
    pub companies: Vec<RecapPage>,
}

impl RecapQuarter {
    /// A company's page.
    pub fn company(&self, id: CompanyId) -> Option<&RecapPage> {
        self.companies
            .binary_search_by_key(&id, |p| p.company)
            .ok()
            .map(|i| &self.companies[i])
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct RecapView {
    /// The recaps kept, oldest first (D433); empty before the first pre-quarter-end week.
    pub recaps: Vec<RecapQuarter>,
    /// The watchlist companies with a page in the latest recap, in id order.
    pub watchlist: Vec<CompanyId>,
}

impl RecapView {
    /// The latest recap.
    pub fn latest(&self) -> Option<&RecapQuarter> {
        self.recaps.last()
    }

    /// `get_recap(quarter, world)`: the recap of quarter `q`.
    pub fn quarter(&self, q: Quarter) -> Option<&RecapQuarter> {
        self.recaps.iter().find(|r| r.world.quarter == q)
    }

    /// `get_recap(company)`: a company's page in the latest recap.
    pub fn company(&self, id: CompanyId) -> Option<&RecapPage> {
        self.latest()?.company(id)
    }
}

/// The expected result as shown (D430): the consensus and projection estimates, and the
/// surprise worked out from them.
fn expected_row(est: &Estimator, w: &World, q: Quarter, e: &ExpectedResult) -> ExpectedRow {
    let banded = est.banded(w, e.company);
    let consensus = consensus_figure(est, banded, e.company, q, e.consensus);
    let projection = est.of_period(
        banded,
        Subject::Company(e.company),
        Kind::Projection,
        Period::Quarter(q),
        e.projection,
        ESTIMATE_FLOOR_USD,
    );
    ExpectedRow {
        company: e.company,
        projection,
        consensus,
        expected_surprise: if banded {
            surprise(projection.shown(), consensus.shown())
        } else {
            e.expected_surprise
        },
    }
}

fn page(est: &Estimator, w: &World, width: f64, p: &CompanyRecap) -> RecapPage {
    let banded = est.banded(w, p.company);
    let expected = expected_row(est, w, p.quarter, &p.expected);
    RecapPage {
        company: p.company,
        quarter: p.quarter,
        range: if banded {
            range_of(expected.consensus, width)
        } else {
            (Figure::Exact(p.range.0), Figure::Exact(p.range.1))
        },
        expected,
        expected_reaction: if banded {
            jumped_price(1.0, expected.expected_surprise) - 1.0
        } else {
            p.expected_reaction
        },
        confidence_factor: p.confidence_factor,
        exchange_confidence: p.exchange_confidence,
        outlook: p.outlook,
        estimated: banded,
    }
}

fn recap_quarter(est: &Estimator, w: &World, recap: &Recap) -> RecapQuarter {
    let r = &recap.world;
    // The observer's 5.16 width at the recap tick, as the recap used (D252).
    let width = range_width(elapsed_share(recap_tick(r.quarter)), RangeViewer::OBSERVER);
    let rows = |list: &[ExpectedResult]| -> Vec<ExpectedRow> {
        list.iter().map(|e| expected_row(est, w, r.quarter, e)).collect()
    };
    RecapQuarter {
        world: WorldRecapPage {
            quarter: r.quarter,
            phase: r.phase,
            g_t: r.g_t,
            industries_by_label: r.industries_by_label.clone(),
            expected_beats: rows(&r.expected_beats),
            expected_misses: rows(&r.expected_misses),
        },
        companies: recap
            .companies
            .iter()
            .map(|p| page(est, w, width, p))
            .collect(),
    }
}

impl ViewData for RecapView {
    const CADENCE: Cadence = Cadence::Quarterly;
    const ON_CONTROL: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
        let recaps: Vec<RecapQuarter> = w
            .recaps
            .iter()
            .map(|r| recap_quarter(&est, w, r))
            .collect();
        let watchlist = recaps.last().map_or_else(Vec::new, |r| {
            r.companies
                .iter()
                .map(|p| p.company)
                .filter(|id| input.controls.watchlist.contains(id))
                .collect()
        });
        RecapView { recaps, watchlist }
    }
}
