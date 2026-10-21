//! v_units: `get_company_units` (spec 9.2). Filled in M2. Rebuilt monthly and on load (spec 9.4).
//!
//! Placeholder: the milestone that owns this view fills the struct and `build`, in this file
//! only.

use super::{Cadence, ViewData, ViewInput};

/// Placeholder: holds nothing yet.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct UnitsView {}

impl ViewData for UnitsView {
    const CADENCE: Cadence = Cadence::Monthly;

    fn build(_: &ViewInput<'_>) -> Self {
        Self::default()
    }
}
