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
use time::{DateTime, Scheduler, Slot};
pub use views::ClockView;
pub use views::SimViews;
use world::{CompanyId, PauseReason};
pub use world::{LoadError, Notice, World};

/// Registers every module's jobs in their slots (spec 4). Each milestone adds its module's
/// `register` call here; the scheduler itself never changes.
///
/// **Order inside one slot is registration order**, so where two modules put jobs in the same
/// slot, the order of their `register` calls below is part of the job order and must follow
/// the spec text for that step. Slots shared now: none (only `time` registers, in
/// `Slot::Alerts`). Slots expected to be shared, in the order their calls must go:
///
/// - `Slot::Alerts`: `time` (calendar alerts) only; other modules raise alerts from their own
///   slots through `JobCtx::raise_alert`.
/// - `Slot::MonthlyAiEvents` (4.3 step 1): `economy` (boom and pop, 5.1.1), then `news` (the
///   chatbot headline, 5.18).
/// - `Slot::MonthlyLaborSeats` (4.3 step 4): `ops` (labor units, seats, stations, 5.10).
/// - `Slot::MonthlyExpenses` (4.3 step 9): `economy` (variable, fixed, R&D, shared, 5.5), then
///   `finance` (depreciation and tax accrual, 5.5, 5.11).
/// - `Slot::MonthlyAssets` (4.3 step 11): `finance` (asset decay, growth plan buys and sells,
///   ramping, 5.10), then `people` (simple characters for new seats, 3.7.1).
/// - `Slot::PriceMoveResultHeadlines` (4.4 price move): `news` only.
/// - `Slot::LockIpoVotes` (4.4 plan lock): `births` (votes, then listings, 5.20.1).
fn register_jobs(s: &mut Scheduler) {
    time::alerts::register(s);
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
        let world = World::from_data(&data)?;
        let mut scheduler = Scheduler::new();
        register_jobs(&mut scheduler);
        let controls = Controls::default();
        let views = SimViews::build(&world, &controls);
        Ok(Sim {
            data,
            world,
            rng: RngStreams::new(seed),
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
        let mut notices = Vec::new();
        if let Some(t) = &mut self.trace {
            t.clear();
        }
        let alert_pause = self.scheduler.run_tick(
            &mut self.world,
            &mut self.rng,
            &mut notices,
            &self.controls,
            self.trace.as_mut(),
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
        self.views.refresh_after_tick(&self.world, &self.controls);
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
                *self = Sim::from_shared(Arc::clone(&self.data), seed)?;
                self.controls.alerts = keep.alerts;
                self.views = SimViews::build(&self.world, &self.controls);
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
        self.views.refresh_clock(&self.world, &self.controls);
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
        self.views = SimViews::build(&self.world, &self.controls);
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
