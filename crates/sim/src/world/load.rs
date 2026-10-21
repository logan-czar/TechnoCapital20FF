//! Builds the [`World`] tables from the loaded CSV rows (spec 7, build-plan 2.3). This is the one
//! place CSV units become sim units ([`super::units`]). Rows are sorted by their CSV id so
//! ordinals are in id order (D4); references between tables become ordinal ids.

use std::collections::BTreeMap;

use sim_data::WorldData;
use thiserror::Error;

use super::World;
use super::entities::{Character, Company, Country, Industry, Province, Zone};
use super::ids::Ordinal;
use super::table::Table;
use super::units::{fraction_from_bps, shares_from_csv, usd_from_billions, usd_from_millions};
use crate::time::DateTime;

/// A row that cannot be turned into sim state. `sim_data::check` catches all of these first on
/// good data; this guards a `Sim` built from unchecked rows.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum LoadError {
    #[error("{table}: id `{key}` appears twice")]
    Duplicate { table: &'static str, key: String },
    #[error("{table} `{key}`: {field} `{value}` is not a known {target}")]
    MissingRef {
        table: &'static str,
        key: String,
        field: &'static str,
        value: String,
        target: &'static str,
    },
    #[error("{table} `{key}`: {message}")]
    BadValue {
        table: &'static str,
        key: String,
        message: String,
    },
}

/// Id lookup used only while loading (never iterated).
struct Keys<I>(BTreeMap<String, I>);

impl<I: Ordinal> Keys<I> {
    fn new<'a>(
        table: &'static str,
        keys: impl Iterator<Item = &'a str>,
    ) -> Result<Self, LoadError> {
        let mut map = BTreeMap::new();
        for (i, k) in keys.enumerate() {
            if map.insert(k.to_owned(), I::from_index(i)).is_some() {
                return Err(LoadError::Duplicate {
                    table,
                    key: k.to_owned(),
                });
            }
        }
        Ok(Self(map))
    }

    fn get(
        &self,
        table: &'static str,
        key: &str,
        field: &'static str,
        value: &str,
        target: &'static str,
    ) -> Result<I, LoadError> {
        self.0
            .get(value)
            .copied()
            .ok_or_else(|| LoadError::MissingRef {
                table,
                key: key.to_owned(),
                field,
                value: value.to_owned(),
                target,
            })
    }
}

/// Rows sorted by their id (D4).
fn sorted_by<'a, T>(rows: impl Iterator<Item = &'a T>, key: impl Fn(&T) -> &str) -> Vec<&'a T> {
    let mut v: Vec<&T> = rows.collect();
    v.sort_by(|a, b| key(a).cmp(key(b)));
    v
}

