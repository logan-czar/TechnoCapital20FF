//! Spec 5.19.1 (random startup events), build-plan M6.6: the industry weight (heat, fringe
//! factor, the Glut and Bust zero and the all-zero fallback), the type table, the HQ province
//! weight (2-map 2.3.1) and a 300-seed Monte-Carlo of the event rate (about 8 a year in the
//! 2020s) over ChaCha streams.

mod common;

use common::data;
use sim::births::random::{
    EventKind, EventType, TYPE_CUMULATIVE, TYPE_TABLE, draw_random_event, draw_random_events,
    draw_type, event_count,
};
use sim::births::weights::{
    development_above_floor, fringe_factor, gdp_per_head, heat, hq_weight, industry_weight,
    province_weight, wealth_factor, weighted_pick,
};
use sim::rng::{DrawSource, NoNoise, RngStreams, ScriptedDraws, Stream};
use sim::world::{IndustryId, PhaseLabel, ProvinceId};

fn q_of(year_rate: f64) -> f64 {
    (1.0 + year_rate).powf(0.25) - 1.0
}

#[test]
fn heat_and_fringe_factor() {
    // h = max(0, (1 + q)^4 − 1 − 6%): 10% a year is 4 points of heat; 3% none.
    assert!((heat(q_of(0.10)) - 0.04).abs() < 1e-12);
    assert_eq!(heat(q_of(0.03)), 0.0);
    // f = clamp(1 + log10(fringe $B), 0.5, 5).
    assert!((fringe_factor(1.0e9) - 1.0).abs() < 1e-12);
    assert!((fringe_factor(100.0e9) - 3.0).abs() < 1e-12);
    assert_eq!(fringe_factor(1.0e14), 5.0);
    assert_eq!(fringe_factor(0.1e9), 0.5);
    // D261: no fringe revenue reads the clamp floor.
    assert_eq!(fringe_factor(0.0), 0.5);
}

#[test]
fn industry_weight_rule() {
    // w = f × (0.02 + h)²: a $1B fringe on trend at 3% weighs 0.0004.
    assert!((industry_weight(q_of(0.03), 1.0e9, PhaseLabel::Normal) - 0.0004).abs() < 1e-15);
    // Glut and Bust weigh 0; Boom does not.
    assert_eq!(industry_weight(q_of(0.5), 1.0e9, PhaseLabel::Glut), 0.0);
    assert_eq!(industry_weight(q_of(0.5), 1.0e9, PhaseLabel::Bust), 0.0);
    assert!(industry_weight(q_of(0.5), 1.0e9, PhaseLabel::Boom) > 0.0);
    // The square makes hot industries win: AI labs at 100% a year (h 0.94) against Retail at
    // 3% with a fringe 100× larger: 0.96² × f(5) vs 0.02² × f(500).
    let ai = industry_weight(q_of(1.0), 5.0e9, PhaseLabel::Boom);
    let retail = industry_weight(q_of(0.03), 500.0e9, PhaseLabel::Normal);
    let f5 = 1.0 + 5.0f64.log10();
    let f500 = 1.0 + 500.0f64.log10();
    assert!((ai - f5 * 0.96f64.powi(2)).abs() < 1e-9);
    assert!((retail - f500 * 0.0004).abs() < 1e-12);
    assert!(ai / retail > 500.0);
}

#[test]
fn weighted_pick_and_fallback() {
    // All zero (every industry Glut or Bust, D261): no pick and no draw.
    let mut s = ScriptedDraws::new();
    assert_eq!(weighted_pick(&[0.0, 0.0], &mut s), None);
    // u 0.5 of total 4: the cumulative walk lands in the second entry.
    s.push(Stream::Gen, [0.5]);
    assert_eq!(weighted_pick(&[1.0, 2.0, 1.0], &mut s), Some(1));
    // Zero entries are skipped.
    s.push(Stream::Gen, [0.0]);
    assert_eq!(weighted_pick(&[0.0, 3.0], &mut s), Some(1));
    // An event with every industry at 0 does not fire.
    let ind = [(IndustryId(0), 0.0), (IndustryId(1), 0.0)];
    let hq = |_: IndustryId| vec![(ProvinceId(0), 1.0)];
    assert_eq!(draw_random_event(&ind, &hq, &mut NoNoise), None);
}

