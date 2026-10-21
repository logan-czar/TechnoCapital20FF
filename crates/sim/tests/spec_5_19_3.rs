//! Spec 5.19.3 (each startup), build-plan M6.8: the size cap, the carve (supply unchanged by a
//! birth before PC bonuses), stations by the 7.1 rules, the newborn fixed cost rate, the run
//! rate, seed cash, rating, engine value, the 7.1 open price and shares, and the cap table.
//! Expected values worked by hand from the spec and data.

mod common;

use common::data;
use sim::Sim;
use sim::ai::archetype::Archetype;
use sim::births::startup::{
    BirthInputs, birth_fixed_cost_rate, birth_run_rate, birth_stations, build_startup, cap_table,
    carve, fringe_revenue, open_price, shares_for, sized_revenue, startup_archetype,
};
use sim::finance::rating::Rating;
use sim::ops::stations::Stations;
use sim::world::IndustryParams;

fn params(key: &str) -> IndustryParams {
    let sim = Sim::new(data(), 1).unwrap();
    let w = sim.world();
    w.industries
        .iter()
        .find(|(_, i)| i.key == key)
        .map(|(_, i)| i.params.clone())
        .unwrap()
}

#[test]
fn size_is_capped_at_2_percent_of_the_fringe_and_skipped_under_1m() {
    // $500M of fringe revenue caps at $10M.
    assert_eq!(sized_revenue(30.0e6, 500.0e6), Some(10.0e6));
    assert_eq!(sized_revenue(8.0e6, 500.0e6), Some(8.0e6));
    // $40M of fringe caps a $5M target at $0.8M: skipped.
    assert_eq!(sized_revenue(5.0e6, 40.0e6), None);
    assert_eq!(sized_revenue(5.0e6, 50.0e6), Some(1.0e6));
    // Fringe revenue is fringe assets × turnover (D268).
    assert_eq!(fringe_revenue(2.0e9, 1.0), 2.0e9);
    assert_eq!(fringe_revenue(-1.0, 1.0), 0.0);
}

#[test]
fn carve_conserves_supply_before_pc_bonuses() {
    // Spec 5.2: supply = fringe × turnover + Σ unit gross × turnover × p_pre ÷ 100. At p_pre 100
    // (no PC bonus) a carved unit supplies exactly what left the fringe.
    let (fringe, turnover, cpd) = (3.0e9, 1.0, 1.0);
    let c = carve(12.0e6, cpd, fringe);
    assert_eq!(c.gross_assets, 12.0e6);
    let before = fringe * turnover;
    let after = c.fringe_assets_after * turnover + c.gross_assets * turnover * 100.0 / 100.0;
    assert!((after - before).abs() < 1e-6);
    // Never more than the fringe holds.
    let c = carve(12.0e6, cpd, 5.0e6);
    assert_eq!((c.gross_assets, c.fringe_assets_after), (5.0e6, 0.0));
}

#[test]
fn stations_by_the_7_1_rules() {
    let p = params("software");
    // $5M of assets at labor_value $100,000: 50 labor units; productivity round(12.5) = 12
    // (halves to even, as gen.py); enterprise ceil(0.5 × 5 × 1 ÷ 10.95) = 1; idle 37.
    let (l, s) = birth_stations(5.0e6, 5.0e6, &p);
    assert_eq!(l, 50);
    assert_eq!(
        s,
        Stations {
            productivity: 12,
            enterprise: 1,
            fifty_fifty: 0,
            research: 0,
            idle: 37
        }
    );
    // D200: the smallest startup ($1M) has 10 labor units, so all five seats open.
    assert_eq!(birth_stations(1.0e6, 1.0e6, &p).0, 10);
}

