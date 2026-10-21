//! Shared helpers of the finance tests (lane F, F4): the data, lookups by id, and the
//! finance-start.csv golden fixture written by
//! docs/design/tools/mvp-data/export_finance_fixtures.py (an independent Python implementation
//! of 3.9, 5.11, 5.12 and 7.1 as decisions D220 to D234 read them).

#![allow(dead_code)]

use std::collections::BTreeMap;
use std::path::Path;

use sim::finance::rating::Rating;

pub fn data() -> sim_data::WorldData {
    sim_data::load_world(&sim_data::default_data_dir()).unwrap()
}

/// World base rate (spec 3.1).
pub const BASE_RATE: f64 = 0.03;

/// The facts a finance formula reads for one company, all from the CSVs.
pub struct CompanyFacts<'a> {
    pub company: &'a sim_data::Company,
    pub industry: &'a sim_data::Industry,
    pub economy: &'a sim_data::CountryEconomy,
    pub zone: &'a sim_data::FinancialZone,
    pub start: &'a sim_data::CompanyStart,
}

impl CompanyFacts<'_> {
    pub fn sovereign(&self) -> Rating {
        Rating::parse(&self.economy.sovereign_rating).unwrap()
    }
    /// Zone base spread and sovereign spread as fractions (the CSV bps ÷ 10,000).
    pub fn zone_spread(&self) -> f64 {
        self.zone.credit_spread_bps / 10_000.0
    }
    pub fn sovereign_spread(&self) -> f64 {
        self.economy.sovereign_spread_bps / 10_000.0
    }
}

pub fn facts<'a>(data: &'a sim_data::WorldData, id: &str) -> CompanyFacts<'a> {
    let company = data.companies.rows.iter().find(|c| c.id == id).unwrap();
    let industry = data
        .industries
        .rows
        .iter()
        .find(|i| i.name == company.industry)
        .unwrap();
    let economy = data
        .country_economy
        .rows
        .iter()
        .find(|e| e.iso3 == company.hq_country)
        .unwrap();
    let zone = data
        .financial_zones
        .rows
        .iter()
        .find(|z| z.zone_id == economy.financial_zone)
        .unwrap();
    let start = data.company_start.rows.iter().find(|s| s.id == id).unwrap();
    CompanyFacts {
        company,
        industry,
        economy,
        zone,
        start,
    }
}

/// One row of finance-start.csv: column name to cell.
pub struct FixtureRow(pub BTreeMap<String, String>);

impl FixtureRow {
    pub fn id(&self) -> &str {
        &self.0["id"]
    }
    pub fn num(&self, col: &str) -> f64 {
        self.0[col]
            .parse()
            .unwrap_or_else(|_| panic!("{} {col}", self.id()))
    }
    pub fn rating(&self, col: &str) -> Rating {
        Rating::parse(&self.0[col]).unwrap()
    }
}

/// finance-start.csv rows in file order (plain comma-separated, no quoting).
pub fn finance_start() -> Vec<FixtureRow> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/finance-start.csv");
    let text = std::fs::read_to_string(path).unwrap();
    let mut lines = text.lines();
    let header: Vec<&str> = lines.next().unwrap().split(',').collect();
    lines
        .filter(|l| !l.is_empty())
        .map(|l| {
            let cells: Vec<&str> = l.split(',').collect();
            assert_eq!(cells.len(), header.len(), "{l}");
            FixtureRow(
                header
                    .iter()
                    .zip(cells)
                    .map(|(h, c)| (h.to_string(), c.to_string()))
                    .collect(),
            )
        })
        .collect()
}

/// `a` and `b` agree to `rel` of the larger magnitude (or to $0.01).
pub fn close(a: f64, b: f64, rel: f64) -> bool {
    (a - b).abs() <= (rel * a.abs().max(b.abs())).max(0.01)
}

#[track_caller]
pub fn assert_close(what: &str, actual: f64, expected: f64) {
    assert!(
        close(actual, expected, 1e-9),
        "{what}: {actual} vs expected {expected}"
    );
}
