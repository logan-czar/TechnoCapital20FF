//! The TechnoCapital20FF simulation (build-plan 2.1). No Bevy dependency: it runs the same in the
//! game, in tests and in the headless runner, deterministic on one machine (build-plan 6, decision A).
//!
//! The public API is [`Sim`]: `Sim::new(data, seed)`, `Sim::step()` (one hourly tick, returning its
//! notices) and `Sim::apply(control)`.

pub mod ai;
pub mod births;
pub mod economy;
pub mod finance;
pub mod market;
pub mod news;
pub mod ops;
pub mod people;
pub mod recap;
pub mod rng;
pub mod time;
pub mod views;
pub mod world;

use std::sync::Arc;

use sim_data::WorldData;
use thiserror::Error;

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
    #[error("saves arrive in M1.7")]
    Unsupported,
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
        let pause_on_alert = self.controls.skip.is_none();
        let alert_pause = self.scheduler.run_tick(
            &mut self.world,
            &mut self.rng,
            &mut notices,
            &self.controls.alerts,
            pause_on_alert,
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
            Control::Save(_) | Control::Load(_) => return Err(SimError::Unsupported),
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

    /// The time of the last finished tick.
    pub fn now(&self) -> DateTime {
        self.world.clock
    }

    /// The read-only views the UI reads (spec 9.2, 9.4).
    pub fn views(&self) -> &SimViews {
        &self.views
    }

    /// The clock (spec 9.1 `clock()`).
    pub fn clock(&self) -> &ClockView {
        self.views.clock()
    }

    /// Read access to the world tables, for tests and headless reports; the game reads only
    /// [`Sim::views`] (spec 9).
    pub fn world(&self) -> &World {
        &self.world
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
