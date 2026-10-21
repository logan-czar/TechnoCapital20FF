//! The births state on the World (spec 3.1 `startup_events`, 5.19, 5.20; build-plan M6.6 to
//! M6.9): the fixed events with their fired flags, the log of every event that fired, the
//! company name lists, the static province weights the HQ draws read, and the tipped lab. Built
//! once at load from the data, so a save loads without the CSVs (D13); every field derives
//! serde, so saves and the state hash cover it.

use serde::{Deserialize, Serialize};
use sim_data::WorldData;

use super::fixed::{FixedEvent, Region};
use super::names::CompanyNames;
use super::random::EventKind;
use super::weights::{gdp_per_head, province_weight, wealth_factor};
use crate::time::Date;
use crate::world::units::USD_PER_BILLION;

/// countries.csv `population_m` is in millions of people (2-map 2.3.1 GDP per head).
pub const PEOPLE_PER_MILLION: f64 = 1.0e6;
use crate::world::{CompanyId, CountryId, IndustryId, Ordinal, ProvinceId, StartupEventId};

/// One startup event that fired (spec 3.1 `startup_events` log, 9.2 `list_startup_events`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EventRecord {
    pub id: StartupEventId,
    pub kind: EventKind,
    /// The plan lock it fired at.
    pub date: Date,
    /// The industries its startups were born in, in birth order (repeats kept).
    pub industries: Vec<IndustryId>,
    /// The companies it made, in birth order.
    pub companies: Vec<CompanyId>,
}

/// A key city's site data (spec 5.19.1 HQ weight, 5.18 place names): its name and the
/// industries it lists (key-cities.csv `specialties`, matched by industry name).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KeyCitySite {
    pub name: String,
    pub industries: Vec<IndustryId>,
}

/// The static province data the HQ draws read (spec 5.19.1; 2-map 2.3.1), by province ordinal.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct Sites {
    /// 2-map 2.3.1 province weight, USD: total development × $0.3B × G (D260).
    pub weight: Vec<f64>,
    /// The province's superregion slug, as in the province file names (5.19.2 regions).
    pub superregion: Vec<u8>,
    /// The key city the province belongs to, if any (index into `key_cities`).
    pub key_city: Vec<Option<u32>>,
    pub key_cities: Vec<KeyCitySite>,
    /// The provinces of each country, in id order (3.7.2 home province draw).
    pub country_provinces: Vec<Vec<ProvinceId>>,
}

impl Sites {
    /// The superregion slug of a province.
    pub fn superregion_slug(&self, p: ProvinceId) -> &'static str {
        sim_data::SUPERREGIONS[usize::from(self.superregion[p.index()])].0
    }

    /// True if a key city in province `p` lists `industry` (5.19.1 "× 3").
    pub fn key_city_lists(&self, p: ProvinceId, industry: IndustryId) -> bool {
        self.key_city[p.index()]
            .is_some_and(|k| self.key_cities[k as usize].industries.contains(&industry))
    }

    /// The place a headline names (5.18 "[city or province]"): the key city, else the province.
    pub fn place<'a>(&'a self, p: ProvinceId, province_name: &'a str) -> &'a str {
        match self.key_city[p.index()] {
            Some(k) => &self.key_cities[k as usize].name,
            None => province_name,
        }
    }
}

/// The World's births state (spec 3.1 `startup_events`, 5.19).
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct BirthsState {
    /// F1 to F9 from startup-events.csv, in file order (5.19.2).
    pub fixed: Vec<FixedEvent>,
    /// Whether each fixed event has fired (3.1 `startup_events` "fired flag").
    pub fixed_fired: Vec<bool>,
    /// Every event that fired, fixed or random, in order; the id is the position (3.1).
    pub events: Vec<EventRecord>,
    /// Company name lists (5.19.3; D272).
    pub names: CompanyNames,
    pub sites: Sites,
    /// The lab whose chatbot sets off the boom (5.1.1, 7-starting-world 7.6; D111, D281), drawn
    /// at load right after the pop roll.
    pub tipped_lab: Option<CompanyId>,
}

