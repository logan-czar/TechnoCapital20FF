//! Notices from the sim to the UI (spec 9.3) and the alert kinds and levels they carry (spec 8
//! time controls row). Shared by every module, so they live in `world/`.

use serde::{Deserialize, Serialize};

use super::ids::{CompanyId, StartupEventId};
use crate::time::{Date, DateTime, Month, Quarter};

/// One thing that happened in a tick, in the order it happened (spec 9.3). [`crate::Sim::step`]
/// returns them as a list; the Bevy bridge turns each into an event (build-plan M7.2).
#[derive(Debug, Clone, PartialEq)]
pub enum Notice {
    /// The tick at this time finished; always the last notice of a step.
    TickDone(DateTime),
    /// The daily jobs closed this day (the day just ended; decision D10).
    DayDone(Date),
    /// The monthly jobs closed this month (the month just ended; D10).
    MonthDone(Month),
    /// This quarter's statements were published (the quarter just ended: the 2 Jan 2020 release
    /// is Q4 2019; D10).
    EarningsReleased(Quarter),
    /// Plans were locked for this quarter (the calendar quarter the lock falls in; D10).
    PlanLocked(Quarter),
    StartupEvent(StartupEventId),
    CompanyBorn(CompanyId),
    IpoVote {
        company: CompanyId,
        passed: bool,
    },
    CompanyListed(CompanyId),
    /// An alert fired at a level other than Off. The level is carried so the UI knows whether to
    /// show a toast or only log it (D6).
    Alert {
        kind: AlertKind,
        level: AlertLevel,
        payload: AlertPayload,
    },
    Paused(PauseReason),
}

/// The alerts the player can set (spec 8 time controls row; 5.1.1 for the world event).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum AlertKind {
    /// The release tick (spec 4.4 row 1).
    EarningsDay,
    /// The start of the pre-quarter-end week (spec 4.4 row 5).
    QuarterlyRecap,
    /// The plan lock tick (spec 4.4 row 3).
    PlanLock,
    /// A watchlist company went bankrupt (spec 8, 5.12).
    BankruptcyInWatchlist,
    /// A scripted world event: the AI boom and the pop (spec 5.1.1).
    WorldEvent,
    /// The quarter's first tick, 00:00 on the 1st (spec 4.4): the month's and the quarter's
    /// close, the costliest tick (D800). Last, so the other kinds keep their saved order.
    QuarterStart,
}

impl AlertKind {
    pub const ALL: [AlertKind; 6] = [
        AlertKind::EarningsDay,
        AlertKind::QuarterlyRecap,
        AlertKind::PlanLock,
        AlertKind::BankruptcyInWatchlist,
        AlertKind::WorldEvent,
        AlertKind::QuarterStart,
    ];

    pub fn index(self) -> usize {
        self as usize
    }

    /// The default level (spec 8: Earnings day Pause, Quarterly recap Pause, Bankruptcy in
    /// watchlist Notify; spec 5.1.1: World event Pause). Plan lock (spec 8: Log) and Quarter
    /// start are Pause, so the game stops on the quarter's heavy ticks (D800, Logan 2026-10-23;
    /// design fix 800).
    pub fn default_level(self) -> AlertLevel {
        match self {
            AlertKind::EarningsDay
            | AlertKind::QuarterlyRecap
            | AlertKind::WorldEvent
            | AlertKind::PlanLock
            | AlertKind::QuarterStart => AlertLevel::Pause,
            AlertKind::BankruptcyInWatchlist => AlertLevel::Notify,
        }
    }
}

/// What an alert does when it fires (spec 8).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum AlertLevel {
    /// Notify and pause the game after this tick.
    Pause,
    /// Show it.
    Notify,
    /// Only write it to the log.
    Log,
    /// Nothing.
    Off,
}

/// The level set for each alert kind (spec 8; changed by `Control::SetAlert`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AlertLevels([AlertLevel; AlertKind::ALL.len()]);

impl Default for AlertLevels {
    /// The spec 8 defaults.
    fn default() -> Self {
        AlertLevels(AlertKind::ALL.map(AlertKind::default_level))
    }
}

impl AlertLevels {
    /// Every alert Off: for runs whose alerts nobody sees, such as projections (spec 5.16).
    pub fn all_off() -> Self {
        AlertLevels([AlertLevel::Off; AlertKind::ALL.len()])
    }

    pub fn get(&self, kind: AlertKind) -> AlertLevel {
        self.0[kind.index()]
    }

    pub fn set(&mut self, kind: AlertKind, level: AlertLevel) {
        self.0[kind.index()] = level;
    }
}

/// What an alert is about.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlertPayload {
    None,
    Quarter(Quarter),
    Company(CompanyId),
}

/// The SkipTo targets (spec 9.1, 8 Skip menu).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum SkipKind {
    /// The next release tick (spec 4.4 row 1).
    NextRelease,
    /// The next plan lock tick (spec 4.4 row 3).
    NextLock,
    /// The next start of the pre-quarter-end week, when the recap opens (spec 4.4 row 5).
    NextRecap,
    /// The next monthly close: 00:00 on the 1st (spec 4.3).
    MonthEnd,
}

/// Why the game paused.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PauseReason {
    /// A `Pause` or `SetSpeed(0)` control.
    Player,
    /// An alert set to Pause fired.
    Alert(AlertKind),
    /// A SkipTo reached its tick.
    SkipDone(SkipKind),
    /// A save was loaded (D13).
    Loaded,
}
