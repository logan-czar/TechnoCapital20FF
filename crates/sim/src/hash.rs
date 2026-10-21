//! The state hash (build-plan M1.8, 4.3): blake3 over every table in id order plus the RNG
//! positions.
//!
//! It hashes the postcard encoding of the [`World`] and the [`RngStreams`], so every field any
//! milestone adds is covered with no extra code. postcard writes each f64 as its 8 raw bytes, so
//! floats are hashed by their bits (build-plan 4.3: same seed, build, OS and CPU, same hash);
//! tables are `Vec`s in id order and maps are `BTreeMap`s, so the order is fixed. The controls
//! (speed, pause, alerts, watchlist) are not hashed: they never change the world (D13).

use std::fmt;

use crate::rng::RngStreams;
use crate::world::World;

/// Bumped when the hashed layout changes on purpose, so old hashes cannot match by accident.
pub const HASH_FORMAT: u32 = 1;

/// A 256-bit state hash.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct StateHash(pub [u8; 32]);

impl StateHash {
    /// The first 16 hex digits, for logs.
    pub fn short(&self) -> String {
        self.to_string()[..16].to_owned()
    }
}

impl fmt::Display for StateHash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for b in self.0 {
            write!(f, "{b:02x}")?;
        }
        Ok(())
    }
}

/// The hash of the simulation state.
pub fn state_hash(world: &World, rng: &RngStreams) -> StateHash {
    let mut hasher = blake3::Hasher::new();
    postcard::to_io(&(HASH_FORMAT, world, rng), &mut hasher)
        .expect("serializing into a hasher cannot fail");
    StateHash(*hasher.finalize().as_bytes())
}
