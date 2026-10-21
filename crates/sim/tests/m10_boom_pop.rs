//! M10.5 (build-plan M10 table; spec 10 M10 "the AI boom and the pop fire on their dates and,
//! with noise off, AI labs demand matches validate.py's boom run"; D405): the whole engine, every
//! job of every slot, run with the cycle and growth streams silenced.
//!
//! M2.4 (`m2_ai_boom.rs`) checked the demand path alone. Here the full game runs: births, the
//! Lite AI, the books, the market and the news all play out with their own real draws (prices,
//! AI and gen streams), and only the two streams validate.py's noise-free run turns off are
//! replaced by [`NoNoise`]: the cycle (phase draws, zone shocks) and growth (the quarterly z).
//! validate.py also drops the cycle term (`cycle = ... if noise else 0.0`); Z = 0 does the same
//! here, set before the load's draws. Nothing else in the engine writes demand_core,
//! trend_demand, lt or the growth carry (births, the AI and the books read demand, never write
//! it), so the full engine must give validate.py's numbers to 1e-9, year by year, and it does:
//! no feedback to explain away.
//!
//! The pop is checked twice: on validate.py's date (1 January 2040, a seed that rolls it) for
//! the year-by-year match, and on a seed whose roll lands mid-year, where the pop must fire on
//! the rolled date and cut every industry by its crash_drop exactly then.

mod common;

use std::collections::BTreeMap;

use common::data;
use common::economy::rel;
use sim::economy::ai_boom::roll_pop_date;
use sim::economy::demand::month_factor;
use sim::rng::{DrawSource, NoNoise, RngStreams, Stream};
use sim::time::{Controls, Date, DateTime};
use sim::world::{AiStage, AlertKind, Notice, World};

/// validate.py's boom run pops on 1 January 2040 (spec 5.1.1).
const FIXTURE_POP: Date = Date {
    year: 2040,
    month: 1,
    day: 1,
};

/// The draws of the noise-off run: cycle and growth give "no rolls" ([`NoNoise`]), the other
/// streams are the seed's own.
struct CalmCycleAndGrowth(RngStreams);

impl CalmCycleAndGrowth {
    fn calm(s: Stream) -> bool {
        matches!(s, Stream::Cycle | Stream::Growth)
    }
}

impl DrawSource for CalmCycleAndGrowth {
    fn next_u64(&mut self, s: Stream) -> u64 {
        if Self::calm(s) {
            NoNoise.next_u64(s)
        } else {
            self.0.next_u64(s)
        }
    }

    fn uniform(&mut self, s: Stream) -> f64 {
        if Self::calm(s) {
            NoNoise.uniform(s)
        } else {
            self.0.uniform(s)
        }
    }

    fn normal(&mut self, s: Stream) -> f64 {
        if Self::calm(s) {
            NoNoise.normal(s)
        } else {
            self.0.normal(s)
        }
    }

    fn poisson(&mut self, s: Stream, mean: f64) -> u32 {
        if Self::calm(s) {
            NoNoise.poisson(s, mean)
        } else {
            self.0.poisson(s, mean)
        }
    }

    fn int_inclusive(&mut self, s: Stream, lo: i64, hi: i64) -> i64 {
        if Self::calm(s) {
            NoNoise.int_inclusive(s, lo, hi)
        } else {
            self.0.int_inclusive(s, lo, hi)
        }
    }
}

/// `sim::start_world` step by step, with a hook between the static tables and the load's draws
/// (where Z is zeroed). [`the_start_replica_is_start_world`] holds it to the real one.
fn start_world_with(
    data: &sim_data::WorldData,
    draws: &mut dyn DrawSource,
    before_draws: impl FnOnce(&mut World),
) -> World {
    let mut world = World::from_data(data).unwrap();
    before_draws(&mut world);
    sim::economy::start(&mut world, draws);
    sim::births::jobs::draw_tipped_lab_at_load(&mut world, draws);
    sim::ai::jobs::plan_at_load(&mut world);
    sim::people::seating::start(&mut world, draws);
    sim::births::jobs::draw_first_votes(&mut world, draws);
    sim::finance::start(&mut world);
    sim::market::start(&mut world, draws);
    world.news.labels = world
        .industries
        .rows()
        .iter()
        .map(|i| i.phase_label)
        .collect();
    world
}

#[test]
fn the_start_replica_is_start_world() {
    let d = data();
    let (mut a, mut b) = (RngStreams::new(5), RngStreams::new(5));
    let replica = start_world_with(&d, &mut a, |_| {});
    let real = sim::start_world(&d, &mut b).unwrap();
    assert_eq!(replica, real);
    assert_eq!(a, b, "the same draws in the same order");
    // And it is the Sim's own start state.
    assert_eq!(&real, sim::Sim::new(d, 5).unwrap().world());
}

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

/// The first seed whose pop roll (the load's first gen draws, D111) is `want`.
fn seed_popping_on(want: impl Fn(Date) -> bool) -> u64 {
    (0..10_000)
        .find(|&s| want(roll_pop_date(&mut RngStreams::new(s))))
        .expect("a seed rolls it")
}

/// What the noise-off full-engine run saw.
struct Run {
    pop_date: Date,
    /// Ticks with a World event alert.
    world_events: Vec<DateTime>,
    /// Every industry's year-end comparisons made against the fixture.
    compared: usize,
    /// Every industry's demand_core × (1 − crash_drop) × the month factor, against the value
    /// after the pop tick: the largest relative miss.
    pop_cut_miss: f64,
}

