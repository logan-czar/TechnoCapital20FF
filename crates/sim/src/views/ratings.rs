//! v_ratings: credit ratings (spec 9.2, F6). Filled in M4.5. Rebuilt quarterly (spec 9.4).
//!
//! Placeholder: the milestone that owns this view fills the struct and `build`, in this file
//! only.

use super::{Cadence, ViewData, ViewInput};

/// Placeholder: holds nothing yet.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct RatingsView {}

impl ViewData for RatingsView {
    const CADENCE: Cadence = Cadence::Quarterly;

    fn build(_: &ViewInput<'_>) -> Self {
        Self::default()
    }
}
