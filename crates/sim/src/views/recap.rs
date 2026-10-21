//! v_recap: `get_recap(scope)` (spec 9.2; 8 Quarterly recap: the world page and the watchlist
//! companies' pages). Rebuilt quarterly (spec 9.4) and after a control (the watchlist).
//!
//! The recap itself is built at the start of the pre-quarter-end week (`recap::jobs`). The view
//! copies its pages with each money figure as a [`Figure`]: a private company's or new listing's
//! anticipated range, projection and consensus are estimate bands (D420), so the true recap
//! (which the World keeps whole) never reaches a screen. The ratios (expected surprise and
//! reaction), confidence and outlook are shown as they are.

use super::estimate::{Estimator, Field, Figure};
use super::{Cadence, ViewData, ViewInput};
use crate::recap::{CompanyRecap, ExpectedResult, Outlook};
use crate::time::Quarter;
use crate::world::{CompanyId, CyclePhase, IndustryId, PhaseLabel, World};

/// A company's expected result (spec 8 "by projection"; D280) as the observer sees it.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ExpectedRow {
    pub company: CompanyId,
    pub projection: Figure,
    pub consensus: Figure,
    /// The surprise s the projection would make (5.15), a ratio.
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

#[derive(Debug, Clone, Default, PartialEq)]
pub struct RecapView {
    /// The world page of the last recap built; None before the first pre-quarter-end week.
    pub world: Option<WorldRecapPage>,
    /// Every company page of the last recap, in company id order.
    pub companies: Vec<RecapPage>,
    /// The watchlist companies with a page, in id order.
    pub watchlist: Vec<CompanyId>,
}

impl RecapView {
    /// `get_recap(company)`: a company's page in the last recap.
    pub fn company(&self, id: CompanyId) -> Option<&RecapPage> {
        self.companies
            .binary_search_by_key(&id, |p| p.company)
            .ok()
            .map(|i| &self.companies[i])
    }
}

fn expected_row(est: &Estimator, w: &World, e: &ExpectedResult) -> ExpectedRow {
    let banded = est.banded(w, e.company);
    ExpectedRow {
        company: e.company,
        projection: est.current(banded, e.company, Field::Projection, e.projection),
        consensus: est.current(banded, e.company, Field::ConsensusNi, e.consensus),
        expected_surprise: e.expected_surprise,
    }
}

fn page(est: &Estimator, w: &World, p: &CompanyRecap) -> RecapPage {
    let banded = est.banded(w, p.company);
    // The range ends share the consensus's error, so they keep their order (D422).
    let end = |x| est.current(banded, p.company, Field::ConsensusNi, x);
    RecapPage {
        company: p.company,
        quarter: p.quarter,
        range: (end(p.range.0), end(p.range.1)),
        expected: expected_row(est, w, &p.expected),
        expected_reaction: p.expected_reaction,
        confidence_factor: p.confidence_factor,
        exchange_confidence: p.exchange_confidence,
        outlook: p.outlook,
        estimated: banded,
    }
}

impl ViewData for RecapView {
    const CADENCE: Cadence = Cadence::Quarterly;
    const ON_CONTROL: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let Some(recap) = w.recap.as_ref() else {
            return RecapView::default();
        };
        let est = input.estimator();
        let r = &recap.world;
        let rows = |list: &[ExpectedResult]| -> Vec<ExpectedRow> {
            list.iter().map(|e| expected_row(&est, w, e)).collect()
        };
        let companies: Vec<RecapPage> = recap.companies.iter().map(|p| page(&est, w, p)).collect();
        let watchlist = companies
            .iter()
            .map(|p| p.company)
            .filter(|id| input.controls.watchlist.contains(id))
            .collect();
        RecapView {
            world: Some(WorldRecapPage {
                quarter: r.quarter,
                phase: r.phase,
                g_t: r.g_t,
                industries_by_label: r.industries_by_label.clone(),
                expected_beats: rows(&r.expected_beats),
                expected_misses: rows(&r.expected_misses),
            }),
            companies,
            watchlist,
        }
    }
}
