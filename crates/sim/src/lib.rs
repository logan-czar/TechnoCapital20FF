//! The TechnoCapital20FF simulation (build-plan 2.1). No Bevy dependency: it runs the same in the
//! game, in tests and in the headless runner, deterministic on one machine (build-plan 6, decision A).
//!
//! The public API is [`Sim`]: `Sim::new(data, seed)`, `Sim::step()` (one hourly tick, returning its
//! notices) and `Sim::apply(control)`.

pub mod ai;
pub mod births;
pub mod economy;
pub mod finance;
pub mod hash;
pub mod market;
pub mod news;
pub mod ops;
pub mod people;
pub mod recap;
pub mod rng;
pub mod save;
pub mod soak;
pub mod time;
pub mod views;
pub mod world;

use std::path::Path;
use std::sync::Arc;

use sim_data::WorldData;
use thiserror::Error;

pub use hash::StateHash;
pub use rng::{DrawSource, RngStreams, Stream};
use time::control::{MAX_SPEED, Skip, skip_target};
pub use time::{Control, Controls};
use time::{DateTime, Scheduler, Slot, TickObserver, TickPart};
pub use views::ClockView;
pub use views::SimViews;
use world::{CompanyId, PauseReason};
pub use world::{LoadError, Notice, World};

/// Registers every module's jobs in their slots (spec 4). Each milestone adds its module's
/// `register` call here; the scheduler itself never changes.
///
/// **Order inside one slot is registration order**, so where two modules put jobs in the same
/// slot, the order of their `register` calls below is part of the job order and must follow
/// the spec text for that step. Slots filled now: `time` in `Slot::Alerts`; `economy` (M2) in
/// the 4.3 step 1 slots (1a AI events, 1b industry lt, 1c cycle, 1d zone spreads, 1e growth
/// draws) and steps 2 (demand), 3 (fringe), 6 (supply), 7 (revenue), 9 (expenses) and 11
/// (assets); `ops` (M3) in steps 4 (labor and seats), 5 (compute), 8 (data) and 10
/// (productivity); `people` (M3) in step 11 (new seats); `finance` (M4) in steps 9 (the month
/// opens and posts the 5.5 lines), 11 (depreciation, purchases, sales), 12 (interest), 13 (cash
/// settle, distress), 14 (tax accrual, ledger posted), the 4.4 close, release and 01:00 rating
/// and line reviews, and the 4.5 annual statements; `market` (M5) in 4.1 step 2 (prices), the 4.4
/// price move (full fair value, earnings jump, buzz), 4.2 steps 1 (bars, buzz), 2 (fair value),
/// 3 (reaction week) and 6 (index closes, zone confidence, new bars), 4.3 step 13 (delisting at
/// bankruptcy, after finance's settle), the close's result tags, the lock's consensus and the
/// 4.5 bar archive; `births` (M6) in the plan lock's steps 1 to 3 (fixed and random startup
/// events, IPO votes and listings); `ai` (M6) in the lock's step 4 (the Lite AI batch) and the
/// close (loss_q); `news` (M6) in 4.3 steps 1a (the chatbot), 2 (phase changes) and 13
/// (bankruptcies), the release (removals), the price move's step 6 (results and rating
/// changes) and 4.2 step 5 (the daily post); `recap` (M6) in the pre-quarter-end week. Slots
/// expected to be shared, in the order their calls must go:
///
/// - `Slot::Alerts`: `time` (calendar alerts) only; other modules raise alerts from their own
///   slots through `JobCtx::raise_alert` (the economy raises the World event alert in 1a).
/// - `Slot::MonthlyAiEvents` (4.3 step 1): `economy` (boom and pop, 5.1.1), then `news` (the
///   chatbot headline, 5.18).
/// - `Slot::MonthlyDemand` (4.3 step 2): `economy` (demand and labels), then `news` (phase
///   change headlines).
/// - `Slot::MonthlyLaborSeats` (4.3 step 4): `ops` (labor units, seats, stations, 5.10).
/// - `Slot::MonthlyExpenses` (4.3 step 9): `economy` (variable, fixed cash, depreciation, R&D,
///   shared, 5.5), then `finance` (the month's ledger opens with those lines; tax accrues at
///   step 14, once interest is known, D227).
/// - `Slot::MonthlyAssets` (4.3 step 11): `economy` (asset decay, growth plan buys and sells,
///   ramping, 5.10), then `people` (simple characters for new seats, 3.7.1), then `finance`
///   (depreciation, purchases and sales posted).
/// - `Slot::MonthlyCashSettle` (4.3 step 13): `finance` (settle, distress, bankruptcy), then
///   `market` (delisting the new bankruptcies, D134), then `news` (bankruptcy headlines).
/// - `Slot::CloseStatements` (4.4 close): `finance` (tax paid, then the statements, D122), then
///   `ai` (loss_q from the quarter just archived).
/// - `Slot::ReleasePublish` (4.4 release): `finance` (removals, 5.12 step 3), then `news`
///   (removal headlines).
/// - `Slot::PriceMoveResultHeadlines` (4.4 price move): `news` only.
/// - `Slot::LockIpoVotes` (4.4 plan lock): `births` (votes, then listings, 5.20.1; a listing
///   calls `market::jobs::list_company` so the index keeps its level).
/// - `Slot::LockAiPlans` (4.4 plan lock): `ai` (the Lite AI batch, every company not frozen,
///   newborns included).
/// - `Slot::LockConsensus` (4.4 plan lock): `market` (the projection and consensus, 5.16).
fn register_jobs(s: &mut Scheduler) {
    time::alerts::register(s);
    economy::register(s);
    ops::register(s);
    people::register(s);
    finance::register(s);
    market::register(s);
    births::jobs::register(s);
    ai::jobs::register(s);
    news::jobs::register(s);
    recap::jobs::register(s);
}

