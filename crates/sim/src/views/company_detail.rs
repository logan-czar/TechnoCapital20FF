//! v_company_detail: `get_company`, `get_company_board`, `get_company_cap_table` (spec 9.2). Filled in M3 and M4. Rebuilt monthly and on load (spec 9.4).
//!
//! Placeholder: the milestone that owns this view fills the struct and `build`, in this file
//! only.

use super::{Cadence, ViewData, ViewInput};

/// Placeholder: holds nothing yet.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CompanyDetailView {}

impl ViewData for CompanyDetailView {
    const CADENCE: Cadence = Cadence::Monthly;

    fn build(_: &ViewInput<'_>) -> Self {
        Self::default()
    }
}
