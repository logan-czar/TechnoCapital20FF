//! SimBridgePlugin tests (build-plan M7.1 to M7.3, M7.9), headless with MinimalPlugins.

mod common;

use std::time::Duration;

use bevy::prelude::*;
use common::*;
use game::bridge::{RunnerControls, SimNotice, SimRate, SimRunner, Views};
use sim::time::quarter::{lock_tick, recap_tick, release_tick};
use sim::time::{Date, DateTime, Quarter};
use sim::world::{
    AlertKind, AlertLevel, AlertPayload, CompanyId, PauseReason, SkipKind, StartupEventId,
};
use sim::{Control, Notice};

const Q1_2020: Quarter = Quarter { year: 2020, q: 1 };

/// M7.1 done line: speeds 1 to 4 hold 2, 1, 0.5 and 0.2 s of real time per game hour.
#[test]
fn speeds_one_to_four_hold_their_hours_per_second() {
    let seconds = 10.0;
    for (speed, sph) in [(1u8, 2.0), (2, 1.0), (3, 0.5), (4, 0.2)] {
        let mut app = bridge_app();
        alerts_off(&mut app);
        send(&mut app, Control::SetSpeed(speed));
        frames(&mut app, (seconds * 60.0) as usize);
        let want = seconds / sph;
        let got = ticks(&app) as f64;
        assert!(
            (got - want).abs() <= 1.0,
            "speed {speed}: {got} ticks in {seconds} s, want {want}"
        );
        let clock = app.world().resource::<Views>().clock().clone();
        assert_eq!(clock.speed, speed);
        assert_eq!(clock.now.hours() as f64, got);
    }
}

/// M7.1: max speed runs as many ticks as the frame budget allows, and never more than the budget
/// (plus the one tick that may cross it) in a frame, so the window keeps drawing.
#[test]
fn max_speed_is_budgeted_per_frame() {
    let mut app = bridge_app();
    let budget = Duration::from_millis(3);
    app.world_mut()
        .resource_mut::<SimRunner>()
        .set_budget(budget);
    alerts_off(&mut app);
    send(&mut app, Control::SetSpeed(5));
    frames(&mut app, 1);
    let mut total = 0;
    for _ in 0..30 {
        app.update();
        let rate = app.world().resource::<SimRate>();
        let slack = Duration::from_millis(20);
        assert!(
            rate.step_time_last_frame <= budget + slack,
            "a frame stepped for {:?}",
            rate.step_time_last_frame
        );
        assert!(rate.steps_last_frame >= 1, "max speed ran no tick");
        total += rate.steps_last_frame;
    }
    // Far more than speed 4 would run in half a second (2.5 ticks).
    assert!(total > 30, "max speed ran only {total} ticks in 30 frames");
    assert!(app.world().resource::<SimRate>().budget_hits > 0);
}

/// Paused runs no ticks; SetSpeed resumes (D8) and Pause stops again.
#[test]
fn pause_runs_none() {
    let mut app = bridge_app();
    frames(&mut app, 120);
    assert_eq!(ticks(&app), 0, "a new game starts paused (spec 7.3)");
    send(&mut app, Control::SetSpeed(4));
    frames(&mut app, 60);
    let running = ticks(&app);
    assert!(running >= 4);
    send(&mut app, Control::Pause);
    frames(&mut app, 120);
    assert!(ticks(&app) <= running + 1);
    assert!(app.world().resource::<RunnerControls>().paused);
}

/// M7.2 and M7.9: controls from the UI reach the sim, and the views and the controls mirror
/// follow them.
#[test]
fn controls_reach_the_sim() {
    let mut app = bridge_app();
    send(&mut app, Control::SetSpeed(3));
    send(
        &mut app,
        Control::SetAlert {
            kind: AlertKind::PlanLock,
            level: AlertLevel::Notify,
        },
    );
    send(&mut app, Control::WatchlistAdd(CompanyId(7)));
    frames(&mut app, 2);
    let c = app.world().resource::<RunnerControls>().clone();
    assert_eq!((c.speed, c.paused), (3, false));
    assert_eq!(c.alerts.get(AlertKind::PlanLock), AlertLevel::Notify);
    assert!(c.watchlist.contains(&CompanyId(7)));
    let clock = app.world().resource::<Views>().clock().clone();
    assert_eq!((clock.selected_speed, clock.paused), (3, false));

    // A SkipTo runs at max speed to its tick, then pauses (spec 9.1, D8).
    alerts_off(&mut app);
    send(&mut app, Control::SkipTo(SkipKind::MonthEnd));
    let feb = DateTime::midnight(Date::ymd(2020, 2, 1));
    for _ in 0..2_000 {
        app.update();
        if app.world().resource::<RunnerControls>().paused {
            break;
        }
    }
    let clock = app.world().resource::<Views>().clock().clone();
    assert_eq!(clock.now, feb);
    assert!(clock.paused && clock.skipping.is_none());
    let seen = &app.world().resource::<Seen>().0;
    assert!(seen.contains(&Notice::Paused(PauseReason::SkipDone(SkipKind::MonthEnd))));
}

