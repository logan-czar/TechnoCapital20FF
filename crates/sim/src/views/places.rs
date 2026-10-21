//! v_places: the names of every province and country, for any page that shows a place (spec 8
//! Company header HQ, Board tab home province, Units base province; 9.2 says queries return
//! ids, D426). Static, so built once at load (spec 9.4 Once at load).

use super::{Cadence, ViewData, ViewInput};
use crate::world::{CountryId, Ordinal, ProvinceId};

/// One province (spec 3.3).
#[derive(Debug, Clone, PartialEq)]
pub struct ProvincePlace {
    pub id: ProvinceId,
    /// provinces-*.csv `id`.
    pub key: String,
    pub name: String,
    pub country: CountryId,
}

/// One country's name (spec 3.2).
#[derive(Debug, Clone, PartialEq)]
pub struct CountryPlace {
    pub id: CountryId,
    pub iso3: String,
    pub name: String,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct PlacesView {
    /// In province id order.
    pub provinces: Vec<ProvincePlace>,
    /// In country id order.
    pub countries: Vec<CountryPlace>,
}

impl PlacesView {
    pub fn province(&self, id: ProvinceId) -> Option<&ProvincePlace> {
        self.provinces.get(id.index())
    }

    pub fn country(&self, id: CountryId) -> Option<&CountryPlace> {
        self.countries.get(id.index())
    }

    /// "Province, Country", the way a page names a place.
    pub fn place_name(&self, id: ProvinceId) -> Option<String> {
        let p = self.province(id)?;
        let c = self.country(p.country)?;
        Some(format!("{}, {}", p.name, c.name))
    }
}

impl ViewData for PlacesView {
    const CADENCE: Cadence = Cadence::OnceAtLoad;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        PlacesView {
            provinces: w
                .provinces
                .iter()
                .map(|(id, p)| ProvincePlace {
                    id,
                    key: p.key.clone(),
                    name: p.name.clone(),
                    country: p.country,
                })
                .collect(),
            countries: w
                .countries
                .iter()
                .map(|(id, c)| CountryPlace {
                    id,
                    iso3: c.key.clone(),
                    name: c.name.clone(),
                })
                .collect(),
        }
    }
}
