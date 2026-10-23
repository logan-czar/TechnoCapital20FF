//! The M9.9 timing harness (D459, D519, D573): `--bench-pages` opens every page in the focused
//! pane from an [`OpenPage`] message, and every Pdoomberg function page from an
//! [`OpenPdoomberg`] message, and times each to the first frame whose layout has it: the pane
//! (or the terminal's page area) drew it, its body has a size, every text of its header is laid
//! out, every table on it shows its first row's text laid out (the pool sizes itself from the
//! body's laid-out height, so that is a frame or two later), and every chart with data has
//! drawn. Each page opens twice: cold (its first build, font glyphs new) and warm. A page whose
//! cold open alone missed the target (its warm open made it) opens once more, a retry: one slow
//! frame of the machine (a 500 ms hitch the PR #38 bench saw once and never again) then shows
//! as a retried row, and only a page slow on the retry too fails (D693).
//!
//! What it opens, on a fresh 2020 world (seed 1 unless `--seed`):
//! - one page of every [`PageKind`] that exists there (a listed and a private company, a recap
//!   by quarter, one with no recap yet and one before the game);
//! - every Company tab ([`crate::pages::company::SECTIONS`]) on a listed and a private
//!   company, and the page with every section shown;
//! - every Pdoomberg function page ([`PdbFunction::ALL`]); F3 on a listed company, a private
//!   one and none.
//!
//! - every map mode (M8.5; D705): from the mode message (what a click on the mode bar sends) to
//!   the first frame whose colour table holds the new layer and whose pins are placed.
//!
//! A fresh world has no startup event and no headline yet, so the harness then runs the game
//! at max speed (alerts off) until the views hold both (the first events fire at the first plan
//! lock; v_births shows them at its quarterly rebuild, in April), pauses, and times the kinds it
//! could not open before: a startup event, a headline and a company born in play. It prints the table, then fails (exit 1) if a page took 100 ms or more, timed out, or
//! a page kind, Company tab or function page was not covered. The target holds in a release
//! build; a debug build prints the same table, for information.

use std::collections::BTreeSet;
use std::time::Instant;

use bevy::prelude::*;
use bevy::text::TextLayoutInfo;
use sim::Control;
use sim::finance::distress::CompanyStatus;
use sim::world::{AlertKind, AlertLevel};

use crate::bridge::{SimControl, Views};
use crate::chart::Chart;
use crate::command::index::NameIndex;
use crate::map::modes::MapModeInput;
use crate::pages::{OpenPdoomberg, PageKind, PageRef, PdbFunction, PdoombergRoute};
use crate::pdoomberg::PdoombergUi;
use crate::table::Table;
use crate::workspace::{OpenPage, PaneFrame, Workspace, WorkspaceInput};
use sim::views::map_layers::MapMode;

/// Frames before the first page (pipelines and the font atlas warm up).
pub const WARMUP_FRAMES: u64 = 90;
/// Frames a page may take before it counts as timed out.
pub const TIMEOUT_FRAMES: u64 = 240;
/// The target (spec 10 M9: every screen opens in under 100 ms).
pub const TARGET_MS: f64 = 100.0;
/// Frames the late stage may run the game for before it gives up waiting for the first
/// startup event and headline.
pub const ADVANCE_FRAMES_MAX: u64 = 20_000;
/// Frames the late stage waits after pausing, so the views settle before it opens pages.
pub const SETTLE_FRAMES: u64 = 10;

/// One thing the bench opens: a workspace page or a Pdoomberg function page.
#[derive(Debug, Clone, PartialEq)]
enum Item {
    Page(PageRef, Tab),
    Pdb(PdoombergRoute),
    MapMode(MapMode),
}

impl Item {
    fn name(&self) -> String {
        match self {
            Item::Page(p, None) => p.key(),
            Item::Page(p, Some(Some(t))) => format!("{} tab {t}", p.key()),
            Item::Page(p, Some(None)) => format!("{} all tabs", p.key()),
            Item::Pdb(r) => match r.company {
                Some(c) => format!("pdoomberg/{}/company/{}", r.function.code(), c.0),
                None => format!("pdoomberg/{}", r.function.code()),
            },
            Item::MapMode(m) => format!("map mode {}", mode_name(*m)),
        }
    }
}

