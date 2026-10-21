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
pub mod world;

use std::sync::Arc;

use sim_data::WorldData;

pub use rng::{DrawSource, RngStreams, Stream};
use time::{DateTime, Scheduler, Slot};
use world::AlertLevels;
pub use world::{LoadError, Notice, World};

/// Registers every module's jobs in their slots (spec 4). Each milestone adds its module's
/// `register` call here; the scheduler itself never changes.
fn register_jobs(s: &mut Scheduler) {
    time::alerts::register(s);
}

/// The simulation: the world, its RNG streams and the scheduler that runs them.
pub struct Sim {
    data: Arc<WorldData>,
    world: World,
    rng: RngStreams,
    scheduler: Scheduler,
    alert_levels: AlertLevels,
    trace: Option<Vec<Slot>>,
}

impl Sim {
    /// A new game from the loaded data and a seed: the start state of spec 7, paused at
    /// 2020-01-01 00:00 (spec 7.3).
    pub fn new(data: WorldData, seed: u64) -> Result<Sim, LoadError> {
        let world = World::from_data(&data)?;
        let mut scheduler = Scheduler::new();
        register_jobs(&mut scheduler);
        Ok(Sim {
            data: Arc::new(data),
            world,
            rng: RngStreams::new(seed),
            scheduler,
            alert_levels: AlertLevels::default(),
            trace: None,
        })
    }

    /// Runs one tick (one hour, spec 4) and returns its notices in order; the last is always
    /// [`Notice::TickDone`].
    pub fn step(&mut self) -> Vec<Notice> {
        let mut notices = Vec::new();
        if let Some(t) = &mut self.trace {
            t.clear();
        }
        let trace = self.trace.as_mut();
        self.scheduler.run_tick(
            &mut self.world,
            &mut self.rng,
            &mut notices,
            &self.alert_levels,
            true,
            trace,
        );
        notices
    }

    /// The time of the last finished tick.
    pub fn now(&self) -> DateTime {
        self.world.clock
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
