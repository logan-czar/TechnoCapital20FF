//! SimBridgePlugin (build-plan M7.1 to M7.3; spec 9): runs `sim` in `FixedUpdate`, turns UI
//! control messages into [`Sim::apply`] calls, turns the sim's notices into Bevy messages and
//! copies the sim's views into the [`Views`] resource once per frame.
//!
//! The [`Sim`] itself lives in [`SimRunner`], whose fields are private to this module, so UI code
//! has no path to the sim: it reads [`Views`] and [`RunnerControls`], listens for [`SimNotice`]
//! and writes [`SimControl`] (spec 9). The game never enables sim's `test-hooks` feature, so not
//! even this module can read the world tables.
//!
//! Frame order:
//! - `PreUpdate` ([`SimSystems::ApplyControls`]): last frame's controls are applied at once (D5).
//! - `FixedUpdate` ([`SimSystems::Step`]): as many ticks as the speed owes, capped by the
//!   per-frame budget (D300).
//! - `Update` ([`SimSystems::SyncViews`], before every UI system): the views that changed are
//!   copied in, once per frame.

use std::ops::Deref;
use std::time::{Duration, Instant};

use bevy::prelude::*;
use sim::time::control::SECONDS_PER_HOUR;
use sim::{Control, Controls, Notice, Sim, SimViews};

/// A control from the UI to the sim (spec 9.1).
#[derive(Message, Debug, Clone, PartialEq)]
pub struct SimControl(pub Control);

/// A notice from the sim to the UI (spec 9.3), in the order the sim posted it.
#[derive(Message, Debug, Clone, PartialEq)]
pub struct SimNotice(pub Notice);

/// The sim's read-only views (spec 9.2, 9.4), copied in once per frame. Only the views whose
/// version moved are copied, and the resource is only touched (so Bevy change detection only
/// fires) when the sim refreshed something.
#[derive(Resource, Debug, Clone)]
pub struct Views {
    views: SimViews,
    refresh: u64,
}

impl Deref for Views {
    type Target = SimViews;

    fn deref(&self) -> &SimViews {
        &self.views
    }
}

impl Views {
    fn new(src: &SimViews) -> Views {
        Views {
            views: src.clone(),
            refresh: src.refresh(),
        }
    }

    /// The sim refresh these views come from (the copy's own `SimViews::refresh` is not
    /// updated by a partial copy, so this shadows it).
    pub fn refresh(&self) -> u64 {
        self.refresh
    }

    /// Copies each view whose version differs. Every view of `sim_views!` must be listed here
    /// (a sim request asks for a generated copy so a new view cannot be missed).
    fn sync_from(&mut self, src: &SimViews) {
        macro_rules! copy_changed {
            ($($field:ident),* $(,)?) => {$(
                if self.views.$field.version() != src.$field.version() {
                    self.views.$field.clone_from(&src.$field);
                }
            )*};
        }
        copy_changed!(
            clock,
            quotes,
            price_bars,
            news,
            projection,
            company_rows,
            company_detail,
            units,
            tech,
            industry_rows,
            industry_detail,
            map_layers,
            province_cards,
            statements,
            filings,
            ratings,
            recap,
            map_static,
        );
        self.refresh = src.refresh();
    }
}

/// The runner settings the sim holds (speed, pause, skip, alert levels, Omniscient, watchlist).
/// They are not world tables but the bridge's own state, mirrored here so the alert settings and
/// the outliner can show them; a sim request asks for them as a view.
#[derive(Resource, Debug, Clone, PartialEq, Deref)]
pub struct RunnerControls(pub Controls);

/// Per-frame wall-clock budget for sim steps (D300): at max speed the bridge steps until this
/// is spent, so the window keeps drawing. Half of a 60 fps frame.
pub const FRAME_STEP_BUDGET: Duration = Duration::from_millis(8);

/// Most game hours a speed may owe when the budget cuts a frame short (D300), so a slow frame
/// never turns into a burst of catch-up ticks.
pub const MAX_OWED_HOURS: f64 = 4.0;

