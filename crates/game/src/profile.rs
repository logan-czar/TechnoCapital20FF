//! A span timer for the benches (D770): with the `profile` feature (which turns on Bevy's
//! `trace`, so every system, schedule and render node runs in a span), a tracing layer adds up
//! the wall time spent in each span by name. `--bench-map` resets it when its measuring starts
//! and prints the spans that cost the most per frame when it ends. Without the feature nothing
//! is recorded and [`report`] prints nothing.

#[cfg(feature = "profile")]
mod imp {
    use std::collections::HashMap;
    use std::fmt::Write as _;
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    use bevy::log::BoxedLayer;
    use bevy::log::tracing::field::{Field, Visit};
    use bevy::log::tracing::{Subscriber, span};
    use bevy::log::tracing_subscriber::Layer;
    use bevy::log::tracing_subscriber::layer::Context;
    use bevy::log::tracing_subscriber::registry::LookupSpan;
    use bevy::prelude::App;

    type Totals = HashMap<String, (Duration, u64)>;

    /// Every span's time since the last reset, and the current frame's.
    static TOTALS: Mutex<Option<(Totals, Totals)>> = Mutex::new(None);
    /// Each finished frame: its number, its time and its costliest spans.
    type Frame = (u64, f64, Vec<(String, Duration)>);
    static FRAMES: Mutex<Vec<Frame>> = Mutex::new(Vec::new());
    /// Spans kept for each frame.
    const FRAME_SPANS: usize = 40;

    struct Name(String);
    struct Entered(Instant);

    struct NameVisitor(Option<String>);

    impl Visit for NameVisitor {
        fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
            if field.name() == "name" {
                let mut s = String::new();
                let _ = write!(s, "{value:?}");
                self.0 = Some(s.trim_matches('"').to_owned());
            }
        }

        fn record_str(&mut self, field: &Field, value: &str) {
            if field.name() == "name" {
                self.0 = Some(value.to_owned());
            }
        }
    }

    struct Timer;

    impl<S: Subscriber + for<'a> LookupSpan<'a>> Layer<S> for Timer {
        fn on_new_span(&self, attrs: &span::Attributes<'_>, id: &span::Id, ctx: Context<'_, S>) {
            let mut v = NameVisitor(None);
            attrs.record(&mut v);
            let meta = attrs.metadata().name();
            let name = match v.0 {
                Some(n) => format!("{meta}: {n}"),
                None => meta.to_owned(),
            };
            if let Some(s) = ctx.span(id) {
                s.extensions_mut().insert(Name(name));
            }
        }

        fn on_enter(&self, id: &span::Id, ctx: Context<'_, S>) {
            if let Some(s) = ctx.span(id) {
                s.extensions_mut().replace(Entered(Instant::now()));
            }
        }

        fn on_exit(&self, id: &span::Id, ctx: Context<'_, S>) {
            let Some(s) = ctx.span(id) else {
                return;
            };
            let ext = s.extensions();
            let (Some(Name(name)), Some(Entered(at))) = (ext.get::<Name>(), ext.get::<Entered>())
            else {
                return;
            };
            let d = at.elapsed();
            if let Ok(mut t) = TOTALS.lock() {
                let (all, frame) = t.get_or_insert_with(Default::default);
                for m in [all, frame] {
                    let e = m.entry(name.clone()).or_default();
                    e.0 += d;
                    e.1 += 1;
                }
            }
        }
    }

    pub fn layer(_app: &mut App) -> Option<BoxedLayer> {
        Some(Box::new(Timer))
    }

    pub fn reset() {
        if let Ok(mut t) = TOTALS.lock() {
            *t = Some(Default::default());
        }
        if let Ok(mut f) = FRAMES.lock() {
            f.clear();
        }
    }

    /// Closes frame `frame` (`ms` long): keeps its costliest spans.
    pub fn end_frame(frame: u64, ms: f64) {
        let Ok(mut t) = TOTALS.lock() else {
            return;
        };
        let Some((_, cur)) = t.as_mut() else {
            return;
        };
        let mut v: Vec<(String, Duration)> = cur.drain().map(|(k, (d, _))| (k, d)).collect();
        v.sort_by_key(|e| std::cmp::Reverse(e.1));
        v.truncate(FRAME_SPANS);
        if let Ok(mut f) = FRAMES.lock() {
            f.push((frame, ms, v));
        }
    }

    /// The costliest spans of the `n` slowest frames.
    pub fn report_slowest(n: usize) {
        let Ok(mut f) = FRAMES.lock() else {
            return;
        };
        f.sort_by(|a, b| b.1.total_cmp(&a.1));
        for (frame, ms, spans) in f.iter().take(n) {
            // The systems (and their commands), the costliest first; schedules are their sums.
            let list: Vec<String> = spans
                .iter()
                .filter(|(k, d)| k.starts_with("system") && d.as_secs_f64() > 2e-4)
                .take(14)
                .map(|(k, d)| {
                    let k = k.rsplit("::").next().unwrap_or(k);
                    format!("{k} {:.2}", d.as_secs_f64() * 1e3)
                })
                .collect();
            println!("BENCH slow frame {frame} {ms:.2} ms: {}", list.join("; "));
        }
    }

    pub fn report(frames: usize, top: usize) {
        let Ok(t) = TOTALS.lock() else {
            return;
        };
        let Some((t, _)) = t.as_ref() else {
            return;
        };
        let mut v: Vec<_> = t.iter().collect();
        v.sort_by_key(|e| std::cmp::Reverse(e.1.0));
        let n = frames.max(1) as f64;
        // The costliest spans, then every other game system that costs anything.
        let v: Vec<_> = v
            .iter()
            .enumerate()
            .filter(|(i, (name, (d, _)))| {
                *i < top || (name.contains("game::") && d.as_secs_f64() * 1e3 / n > 0.01)
            })
            .map(|(_, e)| *e)
            .collect();
        for (name, (d, count)) in v {
            println!(
                "BENCH span {:>8.3} ms/frame {:>7.1} runs/frame  {name}",
                d.as_secs_f64() * 1e3 / n,
                *count as f64 / n
            );
        }
    }
}

#[cfg(feature = "profile")]
pub use imp::{end_frame, layer, report, report_slowest, reset};

/// The tracing layer (none without the `profile` feature).
#[cfg(not(feature = "profile"))]
pub fn layer(_app: &mut bevy::prelude::App) -> Option<bevy::log::BoxedLayer> {
    None
}

#[cfg(not(feature = "profile"))]
pub fn reset() {}

#[cfg(not(feature = "profile"))]
pub fn report(_frames: usize, _top: usize) {}

#[cfg(not(feature = "profile"))]
pub fn end_frame(_frame: u64, _ms: f64) {}

#[cfg(not(feature = "profile"))]
pub fn report_slowest(_n: usize) {}
