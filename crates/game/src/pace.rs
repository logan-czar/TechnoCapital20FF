//! Fast-forward pacing of the page widgets (D773). At max speed (speed 5 or a SkipTo, D300) the
//! sim advances about a month every few frames, so every daily view and the monthly views the
//! entity pages rebuild on move nearly every frame. A page refresh, a chart re-set or a live
//! text write each frame costs more than the sim leaves of a 60 fps frame, and nobody reads a
//! figure that changes 60 times a second. So while the sim fast-forwards, each paced job runs at
//! most once per its period of real time, and the heavy ones (a page refresh, a chart re-set)
//! at most one a frame between them, so they spread over frames instead of landing together.
//!
//! Nothing is paced when the sim is paused or at speeds 1 to 4, or in a frame whose runner
//! controls changed (a pause, a speed change, Omniscient on or off): then every job that is
//! owed runs at once, so a paused page shows the final values in the frame the pause lands in,
//! and no estimate shown before an Omniscient toggle survives it.

use bevy::prelude::*;

use crate::bridge::{RunnerControls, SimRate, SimSystems, fast_forward};

/// The least real time between two refreshes of one page's body from its monthly views while
/// the sim fast-forwards.
pub const PAGE_REFRESH_SECS: f64 = 0.5;
/// The least real time between two writes of the live text spans (prices, levels) while the
/// sim fast-forwards: a few a second.
pub const LIVE_TEXT_SECS: f64 = 0.25;
/// The least real time between two re-sets of one live table (and of a `Live` widget whose
/// views moved, and of the name index) while the sim fast-forwards.
pub const LIVE_MODEL_SECS: f64 = 0.5;
/// The least real time between two re-sets of one live chart while the sim fast-forwards: a
/// 10-year chart's redraw moves every one of its 1,500 nodes, the costliest job of all.
pub const LIVE_CHART_SECS: f64 = 1.0;
/// How far past its budget the sim's stepping may run before the frame counts as overrun
/// (D777): the last hourly tick of a frame often ends a few microseconds past the budget.
pub const OVERRUN_MARGIN: std::time::Duration = std::time::Duration::from_millis(1);
/// While the sim fast-forwards, a heavy job runs in a frame whose sim stepping took at most
/// this, in practice a frame with no fixed step (D777): a step takes the 8 ms budget, and a
/// heavy job on top of it would run the frame past 16.7 ms. A job held back twice its period
/// runs in a frame the sim did not overrun (its stepping within the budget, give or take
/// [`OVERRUN_MARGIN`], and no quarter's
/// tick, D777), so it never starves and never lands on a 10 to 16 ms sim frame.
pub const HEAVY_SIM_SECS: f64 = 0.002;

/// This frame's pacing state, set before every UI system.
#[derive(Resource, Debug, Clone, Default)]
pub struct UiPace {
    fast: bool,
    flush: bool,
    now: f64,
    heavy_taken: bool,
    /// The sim stepped more than [`HEAVY_SIM_SECS`] this frame.
    sim_heavy: bool,
    /// The sim overran this frame: its stepping went past the budget or it ran a quarter's
    /// tick. No heavy job runs then, however long it was held back.
    sim_over: bool,
    /// Bumped when a hidden pane shows again, so the live values it held update at once.
    wake: u64,
}

impl UiPace {
    /// The sim fast-forwards this frame and no control changed: paced jobs wait their turn.
    pub fn paced(&self) -> bool {
        self.fast && !self.flush
    }

    /// The runner controls changed this frame (a pause, a speed, Omniscient): every owed job
    /// runs now, whatever its own throttle.
    pub fn flushing(&self) -> bool {
        self.flush
    }

    /// Wakes every paced job: something they held shows again.
    pub fn wake(&mut self) {
        self.wake += 1;
    }

    /// Real seconds since the app started, at this frame.
    pub fn now(&self) -> f64 {
        self.now
    }

    /// Whether a job last run at `last` (real seconds) may run this frame: always when not
    /// [`paced`](Self::paced); else once `period` has passed since `last` and, for a `heavy`
    /// job, only if no other heavy job ran this frame (it then takes the frame's turn).
    pub fn may_run(&mut self, last: f64, period: f64, heavy: bool) -> bool {
        if !self.paced() {
            return true;
        }
        if self.now - last < period {
            return false;
        }
        if heavy {
            if self.heavy_taken
                || self.sim_over
                || (self.sim_heavy && self.now - last < 2.0 * period)
            {
                return false;
            }
            self.heavy_taken = true;
        }
        true
    }