/// Tick rate statistics for the top bar and the benches.
#[derive(Resource, Debug, Clone, Default)]
pub struct SimRate {
    /// Ticks run in the current frame so far.
    pub steps_this_frame: u32,
    /// Ticks run in the last finished frame.
    pub steps_last_frame: u32,
    /// Ticks run since the app started.
    pub total_steps: u64,
    /// Frames whose stepping stopped at the budget.
    pub budget_hits: u64,
    /// Wall time spent stepping in the last finished frame.
    pub step_time_last_frame: Duration,
    /// Game hours per real second, measured over the last full second.
    pub hours_per_second: f64,
    window_start: Option<Instant>,
    window_steps: u64,
}

/// The sim and the bridge's stepping state. Private to this module: UI code cannot reach it.
#[derive(Resource)]
pub struct SimRunner {
    sim: Sim,
    /// Game hours owed at speeds 1 to 4 (fractional).
    owed: f64,
    budget: Duration,
    spent: Duration,
    /// A NewGame or Load rebuilt every view since the last sync.
    rebuilt: bool,
}

impl SimRunner {
    fn new(sim: Sim) -> SimRunner {
        SimRunner {
            sim,
            owed: 0.0,
            budget: FRAME_STEP_BUDGET,
            spent: Duration::ZERO,
            rebuilt: false,
        }
    }

    /// Sets the per-frame step budget (benches and tests).
    pub fn set_budget(&mut self, budget: Duration) {
        self.budget = budget;
    }
}

/// The bridge's system sets.
#[derive(SystemSet, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SimSystems {
    /// `PreUpdate`: apply controls.
    ApplyControls,
    /// `FixedUpdate`: run ticks.
    Step,
    /// `Update`: copy the views in; every UI system runs after it.
    SyncViews,
}

/// Runs a [`Sim`] inside the Bevy app (spec 9; build-plan M7.1 to M7.3).
pub struct SimBridgePlugin {
    sim: std::sync::Mutex<Option<Sim>>,
}

impl SimBridgePlugin {
    pub fn new(sim: Sim) -> SimBridgePlugin {
        SimBridgePlugin {
            sim: std::sync::Mutex::new(Some(sim)),
        }
    }
}

impl Plugin for SimBridgePlugin {
    fn build(&self, app: &mut App) {
        let sim = self
            .sim
            .lock()
            .ok()
            .and_then(|mut s| s.take())
            .expect("SimBridgePlugin added twice");
        app.insert_resource(Views::new(sim.views()))
            .insert_resource(RunnerControls(sim.controls().clone()))
            .insert_resource(SimRunner::new(sim))
            .init_resource::<SimRate>()
            .add_message::<SimControl>()
            .add_message::<SimNotice>()
            .add_systems(First, start_frame)
            .add_systems(PreUpdate, apply_controls.in_set(SimSystems::ApplyControls))
            .add_systems(FixedUpdate, step_sim.in_set(SimSystems::Step))
            .add_systems(Update, sync_views.in_set(SimSystems::SyncViews));
    }
}

fn start_frame(mut runner: ResMut<SimRunner>, mut rate: ResMut<SimRate>) {
    rate.step_time_last_frame = runner.spent;
    runner.spent = Duration::ZERO;
    rate.steps_last_frame = rate.steps_this_frame;
    rate.steps_this_frame = 0;
    let now = Instant::now();
    let start = *rate.window_start.get_or_insert(now);
    let elapsed = now.duration_since(start);
    if elapsed >= Duration::from_secs(1) {
        rate.hours_per_second = rate.window_steps as f64 / elapsed.as_secs_f64();
        rate.window_steps = 0;
        rate.window_start = Some(now);
    }
}