#[test]
fn newborn_fixed_cost_rate_and_run_rate() {
    let p = params("software");
    let (_, s) = birth_stations(5.0e6, 5.0e6, &p);
    // D269: f × turnover − d_eff − shared ÷ gross. No decay at $5M (under $10M); the 3.8 bill:
    // max(9, ceil(50 ÷ 5)) = 10 extra base × $50 + 10 data compute × $10 + 1 licence × $30 =
    // $630 a month, $7,560 a year: 0.45 − 7,560 ÷ 5,000,000 = 0.448488.
    let fcr = birth_fixed_cost_rate(5.0e6, &s, &p);
    assert!((fcr - 0.448488).abs() < 1e-12, "{fcr}");
    // Run rate at productivity 100 + PC bonus 2 (PC 12), M 1.0: revenue $5.1M. With R&D at the
    // norm (5%): 5.1 − 2.55 (v 0.5) − 2.24244 (fixed) − 0.255 − 0.00756 = $45,000 (0.45 × 2% of
    // $5M from the bonus).
    let r = birth_run_rate(5.0e6, &s, fcr, 0.05, &p);
    assert_eq!(r.pc_bonus, 2);
    assert!((r.revenue - 5.1e6).abs() < 1e-6);
    assert!((r.ebit - 45_000.0).abs() < 1e-6, "{}", r.ebit);
    assert_eq!(r.ebitda, r.ebit);
    // A Tech Startup's 1.2 × norm R&D (6%) costs $51,000 more: −$6,000 (design fix 240).
    let r = birth_run_rate(5.0e6, &s, fcr, 0.06, &p);
    assert!((r.ebit + 6_000.0).abs() < 1e-6, "{}", r.ebit);
}

#[test]
fn open_price_reproduces_company_start_for_all_651() {
    // Spec 7.1: open_price = clamp(round(25 × (value ÷ $1B)^0.35 × jitter), 5, 200), jitter
    // from the company id (gen.py price_jitter); shares = value ÷ open_price.
    let d = data();
    let mut wrong = Vec::new();
    for r in &d.company_start.rows {
        if open_price(r.engine_value_usd, &r.id) != r.open_price {
            wrong.push(r.id.clone());
        }
        assert!((shares_for(r.engine_value_usd, r.open_price) as f64 - r.shares).abs() <= 1.0);
    }
    assert!(wrong.is_empty(), "{wrong:?}");
    // Arrowhead (ARDR) $9 on $60M.
    let a = d
        .company_start
        .rows
        .iter()
        .find(|r| r.id == "CO-0001")
        .unwrap();
    assert_eq!(open_price(a.engine_value_usd, "CO-0001"), 9.0);
}

#[test]
fn cap_table_splits_60_40() {
    // Lead founder 30%, the others 30% in equal parts, seed investors 40%.
    let t = cap_table(1_000_000, 3);
    assert_eq!(t.founders, vec![300_000, 150_000, 150_000]);
    assert_eq!(t.seed_investors, 400_000);
    // A lone founder holds all 60% (D270).
    let t = cap_table(1_000_000, 1);
    assert_eq!(
        (t.founders.clone(), t.seed_investors),
        (vec![600_000], 400_000)
    );
    // Rounding goes to the seed investors; the parts always sum to shares_out.
    let t = cap_table(1_000_001, 4);
    assert_eq!(t.total(), 1_000_001);
    assert_eq!(t.founders, vec![300_000, 100_000, 100_000, 100_000]);
}

#[test]
fn archetype_without_trait_rows() {
    // 5.19.3: a Tech startup under $50M is a Startup, else Incumbent.
    assert_eq!(startup_archetype(20.0e6, true), Archetype::Startup);
    assert_eq!(startup_archetype(50.0e6, true), Archetype::Incumbent);
    assert_eq!(startup_archetype(20.0e6, false), Archetype::Incumbent);
}