/// The whole start state (spec 7): the static tables and 7.1 loadouts, then the load's draws in
/// their frozen order (D163): the economy's (pop date, cycle start, zone shocks, Q1 2020 growth
/// draw; 7.3); the tipped lab (gen stream, right after the pop roll, D111, D281); the plan at
/// load (growth g_dem of the Q1 draw, D283; draws nothing); the boards' simple characters
/// (3.7.1, 7.1); the starting private companies' first IPO votes (gen stream, after the boards,
/// D276); then the books, which draw nothing (the starting rating, line limit and synthetic
/// history, 7.1 and 4.4); then the market (engine value, V and P at open_price, the indices at
/// 1,000, each quoted stock's EFV error; 7.1, 5.14, D150). The news wire starts from the load's
/// phase labels.
pub fn start_world(data: &WorldData, draws: &mut dyn DrawSource) -> Result<World, LoadError> {
    let mut world = World::from_data(data)?;
    economy::start(&mut world, draws);
    births::jobs::draw_tipped_lab_at_load(&mut world, draws);
    ai::jobs::plan_at_load(&mut world);
    people::seating::start(&mut world, draws);
    births::jobs::draw_first_votes(&mut world, draws);
    finance::start(&mut world);
    market::start(&mut world, draws);
    world.news.labels = world
        .industries
        .rows()
        .iter()
        .map(|i| i.phase_label)
        .collect();
    Ok(world)
}

/// A scheduler with every module's jobs, as a game runs them: for re-running steps on a cloned
/// world (the spec 5.16 projections) and for tests that drive the slots directly.
pub fn scheduler() -> Scheduler {
    let mut s = Scheduler::new();
    register_jobs(&mut s);
    s
}

