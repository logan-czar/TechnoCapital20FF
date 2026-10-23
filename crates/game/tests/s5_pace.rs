//! The pages at max speed (D772, D773): a view move patches a page in place with what a full
//! rebuild would show, the fast-forward pacing holds refreshes back but a pause shows the final
//! values in its frame, an Omniscient toggle rebuilds at once, and a hidden pane's page waits.

mod common;

use std::time::Duration;

use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, alerts_off, data, frames, send};
use game::bridge::{SimBridgePlugin, SimRunner, Views};
use game::command::index::NameIndex;
use game::config::UiConfig;
use game::pages::company::company_doc;
use game::pages::doc::{HeldLive, LiveSpan, RebuildPage, SpawnedDoc, doc_contents};
use game::pages::province::province_doc;
use game::pages::{BuiltPage, PageRef, PageStats};
use game::table::{Table, TableModel};
use game::ui::ShellPlugin;
use game::workspace::{OpenPage, OpenTarget, PaneFrame, WindowAction, Workspace};
use sim::{Control, Sim};

/// A per-frame step budget that runs about a game month every few debug frames, so the
/// monthly views move while the 0.5 s pacing (30 frames of 1/60 s) holds the page back.
const FAST_BUDGET: Duration = Duration::from_millis(60);

fn shell_app() -> App {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, bevy::input::InputPlugin))
        .insert_resource(TimeUpdateStrategy::ManualDuration(FRAME))
        .add_plugins(SimBridgePlugin::new(Sim::new(data(), 42).unwrap()))
        .add_plugins(ShellPlugin);
    app.update();
    app
}

fn open(app: &mut App, page: PageRef) {
    app.world_mut().write_message(OpenPage {
        page,
        target: OpenTarget::Focused,
    });
    frames(app, 2);
}

fn body(app: &mut App) -> Entity {
    let pane = app.world().resource::<Workspace>().focused();
    app.world_mut()
        .query::<&PaneFrame>()
        .iter(app.world())
        .find(|f| f.pane == pane)
        .unwrap()
        .body
}

/// What the page in `body` shows: its doc texts in order and its tables' models.
fn shown(app: &App, body: Entity) -> (Vec<String>, Vec<TableModel>) {
    let w = app.world();
    let doc = w.get::<SpawnedDoc>(body).expect("a doc page");
    let texts = doc
        .text_entities()
        .iter()
        .map(|&e| w.get::<Text>(e).unwrap().0.clone())
        .collect();
    let tables = doc
        .table_entities()
        .iter()
        .map(|&e| w.get::<Table>(e).unwrap().model().clone())
        .collect();
    (texts, tables)
}

/// Fails on the first text or table where two showings of a page differ.
fn same(a: &(Vec<String>, Vec<TableModel>), b: &(Vec<String>, Vec<TableModel>), what: &str) {
    assert_eq!(a.0.len(), b.0.len(), "{what}: text count");
    for (i, (x, y)) in a.0.iter().zip(&b.0).enumerate() {
        assert_eq!(x, y, "{what}: text {i}");
    }
    assert_eq!(a.1.len(), b.1.len(), "{what}: table count");
    for (i, (x, y)) in a.1.iter().zip(&b.1).enumerate() {
        assert!(x == y, "{what}: table {i} differs");
    }
}

/// Rebuilds the page in `body` in full (as a shape change would) and returns what it shows.
fn rebuilt(app: &mut App, body: Entity) -> (Vec<String>, Vec<TableModel>) {
    app.world_mut().entity_mut(body).insert(RebuildPage);
    frames(app, 1);
    shown(app, body)
}

fn builds(app: &App) -> (u64, u64) {
    let s = app.world().resource::<PageStats>();
    let patches = s.builds.get("patch").copied().unwrap_or(0);
    let full = s
        .builds
        .iter()
        .filter(|(k, _)| **k != "patch")
        .map(|(_, n)| n)
        .sum();
    (patches, full)
}

fn listed_company(app: &App) -> sim::world::CompanyId {
    let v = app.world().resource::<Views>();
    v.company_rows
        .get()
        .rows
        .iter()
        .find(|r| r.public)
        .unwrap()
        .id
}

