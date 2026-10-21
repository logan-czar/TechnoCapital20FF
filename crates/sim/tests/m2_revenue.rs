//! M2.8: revenue and expenses with productivity held at 100 (spec 5.4, 5.5). Done when the
//! barebones company breaks even before R&D plans exist (R&D at the norm, the plan every unit
//! runs until the M6 Lite AI sets one).

mod common;

use common::data;
use common::economy::{economy_scheduler, rel, run_month, world_at_load};
use sim::economy::assets::placeholder_plan;
use sim::economy::revenue::{month_expenses, unit_revenue_month};
use sim::economy::start::{BAREBONES_ASSETS_USD, fixed_cost_rate_at_load};
use sim::economy::supply::{p_pre, unit_supply};
use sim::rng::RngStreams;
use sim::time::Date;

#[test]
fn the_barebones_company_breaks_even() {
    let w = world_at_load(&data(), &mut RngStreams::new(1));
    let params = &w.industries.iter().next().unwrap().1.params;
    let (growth, rd) = placeholder_plan(params);
    assert_eq!(
        (growth, rd),
        (0.0, 0.05),
        "before plans: hold assets, R&D at the norm"
    );
    // 10.0.11.1: one $100,000 asset at productivity 100 and M 1.0 makes $100,000 a year. With the
    // $7,000 of shared costs of spec 5.5 the fixed cost rate is 0.38; with M2's 0 (the M3.5 hook)
    // it is 0.45. Either way revenue equals expenses with R&D at the norm.
    for shared_year in [7_000.0, 0.0] {
        let rate = fixed_cost_rate_at_load(BAREBONES_ASSETS_USD, shared_year, params);
        let want_rate = if shared_year > 0.0 { 0.38 } else { 0.45 };
        assert!((rate - want_rate).abs() < 1e-12, "{rate}");
        let revenue = unit_revenue_month(BAREBONES_ASSETS_USD, 1.0, 100.0, 1.0);
        assert!((revenue - 100_000.0 / 12.0).abs() < 1e-9);
        let e = month_expenses(
            revenue,
            BAREBONES_ASSETS_USD,
            0.5 * BAREBONES_ASSETS_USD,
            rate,
            rd,
            params,
            shared_year / 12.0,
        );
        assert_eq!(e.depreciation, 0.0, "no decay under $10M");
        assert!(
            (revenue - e.total()).abs() < 1e-9,
            "EBIT {}",
            revenue - e.total()
        );
    }

    // The loaded barebones company (CO-0003) carries its +1 PC bonus: its only profit is the
    // 0.45 × bonus ÷ (100 + bonus) of revenue that productivity above 100 gives (spec 2.2), at
    // the load M (1.00 to two decimals).
    let (_, c) = w
        .companies
        .iter()
        .find(|(_, c)| c.key == "CO-0003")
        .unwrap();
    let u = &w.units[c.units[0]];
    let fixed_and_dep = 0.45 * BAREBONES_ASSETS_USD / 12.0;
    assert!((u.ebit_m() - (0.45 * u.revenue_m - fixed_and_dep)).abs() < 1e-9);
    assert!((u.ebit_m() / u.revenue_m - 0.45 / 101.0).abs() < 1e-4);
}

#[test]
fn every_company_at_load_earns_only_its_pc_bonus() {
    // At load S = M = 1.0 and productivity 100, so EBIT after R&D at the norm is exactly
    // f × bonus ÷ (100 + bonus) of revenue (spec 2.2 "Built-table checks", 5.5).
    let w = world_at_load(&data(), &mut RngStreams::new(1));
    for (_, u) in w.units.iter() {
        let c = &w.companies[u.company];
        let ind = &w.industries[u.industry];
        let f = ind.params.fixed_cost_share;
        let m = ind.market_factor;
        // Variable and R&D scale with M; fixed cash and depreciation sum to f × gross × turnover.
        let rev100 = u.gross_assets * ind.params.asset_turnover / 12.0;
        let want = u.revenue_m * (1.0 - 0.5 - 0.05) - f * rev100;
        assert!(
            (u.ebit_m() - want).abs() < 1e-6 * u.revenue_m.max(1.0),
            "{}",
            c.key
        );
        let at_m1 = c.pc_bonus / (100.0 + c.pc_bonus) * f;
        assert!(
            (u.ebit_m() / u.revenue_m - at_m1).abs() < 1e-3,
            "{}: margin {} vs {at_m1} (M {m})",
            c.key,
            u.ebit_m() / u.revenue_m
        );
    }
}

#[test]
fn units_share_industry_revenue_by_supply() {
    let d = data();
    let mut rng = RngStreams::new(8);
    let mut w = world_at_load(&d, &mut rng);
    let s = economy_scheduler();
    for date in [
        Date::ymd(2020, 2, 1),
        Date::ymd(2020, 3, 1),
        Date::ymd(2020, 4, 1),
    ] {
        run_month(&s, &mut w, &mut rng, date);
    }
    for (id, ind) in w.industries.iter() {
        // Total industry revenue = supply × M (5.4), a month.
        let named: f64 = w
            .units
            .iter()
            .filter(|(_, u)| u.industry == id)
            .map(|(_, u)| u.revenue_m)
            .sum();
        let total = named + ind.fringe_revenue_m;
        assert!(
            rel(total, ind.supply * ind.market_factor / 12.0) < 1e-12,
            "{}",
            ind.key
        );
        for (_, u) in w.units.iter().filter(|(_, u)| u.industry == id) {
            let sup = unit_supply(
                u.assets_eff(),
                ind.params.asset_turnover,
                p_pre(u, &w.companies[u.company]),
            );
            assert!(rel(u.revenue_m / total, sup / ind.supply) < 1e-12);
        }
    }
}