/// The full engine from the seed's start with cycle and growth calm and Z = 0, to `end`. At each
/// 1 January close up to the pop, every industry's demand_core and lt are checked against
/// validate.py's calm run (`want`), as M2.4 checks the demand path alone.
fn run_calm(seed: u64, end: Date, want: &BTreeMap<(String, i32), (f64, f64)>) -> Run {
    let d = data();
    let mut draws = CalmCycleAndGrowth(RngStreams::new(seed));
    let mut world = start_world_with(&d, &mut draws, |w| w.cycle.z_avg = 0.0);
    let pop_date = world.ai.pop_date;
    assert_eq!(pop_date, roll_pop_date(&mut RngStreams::new(seed)));
    assert_eq!(world.ai.boom_date, Date::ymd(2030, 1, 1));
    let scheduler = sim::scheduler();
    let controls = Controls::default();
    let mut run = Run {
        pop_date,
        world_events: Vec::new(),
        compared: 0,
        pop_cut_miss: 0.0,
    };
    let (end, pop_tick) = (DateTime::midnight(end), DateTime::midnight(pop_date));
    let mut born = 0;
    while world.clock < end {
        // Just before the pop tick: what the pop must leave (4.3 step 1a cuts by crash_drop,
        // then step 2 moves demand by last quarter's growth, D100).
        let expected_after_pop: Option<Vec<f64>> = (world.clock.next() == pop_tick).then(|| {
            world
                .industries
                .rows()
                .iter()
                .map(|i| i.demand_core * (1.0 - i.params.crash_drop) * month_factor(i.q_growth))
                .collect()
        });
        let stage_before = world.ai.stage;
        let mut notices = Vec::new();
        scheduler.run_tick(&mut world, &mut draws, &mut notices, &controls, None);
        let now = world.clock;
        for n in &notices {
            match n {
                Notice::Alert {
                    kind: AlertKind::WorldEvent,
                    ..
                } => run.world_events.push(now),
                Notice::CompanyBorn(_) => born += 1,
                _ => {}
            }
        }
        if let Some(e) = expected_after_pop {
            assert_eq!(stage_before, AiStage::Boom);
            assert_eq!(world.ai.stage, AiStage::Bust, "the pop fires at {now}");
            for (want_core, ind) in e.iter().zip(world.industries.rows()) {
                run.pop_cut_miss = run.pop_cut_miss.max(rel(ind.demand_core, *want_core));
            }
        }
        let date = now.date();
        if now.hour() != 0 || date.day != 1 {
            continue;
        }
        // The stage by quarter (5.1.1, D111): Boom from 1 Jan 2030, Bust 8 quarters from the
        // pop, then Postcrash.
        let q = |d: Date| i64::from(d.year) * 4 + i64::from(d.quarter().q);
        let want_stage = match q(date) {
            x if x < q(Date::ymd(2030, 1, 1)) => AiStage::Preboom,
            x if x < q(pop_date) => AiStage::Boom,
            x if x < q(pop_date) + 8 => AiStage::Bust,
            _ => AiStage::Postcrash,
        };
        assert_eq!(world.ai.stage, want_stage, "{date}");
        // The year-end match, while the run's history is validate.py's: every year when the
        // pop is the fixture's (1 January 2040); otherwise the closes before both pops, since
        // validate.py's years from 2040 on are after its pop.
        let in_fixture = pop_date == FIXTURE_POP || (date < pop_date && date <= FIXTURE_POP);
        if date.month != 1 || !in_fixture {
            continue;
        }
        let year = date.year - 1;
        for ind in world.industries.rows() {
            let (lt, demand_bn) = want[&(ind.key.clone(), year)];
            let cut = if date == pop_date {
                1.0 - ind.params.crash_drop
            } else {
                1.0
            };
            let want_usd = demand_bn * 1e9 * cut;
            assert!(
                rel(ind.demand_core, want_usd) < 1e-9,
                "seed {seed}: {} {year}: {} vs validate.py {want_usd}",
                ind.key,
                ind.demand_core
            );
            assert!((ind.prev_lt - lt).abs() < 1e-12, "{} {year} lt", ind.key);
            run.compared += 1;
        }
    }
    assert!(born > 0, "the full engine ran: companies were born");
    run
}

#[test]
fn noise_off_full_engine_matches_validate_py_year_by_year() {
    let want = calm_run();
    // validate.py's pop date, rolled by the seed itself (no override).
    let seed = seed_popping_on(|d| d == FIXTURE_POP);
    let run = run_calm(seed, Date::ymd(2046, 1, 1), &want);
    assert_eq!(run.pop_date, FIXTURE_POP);
    assert_eq!(
        run.world_events,
        [
            DateTime::midnight(Date::ymd(2030, 1, 1)),
            DateTime::midnight(Date::ymd(2040, 1, 1))
        ],
        "the boom on 1 January 2030 and the pop on its rolled date, nothing else"
    );
    // 2020 to 2039 by their 1 January closes, and 2045's close after the pop: 26 years.
    assert_eq!(run.compared, 26 * 42);
    assert!(run.pop_cut_miss < 1e-12, "{}", run.pop_cut_miss);
}

#[test]
fn noise_off_pop_fires_on_a_mid_year_rolled_date() {
    let want = calm_run();
    let seed = seed_popping_on(|d| d.year == 2041 && d.month == 7);
    let run = run_calm(seed, Date::ymd(2044, 1, 1), &want);
    assert_eq!(run.pop_date, Date::ymd(2041, 7, 1));
    assert_eq!(
        run.world_events,
        [
            DateTime::midnight(Date::ymd(2030, 1, 1)),
            DateTime::midnight(Date::ymd(2041, 7, 1))
        ]
    );
    // 2020 to 2039 match validate.py, whose pop on 1 January 2040 then parts the two runs.
    assert_eq!(run.compared, 20 * 42);
    assert!(run.pop_cut_miss < 1e-12, "{}", run.pop_cut_miss);
}
