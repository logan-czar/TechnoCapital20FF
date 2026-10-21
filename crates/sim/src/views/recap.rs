//! v_recap: `get_recap(scope)` (spec 9.2; 8 Quarterly recap: the world page and the watchlist
//! companies' pages). Rebuilt quarterly (spec 9.4) and when the watchlist changes.
//!
//! The recap itself is built at the start of the pre-quarter-end week (`recap::jobs`); the view
//! shares it (an `Arc`) and lists the watchlist's pages.

use std::sync::Arc;

use super::{Cadence, ViewData, ViewInput};
use crate::recap::CompanyRecap;
use crate::recap::jobs::Recap;
use crate::world::CompanyId;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct RecapView {
    /// The last recap built; None before the first pre-quarter-end week.
    pub recap: Option<Arc<Recap>>,
    /// The watchlist companies with a page, in id order.
    pub watchlist: Vec<CompanyId>,
}

impl RecapView {
    /// `get_recap(company)`: a company's page in the last recap.
    pub fn company(&self, id: CompanyId) -> Option<&CompanyRecap> {
        self.recap
            .as_ref()?
            .companies
            .iter()
            .find(|p| p.company == id)
    }
}

impl ViewData for RecapView {
    const CADENCE: Cadence = Cadence::Quarterly;
    const ON_CONTROL: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let recap = input.world.recap.clone();
        let watchlist = recap.as_ref().map_or_else(Vec::new, |r| {
            r.companies
                .iter()
                .map(|p| p.company)
                .filter(|id| input.controls.watchlist.contains(id))
                .collect()
        });
        RecapView { recap, watchlist }
    }
}
