//! Row types of the world tables (spec 3). M1 holds only ids, names, references and the few
//! converted figures that show the load units at work; each later milestone adds the fields its
//! sections need (and they are saved and hashed with no extra code, since every row derives serde).

use serde::{Deserialize, Serialize};

use super::ids::{CountryId, IndustryId, ProvinceId, ZoneId};

/// A financial zone (spec 3.2.1), static in the MVP except its effective spread and confidence.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Zone {
    /// financial-zones.csv `zone_id`.
    pub key: String,
    /// Logan's zone number, 1 to 26.
    pub number: u32,
    pub name: String,
    pub exchange_code: String,
    /// Base credit spread as a fraction (CSV `credit_spread_bps`, spec 5.1.2).
    pub credit_spread_base: f64,
}

/// A country (spec 3.2), static.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Country {
    /// countries.csv `iso3`.
    pub key: String,
    pub name: String,
    /// country-economy.csv `financial_zone`.
    pub zone: ZoneId,
    /// GDP in USD (CSV `gdp_usd_bn`).
    pub gdp_usd: f64,
    /// Sovereign spread as a fraction (country-economy.csv `sovereign_spread_bps`, spec 5.1.2).
    pub sovereign_spread: f64,
}

/// A province (spec 3.3), static.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Province {
    /// provinces-*.csv `id`.
    pub key: String,
    pub name: String,
    pub country: CountryId,
}

/// An industry (spec 3.4).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Industry {
    /// industries.csv `id` (a slug).
    pub key: String,
    pub name: String,
    /// World demand in 2020, USD a year (CSV `world_size_2020_usd_bn`).
    pub world_size_2020_usd: f64,
}

/// A corporation (spec 3.5).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Company {
    /// companies.csv `id`.
    pub key: String,
    pub name: String,
    /// Empty for private companies.
    pub ticker: String,
    pub industry: IndustryId,
    pub hq_country: CountryId,
    pub hq_province: ProvinceId,
    pub public: bool,
    /// Starting revenue, USD a year (CSV `revenue_usd_m`).
    pub revenue_usd: f64,
    /// Shares outstanding (company-start.csv `shares`; u64, D3).
    pub shares_out: u64,
}

/// A full character (spec 3.7.2).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Character {
    /// characters.csv `id`.
    pub key: String,
    pub name: String,
}
