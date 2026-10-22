//! M9 lane B2: the market and world pages and full-screen Pdoomberg, through the whole shell
//! headless (MinimalPlugins, no window) and on the pure model builders.
//!
//! - Industries: 42 rows with the births column and the top 5 as links; an industry's page with
//!   its charts, company list and fringe row (M9.3, M9.7).
//! - News: filters by industry; every startup event appears (M9.6, M9.7).
//! - Recap: opens in a pane from its pause alert in the pre-quarter-end week, and by quarter
//!   (M9.5).
//! - Pdoomberg: every function key opens its page, only inside the terminal; F4 holds only the
//!   lock; `TICKER Fn` routes (M9.4).
//! - Information: a private company shows bands and never the truth in F2, F5, F10 and the
//!   recap (an Omniscient twin gives the truth in debug builds); band columns sort by midpoint;
//!   no ballot odds anywhere.

mod common;

use bevy::input::ButtonState;
use bevy::input::keyboard::{Key, KeyboardInput, NativeKey};
use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, data, frames, send};
use game::bridge::{SimBridgePlugin, Views};
use game::chart::Chart;
use game::command::index::NameIndex;
use game::command::{CommandItem, RunCommand};
use game::pages::industries::{
    companies_model, headlines_model, industries_model, no_headlines_note,
};
use game::pages::live::{Filter, Live, LiveCtx, Picker, PickerOption};
use game::pages::news::{FeedItem, feed, news_model};
use game::pages::recap::{company_pages_model, expected_model};
use game::pages::{PageRef, PdbFunction, PdoombergRoute};
use game::pdoomberg::pages::{filings_model, quotes_model, screener_model};
use game::pdoomberg::{PdoombergUi, row_company};
use game::table::{Cell, Table, TableModel, format, sort_order};
use game::test_support::click;
use game::ui::ShellPlugin;
use game::ui::alerts::AlertIcon;
use game::ui::demo::demo_tables;
use game::ui::rail::{Router, Screen};
use game::workspace::{OpenPage, OpenTarget, PaneFrame, Workspace};
use sim::time::quarter::{lock_tick, recap_tick, release_tick};
use sim::time::{DateTime, Quarter};
use sim::views::estimate::Figure;
use sim::world::{AlertKind, CompanyId, IndustryId};
use sim::{Control, Sim, SimViews};

const Q1: Quarter = Quarter { year: 2020, q: 1 };

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

fn now(app: &App) -> DateTime {
    app.world().resource::<Views>().clock().now
}

/// Runs the game at max speed, alerts off, until `t`, then pauses.
fn run_to(app: &mut App, t: DateTime) {
    common::alerts_off(app);
    send(app, Control::SetSpeed(5));
    for _ in 0..40_000 {
        app.update();
        if now(app) >= t {
            break;
        }
    }
    send(app, Control::Pause);
    frames(app, 3);
    assert!(now(app) >= t, "reached {:?}", t);
}

