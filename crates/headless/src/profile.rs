//! `run --profile` (build-plan M10.6, D400): wall time per scheduler slot, per job and for the
//! view refresh, summed over a run and printed as a table, slowest first.
//!
//! The timer lives here, in the runner: the sim tells a [`TickObserver`] when each part of a tick
//! starts and finishes and never reads a clock itself (build-plan 4.3). The observer sees no
//! state, so a profiled run makes the same world, draws and hashes as an unprofiled one.

use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::time::{Duration, Instant};

use sim::time::{DateTime, Slot, TickFacts, TickObserver, TickPart};

/// Jobs listed under the slot table.
const TOP_JOBS: usize = 15;

/// Time and calls of one part.
#[derive(Debug, Clone, Copy, Default)]
struct Acc {
    time: Duration,
    calls: u64,
}

impl Acc {
    fn add(&mut self, d: Duration) {
        self.time += d;
        self.calls += 1;
    }
}

/// Sums wall time per slot, per job and for the views over a run.
#[derive(Debug, Default)]
pub struct Profiler {
    slots: Vec<Acc>,
    jobs: BTreeMap<(Slot, &'static str), Acc>,
    views: Acc,
    /// Each view rebuilt, by field name.
    view: BTreeMap<&'static str, Acc>,
    /// Whole `Sim::step_observed` calls, timed by the runner.
    steps: Acc,
    /// Start times of the parts open now (a slot, then its job).
    open: Vec<Instant>,
}

impl Profiler {
    pub fn new() -> Profiler {
        Profiler {
            slots: vec![Acc::default(); Slot::COUNT],
            ..Profiler::default()
        }
    }

    /// One whole step took `d`.
    pub fn add_step(&mut self, d: Duration) {
        self.steps.add(d);
    }

    /// The report: every slot that ran, slowest first, with its share of all step time; then
    /// the view refresh, the rest of the step (clock, pauses, notices) and the slowest jobs.
    pub fn table(&self) -> String {
        let total = self.steps.time.as_secs_f64().max(f64::MIN_POSITIVE);
        let mut out = String::new();
        let line = |out: &mut String, name: &str, a: Acc| {
            let secs = a.time.as_secs_f64();
            let per_call_us = if a.calls > 0 {
                secs * 1e6 / a.calls as f64
            } else {
                0.0
            };
            let _ = writeln!(
                out,
                "{name:48} {:>10.3} {:>6.1}% {:>9} {:>12.1}",
                secs,
                100.0 * secs / total,
                a.calls,
                per_call_us
            );
        };
        let _ = writeln!(
            out,
            "{:48} {:>10} {:>7} {:>9} {:>12}",
            "part", "seconds", "share", "calls", "us per call"
        );
        let mut rows: Vec<(String, Acc)> = Slot::ALL
            .iter()
            .map(|&s| (s.name(), self.slots[s.index()]))
            .filter(|(_, a)| a.calls > 0)
            .collect();
        let slot_time: Duration = rows.iter().map(|(_, a)| a.time).sum();
        rows.push(("views (refresh after each tick)".to_owned(), self.views));
        let rest = self.steps.time.saturating_sub(slot_time + self.views.time);
        rows.push((
            "rest of the step (clock, pauses, notices)".to_owned(),
            Acc {
                time: rest,
                calls: self.steps.calls,
            },
        ));
        // Slowest first; ties by name, so the table order is fixed.
        rows.sort_by(|a, b| b.1.time.cmp(&a.1.time).then_with(|| a.0.cmp(&b.0)));
        for (name, a) in &rows {
            line(&mut out, name, *a);
        }
        line(&mut out, "all steps", self.steps);
        let _ = writeln!(out, "\nslowest {TOP_JOBS} jobs");
        let mut jobs: Vec<(String, Acc)> = self
            .jobs
            .iter()
            .map(|(&(slot, name), &a)| (format!("{} {name}", slot.name()), a))
            .collect();
        jobs.sort_by(|a, b| b.1.time.cmp(&a.1.time).then_with(|| a.0.cmp(&b.0)));
        for (name, a) in jobs.iter().take(TOP_JOBS) {
            line(&mut out, name, *a);
        }
        let _ = writeln!(
            out,
            "
views rebuilt (calls: ticks the view was due)"
        );
        let mut views: Vec<(String, Acc)> = self
            .view
            .iter()
            .map(|(&name, &a)| (format!("view {name}"), a))
            .collect();
        views.sort_by(|a, b| b.1.time.cmp(&a.1.time).then_with(|| a.0.cmp(&b.0)));
        for (name, a) in &views {
            line(&mut out, name, *a);
        }
        out
    }
}

impl TickObserver for Profiler {
    fn started(&mut self, _: TickPart) {
        self.open.push(Instant::now());
    }

    fn finished(&mut self, part: TickPart) {
        let Some(start) = self.open.pop() else {
            return;
        };
        let d = start.elapsed();
        match part {
            TickPart::Slot(s) => self.slots[s.index()].add(d),
            TickPart::Job(s, name) => self.jobs.entry((s, name)).or_default().add(d),
            TickPart::Views => self.views.add(d),
            TickPart::View(name) => self.view.entry(name).or_default().add(d),
        }
    }
}

/// The kinds of tick `run --tick-costs` times apart (as the game's bridge does, D776): any hour
/// but midnight, a day, a month's start, and each of a quarter's events (spec 4.4).
const TICK_KINDS: [&str; 7] = [
    "hourly",
    "daily",
    "monthly",
    "quarter start",
    "release",
    "price move",
    "plan lock",
];

fn tick_kind(now: DateTime) -> usize {
    let f = TickFacts::new(now);
    if f.is_quarter_start() {
        3
    } else if f.is_release_tick() {
        4
    } else if f.is_price_move_tick() {
        5
    } else if f.is_lock_tick() {
        6
    } else if f.is_month_start() {
        2
    } else if f.is_midnight() {
        1
    } else {
        0
    }
}

/// `run --tick-costs` (D801): the wall time of each whole, unobserved `Sim::step` (jobs and
/// view refresh, as the game runs it), by the kind of tick, so the quarter's ticks can be priced
/// without a window. Timing never changes the run.
#[derive(Debug, Default)]
pub struct TickCosts {
    by_kind: [Vec<Duration>; 7],
}

impl TickCosts {
    /// The tick that ended at `now` took `d`.
    pub fn add(&mut self, now: DateTime, d: Duration) {
        self.by_kind[tick_kind(now)].push(d);
    }

    /// One line a kind: count, mean, p50, p99 and the longest, in ms.
    pub fn table(&self) -> String {
        let mut out = format!(
            "{:14} {:>7} {:>9} {:>9} {:>9} {:>9}
",
            "tick", "n", "mean ms", "p50 ms", "p99 ms", "max ms"
        );
        for (name, v) in TICK_KINDS.iter().zip(&self.by_kind) {
            if v.is_empty() {
                continue;
            }
            let mut ms: Vec<f64> = v.iter().map(|d| d.as_secs_f64() * 1e3).collect();
            ms.sort_by(f64::total_cmp);
            let pct = |p: f64| ms[((ms.len() - 1) as f64 * p).round() as usize];
            let _ = writeln!(
                out,
                "{name:14} {:>7} {:>9.3} {:>9.3} {:>9.3} {:>9.3}",
                ms.len(),
                ms.iter().sum::<f64>() / ms.len() as f64,
                pct(0.5),
                pct(0.99),
                ms[ms.len() - 1]
            );
        }
        out
    }
}