/// A control that could not be applied.
#[derive(Debug, Error)]
pub enum SimError {
    #[error("speed {0} is outside 0 to {MAX_SPEED}")]
    BadSpeed(u8),
    #[error("no company {0}")]
    UnknownCompany(CompanyId),
    #[error("Omniscient is only available in debug builds")]
    DebugOnly,
    #[error(transparent)]
    Load(#[from] LoadError),
    #[error(transparent)]
    Save(#[from] save::SaveError),
}

/// The simulation: the world, its RNG streams, the scheduler that runs them and the controls.
pub struct Sim {
    data: Arc<WorldData>,
    world: World,
    rng: RngStreams,
    scheduler: Scheduler,
    controls: Controls,
    views: SimViews,
    trace: Option<Vec<Slot>>,
}

impl Sim {
    /// A new game from the loaded data and a seed: the start state of spec 7, paused at
    /// 2020-01-01 00:00 (spec 7.3).
    pub fn new(data: WorldData, seed: u64) -> Result<Sim, LoadError> {
        Sim::from_shared(Arc::new(data), seed)
    }

    fn from_shared(data: Arc<WorldData>, seed: u64) -> Result<Sim, LoadError> {
        let mut rng = RngStreams::new(seed);
        // The load's draws: cycle start, pop date, Q1 2020 growth draw (spec 7.3, D12), then the
        // boards (7.1).
        let world = start_world(&data, &mut rng)?;
        let scheduler = scheduler();
        let controls = Controls::default();
        let views = SimViews::build(&world, &controls, seed);
        Ok(Sim {
            data,
            world,
            rng,
            scheduler,
            controls,
            views,
            trace: None,
        })
    }

    /// Runs one tick (one hour, spec 4) and returns its notices in order; the last is always
    /// [`Notice::TickDone`]. It runs whether or not the game is paused: the runner decides how
    /// many steps to run from [`Controls::effective_speed`] (spec 9.1).
    pub fn step(&mut self) -> Vec<Notice> {
        self.step_inner(None)
    }

    /// [`Sim::step`], telling `observer` when each slot, job and the view refresh start and
    /// finish (build-plan M10.6 profiling, D400). The tick is the same as `step`'s: the observer
    /// sees no state and cannot change any.
    pub fn step_observed(&mut self, observer: &mut dyn TickObserver) -> Vec<Notice> {
        self.step_inner(Some(observer))
    }

    fn step_inner(&mut self, mut observer: Option<&mut dyn TickObserver>) -> Vec<Notice> {
        let mut notices = Vec::new();
        if let Some(t) = &mut self.trace {
            t.clear();
        }
        let alert_pause = self.scheduler.run_tick_observed(
            &mut self.world,
            &mut self.rng,
            &mut notices,
            &self.controls,
            self.trace.as_mut(),
            match &mut observer {
                Some(o) => Some(&mut **o),
                None => None,
            },
        );
        // Pauses go in just before the final TickDone.
        let done = notices.pop();
        if let Some(skip) = self.controls.skip
            && self.world.clock >= skip.target
        {
            self.controls.skip = None;
            self.pause(&mut notices, PauseReason::SkipDone(skip.kind));
        } else if let Some(reason) = alert_pause {
            self.pause(&mut notices, reason);
        }
        notices.extend(done);
        if let Some(o) = &mut observer {
            o.started(TickPart::Views);
        }
        self.views.refresh_after_tick(
            &self.world,
            &self.controls,
            self.rng.seed(),
            match &mut observer {
                Some(o) => Some(&mut **o),
                None => None,
            },
        );
        if let Some(o) = observer {
            o.finished(TickPart::Views);
        }
        notices
    }

    fn pause(&mut self, notices: &mut Vec<Notice>, reason: PauseReason) {
        if !self.controls.paused {
            self.controls.paused = true;
            notices.push(Notice::Paused(reason));
        }
    }

    /// Applies a control at once (D5) and returns any notices it causes.
    pub fn apply(&mut self, control: Control) -> Result<Vec<Notice>, SimError> {
        let mut notices = Vec::new();
        let c = &mut self.controls;
        match control {
            Control::NewGame { seed } => {
                let keep = std::mem::take(&mut self.controls);
                let fresh = match Sim::from_shared(Arc::clone(&self.data), seed) {
                    Ok(s) => s,
                    Err(e) => {
                        self.controls = keep;
                        return Err(e.into());
                    }
                };
                // The old views carry their refresh count over, so versions keep climbing.
                let mut views = std::mem::replace(self, fresh).views;
                self.controls.alerts = keep.alerts;
                views.rebuild(&self.world, &self.controls, self.rng.seed());
                self.views = views;
            }
            Control::SetSpeed(0) | Control::Pause => {
                c.skip = None;
                self.pause(&mut notices, PauseReason::Player);
            }
            Control::SetSpeed(n) if n <= MAX_SPEED => {
                c.skip = None;
                c.speed = n;
                c.paused = false;
            }
            Control::SetSpeed(n) => return Err(SimError::BadSpeed(n)),
            Control::Resume => c.paused = false,
            Control::SkipTo(kind) => {
                c.skip = Some(Skip {
                    kind,
                    target: skip_target(self.world.clock, kind),
                });
                c.paused = false;
            }
            Control::Save(path) => self.save(&path)?,
            Control::Load(path) => notices.extend(self.load(&path)?),
            Control::SetAlert { kind, level } => c.alerts.set(kind, level),
            Control::SetOmniscient(on) => {
                if !cfg!(debug_assertions) {
                    return Err(SimError::DebugOnly);
                }
                c.omniscient = on;
            }
            Control::WatchlistAdd(id) => {
                if self.world.companies.get(id).is_none() {
                    return Err(SimError::UnknownCompany(id));
                }
                c.watchlist.insert(id);
            }
            Control::WatchlistRemove(id) => {
                c.watchlist.remove(&id);
            }
        }
        self.views
            .refresh_after_control(&self.world, &self.controls, self.rng.seed());
        Ok(notices)
    }

    /// The state as save bytes (spec 9.1 `Save`; build-plan M1.7).
    pub fn save_bytes(&self) -> Vec<u8> {
        save::encode(&self.world, &self.rng, &self.controls)
    }

    /// Writes a save file.
    pub fn save(&self, path: &Path) -> Result<(), SimError> {
        std::fs::write(path, self.save_bytes()).map_err(save::SaveError::from)?;
        Ok(())
    }

    /// Replaces the state with a save's (spec 9.1 `Load`). The game comes back paused with no skip
    /// running (D13); the views are rebuilt (spec 9.4 "and on load"). The loaded data stays, for
    /// a later NewGame.
    pub fn load_bytes(&mut self, bytes: &[u8]) -> Result<Vec<Notice>, SimError> {
        let state = save::decode(bytes)?;
        self.world = state.world;
        self.rng = state.rng;
        self.controls = state.controls;
        self.controls.skip = None;
        self.controls.omniscient &= cfg!(debug_assertions);
        let mut notices = Vec::new();
        self.controls.paused = false;
        self.pause(&mut notices, PauseReason::Loaded);
        self.views
            .rebuild(&self.world, &self.controls, self.rng.seed());
        Ok(notices)
    }

    /// Reads a save file.
    pub fn load(&mut self, path: &Path) -> Result<Vec<Notice>, SimError> {
        let bytes = std::fs::read(path).map_err(save::SaveError::from)?;
        self.load_bytes(&bytes)
    }

    /// The time of the last finished tick.
    pub fn now(&self) -> DateTime {
        self.world.clock
    }

    /// The hash of the world and RNG positions (build-plan M1.8, 4.3).
    pub fn state_hash(&self) -> StateHash {
        hash::state_hash(&self.world, &self.rng)
    }

    /// The game seed.
    pub fn seed(&self) -> u64 {
        self.rng.seed()
    }

    /// The read-only views the UI reads (spec 9.2, 9.4).
    pub fn views(&self) -> &SimViews {
        &self.views
    }

    /// The clock (spec 9.1 `clock()`).
    pub fn clock(&self) -> &ClockView {
        self.views.clock()
    }

    /// The engine's true totals for the headless soak (D427), behind the `soak-stats` feature
    /// that only the headless runner enables: the game reads only [`Sim::views`] (spec 9).
    #[cfg(feature = "soak-stats")]
    pub fn soak_stats(&self) -> soak::SoakStats {
        soak::soak_stats(&self.world)
    }

    /// Read access to the world tables, for sim's own tests only (feature `test-hooks`). The
    /// game reads only [`Sim::views`] (spec 9), so it cannot call this.
    #[cfg(feature = "test-hooks")]
    pub fn world(&self) -> &World {
        &self.world
    }

    /// Adds a job to a slot after the built-in ones, for sim's own tests only (feature
    /// `test-hooks`): it lets determinism, save and hash tests run jobs that draw and write.
    /// A NewGame control drops it.
    #[cfg(feature = "test-hooks")]
    pub fn register_test_job(&mut self, slot: Slot, name: &'static str, job: time::JobFn) {
        self.scheduler.register(slot, name, job);
    }

    /// Speed, pause, skip, alert levels, Omniscient and the watchlist.
    pub fn controls(&self) -> &Controls {
        &self.controls
    }

    /// Records which slots each tick visits (build-plan M1.3).
    pub fn set_trace(&mut self, on: bool) {
        self.trace = on.then(Vec::new);
    }

    /// The slots the last tick visited, in order (empty unless tracing).
    pub fn last_trace(&self) -> &[Slot] {
        self.trace.as_deref().unwrap_or(&[])
    }

    /// The loaded data this game was built from.
    pub fn data(&self) -> &WorldData {
        &self.data
    }
}
