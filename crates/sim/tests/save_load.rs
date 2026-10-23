//! Save, load, continue gives the same hashes as a run with no save (build-plan M1.7, 4.3).
//! The runs carry the test churn job, which draws from every RNG stream each tick and writes into
//! the world, so a save that lost a table field, a stream position or a spare normal would fail.

mod common;

use common::churning_sim;
use sim::time::Control;
use sim::world::{AlertKind, AlertLevel, CompanyId, PauseReason};
use sim::{Notice, Sim, StateHash};

fn data() -> sim_data::WorldData {
    sim_data::load_world(&sim_data::default_data_dir()).unwrap()
}

/// Steps to `ticks` and returns the hash after every tick that closes a month.
fn monthly_hashes(sim: &mut Sim, ticks: u32) -> Vec<StateHash> {
    let mut out = Vec::new();
    while sim.now().hours() < ticks {
        if sim.step().iter().any(|n| matches!(n, Notice::MonthDone(_))) {
            out.push(sim.state_hash());
        }
    }
    out
}

#[test]
fn save_load_continue_matches_an_unbroken_run() {
    let data = data();
    const END: u32 = 24 * 400;
    let mut straight = churning_sim(&data, 77);
    let want = monthly_hashes(&mut straight, END);
    // The churn bites: the same seed without it ends in another state.
    let mut idle = Sim::new(data.clone(), 77).unwrap();
    assert_ne!(monthly_hashes(&mut idle, END), want);
    assert_ne!(idle.world(), straight.world());

    for cut in [1, 23, 24 * 31, 24 * 91 + 1, 5_555] {
        let mut first = churning_sim(&data, 77);
        let mut got = monthly_hashes(&mut first, cut);
        // Every cut has draws behind it: the state differs from the same seed with no job.
        let mut idle_at_cut = Sim::new(data.clone(), 77).unwrap();
        monthly_hashes(&mut idle_at_cut, cut);
        assert_ne!(first.state_hash(), idle_at_cut.state_hash(), "cut {cut}");
        let bytes = first.save_bytes();
        // Load into a game with another seed and clock, to show the save replaces everything.
        let mut second = churning_sim(&data, 999);
        second.step();
        let notices = second.load_bytes(&bytes).unwrap();
        assert_eq!(notices, [Notice::Paused(PauseReason::Loaded)]);
        assert_eq!(second.state_hash(), first.state_hash(), "cut {cut}");
        assert_eq!(second.now(), first.now());
        got.extend(monthly_hashes(&mut second, END));
        assert_eq!(got, want, "cut {cut}");
        assert_eq!(second.state_hash(), straight.state_hash());
    }
}

#[test]
fn save_and_load_controls_through_files() {
    let data = data();
    let dir = std::path::Path::new(env!("CARGO_TARGET_TMPDIR")).join("saves");
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("m1.sav");

    let mut a = Sim::new(data.clone(), 4).unwrap();
    a.apply(Control::SetAlert {
        kind: AlertKind::QuarterlyRecap,
        level: AlertLevel::Off,
    })
    .unwrap();
    a.apply(Control::WatchlistAdd(CompanyId(9))).unwrap();
    for _ in 0..500 {
        a.step();
    }
    a.apply(Control::Save(path.clone())).unwrap();

    let mut b = Sim::new(data, 5).unwrap();
    b.apply(Control::Resume).unwrap();
    b.apply(Control::Load(path.clone())).unwrap();
    assert_eq!(b.state_hash(), a.state_hash());
    assert_eq!(b.seed(), 4);
    assert!(b.controls().paused, "loading pauses (D13)");
    assert_eq!(
        b.controls().alerts.get(AlertKind::QuarterlyRecap),
        AlertLevel::Off
    );
    assert!(b.controls().watchlist.contains(&CompanyId(9)));
    assert_eq!(b.clock().now, a.now());

    std::fs::write(&path, b"not a save").unwrap();
    assert!(b.apply(Control::Load(path)).is_err());
    assert_eq!(b.state_hash(), a.state_hash(), "a bad load changes nothing");
}

/// D800: a version 8 save written by main bf86d08's build (seed 7, 30 ticks in; speed 3, Earnings
/// day Off, Quarterly recap Notify, Bankruptcy in watchlist Pause, company 2 watched) loads with
/// its levels and Quarter start at its default, and runs on to the hash main's build reached
/// 960 ticks later.
#[test]
fn a_save_written_by_main_v8_loads_and_continues_to_mains_hash() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/save-v8-main-bf86d08.tc20ffsave");
    let mut s = Sim::new(data(), 1).unwrap();
    s.load(&path).unwrap();
    assert_eq!(s.now().hours(), 30);
    assert_eq!(s.seed(), 7);
    let c = s.controls();
    assert_eq!((c.speed, c.paused), (3, true));
    assert_eq!(
        c.watchlist.iter().copied().collect::<Vec<_>>(),
        [CompanyId(2)]
    );
    for (kind, level) in [
        (AlertKind::EarningsDay, AlertLevel::Off),
        (AlertKind::QuarterlyRecap, AlertLevel::Notify),
        (AlertKind::PlanLock, AlertLevel::Log),
        (AlertKind::BankruptcyInWatchlist, AlertLevel::Pause),
        (AlertKind::WorldEvent, AlertLevel::Pause),
        (AlertKind::QuarterStart, AlertLevel::Pause),
    ] {
        assert_eq!(c.alerts.get(kind), level, "{kind:?}");
    }
    for _ in 0..24 * 40 {
        s.step();
    }
    assert_eq!(
        s.state_hash().to_string(),
        "a4dd1d4a1e80f398a5b17aa81a334142e88d986d233ec0a1563fb8b60941bc45"
    );
}