/// Applies the UI's controls at once (D5) and posts any notices they cause.
fn apply_controls(
    mut controls: MessageReader<SimControl>,
    mut runner: ResMut<SimRunner>,
    mut notices: MessageWriter<SimNotice>,
    mut mirror: ResMut<RunnerControls>,
) {
    let mut any = false;
    for SimControl(control) in controls.read() {
        any = true;
        match runner.sim.apply(control.clone()) {
            Ok(out) => {
                // NewGame and Load rebuild every view at refresh 1, version 1 (spec 9.4 "and on
                // load"), so version numbers cannot tell old from new: copy them all.
                if matches!(control, Control::NewGame { .. } | Control::Load(_)) {
                    runner.rebuilt = true;
                    runner.owed = 0.0;
                }
                notices.write_batch(out.into_iter().map(SimNotice));
            }
            Err(e) => warn!("control {control:?} refused: {e}"),
        }
        if runner.sim.controls().paused {
            runner.owed = 0.0;
        }
    }
    if any && mirror.0 != *runner.sim.controls() {
        mirror.0.clone_from(runner.sim.controls());
    }
}

/// What the stepping loop should do this fixed run.
#[derive(Debug, Clone, Copy, PartialEq)]
enum Pace {
    Paused,
    /// Speeds 1 to 4: real seconds per game hour.
    Timed(f64),
    /// Max speed (5, or a SkipTo): as many ticks as the budget allows.
    Max,
}

fn pace(controls: &Controls) -> Pace {
    match controls.effective_speed() {
        0 => Pace::Paused,
        s => SECONDS_PER_HOUR[usize::from(s - 1)].map_or(Pace::Max, Pace::Timed),
    }
}

/// Runs the ticks owed for this fixed timestep (spec 9.1 speeds, D8), within the frame budget
/// (D300).
fn step_sim(
    time: Res<Time>,
    mut runner: ResMut<SimRunner>,
    mut notices: MessageWriter<SimNotice>,
    mut rate: ResMut<SimRate>,
) {
    let runner = &mut *runner;
    let start = Instant::now();
    if let Pace::Timed(sph) = pace(runner.sim.controls()) {
        runner.owed = (runner.owed + time.delta_secs_f64() / sph).min(MAX_OWED_HOURS);
    }
    let mut steps = 0u32;
    let mut cut_short = false;
    loop {
        let p = pace(runner.sim.controls());
        let wanted = match p {
            Pace::Paused => false,
            Pace::Timed(_) => runner.owed >= 1.0,
            Pace::Max => true,
        };
        if !wanted {
            break;
        }
        // The first tick of a frame always runs, so the game moves however slow a tick is.
        let first_of_frame = rate.steps_this_frame + steps == 0;
        if !first_of_frame && runner.spent + start.elapsed() >= runner.budget {
            cut_short = true;
            break;
        }
        notices.write_batch(runner.sim.step().into_iter().map(SimNotice));
        steps += 1;
        if let Pace::Timed(_) = p {
            runner.owed -= 1.0;
        }
    }
    if matches!(pace(runner.sim.controls()), Pace::Paused | Pace::Max) {
        runner.owed = 0.0;
    }
    runner.spent += start.elapsed();
    rate.steps_this_frame += steps;
    rate.total_steps += u64::from(steps);
    rate.window_steps += u64::from(steps);
    rate.budget_hits += u64::from(cut_short);
}

/// Copies the changed views in, once per frame (spec 9.4; build-plan M7.3).
fn sync_views(
    mut runner: ResMut<SimRunner>,
    mut views: ResMut<Views>,
    mut mirror: ResMut<RunnerControls>,
) {
    let runner = &mut *runner;
    let src = runner.sim.views();
    if std::mem::take(&mut runner.rebuilt) {
        // A new game or a load: every view is new, whatever its version says.
        *views = Views::new(src);
    } else if views.refresh != src.refresh() {
        views.sync_from(src);
    }
    if mirror.0 != *runner.sim.controls() {
        mirror.0.clone_from(runner.sim.controls());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pace_follows_the_speed_table() {
        let mut c = Controls::default();
        assert_eq!(pace(&c), Pace::Paused);
        c.paused = false;
        for (speed, want) in [(1, 2.0), (2, 1.0), (3, 0.5), (4, 0.2)] {
            c.speed = speed;
            assert_eq!(pace(&c), Pace::Timed(want));
        }
        c.speed = 5;
        assert_eq!(pace(&c), Pace::Max);
    }
}
