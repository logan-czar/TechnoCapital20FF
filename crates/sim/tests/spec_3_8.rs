//! Spec 3.8 compute and licence costs (build-plan M3.5): costs match 3.8 for Arrowhead.

use sim::ops::compute::{compute_bill, data_compute, extra_base_compute};
use sim::ops::data::{DataBook, DataParams, conversion_capacity};
use sim::ops::stations::Stations;

const OIL: DataParams = DataParams {
    tb_per_musd: 1.0,
    decay_base: 0.02,
};

#[test]
fn arrowhead_compute_and_licences() {
    // 7.1: 392 stations (98 productivity, 1 enterprise, 293 idle); about 8.6 TB held plus one
    // month of unstructured data (40 ÷ 12 TB).
    let stations = Stations {
        productivity: 98,
        enterprise: 1,
        fifty_fifty: 0,
        research: 0,
        idle: 293,
    };
    let data = DataBook::at_load(40.0e6, OIL, conversion_capacity(&stations), 0.1);
    let stored = data.stored_tb();
    assert!((stored - (8.6 + 40.0 / 12.0)).abs() < 0.05, "{stored}");
    let bill = compute_bill(&stations, stored);
    // Extra base compute max(9, ceil(0.2 × 392)) = 79 at $50.
    assert_eq!(bill.extra_base_compute, 79);
    // Data compute max(10, ceil(1.2 × 11.9 ÷ 100)) = 10 at $10.
    assert_eq!(bill.data_compute, 10);
    // One enterprise licence at $30.
    assert_eq!(bill.licences, 1);
    assert_eq!(bill.monthly_usd, 79.0 * 50.0 + 10.0 * 10.0 + 30.0);
    assert_eq!(bill.monthly_usd * 12.0, 48_960.0, "a year");
}

#[test]
fn barebones_company_pays_minimum_compute() {
    // 7.1, 10.0.11.1: 10 base compute (1 bundled + 9 extra) and 10 data compute, CEO on
    // productivity, 0 TB: $550 a month, $6,600 a year (5.5 rounds it to $7,000).
    let ceo = Stations {
        productivity: 1,
        ..Stations::default()
    };
    let bill = compute_bill(&ceo, 0.0);
    assert_eq!(
        (bill.extra_base_compute, bill.data_compute, bill.licences),
        (9, 10, 0)
    );
    assert_eq!(bill.monthly_usd, 550.0);
    // The CEO splitting 50/50 needs a licence.
    let split = Stations {
        fifty_fifty: 1,
        ..Stations::default()
    };
    assert_eq!(compute_bill(&split, 0.0).licences, 1);
}

#[test]
fn compute_scales_with_stations_and_storage() {
    assert_eq!(extra_base_compute(45), 9);
    assert_eq!(extra_base_compute(46), 10);
    assert_eq!(extra_base_compute(15), 9);
    assert_eq!(extra_base_compute(75), 15, "0.2 × 75 is exactly 15 (D209)");
    assert_eq!(extra_base_compute(1_000_000), 200_000);
    assert_eq!(data_compute(0.0), 10);
    assert_eq!(data_compute(833.0), 10, "ceil(9.996)");
    assert_eq!(data_compute(834.0), 11, "ceil(10.008)");
    assert_eq!(data_compute(100_000.0), 1_200);
}
