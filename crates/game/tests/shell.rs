//! Shell tests (build-plan M7.5, M7.6, M7.8, M7.9): the whole UI shell headless, with no window.
//! Keys go in as keyboard messages; screens are checked through their nodes and resources.

mod common;

use bevy::input::ButtonState;
use bevy::input::keyboard::{Key, KeyboardInput, NativeKey};
use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, Seen, data, frames, send, ticks};
use game::bridge::{RunnerControls, SimBridgePlugin, SimNotice, Views};
use game::table::{TableFocus, TableRowClicked};
use game::ui::ShellPlugin;
use game::ui::alerts::{AlertBoard, AlertIcon, EventLog};
use game::ui::outliner::OmniscientToggle;
use game::ui::rail::{Router, Screen, ScreenRoot};
use game::ui::screens::{DemoTableEntities, ViewLine, demo_tables};
use sim::time::Quarter;
use sim::time::quarter::{recap_tick, release_tick};
use sim::world::{AlertKind, AlertLevel, CompanyId};
use sim::{Control, Notice, Sim};

fn collect(mut r: MessageReader<SimNotice>, mut seen: ResMut<Seen>) {
    seen.0.extend(r.read().map(|n| n.0.clone()));
}

fn shell_app() -> App {
    let data = data();
    let demo = demo_tables(&data);
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, bevy::input::InputPlugin))
        .insert_resource(TimeUpdateStrategy::ManualDuration(FRAME))
        .add_plugins(SimBridgePlugin::new(Sim::new(data, 42).unwrap()))
        .insert_resource(demo)
        .add_plugins(ShellPlugin)
        .init_resource::<Seen>()
        .add_systems(Update, collect);
    app.update();
    app
}

fn press(app: &mut App, key: KeyCode) {
    for state in [ButtonState::Pressed, ButtonState::Released] {
        app.world_mut().write_message(KeyboardInput {
            key_code: key,
            logical_key: Key::Unidentified(NativeKey::Unidentified),
            state,
            text: None,
            repeat: false,
            window: Entity::PLACEHOLDER,
        });
        app.update();
    }
    app.update();
}

fn controls(app: &App) -> RunnerControls {
    app.world().resource::<RunnerControls>().clone()
}

/// M7.5 done line: Space and keys 1 to 5 work (and + and -).
#[test]
fn space_and_number_keys_drive_the_clock() {
    let mut app = shell_app();
    common::alerts_off(&mut app);
    app.update();
    assert!(controls(&app).paused, "a new game starts paused");
    press(&mut app, KeyCode::Space);
    assert!(!controls(&app).paused, "Space resumes");
    press(&mut app, KeyCode::Space);
    assert!(controls(&app).paused, "Space pauses");
    for (key, n) in [
        (KeyCode::Digit3, 3),
        (KeyCode::Digit1, 1),
        (KeyCode::Numpad4, 4),
        (KeyCode::Digit5, 5),
        (KeyCode::Digit2, 2),
    ] {
        press(&mut app, key);
        let c = controls(&app);
        assert_eq!((c.speed, c.paused), (n, false), "key {key:?}");
        assert_eq!(app.world().resource::<Views>().clock().selected_speed, n);
    }
    press(&mut app, KeyCode::Equal);
    assert_eq!(controls(&app).speed, 3);
    press(&mut app, KeyCode::Minus);
    press(&mut app, KeyCode::Minus);
    press(&mut app, KeyCode::Minus);
    assert_eq!(controls(&app).speed, 1, "- stops at speed 1");
}

/// M7.9: the shell app runs the sim in FixedUpdate at every speed.
#[test]
fn the_shell_runs_the_sim_at_all_speeds() {
    let mut last = 0;
    for speed in 1..=5u8 {
        let mut app = shell_app();
        common::alerts_off(&mut app);
        send(&mut app, Control::SetSpeed(speed));
        frames(&mut app, 240);
        let n = ticks(&app);
        let want = match speed {
            1 => 2,
            2 => 4,
            3 => 8,
            4 => 20,
            _ => 21,
        };
        assert!(
            if speed < 5 {
                n.abs_diff(want) <= 1
            } else {
                n > want
            },
            "speed {speed}: {n} ticks in 4 s"
        );
        assert!(n > last, "speed {speed} not faster than the one below");
        last = n;
    }
}

/// M7.6 done line: Earnings day and the Quarterly recap pause by default, each with an icon in
/// the alert row; Plan lock (Log) goes only to the event log.
#[test]
fn default_alerts_pause_and_show() {
    let mut app = shell_app();
    let q1 = Quarter { year: 2020, q: 1 };
    send(&mut app, Control::SetSpeed(5));
    let mut pauses = Vec::new();
    for _ in 0..20_000 {
        app.update();
        let clock = app.world().resource::<Views>().clock().clone();
        if clock.paused {
            pauses.push(clock.now);
            let board = app.world().resource::<AlertBoard>().clone();
            match pauses.len() {
                1 => {
                    let e = board.get(AlertKind::EarningsDay).expect("earnings icon");
                    assert_eq!(e.level, AlertLevel::Pause);
                }
                _ => {
                    let e = board.get(AlertKind::QuarterlyRecap).expect("recap icon");
                    assert_eq!(e.level, AlertLevel::Pause);
                    assert!(board.get(AlertKind::PlanLock).is_none());
                    break;
                }
            }
            send(&mut app, Control::Resume);
        }
    }
    assert_eq!(pauses, [release_tick(q1), recap_tick(q1)]);
    frames(&mut app, 2);
    let icons: Vec<AlertKind> = app
        .world_mut()
        .query::<&AlertIcon>()
        .iter(app.world())
        .map(|i| i.0)
        .collect();
    assert_eq!(
        icons,
        [AlertKind::QuarterlyRecap],
        "earnings day cleared the next day"
    );
    let log = &app.world().resource::<EventLog>().0;
    assert!(log.iter().any(|l| l.contains("[Log] Plan lock: Q1 2020")));
    assert!(log.iter().any(|l| l.contains("Paused for Earnings day")));
}

