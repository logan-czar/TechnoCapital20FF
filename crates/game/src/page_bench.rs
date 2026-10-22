//! The page timing smoke test (M9 A2 task 9; the M9.9 harness's first cut; D459): `--bench-pages`
//! opens one page of every kind in the focused pane, from an [`OpenPage`] message, and times it
//! to the first frame whose layout has the page: the pane drew it, its body has a size, every
//! text of its header is laid out, every table on it shows its first row's text laid out (the
//! pool sizes itself from the body's laid-out height, so that is a frame or two later), and
//! every chart with data has drawn. Each page opens twice: cold (its first build, font
//! glyphs new) and warm. Then it opens every Pdoomberg function page (M9.4, lane B2) from an
//! [`OpenPdoomberg`] message, timed the same way over the terminal's page area. Prints a table
//! and exits; the target is under 100 ms in a release build on a fresh 2020 world.

use std::time::Instant;

use bevy::prelude::*;
use bevy::text::TextLayoutInfo;
use sim::finance::distress::CompanyStatus;

use crate::bridge::Views;
use crate::chart::Chart;
use crate::command::index::NameIndex;
use crate::pages::{OpenPdoomberg, PageRef, PdbFunction, PdoombergRoute};
use crate::pdoomberg::PdoombergUi;
use crate::table::Table;
use crate::workspace::{OpenPage, PaneFrame, Workspace, WorkspaceInput};

/// Frames before the first page (pipelines and the font atlas warm up).
pub const WARMUP_FRAMES: u64 = 90;
/// Frames a page may take before it counts as timed out.
pub const TIMEOUT_FRAMES: u64 = 240;
/// The target (spec 10 M9: every screen opens in under 100 ms).
pub const TARGET_MS: f64 = 100.0;

/// One thing the bench opens: a workspace page or a Pdoomberg function page.
#[derive(Debug, Clone, PartialEq)]
enum Item {
    Page(PageRef, Tab),
    Pdb(PdoombergRoute),
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
        }
    }
}

#[derive(Resource, Default)]
struct PageBench {
    frame: u64,
    pages: Vec<Item>,
    i: usize,
    pass: u8,
    sent: Option<(Instant, u64)>,
    results: Vec<(Item, u8, f64, u64)>,
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

/// One page of each kind, picked from the views of the world as it is, and each Company tab
/// (lane B1), then every Pdoomberg function page (F3 on a listed company). The terminal builds
/// no page before its first open (D520), so F2's cold number is a real build.
fn pick_items(v: &Views, index: &NameIndex) -> Vec<Item> {
    let listed = v
        .company_rows
        .get()
        .rows
        .iter()
        .find(|r| r.public && r.status == CompanyStatus::Active)
        .map(|r| r.id);
    let mut out: Vec<Item> = pick_pages(v, index)
        .into_iter()
        .map(|(p, tab)| Item::Page(p, tab))
        .collect();
    for f in PdbFunction::ALL {
        out.push(Item::Pdb(PdoombergRoute {
            function: f,
            company: if f == PdbFunction::F3 { listed } else { None },
        }));
    }
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
            .find(|r| r.public == public && r.status == CompanyStatus::Active)
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

/// One page of each kind.
fn pages_of_each_kind(v: &Views, index: &NameIndex) -> Vec<PageRef> {
    let rows = &v.company_rows.get().rows;
    let listed = rows
        .iter()
        .find(|r| r.public && r.status == CompanyStatus::Active)
        .map(|r| PageRef::Company(r.id));
    let private = rows
        .iter()
        .find(|r| !r.public && r.status == CompanyStatus::Active)
        .map(|r| PageRef::Company(r.id));
    let first = |f: fn(&PageRef) -> bool| index.entries().iter().map(|e| e.page.clone()).find(&f);
    let headline = v
        .news
        .get()
        .feed
        .iter()
        .next()
        .map(|h| PageRef::Headline { date: h.date, n: 0 });
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
        Some(PageRef::Zones),
        first(|p| matches!(p, PageRef::Zone(_))),
        Some(PageRef::Exchanges),
        first(|p| matches!(p, PageRef::Exchange(_))),
        Some(PageRef::Events),
        first(|p| matches!(p, PageRef::Event(_))),
        Some(PageRef::Recap(v.clock().date.quarter())),
        Some(PageRef::News),
        headline,
        // A quarter with no recap and one before the game (lane B2's notes).
        Some(PageRef::Recap(v.clock().date.quarter().next())),
        Some(PageRef::Settings),
        // Last: the workspace starts on it, so first would open nothing.
        Some(PageRef::World),
    ]
    .into_iter()
    .flatten()
    .collect()
}

fn send_next(
    mut b: ResMut<PageBench>,
    views: Res<Views>,
    index: Res<NameIndex>,
    mut cfg: ResMut<crate::config::UiConfig>,
    mut open: MessageWriter<OpenPage>,
    mut pdb: MessageWriter<OpenPdoomberg>,
) {
    b.frame += 1;
    if b.frame < WARMUP_FRAMES || b.sent.is_some() {
        return;
    }
    if b.pages.is_empty() {
        b.pages = pick_items(&views, &index);
    }
    let Some(item) = b.pages.get(b.i).cloned() else {
        return;
    };
    match item {
        // An opened page leaves the terminal (D517).
        Item::Page(page, tab) => {
            if let Some(tab) = tab {
                crate::pages::doc::select_tab(
                    &mut cfg,
                    crate::pages::PageKind::Company,
                    crate::pages::company::SECTIONS,
                    tab,
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
    mut exit: MessageWriter<AppExit>,
) {
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
    let pass = b.pass;
    b.results.push((item, pass, ms, frames_taken + 1));
    b.sent = None;
    b.i += 1;
    if b.i == b.pages.len() {
        b.i = 0;
        b.pass += 1;
        if b.pass == 2 {
            report(&b.results);
            exit.write(AppExit::Success);
        }
    }
}

fn report(results: &[(Item, u8, f64, u64)]) {
    println!("BENCH pages: open in the focused pane, to the first laid-out frame");
    println!(
        "BENCH {:<34} {:>9} {:>7} {:>9} {:>7}",
        "page", "cold ms", "frames", "warm ms", "frames"
    );
    let cold: Vec<_> = results.iter().filter(|r| r.1 == 0).collect();
    let mut worst: f64 = 0.0;
    for c in &cold {
        let w = results.iter().find(|r| r.1 == 1 && r.0 == c.0);
        let (wm, wf) = w.map_or((f64::NAN, 0), |w| (w.2, w.3));
        worst = worst.max(c.2).max(wm);
        println!(
            "BENCH {:<34} {:>9.2} {:>7} {:>9.2} {:>7}",
            c.0.name(),
            c.2,
            c.3,
            wm,
            wf
        );
    }
    println!(
        "BENCH pages worst {worst:.2} ms: {} (target < {TARGET_MS} ms)",
        if worst < TARGET_MS { "PASS" } else { "OVER" }
    );
}
