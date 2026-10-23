//! Release-build benches (D14; build-plan M7.1, M7.7, 4.5), printed to stdout:
//!
//! - `--bench-table [seconds]`: the real company table (Pdoomberg's F10 Screener over
//!   v_company_row, full screen) auto-scrolls every frame and re-sorts by the next column every
//!   [`SORT_EVERY`] frames; prints frame time p50, p95 and max, the frames that sorted, and the
//!   sort times. `--rows N` repeats its rows to N.
//! - `--bench-max [seconds]`: the sim at max speed (alerts off) with the shell drawing; prints
//!   frame times and game hours per second, to show the window stays responsive.
//!
//! - `--bench-map [seconds]` (M8; D639, D742): the map behind dense panes: Pdoomberg's F10
//!   Screener opened and closed (its page held behind, D520), then four panes in three windows
//!   (Companies and Industries side by side, a company page, and the
//!   Province page of the province with the most HQs and units); the camera pans every frame
//!   and zooms in and out through the World, Country and Province levels while the hover point
//!   moves; prints frame times overall and at each zoom level. It draws the repository's map
//!   (`assets/map`) unless `--map-dir` or `--synthetic-map` names another. The sim stays
//!   paused unless `--bench-map-running [SPEED]` runs it (speed 1 to 5, default 5, the max;
//!   alerts off), so the panes' rebuilds and the colour table's rewrites are measured too
//!   (D744); either way it lists the slowest frames with what moved in them.
//!   `--bench-map-panes SET` opens all four panes (the default), none, only Companies and
//!   Industries (`lists`), only the company page or only the Province page (D778). It also
//!   reports the frame less its sim stepping, the stepping and the longest tick a frame, the
//!   ticks of each kind, and whether the window had the focus. It is a check: it exits with
//!   an error when the p99 frame is 16.7 ms or more (one 60 fps frame, `MAP_TARGET_P99_MS`),
//!   and warns when the OS paced the window's presents at 60 Hz. Built with `--features profile`
//!   it also prints what the frames did (nodes spawned and changed, page rebuilds and patches,
//!   live writes) and the spans that cost the most, overall and in the slowest frames (D770).
//!
//! All run without vsync so the frame times are the real cost, then exit.

use std::time::Instant;

use bevy::prelude::*;
use sim::Control;
use sim::world::{AlertKind, AlertLevel};

use std::sync::Arc;

use crate::bridge::{SimControl, SimRate, Views};
use crate::pages::{OpenPdoomberg, PdbFunction};
use crate::pdoomberg::PdoombergUi;
use crate::table::{Table, TableSystems};
use crate::ui::ShellLayout;

/// Frames skipped before measuring (pipeline and font atlas warm-up).
pub const WARMUP_FRAMES: u32 = 120;
/// Frames between re-sorts in the table bench.
pub const SORT_EVERY: u64 = 10;
/// Rows scrolled per frame in the table bench.
pub const SCROLL_PER_FRAME: isize = 3;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BenchMode {
    Table {
        seconds: f64,
        /// Repeat the table's rows to this many.
        rows: Option<usize>,
    },
    Max {
        seconds: f64,
    },
    /// The map behind panes, panning and zooming ([`drive_map`]), in a map mode (M8.5) and
    /// with the Metro outlines if asked.
    Map {
        seconds: f64,
        mode: sim::views::map_layers::MapMode,
        metros: bool,
        /// The sim's speed while it measures (1 to 5; 0 paused), alerts off (D744).
        speed: u8,
        /// The panes it opens (D778).
        panes: MapPanes,
    },
    /// Open every page kind and time it to its first laid-out frame
    /// ([`crate::page_bench`]).
    Pages,
}

impl BenchMode {
    fn seconds(self) -> f64 {
        match self {
            BenchMode::Table { seconds, .. }
            | BenchMode::Max { seconds }
            | BenchMode::Map { seconds, .. } => seconds,
            BenchMode::Pages => f64::INFINITY,
        }
    }
}

/// Which panes the map bench opens (`--bench-map-panes`, D778): all four (the check's set,
/// D742), none, only Companies and Industries, only the company page, or only the Province
/// page. Pdoomberg's F10 is opened and closed (held behind) in every set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum MapPanes {
    #[default]
    All,
    None,
    Lists,
    Company,
    Province,
}

