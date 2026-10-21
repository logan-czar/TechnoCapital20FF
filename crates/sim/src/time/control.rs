//! Controls (spec 9.1, 8 time controls row; build-plan M1.5): speed, pause, SkipTo, alert levels,
//! and the build's additions logged as design fix 8 (SetAlert, SetOmniscient, the watchlist).
//!
//! Controls change only how the runner runs the sim (speed, pause, skip, alerts) and what the
//! player watches, never the economy, so [`crate::Sim::apply`] applies them at once (D5) and they
//! are saved but not part of the state hash (D13).

use std::collections::BTreeSet;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::calendar::{DateTime, Month};
use super::quarter::{QuarterPhase, next_phase_start};
use crate::world::{AlertKind, AlertLevel, AlertLevels, CompanyId, SkipKind};

/// Fastest speed; 0 is paused (spec 3.1 `speed`, 9.1).
pub const MAX_SPEED: u8 = 5;
/// The speed a new game is set to; it starts paused (spec 7.3; D8).
pub const START_SPEED: u8 = 1;
/// Real seconds per game hour at speeds 1 to 5; speed 5 runs as fast as it can (spec 8, 9.1).
pub const SECONDS_PER_HOUR: [Option<f64>; MAX_SPEED as usize] =
    [Some(2.0), Some(1.0), Some(0.5), Some(0.2), None];

/// A control event from the UI (spec 9.1, plus design fix 8).
#[derive(Debug, Clone, PartialEq)]
pub enum Control {
    /// A new game from the same data (spec 7).
    NewGame {
        seed: u64,
    },
    /// 0 pauses; 1 to 5 set the speed and resume (D8).
    SetSpeed(u8),
    Pause,
    Resume,
    /// Run at max speed until that tick, then pause (spec 9.1).
    SkipTo(SkipKind),
    Save(PathBuf),
    Load(PathBuf),
    /// Set one alert's level (spec 8; design fix 8).
    SetAlert {
        kind: AlertKind,
        level: AlertLevel,
    },
    /// Show every true value (spec 1, Information). Debug builds only (design fix 8).
    SetOmniscient(bool),
    /// Watchlist (spec 8 outliner; design fix 8).
    WatchlistAdd(CompanyId),
    WatchlistRemove(CompanyId),
}

/// A SkipTo in progress.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Skip {
    pub kind: SkipKind,
    /// The tick it stops after.
    pub target: DateTime,
}

/// The runner-facing settings (not part of the state hash, D13).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Controls {
    /// 1 to 5, kept while paused.
    pub speed: u8,
    pub paused: bool,
    pub skip: Option<Skip>,
    pub alerts: AlertLevels,
    pub omniscient: bool,
    pub watchlist: BTreeSet<CompanyId>,
}

impl Default for Controls {
    /// A new game: paused at speed 1 with the default alert levels (spec 7.3, 8).
    fn default() -> Self {
        Controls {
            speed: START_SPEED,
            paused: true,
            skip: None,
            alerts: AlertLevels::default(),
            omniscient: false,
            watchlist: BTreeSet::new(),
        }
    }
}

impl Controls {
    /// The speed the runner should run at: 0 when paused, max while skipping (spec 9.1).
    pub fn effective_speed(&self) -> u8 {
        if self.paused {
            0
        } else if self.skip.is_some() {
            MAX_SPEED
        } else {
            self.speed
        }
    }

    /// Real seconds per tick at the effective speed; `None` when paused or at max speed.
    pub fn seconds_per_tick(&self) -> Option<f64> {
        match self.effective_speed() {
            0 => None,
            s => SECONDS_PER_HOUR[usize::from(s - 1)],
        }
    }
}

/// The tick a SkipTo started at `now` stops after: the next one strictly after `now` (D8).
pub fn skip_target(now: DateTime, kind: SkipKind) -> DateTime {
    match kind {
        SkipKind::NextRelease => next_phase_start(now, QuarterPhase::Release),
        SkipKind::NextLock => next_phase_start(now, QuarterPhase::Locked),
        SkipKind::NextRecap => next_phase_start(now, QuarterPhase::PreQuarterEnd),
        // The monthly close of the month in progress: 00:00 on the next 1st (spec 4.3).
        SkipKind::MonthEnd => DateTime::midnight(Month::next(now.date().month_of()).first_day()),
    }
}
