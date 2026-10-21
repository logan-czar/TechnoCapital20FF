//! v_statements: `get_company_statements` (spec 9.2). Filled in M4. Rebuilt quarterly (spec 9.4).
//!
//! Placeholder: the milestone that owns this view fills the struct and `build`, in this file
//! only.

use super::{Cadence, ViewData, ViewInput};

/// Placeholder: holds nothing yet.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct StatementsView {}

impl ViewData for StatementsView {
    const CADENCE: Cadence = Cadence::Quarterly;

    fn build(_: &ViewInput<'_>) -> Self {
        Self::default()
    }
}