impl MapPanes {
    pub fn parse(s: &str) -> Option<MapPanes> {
        Some(match s {
            "all" => MapPanes::All,
            "none" => MapPanes::None,
            "lists" => MapPanes::Lists,
            "company" => MapPanes::Company,
            "province" => MapPanes::Province,
            _ => return None,
        })
    }

    fn lists(self) -> bool {
        matches!(self, MapPanes::All | MapPanes::Lists)
    }

    fn company(self) -> bool {
        matches!(self, MapPanes::All | MapPanes::Company)
    }

    fn province(self) -> bool {
        matches!(self, MapPanes::All | MapPanes::Province)
    }
}

/// The map bench's pass mark (D778): its p99 frame time must stay under one 60 fps frame.
pub const MAP_TARGET_P99_MS: f64 = 1000.0 / 60.0;

/// The share of frames between [`OS_PACED_MS`]'s bounds past which a map bench warns that the
/// OS paced the window's presents at 60 Hz (D744): the run measured the pacing, not the game.
pub const OS_PACED_SHARE: f64 = 0.3;
pub const OS_PACED_MS: (f64, f64) = (16.3, 17.0);

#[derive(Resource)]
struct Bench {
    mode: BenchMode,
    frame: u64,
    last: Option<Instant>,
    start: Option<Instant>,
    start_steps: u64,
    frames_ms: Vec<f64>,
    sort_frames_ms: Vec<f64>,
    sorts_ms: Vec<f64>,
    /// Frames left whose time counts as a sort frame.
    sort_window: u8,
    next_col: usize,
    /// The rows were repeated to the asked count.
    repeated: bool,
    /// Measured frame times at each map zoom level (World, Country, Province), by the level
    /// the frame drew at.
    level_ms: [Vec<f64>; 3],
    /// The zoom level the map bench drove the last frame at.
    last_level: Option<usize>,
    /// v_company_row's version (the monthly views the pages rebuild on move with it) and the
    /// colour table's layer generation at the last frame start, to tell which frames rebuilt
    /// the pages' monthly views or rewrote the table.
    last_monthly: u64,
    last_colors: Option<u64>,
    /// Every measured map frame: its time, number, zoom level, and whether the monthly views
    /// moved or the colour table was rewritten in it.
    map_frames: Vec<MapFrame>,
    /// Per-frame work counts of the measured map frames (D770).
    work: WorkTotals,
    /// Each measured frame's sim stepping time and its longest tick (ms).
    step_ms: Vec<f64>,
    tick_ms: Vec<f64>,
    /// Measured frames the window had the OS focus in (an unfocused window may have its
    /// presents paced, D744, D778).
    focused_frames: u64,
    /// With the `profile` feature: what each measured frame did, by frame number.
    frame_work: std::collections::BTreeMap<u64, String>,
}

/// What the measured frames of the map bench did, summed (D770): UI nodes spawned, nodes and
/// texts changed (what layout and text relayout work from), entities alive, and the pages'
/// [`crate::pages::PageStats`].
#[derive(Debug, Clone, Default)]
struct WorkTotals {
    frames: u64,
    nodes_added: u64,
    nodes_changed: u64,
    texts_changed: u64,
    entities: u64,
    pages: crate::pages::PageStats,
}

/// One measured frame of the map bench.
#[derive(Debug, Clone, Copy)]
struct MapFrame {
    ms: f64,
    frame: u64,
    level: Option<usize>,
    monthly: bool,
    colors: bool,
}

/// The spans the map bench lists with the `profile` feature (D770).
pub const PROFILE_SPANS_SHOWN: usize = 45;