/// M7.6: an alert set to Notify shows without pausing; Off shows nothing.
#[test]
fn alert_settings_apply() {
    let mut app = shell_app();
    send(
        &mut app,
        Control::SetAlert {
            kind: AlertKind::EarningsDay,
            level: AlertLevel::Notify,
        },
    );
    send(
        &mut app,
        Control::SetAlert {
            kind: AlertKind::PlanLock,
            level: AlertLevel::Off,
        },
    );
    // One max-speed frame can run months; keep the recap from pausing inside it.
    send(
        &mut app,
        Control::SetAlert {
            kind: AlertKind::QuarterlyRecap,
            level: AlertLevel::Off,
        },
    );
    send(&mut app, Control::SetSpeed(5));
    let lock = sim::time::quarter::lock_tick(Quarter { year: 2020, q: 1 });
    for _ in 0..5_000 {
        app.update();
        if app.world().resource::<Views>().clock().now > lock {
            break;
        }
    }
    let seen = &app.world().resource::<Seen>().0;
    let pauses: Vec<_> = seen
        .iter()
        .filter(|n| matches!(n, Notice::Paused(_)))
        .collect();
    assert!(pauses.is_empty(), "{pauses:?}");
    let log = &app.world().resource::<EventLog>().0;
    assert!(log.iter().any(|l| l.contains("[Notify] Earnings day")));
    assert!(!log.iter().any(|l| l.contains("Plan lock")));
}

/// M7.8: the rail keys route between screens; Esc closes; the keyboard follows the open table.
#[test]
fn router_opens_and_closes_screens() {
    let mut app = shell_app();
    let shown = |app: &mut App, s: Screen| {
        app.world_mut()
            .query::<(&ScreenRoot, &Node)>()
            .iter(app.world())
            .find(|(r, _)| r.0 == s)
            .map(|(_, n)| n.display != Display::None)
            .unwrap()
    };
    let current = |app: &App| app.world().resource::<Router>().current;
    assert_eq!(current(&app), Screen::Map);
    assert!(shown(&mut app, Screen::Map));
    for (key, screen) in [
        (KeyCode::KeyO, Screen::Company),
        (KeyCode::KeyU, Screen::Industries),
        (KeyCode::KeyR, Screen::Recap),
        (KeyCode::KeyN, Screen::News),
    ] {
        press(&mut app, key);
        assert_eq!(current(&app), screen);
        assert!(shown(&mut app, screen));
        assert!(shown(&mut app, Screen::Map), "panels open over the map");
    }
    press(&mut app, KeyCode::KeyN);
    assert_eq!(current(&app), Screen::Map, "a screen's key closes it");
    press(&mut app, KeyCode::KeyB);
    assert_eq!(current(&app), Screen::Pdoomberg);
    assert!(!shown(&mut app, Screen::Map), "Pdoomberg is full screen");
    let tables = *app.world().resource::<DemoTableEntities>();
    assert_eq!(
        app.world().resource::<TableFocus>().0,
        Some(tables.companies)
    );
    press(&mut app, KeyCode::Escape);
    assert_eq!(current(&app), Screen::Map);
    assert_eq!(
        app.world().resource::<TableFocus>().0,
        Some(tables.provinces)
    );
    assert!(controls(&app).paused, "screens never touch the clock");
}

/// M7.8 done line: Omniscient exists in debug builds only.
#[test]
fn omniscient_only_in_debug_builds() {
    let mut app = shell_app();
    let n = app
        .world_mut()
        .query::<&OmniscientToggle>()
        .iter(app.world())
        .count();
    if cfg!(debug_assertions) {
        assert_eq!(n, 1);
        send(&mut app, Control::SetOmniscient(true));
        frames(&mut app, 2);
        assert!(controls(&app).omniscient);
    } else {
        assert_eq!(n, 0, "release builds hide Omniscient");
        send(&mut app, Control::SetOmniscient(true));
        frames(&mut app, 2);
        assert!(!controls(&app).omniscient, "the sim refuses it too");
    }
}

/// M7.8: clicking a Pdoomberg quote row watches the company; the outliner lists it.
#[test]
fn quote_rows_toggle_the_watchlist() {
    let mut app = shell_app();
    let tables = *app.world().resource::<DemoTableEntities>();
    let click = TableRowClicked {
        table: tables.companies,
        row: 5,
        secondary: false,
    };
    app.world_mut().write_message(click);
    frames(&mut app, 3);
    assert!(controls(&app).watchlist.contains(&CompanyId(5)));
    app.world_mut().write_message(click);
    frames(&mut app, 3);
    assert!(controls(&app).watchlist.is_empty());
}

/// M7.9: screens read the views: the stubs' view lines follow the refresh count.
#[test]
fn screens_show_the_views() {
    let mut app = shell_app();
    let line = |app: &mut App| {
        app.world_mut()
            .query::<(&ViewLine, &Text)>()
            .iter(app.world())
            .find(|(_, t)| t.0.contains("v_clock"))
            .map(|(_, t)| t.0.clone())
            .unwrap()
    };
    let before = line(&mut app);
    common::alerts_off(&mut app);
    send(&mut app, Control::SetSpeed(4));
    frames(&mut app, 60);
    let after = line(&mut app);
    assert_ne!(before, after);
    let refresh = app.world().resource::<Views>().refresh();
    assert!(after.contains(&format!("of {refresh}")), "{after}");
}
