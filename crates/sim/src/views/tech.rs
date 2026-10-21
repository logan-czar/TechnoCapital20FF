//! v_tech: `get_company_tech` (spec 9.2). Filled in M3. Rebuilt monthly and on load (spec 9.4).
//!
//! Placeholder: the milestone that owns this view fills the struct and `build`, in this file
//! only.

use super::{Cadence, ViewData, ViewInput};

/// Placeholder: holds nothing yet.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct TechView {}

impl ViewData for TechView {
    const CADENCE: Cadence = Cadence::Monthly;

    fn build(_: &ViewInput<'_>) -> Self {
        Self::default()
    }
}
