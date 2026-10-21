//! v_map_layers: `get_map_layer` for industry assets and HQs (spec 9.2). Filled in M8. Rebuilt monthly and on load (spec 9.4).
//!
//! Placeholder: the milestone that owns this view fills the struct and `build`, in this file
//! only.

use super::{Cadence, ViewData, ViewInput};

/// Placeholder: holds nothing yet.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct MapLayersView {}

impl ViewData for MapLayersView {
    const CADENCE: Cadence = Cadence::Monthly;

    fn build(_: &ViewInput<'_>) -> Self {
        Self::default()
    }
}
