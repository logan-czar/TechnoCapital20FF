//! M9 A2 workspace tests: the tiling panes, the router and history, the command bar, links and
//! hover cards, page sections and saved layouts, all through the whole shell headless
//! (MinimalPlugins, no window). Keys go in as keyboard messages.

mod common;

use bevy::input::ButtonState;
use bevy::input::keyboard::{Key, KeyboardInput, NativeKey};
use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, data, frames};
use game::bridge::{RunnerControls, SimBridgePlugin, Views};
use game::command::CommandBar;
use game::command::index::NameIndex;
use game::config::{Density, UiConfig};
use game::links::{HOVER_DELAY_SECS, HoverCard, Link};
use game::pages::{PageKind, PageRef, PdbFunction, PdoombergRoute, SectionHeader};
use game::table::Table;
use game::ui::ShellPlugin;
use game::ui::demo::demo_tables;
use game::ui::rail::{Router, Screen};
use game::workspace::{Axis, OpenPage, OpenTarget, PaneAction, PaneBody, PaneFrame, Workspace};
use sim::Sim;
use sim::world::CompanyId;

fn shell_app() -> App {
    let data = data();
    let demo = demo_tables(&data);
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, bevy::input::InputPlugin))
        .insert_resource(TimeUpdateStrategy::ManualDuration(FRAME))
        .add_plugins(SimBridgePlugin::new(Sim::new(data, 42).unwrap()))
        .insert_resource(demo)
        .add_plugins(ShellPlugin);
    app.update();
    app
}

fn key_event(key: KeyCode, logical: Key, text: Option<&str>, state: ButtonState) -> KeyboardInput {
    KeyboardInput {
        key_code: key,
        logical_key: logical,
        state,
        text: text.map(Into::into),
        repeat: false,
        window: Entity::PLACEHOLDER,
    }
}

/// Presses `key` while `mods` are held.
fn chord(app: &mut App, mods: &[KeyCode], key: KeyCode) {
    let un = || Key::Unidentified(NativeKey::Unidentified);
    for &m in mods {
        app.world_mut()
            .write_message(key_event(m, un(), None, ButtonState::Pressed));
    }
    app.world_mut()
        .write_message(key_event(key, un(), None, ButtonState::Pressed));
    app.update();
    app.world_mut()
        .write_message(key_event(key, un(), None, ButtonState::Released));
    for &m in mods {
        app.world_mut()
            .write_message(key_event(m, un(), None, ButtonState::Released));
    }
    app.update();
    app.update();
}

fn press(app: &mut App, key: KeyCode) {
    chord(app, &[], key);
}

/// Types text into whatever has the keyboard (the command bar).
fn type_text(app: &mut App, s: &str) {
    for c in s.chars() {
        let t = c.to_string();
        app.world_mut().write_message(key_event(
            KeyCode::KeyA,
            Key::Character(t.as_str().into()),
            Some(&t),
            ButtonState::Pressed,
        ));
        app.update();
        app.world_mut().write_message(key_event(
            KeyCode::KeyA,
            Key::Character(t.as_str().into()),
            None,
            ButtonState::Released,
        ));
        app.update();
    }
}

fn ws(app: &App) -> &Workspace {
    app.world().resource::<Workspace>()
}

fn focused_page(app: &App) -> PageRef {
    let w = ws(app);
    w.page(w.focused()).cloned().unwrap()
}

fn open(app: &mut App, page: PageRef, target: OpenTarget) {
    app.world_mut().write_message(OpenPage { page, target });
    frames(app, 2);
}

fn act(app: &mut App, a: PaneAction) {
    app.world_mut().write_message(a);
    frames(app, 2);
}

/// Texts under a pane's body.
fn body_texts(app: &mut App, pane: game::workspace::PaneId) -> Vec<String> {
    let body = app
        .world_mut()
        .query::<&PaneBody>()
        .iter(app.world())
        .count();
    assert!(body > 0);
    let frame = app
        .world_mut()
        .query::<&PaneFrame>()
        .iter(app.world())
        .find(|f| f.pane == pane)
        .map(|f| f.body)
        .unwrap();
    let mut out = Vec::new();
    let mut stack = vec![frame];
    while let Some(e) = stack.pop() {
        if let Some(t) = app.world().get::<Text>(e) {
            out.push(t.0.clone());
        }
        if let Some(c) = app.world().get::<Children>(e) {
            stack.extend(c.iter());
        }
    }
    out
}