/// Counts what each measured map frame did (D770); runs in `Last`, so its change filters see
/// the whole frame's `Update` and `PostUpdate`.
#[allow(clippy::type_complexity)]
fn count_work(
    mut b: ResMut<Bench>,
    added: Query<(), Added<Node>>,
    changed: Query<(), Changed<Node>>,
    texts: Query<(), Changed<Text>>,
    entities: &bevy::ecs::entity::Entities,
    mut stats: ResMut<crate::pages::PageStats>,
) {
    let taken = std::mem::take(&mut *stats);
    if b.start.is_none() {
        return;
    }
    let (n_added, n_changed, n_texts) = (
        added.iter().count() as u64,
        changed.iter().count() as u64,
        texts.iter().count() as u64,
    );
    let summary = format!(
        "{n_added} spawned, {n_changed} nodes and {n_texts} texts changed; builds {:?}, spans {}, Live {}, charts {}, tables {}, chart nodes {}",
        taken.builds,
        taken.span_writes,
        taken.live_sets,
        taken.chart_sets,
        taken.table_sets,
        taken.chart_prim_writes
    );
    let frame = b.frame;
    b.frame_work.insert(frame, summary);
    let w = &mut b.work;
    w.frames += 1;
    w.nodes_added += n_added;
    w.nodes_changed += n_changed;
    w.texts_changed += n_texts;
    w.entities += u64::from(entities.len());
    let p = &mut w.pages;
    for (k, n) in taken.builds {
        *p.builds.entry(k).or_default() += n;
    }
    p.span_writes += taken.span_writes;
    p.span_checks += taken.span_checks;
    p.live_makes += taken.live_makes;
    p.live_sets += taken.live_sets;
    p.chart_sets += taken.chart_sets;
    p.table_sets += taken.table_sets;
    p.chart_draws += taken.chart_draws;
    p.chart_prim_writes += taken.chart_prim_writes;
}

fn report_work(w: &WorkTotals) {
    let n = w.frames.max(1) as f64;
    let f = |x: u64| x as f64 / n;
    let p = &w.pages;
    println!(
        "BENCH work per frame ({} frames): {:.0} entities, {:.1} UI nodes spawned, {:.1} nodes changed (Changed<Node>, spawns included), {:.1} texts changed",
        w.frames,
        f(w.entities),
        f(w.nodes_added),
        f(w.nodes_changed),
        f(w.texts_changed)
    );
    let builds: Vec<String> = p
        .builds
        .iter()
        .map(|(k, x)| format!("{k} {:.3}", f(*x)))
        .collect();
    println!(
        "BENCH work per frame: page rebuilds [{}]; live spans {:.1} made, {:.1} written; Live widgets {:.2} made, {:.2} set; live charts {:.3} set, live tables {:.3} set; chart redraws {:.3}, {:.1} chart nodes written",
        builds.join(", "),
        f(p.span_checks),
        f(p.span_writes),
        f(p.live_makes),
        f(p.live_sets),
        f(p.chart_sets),
        f(p.table_sets),
        f(p.chart_draws),
        f(p.chart_prim_writes)
    );
}

/// The slowest frames the map bench lists.
pub const MAP_SLOWEST_SHOWN: usize = 8;

pub struct BenchPlugin(pub BenchMode);

impl Plugin for BenchPlugin {
    fn build(&self, app: &mut App) {
        if self.0 == BenchMode::Pages {
            app.add_plugins(crate::page_bench::PageBenchPlugin);
            return;
        }
        app.insert_resource(Bench {
            mode: self.0,
            frame: 0,
            last: None,
            start: None,
            start_steps: 0,
            frames_ms: Vec::new(),
            sort_frames_ms: Vec::new(),
            sorts_ms: Vec::new(),
            sort_window: 0,
            next_col: 0,
            repeated: false,
            level_ms: Default::default(),
            last_level: None,
            last_monthly: 0,
            last_colors: None,
            map_frames: Vec::new(),
            work: WorkTotals::default(),
            step_ms: Vec::new(),
            tick_ms: Vec::new(),
            frame_work: Default::default(),
            focused_frames: 0,
        })
        .add_systems(First, measure)
        .add_systems(Update, drive.before(TableSystems));
        match self.0 {
            BenchMode::Max { .. } => {
                app.add_systems(Startup, max_speed);
            }
            BenchMode::Table { .. } => {
                app.add_systems(Startup, open_screener);
            }
            BenchMode::Map { .. } => {
                app.add_systems(
                    Update,
                    drive_map
                        .in_set(crate::ui::UiSystems::Input)
                        .before(crate::workspace::WorkspaceInput),
                );
                // The work counts walk every UI node, so only a profiling build pays for them.
                if cfg!(feature = "profile") {
                    app.add_systems(Last, count_work);
                }
            }
            BenchMode::Pages => {}
        }
    }
}

fn max_speed(mut w: MessageWriter<SimControl>) {
    for kind in AlertKind::ALL {
        w.write(SimControl(Control::SetAlert {
            kind,
            level: AlertLevel::Off,
        }));
    }
    w.write(SimControl(Control::SetSpeed(sim::time::control::MAX_SPEED)));
}

