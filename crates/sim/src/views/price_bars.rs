//! v_price_bars: `get_price_history` (spec 9.2). Filled in M5. Rebuilt daily (spec 9.4).
//!
//! Placeholder: the milestone that owns this view fills the struct and `build`, in this file
//! only.

use super::{Cadence, ViewData, ViewInput};

/// Placeholder: holds nothing yet.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct PriceBarsView {}

impl ViewData for PriceBarsView {
    const CADENCE: Cadence = Cadence::Daily;

    fn build(_: &ViewInput<'_>) -> Self {
        Self::default()
    }
}
