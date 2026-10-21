//! Spec 7.1 Arrowhead check, formula side (build-plan M3.8): 392 labor units, PC bonus +2,
//! about 8.6 TB held, EBIT after R&D about $1.6M.
//!
//! The M3 functions (loadout, stations, data, compute) are composed with Arrowhead's 7.1
//! numbers. The revenue and expense lines belong to lane S's M2 (5.4, 5.5) and the R&D plan to
//! M6 (6.1, 6.3); until they land, this test computes those few lines by hand from the spec
//! (marked "by hand" below). Lane S can swap them for its functions without changing the
//! expected numbers.

use sim::ops::compute::compute_bill;
use sim::ops::data::{DataBook, DataParams, conversion_capacity};
use sim::ops::labor::{labor_units, open_seats};
use sim::ops::productivity::idle_decay;
use sim::ops::stations::{
    ARROWHEAD_ENTERPRISE_SHARE, ARROWHEAD_KEY, LoadoutInputs, pc_bonus, productive_compute,
    starting_loadout,
};
use sim::people::board::Seat;
use sim::people::simple::CompanySize;

fn industry<'a>(data: &'a sim_data::WorldData, name: &str) -> &'a sim_data::Industry {
    data.industries
        .rows
        .iter()
        .find(|i| i.name == name)
        .unwrap()
}

#[test]
fn arrowhead_check() {
    let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
    let co = data
        .companies
        .rows
        .iter()
        .find(|c| c.id == ARROWHEAD_KEY)
        .unwrap();
    assert_eq!(
        (co.name.as_str(), co.industry.as_str()),
        ("Arrowhead Drilling", "Oil")
    );
    let oil = industry(&data, &co.industry);
    let r = co.revenue_usd_m * 1.0e6;
    assert_eq!(r, 40.0e6);

    // Loadout (7.1): first pass +3, second +2; 392 labor units; 98 productivity stations (PC 98,
    // +2); 1 enterprise station; about 293 idle (decay 0.3).
    let l = starting_loadout(LoadoutInputs {
        revenue_usd: r,
        capital_per_dollar: oil.capital_per_dollar,
        labor_value_usd: oil.labor_value_usd,
        pc_modifier: oil.pc_modifier,
        data_tb_per_musd: oil.data_tb_per_musd,
        location_bonus: 0.0,
        enterprise_share: ARROWHEAD_ENTERPRISE_SHARE,
    });
    assert_eq!(l.first_pass_bonus, 3);
    assert_eq!(l.pc_bonus, 2);
    let gross = l.gross_assets_usd;
    assert!((gross - 39.2e6).abs() < 0.05e6, "gross {gross}");
    let start = &data.company_start.rows[0];
    assert_eq!(start.id, ARROWHEAD_KEY);
    assert!((gross - start.gross_assets_usd).abs() <= 0.5);
    assert_eq!(l.labor, 392);
    assert_eq!(labor_units(gross, oil.labor_value_usd), 392);
    assert_eq!(l.stations.productivity, 98);
    assert_eq!(productive_compute(&l.stations, oil.pc_modifier), 98.0);
    assert_eq!(pc_bonus(l.pc), 2);
    assert_eq!(l.stations.enterprise, 1);
    assert_eq!(l.stations.idle, 293);
    assert_eq!(idle_decay(l.stations.idle, l.labor), 0.3);
    // Five seats of a small company.
    assert_eq!(open_seats(l.labor), &Seat::LABOR);
    assert_eq!(CompanySize::from_revenue(r), CompanySize::Small);

    // Data (7.1, 5.9): about 8.6 TB held at start, 1% free R&D.
    let params = DataParams {
        tb_per_musd: oil.data_tb_per_musd,
        decay_base: oil.data_decay_base,
    };
    let book = DataBook::at_load(
        r,
        params,
        conversion_capacity(&l.stations),
        ARROWHEAD_ENTERPRISE_SHARE,
    );
    assert!((book.held - 8.6).abs() < 0.05, "held {}", book.held);
    assert_eq!(book.free_rd_pct, 1);
    let free_rd = book.free_rd_fraction();

    // Shared costs (3.8): the month's compute bill, a year of it.
    let shared = compute_bill(&l.stations, book.stored_tb()).monthly_usd * 12.0;
    assert_eq!(shared, 48_960.0);

    // By hand, lane S's M2 lines (5.4, 5.5, 5.10) at M 1.0 and productivity 100:
    let m = 1.0;
    let p_pre = 100.0 + f64::from(l.pc_bonus); // + location bonus 0 (5.2, 5.4)
    let revenue = gross * oil.asset_turnover * p_pre * m / 100.0;
    assert!((revenue - r).abs() < 1.0, "revenue {revenue}");
    let v = 1.0 - oil.margin_full_use - oil.fixed_cost_share;
    let variable = revenue * v;
    let decay_usd = oil.asset_decay * (gross - oil.asset_decay_threshold_usd).max(0.0);
    let d_eff = decay_usd / gross;
    let fixed_cost_rate = oil.fixed_cost_share * oil.asset_turnover - d_eff - shared / gross;
    let fixed_cash = gross * fixed_cost_rate;
    let depreciation = decay_usd.min(0.5 * gross);
    let ebit_before_rd = revenue - variable - fixed_cash - depreciation - shared;
    // 7.1: about $2.35M, 5% plus 0.45 × 2 ÷ 102 from the PC bonus.
    let expected = r * (oil.margin_full_use + oil.fixed_cost_share * 2.0 / 102.0);
    assert!((ebit_before_rd - expected).abs() < 1.0);
    assert!((ebit_before_rd - 2.35e6).abs() < 0.01e6, "{ebit_before_rd}");

    // By hand, M6's R&D plan (6.1, 6.3): Terry is Greedy, so a Cash cow (R&D mult 0.7) with the
    // Greedy trait mult 0.8: target 2.8%, less 1% free.
    let target = oil.rd_norm * 0.7 * 0.8;
    let rd_plan = (target - free_rd).max(0.0);
    let rd_spend = revenue * rd_plan;
    assert!((rd_spend - 0.72e6).abs() < 1.0, "paid R&D {rd_spend}");
    let ebit_after_rd = ebit_before_rd - rd_spend;
    assert!((ebit_after_rd - 1.6e6).abs() < 0.05e6, "{ebit_after_rd}");
    let margin = ebit_after_rd / revenue;
    assert!((margin - 0.041).abs() < 0.001, "margin {margin}");

    // Replacement to hold assets flat (5.10): 1% of the $29.2M above $10M.
    assert!((decay_usd - 0.29e6).abs() < 0.005e6, "{decay_usd}");
}