/// The table bench's table: Pdoomberg F10, every company from v_company_row.
fn open_screener(mut w: MessageWriter<OpenPdoomberg>) {
    w.write(OpenPdoomberg {
        function: PdbFunction::F10,
        company: None,
    });
}

/// The laid-out size of the shell's areas and the bench table, so a bench run also shows the
/// layout is sane (no window screenshots in this setup).
fn report_layout(
    layout: &ShellLayout,
    tables: Option<&PdoombergUi>,
    nodes: &Query<&ComputedNode>,
    children: &Query<&Children>,
    table_q: &Query<&mut Table>,
) {
    let size = |e: Entity| {
        nodes
            .get(e)
            .map(|n| n.size * n.inverse_scale_factor)
            .unwrap_or_default()
    };
    for (name, e) in [
        ("top bar", layout.top_bar),
        ("rail", layout.rail),
        ("main", layout.main),
        ("outliner", layout.outliner),
    ] {
        let s = size(e);
        println!("BENCH layout {name}: {:.0} x {:.0}", s.x, s.y);
    }
    let parts: Vec<String> = children
        .get(layout.top_bar)
        .map(|c| c.iter().map(|e| format!("{:.0}", size(e).x)).collect())
        .unwrap_or_default();
    println!("BENCH layout top bar items (px): {}", parts.join(" "));
    if let Some(t) = tables
        .and_then(|t| t.main_table)
        .and_then(|e| table_q.get(e).ok())
    {
        println!(
            "BENCH table: {} rows, pool {} rows, {} visible",
            t.model().len(),
            t.pool_len(),
            t.visible_rows()
        );
    }
}