/// Where the bench is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
enum Stage {
    /// Timing the fresh world's items.
    #[default]
    Fresh,
    /// Running the game to the first startup event and headline (since this frame).
    Advance(u64),
    /// Paused there; opening once this frame is reached.
    Settle(u64),
    /// Timing the late items.
    Late,
    Done,
}

/// One timing: the item, whether it was late, the pass (0 cold, 1 warm, 2 retry), ms and frames.
type Timing = (Item, bool, u8, f64, u64);

#[derive(Resource, Default)]
struct PageBench {
    frame: u64,
    stage: Stage,
    pages: Vec<Item>,
    i: usize,
    pass: u8,
    sent: Option<(Instant, u64)>,
    results: Vec<Timing>,
    /// The game date the late items were timed at.
    late_date: Option<sim::time::Date>,
    /// The listed companies, for the coverage check (each tab and F3 on listed and private).
    listed: BTreeSet<sim::world::CompanyId>,
    /// The stage's items, kept while its retry pass opens only the slow ones.
    all_pages: Vec<Item>,
}

/// The Company page's tab a bench entry opens (lane B1, D481): `None` shows every section,
/// `Some(id)` only that one (the others folded, as the tab strip does).
type Tab = Option<Option<&'static str>>;

pub struct PageBenchPlugin;

impl Plugin for PageBenchPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<PageBench>()
            .add_systems(Update, send_next.before(WorkspaceInput))
            .add_systems(Last, check_laid_out);
    }
}

fn active(r: &&sim::views::company_rows::CompanyRow) -> bool {
    r.status == CompanyStatus::Active
}

/// A map mode as the bench names it.
pub fn mode_name(m: MapMode) -> String {
    match m {
        MapMode::Political => "political".into(),
        MapMode::Development(t) => format!("development:{}", t.name().to_lowercase()),
        MapMode::Industry(None) => "industry track".into(),
        MapMode::Industry(Some(i)) => format!("industry:{}", i.0),
        MapMode::CompanyHqs(f) if f.listed == Some(true) => "hqs listed".into(),
        MapMode::CompanyHqs(_) => "hqs".into(),
        MapMode::FinancialZones => "zones".into(),
    }
}

/// Every map mode the bench switches to (D705): each development track, the Industry track and
/// the industry with the most units, the HQ pins (all, then listed only), the zones, and back
/// to Political last (the map starts on it).
fn map_modes(v: &Views) -> Vec<MapMode> {
    use sim::views::map_layers::{DevTrack, HqFilter};
    let units = &v.units.get().units;
    let busiest = (0..v.industry_rows.get().rows.len())
        .max_by_key(|&i| units.iter().filter(|u| u.industry.0 as usize == i).count())
        .map(|i| sim::world::IndustryId(i as u32));
    let mut out: Vec<MapMode> = DevTrack::ALL
        .iter()
        .map(|&t| MapMode::Development(t))
        .collect();
    out.push(MapMode::Industry(None));
    out.push(MapMode::Industry(busiest));
    out.push(MapMode::CompanyHqs(HqFilter::default()));
    out.push(MapMode::CompanyHqs(HqFilter {
        listed: Some(true),
        ..HqFilter::default()
    }));
    out.push(MapMode::FinancialZones);
    out.push(MapMode::Political);
    out
}

/// The fresh world's items: one page of each kind, every Company tab, then every Pdoomberg
/// function page. The terminal builds no page before its first open (D520), so F2's cold
/// number is a real build.
fn fresh_items(v: &Views, index: &NameIndex) -> Vec<Item> {
    let rows = &v.company_rows.get().rows;
    let listed = rows.iter().filter(active).find(|r| r.public).map(|r| r.id);
    let private = rows.iter().filter(active).find(|r| !r.public).map(|r| r.id);
    let mut out: Vec<Item> = pick_pages(v, index)
        .into_iter()
        .map(|(p, tab)| Item::Page(p, tab))
        .collect();
    for f in PdbFunction::ALL {
        let companies: Vec<Option<sim::world::CompanyId>> = if f == PdbFunction::F3 {
            // A listed company's bars, a private one's value band, and no company loaded.
            vec![listed, private, None]
        } else {
            vec![None]
        };
        for company in companies {
            out.push(Item::Pdb(PdoombergRoute {
                function: f,
                company,
            }));
        }
    }
    out.extend(map_modes(v).into_iter().map(Item::MapMode));
    out
}