fn province_with_hqs(app: &App) -> sim::world::ProvinceId {
    let v = app.world().resource::<Views>();
    v.province_cards
        .get()
        .cards
        .iter()
        .max_by_key(|c| (c.hqs.len() + c.units.len(), std::cmp::Reverse(c.id)))
        .unwrap()
        .id
}

fn monthly_version(app: &App) -> u64 {
    app.world().resource::<Views>().company_rows.version()
}

fn run_fast(app: &mut App) {
    alerts_off(app);
    app.world_mut()
        .resource_mut::<SimRunner>()
        .set_budget(FAST_BUDGET);
    send(app, Control::SetSpeed(5));
    send(app, Control::Resume);
    frames(app, 1);
}

/// A move of the monthly views patches the Company and Province pages in place (their nodes
/// stay), and a patched page shows what a build from the same views writes.
#[test]
fn a_view_move_patches_the_page_as_a_rebuild_would_show_it() {
    for which in ["company", "province"] {
        let mut app = shell_app();
        let page = match which {
            "company" => PageRef::Company(listed_company(&app)),
            _ => PageRef::Province(province_with_hqs(&app)),
        };
        open(&mut app, page.clone());
        let b = body(&mut app);
        run_fast(&mut app);
        // The first patch whose doc kept its shape (a new table or card rebuilds instead).
        let mut patched = false;
        for _ in 0..3000 {
            let title = app.world().get::<SpawnedDoc>(b).unwrap().text_entities()[0];
            let before = builds(&app);
            frames(&mut app, 1);
            let after = builds(&app);
            if after.0 > before.0
                && after.1 == before.1
                && app.world().get::<RebuildPage>(b).is_none()
            {
                assert!(
                    app.world().get_entity(title).is_ok(),
                    "{which}: the patch kept the page's nodes"
                );
                // What a build of the page from this frame's views would write.
                let w = app.world();
                let (v, index, cfg) = (
                    w.resource::<Views>(),
                    w.resource::<NameIndex>(),
                    w.resource::<UiConfig>(),
                );
                let doc = match &page {
                    PageRef::Company(id) => company_doc(*id, v, index),
                    PageRef::Province(p) => province_doc(*p, v, index),
                    _ => unreachable!(),
                };
                let built = &w.get::<BuiltPage>(b).unwrap().0;
                let want = doc_contents(built, &doc, v, cfg);
                same(&shown(&app, b), &want, which);
                patched = true;
                break;
            }
        }
        assert!(patched, "{which}: a monthly move patched the page in place");
    }
}

/// While the sim fast-forwards, a page refreshes at most every 0.5 s of real time, so monthly
/// moves outnumber refreshes; a pause shows the final values in the frame it lands in.
#[test]
fn fast_forward_paces_the_page_and_a_pause_shows_the_final_values() {
    let mut app = shell_app();
    let co = listed_company(&app);
    open(&mut app, PageRef::Company(co));
    let b = body(&mut app);
    run_fast(&mut app);
    let (p0, f0) = builds(&app);
    let mut moves = 0;
    let mut last = monthly_version(&app);
    for _ in 0..90 {
        frames(&mut app, 1);
        let v = monthly_version(&app);
        moves += usize::from(v != last);
        last = v;
    }
    let (p1, f1) = builds(&app);
    let refreshes = (p1 - p0 + f1 - f0) as usize;
    assert!(moves >= 4, "{moves} monthly moves in 90 frames");
    assert!(
        refreshes <= 90 / 30 + 1,
        "{refreshes} refreshes for {moves} moves in 1.5 s"
    );
    // A move just before the pause is shown in the pause's frame, by a patch: the page keeps
    // its nodes (sorts, scroll) unless its shape changed.
    let title = app.world().get::<SpawnedDoc>(b).unwrap().text_entities()[0];
    let (_, f_before) = builds(&app);
    send(&mut app, Control::Pause);
    frames(&mut app, 1);
    if app.world().get::<RebuildPage>(b).is_some() {
        frames(&mut app, 1);
    } else {
        assert_eq!(
            builds(&app).1,
            f_before,
            "a pause patches, it does not rebuild"
        );
        assert!(
            app.world().get_entity(title).is_ok(),
            "the pause kept the nodes"
        );
    }
    let at_pause = shown(&app, b);
    let views = app.world().resource::<Views>().clone();
    let lives: Vec<(String, String)> = app
        .world_mut()
        .query::<(&LiveSpan, &Text)>()
        .iter(app.world())
        .map(|(l, t)| (t.0.clone(), l.0.text(&views).0))
        .collect();
    for (shown_text, want) in lives {
        assert_eq!(shown_text, want, "a live value shows the final view");
    }
    same(&rebuilt(&mut app, b), &at_pause, "at the pause");
}

