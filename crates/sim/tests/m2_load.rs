//! M2.6 and M2.7: units loaded from company-start.csv with the 7.1 PC bonus and fixed cost rate,
//! fringe pools, supply, S and M (spec 5.2, 5.3, 7.1, 7.2). Done when named revenue matches
//! companies.csv within 0.5% and every industry starts at S 1.00, M 1.00.

mod common;

use common::data;
use common::economy::{industry, world_at_load};
use sim::economy::start::{
    BAREBONES_GROSS_USD, BAREBONES_REVENUE_USD, gross_at_load, load_pc_bonus, start_pc_bonus,
};
use sim::rng::RngStreams;
use sim::world::{CompanyId, Ordinal};

#[test]
fn named_revenue_matches_companies_csv_within_half_a_percent() {
    let d = data();
    let w = world_at_load(&d, &mut RngStreams::new(1));
    assert_eq!(w.units.len(), 651);
    let mut worst: f64 = 0.0;
    let mut barebones = 0;
    for (cid, c) in w.companies.iter() {
        assert_eq!(c.units.len(), 1);
        let unit = &w.units[c.units[0]];
        assert_eq!(unit.company, cid);
        assert_eq!(
            (unit.industry, unit.base_province),
            (c.industry, c.hq_province)
        );
        assert_eq!(unit.productivity, 100.0);
        let yearly = 12.0 * unit.revenue_m;
        if c.revenue_usd < BAREBONES_REVENUE_USD {
            // The barebones loadout (7.1): one $100,000 asset, the CEO's station gives PC 1,
            // bonus +1, so it makes $101,000 a year whatever companies.csv says (D107).
            assert_eq!(unit.gross_assets, BAREBONES_GROSS_USD, "{}", c.key);
            assert_eq!(c.pc_bonus, 1.0);
            assert!((yearly - 101_000.0).abs() < 1.0, "{} {yearly}", c.key);
            barebones += 1;
            continue;
        }
        let err = (yearly - c.revenue_usd).abs() / c.revenue_usd;
        worst = worst.max(err);
        assert!(err < 0.005, "{}: {yearly} vs {}", c.key, c.revenue_usd);
        // company-start.csv's gross assets are the 7.1 rule at this bonus, rounded to dollars.
        let params = &w.industries[c.industry].params;
        let gross = gross_at_load(c.revenue_usd, c.pc_bonus, 0.0, params);
        assert!((gross - unit.gross_assets).abs() <= 0.5, "{}", c.key);
        assert_eq!(c.pc_bonus, start_pc_bonus(c.revenue_usd, 0.0, params));
    }
    assert_eq!(barebones, 3, "CO-0003, CO-0026 and CO-0027 start barebones");
    println!("worst named revenue error {:.4}%", 100.0 * worst);

    // Arrowhead (7.1 check): PC bonus +2, gross assets about $39.2M, book half of it, $80.4M cash.
    let a = &w.companies[CompanyId::from_index(0)];
    let au = &w.units[a.units[0]];
    assert_eq!(a.pc_bonus, 2.0);
    assert!((au.gross_assets - 39.2e6).abs() < 0.1e6);
    assert!((au.asset_book - 0.5 * au.gross_assets).abs() <= 1.0);
    assert!((a.cash_usd - 80.4e6).abs() < 0.1e6 && a.line_drawn_usd == 0.0);

    // D106 (design fix 201): the 7.1 two-pass bonus does not settle for the three ~$42B
    // companies. The station rule on their loaded gross assets gives +6, but company-start.csv
    // was generated at +5, so load keeps +5 and revenue matches companies.csv.
    for key in ["CO-0154", "CO-0540", "CO-0651"] {
        let (_, c) = w.companies.iter().find(|(_, c)| c.key == key).unwrap();
        let u = &w.units[c.units[0]];
        let params = &w.industries[c.industry].params;
        assert_eq!(c.pc_bonus, 5.0, "{key}");
        assert_eq!(load_pc_bonus(u.gross_assets, params), 6.0, "{key}");
    }
}

#[test]
fn fixed_cost_rate_at_load() {
    let w = world_at_load(&data(), &mut RngStreams::new(1));
    // f × turnover − d_eff − shared ÷ gross (5.5, 7.1). Shared costs are 0 until M3.5, so the rate
    // is 0.45 less d_eff: 0.45 at $10M of assets or less, toward 0.44 for large units.
    for (_, u) in w.units.iter() {
        let p = &w.industries[u.industry].params;
        let decay = p.asset_decay * (u.gross_assets - p.asset_decay_threshold_usd).max(0.0);
        let want = p.fixed_cost_share * p.asset_turnover - decay / u.gross_assets;
        assert!((u.fixed_cost_rate - want).abs() < 1e-15);
        assert!(
            (0.44..=0.45).contains(&u.fixed_cost_rate),
            "{}",
            u.fixed_cost_rate
        );
    }
}

#[test]
fn every_industry_starts_at_s_one_and_m_one() {
    let w = world_at_load(&data(), &mut RngStreams::new(1));
    for (id, ind) in w.industries.iter() {
        // Fringe = what named revenue leaves of the world size (5.3, 7.2).
        let named: f64 = w
            .companies
            .iter()
            .filter(|(_, c)| c.industry == id)
            .map(|(_, c)| c.revenue_usd)
            .sum();
        let fringe_revenue = ind.fringe_assets * ind.params.asset_turnover;
        assert!(
            (named + fringe_revenue - ind.world_size_2020_usd).abs() < 1.0,
            "{} named + fringe = world demand",
            ind.key
        );
        assert_eq!(format!("{:.2}", ind.supply_ratio), "1.00", "{} S", ind.key);
        assert_eq!(format!("{:.2}", ind.market_factor), "1.00", "{} M", ind.key);
        assert!(
            (ind.supply_ratio - 1.0).abs() < 1e-4,
            "{} S {}",
            ind.key,
            ind.supply_ratio
        );
    }
    // Named revenue is below world size everywhere: Oil $1.35T of $2.5T (7.2).
    let oil = industry(&w, "oil");
    assert!((w.industries[oil].fringe_assets - 1.15e12).abs() < 0.01e12);
}