fn key(app: &mut App, k: KeyCode) {
    for state in [ButtonState::Pressed, ButtonState::Released] {
        app.world_mut().write_message(KeyboardInput {
            key_code: k,
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

fn open(app: &mut App, page: PageRef) {
    app.world_mut().write_message(OpenPage {
        page,
        target: OpenTarget::Focused,
    });
    frames(app, 3);
}

/// Every text under `root`.
fn texts_under(app: &App, root: Entity) -> Vec<String> {
    let mut out = Vec::new();
    let mut stack = vec![root];
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

fn descendants_with<T: Component>(app: &mut App, root: Entity) -> Vec<Entity> {
    let mut out = Vec::new();
    let mut stack = vec![root];
    while let Some(e) = stack.pop() {
        if app.world().get::<T>(e).is_some() {
            out.push(e);
        }
        if let Some(c) = app.world().get::<Children>(e) {
            stack.extend(c.iter());
        }
    }
    out
}

fn focused_body(app: &mut App) -> Entity {
    let pane = app.world().resource::<Workspace>().focused();
    app.world_mut()
        .query::<&PaneFrame>()
        .iter(app.world())
        .find(|f| f.pane == pane)
        .map(|f| f.body)
        .unwrap()
}

fn table_by_id(app: &mut App, id: &str) -> Entity {
    let found: Vec<Entity> = app
        .world_mut()
        .query::<(Entity, &Table)>()
        .iter(app.world())
        .filter(|(_, t)| t.id() == Some(id))
        .map(|(e, _)| e)
        .collect();
    assert_eq!(found.len(), 1, "one table {id}");
    found[0]
}

fn model(app: &App, table: Entity) -> TableModel {
    app.world().get::<Table>(table).unwrap().model().clone()
}

/// Picks `v` in the picker for `key` that serves `table`, by clicking its chip.
fn pick(app: &mut App, table: Entity, key: &str, v: u64) {
    let picker = app
        .world_mut()
        .query::<&Picker>()
        .iter(app.world())
        .find(|p| p.key == key && p.target == table)
        .map(Picker::panel)
        .expect("the picker");
    let chip = app
        .world()
        .get::<Children>(picker)
        .unwrap()
        .iter()
        .find(|&c| app.world().get::<PickerOption>(c).is_some_and(|o| o.0 == v));
    let chip = chip.expect("the option");
    app.world_mut()
        .trigger(click(chip, bevy::picking::pointer::PointerButton::Primary));
    frames(app, 2);
    assert_eq!(app.world().get::<Filter>(table).unwrap().get(key), v);
}

/// M9.3 done line: the Industries table has its 42 rows, with the births column and the top 5
/// as links; an industry's page shows its figures, charts, company list and fringe row.
#[test]
fn industries_has_42_rows_and_a_detail_page() {
    let mut app = shell_app();
    open(&mut app, PageRef::Industries);
    let t = table_by_id(&mut app, "industries");
    let m = model(&app, t);
    assert_eq!(m.len(), 42);
    for key in [
        "Demand",
        "Supply",
        "S",
        "M",
        "Phase",
        "Long-term",
        "Growth",
        "Fringe",
        "Births",
    ] {
        assert!(m.column_by_key(key).is_some(), "{key} column");
    }
    for i in 1..=5 {
        let col = m.column_by_key(&format!("Top {i}")).unwrap();
        assert!(
            (0..m.len()).all(
                |r| matches!(m.cell(r, col), Cell::Link(PageRef::Company(_), _))
                    || m.display(r, col) == "-"
            ),
            "top {i} are links"
        );
    }
    assert!((0..m.len()).all(|r| m.cell(r, 0).link().is_some()));
    let body = focused_body(&mut app);
    let texts = texts_under(&app, body);
    assert!(
        texts
            .iter()
            .any(|t| t.starts_with("Global phase ") && t.contains("g_t")),
        "the header strip: {texts:?}"
    );

    // Run a quarter so the 20-quarter history has a closed quarter.
    run_to(&mut app, DateTime::midnight(Q1.next().first_day()).next());
    let v: SimViews = (**app.world().resource::<Views>()).clone();
    let id = IndustryId(0);
    open(&mut app, PageRef::Industry(id));
    let body = focused_body(&mut app);
    let texts = texts_under(&app, body);
    let name = app
        .world()
        .resource::<NameIndex>()
        .title(&PageRef::Industry(id));
    assert!(texts.contains(&name));
    for s in [
        "Demand vs supply",
        "Growth against the long-term rate",
        "Companies",
    ] {
        assert!(texts.iter().any(|t| t.contains(s)), "{s} in {texts:?}");
    }
    // The headlines note says why the table is empty, and only then (PR #30 review).
    let has_news = !headlines_model(&v, id).is_empty();
    assert_eq!(
        texts.iter().any(|t| t.starts_with("No headlines yet")),
        !has_news,
        "{texts:?}"
    );
    assert_eq!(no_headlines_note(&v, id).is_empty(), has_news);
    let quiet = (0..42)
        .map(IndustryId)
        .find(|&i| headlines_model(&v, i).is_empty());
    if let Some(q) = quiet {
        assert!(no_headlines_note(&v, q).starts_with("No headlines yet"));
    }
    let charts = descendants_with::<Chart>(&mut app, body);
    assert_eq!(charts.len(), 2, "the two charts");
    let history = v.industry_detail.get().get(id).unwrap().history.len();
    assert!(history >= 1);
    for c in charts {
        assert_eq!(
            app.world().get::<Chart>(c).unwrap().model().slots(),
            history.min(20)
        );
    }
    let t = table_by_id(&mut app, "industry.companies");
    let m = model(&app, t);
    let d = v.industry_detail.get().get(id).unwrap();
    assert_eq!(
        m.len(),
        d.companies.len() + 1,
        "the companies and the fringe row"
    );
    assert_eq!(m.display(m.len() - 1, 1), "Fringe (unnamed)");
    // The pure builders agree with the page.
    let index = NameIndex::build(&v);
    assert_eq!(industries_model(&v, &index).len(), 42);
    assert_eq!(companies_model(&v, &index, id).unwrap().len(), m.len());
    // The headlines follow v_news (daily; the page rebuilds only on its slower views).
    let news = table_by_id(&mut app, "industry.news");
    assert_eq!(model(&app, news), headlines_model(&v, id));
    run_to(
        &mut app,
        DateTime::midnight(sim::time::Date::ymd(2020, 4, 20)),
    );
    let news = table_by_id(&mut app, "industry.news");
    let v: SimViews = (**app.world().resource::<Views>()).clone();
    assert_eq!(model(&app, news), headlines_model(&v, id));
}

/// M9.6 done line: the feed filters by industry (and by company); every startup event appears.
#[test]
fn news_filters_by_industry_and_lists_startup_events() {
    let mut app = shell_app();
    run_to(&mut app, lock_tick(Q1).next().next());
    // The day after the lock: its headlines are posted at the next 00:00 (D158).
    run_to(
        &mut app,
        DateTime::midnight(lock_tick(Q1).date().add_days(2)),
    );
    open(&mut app, PageRef::News);
    let t = table_by_id(&mut app, "news");
    let all = model(&app, t);
    let v: SimViews = (**app.world().resource::<Views>()).clone();
    assert!(
        !all.is_empty(),
        "headlines after the first release and lock"
    );
    // Every startup event is in the feed: linked from its headline, or a row of its own.
    let events = &v.births.get().events;
    assert!(
        !events.is_empty(),
        "the first plan lock fired startup events"
    );
    for e in events {
        let linked = (0..all.len()).any(|r| {
            (0..all.columns.len()).any(|c| all.cell(r, c).link() == Some(&PageRef::Event(e.id)))
        });
        assert!(linked, "event {} in the feed", e.name);
    }
    let index = NameIndex::build(&v);
    // An industry with headlines, and one with none or fewer.
    let tagged: Vec<IndustryId> = v
        .news
        .get()
        .feed
        .iter()
        .filter_map(|h| h.industry)
        .collect();
    let ind = *tagged.first().expect("a tagged headline");
    pick(&mut app, t, "industry", u64::from(ind.0) + 1);
    let filtered = model(&app, t);
    assert!(!filtered.is_empty() && filtered.len() < all.len());
    let col = filtered.column_by_key("Industry").unwrap();
    let event_col = filtered.column_by_key("Startup event").unwrap();
    for r in 0..filtered.len() {
        let tag = filtered.cell(r, col).link() == Some(&PageRef::Industry(ind));
        let via_event = matches!(filtered.cell(r, event_col).link(), Some(PageRef::Event(e))
            if v.births.get().event(*e).is_some_and(|e| e.industries.contains(&ind)));
        assert!(tag || via_event, "row {r} is about the industry");
    }
    assert_eq!(
        filtered,
        news_model(
            &v,
            &index,
            &Filter::default().with("industry", u64::from(ind.0) + 1)
        )
    );
    // By company.
    let co = v.news.get().feed.iter().find_map(|h| h.company).unwrap();
    pick(&mut app, t, "industry", 0);
    pick(&mut app, t, "company", u64::from(co.0) + 1);
    let by_co = model(&app, t);
    assert!(!by_co.is_empty());
    // Every headline links to its page, and the page opens with its subjects linked.
    let first = by_co.cell(0, 1).link().cloned().unwrap();
    open(&mut app, first.clone());
    let body = focused_body(&mut app);
    let texts = texts_under(&app, body);
    assert!(
        texts.contains(&index.title(&PageRef::Company(co))),
        "{texts:?}"
    );
    // A startup event's page lists the startups it made.
    if let Some(e) = events.first() {
        open(&mut app, PageRef::Event(e.id));
        let t = table_by_id(&mut app, "event.startups");
        assert_eq!(model(&app, t).len(), e.startups.len());
        let body = focused_body(&mut app);
        let texts = texts_under(&app, body);
        assert!(texts.iter().any(|t| t.contains(&e.name)));
    }
}

/// M9.5 done line: the recap opens in a pane when its alert pauses the game in the pre-quarter-
/// end week, the alert icon opens it, and recaps are reachable by quarter.
#[test]
fn recap_opens_from_its_alert_and_by_quarter() {
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
    let public = {
        let v = app.world().resource::<Views>();
        v.company_rows
            .get()
            .rows
            .iter()
            .find(|r| r.public)
            .unwrap()
            .id
    };
    send(&mut app, Control::WatchlistAdd(private));
    send(&mut app, Control::WatchlistAdd(public));
    send(&mut app, Control::SetSpeed(5));
    let mut paused_at = Vec::new();
    for _ in 0..40_000 {
        app.update();
        let c = app.world().resource::<Views>().clock().clone();
        if c.paused {
            paused_at.push(c.now);
            if c.now == recap_tick(Q1) {
                break;
            }
            send(&mut app, Control::Resume);
        }
    }
    assert_eq!(paused_at, [release_tick(Q1), recap_tick(Q1)]);
    frames(&mut app, 3);
    let ws = app.world().resource::<Workspace>();
    assert_eq!(ws.len(), 2, "the recap opened in a new pane");
    let pane = ws
        .pane_ids()
        .into_iter()
        .find(|&p| ws.page(p) == Some(&PageRef::Recap(Q1)))
        .expect("a pane on the Q1 recap");
    let body = app
        .world_mut()
        .query::<&PaneFrame>()
        .iter(app.world())
        .find(|f| f.pane == pane)
        .unwrap()
        .body;
    let texts = texts_under(&app, body);
    for s in [
        "Global phase",
        "g_t",
        "Biggest expected beats and misses",
        "Watchlist companies",
    ] {
        assert!(texts.iter().any(|t| t.contains(s)), "{s} in {texts:?}");
    }
    let t = table_by_id(&mut app, "recap.companies");
    let m = model(&app, t);
    assert_eq!(m.len(), 2, "both watchlist companies have a page");
    // The company pages follow the watchlist.
    send(&mut app, Control::WatchlistRemove(private));
    frames(&mut app, 3);
    let t2 = table_by_id(&mut app, "recap.companies");
    assert_eq!(model(&app, t2).len(), 1, "follows the watchlist");
    send(&mut app, Control::WatchlistAdd(private));
    frames(&mut app, 3);
    let t2 = table_by_id(&mut app, "recap.companies");
    assert_eq!(model(&app, t2).len(), 2);
    let est = m.column_by_key("Figures").unwrap();
    let low = m.column_by_key("Range low").unwrap();
    for r in 0..m.len() {
        let banded = m.display(r, est) == "estimates";
        assert_eq!(matches!(m.cell(r, low), Cell::Band { .. }), banded);
    }
    // The alert icon opens it in the focused pane (D304).
    let icon = app
        .world_mut()
        .query::<(Entity, &AlertIcon)>()
        .iter(app.world())
        .find(|(_, i)| i.0 == AlertKind::QuarterlyRecap)
        .map(|(e, _)| e)
        .expect("the recap alert icon");
    app.world_mut()
        .trigger(click(icon, bevy::picking::pointer::PointerButton::Primary));
    frames(&mut app, 3);
    let ws = app.world().resource::<Workspace>();
    assert_eq!(ws.page(ws.focused()), Some(&PageRef::Recap(Q1)));
    // By quarter: the page links every kept quarter; a later one says when it opens; one
    // before the game says it is not kept.
    let body = focused_body(&mut app);
    let links: Vec<PageRef> = descendants_with::<game::links::Link>(&mut app, body)
        .into_iter()
        .map(|e| app.world().get::<game::links::Link>(e).unwrap().0.clone())
        .collect();
    assert!(links.contains(&PageRef::Recap(Q1)));
    open(&mut app, PageRef::Recap(Q1.next()));
    let body = focused_body(&mut app);
    assert!(
        texts_under(&app, body)
            .iter()
            .any(|t| t.contains("opens in its pre-quarter-end week"))
    );
    open(&mut app, PageRef::Recap(Q1.prev()));
    let body = focused_body(&mut app);
    assert!(
        texts_under(&app, body)
            .iter()
            .any(|t| t.contains("recap is kept"))
    );
    open(&mut app, PageRef::Recap(Q1));
    let body = focused_body(&mut app);
    assert!(
        texts_under(&app, body)
            .iter()
            .any(|t| t.contains("Global phase"))
    );
}

/// M9.4 done line: every function key opens its page, only while the terminal is open; F4
/// holds only the lock.
#[test]
fn every_function_key_opens_its_page() {
    let mut app = shell_app();
    let route = |app: &App| *app.world().resource::<PdoombergRoute>();
    // Outside the terminal the keys do nothing (D517), and no page is built yet (D520).
    key(&mut app, KeyCode::F5);
    assert_eq!(route(&app).function, PdbFunction::F2);
    assert_eq!(app.world().resource::<PdoombergUi>().built, None);
    key(&mut app, KeyCode::KeyB);
    assert_eq!(app.world().resource::<Router>().current, Screen::Pdoomberg);
    let area = app.world().resource::<PdoombergUi>().area;
    for (k, f, table) in [
        (KeyCode::F3, PdbFunction::F3, None),
        (KeyCode::F4, PdbFunction::F4, None),
        (KeyCode::F5, PdbFunction::F5, Some("pdb.f5")),
        (KeyCode::F6, PdbFunction::F6, Some("pdb.f6")),
        (KeyCode::F7, PdbFunction::F7, Some("pdb.f7.zones")),
        (KeyCode::F9, PdbFunction::F9, Some("pdb.f9")),
        (KeyCode::F10, PdbFunction::F10, Some("pdb.f10")),
        (KeyCode::F2, PdbFunction::F2, Some("pdb.f2")),
    ] {
        key(&mut app, k);
        assert_eq!(route(&app).function, f);
        let ui = app.world().resource::<PdoombergUi>().clone();
        assert_eq!(ui.built, Some(route(&app)), "{f:?} built");
        let texts = texts_under(&app, ui.command_line);
        assert!(texts.iter().any(|t| t.contains(f.code())), "{texts:?}");
        if let Some(id) = table {
            let t = table_by_id(&mut app, id);
            assert!(!model(&app, t).is_empty(), "{id} has rows");
            assert!(
                app.world().get::<game::table::TableLook>(t).is_some(),
                "terminal look"
            );
        }
        if f == PdbFunction::F4 {
            assert_eq!(
                texts_under(&app, area),
                ["Read-only MVP"],
                "F4 holds only the lock"
            );
        }
        if f == PdbFunction::F7 {
            for id in ["pdb.f7.sovereigns", "pdb.f7.ratings"] {
                table_by_id(&mut app, id);
            }
        }
    }
    // The key row is clickable too.
    let (_, f6) = app.world().resource::<PdoombergUi>().keys[4];
    app.world_mut()
        .trigger(click(f6, bevy::picking::pointer::PointerButton::Primary));
    frames(&mut app, 2);
    assert_eq!(route(&app).function, PdbFunction::F6);
    // F9 has the 42 industries; F7 every zone.
    key(&mut app, KeyCode::F9);
    let t = table_by_id(&mut app, "pdb.f9");
    assert_eq!(model(&app, t).len(), 42);
    key(&mut app, KeyCode::Escape);
    assert_eq!(app.world().resource::<Router>().current, Screen::Map);
    // Closed, its live widgets are held (D520); reopened, they run again.
    let root = app.world().resource::<PdoombergUi>().root;
    let held = |app: &mut App| {
        descendants_with::<Live>(app, root)
            .into_iter()
            .map(|e| app.world().get::<Live>(e).unwrap().is_held())
            .collect::<Vec<_>>()
    };
    let h = held(&mut app);
    assert!(!h.is_empty() && h.iter().all(|&x| x), "held while closed");
    key(&mut app, KeyCode::KeyB);
    assert!(held(&mut app).iter().all(|&x| !x), "running while open");
}

/// M9.4: `TICKER Fn` opens Pdoomberg on that company's page; F3 draws its daily and 10-year
/// charts over the EFV band; a right-click on a row loads a company; a link leaves the terminal.
#[test]
fn ticker_function_commands_route() {
    let mut app = shell_app();
    run_to(
        &mut app,
        DateTime::midnight(sim::time::Date::ymd(2020, 1, 20)),
    );
    let (id, ticker) = {
        let v = app.world().resource::<Views>();
        let r = v
            .company_rows
            .get()
            .rows
            .iter()
            .find(|r| r.public && !r.ticker.is_empty() && v.quotes.get().get(r.id).is_some())
            .unwrap();
        (r.id, r.ticker.clone())
    };
    let items = game::command::resolve(
        &format!("{ticker} F3"),
        app.world().resource::<NameIndex>(),
        &game::config::UiConfig::default(),
    );
    app.world_mut().write_message(RunCommand {
        item: items[0].clone(),
        new_pane: false,
    });
    frames(&mut app, 3);
    assert_eq!(app.world().resource::<Router>().current, Screen::Pdoomberg);
    let want = PdoombergRoute {
        function: PdbFunction::F3,
        company: Some(id),
    };
    assert_eq!(*app.world().resource::<PdoombergRoute>(), want);
    let ui = app.world().resource::<PdoombergUi>().clone();
    assert_eq!(ui.built, Some(want));
    assert!(texts_under(&app, ui.command_line)[0].contains(&format!("{ticker} F3")));
    assert!(
        texts_under(&app, ui.security)
            .iter()
            .any(|t| t.starts_with(&ticker))
    );
    let charts = descendants_with::<Chart>(&mut app, ui.area);
    assert_eq!(charts.len(), 2, "daily and 10-year charts");
    for c in charts {
        let m = app.world().get::<Chart>(c).unwrap().model().clone();
        assert!(m.slots() > 0);
        assert!(m.title.contains("EFV band"));
    }
    let texts = texts_under(&app, ui.area);
    assert!(texts.iter().any(|t| t.contains("never shown")));
    // Every other function, on the same company.
    for f in [PdbFunction::F5, PdbFunction::F10] {
        app.world_mut().write_message(RunCommand {
            item: CommandItem::Pdoomberg {
                function: f,
                company: Some(id),
            },
            new_pane: false,
        });
        frames(&mut app, 2);
        assert_eq!(
            app.world()
                .resource::<PdoombergUi>()
                .built
                .unwrap()
                .function,
            f
        );
    }
    // A right-click on an F10 row loads that company.
    let table = app.world().resource::<PdoombergUi>().main_table.unwrap();
    let other = row_company(app.world().get::<Table>(table).unwrap(), 7).unwrap();
    app.world_mut().write_message(game::table::TableRowClicked {
        table,
        row: 7,
        button: bevy::picking::pointer::PointerButton::Secondary,
    });
    frames(&mut app, 2);
    assert_eq!(
        app.world().resource::<PdoombergRoute>().company,
        Some(other)
    );
    // A link opens its page in the workspace and leaves the terminal (D517).
    open(&mut app, PageRef::Company(other));
    assert_eq!(app.world().resource::<Router>().current, Screen::Map);
}

/// The figures the screens show of `id`, each with its truth from an Omniscient twin: the
/// screen, its column and the true value.
fn truths(t: &SimViews, id: CompanyId) -> Vec<(&'static str, &'static str, f64)> {
    let x = |f: Figure| f.exact().expect("Omniscient is exact");
    let r = t
        .company_rows
        .get()
        .rows
        .iter()
        .find(|r| r.id == id)
        .unwrap();
    let mut out = vec![
        ("F2", "Value", x(r.value)),
        ("F10", "Revenue TTM", x(r.revenue_ttm)),
        ("F10", "NI TTM", x(r.net_income_ttm)),
        ("F10", "Value", x(r.value)),
    ];
    if let Some(f) = t.filings.get().of_company(id) {
        out.extend([
            ("F5", "Revenue", x(f.revenue)),
            ("F5", "EBIT", x(f.ebit)),
            ("F5", "Net income", x(f.net_income)),
            ("F5", "Cash", x(f.cash)),
            ("F5", "Equity", x(f.equity)),
        ]);
    }
    if let Some(p) = t.recap.get().quarter(Q1).and_then(|q| q.company(id)) {
        out.extend([
            ("recap", "Range low", x(p.range.0)),
            ("recap", "Range high", x(p.range.1)),
            ("recap", "Consensus", x(p.expected.consensus)),
        ]);
    }
    out
}

fn row_texts(m: &TableModel, keep: impl Fn(usize) -> bool) -> Vec<String> {
    (0..m.len())
        .filter(|&r| keep(r))
        .flat_map(|r| (0..m.columns.len()).map(move |c| m.display(r, c).to_owned()))
        .collect()
}

fn row_of(m: &TableModel, id: CompanyId) -> Option<usize> {
    (0..m.len())
        .find(|&r| (0..m.columns.len()).any(|c| m.cell(r, c).link() == Some(&PageRef::Company(id))))
}

/// Information (D420, D461): with Omniscient off a private company's figures in F2, F5, F10 and
/// the recap are bands; in debug builds an Omniscient twin of the same seed gives the truth,
/// which lies strictly inside each band and appears in no text. Band columns sort by midpoint.
#[test]
fn private_figures_are_bands_and_never_the_truth() {
    let mut sim = Sim::new(data(), 42).unwrap();
    let banded: Vec<CompanyId> = sim
        .views()
        .company_rows
        .get()
        .rows
        .iter()
        .filter(|r| r.estimated && !r.public)
        .map(|r| r.id)
        .take(12)
        .collect();
    for &c in &banded {
        sim.apply(Control::WatchlistAdd(c)).unwrap();
    }
    while sim.views().clock().now <= recap_tick(Q1) {
        sim.step();
    }
    assert!(!sim.controls().omniscient);
    let v = sim.views().clone();
    let index = NameIndex::build(&v);
    let controls = sim.controls().clone();
    let all = Filter::default();
    let ctx = LiveCtx {
        views: &v,
        index: &index,
        controls: &controls,
        filter: &all,
    };
    let f2 = quotes_model(&ctx);
    let f10 = screener_model(&ctx);
    let f5 = filings_model(&v, &index);
    let recap = v.recap.get().quarter(Q1).expect("the Q1 recap");
    let watch: Vec<CompanyId> = controls.watchlist.iter().copied().collect();
    let pages = company_pages_model(recap, &watch, &index);
    let expected = expected_model(recap, &index);
    assert_eq!(pages.len(), banded.len());
    for &id in &banded {
        for (name, m, key) in [
            ("F2", &f2, "Value"),
            ("F10", &f10, "Revenue TTM"),
            ("F5", &f5, "Revenue"),
            ("recap", &pages, "Range low"),
        ] {
            let r = row_of(m, id).unwrap_or_else(|| panic!("{name} row of {id:?}"));
            let c = m.column_by_key(key).unwrap();
            assert!(
                matches!(m.cell(r, c), Cell::Band { .. }),
                "{name} {key} of {id:?}: {:?}",
                m.cell(r, c)
            );
        }
    }
    // Sorting a band column goes by the midpoints, the only value the player has.
    let col = f10.column_by_key("Value").unwrap();
    let order = sort_order(&f10, col, true);
    let shown: Vec<f64> = order
        .iter()
        .filter_map(|&i| f10.cell(i as usize, col).number())
        .collect();
    assert!(shown.windows(2).all(|w| w[0] <= w[1]));
    for r in 0..f10.len() {
        if let Cell::Band { low, high, .. } = *f10.cell(r, col) {
            assert_eq!(f10.cell(r, col).number(), Some((low + high) / 2.0));
        }
    }

    if !cfg!(debug_assertions) {
        return; // Omniscient is debug-only (spec 1).
    }
    let mut twin = sim;
    twin.apply(Control::SetOmniscient(true)).unwrap();
    let t = twin.views().clone();
    let models = [("F2", &f2), ("F10", &f10), ("F5", &f5), ("recap", &pages)];
    for &id in &banded {
        let truth = truths(&t, id);
        assert!(truth.len() >= 4);
        for &(screen, key, x) in &truth {
            let m = models.iter().find(|(n, _)| *n == screen).unwrap().1;
            let r = row_of(m, id).unwrap();
            let c = m.column_by_key(key).unwrap();
            let Cell::Band { low, high, .. } = *m.cell(r, c) else {
                panic!("{screen} {key} of {id:?} is a band");
            };
            // Strictly inside, at no endpoint, and printed nowhere in its cell (D422).
            assert!(low < x && x < high, "{screen} {key}: {low} < {x} < {high}");
            let s = format::money(x);
            let shown = m.display(r, c);
            assert!(
                !shown.split(['-', ' ']).any(|p| p == s),
                "{screen} {key} of {id:?}: the truth {s} shows in {shown}"
            );
        }
        // No cell of the company's rows (the expected beats and misses too) is a hidden value.
        let mut row: Vec<String> = models
            .iter()
            .flat_map(|(_, m)| row_texts(m, |r| row_of(m, id) == Some(r)))
            .collect();
        row.extend(row_texts(&expected, |r| row_of(&expected, id) == Some(r)));
        for &(_, _, x) in &truth {
            let s = format::money(x);
            assert!(!row.contains(&s), "{id:?}: {s} shown as a value");
        }
    }
}

/// Spec 8 F10 (M9.7): the screener filters by origin and listing date, and by the 9.2 filters.
#[test]
fn screener_filters_by_origin_and_listing() {
    let mut app = shell_app();
    key(&mut app, KeyCode::KeyB);
    key(&mut app, KeyCode::F10);
    let t = table_by_id(&mut app, "pdb.f10");
    let all = model(&app, t);
    let n = app
        .world()
        .resource::<Views>()
        .company_rows
        .get()
        .rows
        .len();
    assert_eq!(all.len(), n);
    pick(&mut app, t, "listing", 2);
    let before = model(&app, t);
    let listed = all.column_by_key("Listed").unwrap();
    assert!(!before.is_empty() && before.len() < n);
    assert!((0..before.len()).all(|r| before.display(r, listed) == "before 2020"));
    pick(&mut app, t, "listing", 3);
    assert!(
        model(&app, t).is_empty(),
        "nothing listed in play on day one"
    );
    pick(&mut app, t, "listing", 0);
    pick(&mut app, t, "origin", 2);
    assert!(model(&app, t).is_empty(), "nothing born on day one");
    pick(&mut app, t, "origin", 1);
    assert_eq!(model(&app, t).len(), n);
    pick(&mut app, t, "public", 2);
    let private = model(&app, t);
    let public = all.column_by_key("Public").unwrap();
    assert!((0..private.len()).all(|r| private.display(r, public) == "private"));
    pick(&mut app, t, "industry", 1);
    let ind = model(&app, t);
    let col = all.column_by_key("Industry").unwrap();
    assert!(
        (0..ind.len()).all(|r| ind.cell(r, col).link() == Some(&PageRef::Industry(IndustryId(0))))
    );
}

/// D520: a right-click load on F10 changes the loaded company and its security line but keeps
/// the page: the same table, with its filter.
#[test]
fn right_click_load_keeps_the_page() {
    let mut app = shell_app();
    key(&mut app, KeyCode::KeyB);
    key(&mut app, KeyCode::F10);
    let t = table_by_id(&mut app, "pdb.f10");
    pick(&mut app, t, "public", 1);
    let shown = model(&app, t);
    assert!(!shown.is_empty());
    let mut loaded = None;
    for row in [0, 1] {
        let id = row_company(app.world().get::<Table>(t).unwrap(), row).unwrap();
        app.world_mut().write_message(game::table::TableRowClicked {
            table: t,
            row,
            button: bevy::picking::pointer::PointerButton::Secondary,
        });
        frames(&mut app, 3);
        let route = *app.world().resource::<PdoombergRoute>();
        assert_eq!(route.company, Some(id), "row {row} loaded");
        assert_ne!(Some(id), loaded, "the loaded company changed");
        loaded = Some(id);
        let ui = app.world().resource::<PdoombergUi>().clone();
        assert_eq!(ui.built, Some(route));
        assert_eq!(ui.main_table, Some(t), "the page was not rebuilt");
        assert_eq!(app.world().get::<Filter>(t).unwrap().get("public"), 1);
        assert_eq!(model(&app, t), shown, "still filtered");
        let ticker = app
            .world()
            .resource::<Views>()
            .company_rows
            .get()
            .rows
            .iter()
            .find(|r| r.id == id)
            .unwrap()
            .ticker
            .clone();
        let line = texts_under(&app, ui.security);
        assert!(line.iter().any(|s| s.starts_with(&ticker)), "{line:?}");
    }
}

/// No IPO ballot odds anywhere (20-ui 20.1; m9-plan section 1): the market pages and every
/// Pdoomberg page, after a quarter of play, print no chance or odds.
#[test]
fn no_ballot_odds_on_any_page() {
    let mut app = shell_app();
    run_to(&mut app, DateTime::midnight(Q1.next().first_day()));
    let mut texts = Vec::new();
    let v: SimViews = (**app.world().resource::<Views>()).clone();
    let mut pages = vec![
        PageRef::Industries,
        PageRef::News,
        PageRef::Events,
        PageRef::Recap(Q1),
    ];
    pages.extend(v.births.get().events.iter().map(|e| PageRef::Event(e.id)));
    pages.extend(
        feed(&v)
            .filter_map(|i| match i {
                FeedItem::Headline { page, .. } => Some(page),
                FeedItem::Event(_) => None,
            })
            .take(30),
    );
    for p in pages {
        open(&mut app, p);
        let body = focused_body(&mut app);
        texts.extend(texts_under(&app, body));
        for t in descendants_with::<Table>(&mut app, body) {
            let m = model(&app, t);
            texts.extend(row_texts(&m, |_| true));
        }
    }
    key(&mut app, KeyCode::KeyB);
    for k in [
        KeyCode::F2,
        KeyCode::F3,
        KeyCode::F4,
        KeyCode::F5,
        KeyCode::F6,
        KeyCode::F7,
        KeyCode::F9,
        KeyCode::F10,
    ] {
        key(&mut app, k);
        let root = app.world().resource::<PdoombergUi>().root;
        texts.extend(texts_under(&app, root));
        if let Some(t) = app.world().resource::<PdoombergUi>().main_table {
            let m = model(&app, t);
            texts.extend(row_texts(&m, |_| true));
        }
    }
    for t in &texts {
        let l = t.to_lowercase();
        assert!(!l.contains("odds") && !l.contains("chance"), "{t}");
    }
}