/// Router and history: links open in the focused pane, back and forward walk the history, a
/// breadcrumb jumps back, and each page's body shows its title.
#[test]
fn panes_keep_their_own_history() {
    let mut app = shell_app();
    assert_eq!(focused_page(&app), PageRef::World);
    let a = ws(&app).focused();
    let co = |n| PageRef::Company(CompanyId(n));
    open(&mut app, co(0), OpenTarget::Focused);
    open(&mut app, PageRef::Industries, OpenTarget::Focused);
    open(&mut app, co(3), OpenTarget::Focused);
    assert_eq!(focused_page(&app), co(3));
    let name = app.world().resource::<NameIndex>().title(&co(3));
    assert!(
        body_texts(&mut app, a).contains(&name),
        "the page shows its title"
    );
    // Alt+Left, Backspace and Alt+Right.
    chord(&mut app, &[KeyCode::AltLeft], KeyCode::ArrowLeft);
    assert_eq!(focused_page(&app), PageRef::Industries);
    press(&mut app, KeyCode::Backspace);
    assert_eq!(focused_page(&app), co(0));
    chord(&mut app, &[KeyCode::AltLeft], KeyCode::ArrowRight);
    assert_eq!(focused_page(&app), PageRef::Industries);
    // A second pane has its own history.
    open(&mut app, PageRef::News, OpenTarget::NewPane);
    let w = ws(&app);
    assert_eq!(w.len(), 2);
    assert_eq!(w.focused(), a, "a new pane leaves the focus where it was");
    let b = w.pane_ids()[1];
    assert_eq!(w.page(b), Some(&PageRef::News));
    assert!(!w.history(b).unwrap().can_back());
    open(&mut app, co(5), OpenTarget::Pane(b));
    act(&mut app, PaneAction::Back(Some(b)));
    assert_eq!(ws(&app).page(b), Some(&PageRef::News));
    assert_eq!(focused_page(&app), PageRef::Industries, "pane a untouched");
    // A breadcrumb jump: pane a back to World.
    act(&mut app, PaneAction::Crumb(a, 0));
    assert_eq!(focused_page(&app), PageRef::World);
    assert!(ws(&app).history(a).unwrap().can_forward());
}

/// Pane split, close, focus and resize from the keyboard (D453), and the frames follow.
#[test]
fn panes_split_close_focus_and_resize_from_keys() {
    let mut app = shell_app();
    let frames_n = |app: &mut App| {
        app.world_mut()
            .query::<&PaneFrame>()
            .iter(app.world())
            .count()
    };
    assert_eq!(frames_n(&mut app), 1);
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::KeyD);
    assert_eq!(ws(&app).len(), 2);
    assert_eq!(frames_n(&mut app), 2, "a frame per pane");
    let (a, b) = (ws(&app).pane_ids()[0], ws(&app).pane_ids()[1]);
    assert_eq!(ws(&app).focused(), b, "Ctrl+D focuses the new pane");
    chord(
        &mut app,
        &[KeyCode::ControlLeft, KeyCode::ShiftLeft],
        KeyCode::KeyD,
    );
    assert_eq!(ws(&app).len(), 3);
    let c = ws(&app).pane_ids()[2];
    assert_eq!(ws(&app).splits()[1].1, Axis::Column);
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::ArrowUp);
    assert_eq!(ws(&app).focused(), b);
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::ArrowLeft);
    assert_eq!(ws(&app).focused(), a);
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::Tab);
    assert_eq!(ws(&app).focused(), b);
    let outer = ws(&app).splits()[0].0;
    chord(
        &mut app,
        &[KeyCode::ControlLeft, KeyCode::ShiftLeft],
        KeyCode::ArrowRight,
    );
    assert!((ws(&app).ratio(outer).unwrap() - 0.55).abs() < 1e-6);
    // Ctrl+W closes the focused pane; its sibling takes focus.
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::KeyW);
    assert_eq!(ws(&app).pane_ids(), [a, c]);
    assert_eq!(ws(&app).focused(), c);
    assert_eq!(frames_n(&mut app), 2);
    // Ctrl and digits are not speeds; the clock never moved.
    assert!(app.world().resource::<RunnerControls>().paused);
    // The last layout is in the config.
    let saved = app
        .world()
        .resource::<UiConfig>()
        .last_layout
        .clone()
        .unwrap();
    assert_eq!(saved, ws(&app).to_saved());
}

