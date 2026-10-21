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
        // The physical key a US keyboard types `c` with, so every other key handler sees the
        // real key (O, N, digits, Space) while the bar has the keyboard.
        let code = key_for(c);
        let logical = if c == ' ' {
            Key::Space
        } else {
            Key::Character(t.as_str().into())
        };
        app.world_mut().write_message(key_event(
            code,
            logical.clone(),
            Some(&t),
            ButtonState::Pressed,
        ));
        app.update();
        app.world_mut()
            .write_message(key_event(code, logical, None, ButtonState::Released));
        app.update();
    }
}

fn key_for(c: char) -> KeyCode {
    const LETTERS: [KeyCode; 26] = [
        KeyCode::KeyA,
        KeyCode::KeyB,
        KeyCode::KeyC,
        KeyCode::KeyD,
        KeyCode::KeyE,
        KeyCode::KeyF,
        KeyCode::KeyG,
        KeyCode::KeyH,
        KeyCode::KeyI,
        KeyCode::KeyJ,
        KeyCode::KeyK,
        KeyCode::KeyL,
        KeyCode::KeyM,
        KeyCode::KeyN,
        KeyCode::KeyO,
        KeyCode::KeyP,
        KeyCode::KeyQ,
        KeyCode::KeyR,
        KeyCode::KeyS,
        KeyCode::KeyT,
        KeyCode::KeyU,
        KeyCode::KeyV,
        KeyCode::KeyW,
        KeyCode::KeyX,
        KeyCode::KeyY,
        KeyCode::KeyZ,
    ];
    const DIGITS: [KeyCode; 10] = [
        KeyCode::Digit0,
        KeyCode::Digit1,
        KeyCode::Digit2,
        KeyCode::Digit3,
        KeyCode::Digit4,
        KeyCode::Digit5,
        KeyCode::Digit6,
        KeyCode::Digit7,
        KeyCode::Digit8,
        KeyCode::Digit9,
    ];
    match c.to_ascii_lowercase() {
        l @ 'a'..='z' => LETTERS[(l as u8 - b'a') as usize],
        d @ '0'..='9' => DIGITS[(d as u8 - b'0') as usize],
        ' ' => KeyCode::Space,
        '-' => KeyCode::Minus,
        '=' => KeyCode::Equal,
        _ => KeyCode::Quote,
    }
}

fn controls(app: &App) -> RunnerControls {
    app.world().resource::<RunnerControls>().clone()
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
    // Ctrl and Alt with digits are not speeds (D453); plain digits still are.
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::Digit3);
    chord(&mut app, &[KeyCode::AltLeft], KeyCode::Digit4);
    let c = controls(&app);
    assert_eq!((c.speed, c.paused), (1, true), "the clock never moved");
    press(&mut app, KeyCode::Digit3);
    let c = controls(&app);
    assert_eq!((c.speed, c.paused), (3, false));
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
    // Running at speed 3, with a back history in the focused pane.
    common::alerts_off(&mut app);
    common::send(&mut app, sim::Control::SetSpeed(3));
    open(&mut app, PageRef::Industries, OpenTarget::Focused);
    open(&mut app, PageRef::Zones, OpenTarget::Focused);
    let before = (controls(&app).speed, controls(&app).paused);
    assert_eq!(before, (3, false));
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::KeyK);
    assert!(app.world().resource::<CommandBar>().open);
    // With the bar open, digits, rail letters and Space are text; Backspace edits the query.
    type_text(&mut app, "1on 5");
    assert_eq!(app.world().resource::<CommandBar>().query, "1on 5");
    for _ in 0..5 {
        press(&mut app, KeyCode::Backspace);
    }
    assert_eq!(app.world().resource::<CommandBar>().query, "");
    let c = controls(&app);
    assert_eq!(
        (c.speed, c.paused),
        before,
        "no speed key or pause reached the clock"
    );
    assert_eq!(app.world().resource::<Router>().current, Screen::Map);
    assert_eq!(focused_page(&app), PageRef::Zones, "no rail page, no back");
    assert_eq!(
        ws(&app)
            .history(ws(&app).focused())
            .unwrap()
            .back_list()
            .len(),
        2
    );
    // AltGr (Ctrl+Alt on Windows) types text too.
    app.world_mut().write_message(key_event(
        KeyCode::ControlLeft,
        Key::Control,
        None,
        ButtonState::Pressed,
    ));
    app.world_mut().write_message(key_event(
        KeyCode::AltRight,
        Key::AltGraph,
        None,
        ButtonState::Pressed,
    ));
    app.update();
    type_text(&mut app, "q");
    for k in [KeyCode::ControlLeft, KeyCode::AltRight] {
        app.world_mut().write_message(key_event(
            k,
            Key::Unidentified(NativeKey::Unidentified),
            None,
            ButtonState::Released,
        ));
    }
    app.update();
    assert_eq!(app.world().resource::<CommandBar>().query, "q");
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
    assert_eq!(headers(&mut app).len(), 4);
    {
        let mut cfg = app.world_mut().resource_mut::<UiConfig>();
        let s = cfg.sections.entry("company".into()).or_default();
        s.hidden.insert("views".into());
        s.order = vec!["plan".into(), "links".into()];
    }
    frames(&mut app, 2);
    let mut h = headers(&mut app);
    h.sort_unstable();
    assert_eq!(h, ["chart", "links", "plan"]);
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

