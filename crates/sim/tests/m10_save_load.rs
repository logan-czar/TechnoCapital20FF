//! M10.4 (build-plan 4.3 "Save at a random tick, load, continue: same hashes"; D404): a game is
//! saved at ticks chosen by its seed, each save is loaded into another game, and play goes on
//! from the loaded state; every monthly state hash, and the world at the end, must match an
//! unbroken run of the same seed. Same machine and build only (decision A).
//!
//! The cuts cover the moments with the most state in flight: a seed-chosen tick at random, the
//! plan lock tick itself and a tick mid-way through the locked quarter (the locked plans and the
//! consensus wait in the world), a tick mid-way through a reaction week (5.15, 21.3.1), and the
//! ticks right after a birth, a listing and a bankruptcy. Each category's tick is one of that
//! category's events in the run, picked by the seed.
//!
//! `cargo test -p sim --test m10_save_load` runs the short check (2 years, one seed). The full
//! check (30 years on two seeds, a few minutes in release) is ignored by default:
//!
//! ```text
//! cargo test --release -p sim --test m10_save_load -- --ignored
//! ```

mod common;

use common::data;
use sim::finance::distress::CompanyStatus;
use sim::time::{Date, DateTime};
use sim::{Notice, Sim, StateHash};

/// Random cuts per run, besides one of each event category.
const RANDOM_CUTS: usize = 3;
/// Hours into the locked quarter for the mid-lock cut (about 3 weeks after the 9th, 00:00).
const MID_LOCK_HOURS: u32 = 24 * 21 + 5;
/// Hours after the release tick (the 2nd, 00:00) for the mid-reaction-week cut: the 5th, 13:00.
const MID_REACTION_HOURS: u32 = 24 * 3 + 13;
/// Salt for the cut picker's splitmix64 (the test's own numbers, not a sim stream).
const CUT_SALT: u64 = 0x4d31_3034_4355_5453;

/// splitmix64.
struct Picker(u64);

impl Picker {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn pick(&mut self, from: &[u32]) -> Option<u32> {
        (!from.is_empty()).then(|| from[(self.next() % from.len() as u64) as usize])
    }
}

/// The ticks (hours since the start) where each kind of event happened in a run.
#[derive(Debug, Default)]
struct Events {
    locks: Vec<u32>,
    mid_locks: Vec<u32>,
    mid_reactions: Vec<u32>,
    births: Vec<u32>,
    listings: Vec<u32>,
    bankruptcies: Vec<u32>,
}

fn bankrupt_count(sim: &Sim) -> usize {
    sim.world()
        .companies
        .iter()
        .filter(|(_, c)| c.finance.status() == CompanyStatus::Bankrupt)
        .count()
}

/// An unbroken run: the hash after every month close, the events seen, and the final game.
fn straight(data: &sim_data::WorldData, seed: u64, end: u32) -> (Vec<StateHash>, Events, Sim) {
    let mut sim = Sim::new(data.clone(), seed).unwrap();
    let (mut hashes, mut ev) = (Vec::new(), Events::default());
    let mut bankrupt = bankrupt_count(&sim);
    while sim.now().hours() < end {
        let notices = sim.step();
        let t = sim.now().hours();
        for n in &notices {
            match n {
                Notice::MonthDone(_) => {
                    hashes.push(sim.state_hash());
                    let now = bankrupt_count(&sim);
                    if now > bankrupt {
                        ev.bankruptcies.push(t);
                    }
                    bankrupt = now;
                }
                Notice::PlanLocked(_) => {
                    ev.locks.push(t);
                    ev.mid_locks.push(t + MID_LOCK_HOURS);
                }
                Notice::EarningsReleased(_) => ev.mid_reactions.push(t + MID_REACTION_HOURS),
                Notice::CompanyBorn(_) => ev.births.push(t),
                Notice::CompanyListed(_) => ev.listings.push(t),
                _ => {}
            }
        }
    }
    for v in [
        &mut ev.locks,
        &mut ev.mid_locks,
        &mut ev.mid_reactions,
        &mut ev.births,
        &mut ev.listings,
        &mut ev.bankruptcies,
    ] {
        v.retain(|&t| t < end);
        v.dedup();
    }
    (hashes, ev, sim)
}

