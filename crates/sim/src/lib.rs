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
pub mod time;
pub mod world;

use rand_chacha::ChaCha8Rng;
use rand_core::SeedableRng;

pub use world::World;

/// The seeded RNG used for every stream: ChaCha8, which gives the same draws for the same seed in
/// every release (build-plan 2.2, spec 3.1).
pub type SimRng = ChaCha8Rng;

/// Makes a stream from the game seed. M1.2 splits this into the cycle, growth, prices, AI and gen
/// streams.
pub fn rng_from_seed(seed: u64) -> SimRng {
    SimRng::seed_from_u64(seed)
}
