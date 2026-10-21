//! Controls (build-plan M1.5): speeds 0 to 5, pause, resume, SkipTo stopping on exactly the right
//! tick, and alert levels.

mod common;

use sim::time::control::MAX_SPEED;
use sim::time::{Control, Date, DateTime, Slot};
use sim::world::{AlertKind, AlertLevel, AlertPayload, CompanyId, PauseReason, SkipKind};
use sim::{Notice, Sim};

#[test]
fn bankruptcy_alerts_fire_only_for_the_watchlist() {
    let mut s = sim();
    s.register_test_job(
        Slot::DailyNews,
        "test.bankrupt",
        common::bankrupt_three_and_four,
    );
    let bankruptcies = |n: &[Notice]| -> Vec<(AlertLevel, AlertPayload)> {
        n.iter()
            .filter_map(|n| match n {
                Notice::Alert {
                    kind: AlertKind::BankruptcyInWatchlist,
                    level,
                    payload,
                } => Some((*level, *payload)),
                _ => None,
            })
            .collect()
    };
    // Empty watchlist: the job raises both on 2 Jan 00:00, nothing fires.
    let mut seen = Vec::new();
    while s.now() < at(2020, 1, 2, 0) {
        seen.extend(bankruptcies(&s.step()));
    }
    assert!(seen.is_empty());
    // Company 3 watched: only its alert fires, at Notify (spec 8), and does not pause.
    s.apply(Control::WatchlistAdd(CompanyId(3))).unwrap();
    s.apply(Control::SetAlert {
        kind: AlertKind::EarningsDay,
        level: AlertLevel::Off,
    })
    .unwrap();
    s.apply(Control::Resume).unwrap();
    while s.now() < at(2020, 1, 3, 0) {
        seen.extend(bankruptcies(&s.step()));
    }
    assert_eq!(
        seen,
        [(AlertLevel::Notify, AlertPayload::Company(CompanyId(3)))]
    );
    assert!(!s.controls().paused);
}

fn sim() -> Sim {
    let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
    Sim::new(data, 1).unwrap()
}

fn at(y: i32, m: u8, d: u8, h: u8) -> DateTime {
    DateTime::at(Date::ymd(y, m, d), h)
}

/// Steps until a Paused notice; returns the tick it came on and the reason.
fn run_to_pause(sim: &mut Sim) -> (DateTime, PauseReason) {
    for _ in 0..(400 * 24) {
        let notices = sim.step();
        assert!(matches!(notices.last(), Some(Notice::TickDone(_))));
        if let Some(r) = notices.iter().find_map(|n| match n {
            Notice::Paused(r) => Some(*r),
            _ => None,
        }) {
            assert!(sim.controls().paused);
            return (sim.now(), r);
        }
    }
    panic!("never paused");
}

#[test]
fn skip_to_stops_on_exactly_the_right_tick() {
    let mut s = sim();
    // From the start, 2020-01-01 00:00, each kind in turn; alerts do not stop a skip (D6).
    let plan = [
        (SkipKind::MonthEnd, at(2020, 2, 1, 0)),
        (SkipKind::NextRelease, at(2020, 4, 2, 0)),
        (SkipKind::NextRelease, at(2020, 7, 2, 0)),
        (SkipKind::NextLock, at(2020, 7, 9, 0)),
        (SkipKind::NextRecap, at(2020, 9, 25, 0)),
        (SkipKind::NextRecap, at(2020, 12, 26, 0)),
        (SkipKind::MonthEnd, at(2021, 1, 1, 0)),
        (SkipKind::NextLock, at(2021, 1, 9, 0)),
        (SkipKind::NextRecap, at(2021, 3, 26, 0)),
        (SkipKind::MonthEnd, at(2021, 4, 1, 0)),
    ];
    for (kind, want) in plan {
        s.apply(Control::SkipTo(kind)).unwrap();
        assert_eq!(s.controls().effective_speed(), MAX_SPEED);
        assert_eq!(run_to_pause(&mut s), (want, PauseReason::SkipDone(kind)));
        assert_eq!(s.controls().effective_speed(), 0);
    }
    // From the first hour of a release day, the next release is a quarter away.
    let mut s = sim();
    s.apply(Control::SkipTo(SkipKind::NextRelease)).unwrap();
    run_to_pause(&mut s);
    s.step();
    assert_eq!(s.now(), at(2020, 1, 2, 1));
    s.apply(Control::SkipTo(SkipKind::NextRelease)).unwrap();
    assert_eq!(run_to_pause(&mut s).0, at(2020, 4, 2, 0));
}

