//! The TechnoCapital20FF simulation (build-plan 2.1). No Bevy dependency: it runs the same in the
//! game, in tests and in the headless runner, deterministic on one machine (build-plan 6, decision A).
//!
//! M0 holds only a placeholder `World` and the RNG choice; the clock, scheduler and formulas arrive
//! from M1 on.

use rand_chacha::ChaCha8Rng;
use rand_core::SeedableRng;
use sim_data::WorldData;

/// The seeded RNG used for every stream: ChaCha8, which gives the same draws for the same seed in
/// every release (build-plan 2.2, spec 3.1).
pub type SimRng = ChaCha8Rng;

/// Makes a stream from the game seed. M1.2 splits this into the cycle, growth, prices, AI and gen
/// streams.
pub fn rng_from_seed(seed: u64) -> SimRng {
    SimRng::seed_from_u64(seed)
}

/// Placeholder for the simulation state (filled in from M1).
#[derive(Debug)]
pub struct World {
    pub data: WorldData,
    pub seed: u64,
}

impl World {
    pub fn new(data: WorldData, seed: u64) -> Self {
        Self { data, seed }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand_core::RngCore;

    #[test]
    fn same_seed_same_draws() {
        let (mut a, mut b) = (rng_from_seed(7), rng_from_seed(7));
        for _ in 0..1000 {
            assert_eq!(a.next_u64(), b.next_u64());
        }
    }
}