/// The command bar: Ctrl+K or ` opens it and takes the keyboard; Enter opens a company in the
/// focused pane, Shift+Enter in a new pane; `TICKER F3` opens Pdoomberg there.
#[test]
fn command_bar_searches_and_opens() {
    let mut app = shell_app();
    let index = app.world().resource::<NameIndex>().clone();
    let (ticker, id) = index
        .entries()
        .iter()
        .find_map(|e| match (&e.page, &e.alias) {
            (PageRef::Company(id), Some(t)) => Some((t.clone(), *id)),
            _ => None,
        })
        .unwrap();
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::KeyK);
    assert!(app.world().resource::<CommandBar>().open);
    // "1" is typed, not a speed key.
    type_text(&mut app, "1");
    assert!(app.world().resource::<RunnerControls>().paused);
    assert_eq!(app.world().resource::<CommandBar>().query, "1");
    press(&mut app, KeyCode::Backspace);
    type_text(&mut app, &ticker.to_lowercase());
    assert_eq!(
        app.world().resource::<CommandBar>().items[0],
        game::command::CommandItem::Open(PageRef::Company(id))
    );
    press(&mut app, KeyCode::Enter);
    assert!(!app.world().resource::<CommandBar>().open);
    assert_eq!(focused_page(&app), PageRef::Company(id));
    // Backtick, then Shift+Enter: a new pane.
    press(&mut app, KeyCode::Backquote);
    assert!(app.world().resource::<CommandBar>().open);
    type_text(&mut app, "industries");
    chord(&mut app, &[KeyCode::ShiftLeft], KeyCode::Enter);
    assert_eq!(ws(&app).len(), 2);
    assert_eq!(focused_page(&app), PageRef::Company(id), "focus stays");
    // Esc closes without leaving Pdoomberg state behind.
    press(&mut app, KeyCode::Backquote);
    type_text(&mut app, "zzzz");
    press(&mut app, KeyCode::Escape);
    assert!(!app.world().resource::<CommandBar>().open);
    assert_eq!(app.world().resource::<Router>().current, Screen::Map);
    // TICKER F3.
    press(&mut app, KeyCode::Backquote);
    type_text(&mut app, &format!("{ticker} F3"));
    press(&mut app, KeyCode::Enter);
    assert_eq!(app.world().resource::<Router>().current, Screen::Pdoomberg);
    assert_eq!(
        *app.world().resource::<PdoombergRoute>(),
        PdoombergRoute {
            function: PdbFunction::F3,
            company: Some(id)
        }
    );
}

/// Every page kind builds: a placeholder page, a list page with its table, the world page and
/// settings, in a pane, without a panic, each showing its title.
#[test]
fn every_page_kind_builds() {
    let mut app = shell_app();
    let index = app.world().resource::<NameIndex>().clone();
    let quarter = app.world().resource::<Views>().clock().date.quarter();
    let first = |k: PageKind| {
        index
            .entries()
            .iter()
            .find(|e| e.page.kind() == k)
            .map(|e| e.page.clone())
    };
    let pages = [
        Some(PageRef::World),
        first(PageKind::Company),
        first(PageKind::Industry),
        first(PageKind::Character),
        Some(PageRef::Country(sim::world::CountryId(0))),
        first(PageKind::Zone),
        first(PageKind::Exchange),
        Some(PageRef::Event(sim::world::StartupEventId(0))),
        Some(PageRef::Recap(quarter)),
        Some(PageRef::Headline {
            date: sim::time::Date::ymd(2020, 1, 1),
            n: 0,
        }),
        Some(PageRef::Companies),
        Some(PageRef::Industries),
        Some(PageRef::News),
        Some(PageRef::Characters),
        Some(PageRef::Countries),
        Some(PageRef::Exchanges),
        Some(PageRef::Zones),
        Some(PageRef::Events),
        Some(PageRef::Settings),
    ];
    let pane = ws(&app).focused();
    for p in pages.into_iter().map(Option::unwrap) {
        open(&mut app, p.clone(), OpenTarget::Focused);
        assert_eq!(focused_page(&app), p);
        let title = app.world().resource::<NameIndex>().title(&p);
        let texts = body_texts(&mut app, pane);
        assert!(texts.contains(&title), "{p}: {title} not in {texts:?}");
        if p.kind().is_list() {
            let tables = app
                .world_mut()
                .query::<&Table>()
                .iter(app.world())
                .filter(|t| t.id() == Some(p.kind().key()))
                .count();
            assert_eq!(tables, 1, "{p} has its index table");
        }
        if matches!(
            p.kind(),
            PageKind::Company | PageKind::Industry | PageKind::Zone
        ) {
            assert!(
                texts.iter().any(|t| t.contains("Placeholder")),
                "{p} is a placeholder"
            );
            assert!(
                texts.iter().any(|t| t.contains("v_")),
                "{p} lists its views"
            );
        }
    }
}