#[test]
fn type_table_and_count() {
    // Spec 5.19.1: 50 / 30 / 15 / 5.
    let chances: Vec<f64> = TYPE_TABLE.iter().map(|r| r.chance).collect();
    assert_eq!(chances, vec![0.50, 0.30, 0.15, 0.05]);
    let mut acc = 0.0;
    for (c, edge) in chances.iter().zip(TYPE_CUMULATIVE) {
        acc += c;
        assert!((acc - edge).abs() < 1e-12);
    }
    let mut s = ScriptedDraws::new();
    s.push(Stream::Gen, [0.49, 0.5, 0.79, 0.8, 0.949, 0.95, 0.999]);
    let kinds: Vec<EventType> = (0..7).map(|_| draw_type(&mut s)).collect();
    use EventType::*;
    assert_eq!(
        kinds,
        vec![
            GarageFounder,
            SpinOutTeam,
            SpinOutTeam,
            HotCluster,
            HotCluster,
            BackedVenture,
            BackedVenture
        ]
    );
    // Rows: startups, revenue ($M), full and partial characters each.
    let hot = HotCluster.row();
    assert_eq!((hot.startups.lo, hot.startups.hi), (2, 3));
    assert_eq!(hot.revenue_musd, (5.0, 30.0));
    let backed = BackedVenture.row();
    assert_eq!(
        (
            backed.full.lo,
            backed.full.hi,
            backed.partial.lo,
            backed.partial.hi
        ),
        (3, 5, 3, 5)
    );
    // NoNoise's Poisson is its rounded mean: 2.
    assert_eq!(event_count(&mut NoNoise), 2);
}

#[test]
fn province_weight_from_2_map_2_3_1() {
    // G = sqrt(GDP per head ÷ world GDP per head), clamped 0.1 to 4 (batch 160, D260).
    let d = data();
    let (gdp, pop) = d.countries.rows.iter().fold((0.0, 0.0), |(g, p), c| {
        (g + c.gdp_usd_bn, p + c.population_m)
    });
    let world = gdp_per_head(gdp, pop);
    // About $11,209 (thousands of USD a head in CSV units).
    assert!((world - 11.209).abs() < 0.01, "world {world}");
    let g = |iso: &str| {
        let c = d.countries.rows.iter().find(|c| c.iso3 == iso).unwrap();
        wealth_factor(gdp_per_head(c.gdp_usd_bn, c.population_m), world)
    };
    for (iso, want) in [
        ("USA", 2.53),
        ("CAN", 2.04),
        ("CHL", 1.15),
        ("MYS", 0.99),
        ("CHN", 0.95),
        ("NGA", 0.45),
        ("IND", 0.43),
        ("BDI", 0.15),
    ] {
        assert!((g(iso) - want).abs() < 0.006, "{iso} G {}", g(iso));
    }
    // The safety clamp touches only Vatican City (5.17 to 4).
    assert_eq!(g("VAT"), 4.0);
    let clamped: Vec<&str> = d
        .countries
        .rows
        .iter()
        .filter(|c| {
            let r = (gdp_per_head(c.gdp_usd_bn, c.population_m) / world).sqrt();
            !(0.1..=4.0).contains(&r)
        })
        .map(|c| c.iso3.as_str())
        .collect();
    assert_eq!(clamped, vec!["VAT"]);
    // Examples: a US Metro core province at 75 weighs $56.9B; Penang (30, G 0.99) about $8.95B.
    assert!((province_weight(75, g("USA")) / 1e9 - 56.9).abs() < 0.1);
    assert!((province_weight(30, g("MYS")) / 1e9 - 8.95).abs() < 0.1);
    // HQ weight: × (1 + named companies of the industry there) × 3 with a key city listing it.
    assert_eq!(hq_weight(10.0e9, 2, true), 90.0e9);
    assert_eq!(hq_weight(10.0e9, 0, false), 10.0e9);
}