#[allow(clippy::too_many_arguments)]
fn measure(
    mut b: ResMut<Bench>,
    rate: Res<SimRate>,
    views: Res<Views>,
    layout: Res<ShellLayout>,
    tables: Option<Res<PdoombergUi>>,
    nodes: Query<&ComputedNode>,
    children: Query<&Children>,
    table_q: Query<&mut Table>,
    gpu: Option<Res<crate::map::render::MapGpu>>,
    window: Query<&Window, With<bevy::window::PrimaryWindow>>,
    mut exit: MessageWriter<AppExit>,
) {
    let now = Instant::now();
    b.frame += 1;
    // What the frame just ended moved: the monthly views (the open pages rebuild on them), the
    // colour table.
    let monthly = views.company_rows.version();
    let colors = gpu.and_then(|g| g.colors_generation());
    let moved = (monthly != b.last_monthly, colors != b.last_colors);
    b.last_monthly = monthly;
    b.last_colors = colors;
    if let Some(last) = b.last
        && b.frame > u64::from(WARMUP_FRAMES)
    {
        let ms = now.duration_since(last).as_secs_f64() * 1e3;
        crate::profile::end_frame(b.frame - 1, ms);
        b.focused_frames += u64::from(window.single().is_ok_and(|w| w.focused));
        b.frames_ms.push(ms);
        b.step_ms
            .push(rate.step_time_last_frame.as_secs_f64() * 1e3);
        b.tick_ms
            .push(rate.longest_tick_last_frame.as_secs_f64() * 1e3);
        if let Some(l) = b.last_level {
            b.level_ms[l].push(ms);
        }
        if let BenchMode::Map { .. } = b.mode {
            let (frame, level) = (b.frame - 1, b.last_level);
            b.map_frames.push(MapFrame {
                ms,
                frame,
                level,
                monthly: moved.0,
                colors: moved.1,
            });
        }
        if b.sort_window > 0 {
            b.sort_window -= 1;
            b.sort_frames_ms.push(ms);
        }
    }
    b.last = Some(now);
    if b.frame == u64::from(WARMUP_FRAMES) {
        b.start = Some(now);
        b.start_steps = rate.total_steps;
        crate::profile::reset();
    }
    let Some(start) = b.start else {
        return;
    };
    let elapsed = now.duration_since(start).as_secs_f64();
    if elapsed < b.mode.seconds() {
        return;
    }
    println!("BENCH {:?}", b.mode);
    report_layout(&layout, tables.as_deref(), &nodes, &children, &table_q);
    println!(
        "BENCH frames {} over {:.1} s: {:.1} fps",
        b.frames_ms.len(),
        elapsed,
        b.frames_ms.len() as f64 / elapsed
    );
    // Paired before the frame times are sorted: the frame less its sim stepping is what the
    // UI, the map and the render cost (D770).
    let mut less_sim: Vec<f64> = b
        .frames_ms
        .iter()
        .zip(&b.step_ms)
        .map(|(f, s)| f - s)
        .collect();
    report("frame ms", &mut b.frames_ms);
    let map_failed = if let BenchMode::Map { .. } = b.mode {
        let v = &b.frames_ms;
        let p99 = if v.is_empty() {
            f64::INFINITY
        } else {
            v[((v.len() - 1) as f64 * 0.99).round() as usize]
        };
        let paced = v
            .iter()
            .filter(|&&x| x >= OS_PACED_MS.0 && x <= OS_PACED_MS.1)
            .count() as f64
            / v.len().max(1) as f64;
        println!(
            "BENCH map: the window had the focus in {:.0}% of the frames",
            b.focused_frames as f64 * 100.0 / v.len().max(1) as f64
        );
        if paced >= OS_PACED_SHARE {
            println!(
                "BENCH WARN {:.0}% of the frames took 16.3 to 17.0 ms: the OS paced the window's presents at 60 Hz (D744); rerun with the window in front",
                paced * 100.0
            );
        }
        let ok = p99 < MAP_TARGET_P99_MS;
        println!(
            "BENCH map check: p99 {p99:.2} ms: {} (target < {MAP_TARGET_P99_MS:.1} ms)",
            if ok { "PASS" } else { "FAIL" }
        );
        !ok
    } else {
        false
    };
    if let BenchMode::Map { .. } = b.mode {
        let n = |i: usize| b.level_ms[i].len();
        println!(
            "BENCH map: frames at World {}, Country {}, Province {}",
            n(0),
            n(1),
            n(2)
        );
        const LEVELS: [&str; 3] = ["World", "Country", "Province"];
        for (i, name) in LEVELS.into_iter().enumerate() {
            let mut v = std::mem::take(&mut b.level_ms[i]);
            report(&format!("frame ms at {name} zoom"), &mut v);
        }
        for k in crate::bridge::TickKind::ALL {
            let (n, total, max) = rate.by_kind[k as usize];
            println!(
                "BENCH ticks {}: {n}, mean {:.3} ms, longest {:.2} ms",
                k.name(),
                total.as_secs_f64() * 1e3 / n.max(1) as f64,
                max.as_secs_f64() * 1e3
            );
        }
        report("frame ms less the sim's stepping", &mut less_sim);
        let mut v = std::mem::take(&mut b.step_ms);
        report("sim stepping ms a frame", &mut v);
        let mut v = std::mem::take(&mut b.tick_ms);
        report("longest tick ms a frame", &mut v);
        let f = &b.map_frames;
        let (with_views, with_colors) = (
            f.iter().filter(|x| x.monthly).count(),
            f.iter().filter(|x| x.colors).count(),
        );
        println!(
            "BENCH map: {with_views} frames rebuilt the monthly views, {with_colors} rewrote the colour table"
        );
        for (name, keep) in [
            ("frames that rebuilt the monthly views", true),
            ("frames that did not", false),
        ] {
            let mut v: Vec<f64> = f
                .iter()
                .filter(|x| x.monthly == keep)
                .map(|x| x.ms)
                .collect();
            report(&format!("frame ms, {name}"), &mut v);
        }
        if b.work.frames > 0 {
            report_work(&b.work);
        }
        crate::profile::report(b.frames_ms.len(), PROFILE_SPANS_SHOWN);
        crate::profile::report_slowest(MAP_SLOWEST_SHOWN);
        let mut slow = b.map_frames.clone();
        slow.sort_by(|a, b| b.ms.total_cmp(&a.ms));
        for x in slow.iter().take(MAP_SLOWEST_SHOWN) {
            if let Some(w) = b.frame_work.get(&x.frame) {
                println!("BENCH slow frame {} work: {w}", x.frame);
            }
        }
        let mut slow = f.clone();
        slow.sort_by(|a, b| b.ms.total_cmp(&a.ms));
        for x in slow.iter().take(MAP_SLOWEST_SHOWN) {
            println!(
                "BENCH map slow frame {}: {:.2} ms at {} zoom{}{}",
                x.frame,
                x.ms,
                x.level.map_or("unknown", |l| LEVELS[l]),
                if x.monthly {
                    ", monthly views rebuilt"
                } else {
                    ""
                },
                if x.colors {
                    ", colour table rewritten"
                } else {
                    ""
                },
            );
        }
    }
    if let BenchMode::Table { .. } = b.mode {
        let mut s = std::mem::take(&mut b.sort_frames_ms);
        report("sort-frame ms (the frame that sorted and the next)", &mut s);
        let mut s = std::mem::take(&mut b.sorts_ms);
        report("sort ms", &mut s);
    } else {
        let hours = rate.total_steps - b.start_steps;
        println!(
            "BENCH sim: {hours} ticks, {:.0} game hours per second, reached {} (budget hits {})",
            hours as f64 / elapsed,
            views.clock().now,
            rate.budget_hits
        );
    }
    exit.write(if map_failed {
        AppExit::error()
    } else {
        AppExit::Success
    });
}