/// The seed's cuts: one tick of each event category and [`RANDOM_CUTS`] random ticks, sorted.
fn cuts(seed: u64, ev: &Events, end: u32, need: &[&str]) -> Vec<u32> {
    let mut p = Picker(seed ^ CUT_SALT);
    let mut out = Vec::new();
    for (name, from) in [
        ("lock", &ev.locks),
        ("mid_lock", &ev.mid_locks),
        ("mid_reaction", &ev.mid_reactions),
        ("birth", &ev.births),
        ("listing", &ev.listings),
        ("bankruptcy", &ev.bankruptcies),
    ] {
        match p.pick(from) {
            Some(t) => out.push(t),
            None => assert!(!need.contains(&name), "seed {seed}: no {name} in the run"),
        }
    }
    for _ in 0..RANDOM_CUTS {
        out.push(1 + (p.next() % u64::from(end - 1)) as u32);
    }
    out.sort_unstable();
    out.dedup();
    out
}

/// Plays `seed` to `end`, saving at each cut and going on in a new game loaded from the save.
fn broken(data: &sim_data::WorldData, seed: u64, end: u32, cuts: &[u32]) -> (Vec<StateHash>, Sim) {
    let mut sim = Sim::new(data.clone(), seed).unwrap();
    let mut hashes = Vec::new();
    let mut next = cuts.iter().peekable();
    while sim.now().hours() < end {
        if next.next_if(|&&c| c == sim.now().hours()).is_some() {
            let before = sim.state_hash();
            let bytes = sim.save_bytes();
            // Another seed and clock, so the load has to replace everything.
            let mut loaded = Sim::new(data.clone(), seed.wrapping_add(1)).unwrap();
            loaded.step();
            loaded.load_bytes(&bytes).unwrap();
            assert_eq!(loaded.state_hash(), before, "seed {seed} cut {}", sim.now());
            assert_eq!(loaded.world(), sim.world(), "seed {seed} cut {}", sim.now());
            sim = loaded;
        }
        if sim.step().iter().any(|n| matches!(n, Notice::MonthDone(_))) {
            hashes.push(sim.state_hash());
        }
    }
    assert!(next.peek().is_none(), "every cut was made");
    (hashes, sim)
}

fn hours_to(year: i32) -> u32 {
    DateTime::midnight(Date::ymd(year, 1, 1)).hours()
}

fn check(seed: u64, end_year: i32, need: &[&str]) {
    let data = data();
    let end = hours_to(end_year);
    let (want, ev, straight_end) = straight(&data, seed, end);
    let cuts = cuts(seed, &ev, end, need);
    assert!(cuts.len() >= RANDOM_CUTS + need.len() - 1, "{cuts:?}");
    let (got, broken_end) = broken(&data, seed, end, &cuts);
    assert_eq!(got.len(), want.len());
    for (i, (g, w)) in got.iter().zip(&want).enumerate() {
        assert_eq!(g, w, "seed {seed}: month {} of the run differs", i + 1);
    }
    assert_eq!(broken_end.state_hash(), straight_end.state_hash());
    assert_eq!(broken_end.world(), straight_end.world());
    println!(
        "seed {seed}: {} cuts at hours {cuts:?}, {} monthly hashes match",
        cuts.len(),
        got.len()
    );
}

#[test]
fn save_load_mid_run_matches_an_unbroken_run() {
    // Two years: plan locks, reaction weeks, births and listings happen; a bankruptcy may not.
    check(
        3,
        2022,
        &["lock", "mid_lock", "mid_reaction", "birth", "listing"],
    );
}

#[test]
#[ignore = "30 years on two seeds: run with --release -- --ignored (see the module docs)"]
fn save_load_mid_run_matches_an_unbroken_run_30_years() {
    for seed in [1, 2] {
        check(
            seed,
            2050,
            &[
                "lock",
                "mid_lock",
                "mid_reaction",
                "birth",
                "listing",
                "bankruptcy",
            ],
        );
    }
}