/// One page of each kind, picked from the views of the world as it is; then each Company tab
/// on a listed and a private company in turn (so each open is a new page in the pane).
fn pick_pages(v: &Views, index: &NameIndex) -> Vec<(PageRef, Tab)> {
    let mut out: Vec<(PageRef, Tab)> = pages_of_each_kind(v, index)
        .into_iter()
        .map(|p| (p, None))
        .collect();
    let world = out.pop();
    let rows = &v.company_rows.get().rows;
    let pick = |public: bool| {
        rows.iter()
            .filter(active)
            .find(|r| r.public == public)
            .map(|r| PageRef::Company(r.id))
    };
    if let (Some(listed), Some(private)) = (pick(true), pick(false)) {
        for &(id, _) in crate::pages::company::SECTIONS {
            for p in [&listed, &private] {
                out.push((p.clone(), Some(Some(id))));
            }
        }
        // Back to every section shown.
        out.push((listed, Some(None)));
    }
    out.extend(world);
    out
}

/// One page of each kind that exists in the world as it is.
fn pages_of_each_kind(v: &Views, index: &NameIndex) -> Vec<PageRef> {
    let rows = &v.company_rows.get().rows;
    let listed = rows
        .iter()
        .filter(active)
        .find(|r| r.public)
        .map(|r| PageRef::Company(r.id));
    let private = rows
        .iter()
        .filter(active)
        .find(|r| !r.public)
        .map(|r| PageRef::Company(r.id));
    let first = |f: fn(&PageRef) -> bool| index.entries().iter().map(|e| e.page.clone()).find(&f);
    let quarter = v.clock().date.quarter();
    [
        Some(PageRef::Companies),
        listed,
        private,
        Some(PageRef::Industries),
        first(|p| matches!(p, PageRef::Industry(_))),
        Some(PageRef::Characters),
        first(|p| matches!(p, PageRef::Character(_))),
        Some(PageRef::Countries),
        rows.first().map(|r| PageRef::Country(r.hq_country)),
        // M8: a province with HQs (its placeholder page until lane MB's).
        v.company_detail
            .get()
            .companies
            .first()
            .map(|c| PageRef::Province(c.hq_province)),
        Some(PageRef::Zones),
        first(|p| matches!(p, PageRef::Zone(_))),
        Some(PageRef::Exchanges),
        first(|p| matches!(p, PageRef::Exchange(_))),
        Some(PageRef::Events),
        first(|p| matches!(p, PageRef::Event(_))),
        Some(PageRef::Recap(quarter)),
        Some(PageRef::News),
        headline(v),
        // A quarter with no recap yet, and one before the game (lane B2's notes).
        Some(PageRef::Recap(quarter.next())),
        Some(PageRef::Recap(quarter.prev())),
        Some(PageRef::Settings),
        // Last: the workspace starts on it, so first would open nothing.
        Some(PageRef::World),
    ]
    .into_iter()
    .flatten()
    .collect()
}

/// The newest headline's page, if the feed has one.
fn headline(v: &Views) -> Option<PageRef> {
    v.news
        .get()
        .feed
        .iter()
        .next()
        .map(|h| PageRef::Headline(h.id))
}

/// The late items: a fired startup event, a headline and a company born in play, as a
/// fresh world has none of them.
fn late_items(v: &Views, index: &NameIndex) -> Vec<Item> {
    let event = index
        .entries()
        .iter()
        .map(|e| e.page.clone())
        .find(|p| matches!(p, PageRef::Event(_)));
    let born = v
        .births
        .get()
        .births
        .first()
        .map(|b| PageRef::Company(b.id));
    [event, headline(v), born]
        .into_iter()
        .flatten()
        .map(|p| Item::Page(p, None))
        .collect()
}