/// M7.3: the views are copied in once per frame, only when the sim refreshed something, and match
/// the sim's last finished tick.
#[test]
fn views_follow_the_last_tick() {
    #[derive(Resource, Default)]
    struct Changes(Vec<bool>);
    fn watch(views: Res<Views>, mut c: ResMut<Changes>) {
        c.0.push(views.is_changed());
    }
    let mut app = bridge_app();
    app.init_resource::<Changes>()
        .add_systems(Update, watch.after(game::bridge::SimSystems::SyncViews));
    frames(&mut app, 10);
    let paused = std::mem::take(&mut app.world_mut().resource_mut::<Changes>().0);
    // The first run sees the resource as new; after that, paused frames leave it alone.
    assert!(paused[1..].iter().all(|c| !c), "views touched while paused");

    send(&mut app, Control::SetSpeed(4));
    frames(&mut app, 120);
    let last_tick = app
        .world()
        .resource::<Seen>()
        .0
        .iter()
        .rev()
        .find_map(|n| match n {
            Notice::TickDone(t) => Some(*t),
            _ => None,
        })
        .unwrap();
    let views = app.world().resource::<Views>();
    assert_eq!(views.clock().now, last_tick);
    let changes = &app.world().resource::<Changes>().0;
    let changed = changes.iter().filter(|c| **c).count();
    // About 24 ticks in 2 s at speed 4: one change per tick frame, not one per frame.
    assert!((8..=40).contains(&changed), "{changed} view changes");
}

/// The notice kinds, so the collector below stays exhaustive: a new 9.3 notice fails to compile
/// here until a test covers it.
fn kind(n: &Notice) -> &'static str {
    match n {
        Notice::TickDone(_) => "tick_done",
        Notice::DayDone(_) => "day_done",
        Notice::MonthDone(_) => "month_done",
        Notice::EarningsReleased(_) => "earnings_released",
        Notice::PlanLocked(_) => "plan_locked",
        Notice::StartupEvent(_) => "startup_event",
        Notice::CompanyBorn(_) => "company_born",
        Notice::IpoVote { .. } => "ipo_vote",
        Notice::CompanyListed(_) => "company_listed",
        Notice::Alert { .. } => "alert",
        Notice::Paused(_) => "paused",
    }
}

/// M7.2 done line: every spec 9.3 notice reaches a test system. The sim posts seven kinds today
/// (the births notices arrive with M6), and those come from a real run through the bridge; the
/// four births notices are written as bridge messages, since the bridge forwards every notice
/// unfiltered.
#[test]
fn every_notice_reaches_a_test_system() {
    let mut app = bridge_app();
    send(&mut app, Control::SetSpeed(5));
    // Run to the Q1 recap; resume after each alert pause.
    let recap = recap_tick(Q1_2020);
    for _ in 0..20_000 {
        app.update();
        let clock = app.world().resource::<Views>().clock().clone();
        if clock.now >= recap {
            break;
        }
        if clock.paused {
            send(&mut app, Control::Resume);
        }
    }
    // The recap alert paused the game; resume at speed 1, then pause by hand.
    send(&mut app, Control::SetSpeed(1));
    frames(&mut app, 1);
    send(&mut app, Control::Pause);
    frames(&mut app, 2);
    for n in [
        Notice::StartupEvent(StartupEventId(0)),
        Notice::CompanyBorn(CompanyId(651)),
        Notice::IpoVote {
            company: CompanyId(651),
            passed: true,
        },
        Notice::CompanyListed(CompanyId(651)),
    ] {
        app.world_mut().write_message(SimNotice(n));
    }
    frames(&mut app, 1);

    let seen = &app.world().resource::<Seen>().0;
    let mut kinds: Vec<_> = seen.iter().map(kind).collect();
    kinds.sort_unstable();
    kinds.dedup();
    assert_eq!(
        kinds,
        [
            "alert",
            "company_born",
            "company_listed",
            "day_done",
            "earnings_released",
            "ipo_vote",
            "month_done",
            "paused",
            "plan_locked",
            "startup_event",
            "tick_done",
        ]
    );
    // The notices of the calendar, in order and on time (D6, D10).
    let release = release_tick(Q1_2020);
    let at = |t: DateTime| {
        seen.iter()
            .position(|n| *n == Notice::TickDone(t))
            .unwrap_or_else(|| panic!("no tick {t}"))
    };
    let i = at(release);
    assert!(seen[..i].contains(&Notice::EarningsReleased(Quarter { year: 2019, q: 4 })));
    assert!(seen[..i].contains(&Notice::Paused(PauseReason::Alert(AlertKind::EarningsDay))));
    let j = at(lock_tick(Q1_2020));
    assert!(seen[i..j].contains(&Notice::PlanLocked(Q1_2020)));
    assert!(seen[i..j].contains(&Notice::Alert {
        kind: AlertKind::PlanLock,
        level: AlertLevel::Log,
        payload: AlertPayload::Quarter(Q1_2020),
    }));
    assert!(seen.contains(&Notice::Paused(PauseReason::Player)));
}

