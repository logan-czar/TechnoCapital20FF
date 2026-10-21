//! M2.4: the AI boom and the pop from ai-boom.csv (spec 5.1.1). Done when the noise-off AI labs
//! demand matches validate.py's boom run year by year.

mod common;

use std::collections::{BTreeMap, BTreeSet};

use common::data;
use common::economy::{economy_scheduler, industry, month_starts, rel, run_month};
use sim::economy::ai_boom::roll_pop_date;
use sim::rng::{NoNoise, RngStreams};
use sim::time::Date;
use sim::world::{AiStage, AlertKind, Notice, PhaseLabel, World};

/// validate-boom-calm.csv: (industry key, year) → (lt, year-end demand in $bn).
fn calm_run() -> BTreeMap<(String, i32), (f64, f64)> {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/validate-boom-calm.csv"
    );
    let text = std::fs::read_to_string(path).unwrap();
    let mut out = BTreeMap::new();
    for line in text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
    {
        let p: Vec<&str> = line.split(',').collect();
        assert_eq!(p[0], "demand");
        out.insert(
            (p[1].to_owned(), p[2].parse().unwrap()),
            (p[3].parse().unwrap(), p[4].parse().unwrap()),
        );
    }
    out
}

fn has_world_event(notices: &[Notice]) -> bool {
    notices.iter().any(|n| {
        matches!(
            n,
            Notice::Alert {
                kind: AlertKind::WorldEvent,
                ..
            }
        )
    })
}

#[test]
fn noise_off_boom_run_matches_validate_py_year_by_year() {
    let want = calm_run();
    let d = data();
    let mut w = World::from_data(&d).unwrap();
    // validate.py's noise-free run drops the cycle term as well as the shocks (`cycle = ... if
    // noise else 0.0`); Z = 0 does the same here, and NoNoise makes every z 0.
    w.cycle.z_avg = 0.0;
    sim::economy::start(&mut w, &mut NoNoise);
    // validate.py's run pops on 1 January 2040.
    w.ai.pop_date = Date::ymd(2040, 1, 1);
    let s = economy_scheduler();
    let ai = industry(&w, "ai_labs");
    let mut compared = 0;
    for date in month_starts(Date::ymd(2020, 2, 1), Date::ymd(2046, 1, 1)) {
        let notices = run_month(&s, &mut w, &mut NoNoise, date);
        let boom_or_pop = date == Date::ymd(2030, 1, 1) || date == Date::ymd(2040, 1, 1);
        assert_eq!(has_world_event(&notices), boom_or_pop, "{date}");
        if date.month != 1 {
            continue;
        }
        // The 1 January job closes December, so the year just ended is complete (D100). On the
        // pop day the same job has already cut demand by crash_drop (4.3 step 1a), which
        // validate.py applies after its 2039 year-end row.
        let year = date.year - 1;
        for (_, ind) in w.industries.iter() {
            let (lt, demand_bn) = want[&(ind.key.clone(), year)];
            let cut = if date == w.ai.pop_date {
                1.0 - ind.params.crash_drop
            } else {
                1.0
            };
            let want_usd = demand_bn * 1e9 * cut;
            assert!(
                rel(ind.demand_core, want_usd) < 1e-9,
                "{} {year}: {} vs validate.py {}",
                ind.key,
                ind.demand_core,
                want_usd
            );
            assert!((ind.prev_lt - lt).abs() < 1e-12, "{} {year} lt", ind.key);
            compared += 1;
        }
        // Labels (5.1.1): linked industries read Boom for the boom's first 4 quarters and Bust
        // for the 8 bust quarters, whatever the gap.
        let label = w.industries[ai].phase_label;
        match date.year {
            2030 => assert_eq!(label, PhaseLabel::Boom),
            2031 => assert_ne!(label, PhaseLabel::Boom, "the forced Boom is over"),
            2040 | 2041 => assert_eq!(label, PhaseLabel::Bust),
            _ => {}
        }
        let stage = w.ai.stage;
        let want_stage = match date.year {
            ..2030 => AiStage::Preboom,
            2030..2040 => AiStage::Boom,
            2040..2042 => AiStage::Bust,
            _ => AiStage::Postcrash,
        };
        assert_eq!(stage, want_stage, "{date}");
    }
    assert_eq!(compared, 26 * 42);

    // The spec 5.1.1 table, from the same run: AI labs $8B at the end of 2029, about doubling in
    // 2030, $692B in 2039 and $311B at the end of 2040.
    let ai_bn = |y: i32| want[&("ai_labs".to_owned(), y)].1;
    assert!((ai_bn(2029) - 8.1).abs() < 0.1);
    assert!((ai_bn(2030) - 16.3).abs() < 0.1);
    assert!((ai_bn(2039) - 691.5).abs() < 0.1);
    assert!((ai_bn(2040) - 311.2).abs() < 0.1);
    // Linked industries' lt in boom year 0: Data centers 29% (spec 4.1 test table).
    assert!((want[&("data_centers".to_owned(), 2030)].0 - 0.2925).abs() < 1e-12);
}

#[test]
fn the_pop_date_rolls_2038_to_2042_on_a_quarter_start() {
    let mut seen = BTreeSet::new();
    for seed in 0..400 {
        let d = roll_pop_date(&mut RngStreams::new(seed));
        assert!((2038..=2042).contains(&d.year), "{d}");
        assert!(matches!(d.month, 1 | 4 | 7 | 10) && d.day == 1, "{d}");
        seen.insert((d.year, d.month));
    }
    assert_eq!(seen.len(), 20, "every year and quarter comes up");

    // A new game rolls it at load and starts in Preboom (spec 7.3).
    let sim = sim::Sim::new(data(), 9).unwrap();
    let ai = &sim.world().ai;
    assert_eq!(ai.stage, AiStage::Preboom);
    assert_eq!(ai.boom_date, Date::ymd(2030, 1, 1));
    assert_eq!(ai.pop_date, roll_pop_date(&mut RngStreams::new(9)));
}
