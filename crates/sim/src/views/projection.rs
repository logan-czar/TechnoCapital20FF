//! v_projection: `get_company_projection` (spec 9.2). Filled in M6.4. Rebuilt daily (spec 9.4).
//!
//! Placeholder: the milestone that owns this view fills the struct and `build`, in this file
//! only.

use super::{Cadence, ViewData, ViewInput};

/// Placeholder: holds nothing yet.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ProjectionView {}

impl ViewData for ProjectionView {
    const CADENCE: Cadence = Cadence::Daily;

    fn build(_: &ViewInput<'_>) -> Self {
        Self::default()
    }
}
