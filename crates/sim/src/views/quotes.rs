//! v_quotes: `get_quotes` (spec 9.2). Filled in M5. Rebuilt every tick (spec 9.4).
//!
//! Placeholder: the milestone that owns this view fills the struct and `build`, in this file
//! only.

use super::{Cadence, ViewData, ViewInput};

/// Placeholder: holds nothing yet.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct QuotesView {}

impl ViewData for QuotesView {
    const CADENCE: Cadence = Cadence::EveryTick;

    fn build(_: &ViewInput<'_>) -> Self {
        Self::default()
    }
}
