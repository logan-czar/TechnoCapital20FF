//! One row struct per CSV file in `docs/design/data/` (build-plan 2.1, M0.2). Field names are the
//! exact CSV column names (data/README.md); unknown columns are rejected so the files and the
//! structs cannot drift apart unseen. Money and rates are plain f64 (build-plan 6, decision A).

use serde::{Deserialize, Deserializer, de};

/// `Y` or `N`.
fn yes_no<'de, D: Deserializer<'de>>(d: D) -> Result<bool, D::Error> {
    match String::deserialize(d)?.as_str() {
        "Y" => Ok(true),
        "N" => Ok(false),
        other => Err(de::Error::custom(format!(
            "expected Y or N, found `{other}`"
        ))),
    }
}

/// A `;`-separated list; an empty cell is an empty list.
fn semi_list<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<String>, D::Error> {
    Ok(String::deserialize(d)?
        .split(';')
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .collect())
}

/// countries.csv: one row per country (spec 7.3).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Country {
    pub iso3: String,
    pub name: String,
    pub superregion: String,
    pub currency: String,
    pub gdp_usd_bn: f64,
    pub population_m: f64,
    /// Equality index, 10 (servitude) to 95 (batch 158).
    pub wealth_index: u32,
    #[serde(deserialize_with = "yes_no")]
    pub major: bool,
    pub hss: u32,
    pub legislature_strength: u32,
    pub judiciary_strength: u32,
    pub variant: String,
    pub restriction_label: String,
    pub subject_of: String,
    pub provinces_planned: u32,
    pub notes: String,
}

/// provinces-*.csv: one row per province, in 8 superregion files.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Province {
    pub id: String,
    pub name: String,
    pub country: String,
    pub region: String,
    pub area: String,
    pub metro: String,
    pub city_rank: String,
    pub commerce: u32,
    pub industry: u32,
    pub population: u32,
    pub resource: String,
    pub terrain: String,
    #[serde(deserialize_with = "yes_no")]
    pub coastal: bool,
    pub chokepoint: String,
    pub contested: String,
    pub linked_cities: String,
    pub notes: String,
}

/// companies.csv: the 651 named companies (spec 7.1).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Company {
    pub id: String,
    pub name: String,
    pub ticker: String,
    pub industry: String,
    pub hq_country: String,
    pub hq_province: String,
    #[serde(deserialize_with = "yes_no")]
    pub public: bool,
    pub revenue_usd_m: f64,
    pub book_value_usd_m: f64,
    pub est_value_usd_m: f64,
    pub controller: String,
    pub controller_stake_pct: Option<f64>,
    pub control_basis: String,
    pub owner_of_record: String,
    pub other_holders: String,
    pub notes: String,
}

/// characters.csv: the 296 full characters.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub tier: String,
    pub profile: String,
    pub superregion: String,
    pub region_group: u8,
    pub country: String,
    pub origin_province: String,
    pub location: String,
    pub age: u8,
    pub money_type: String,
    pub finance: u8,
    pub operations: u8,
    pub persuasion: u8,
    pub intrigue: u8,
    pub tech: u8,
    pub hustle: u8,
    #[serde(deserialize_with = "semi_list")]
    pub traits: Vec<String>,
    pub ideology: String,
    pub cash_usd: f64,
    pub net_worth_est_usd: f64,
    pub hook: String,
    pub notes: String,
}

/// industries.csv: the 42 industries and their tuning values (spec 5, 10.3).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Industry {
    pub id: String,
    pub name: String,
    pub sector: String,
    pub valuation_group: String,
    pub world_size_2020_usd_bn: f64,
    pub trend_growth: f64,
    pub cycle_beta: f64,
    pub volatility: f64,
    pub boom_uplift: f64,
    pub crash_drop: f64,
    pub rate_sensitivity: f64,
    pub margin_full_use: f64,
    pub fixed_cost_share: f64,
    pub variable_cost_share: f64,
    pub capital_per_dollar: f64,
    pub asset_turnover: f64,
    pub asset_decay: f64,
    pub asset_decay_threshold_usd: f64,
    pub rd_norm: f64,
    pub labor_value_usd: f64,
    pub pc_modifier: f64,
    pub data_tb_per_musd: f64,
    pub data_decay_base: f64,
    pub fit: String,
    pub resource_tags: String,
    pub asset_label: String,
    #[serde(deserialize_with = "yes_no")]
    pub cash_burning: bool,
    pub earnings_multiple: f64,
    pub notes: String,
}

/// country-economy.csv: tax, sovereign rating and financial zone per country (spec 5.1.2, 5.11).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CountryEconomy {
    pub iso3: String,
    pub corp_tax_level: String,
    pub corp_tax_rate: f64,
    pub sovereign_rating: String,
    pub sovereign_spread_bps: f64,
    pub financial_zone: String,
    pub notes: String,
}

/// financial-zones.csv: the 26 zones, each with one exchange (spec 5.1.2, batches 152 to 155).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FinancialZone {
    pub zone_id: String,
    pub number: u32,
    pub name: String,
    pub hub_city: String,
    pub hub_province: String,
    pub exchange_code: String,
    pub exchange: String,
    pub headline_index: String,
    pub intensity: f64,
    pub lag_quarters: u32,
    pub contagion: f64,
    pub own_shock_sd: f64,
    #[serde(deserialize_with = "semi_list")]
    pub extra_provinces: Vec<String>,
    pub countries: u32,
    pub gdp_usd_bn: f64,
    pub gdp_share: f64,
    pub credit_spread_bps: f64,
    pub confidence_start: f64,
    pub notes: String,
}

/// ai-boom.csv: the scripted AI boom and pop schedule (spec 5.1.1).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AiBoomStage {
    pub stage: String,
    pub boom_year: Option<u32>,
    pub default_year: String,
    pub ai_labs_lt: Option<f64>,
    pub notes: String,
}

/// key-cities.csv: the 88 key cities.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KeyCity {
    pub id: String,
    pub city: String,
    pub country: String,
    #[serde(deserialize_with = "semi_list")]
    pub province_ids: Vec<String>,
    #[serde(deserialize_with = "semi_list")]
    pub specialties: Vec<String>,
    pub specialties_text: String,
    pub signature_assets: String,
    #[serde(deserialize_with = "yes_no")]
    pub has_perk: bool,
    pub perk_achieve: String,
    pub perk_get: String,
    pub notes: String,
}

/// company-start.csv: each company's starting balance sheet, shares and opening price (spec 7.1, G6).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CompanyStart {
    pub id: String,
    pub ticker: String,
    #[serde(deserialize_with = "yes_no")]
    pub public: bool,
    pub gross_assets_usd: f64,
    pub asset_book_usd: f64,
    pub cash_usd: f64,
    pub credit_drawn_usd: f64,
    pub book_equity_usd: f64,
    pub engine_value_usd: f64,
    pub open_price: f64,
    pub shares: f64,
}