/// An Omniscient toggle while the sim fast-forwards rebuilds the page in that frame, however
/// recently it refreshed: no estimate (or exact value) shown before the toggle survives it.
#[test]
fn an_omniscient_toggle_rebuilds_at_once_while_fast_forwarding() {
    let mut app = shell_app();
    let private = {
        let v = app.world().resource::<Views>();
        v.company_rows
            .get()
            .rows
            .iter()
            .find(|r| !r.public)
            .unwrap()
            .id
    };
    open(&mut app, PageRef::Company(private));
    run_fast(&mut app);
    frames(&mut app, 40);
    for on in [true, false] {
        // Refresh the page now, so the pacing would hold the next refresh for 0.5 s.
        let b = body(&mut app);
        app.world_mut().entity_mut(b).insert(RebuildPage);
        frames(&mut app, 1);
        let (_, f0) = builds(&app);
        send(&mut app, Control::SetOmniscient(on));
        frames(&mut app, 1);
        let (_, f1) = builds(&app);
        assert!(
            f1 > f0,
            "Omniscient {on}: the page rebuilt in the toggle's frame"
        );
        assert_eq!(
            app.world()
                .resource::<game::bridge::RunnerControls>()
                .omniscient,
            on
        );
    }
}

/// A page in a hidden pane does not refresh, and its live values are held; when the pane shows
/// again it refreshes and lets them go at once.
#[test]
fn a_hidden_pane_waits_and_refreshes_when_shown() {
    let mut app = shell_app();
    let co = listed_company(&app);
    open(&mut app, PageRef::Company(co));
    let b = body(&mut app);
    // Paused: every monthly move would refresh the page at once; hide the windows first.
    app.world_mut().write_message(WindowAction::ToggleHidden);
    frames(&mut app, 2);
    let spans: Vec<Entity> = app
        .world_mut()
        .query_filtered::<Entity, With<LiveSpan>>()
        .iter(app.world())
        .collect();
    assert!(!spans.is_empty());
    assert!(
        spans
            .iter()
            .all(|&e| app.world().get::<HeldLive>(e).is_some()),
        "hidden: its live values are held"
    );
    alerts_off(&mut app);
    send(&mut app, Control::SetSpeed(5));
    send(&mut app, Control::Resume);
    let start = monthly_version(&app);
    let (p0, f0) = builds(&app);
    for _ in 0..3000 {
        frames(&mut app, 1);
        if monthly_version(&app) != start {
            break;
        }
    }
    send(&mut app, Control::Pause);
    frames(&mut app, 2);
    assert_ne!(monthly_version(&app), start, "the monthly views moved");
    assert_eq!(builds(&app), (p0, f0), "a hidden page does not refresh");
    app.world_mut().write_message(WindowAction::ToggleHidden);
    // The frame it shows rebuilds the page in full (not a patch: nothing it showed before the
    // hide stays a frame, D772).
    frames(&mut app, 1);
    let (p1, f1) = builds(&app);
    assert!(f1 > f0 && p1 == p0, "shown again: it rebuilds at once");
    assert!(
        spans.iter().all(
            |&e| app.world().get_entity(e).is_err() || app.world().get::<HeldLive>(e).is_none()
        ),
        "and lets its live values go"
    );
    let at_show = shown(&app, b);
    same(&rebuilt(&mut app, b), &at_show, "shown again");
}