fn report(name: &str, v: &mut [f64]) {
    if v.is_empty() {
        println!("BENCH {name}: no samples");
        return;
    }
    v.sort_by(f64::total_cmp);
    let pct = |p: f64| v[((v.len() - 1) as f64 * p).round() as usize];
    println!(
        "BENCH {name}: n {} p50 {:.2} p95 {:.2} p99 {:.2} max {:.2}",
        v.len(),
        pct(0.5),
        pct(0.95),
        pct(0.99),
        v[v.len() - 1]
    );
}

fn drive(mut b: ResMut<Bench>, tables: Option<Res<PdoombergUi>>, mut q: Query<&mut Table>) {
    let BenchMode::Table { rows, .. } = b.mode else {
        return;
    };
    let Some(mut t) = tables
        .and_then(|t| t.main_table)
        .and_then(|e| q.get_mut(e).ok())
    else {
        return;
    };
    if !b.repeated {
        b.repeated = true;
        if let Some(n) = rows {
            let m = t.model().repeated_to(n);
            t.set_model(Arc::new(m));
        }
    }
    if b.start.is_none() {
        return;
    }
    if b.frame.is_multiple_of(SORT_EVERY) {
        let cols = t.model().columns.len();
        let col = b.next_col % cols;
        b.next_col += 1;
        t.sort_by(col);
        let ms = t.last_sort().as_secs_f64() * 1e3;
        b.sorts_ms.push(ms);
        b.sort_window = 2;
        // Show a middle stretch so the redraw rewrites every cell.
        let mid = t.max_top() / 2;
        t.scroll_to(mid);
    } else if t.top() >= t.max_top() {
        t.scroll_to(0);
    } else {
        t.scroll(SCROLL_PER_FRAME);
    }
}

fn panes_of(mode: BenchMode) -> MapPanes {
    match mode {
        BenchMode::Map { panes, .. } => panes,
        _ => MapPanes::All,
    }
}

/// The frame the map bench sets its map mode at (after the panes open).
pub const MAP_MODE_FRAME: u64 = 20;
/// Frames between the map bench's zoom moves, and how many notches each moves.
pub const MAP_ZOOM_EVERY: u64 = 45;
pub const MAP_ZOOM_STEPS: f32 = 3.5;
/// Logical pixels the map bench pans a frame.
pub const MAP_PAN_PER_FRAME: f32 = 6.0;