/// D830 (Logan, 2026-10-24): the startup HQ weight counts development above the floor, so a
/// province at 1/1/1 draws no HQ; a country with every province at the floor keeps the 2.3.1
/// weight (none in the starting world).
#[test]
fn hq_weight_counts_development_above_the_floor() {
    assert_eq!(development_above_floor(1, 1, 1), 0);
    assert_eq!(development_above_floor(9, 15, 16), 37);
    assert_eq!(development_above_floor(0, 2, 1), 1);
    let w = sim::world::World::from_data(&data()).unwrap();
    let sites = &w.births.sites;
    assert!(sites.hq_fallback_countries.is_empty());
    let floor = data()
        .all_provinces()
        .filter(|(_, _, p)| p.commerce + p.industry + p.population == 3)
        .count();
    let zero = sites.hq_weight.iter().filter(|x| **x == 0.0).count();
    assert_eq!(zero, floor);
    assert!(
        floor > 700,
        "the split giants' new parts sit at the floor ({floor})"
    );
    for (i, (h, full)) in sites.hq_weight.iter().zip(&sites.weight).enumerate() {
        assert!(h <= full, "province {i}");
    }
}

/// The 2020s industry weights from the data: every industry Normal on trend (q_growth = lt_q
/// of trend_growth), fringe revenue = world size − named revenue (7.2), in id order.
fn data_weights() -> Vec<(IndustryId, f64, String)> {
    let d = data();
    let mut rows: Vec<_> = d.industries.rows.iter().collect();
    rows.sort_by(|a, b| a.id.cmp(&b.id));
    rows.iter()
        .enumerate()
        .map(|(i, ind)| {
            let named: f64 = d
                .companies
                .rows
                .iter()
                .filter(|c| c.industry == ind.name)
                .map(|c| c.revenue_usd_m * 1e6)
                .sum();
            let fringe = (ind.world_size_2020_usd_bn * 1e9 - named).max(0.0);
            (
                IndustryId(i as u32),
                industry_weight(q_of(ind.trend_growth), fringe, PhaseLabel::Normal),
                ind.id.clone(),
            )
        })
        .collect()
}

#[test]
fn rate_near_8_events_a_year_over_300_seeds() {
    let rows = data_weights();
    let weights: Vec<(IndustryId, f64)> = rows.iter().map(|(i, w, _)| (*i, *w)).collect();
    let hq = |_: IndustryId| {
        vec![
            (ProvinceId(0), 1.0),
            (ProvinceId(1), 2.0),
            (ProvinceId(2), 1.0),
        ]
    };
    let ai = rows.iter().find(|r| r.2 == "ai_labs").unwrap().0;
    let retail = rows.iter().find(|r| r.2 == "retail").unwrap().0;
    let (seeds, years) = (300u64, 10u32);
    let (mut events, mut startups) = (0u64, 0u64);
    let mut by_type = [0u64; 4];
    let (mut ai_events, mut retail_events) = (0u64, 0u64);
    for seed in 0..seeds {
        let mut rng = RngStreams::new(seed);
        for _ in 0..years * 4 {
            for e in draw_random_events(&weights, &hq, &mut rng) {
                events += 1;
                startups += e.startups.len() as u64;
                if let EventKind::Random(t) = e.kind {
                    by_type[t as usize] += 1;
                }
                let ind = e.startups[0].industry;
                ai_events += u64::from(ind == ai);
                retail_events += u64::from(ind == retail);
            }
        }
    }
    let per_year = events as f64 / (seeds * u64::from(years)) as f64;
    println!(
        "random events a year {per_year:.2}; startups a year {:.2}; types {by_type:?}; AI labs \
         {ai_events}, Retail {retail_events} of {events}",
        startups as f64 / (seeds * u64::from(years)) as f64
    );
    // Spec 5.19.1: Poisson mean 2 a lock, about 8 a year (3,000 seed-years: sd of the mean 0.05).
    assert!((per_year - 8.0).abs() < 0.2, "{per_year}");
    // Types near 50 / 30 / 15 / 5%.
    for (n, want) in by_type.iter().zip([0.50, 0.30, 0.15, 0.05]) {
        assert!((*n as f64 / events as f64 - want).abs() < 0.015);
    }
    // Startups per event: 0.5 + 0.3 + 0.15 × 2.5 + 0.05 = 1.225.
    assert!((startups as f64 / events as f64 - 1.225).abs() < 0.02);
    // Retail (3%, Normal) almost never gets one.
    assert!((retail_events as f64) < 0.03 * events as f64);
}

