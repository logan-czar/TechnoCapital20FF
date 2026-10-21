//! The TechnoCapital20FF simulation (build-plan 2.1). No Bevy dependency: it runs the same in the
//! game, in tests and in the headless runner, deterministic on one machine (build-plan 6, decision A).

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

pub use rng::{DrawSource, RngStreams, Stream};
pub use world::World;