/// The map bench: opens and closes Pdoomberg's F10 (held behind), sets up the panes, then pans
/// every frame, zooms in for 4 moves and out for 4, and moves the hover point; notes the zoom
/// level each frame draws at.
#[allow(clippy::too_many_arguments)]
fn drive_map(
    mut b: ResMut<Bench>,
    views: Res<Views>,
    ws: Res<crate::workspace::Workspace>,
    bitmap: Option<Res<crate::map::picking::MapBitmap>>,
    mut state: ResMut<crate::map::MapState>,
    mut open: MessageWriter<crate::workspace::OpenPage>,
    mut pane_actions: MessageWriter<crate::workspace::PaneAction>,
    mut windows: MessageWriter<crate::workspace::WindowAction>,
    mut input: MessageWriter<crate::map::MapInput>,
    mut modes: MessageWriter<crate::map::modes::MapModeInput>,
    mut pdb: MessageWriter<OpenPdoomberg>,
    mut nav: MessageWriter<crate::ui::rail::Navigate>,
    pdb_ui: Option<Res<PdoombergUi>>,
    mut control: MessageWriter<SimControl>,
) {
    use crate::map::camera::ZoomLevel;
    use crate::map::modes::MapModeInput;
    if b.frame == MAP_MODE_FRAME
        && let BenchMode::Map {
            mode,
            metros,
            speed,
            ..
        } = b.mode
    {
        modes.write(MapModeInput::Set(mode));
        modes.write(MapModeInput::Metros(metros));
        println!(
            "BENCH map: mode {mode:?}, Metro outlines {metros}, sim speed {speed}, panes {:?}",
            panes_of(b.mode)
        );
        if speed > 0 {
            for kind in AlertKind::ALL {
                control.write(SimControl(Control::SetAlert {
                    kind,
                    level: AlertLevel::Off,
                }));
            }
            control.write(SimControl(Control::SetSpeed(speed)));
        }
    }
    use crate::pages::PageRef;
    use crate::workspace::{OpenPage, PaneAction, WindowAction};
    let f = b.frame;
    let panes = match b.mode {
        BenchMode::Map { panes, .. } => panes,
        _ => MapPanes::All,
    };
    match f {
        2 => {
            pdb.write(OpenPdoomberg {
                function: PdbFunction::F10,
                company: None,
            });
        }
        4 => {
            nav.write(crate::ui::rail::Navigate(crate::ui::rail::Screen::Map));
        }
        6 if panes.lists() => {
            open.write(OpenPage::focused(PageRef::Companies));
        }
        8 if panes.lists() => {
            pane_actions.write(PaneAction::Split(None, crate::workspace::Axis::Row));
        }
        10 if panes.lists() => {
            open.write(OpenPage::focused(PageRef::Industries));
        }
        12 if panes.company() => {
            let co = views.company_rows.get().rows.first().map(|r| r.id);
            windows.write(WindowAction::New(co.map(PageRef::Company)));
        }
        14 if panes.province() => {
            // The densest Province page: the most HQs and units, ties to the lower id.
            let p = views
                .province_cards
                .get()
                .cards
                .iter()
                .max_by_key(|c| (c.hqs.len() + c.units.len(), std::cmp::Reverse(c.id)))
                .map(|c| c.id);
            windows.write(WindowAction::New(p.map(PageRef::Province)));
        }
        16 => {
            let first = ws.windows().first().map(|w| w.id);
            if let Some(id) = first {
                windows.write(WindowAction::Raise(id));
            }
            println!(
                "BENCH map: {} windows, {} panes",
                ws.windows().len(),
                ws.all_pane_ids().len()
            );
        }
        18 => {
            let pages: Vec<String> = ws
                .all_pane_ids()
                .iter()
                .filter_map(|&p| ws.page(p).map(PageRef::key))
                .collect();
            let behind = pdb_ui.and_then(|u| u.built);
            println!(
                "BENCH map: panes {}; Pdoomberg behind: {behind:?}",
                pages.join(", ")
            );
        }
        _ => {}
    }
    let Some(bitmap) = bitmap else {
        return;
    };
    let (map, view) = (bitmap.size(), state.view);
    let Some(cam) = &mut state.camera else {
        return;
    };
    if b.start.is_none() {
        return;
    }
    cam.pan(map, view, Vec2::new(-MAP_PAN_PER_FRAME, 0.0));
    if f.is_multiple_of(MAP_ZOOM_EVERY) {
        let phase = (f / MAP_ZOOM_EVERY) % 8;
        let steps = if phase < 4 {
            MAP_ZOOM_STEPS
        } else {
            -MAP_ZOOM_STEPS
        };
        cam.zoom(map, view, steps, view * Vec2::new(0.3, 0.5));
    }
    let level = cam.level(map, view);
    let t = f as f32 * 0.05;
    let at = view * Vec2::new(0.2 + 0.15 * t.sin(), 0.5 + 0.3 * (t * 0.7).cos());
    input.write(crate::map::MapInput::Hover(Some(at)));
    b.last_level = Some(match level {
        ZoomLevel::World => 0,
        ZoomLevel::Country => 1,
        ZoomLevel::Province => 2,
    });
}
