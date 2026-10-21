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

pub mod economy;
pub mod entities;
pub mod ids;
pub mod load;
pub mod log;
pub mod notice;
pub mod table;
pub mod units;

use serde::{Deserialize, Serialize};

pub use economy::{AiBoom, AiSchedule, AiStage, CyclePhase, GlobalCycle};
pub use entities::{
    BusinessUnit, Character, Company, CompanyData, ControllerRef, Country, Director, Holder,
    Holding, Industry, IndustryParams, IndustryQuarter, IpoVoteRecord, Origin, PhaseLabel,
    Province, SeatHolder, SimpleSeat, StartControl, Tranche, Zone,
};
pub use ids::{
    CharacterId, CompanyId, CountryId, IndustryId, Ordinal, ProvinceId, StartupEventId, UnitId,
    ZoneId,
};
pub use load::LoadError;
pub use notice::{AlertKind, AlertLevel, AlertLevels, AlertPayload, Notice, PauseReason, SkipKind};
pub use table::Table;

use crate::births::state::BirthsState;
use crate::finance::state::BooksCheck;
use crate::market::state::MarketState;
use crate::news::NewsWire;
use crate::people::names::NameBooks;
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
    /// Business units (spec 3.6), one per company in the MVP.
    pub units: Table<UnitId, BusinessUnit>,
    /// World base rate (spec 3.1), fixed in the MVP.
    pub base_rate: f64,
    /// Neutral rate (spec 3.1); demand's rate term is 0 while the base rate sits here (5.1).
    pub neutral_rate: f64,
    /// The global business cycle (spec 3.1, 5.1).
    pub cycle: GlobalCycle,
    /// The AI boom and the bubble (spec 3.1, 5.1.1).
    pub ai: AiBoom,
    /// Person names per country, built once at load (spec 3.7.1, 3.7.2): jobs see no CSVs and a
    /// save loads without them (D13).
    pub name_books: NameBooks,
    /// Simple characters generated so far, so the next one's id (spec 3.7.1 `id`).
    pub simple_characters_made: u32,
    /// The engine's run of the build-plan M4.9 balance check (finance::jobs).
    pub books_check: BooksCheck,
    /// Prices, fair values, bars and the headline indices (spec 3.10, 5.13 to 5.15; M5).
    pub market: MarketState,
    /// Fixed events, the startup event log, company names, province weights and the tipped lab
    /// (spec 3.1 `startup_events`, 5.19; M6).
    pub births: BirthsState,
    /// The Pdoomberg Wire (spec 5.18; M6).
    pub news: NewsWire,
    /// The last quarterly recap (spec 8, 21.6.2), built at the start of the pre-quarter-end
    /// week; shared with v_recap.
    pub recap: Option<std::sync::Arc<crate::recap::jobs::Recap>>,
}

impl World {
    /// The static start state from the loaded data (spec 7): tables, units, fringe pools, the
    /// 7.1 loadouts (labor, stations, PC, data, compute) and everything else load sets without a
    /// draw. [`crate::economy::start`] then makes the economy's load draws (the cycle start, the
    /// pop date and the Q1 2020 growth draw, spec 7.3) and [`crate::people::seating::start`]
    /// seats the boards (3.7.1, 7.1); `Sim::new` does all three.
    pub fn from_data(data: &sim_data::WorldData) -> Result<World, LoadError> {
        load::build_world(data)
    }
}