#[allow(clippy::too_many_arguments)]
fn send_next(
    mut b: ResMut<PageBench>,
    views: Res<Views>,
    index: Res<NameIndex>,
    mut cfg: ResMut<crate::config::UiConfig>,
    mut open: MessageWriter<OpenPage>,
    mut pdb: MessageWriter<OpenPdoomberg>,
    mut sim: MessageWriter<SimControl>,
    mut modes: MessageWriter<MapModeInput>,
    mut exit: MessageWriter<AppExit>,
) {
    b.frame += 1;
    if b.frame < WARMUP_FRAMES || b.sent.is_some() {
        return;
    }
    match b.stage {
        Stage::Fresh if b.pages.is_empty() => {
            b.pages = fresh_items(&views, &index);
            b.listed = views
                .company_rows
                .get()
                .rows
                .iter()
                .filter(|r| r.public)
                .map(|r| r.id)
                .collect();
        }
        Stage::Advance(since) => {
            let ready = !views.births.get().events.is_empty() && headline(&views).is_some();
            if ready || b.frame - since > ADVANCE_FRAMES_MAX {
                sim.write(SimControl(Control::Pause));
                b.stage = Stage::Settle(b.frame + SETTLE_FRAMES);
            } else if views.clock().paused {
                sim.write(SimControl(Control::SetSpeed(sim::time::control::MAX_SPEED)));
            }
            return;
        }
        Stage::Settle(at) => {
            if b.frame < at {
                return;
            }
            b.pages = late_items(&views, &index);
            b.late_date = Some(views.clock().date);
            b.i = 0;
            b.pass = 0;
            b.stage = Stage::Late;
            if b.pages.is_empty() {
                // Nothing to time later (no event, headline or birth came): report what is
                // missing and fail, rather than wait for a page that never opens.
                b.stage = Stage::Done;
                report(&b.results, &b.listed, b.late_date);
                exit.write(AppExit::error());
                return;
            }
        }
        Stage::Done => return,
        _ => {}
    }
    let Some(item) = b.pages.get(b.i).cloned() else {
        return;
    };
    match item {
        // An opened page leaves the terminal (D517).
        Item::Page(page, tab) => {
            // A company page shows every section unless the entry is a tab.
            if tab.is_some() || matches!(page, PageRef::Company(_)) {
                crate::pages::doc::select_tab(
                    &mut cfg,
                    PageKind::Company,
                    crate::pages::company::SECTIONS,
                    tab.flatten(),
                );
            }
            open.write(OpenPage::focused(page));
        }
        Item::Pdb(r) => {
            pdb.write(OpenPdoomberg {
                function: r.function,
                company: r.company,
            });
        }
        Item::MapMode(m) => {
            modes.write(MapModeInput::Set(m));
        }
    }
    b.sent = Some((Instant::now(), b.frame));
}

/// Every text under `root` laid out (an empty one counts), and at least one.
fn texts_laid_out(
    root: Entity,
    children: &Query<&Children>,
    texts: &Query<(&Text, &TextLayoutInfo)>,
) -> bool {
    let mut any = false;
    let all = children.iter_descendants(root).all(|e| match texts.get(e) {
        Ok((t, info)) => {
            any = true;
            t.0.is_empty() || info.size.x > 0.0
        }
        Err(_) => true,
    });
    any && all
}

/// Every table under `root` shows its first row laid out, and every chart with data drew.
fn widgets_drawn(
    root: Entity,
    children: &Query<&Children>,
    texts: &Query<(&Text, &TextLayoutInfo)>,
    tables: &Query<&Table>,
    charts: &Query<&Chart>,
) -> bool {
    children.iter_descendants(root).all(|e| {
        let table_ok = !tables.contains(e)
            || tables.get(e).is_ok_and(|t| {
                t.model().is_empty()
                    || t.first_cell_text()
                        .and_then(|c| texts.get(c).ok())
                        .is_some_and(|(txt, info)| !txt.0.is_empty() && info.size.x > 0.0)
            });
        let chart_ok = charts
            .get(e)
            .map_or(true, |c| c.model().slots() == 0 || c.drawn_primitives() > 0);
        table_ok && chart_ok
    })
}

