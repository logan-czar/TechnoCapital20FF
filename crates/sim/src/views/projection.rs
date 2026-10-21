//! v_projection: `get_company_projection(id)` (spec 9.2: locked plan, projection range,
//! consensus; 8 Financials Quarter view). Rebuilt daily (spec 9.4, 4.2 step 4 "projection ranges
//! refreshed").
//!
//! The observer never sees a plan, so the range is the 5.16 range at today's share of the
//! quarter elapsed, ×2 for a secret plan and centred on the consensus (D252); it narrows as the
//! quarter passes and never goes under ±3%. The plan itself shows only in Omniscient. A private
//! company's or new listing's consensus and range ends are estimate bands (D420).

use super::estimate::{Field, Figure};
use super::{Cadence, ViewData, ViewInput};
use crate::ai::plan::LockedPlan;
use crate::market::projection::{RangeViewer, elapsed_share, range, range_width};
use crate::world::CompanyId;

/// One company's projection (spec 9.2).
#[derive(Debug, Clone, PartialEq)]
pub struct ProjectionRow {
    pub id: CompanyId,
    /// The quarter's net income consensus set at the plan lock (5.16).
    pub consensus_ni: Figure,
    /// The shown range, low then high (5.16).
    pub range: (Figure, Figure),
    /// The range's half-width as a share of the consensus.
    pub width: f64,
    /// The locked plan, in Omniscient only (spec 1: published data only).
    pub plan: Option<LockedPlan>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ProjectionView {
    /// Share of the calendar quarter elapsed at the rebuild (D252).
    pub elapsed_share: f64,
    /// Every company not frozen, in id order.
    pub companies: Vec<ProjectionRow>,
}

impl ProjectionView {
    /// `get_company_projection(id)`.
    pub fn get(&self, id: CompanyId) -> Option<&ProjectionRow> {
        self.companies
            .binary_search_by_key(&id, |r| r.id)
            .ok()
            .map(|i| &self.companies[i])
    }
}

impl ViewData for ProjectionView {
    const CADENCE: Cadence = Cadence::Daily;
    const ON_CONTROL: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
        let elapsed = elapsed_share(w.clock);
        let width = range_width(elapsed, RangeViewer::OBSERVER);
        let companies = w
            .companies
            .iter()
            .filter(|(_, c)| !c.finance.status().is_frozen())
            .map(|(id, c)| {
                let consensus = w.market.stocks[id].consensus_ni;
                let banded = est.banded(w, id);
                let (low, high) = range(consensus, width);
                ProjectionRow {
                    id,
                    consensus_ni: est.current(banded, id, Field::ConsensusNi, consensus),
                    // One error for the consensus and both ends, so the ends keep their order
                    // (the estimate is increasing in the truth, D422).
                    range: (
                        est.current(banded, id, Field::ConsensusNi, low),
                        est.current(banded, id, Field::ConsensusNi, high),
                    ),
                    width,
                    plan: if input.controls.omniscient {
                        c.plan
                    } else {
                        None
                    },
                }
            })
            .collect();
        ProjectionView {
            elapsed_share: elapsed,
            companies,
        }
    }
}
