//! v_map_layers: `get_map_layer(mode, param)` (spec 9.2, 8 Map row): a value per province
//! ordinal plus a legend, which the map writes into the shader's per-province colour table
//! (M8). Rebuilt monthly and on load (spec 9.4).
//!
//! Phase A of M8 serves the Political mode (the default, spec 8): each province's country and
//! its contested flag (hatched, decision C). Lane MB adds the Development, Industry, Company HQ
//! and Financial zone modes (M8.5).

use super::{Cadence, ViewData, ViewInput};
use crate::world::{CountryId, Ordinal};

/// A map mode (spec 8 Map row). Phase A: Political only.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
pub enum MapMode {
    /// Provinces coloured by country (the default).
    #[default]
    Political,
}

/// A layer's values by province ordinal (spec 9: `Vec<f32>` or `Vec<u32>`).
#[derive(Debug, Clone, PartialEq)]
pub enum LayerValues {
    /// A category per province (Political: the country ordinal).
    Categories(Vec<u32>),
    /// A number per province (the Development and Industry heat maps).
    Scalars(Vec<f32>),
}

/// One legend row: a category (or a scalar's stop) and its label.
#[derive(Debug, Clone, PartialEq)]
pub struct LegendEntry {
    pub value: u32,
    pub label: String,
}

/// What `get_map_layer` returns.
#[derive(Debug, Clone, PartialEq)]
pub struct MapLayer {
    pub mode: MapMode,
    pub values: LayerValues,
    /// By province ordinal: drawn hatched (contested, decision C).
    pub hatched: Vec<bool>,
    pub legend: Vec<LegendEntry>,
}

/// The Political layer.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct PoliticalLayer {
    /// By province ordinal.
    pub country: Vec<CountryId>,
    /// By province ordinal: the province has a `contested` tag.
    pub contested: Vec<bool>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct MapLayersView {
    pub political: PoliticalLayer,
    /// Country names by ordinal, for the Political legend.
    country_names: Vec<String>,
}

impl MapLayersView {
    /// `get_map_layer(mode, param)` (spec 9.2). The Political legend lists every country that
    /// has a province, in ordinal order.
    pub fn get_map_layer(&self, mode: MapMode) -> MapLayer {
        match mode {
            MapMode::Political => {
                let p = &self.political;
                let mut present: Vec<CountryId> = p.country.clone();
                present.sort_unstable();
                present.dedup();
                MapLayer {
                    mode,
                    values: LayerValues::Categories(p.country.iter().map(|c| c.0).collect()),
                    hatched: p.contested.clone(),
                    legend: present
                        .into_iter()
                        .map(|c| LegendEntry {
                            value: c.0,
                            label: self.country_names.get(c.index()).cloned().unwrap_or_default(),
                        })
                        .collect(),
                }
            }
        }
    }
}

impl ViewData for MapLayersView {
    const CADENCE: Cadence = Cadence::Monthly;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let contested = (0..w.provinces.len())
            .map(|i| {
                input
                    .map
                    .provinces
                    .get(i)
                    .is_some_and(|s| s.contested.is_some())
            })
            .collect();
        MapLayersView {
            political: PoliticalLayer {
                country: w.provinces.rows().iter().map(|p| p.country).collect(),
                contested,
            },
            country_names: w.countries.rows().iter().map(|c| c.name.clone()).collect(),
        }
    }
}
