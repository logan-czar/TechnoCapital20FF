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

    /// The sim refresh these views come from.
    pub fn refresh(&self) -> u64 {
        self.refresh
    }

    /// Copies each view whose version differs, through the copy `sim_views!` generates over
    /// every view, so a new view cannot be missed. A copy shares the sim's data (D775); the
    /// data of the views it replaces is freed on another thread ([`drop_later`]).
    fn sync_from(&mut self, src: &SimViews) {
        let old = self.views.clone();
        self.views.copy_changed_from(src);
        self.refresh = src.refresh();
        drop_later(old);
    }
}

/// Frees `views` on a background thread (D775). A month's views (statements, company detail,
/// characters, ...) hold many strings and vectors: freeing the copies the UI let go of took up
/// to 7 ms of a frame at max speed. Only the data no other copy shares is freed; the order and
/// time of a free change nothing the sim or the UI computes.
fn drop_later(views: SimViews) {
    use std::sync::mpsc::{Sender, channel};
    use std::sync::{Mutex, OnceLock};
    static DROPPER: OnceLock<Mutex<Sender<SimViews>>> = OnceLock::new();
    let tx = DROPPER.get_or_init(|| {
        let (tx, rx) = channel::<SimViews>();
        let spawned = std::thread::Builder::new()
            .name("view-dropper".into())
            .spawn(move || while rx.recv().is_ok() {});
        if spawned.is_err() {
            warn!("no view-dropper thread: old views are freed in the frame");
        }
        Mutex::new(tx)
    });
    // If the thread is gone, the send hands the views back and they are freed here.
    if let Ok(tx) = tx.lock() {
        let _ = tx.send(views);
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

/// The step budgets of the first frames that step after the sim resumes from a pause (D806),
/// ramping back to [`FRAME_STEP_BUDGET`]: the first frame after a resume also lays out what the
/// pause changed (toasts, the alert row, the pages it flushed), so a full 8 ms of stepping on
/// top of it ran that frame past 16.7 ms. The first tick of a frame still always runs.
pub const RESUME_STEP_BUDGETS: [Duration; 3] = [
    Duration::from_millis(2),
    Duration::from_millis(4),
    Duration::from_millis(6),
];

/// How fast a kind's predicted cost forgets its costliest recent tick (D776): the prediction is
/// a decaying max, the newest tick's cost or the last prediction less this share, whichever is
/// more, so a kind is predicted at its expensive end.
pub const TICK_COST_DECAY: f64 = 0.25;

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
    /// Wall time spent stepping in the current frame so far (the UI's pacing reads it, D777).
    pub step_time_this_frame: Duration,
    /// A quarter's event ran in the current frame so far (the UI's pacing reads it, D777).
    pub quarterly_this_frame: bool,
    /// The per-frame step budget in force ([`FRAME_STEP_BUDGET`] unless a bench or test set
    /// another).
    pub budget: Duration,
    /// The longest single tick of the last finished frame, timed from the budget check that let
    /// it run to its end: the most the frame may overrun its budget (D300, D152).
    pub longest_tick_last_frame: Duration,
    longest_tick_this_frame: Duration,
    /// Game hours per real second, measured over the last full second.
    pub hours_per_second: f64,
    /// Ticks run since the app started by kind ([`TickKind`]): how many, their total time and
    /// the longest (for the benches, D776).
    pub by_kind: [(u64, Duration, Duration); TickKind::COUNT],
    window_start: Option<Instant>,
    window_steps: u64,
}

/// What a tick ran, by the calendar (spec 4): the kinds cost very differently.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TickKind {
    /// Any hour but midnight: prices and quotes.
    Hourly,
    /// 00:00 on a day that is not a month start: the daily jobs and views.
    Daily,
    /// 00:00 on the 1st outside a quarter's events: the monthly jobs and views.
    Monthly,
    /// 00:00 on a quarter's first day: the month's and the quarter's close (spec 4.4).
    QuarterStart,
    /// 00:00 on the release day (spec 4.4 row 1).
    Release,
    /// 01:00 on the release day: the price move and earnings jump.
    PriceMove,
    /// 00:00 on the plan lock day (spec 4.4 row 3): plans, consensus, births and IPO votes.
    PlanLock,
}

impl TickKind {
    pub const COUNT: usize = 7;
    pub const ALL: [TickKind; TickKind::COUNT] = [
        TickKind::Hourly,
        TickKind::Daily,
        TickKind::Monthly,
        TickKind::QuarterStart,
        TickKind::Release,
        TickKind::PriceMove,
        TickKind::PlanLock,
    ];

    /// The kind of the tick at `now`.
    pub fn of(now: sim::time::calendar::DateTime) -> TickKind {
        let f = sim::time::scheduler::TickFacts::new(now);
        if f.is_quarter_start() {
            TickKind::QuarterStart
        } else if f.is_release_tick() {
            TickKind::Release
        } else if f.is_price_move_tick() {
            TickKind::PriceMove
        } else if f.is_lock_tick() {
            TickKind::PlanLock
        } else if f.is_month_start() {
            TickKind::Monthly
        } else if f.is_midnight() {
            TickKind::Daily
        } else {
            TickKind::Hourly
        }
    }

