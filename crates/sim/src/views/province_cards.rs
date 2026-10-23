//! v_province_card: `get_province(id)` (spec 9.2), the province card of spec 8's Map row:
//! development, resource, terrain, Metro, key city, and the HQs and units there. Rebuilt
//! monthly and on load (spec 9.4); companies born in play show at the next monthly rebuild.
//!
//! Units are listed by id only: their money figures (assets) come from v_units, which bands a
//! company that does not publish (D420), so no second path can print a band's truth. Removed
//! companies (5.12 step 3) are left out of both lists.

use super::{Cadence, ViewData, ViewInput};
use crate::finance::distress::CompanyStatus;
use crate::world::{CompanyId, CountryId, Ordinal, ProvinceId, UnitId};

/// Which development track is the largest (spec 3.3 `largest_track`; ties count for both,
/// 10.3.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LargestTrack {
    Commerce,
    Industry,
    /// Commerce and Industry tie.
    Both,
}

/// One province card (spec 8 Map row, 9.2 `get_province`).
#[derive(Debug, Clone, PartialEq)]
pub struct ProvinceCard {
    pub id: ProvinceId,
    /// provinces-*.csv `id`.
    pub key: String,
    pub name: String,
    pub country: CountryId,
    pub region: String,
    pub area: String,
    /// Development tracks, 1 to 30 each, and their sum (spec 3.3).
    pub commerce: u32,
    pub industry: u32,
    pub population: u32,
    pub total: u32,
    pub largest_track: LargestTrack,
    pub resource: String,
    pub terrain: String,
    pub coastal: bool,
    /// The `contested` tag, if any (decision C).
    pub contested: Option<String>,
    pub metro: Option<String>,
    pub city_rank: String,
    pub key_city: Option<String>,
    /// Companies headquartered here, in id order.
    pub hqs: Vec<CompanyId>,
    /// Business units based here, in id order.
    pub units: Vec<UnitId>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ProvinceCardsView {
    /// By province ordinal.
    pub cards: Vec<ProvinceCard>,
}

impl ProvinceCardsView {
    /// `get_province(id)`.
    pub fn get(&self, id: ProvinceId) -> Option<&ProvinceCard> {
        self.cards.get(id.index())
    }
}

impl ViewData for ProvinceCardsView {
    const CADENCE: Cadence = Cadence::Monthly;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let n = w.provinces.len();
        let mut hqs: Vec<Vec<CompanyId>> = vec![Vec::new(); n];
        for (id, c) in w.companies.iter() {
            if c.finance.status() != CompanyStatus::Removed {
                hqs[c.hq_province.index()].push(id);
            }
        }
        let mut units: Vec<Vec<UnitId>> = vec![Vec::new(); n];
        for (id, u) in w.units.iter() {
            if w.companies[u.company].finance.status() != CompanyStatus::Removed {
                units[u.base_province.index()].push(id);
            }
        }
        let sites = &w.births.sites;
        let cards = w
            .provinces
            .iter()
            .zip(hqs.into_iter().zip(units))
            .map(|((id, p), (hqs, units))| {
                let s = input.map.provinces.get(id.index());
                let (commerce, industry, population) =
                    s.map_or((0, 0, 0), |s| (s.commerce, s.industry, s.population));
                let text = |f: fn(&crate::map::ProvinceStatic) -> &String| {
                    s.map(|s| f(s).clone()).unwrap_or_default()
                };
                ProvinceCard {
                    id,
                    key: p.key.clone(),
                    name: p.name.clone(),
                    country: p.country,
                    region: text(|s| &s.region),
                    area: text(|s| &s.area),
                    commerce,
                    industry,
                    population,
                    total: commerce + industry + population,
                    largest_track: largest_track(commerce, industry),
                    resource: text(|s| &s.resource),
                    terrain: text(|s| &s.terrain),
                    coastal: s.is_some_and(|s| s.coastal),
                    contested: s.and_then(|s| s.contested.clone()),
                    metro: s.and_then(|s| s.metro.clone()),
                    city_rank: text(|s| &s.city_rank),
                    key_city: sites
                        .key_city
                        .get(id.index())
                        .copied()
                        .flatten()
                        .map(|k| sites.key_cities[k as usize].name.clone()),
                    hqs,
                    units,
                }
            })
            .collect();
        ProvinceCardsView { cards }
    }
}

/// Spec 3.3 `largest_track`: Commerce or Industry, ties count for both (10.3.1).
pub fn largest_track(commerce: u32, industry: u32) -> LargestTrack {
    match commerce.cmp(&industry) {
        std::cmp::Ordering::Greater => LargestTrack::Commerce,
        std::cmp::Ordering::Less => LargestTrack::Industry,
        std::cmp::Ordering::Equal => LargestTrack::Both,
    }
}
