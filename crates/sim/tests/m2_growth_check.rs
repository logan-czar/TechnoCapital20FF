//! M2.10, the growth check (build-plan 4.2, spec 5.1 "Growth check"): validate.py's seed-150
//! 40-quarter run, replayed through the engine. `export_fixtures.py` recorded every draw
//! validate.py made (the cycle's g and length draws, each industry's growth shock) and its
//! results (the phase path and each industry's compound average yearly growth); the engine runs
//! the same draws through [`ScriptedDraws`] and must match to 1e-9.

mod common;

use std::collections::BTreeMap;

use common::data;
use common::economy::{economy_scheduler, month_starts, rel, run_month, world_at_load};
use sim::Stream;
use sim::rng::ScriptedDraws;
use sim::time::Date;
use sim::world::World;

const QUARTERS: usize = 40;

/// validate-growth-seed150.csv, parsed.
struct Fixture {
    z_avg: f64,
    /// Quarter → (u, length) of a phase draw made that quarter (0 = load).
    cycle: BTreeMap<usize, (f64, f64)>,
    /// (quarter, industry key) → raw z.
    z: BTreeMap<(usize, String), f64>,
    /// Quarter → (phase name, g).
    path: Vec<(String, f64)>,
    /// Industry key → compound average yearly growth.
    avg: BTreeMap<String, f64>,
    quarters_of_draws: usize,
}

fn fixture() -> Fixture {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/validate-growth-seed150.csv"
    );
    let text = std::fs::read_to_string(path).unwrap();
    let mut f = Fixture {
        z_avg: f64::NAN,
        cycle: BTreeMap::new(),
        z: BTreeMap::new(),
        path: Vec::new(),
        avg: BTreeMap::new(),
        quarters_of_draws: 0,
    };
    for line in text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
    {
        let p: Vec<&str> = line.split(',').collect();
        let num = |i: usize| p[i].parse::<f64>().unwrap();
        let q = || p[1].parse::<usize>().unwrap();
        match p[0] {
            "z_avg" => f.z_avg = num(1),
            "cycle" => {
                f.cycle.insert(q(), (num(2), num(3)));
            }
            "z" => {
                f.quarters_of_draws = f.quarters_of_draws.max(q() + 1);
                f.z.insert((q(), p[2].to_owned()), num(3));
            }
            "path" => {
                assert_eq!(q(), f.path.len());
                f.path.push((p[2].to_owned(), num(3)));
            }
            "avg" => {
                f.avg.insert(p[1].to_owned(), num(2));
            }
            other => panic!("unknown fixture row {other}"),
        }
    }
    f
}

/// The fixture's draws in the order the engine makes them: per quarter, the cycle stream's phase
/// draws (if the phase changed) then one own shock per zone with own dynamics (validate.py has
/// none, so 0), and the growth stream's z for every industry in id order. The gen stream rolls
/// the pop date at load (2040 Q1; it does not touch 2020 to 2029).
fn scripted(f: &Fixture, w: &World) -> ScriptedDraws {
    let mut s = ScriptedDraws::new();
    s.push(Stream::Gen, [0.0, 1.0]);
    let shock_zones = w.zones.iter().filter(|(_, z)| z.own_shock_sd > 0.0).count();
    for q in 0..f.quarters_of_draws {
        if let Some(&(u, len)) = f.cycle.get(&q) {
            s.push(Stream::Cycle, [u, len]);
        }
        s.push(Stream::Cycle, std::iter::repeat_n(0.0, shock_zones));
        for (_, ind) in w.industries.iter() {
            s.push(Stream::Growth, [f.z[&(q, ind.key.clone())]]);
        }
    }
    s
}

#[test]
fn seed_150_growth_run_matches_validate_py() {
    let f = fixture();
    let d = data();
    let fresh = World::from_data(&d).unwrap();
    assert!(
        (fresh.cycle.z_avg - f.z_avg).abs() < 1e-12,
        "Z {} vs validate.py {}",
        fresh.cycle.z_avg,
        f.z_avg
    );
    assert_eq!(f.quarters_of_draws, QUARTERS + 1);
    let mut draws = scripted(&f, &fresh);
    let mut w = world_at_load(&d, &mut draws);
    let s = economy_scheduler();

    // q_growth by quarter and industry; the phase path.
    let n = w.industries.len();
    let mut growth: Vec<Vec<f64>> = vec![Vec::new(); n];
    let mut path = Vec::new();
    let record = |w: &World, growth: &mut Vec<Vec<f64>>, path: &mut Vec<(String, f64)>| {
        for (id, ind) in w.industries.iter() {
            growth[id.0 as usize].push(ind.q_growth);
        }
        path.push((w.cycle.phase.name().to_owned(), w.cycle.g_t));
    };
    record(&w, &mut growth, &mut path);
    // Every month from February 2020 to 1 January 2030, whose job closes December 2029 (D100).
    for date in month_starts(Date::ymd(2020, 2, 1), Date::ymd(2030, 1, 1)) {
        run_month(&s, &mut w, &mut draws, date);
        if date.month % 3 == 1 && date.year < 2030 {
            record(&w, &mut growth, &mut path);
        }
    }
    assert_eq!(draws.remaining(Stream::Cycle), 0, "every cycle draw used");
    assert_eq!(draws.remaining(Stream::Growth), 0, "every growth draw used");

    // The cycle path: same phase and the same g every quarter.
    assert_eq!(path.len(), QUARTERS);
    for (q, ((p, g), (fp, fg))) in path.iter().zip(&f.path).enumerate() {
        assert_eq!(p, fp, "phase in quarter {q}");
        assert!((g - fg).abs() < 1e-15, "g in quarter {q}: {g} vs {fg}");
    }

    // Compound average yearly growth over the 40 quarters, to 1e-9.
    let mut worst: f64 = 0.0;
    for (id, ind) in w.industries.iter() {
        let qs = &growth[id.0 as usize];
        assert_eq!(qs.len(), QUARTERS);
        let log_sum: f64 = qs.iter().map(|q| (1.0 + q).ln()).sum();
        let avg = (4.0 * log_sum / QUARTERS as f64).exp() - 1.0;
        let want = f.avg[&ind.key];
        worst = worst.max((avg - want).abs());
        assert!(
            (avg - want).abs() < 1e-9,
            "{}: {avg} vs validate.py {want}",
            ind.key
        );
        // Demand follows the draws: after the 1 Jan 2030 job, the 2020 world size times every
        // quarter's growth (M2.5).
        let product: f64 = qs.iter().map(|q| 1.0 + q).product();
        let want_demand = ind.world_size_2020_usd * product;
        assert!(
            rel(ind.demand_core, want_demand) < 1e-9,
            "{} demand {} vs {}",
            ind.key,
            ind.demand_core,
            want_demand
        );
    }
    println!("worst |avg − validate.py| = {worst:e}");

    // The spec 5.1 summary of this run (batch 151): Retail 4.2%, Software 10.5%, AI labs 5.6%,
    // Oil −0.2%; this seed spends 26 of 40 quarters in Expansion or Overheating.
    let avg_of = |key: &str| f.avg[key];
    assert!((avg_of("retail") - 0.042).abs() < 0.0005);
    assert!((avg_of("software") - 0.105).abs() < 0.0005);
    assert!((avg_of("ai_labs") - 0.056).abs() < 0.0005);
    assert!((avg_of("oil") + 0.002).abs() < 0.0005);
    let hot = path
        .iter()
        .filter(|(p, _)| p == "Expansion" || p == "Overheating")
        .count();
    assert_eq!(hot, 26);
}
