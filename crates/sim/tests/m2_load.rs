//! M2.6 and M2.7: units loaded from company-start.csv with the 7.1 PC bonus and fixed cost rate,
//! fringe pools, supply, S and M (spec 5.2, 5.3, 7.1, 7.2). Done when named revenue matches
//! companies.csv within 0.5% and every industry starts at S 1.00, M 1.00.

mod common;

use common::data;
use common::economy::{industry, world_at_load};
use sim::economy::start::{BAREBONES_ASSETS_USD, BAREBONES_REVENUE_USD, start_loadout};
use sim::ops::stations::{pc_bonus, productive_compute};
use sim::rng::RngStreams;
use sim::world::{CompanyId, Ordinal};

/// Gross assets at load by the 7.1 rule, written from the spec:
/// `R × capital_per_dollar × 100 ÷ (100 + PC bonus + location bonus)`, location bonus 0.
fn gross_by_spec(revenue: f64, capital_per_dollar: f64, bonus: f64) -> f64 {
    revenue * capital_per_dollar * 100.0 / (100.0 + bonus)
}

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
            assert_eq!(unit.gross_assets, BAREBONES_ASSETS_USD, "{}", c.key);
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
        let gross = gross_by_spec(c.revenue_usd, params.capital_per_dollar, c.pc_bonus);
        assert!((gross - unit.gross_assets).abs() <= 0.5, "{}", c.key);
        // The bonus load holds is the loadout's second pass (D106), lane F's one implementation.
        let loadout = start_loadout(&c.key, c.revenue_usd, 0.0, params);
        assert_eq!(c.pc_bonus, f64::from(loadout.assets_bonus), "{}", c.key);
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
        // The station rule on the loaded gross: L = floor(gross ÷ labor_value), stations
        // max(1, round(0.25 × L)), bonus floor(1 + log10(PC)) (5.8, 5.10, 7.1).
        let l = (u.gross_assets / params.labor_value_usd).floor();
        let stations = (0.25 * l).round_ties_even().max(1.0);
        assert_eq!(stations * params.pc_modifier, c.pc, "{key}");
        assert_eq!((1.0 + c.pc.log10()).floor(), 6.0, "{key}");
        assert_eq!(
            pc_bonus(productive_compute(&c.stations, params.pc_modifier)),
            6
        );
    }
}

#[test]
fn fixed_cost_rate_at_load() {
    let w = world_at_load(&data(), &mut RngStreams::new(1));
    // f × turnover − d_eff − shared ÷ gross (5.5, 7.1), with the shared costs a year of the 3.8
    // bill (M3.5): $50 per extra base compute max(9, ceil(0.2 × stations)), $10 per data compute
    // max(10, ceil(1.2 × TB stored ÷ 100)), $30 per enterprise licence, each a month.
    let mut rates = Vec::new();
    for (_, u) in w.units.iter() {
        let c = &w.companies[u.company];
        let p = &w.industries[u.industry].params;
        let decay = p.asset_decay * (u.gross_assets - p.asset_decay_threshold_usd).max(0.0);
        let s = &c.stations;
        let stations = s.productivity + s.enterprise + s.fifty_fifty + s.research + s.idle;
        let stored: f64 = c.data.iter().map(|d| d.book.stored_tb()).sum();
        let extra = stations.div_ceil(5).max(9) as f64;
        let data_compute = (1.2 * stored / 100.0).ceil().max(10.0);
        let licences = (s.enterprise + s.fifty_fifty) as f64;
        let shared = 12.0 * (50.0 * extra + 10.0 * data_compute + 30.0 * licences);
        let want = p.fixed_cost_share * p.asset_turnover
            - decay / u.gross_assets
            - shared / u.gross_assets;
        assert!((u.fixed_cost_rate - want).abs() < 1e-12, "{}", c.key);
        rates.push(u.fixed_cost_rate);
    }
    // Spec 5.5: 0.38 to 0.449, median 0.439 (the barebones three at 0.45 − 0.066, design fix
    // 207's $6,600, round to 0.38).
    rates.sort_by(f64::total_cmp);
    let (lo, hi, median) = (rates[0], rates[rates.len() - 1], rates[rates.len() / 2]);
    println!("fixed cost rate {lo:.3} to {hi:.3}, median {median:.3}");
    assert_eq!(format!("{lo:.2} {hi:.3} {median:.3}"), "0.38 0.449 0.439");
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
