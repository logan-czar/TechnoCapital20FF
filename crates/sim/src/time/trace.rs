//! The job-order trace (build-plan M1.3): which slots each tick visited, run-length collapsed so a
//! year fits a reviewable golden file. Consecutive ticks that visited the same slots form one run.

use std::fmt::Write;

use super::calendar::DateTime;
use super::scheduler::Slot;

/// One run of ticks with the same slots.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Run {
    first: DateTime,
    last: DateTime,
    slots: Vec<Slot>,
}

/// Collects ticks and renders the trace.
#[derive(Debug, Clone, Default)]
pub struct TraceRecorder {
    runs: Vec<Run>,
}

impl TraceRecorder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Records that the tick at `now` visited `slots`.
    pub fn push(&mut self, now: DateTime, slots: &[Slot]) {
        if let Some(r) = self.runs.last_mut()
            && r.last.next() == now
            && r.slots == slots
        {
            r.last = now;
            return;
        }
        self.runs.push(Run {
            first: now,
            last: now,
            slots: slots.to_vec(),
        });
    }

    /// The trace as text: a header per run, then one line per group of consecutive slots.
    pub fn render(&self) -> String {
        let mut out = String::new();
        for r in &self.runs {
            let (a, b) = (r.first, r.last);
            if a == b {
                writeln!(out, "{a} {}", a.weekday().short_name()).unwrap();
            } else if a.date() == b.date() {
                let n = b.hours() - a.hours() + 1;
                writeln!(
                    out,
                    "{} {:02}:00..{:02}:00 {} ({n} ticks)",
                    a.date(),
                    a.hour(),
                    b.hour(),
                    a.weekday().short_name()
                )
                .unwrap();
            } else {
                let n = b.hours() - a.hours() + 1;
                writeln!(out, "{a}..{b} ({n} ticks)").unwrap();
            }
            let mut i = 0;
            while i < r.slots.len() {
                let g = r.slots[i].group();
                write!(out, "  {}:", g.label()).unwrap();
                while i < r.slots.len() && r.slots[i].group() == g {
                    write!(out, " {}", r.slots[i].step()).unwrap();
                    i += 1;
                }
                out.push('\n');
            }
        }
        out
    }
}