    /// One of a quarter's events, the costliest ticks (6 to 17 ms in the game).
    pub fn is_quarterly(self) -> bool {
        matches!(
            self,
            TickKind::QuarterStart | TickKind::Release | TickKind::PriceMove | TickKind::PlanLock
        )
    }

    pub fn name(self) -> &'static str {
        match self {
            TickKind::Hourly => "hourly",
            TickKind::Daily => "daily",
            TickKind::Monthly => "monthly",
            TickKind::QuarterStart => "quarter start",
            TickKind::Release => "release",
            TickKind::PriceMove => "price move",
            TickKind::PlanLock => "plan lock",
        }
    }
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
    /// What a tick of each [`TickKind`] costs lately (a decaying max): at max speed a tick
    /// that would not fit in what is left of the budget waits for the next frame (D776).
    tick_cost: [Duration; TickKind::COUNT],
    /// After a resume from a pause: how many stepped frames of [`RESUME_STEP_BUDGETS`] have
    /// passed (D806); `None` once the ramp is done.
    resume_ramp: Option<usize>,
}

impl SimRunner {
    fn new(sim: Sim) -> SimRunner {
        SimRunner {
            sim,
            owed: 0.0,
            budget: FRAME_STEP_BUDGET,
            spent: Duration::ZERO,
            rebuilt: false,
            tick_cost: [Duration::ZERO; TickKind::COUNT],
            resume_ramp: None,
        }
    }

    /// The step budget of the current frame: [`SimRunner::set_budget`]'s, or less on the first
    /// stepped frames after a resume (D806).
    fn frame_budget(&self) -> Duration {
        match self.resume_ramp.and_then(|i| RESUME_STEP_BUDGETS.get(i)) {
            Some(&b) => b.min(self.budget),
            None => self.budget,
        }
    }

    /// Sets the per-frame step budget (benches and tests).
    pub fn set_budget(&mut self, budget: Duration) {
        self.budget = budget;
    }

    /// The sim's own views, as the sim holds them now (tests compare the copied resource with
    /// them).
    pub fn sim_views(&self) -> &SimViews {
        self.sim.views()
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
    // A frame that stepped uses up one budget of the resume ramp (D806).
    if rate.steps_this_frame > 0
        && let Some(i) = runner.resume_ramp
    {
        runner.resume_ramp = (i + 1 < RESUME_STEP_BUDGETS.len()).then_some(i + 1);
    }
    rate.step_time_last_frame = runner.spent;
    rate.step_time_this_frame = Duration::ZERO;
    rate.quarterly_this_frame = false;
    runner.spent = Duration::ZERO;
    rate.longest_tick_last_frame = std::mem::take(&mut rate.longest_tick_this_frame);
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
    let was_paused = runner.sim.controls().paused;
    for SimControl(control) in controls.read() {
        any = true;
        match runner.sim.apply(control.clone()) {
            Ok(out) => {
                // NewGame and Load rebuild every view (spec 9.4 "and on load"). Since M2 their
                // versions keep climbing (`SimViews::rebuild`), so the version sync would catch
                // them too; the full copy stays as a cheap guarantee.
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
    if any && was_paused && !runner.sim.controls().paused {
        runner.resume_ramp = Some(0);
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

/// The sim is fast-forwarding: running at max speed (speed 5, or a SkipTo), where it steps for
/// its whole frame budget and every-tick and daily views move every frame (D300, D773).
pub fn fast_forward(controls: &Controls) -> bool {
    pace(controls) == Pace::Max
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
        // The first tick of a frame always runs, so the game moves however slow a tick is. A
        // later one runs only if what its kind costs lately fits in what is left of the budget
        // (D776): a monthly or quarterly tick of several ms waits to open the next frame
        // instead of running the frame long past its budget.
        let first_of_frame = rate.steps_this_frame + steps == 0;
        let next = TickKind::of(sim::time::calendar::DateTime::from_hours(
            runner.sim.views().clock().now.hours() + 1,
        ));
        let checked = Instant::now();
        let cost = runner.tick_cost[next as usize];
        if !first_of_frame
            && runner.spent + checked.duration_since(start) + cost >= runner.frame_budget()
        {
            cut_short = true;
            break;
        }
        notices.write_batch(runner.sim.step().into_iter().map(SimNotice));
        let took = checked.elapsed();
        rate.longest_tick_this_frame = rate.longest_tick_this_frame.max(took);
        let kind = TickKind::of(runner.sim.views().clock().now);
        let c = &mut runner.tick_cost[kind as usize];
        *c = took.max(c.mul_f64(1.0 - TICK_COST_DECAY));
        rate.quarterly_this_frame |= kind.is_quarterly();
        let k = &mut rate.by_kind[kind as usize];
        k.0 += 1;
        k.1 += took;
        k.2 = k.2.max(took);
        steps += 1;
        if let Pace::Timed(_) = p {
            runner.owed -= 1.0;
        }
    }
    if matches!(pace(runner.sim.controls()), Pace::Paused | Pace::Max) {
        runner.owed = 0.0;
    }
    runner.spent += start.elapsed();
    rate.step_time_this_frame = runner.spent;
    rate.budget = runner.frame_budget();
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
        let old = std::mem::replace(&mut *views, Views::new(src));
        drop_later(old.views);
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