    /// Sets the state directly (tests).
    pub fn set(&mut self, fast: bool, now: f64) {
        self.fast = fast;
        self.flush = false;
        self.now = now;
        self.heavy_taken = false;
        self.sim_heavy = false;
        self.sim_over = false;
    }
}

/// A paced job's own state: when it last ran and whether a run is owed.
#[derive(Debug, Clone, Copy)]
pub struct Paced {
    last: f64,
    owed: bool,
    wake: u64,
}

impl Default for Paced {
    fn default() -> Self {
        Paced {
            last: f64::NEG_INFINITY,
            owed: false,
            wake: 0,
        }
    }
}

impl Paced {
    /// Whether the job runs this frame: its inputs `moved` now or a run is owed (or the pace
    /// woke), and [`UiPace::may_run`] lets it. A run held back is owed, so it happens once the
    /// period passes or the sim stops fast-forwarding, even if nothing moves after.
    pub fn due(&mut self, moved: bool, pace: &mut UiPace, period: f64, heavy: bool) -> bool {
        let woke = pace.wake != self.wake;
        self.wake = pace.wake;
        if !(moved || self.owed || woke) {
            return false;
        }
        if woke || pace.may_run(self.last, period, heavy) {
            self.owed = false;
            self.last = pace.now;
            true
        } else {
            self.owed = true;
            false
        }
    }
}

/// System set of [`start_pace`]: after the views sync, before every UI system.
#[derive(SystemSet, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PaceSystems;

fn start_pace(
    time: Res<Time<Real>>,
    controls: Option<Res<RunnerControls>>,
    rate: Option<Res<SimRate>>,
    mut pace: ResMut<UiPace>,
) {
    pace.fast = controls.as_ref().is_some_and(|c| fast_forward(c));
    pace.flush = controls.as_ref().is_some_and(|c| c.is_changed());
    pace.now = time.elapsed_secs_f64();
    pace.heavy_taken = false;
    pace.sim_heavy = rate
        .as_ref()
        .is_some_and(|r| r.step_time_this_frame.as_secs_f64() > HEAVY_SIM_SECS);
    pace.sim_over = rate.as_ref().is_some_and(|r| {
        r.quarterly_this_frame || r.step_time_this_frame > r.budget + OVERRUN_MARGIN
    });
}

/// Adds [`UiPace`] and keeps it current each frame.
pub struct PacePlugin;

impl Plugin for PacePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<UiPace>().add_systems(
            Update,
            start_pace
                .in_set(PaceSystems)
                .after(SimSystems::SyncViews)
                .before(crate::ui::UiSystems::Capture),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pacing_waits_out_the_period_and_spreads_heavy_jobs() {
        let mut p = UiPace::default();
        assert!(p.may_run(10.0, 0.5, true), "not fast: always");
        p.set(true, 10.2);
        assert!(!p.may_run(10.0, 0.5, false), "inside the period");
        assert!(p.may_run(9.0, 0.5, true), "past it: takes the turn");
        assert!(!p.may_run(9.0, 0.5, true), "one heavy job a frame");
        assert!(p.may_run(9.0, 0.5, false), "a light job still runs");
        p.set(true, 10.2);
        p.sim_heavy = true;
        assert!(!p.may_run(9.6, 0.5, true), "the sim took this frame");
        assert!(p.may_run(9.6, 0.5, false), "but not from a light job");
        assert!(
            p.may_run(9.1, 0.5, true),
            "held back twice its period: runs anyway"
        );
        p.set(true, 10.2);
        p.sim_heavy = true;
        p.sim_over = true;
        assert!(
            !p.may_run(5.0, 0.5, true),
            "but not in a frame the sim overran"
        );
        p.flush = true;
        assert!(p.may_run(10.2, 0.5, true), "a control change flushes");
    }

    #[test]
    fn a_held_back_run_is_owed_until_it_runs() {
        let mut p = UiPace::default();
        let mut job = Paced::default();
        assert!(!job.due(false, &mut p, 0.5, false), "nothing moved");
        p.set(true, 1.0);
        assert!(job.due(true, &mut p, 0.5, false), "first run");
        p.set(true, 1.2);
        assert!(!job.due(true, &mut p, 0.5, false), "held back");
        p.set(true, 1.3);
        assert!(
            !job.due(false, &mut p, 0.5, false),
            "still inside the period"
        );
        p.set(false, 1.31);
        assert!(job.due(false, &mut p, 0.5, false), "owed: runs once paused");
        assert!(!job.due(false, &mut p, 0.5, false), "and only once");
        p.wake();
        assert!(job.due(false, &mut p, 0.5, false), "a wake runs it");
    }
}