/// M7.6 done line (bridge half): Earnings day and the Quarterly recap pause by default.
#[test]
fn earnings_day_and_recap_pause_by_default() {
    let mut app = bridge_app();
    send(&mut app, Control::SetSpeed(5));
    let mut pauses = Vec::new();
    for _ in 0..20_000 {
        app.update();
        let clock = app.world().resource::<Views>().clock().clone();
        if clock.paused {
            pauses.push(clock.now);
            if pauses.len() == 2 {
                break;
            }
            send(&mut app, Control::Resume);
        }
    }
    let reasons: Vec<_> = app
        .world()
        .resource::<Seen>()
        .0
        .iter()
        .filter_map(|n| match n {
            Notice::Paused(r) => Some(*r),
            _ => None,
        })
        .collect();
    assert_eq!(
        reasons,
        [
            PauseReason::Alert(AlertKind::EarningsDay),
            PauseReason::Alert(AlertKind::QuarterlyRecap)
        ]
    );
    assert_eq!(pauses, [release_tick(Q1_2020), recap_tick(Q1_2020)]);
}

/// The app's views equal `want` exactly (every view and the refresh count).
fn assert_views(app: &App, want: &sim::SimViews, what: &str) {
    let views = app.world().resource::<Views>();
    assert!(**views == *want, "{what}: stale views");
    assert_eq!(views.refresh(), want.refresh(), "{what}: refresh");
}

/// M7.3: a NewGame rebuilds every view at refresh 1, version 1, so the bridge copies them all,
/// even when the old game's refresh or versions happen to match.
#[test]
fn new_game_replaces_every_view() {
    // Only a SetAlert since the start: the old game is still at refresh 1.
    let mut app = bridge_app();
    send(
        &mut app,
        Control::SetAlert {
            kind: AlertKind::PlanLock,
            level: AlertLevel::Off,
        },
    );
    frames(&mut app, 1);
    send(&mut app, Control::NewGame { seed: 7 });
    frames(&mut app, 2);
    assert_views(
        &app,
        sim::Sim::new(data(), 7).unwrap().views(),
        "after SetAlert",
    );

    // An old game that ran into February (later refresh, newer versions).
    let mut app = bridge_app();
    alerts_off(&mut app);
    send(&mut app, Control::SkipTo(SkipKind::MonthEnd));
    frames(&mut app, 200);
    assert!(app.world().resource::<Views>().refresh() > 1);
    send(&mut app, Control::NewGame { seed: 7 });
    frames(&mut app, 2);
    assert_views(
        &app,
        sim::Sim::new(data(), 7).unwrap().views(),
        "after a run",
    );
}

/// M7.3: a Load rebuilds every view at refresh 1 (D13), so the bridge copies them all, whatever
/// refresh the game it replaces had reached.
#[test]
fn load_replaces_every_view() {
    let dir = std::env::temp_dir().join(format!("m7-bridge-load-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("save.bin");
    let mut saved = sim();
    for _ in 0..100 {
        saved.step();
    }
    saved.save(&path).unwrap();
    let mut want = sim::Sim::new(data(), 1).unwrap();
    want.load(&path).unwrap();

    // Into a fresh game (same refresh, 1) and into one that has run (a different refresh).
    for run in [0, 60] {
        let mut app = bridge_app();
        if run > 0 {
            alerts_off(&mut app);
            send(&mut app, Control::SetSpeed(4));
            frames(&mut app, run);
        }
        send(&mut app, Control::Load(path.clone()));
        frames(&mut app, 2);
        assert_views(&app, want.views(), &format!("load after {run} frames"));
        assert_eq!(
            app.world().resource::<Views>().clock().now,
            DateTime::from_hours(100)
        );
    }
    let _ = std::fs::remove_dir_all(&dir);
}
