//! Helpers for the M3 tests against the live engine: run a `Sim` to a date, find rows by their
//! CSV id, and read spec values written out as literals.

use sim::Sim;
use sim::time::{Date, DateTime};
use sim::world::{CompanyId, World};

/// Steps until the clock reaches 00:00 on `date` (that tick's jobs included).
pub fn run_to(sim: &mut Sim, date: Date) {
    let end = DateTime::midnight(date);
    while sim.now() < end {
        sim.step();
    }
}

/// The company with this companies.csv id.
pub fn company(w: &World, key: &str) -> CompanyId {
    w.companies
        .iter()
        .find(|(_, c)| c.key == key)
        .map(|(id, _)| id)
        .unwrap_or_else(|| panic!("no company {key}"))
}

/// The companies.csv row with this id.
pub fn company_row<'a>(data: &'a sim_data::WorldData, key: &str) -> &'a sim_data::Company {
    data.companies.rows.iter().find(|c| c.id == key).unwrap()
}

/// The industries.csv row named `name` (companies.csv names industries by name).
pub fn industry_row<'a>(data: &'a sim_data::WorldData, name: &str) -> &'a sim_data::Industry {
    data.industries
        .rows
        .iter()
        .find(|i| i.name == name)
        .unwrap()
}

/// Labor units by spec 5.10, written out: `floor(gross ÷ labor_value)`, minimum 1.
pub fn spec_labor(gross: f64, labor_value: f64) -> u64 {
    ((gross / labor_value).floor() as u64).max(1)
}

/// The 5.8 bonus table, written out from the spec: under 1 → 0; 1 to 9.99 → 1; 10 to 99.99 → 2;
/// 100 to 999.99 → 3; 1,000 to 9,999.99 → 4; 10,000+ → 5, +1 per further 10×.
pub fn spec_pc_bonus(pc: f64) -> u32 {
    let table = [(1.0, 1), (10.0, 2), (100.0, 3), (1_000.0, 4), (10_000.0, 5)];
    let mut bonus = 0;
    for (from, b) in table {
        if pc >= from {
            bonus = b;
        }
    }
    let mut step = 100_000.0;
    while pc >= step {
        bonus += 1;
        step *= 10.0;
    }
    bonus
}

/// The 3.8 monthly bill, written out: $50 per extra base compute `max(9, ceil(0.2 × stations))`,
/// $10 per data compute `max(10, ceil(1.2 × TB stored ÷ 100))`, $30 per enterprise licence.
pub fn spec_compute_usd(stations: u64, tb_stored: f64, licences: u64) -> f64 {
    let extra = stations.div_ceil(5).max(9) as f64;
    let data = (1.2 * tb_stored / 100.0).ceil().max(10.0);
    50.0 * extra + 10.0 * data + 30.0 * licences as f64
}
