//! Release-build benches (D14; build-plan M7.1, M7.7, 4.5), printed to stdout:
//!
//! - `--bench-table [seconds]`: the real company table (Pdoomberg's F10 Screener over
//!   v_company_row, full screen) auto-scrolls every frame and re-sorts by the next column every
//!   [`SORT_EVERY`] frames; prints frame time p50, p95 and max, the frames that sorted, and the
//!   sort times. `--rows N` repeats its rows to N.
//! - `--bench-max [seconds]`: the sim at max speed (alerts off) with the shell drawing; prints
//!   frame times and game hours per second, to show the window stays responsive.
//!
//! Both run without vsync so the frame times are the real cost, then exit.

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
    /// Open every page kind and time it to its first laid-out frame
    /// ([`crate::page_bench`]).
    Pages,
}

impl BenchMode {
    fn seconds(self) -> f64 {
        match self {
            BenchMode::Table { seconds, .. } | BenchMode::Max { seconds } => seconds,
            BenchMode::Pages => f64::INFINITY,
        }
    }
}

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
}

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
    mut exit: MessageWriter<AppExit>,
) {
    let now = Instant::now();
    b.frame += 1;
    if let Some(last) = b.last
        && b.frame > u64::from(WARMUP_FRAMES)
    {
        let ms = now.duration_since(last).as_secs_f64() * 1e3;
        b.frames_ms.push(ms);
        if b.sort_window > 0 {
            b.sort_window -= 1;
            b.sort_frames_ms.push(ms);
        }
    }
    b.last = Some(now);
    if b.frame == u64::from(WARMUP_FRAMES) {
        b.start = Some(now);
        b.start_steps = rate.total_steps;
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
    report("frame ms", &mut b.frames_ms);
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
    exit.write(AppExit::Success);
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