/// Every text under an entity, with its color.
fn texts_under(app: &App, root: Entity) -> Vec<(String, Color)> {
    let mut out = Vec::new();
    let mut stack = vec![root];
    while let Some(e) = stack.pop() {
        if let Some(t) = app.world().get::<Text>(e) {
            let c = app.world().get::<TextColor>(e).map_or(Color::NONE, |c| c.0);
            out.push((t.0.clone(), c));
        }
        if let Some(c) = app.world().get::<Children>(e) {
            stack.extend(c.iter());
        }
    }
    out
}

/// A private company's hover card, drawn in the shell with Omniscient off, shows its figures
/// as bands in the estimate color, and none of the true values (D461, D463; the truth from a
/// second game of the same seed with Omniscient on, debug builds only). Its HQ is a place link.
#[test]
fn a_private_company_card_shows_bands() {
    use game::links::HoverCardPanel;
    use game::table::format::{self, BAND_TEXT};
    let mut app = shell_app();
    assert!(!controls(&app).omniscient);
    let views = app.world().resource::<Views>().clone();
    let row = views
        .company_rows
        .get()
        .rows
        .iter()
        .find(|r| r.estimated && !r.public)
        .unwrap()
        .clone();
    let page = PageRef::Company(row.id);
    let e = app
        .world_mut()
        .spawn(game::links::link("probe", page.clone()))
        .id();
    app.world_mut().entity_mut(e).insert(Hovered(true));
    let n = (HOVER_DELAY_SECS / FRAME.as_secs_f32()).ceil() as usize + 4;
    frames(&mut app, n);
    assert_eq!(app.world().resource::<HoverCard>().shown, Some(page));
    let panel = app
        .world_mut()
        .query_filtered::<Entity, With<HoverCardPanel>>()
        .single(app.world())
        .unwrap();
    let texts = texts_under(&app, panel);
    for f in [row.revenue_ttm, row.net_income_ttm, row.value] {
        let b = f.band().expect("a band");
        let s = format::band(b.low, b.high);
        assert!(
            texts.iter().any(|(t, c)| *t == s && *c == BAND_TEXT),
            "{s} in {texts:?}"
        );
    }
    let d = views.company_detail.get().get(row.id).unwrap();
    let hq = views.places.get().place_name(d.hq_province).unwrap();
    let hq_link = app
        .world_mut()
        .query::<(&Text, &Link)>()
        .iter(app.world())
        .any(|(t, l)| t.0 == hq && l.0 == PageRef::Country(row.hq_country));
    assert!(hq_link, "HQ {hq} links to its country");
    if cfg!(debug_assertions) {
        let mut truth = Sim::new(data(), 42).unwrap();
        truth.apply(sim::Control::SetOmniscient(true)).unwrap();
        let t = truth
            .views()
            .company_rows
            .get()
            .rows
            .iter()
            .find(|r| r.id == row.id)
            .unwrap()
            .clone();
        for f in [t.revenue_ttm, t.net_income_ttm, t.value] {
            let x = format::money(f.exact().unwrap());
            assert!(
                !texts.iter().any(|(s, _)| s.contains(&x)),
                "the truth {x} in {texts:?}"
            );
        }
    }
}