/// A startup-events.csv row or a key city that cannot be read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BadBirthsData(pub String);

impl BirthsState {
    /// The births state from the data (no draws): the fixed events, the name lists and the
    /// province weights. `provinces` and `countries` are the World's keys in ordinal order,
    /// `industries` the World's (id, name) pairs in ordinal order.
    pub fn from_data(
        data: &WorldData,
        province_keys: &[&str],
        country_keys: &[&str],
        industry_names: &[&str],
    ) -> Result<BirthsState, BadBirthsData> {
        let fixed: Vec<FixedEvent> = data
            .startup_events
            .rows
            .iter()
            .map(FixedEvent::from_row)
            .collect::<Result<_, _>>()
            .map_err(|e| BadBirthsData(e.0))?;
        let fixed_fired = vec![false; fixed.len()];

        // 2-map 2.3.1: G from the country's GDP per head against the world's (D260).
        let country_of = |iso3: &str| country_keys.binary_search(&iso3).ok();
        let mut gdp = vec![0.0; country_keys.len()];
        let mut pop = vec![0.0; country_keys.len()];
        for c in &data.countries.rows {
            if let Some(i) = country_of(&c.iso3) {
                gdp[i] = c.gdp_usd_bn * USD_PER_BILLION;
                pop[i] = c.population_m * PEOPLE_PER_MILLION;
            }
        }
        let world_gdp_per_head = gdp_per_head(gdp.iter().sum(), pop.iter().sum());
        let g: Vec<f64> = (0..country_keys.len())
            .map(|i| wealth_factor(gdp_per_head(gdp[i], pop[i]), world_gdp_per_head))
            .collect();

        let n = province_keys.len();
        let mut sites = Sites {
            weight: vec![0.0; n],
            superregion: vec![0; n],
            key_city: vec![None; n],
            key_cities: Vec::new(),
            country_provinces: vec![Vec::new(); country_keys.len()],
        };
        for (region, table) in data.provinces.iter().enumerate() {
            for p in &table.rows {
                let Ok(i) = province_keys.binary_search(&p.id.as_str()) else {
                    continue;
                };
                let country = country_of(&p.country).ok_or_else(|| {
                    BadBirthsData(format!("province {}: unknown country {}", p.id, p.country))
                })?;
                sites.superregion[i] = region as u8;
                sites.weight[i] =
                    province_weight(p.commerce + p.industry + p.population, g[country]);
                sites.country_provinces[country].push(ProvinceId::from_index(i));
            }
        }
        for list in &mut sites.country_provinces {
            list.sort_unstable();
        }
        for kc in &data.key_cities.rows {
            let industries: Vec<IndustryId> = kc
                .specialties
                .iter()
                .filter_map(|s| industry_names.iter().position(|n| n == s))
                .map(IndustryId::from_index)
                .collect();
            let k = sites.key_cities.len() as u32;
            sites.key_cities.push(KeyCitySite {
                name: kc.city.clone(),
                industries,
            });
            for pid in &kc.province_ids {
                if let Ok(i) = province_keys.binary_search(&pid.as_str())
                    && sites.key_city[i].is_none()
                {
                    sites.key_city[i] = Some(k);
                }
            }
        }
        Ok(BirthsState {
            fixed,
            fixed_fired,
            events: Vec::new(),
            names: CompanyNames::from_data(data),
            sites,
            tipped_lab: None,
        })
    }

    /// The provinces inside any of `regions`, given each province's country key.
    pub fn in_regions(&self, p: ProvinceId, iso3: &str, regions: &[Region]) -> bool {
        let slug = self.sites.superregion_slug(p);
        regions.iter().any(|r| r.contains(slug, iso3))
    }

    /// The other provinces of a country with their weights (3.7.2 home province), in id order.
    pub fn home_others(&self, country: CountryId, hq: ProvinceId) -> Vec<(ProvinceId, f64)> {
        self.sites.country_provinces[country.index()]
            .iter()
            .filter(|&&p| p != hq)
            .map(|&p| (p, self.sites.weight[p.index()]))
            .collect()
    }
}