#[test]
fn a_retail_startup_end_to_end() {
    // $20M Retail in the USA: gross $20M, book $20M, seed cash $10M, no line.
    let p = params("retail");
    let b = build_startup(&BirthInputs {
        key: "CO-0652",
        revenue: 20.0e6,
        params: &p,
        industry_key: "retail",
        tech: false,
        fringe_assets: 10.0e9,
        tax_rate: 0.258,
        sovereign: Rating::Aaa,
        base_rate: 0.03,
        home_spread: 0.0,
        g_sector: 0.03,
        book_floor_share: 0.6,
    });
    assert_eq!(
        (b.gross_assets, b.asset_book, b.cash),
        (20.0e6, 20.0e6, 10.0e6)
    );
    assert_eq!(b.fringe_assets_after, 10.0e9 - 20.0e6);
    assert_eq!(b.archetype, Archetype::Incumbent);
    assert_eq!(b.labor, 200);
    // EBIT: 20.4 (bonus +2 from 50 productivity stations) − 10.2 − 20 × fcr − 1.02 − shared:
    // the bill is 40 × $50 + 10 × $10 + 1 × $30 = $2,130 a month, so fcr = 0.45 − 25,560 ÷ 20M
    // and fixed + shared = 0.45 × $20M: EBIT = 20.4 − 10.2 − 9.0 − 1.02 = $180,000.
    assert!(
        (b.run_rate.ebit - 180_000.0).abs() < 1e-6,
        "{}",
        b.run_rate.ebit
    );
    // Net cash with EBITDA above 0 is AAA, +1 cover, −1 size: AAA, under the AAA+1 ceiling.
    assert_eq!(b.rating, Rating::Aaa);
    // Engine value: 0.3 × $30M + 0.7 × NI × 17 × G × R is under the 0.6 × book floor of $18M.
    assert!((b.engine_value - 18.0e6).abs() < 1e-6);
    assert_eq!(b.open_price, open_price(18.0e6, "CO-0652"));
    assert_eq!(b.shares_out, shares_for(18.0e6, b.open_price));
}

#[test]
fn company_names_from_the_world_gen_lists() {
    use sim::births::names::{CompanyNames, compose};
    use sim::rng::RngStreams;
    let d = data();
    let names = CompanyNames::from_data(&d);
    let sim = Sim::new(d.clone(), 1).unwrap();
    let w = sim.world();
    let id_of = |key: &str| {
        w.countries
            .iter()
            .find(|(_, c)| c.key == key)
            .map(|(id, _)| id)
    };
    let (usa, chn) = (id_of("USA").unwrap(), id_of("CHN").unwrap());
    let sw = w
        .industries
        .iter()
        .find(|(_, i)| i.key == "software")
        .map(|(id, _)| id)
        .unwrap();
    let suffixes: Vec<String> = d
        .industry_suffixes
        .rows
        .iter()
        .filter(|s| s.industry == "Software")
        .map(|s| s.suffix.clone())
        .collect();
    assert_eq!(names.suffixes(sw), suffixes.as_slice());
    let mut rng = RngStreams::new(4);
    let mut made: Vec<String> = Vec::new();
    for _ in 0..200 {
        let n = names.draw(usa, sw, &|x| made.iter().any(|m| m == x), &mut rng);
        assert!(suffixes.iter().any(|s| n.ends_with(s.as_str())), "{n}");
        assert!(!made.contains(&n));
        made.push(n);
    }
    // companies.csv names are taken: a draw never repeats one.
    let taken = |x: &str| d.companies.rows.iter().any(|c| c.name == x);
    for _ in 0..200 {
        assert!(!taken(&names.draw(chn, sw, &taken, &mut rng)));
    }
    // China draws its culture's prefixes (names/east-asia-oceania.csv, chinese).
    assert!(!names.prefixes(chn).is_empty());
    assert_ne!(names.prefixes(chn), names.prefixes(usa));
    // gen.py puts Maison and Atelier first.
    assert_eq!(compose("Lumen", "Maison"), "Maison Lumen");
    assert_eq!(compose("Ironbark", "Software"), "Ironbark Software");
}