/// The command bar finds a country and a character by name (lane A1's views, D464) and opens
/// them: typed in lowercase, the top result is the page, and Enter opens it.
#[test]
fn command_bar_finds_countries_and_characters() {
    let mut app = shell_app();
    let index = app.world().resource::<NameIndex>().clone();
    let views = app.world().resource::<Views>().clone();
    let typable = |s: &str| s.chars().all(|c| c.is_ascii_alphabetic() || c == ' ');
    let unique = |s: &str| {
        index
            .entries()
            .iter()
            .filter(|e| e.name.eq_ignore_ascii_case(s))
            .count()
            == 1
    };
    let country = views
        .countries
        .get()
        .countries
        .iter()
        .find(|c| typable(&c.name) && unique(&c.name))
        .unwrap();
    let character = views
        .characters
        .get()
        .full
        .iter()
        .find(|c| typable(&c.name) && unique(&c.name))
        .unwrap();
    let sim::views::characters::CharacterRef::Full(ch) = character.id else {
        unreachable!()
    };
    for (name, page) in [
        (country.name.clone(), PageRef::Country(country.id)),
        (character.name.clone(), PageRef::Character(ch)),
    ] {
        press(&mut app, KeyCode::Backquote);
        assert!(app.world().resource::<CommandBar>().open);
        type_text(&mut app, &name.to_lowercase());
        assert_eq!(
            app.world().resource::<CommandBar>().items[0],
            game::command::CommandItem::Open(page.clone()),
            "{name}"
        );
        press(&mut app, KeyCode::Enter);
        assert_eq!(focused_page(&app), page);
        let pane = ws(&app).focused();
        assert!(
            body_texts(&mut app, pane).contains(&name),
            "{name} titles its page"
        );
    }
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

/// The entity of the button whose label is `label` (a theme button's text child).
fn button_labelled(app: &mut App, label: &str) -> Entity {
    let text = app
        .world_mut()
        .query::<(Entity, &Text)>()
        .iter(app.world())
        .find(|(_, t)| t.0 == label)
        .map(|(e, _)| e)
        .unwrap_or_else(|| panic!("no {label:?} text"));
    app.world().get::<ChildOf>(text).unwrap().parent()
}

/// A Settings button in an unfocused pane works on the first click: the press that focuses its
/// pane (and moves the last layout) does not rebuild the page under the pointer, and neither
/// does a divider drag.
#[test]
fn settings_buttons_work_in_an_unfocused_pane() {
    use game::test_support::{click, drag, press as pointer_press};
    let mut app = shell_app();
    open(&mut app, PageRef::Settings, OpenTarget::NewPane);
    let focused = ws(&app).focused();
    assert_eq!(
        ws(&app).page(focused),
        Some(&PageRef::World),
        "Settings is unfocused"
    );
    let compact = button_labelled(&mut app, "compact");
    app.world_mut()
        .trigger(pointer_press(compact, PointerButton::Primary));
    frames(&mut app, 2);
    assert_ne!(
        ws(&app).focused(),
        focused,
        "the press focused the Settings pane"
    );
    assert!(
        app.world().get_entity(compact).is_ok(),
        "the focus change did not rebuild the page"
    );
    // A divider drag moves only the last layout: no rebuild either.
    let divider = app
        .world_mut()
        .query::<(Entity, &game::ui::theme::Tooltip)>()
        .iter(app.world())
        .find(|(_, t)| t.0.starts_with("Drag to resize ("))
        .map(|(e, _)| e)
        .unwrap();
    let container = app.world().get::<ChildOf>(divider).unwrap().parent();
    app.world_mut().entity_mut(container).insert(ComputedNode {
        size: Vec2::new(1000.0, 600.0),
        inverse_scale_factor: 1.0,
        ..default()
    });
    let split = ws(&app).splits()[0].0;
    app.world_mut()
        .trigger(drag(divider, Vec2::new(100.0, 0.0)));
    frames(&mut app, 2);
    assert!(
        (ws(&app).ratio(split).unwrap() - 0.6).abs() < 1e-4,
        "dragged 100 of 1000 px"
    );
    assert!(app.world().get_entity(compact).is_ok());
    app.world_mut()
        .trigger(click(compact, PointerButton::Primary));
    frames(&mut app, 2);
    assert_eq!(app.world().resource::<UiConfig>().density, Density::Compact);
}

/// A link click opens its page in the focused pane; a middle click in a new pane; a right click
/// opens nothing.
#[test]
fn link_clicks_open_pages() {
    use game::test_support::click;
    let mut app = shell_app();
    let link = |app: &mut App, page: &PageRef| {
        app.world_mut()
            .query::<(Entity, &Link)>()
            .iter(app.world())
            .find(|(_, l)| &l.0 == page)
            .map(|(e, _)| e)
            .unwrap()
    };
    let e = link(&mut app, &PageRef::Industries);
    app.world_mut().trigger(click(e, PointerButton::Secondary));
    frames(&mut app, 2);
    assert_eq!(focused_page(&app), PageRef::World);
    app.world_mut().trigger(click(e, PointerButton::Primary));
    frames(&mut app, 2);
    assert_eq!(focused_page(&app), PageRef::Industries);
    act(&mut app, PaneAction::Back(None));
    let e = link(&mut app, &PageRef::News);
    app.world_mut().trigger(click(e, PointerButton::Middle));
    frames(&mut app, 2);
    assert_eq!(ws(&app).len(), 2);
    assert_eq!(ws(&app).page(ws(&app).pane_ids()[1]), Some(&PageRef::News));
    assert_eq!(focused_page(&app), PageRef::World, "the focus stays");
}
