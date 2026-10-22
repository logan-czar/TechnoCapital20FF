//! Shell tests (build-plan M7.5, M7.6, M7.8, M7.9): the whole UI shell headless, with no window.
//! Keys go in as keyboard messages; screens are checked through their nodes and resources.

mod common;

use bevy::input::ButtonState;
use bevy::input::keyboard::{Key, KeyboardInput, NativeKey};
use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, Seen, data, frames, send, ticks};
use game::bridge::{RunnerControls, SimBridgePlugin, SimNotice, Views};
use game::pages::PageRef;
use game::pdoomberg::{PdoombergUi, row_company};
use game::table::Cell;
use game::table::{Table, TableFocus, TableRowClicked, sort_order};
use game::ui::ShellPlugin;
use game::ui::alerts::{AlertBoard, AlertIcon, EventLog, MAX_TOASTS, Toast};
use game::ui::demo::demo_tables;
use game::ui::outliner::OmniscientToggle;
use game::ui::rail::{Router, Screen, ScreenRoot};
use game::ui::screens::ViewLine;
use game::workspace::Workspace;
use sim::time::Quarter;
use sim::time::quarter::{recap_tick, release_tick};
use sim::world::{AlertKind, AlertLevel, AlertPayload, CompanyId};
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

/// M7.8, M9 A2 (D451): the rail keys open their pages in the focused pane; B opens full-screen
/// Pdoomberg over the workspace and Esc closes it; the keyboard follows the open table.
#[test]
fn router_opens_pages_and_pdoomberg() {
    let mut app = shell_app();
    let pdb_shown = |app: &mut App| {
        app.world_mut()
            .query::<(&ScreenRoot, &Node)>()
            .iter(app.world())
            .find(|(r, _)| r.0 == Screen::Pdoomberg)
            .map(|(_, n)| n.display != Display::None)
            .unwrap()
    };
    let current = |app: &App| app.world().resource::<Router>().current;
    let page = |app: &App| {
        let ws = app.world().resource::<Workspace>();
        ws.page(ws.focused()).cloned().unwrap()
    };
    assert_eq!(current(&app), Screen::Map);
    assert_eq!(
        page(&app),
        PageRef::World,
        "the workspace starts on the World page"
    );
    assert!(!pdb_shown(&mut app));
    let quarter = app.world().resource::<Views>().clock().date.quarter();
    for (key, want) in [
        (KeyCode::KeyO, PageRef::Companies),
        (KeyCode::KeyU, PageRef::Industries),
        (KeyCode::KeyR, PageRef::Recap(quarter)),
        (KeyCode::KeyN, PageRef::News),
    ] {
        press(&mut app, key);
        assert_eq!(current(&app), Screen::Map);
        assert_eq!(page(&app), want);
    }
    let ws = app.world().resource::<Workspace>();
    assert_eq!(ws.len(), 1, "rail pages open in the focused pane");
    assert_eq!(ws.history(ws.focused()).unwrap().back_list().len(), 4);
    press(&mut app, KeyCode::KeyB);
    assert_eq!(current(&app), Screen::Pdoomberg);
    assert!(pdb_shown(&mut app), "Pdoomberg is full screen");
    // The F2 quote table (v_company_row and v_quotes) has the keyboard.
    let quotes = app.world().resource::<PdoombergUi>().main_table;
    assert!(quotes.is_some());
    assert_eq!(app.world().resource::<TableFocus>().0, quotes);
    press(&mut app, KeyCode::Escape);
    assert_eq!(current(&app), Screen::Map);
    assert!(!pdb_shown(&mut app));
    assert_eq!(page(&app), PageRef::News, "the workspace is where it was");
    // The News page's table has the keyboard.
    let focus = app.world().resource::<TableFocus>().0;
    assert!(focus.is_some() && focus != quotes);
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

/// M7.8: clicking a Pdoomberg F2 quote row (the real v_company_row table) watches the company;
/// a second click unwatches it.
#[test]
fn quote_rows_toggle_the_watchlist() {
    let mut app = shell_app();
    // The terminal builds its page on its first open (D520).
    press(&mut app, KeyCode::KeyB);
    let table = app
        .world()
        .resource::<PdoombergUi>()
        .main_table
        .expect("F2's quote table");
    let id = row_company(app.world().get::<Table>(table).unwrap(), 5).expect("a company row");
    let click = TableRowClicked {
        table,
        row: 5,
        secondary: false,
    };
    app.world_mut().write_message(click);
    frames(&mut app, 3);
    assert!(controls(&app).watchlist.contains(&id));
    // The watch column follows the controls.
    let t = app.world().get::<Table>(table).unwrap();
    let col = t.model().column_by_key("W").unwrap();
    let row = (0..t.model().len())
        .find(|&r| row_company(t, r) == Some(id))
        .unwrap();
    assert_eq!(t.model().display(row, col), "*");
    app.world_mut().write_message(click);
    frames(&mut app, 3);
    assert!(controls(&app).watchlist.is_empty());
}

/// Spec 1 Information as M9 amends it (D420): Pdoomberg F2 shows a private company's value as an
/// estimate band and its price as "?", a listed one's price; only Omniscient (debug builds)
/// shows the exact value, which lies inside the band.
#[test]
fn private_companies_show_bands() {
    let mut app = shell_app();
    press(&mut app, KeyCode::KeyB);
    let table = app.world().resource::<PdoombergUi>().main_table.unwrap();
    let rows = app
        .world()
        .resource::<Views>()
        .company_rows
        .get()
        .rows
        .clone();
    let private = rows.iter().find(|r| !r.public).expect("a private company");
    let public = rows.iter().find(|r| r.public).expect("a public company");
    let cells = |app: &App, id: CompanyId| -> (Cell, String, Cell) {
        let t = app.world().get::<Table>(table).unwrap();
        let m = t.model();
        let r = (0..m.len())
            .find(|&r| row_company(t, r) == Some(id))
            .unwrap();
        let value = m.column_by_key("Value").unwrap();
        let last = m.column_by_key("Last").unwrap();
        (
            m.cell(r, value).clone(),
            m.display(r, last).to_owned(),
            m.cell(r, last).clone(),
        )
    };
    let (value, last, _) = cells(&app, private.id);
    let Cell::Band { low, high, .. } = value else {
        panic!("{}: a band, not {value:?}", private.name);
    };
    assert_eq!(last, "?", "a private company has no price");
    assert!(cells(&app, public.id).1.starts_with('$'));

    // The pooled row on screen shows it too.
    {
        let mut t = app.world_mut().get_mut::<Table>(table).unwrap();
        t.set_viewport_height(220.0);
    }
    frames(&mut app, 2);
    {
        let mut t = app.world_mut().get_mut::<Table>(table).unwrap();
        let pos = (0..t.model().len())
            .find(|&r| row_company(&t, r) == Some(private.id))
            .unwrap();
        t.scroll_to(pos);
    }
    frames(&mut app, 1);
    let shown = app
        .world_mut()
        .query::<&Text>()
        .iter(app.world())
        .filter(|t| t.0 == private.name)
        .count();
    assert!(shown >= 1, "the private company's row is on screen");

    send(&mut app, Control::SetOmniscient(true));
    frames(&mut app, 3);
    let (value, _, _) = cells(&app, private.id);
    if cfg!(debug_assertions) {
        let Cell::Money(x) = value else {
            panic!("Omniscient shows the exact value: {value:?}");
        };
        assert!(low < x && x < high, "the truth lies inside the band");
        send(&mut app, Control::SetOmniscient(false));
        frames(&mut app, 3);
        assert!(matches!(cells(&app, private.id).0, Cell::Band { .. }));
    } else {
        assert!(
            matches!(value, Cell::Band { .. }),
            "release builds never show private figures"
        );
    }
}

/// D304: at most MAX_TOASTS toasts, even when more alerts arrive in one frame.
#[test]
fn toast_cap_holds_within_a_frame() {
    let mut app = shell_app();
    for _ in 0..(MAX_TOASTS + 4) {
        app.world_mut().write_message(SimNotice(Notice::Alert {
            kind: AlertKind::WorldEvent,
            level: AlertLevel::Notify,
            payload: AlertPayload::None,
        }));
    }
    frames(&mut app, 1);
    let n = app.world_mut().query::<&Toast>().iter(app.world()).count();
    assert_eq!(n, MAX_TOASTS);
    let e = app.world().resource::<AlertBoard>().clone();
    assert_eq!(
        e.get(AlertKind::WorldEvent).unwrap().instances.len(),
        MAX_TOASTS + 4
    );
}

/// M7.7 done line, automated for release builds: a sort of the 3,255 provinces fits well inside
/// a 60 fps frame (16 ms) on every column. Debug builds only check the order (the game crate is
/// unoptimized there); `--bench-table` measures the whole frame.
#[test]
fn province_sort_fits_a_frame() {
    let demo = demo_tables(&data());
    let m = &demo.provinces;
    assert_eq!(m.len(), 3_255);
    for col in 0..m.columns.len() {
        for asc in [true, false] {
            let start = std::time::Instant::now();
            let order = sort_order(m, col, asc);
            let ms = start.elapsed().as_secs_f64() * 1e3;
            assert_eq!(order.len(), 3_255);
            if !cfg!(debug_assertions) {
                assert!(ms < 16.0, "sort by column {col} took {ms:.2} ms");
            }
        }
    }
}

/// M7.9: screens read the views: the stubs' view lines follow the refresh count.
#[test]
fn screens_show_the_views() {
    let mut app = shell_app();
    let line = |app: &mut App| {
        app.world_mut()
            .query::<(&ViewLine, &Text)>()
            .iter(app.world())
            .find(|(_, t)| t.0.contains("v_quotes"))
            .map(|(_, t)| t.0.clone())
            .unwrap()
    };
    let before = line(&mut app);
    common::alerts_off(&mut app);
    send(&mut app, Control::SetSpeed(4));
    frames(&mut app, 60);
    let after = line(&mut app);
    assert_ne!(before, after);
    let version = app.world().resource::<Views>().quotes.version();
    assert!(after.contains(&format!("version {version} ")), "{after}");
    // A monthly view's line holds still while v_quotes moves every tick.
    let monthly = |app: &mut App| {
        app.world_mut()
            .query::<(&ViewLine, Ref<Text>)>()
            .iter(app.world())
            .find(|(_, t)| t.0.contains("v_filings"))
            .map(|(_, t)| (t.0.clone(), t.last_changed()))
            .unwrap()
    };
    let (text, changed) = monthly(&mut app);
    frames(&mut app, 3);
    assert_eq!(monthly(&mut app), (text, changed), "not rewritten");
}