/// Section config: collapsing and hiding a section rebuild the page from the config.
#[test]
fn sections_collapse_and_hide() {
    let mut app = shell_app();
    let co = PageRef::Company(CompanyId(0));
    open(&mut app, co, OpenTarget::Focused);
    let headers = |app: &mut App| -> Vec<&'static str> {
        app.world_mut()
            .query::<&SectionHeader>()
            .iter(app.world())
            .map(|h| h.id)
            .collect()
    };
    assert_eq!(headers(&mut app).len(), 3);
    {
        let mut cfg = app.world_mut().resource_mut::<UiConfig>();
        let s = cfg.sections.entry("company".into()).or_default();
        s.hidden.insert("views".into());
        s.order = vec!["plan".into(), "links".into()];
    }
    frames(&mut app, 2);
    let mut h = headers(&mut app);
    h.sort_unstable();
    assert_eq!(h, ["links", "plan"]);
    let pane = ws(&app).focused();
    let texts = body_texts(&mut app, pane);
    assert!(
        texts
            .iter()
            .any(|t| t.contains("[show Views this page reads]"))
    );
}

/// Hovering a link for the delay shows its name card; leaving hides it after the grace time.
#[test]
fn hover_cards_follow_links() {
    let mut app = shell_app();
    open(&mut app, PageRef::Industries, OpenTarget::Focused);
    open(&mut app, PageRef::World, OpenTarget::Focused);
    let (e, page) = app
        .world_mut()
        .query::<(Entity, &Link)>()
        .iter(app.world())
        .find(|(_, l)| l.0 == PageRef::Companies)
        .map(|(e, l)| (e, l.0.clone()))
        .unwrap();
    app.world_mut().entity_mut(e).insert(Hovered(true));
    frames(&mut app, 2);
    assert_eq!(app.world().resource::<HoverCard>().shown, None, "waits");
    let n = (HOVER_DELAY_SECS / FRAME.as_secs_f32()).ceil() as usize + 2;
    frames(&mut app, n);
    assert_eq!(app.world().resource::<HoverCard>().shown, Some(page));
    app.world_mut().entity_mut(e).insert(Hovered(false));
    frames(&mut app, 30);
    assert_eq!(app.world().resource::<HoverCard>().shown, None);
}

/// Saved layouts: save, change the workspace, load it back; density from the keyboard.
#[test]
fn layouts_and_density() {
    let mut app = shell_app();
    open(&mut app, PageRef::News, OpenTarget::NewPane);
    let saved = ws(&app).to_saved();
    act(&mut app, PaneAction::SaveLayout("desk".into()));
    assert_eq!(app.world().resource::<UiConfig>().layouts["desk"], saved);
    act(&mut app, PaneAction::Close(None));
    assert_eq!(ws(&app).len(), 1);
    act(&mut app, PaneAction::LoadLayout("desk".into()));
    assert_eq!(ws(&app).to_saved(), saved);
    act(&mut app, PaneAction::DeleteLayout("desk".into()));
    assert!(app.world().resource::<UiConfig>().layouts.is_empty());
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::KeyJ);
    assert_eq!(app.world().resource::<UiConfig>().density, Density::Compact);
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::Equal);
    assert!((app.world().resource::<UiConfig>().font_scale - 1.05).abs() < 1e-6);
    // Ctrl+= is not speed +.
    assert_eq!(app.world().resource::<RunnerControls>().speed, 1);
    let rows: Vec<f32> = app
        .world_mut()
        .query::<&Table>()
        .iter(app.world())
        .map(Table::row_height)
        .collect();
    assert!(
        rows.iter().all(|&h| h == (18.0f32 * 1.05).round()),
        "{rows:?}"
    );
}