#[test]
fn pause_alerts_pause_after_their_tick() {
    let mut s = sim();
    s.apply(Control::Resume).unwrap();
    // Earnings day at the 2 Jan release (Pause by default, spec 8).
    let (t, r) = run_to_pause(&mut s);
    assert_eq!(
        (t, r),
        (
            at(2020, 1, 2, 0),
            PauseReason::Alert(AlertKind::EarningsDay)
        )
    );
    // Plan lock is Log: it posts a notice but does not pause; the recap pauses.
    s.apply(Control::Resume).unwrap();
    let mut saw_lock = false;
    loop {
        let n = s.step();
        saw_lock |= n.iter().any(|n| {
            matches!(
                n,
                Notice::Alert {
                    kind: AlertKind::PlanLock,
                    level: AlertLevel::Log,
                    ..
                }
            )
        });
        if s.controls().paused {
            break;
        }
    }
    assert!(saw_lock);
    assert_eq!(s.now(), at(2020, 3, 26, 0));
    // Off posts nothing and does not pause.
    s.apply(Control::SetAlert {
        kind: AlertKind::EarningsDay,
        level: AlertLevel::Off,
    })
    .unwrap();
    s.apply(Control::Resume).unwrap();
    let mut alerts = 0;
    while s.now() < at(2020, 4, 3, 0) {
        alerts += s
            .step()
            .iter()
            .filter(|n| matches!(n, Notice::Alert { .. }))
            .count();
    }
    assert_eq!(alerts, 0);
    assert!(!s.controls().paused);
}

#[test]
fn speeds_pause_and_resume() {
    let mut s = sim();
    assert!(s.controls().paused, "a new game starts paused (spec 7.3)");
    assert_eq!(s.controls().effective_speed(), 0);
    for n in 1..=MAX_SPEED {
        s.apply(Control::SetSpeed(n)).unwrap();
        assert_eq!(s.controls().effective_speed(), n);
    }
    assert_eq!(s.controls().seconds_per_tick(), None, "speed 5 is max");
    s.apply(Control::SetSpeed(1)).unwrap();
    assert_eq!(s.controls().seconds_per_tick(), Some(2.0));
    assert_eq!(
        s.apply(Control::Pause).unwrap(),
        [Notice::Paused(PauseReason::Player)]
    );
    s.apply(Control::Resume).unwrap();
    assert_eq!(s.controls().effective_speed(), 1, "resume keeps the speed");
    s.apply(Control::SetSpeed(0)).unwrap();
    assert!(s.controls().paused);
    assert!(s.apply(Control::SetSpeed(6)).is_err());
    // Pause cancels a skip.
    s.apply(Control::SkipTo(SkipKind::NextLock)).unwrap();
    s.apply(Control::Pause).unwrap();
    assert!(s.controls().skip.is_none());
}

#[test]
fn watchlist_and_omniscient() {
    let mut s = sim();
    s.apply(Control::WatchlistAdd(CompanyId(3))).unwrap();
    assert!(s.controls().watchlist.contains(&CompanyId(3)));
    assert!(s.apply(Control::WatchlistAdd(CompanyId(100_000))).is_err());
    s.apply(Control::WatchlistRemove(CompanyId(3))).unwrap();
    assert!(s.controls().watchlist.is_empty());
    let r = s.apply(Control::SetOmniscient(true));
    assert_eq!(r.is_ok(), cfg!(debug_assertions));
}
