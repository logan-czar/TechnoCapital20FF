//! The page timing smoke test (M9 A2 task 9; the M9.9 harness's first cut; D459): `--bench-pages`
//! opens one page of every kind in the focused pane, from an [`OpenPage`] message, and times it
//! to the first frame whose layout has the page: the pane drew it, its body has a size, every
//! text of its header is laid out, every table on it shows its first row's text laid out (the
//! pool sizes itself from the body's laid-out height, so that is a frame or two later), and
//! every chart with data has drawn. Each page opens twice: cold (its first build, font
//! glyphs new) and warm. Prints a table and exits; the target is under 100 ms in a release
//! build on a fresh 2020 world.

use std::time::Instant;

use bevy::prelude::*;
use bevy::text::TextLayoutInfo;
use sim::finance::distress::CompanyStatus;

use crate::bridge::Views;
use crate::chart::Chart;
use crate::command::index::NameIndex;
use crate::pages::PageRef;
use crate::table::Table;
use crate::workspace::{OpenPage, PaneFrame, Workspace, WorkspaceInput};

/// Frames before the first page (pipelines and the font atlas warm up).
pub const WARMUP_FRAMES: u64 = 90;
/// Frames a page may take before it counts as timed out.
pub const TIMEOUT_FRAMES: u64 = 240;
/// The target (spec 10 M9: every screen opens in under 100 ms).
pub const TARGET_MS: f64 = 100.0;

#[derive(Resource, Default)]
struct PageBench {
    frame: u64,
    pages: Vec<PageRef>,
    i: usize,
    pass: u8,
    sent: Option<(Instant, u64)>,
    results: Vec<(PageRef, u8, f64, u64)>,
}

pub struct PageBenchPlugin;

impl Plugin for PageBenchPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<PageBench>()
            .add_systems(Update, send_next.before(WorkspaceInput))
            .add_systems(Last, check_laid_out);
    }
}

/// One page of each kind, picked from the views of the world as it is.
fn pick_pages(v: &Views, index: &NameIndex) -> Vec<PageRef> {
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
    mut open: MessageWriter<OpenPage>,
) {
    b.frame += 1;
    if b.frame < WARMUP_FRAMES || b.sent.is_some() {
        return;
    }
    if b.pages.is_empty() {
        b.pages = pick_pages(&views, &index);
    }
    let Some(page) = b.pages.get(b.i).cloned() else {
        return;
    };
    open.write(OpenPage::focused(page));
    b.sent = Some((Instant::now(), b.frame));
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
    mut exit: MessageWriter<AppExit>,
) {
    let Some((at, sent_frame)) = b.sent else {
        return;
    };
    let page = b.pages[b.i].clone();
    let ready = frames
        .iter()
        .find(|f| f.pane == ws.focused())
        .filter(|f| f.drawn_page() == Some(&page))
        .is_some_and(|f| {
            let sized = nodes.get(f.body).is_ok_and(|n| n.size.y > 0.0);
            // Every text in the page's header slot (its first child) is laid out.
            let head = children.get(f.body).ok().and_then(|c| c.first().copied());
            let texts_done = head.is_some_and(|h| {
                let mut any = false;
                let all = children.iter_descendants(h).all(|e| match texts.get(e) {
                    Ok((t, info)) => {
                        any = true;
                        t.0.is_empty() || info.size.x > 0.0
                    }
                    Err(_) => true,
                });
                any && all
            });
            // Every table shows its first row's text laid out, and every chart has drawn.
            let widgets_done = children.iter_descendants(f.body).all(|e| {
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
            });
            sized && texts_done && widgets_done
        });
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
    b.results.push((page, pass, ms, frames_taken + 1));
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

fn report(results: &[(PageRef, u8, f64, u64)]) {
    println!("BENCH pages: open in the focused pane, to the first laid-out frame");
    println!(
        "BENCH {:<28} {:>9} {:>7} {:>9} {:>7}",
        "page", "cold ms", "frames", "warm ms", "frames"
    );
    let cold: Vec<_> = results.iter().filter(|r| r.1 == 0).collect();
    let mut worst: f64 = 0.0;
    for c in &cold {
        let w = results.iter().find(|r| r.1 == 1 && r.0 == c.0);
        let (wm, wf) = w.map_or((f64::NAN, 0), |w| (w.2, w.3));
        worst = worst.max(c.2).max(wm);
        println!(
            "BENCH {:<28} {:>9.2} {:>7} {:>9.2} {:>7}",
            c.0.key(),
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