#[allow(clippy::too_many_arguments)]
fn check_laid_out(
    mut b: ResMut<PageBench>,
    ws: Res<Workspace>,
    frames: Query<&PaneFrame>,
    nodes: Query<&ComputedNode>,
    children: Query<&Children>,
    texts: Query<(&Text, &TextLayoutInfo)>,
    tables: Query<&Table>,
    charts: Query<&Chart>,
    pdb: Option<Res<PdoombergUi>>,
    map: MapBenchState,
    mut sim: MessageWriter<SimControl>,
    mut exit: MessageWriter<AppExit>,
) {
    if b.stage == Stage::Done {
        return;
    }
    let Some((at, sent_frame)) = b.sent else {
        return;
    };
    let item = b.pages[b.i].clone();
    let ready = match &item {
        Item::Page(page, _) => frames
            .iter()
            .find(|f| f.pane == ws.focused())
            .filter(|f| f.drawn_page() == Some(page))
            .is_some_and(|f| {
                let sized = nodes.get(f.body).is_ok_and(|n| n.size.y > 0.0);
                // Every text in the page's header slot (its first child) is laid out.
                let head = children.get(f.body).ok().and_then(|c| c.first().copied());
                let texts_done = head.is_some_and(|h| texts_laid_out(h, &children, &texts));
                sized && texts_done && widgets_drawn(f.body, &children, &texts, &tables, &charts)
            }),
        Item::Pdb(r) => pdb.as_ref().is_some_and(|ui| {
            ui.built == Some(*r)
                && nodes.get(ui.area).is_ok_and(|n| n.size.y > 0.0)
                && texts_laid_out(ui.area, &children, &texts)
                && widgets_drawn(ui.area, &children, &texts, &tables, &charts)
        }),
        Item::MapMode(m) => map.shows(*m),
    };
    let frames_taken = b.frame - sent_frame;
    if !ready && frames_taken < TIMEOUT_FRAMES {
        return;
    }
    let ms = if ready {
        at.elapsed().as_secs_f64() * 1e3
    } else {
        f64::INFINITY
    };
    let (pass, late) = (b.pass, b.stage == Stage::Late);
    b.results.push((item, late, pass, ms, frames_taken + 1));
    b.sent = None;
    b.i += 1;
    if b.i < b.pages.len() {
        return;
    }
    b.i = 0;
    b.pass += 1;
    if b.pass < 2 {
        return;
    }
    if b.pass == 2 {
        // the retry pass: pages whose cold open alone missed the target
        let late = b.stage == Stage::Late;
        let slow: Vec<Item> = b
            .pages
            .iter()
            .filter(|it| {
                let t = |pass: u8| {
                    b.results
                        .iter()
                        .find(|r| r.1 == late && r.2 == pass && &r.0 == *it)
                        .map_or(f64::INFINITY, |r| r.3)
                };
                t(0) >= TARGET_MS && t(1) < TARGET_MS
            })
            .cloned()
            .collect();
        if !slow.is_empty() {
            b.all_pages = std::mem::replace(&mut b.pages, slow);
            return;
        }
    }
    if !b.all_pages.is_empty() {
        b.pages = std::mem::take(&mut b.all_pages);
    }
    b.pass = 0;
    if b.stage == Stage::Fresh {
        // On to the first startup event and headline, at max speed with the alerts off.
        for kind in AlertKind::ALL {
            sim.write(SimControl(Control::SetAlert {
                kind,
                level: AlertLevel::Off,
            }));
        }
        sim.write(SimControl(Control::SetSpeed(sim::time::control::MAX_SPEED)));
        b.stage = Stage::Advance(b.frame);
        return;
    }
    b.stage = Stage::Done;
    let ok = report(&b.results, &b.listed, b.late_date);
    exit.write(if ok {
        AppExit::Success
    } else {
        AppExit::error()
    });
}

/// What the run covered against what M9.9 asks for: the page kinds, the Company tabs on a
/// listed and on a private company, the function pages, and F3 on a listed company, a private
/// one and none, that it never opened.
fn missing(results: &[Timing], listed: &BTreeSet<sim::world::CompanyId>) -> Vec<String> {
    let mut kinds = BTreeSet::new();
    let mut modes = BTreeSet::new();
    // (tab, listed)
    let mut tabs = BTreeSet::new();
    let mut functions = BTreeSet::new();
    // F3's company: None, Some(listed)
    let mut f3 = BTreeSet::new();
    for (item, ..) in results {
        match item {
            Item::Page(p, tab) => {
                kinds.insert(p.kind());
                if let (PageRef::Company(c), Some(Some(t))) = (p, tab) {
                    tabs.insert((*t, listed.contains(c)));
                }
            }
            Item::Pdb(r) => {
                functions.insert(r.function.code());
                if r.function == PdbFunction::F3 {
                    f3.insert(r.company.map(|c| listed.contains(&c)));
                }
            }
            Item::MapMode(m) => {
                modes.insert(crate::map::modes::ModeKind::of(*m).label());
            }
        }
    }
    let mut out: Vec<String> = PageKind::ALL
        .iter()
        .filter(|k| !kinds.contains(k))
        .map(|k| format!("page kind {}", k.key()))
        .collect();
    for (id, _) in crate::pages::company::SECTIONS {
        for (is_listed, who) in [(true, "listed"), (false, "private")] {
            if !tabs.contains(&(*id, is_listed)) {
                out.push(format!("company tab {id} on a {who} company"));
            }
        }
    }
    for (company, what) in [
        (Some(true), "a listed company"),
        (Some(false), "a private company"),
        (None, "no company"),
    ] {
        if !f3.contains(&company) {
            out.push(format!("pdoomberg F3 on {what}"));
        }
    }
    out.extend(
        PdbFunction::ALL
            .iter()
            .filter(|f| !functions.contains(f.code()))
            .map(|f| format!("pdoomberg {}", f.code())),
    );
    out.extend(
        crate::map::modes::ModeKind::ALL
            .iter()
            .filter(|k| !modes.contains(k.label()))
            .map(|k| format!("map mode {}", k.label())),
    );
    out
}

