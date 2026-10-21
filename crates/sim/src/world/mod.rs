//! The world state: ids, Vec-backed tables in id order, and the types every module shares
//! (spec 3; build-plan 2.3 `world/`).
//!
//! # The pure step contract
//!
//! Every scheduled job (spec 4) is a plain `fn(&mut World, &mut JobCtx)` (see
//! [`crate::time::scheduler::JobFn`]). A job:
//!
//! - reads and writes only the [`World`] it is given and the [`JobCtx`](crate::time::JobCtx);
//! - takes every random number from `ctx.draws`, an injected [`DrawSource`](crate::rng::DrawSource),
//!   never from a global or thread-local RNG;
//! - never reads the wall clock, the file system, the controls or the views;
//! - iterates tables in id order and never iterates a `HashMap` or `HashSet`.
//!
//! `World` is `Clone`. The spec 5.16 projection ranges re-run the monthly economy (spec 4.3) on a
//! clone with [`NoNoise`](crate::rng::NoNoise) draws ("no rolls") and read the result; the M2.10
//! growth check replays validate.py's draws through a scripted source. Both work only because of
//! this contract, so keep it: a job that reaches outside its arguments breaks projections, saves
//! and the state hash at once.
//!
//! Everything in `World` derives serde, so a new field is saved (save.rs) and hashed (hash.rs)
//! with no extra code. Shared types (ids, notices, alert kinds) live here, since each later
//! milestone's builder owns one folder.

pub mod entities;
pub mod ids;
pub mod load;
pub mod notice;
pub mod table;
pub mod units;

use serde::{Deserialize, Serialize};

pub use entities::{Character, Company, Country, Industry, Province, Zone};
pub use ids::{
    CharacterId, CompanyId, CountryId, IndustryId, Ordinal, ProvinceId, StartupEventId, ZoneId,
};
pub use load::LoadError;
pub use notice::{AlertKind, AlertLevel, AlertPayload, Notice, PauseReason, SkipKind};
pub use table::Table;

use crate::time::DateTime;

/// All simulation state except the RNG streams (spec 3.1 to 3.10). Static tables are kept here too,
/// so a save holds everything and loads without the CSVs.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct World {
    /// The clock: the time of the last finished tick (spec 3.1; starts 2020-01-01 00:00).
    pub clock: DateTime,
    pub zones: Table<ZoneId, Zone>,
    pub countries: Table<CountryId, Country>,
    pub provinces: Table<ProvinceId, Province>,
    pub industries: Table<IndustryId, Industry>,
    pub companies: Table<CompanyId, Company>,
    pub characters: Table<CharacterId, Character>,
}

impl World {
    /// The start state from the loaded data (spec 7).
    pub fn from_data(data: &sim_data::WorldData) -> Result<World, LoadError> {
        load::build_world(data)
    }
}