#[test]
fn ai_labs_take_most_events_in_the_boom() {
    let mut rows = data_weights();
    let d = data();
    // Boom year 0: AI labs at 100% a year with the 2020 fringe.
    let ai_i = rows.iter().position(|r| r.2 == "ai_labs").unwrap();
    let ai_ind = d
        .industries
        .rows
        .iter()
        .find(|i| i.id == "ai_labs")
        .unwrap();
    let named: f64 = d
        .companies
        .rows
        .iter()
        .filter(|c| c.industry == ai_ind.name)
        .map(|c| c.revenue_usd_m * 1e6)
        .sum();
    rows[ai_i].1 = industry_weight(
        q_of(1.0),
        ai_ind.world_size_2020_usd_bn * 1e9 - named,
        PhaseLabel::Boom,
    );
    let weights: Vec<(IndustryId, f64)> = rows.iter().map(|(i, w, _)| (*i, *w)).collect();
    let hq = |_: IndustryId| vec![(ProvinceId(0), 1.0)];
    let mut rng = RngStreams::new(7);
    let (mut all, mut ai) = (0, 0);
    for _ in 0..400 {
        for e in draw_random_events(&weights, &hq, &mut rng) {
            all += 1;
            ai += usize::from(e.startups[0].industry == rows[ai_i].0);
        }
    }
    assert!(ai * 2 > all, "AI labs {ai} of {all}");
}

#[test]
fn hot_cluster_shares_one_province_and_ranges_hold() {
    let weights = [(IndustryId(3), 1.0)];
    let hq = |_: IndustryId| (0..50).map(|p| (ProvinceId(p), 1.0)).collect::<Vec<_>>();
    let mut rng = RngStreams::new(11);
    let mut seen_hot = false;
    for _ in 0..2000 {
        let Some(e) = draw_random_event(&weights, &hq, &mut rng) else {
            continue;
        };
        let EventKind::Random(t) = e.kind else {
            panic!()
        };
        let row = t.row();
        let n = e.startups.len() as u8;
        assert!((row.startups.lo..=row.startups.hi).contains(&n));
        let hq0 = e.startups[0].hq;
        for s in &e.startups {
            assert_eq!(s.hq, hq0);
            let r = s.target_revenue_usd / 1e6;
            assert!(r >= row.revenue_musd.0 - 1e-9 && r <= row.revenue_musd.1 + 1e-9);
            assert!((row.full.lo..=row.full.hi).contains(&s.full));
            assert!((row.partial.lo..=row.partial.hi).contains(&s.partial));
        }
        seen_hot |= t == EventType::HotCluster;
    }
    assert!(seen_hot);
    // The draws are on the gen stream only.
    let mut a = RngStreams::new(5);
    let mut b = RngStreams::new(5);
    draw_random_events(&weights, &hq, &mut a);
    for s in [Stream::Cycle, Stream::Growth, Stream::Prices, Stream::Ai] {
        assert_eq!(a.next_u64(s), b.next_u64(s));
    }
}
