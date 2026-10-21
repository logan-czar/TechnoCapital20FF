//! The starting world data: one row struct per CSV file, loading with serde and csv, and the
//! load-time checks ported from `tools/mvp-data/validate.py` (build-plan 2.1, M0.2 to M0.6).
//!
//! The files live in `docs/design/data/`, the single source (build-plan 2.3). [`load_world`] reads
//! them all; [`check`] runs the id, range and balance checks and returns every problem it finds.

mod checks;
mod error;
mod load;
pub mod rows;

use std::path::{Path, PathBuf};

pub use checks::{EXPECTED_COUNTS, check};
pub use error::DataError;
pub use load::{Table, load_table};
pub use rows::*;

/// The 8 superregions: the slug used in file names and the name used in countries.csv.
pub const SUPERREGIONS: [(&str, &str); 8] = [
    ("east-asia-oceania", "East Asia and Oceania"),
    ("europe", "Europe"),
    ("latin-america", "Latin America"),
    ("mena", "Middle East and North Africa"),
    ("north-america", "North America"),
    ("russia-central-asia", "Russia and Central Asia"),
    ("south-asia", "South Asia"),
    ("sub-saharan-africa", "Sub-Saharan Africa"),
];

/// Every table of the starting world.
#[derive(Debug, Clone)]
pub struct WorldData {
    pub countries: Table<Country>,
    /// One table per superregion, in [`SUPERREGIONS`] order.
    pub provinces: Vec<Table<Province>>,
    pub companies: Table<Company>,
    pub characters: Table<Character>,
    pub industries: Table<Industry>,
    pub country_economy: Table<CountryEconomy>,
    pub financial_zones: Table<FinancialZone>,
    pub ai_boom: Table<AiBoomStage>,
    pub key_cities: Table<KeyCity>,
    pub company_start: Table<CompanyStart>,
}

impl WorldData {
    /// Every province of the 8 files, with its table (for error messages) and line.
    pub fn all_provinces(&self) -> impl Iterator<Item = (&Table<Province>, u64, &Province)> {
        self.provinces
            .iter()
            .flat_map(|t| t.iter().map(move |(line, p)| (t, line, p)))
    }

    /// Row counts by table, in a fixed order (provinces and names summed over their 8 files).
    pub fn counts(&self) -> Vec<(&'static str, usize)> {
        vec![
            ("countries", self.countries.len()),
            ("provinces", self.provinces.iter().map(Table::len).sum()),
            ("companies", self.companies.len()),
            ("characters", self.characters.len()),
            ("industries", self.industries.len()),
            ("country-economy", self.country_economy.len()),
            ("financial-zones", self.financial_zones.len()),
            ("ai-boom", self.ai_boom.len()),
            ("key-cities", self.key_cities.len()),
            ("company-start", self.company_start.len()),
        ]
    }
}

/// The data directory in this repository (`docs/design/data`), found from this crate's location.
pub fn default_data_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../docs/design/data")
}

/// Loads every table from `dir`. Stops at the first file that does not parse; the error names the
/// file, line and field (spec 10 M0).
pub fn load_world(dir: &Path) -> Result<WorldData, DataError> {
    let per_region = |pattern: &str| {
        SUPERREGIONS
            .iter()
            .map(|(slug, _)| load_table(dir, &pattern.replace("{}", slug)))
            .collect::<Result<Vec<_>, _>>()
    };
    Ok(WorldData {
        countries: load_table(dir, "countries.csv")?,
        provinces: per_region("provinces-{}.csv")?,
        companies: load_table(dir, "companies.csv")?,
        characters: load_table(dir, "characters.csv")?,
        industries: load_table(dir, "industries.csv")?,
        country_economy: load_table(dir, "country-economy.csv")?,
        financial_zones: load_table(dir, "financial-zones.csv")?,
        ai_boom: load_table(dir, "ai-boom.csv")?,
        key_cities: load_table(dir, "key-cities.csv")?,
        company_start: load_table(dir, "company-start.csv")?,
    })
}
