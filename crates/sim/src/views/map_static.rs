//! v_map_static: development, political, Metros, key cities (spec 9.2). Filled in M8. Rebuilt once at load (spec 9.4).
//!
//! Placeholder: the milestone that owns this view fills the struct and `build`, in this file
//! only.

use super::{Cadence, ViewData, ViewInput};

/// Placeholder: holds nothing yet.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct MapStaticView {}

impl ViewData for MapStaticView {
    const CADENCE: Cadence = Cadence::OnceAtLoad;

    fn build(_: &ViewInput<'_>) -> Self {
        Self::default()
    }
}