/// What a map mode switch waits for (D705): the layer of the mode fetched, the colour table
/// written from it (when the map draws: with a renderer and a map), and its pins placed.
#[derive(bevy::ecs::system::SystemParam)]
pub struct MapBenchState<'w, 's> {
    layer: Res<'w, crate::map::modes::CurrentLayer>,
    gpu: Option<Res<'w, crate::map::render::MapGpu>>,
    views: Res<'w, Views>,
    pins: Query<'w, 's, &'static crate::map::pins::PinNode>,
}

impl MapBenchState<'_, '_> {
    fn shows(&self, m: MapMode) -> bool {
        let l = &self.layer;
        let statics = self.views.map_static.get();
        let want_pins = l
            .layer
            .pins
            .iter()
            .filter(|p| statics.shape(p.province).is_some())
            .count();
        l.layer.mode == m
            && self
                .gpu
                .as_ref()
                .is_none_or(|g| g.colors_generation() == Some(l.generation))
            && self.pins.iter().count() == want_pins
    }
}

/// Prints the table and the verdict; true when every page opened under the target and every
/// kind, tab and function page was covered.
fn report(
    results: &[Timing],
    listed: &BTreeSet<sim::world::CompanyId>,
    late_date: Option<sim::time::Date>,
) -> bool {
    println!("BENCH pages: open in the focused pane, to the first laid-out frame");
    println!(
        "BENCH {:<40} {:>9} {:>7} {:>9} {:>7}",
        "page", "cold ms", "frames", "warm ms", "frames"
    );
    let mut worst: f64 = 0.0;
    let mut over = Vec::new();
    for late in [false, true] {
        let cold: Vec<_> = results.iter().filter(|r| r.1 == late && r.2 == 0).collect();
        if late && !cold.is_empty() {
            println!(
                "BENCH -- later, on {}: the kinds a fresh world has none of",
                late_date.map_or("?".into(), crate::table::format::date)
            );
        }
        for c in cold {
            let w = results
                .iter()
                .find(|r| r.1 == late && r.2 == 1 && r.0 == c.0);
            let (wm, wf) = w.map_or((f64::INFINITY, 0), |w| (w.3, w.4));
            let retry = results
                .iter()
                .find(|r| r.1 == late && r.2 == 2 && r.0 == c.0)
                .map(|r| r.3);
            if let Some(again) = retry {
                println!(
                    "BENCH retried {}: cold {:.2} ms, again {again:.2} ms",
                    c.0.name(),
                    c.3
                );
            }
            let page_worst = c.3.min(retry.unwrap_or(f64::INFINITY)).max(wm);
            worst = worst.max(page_worst);
            if page_worst >= TARGET_MS {
                over.push(c.0.name());
            }
            println!(
                "BENCH {:<40} {:>9.2} {:>7} {:>9.2} {:>7}",
                c.0.name(),
                c.3,
                c.4,
                wm,
                wf
            );
        }
    }
    let missing = missing(results, listed);
    for m in &missing {
        println!("BENCH not covered: {m}");
    }
    for o in &over {
        println!("BENCH over the target (or timed out): {o}");
    }
    let opened = results.iter().filter(|r| r.2 == 0).count();
    let ok = over.is_empty() && missing.is_empty();
    println!(
        "BENCH pages {opened} opened, worst {worst:.2} ms: {} (target < {TARGET_MS} ms)",
        if ok { "PASS" } else { "FAIL" }
    );
    ok
}