/// The start state's tables (spec 7) with the clock at 2020-01-01 00:00 (spec 3.1, 7.3).
pub fn build_world(data: &WorldData) -> Result<World, LoadError> {
    // Zones (spec 3.2.1).
    let zone_rows = sorted_by(data.financial_zones.rows.iter(), |z| &z.zone_id);
    let zone_keys = Keys::new(
        "financial-zones",
        zone_rows.iter().map(|z| z.zone_id.as_str()),
    )?;
    let zones = Table::from_rows(
        zone_rows
            .iter()
            .map(|z| Zone {
                key: z.zone_id.clone(),
                number: z.number,
                name: z.name.clone(),
                exchange_code: z.exchange_code.clone(),
                credit_spread_base: fraction_from_bps(z.credit_spread_bps),
            })
            .collect(),
    );

    // Countries (spec 3.2), joined with country-economy.csv.
    let economy: BTreeMap<&str, &sim_data::CountryEconomy> = data
        .country_economy
        .rows
        .iter()
        .map(|e| (e.iso3.as_str(), e))
        .collect();
    let country_rows = sorted_by(data.countries.rows.iter(), |c| &c.iso3);
    let country_keys = Keys::new("countries", country_rows.iter().map(|c| c.iso3.as_str()))?;
    let mut countries = Vec::with_capacity(country_rows.len());
    for c in &country_rows {
        let econ = economy
            .get(c.iso3.as_str())
            .ok_or_else(|| LoadError::BadValue {
                table: "countries",
                key: c.iso3.clone(),
                message: "no country-economy.csv row".into(),
            })?;
        countries.push(Country {
            key: c.iso3.clone(),
            name: c.name.clone(),
            zone: zone_keys.get(
                "country-economy",
                &c.iso3,
                "financial_zone",
                &econ.financial_zone,
                "zone",
            )?,
            gdp_usd: usd_from_billions(c.gdp_usd_bn),
            sovereign_spread: fraction_from_bps(econ.sovereign_spread_bps),
        });
    }

    // Provinces (spec 3.3), all 8 files.
    let province_rows = sorted_by(data.all_provinces().map(|(_, _, p)| p), |p| &p.id);
    let province_keys = Keys::new("provinces", province_rows.iter().map(|p| p.id.as_str()))?;
    let mut provinces = Vec::with_capacity(province_rows.len());
    for p in &province_rows {
        provinces.push(Province {
            key: p.id.clone(),
            name: p.name.clone(),
            country: country_keys.get("provinces", &p.id, "country", &p.country, "country")?,
        });
    }

    // Industries (spec 3.4). companies.csv names its industry by name, not slug.
    let industry_rows = sorted_by(data.industries.rows.iter(), |i| &i.id);
    Keys::<crate::world::IndustryId>::new(
        "industries",
        industry_rows.iter().map(|i| i.id.as_str()),
    )?;
    let industry_by_name = Keys::new("industries", industry_rows.iter().map(|i| i.name.as_str()))?;
    let industries = Table::from_rows(
        industry_rows
            .iter()
            .map(|i| Industry {
                key: i.id.clone(),
                name: i.name.clone(),
                world_size_2020_usd: usd_from_billions(i.world_size_2020_usd_bn),
            })
            .collect(),
    );

    // Companies (spec 3.5), joined with company-start.csv.
    let starts: BTreeMap<&str, &sim_data::CompanyStart> = data
        .company_start
        .rows
        .iter()
        .map(|s| (s.id.as_str(), s))
        .collect();
    let company_rows = sorted_by(data.companies.rows.iter(), |c| &c.id);
    Keys::<crate::world::CompanyId>::new("companies", company_rows.iter().map(|c| c.id.as_str()))?;
    let mut companies = Vec::with_capacity(company_rows.len());
    for c in &company_rows {
        let bad = |message: String| LoadError::BadValue {
            table: "companies",
            key: c.id.clone(),
            message,
        };
        let start = starts
            .get(c.id.as_str())
            .ok_or_else(|| bad("no company-start.csv row".into()))?;
        companies.push(Company {
            key: c.id.clone(),
            name: c.name.clone(),
            ticker: c.ticker.clone(),
            industry: industry_by_name.get(
                "companies",
                &c.id,
                "industry",
                &c.industry,
                "industry",
            )?,
            hq_country: country_keys.get(
                "companies",
                &c.id,
                "hq_country",
                &c.hq_country,
                "country",
            )?,
            hq_province: province_keys.get(
                "companies",
                &c.id,
                "hq_province",
                &c.hq_province,
                "province",
            )?,
            public: c.public,
            revenue_usd: usd_from_millions(c.revenue_usd_m),
            shares_out: shares_from_csv(start.shares).map_err(bad)?,
        });
    }

    // Full characters (spec 3.7.2): all 296 (decision D11).
    let character_rows = sorted_by(data.characters.rows.iter(), |c| &c.id);
    Keys::<crate::world::CharacterId>::new(
        "characters",
        character_rows.iter().map(|c| c.id.as_str()),
    )?;
    let characters = Table::from_rows(
        character_rows
            .iter()
            .map(|c| Character {
                key: c.id.clone(),
                name: c.name.clone(),
            })
            .collect(),
    );

    Ok(World {
        clock: DateTime::START,
        zones,
        countries: Table::from_rows(countries),
        provinces: Table::from_rows(provinces),
        industries,
        companies: Table::from_rows(companies),
        characters,
    })
}
