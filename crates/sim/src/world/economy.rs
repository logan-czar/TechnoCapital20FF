//! World-level economy state (spec 3.1): the global business cycle and the AI boom. The formulas
//! that move it live in [`crate::economy`].

use serde::{Deserialize, Serialize};

use crate::time::Date;

/// The global cycle's phases, in order (spec 5.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum CyclePhase {
    Expansion,
    Overheating,
    Contraction,
    Recovery,
}

impl CyclePhase {
    pub const ALL: [CyclePhase; 4] = [
        CyclePhase::Expansion,
        CyclePhase::Overheating,
        CyclePhase::Contraction,
        CyclePhase::Recovery,
    ];

    pub fn name(self) -> &'static str {
        match self {
            CyclePhase::Expansion => "Expansion",
            CyclePhase::Overheating => "Overheating",
            CyclePhase::Contraction => "Contraction",
            CyclePhase::Recovery => "Recovery",
        }
    }
}

/// The global business cycle (spec 3.1, 5.1).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GlobalCycle {
    pub phase: CyclePhase,
    /// Quarters left in the phase, this quarter included (the phase ends when it reaches 0).
    pub quarters_left: u32,
    /// The cycle value: the phase's push on demand growth, a year, for a zone of intensity 1.0.
    pub g_t: f64,
    /// g of this quarter and the ones before, newest first, as far back as the longest zone lag
    /// (spec 5.1 `g(t − lag)`; before the start, the starting g_t).
    pub g_history: Vec<f64>,
    /// Z, the GDP-weighted average zone intensity (spec 5.1), static in the MVP.
    pub z_avg: f64,
}

impl GlobalCycle {
    /// g lag quarters ago (spec 5.1).
    pub fn g_lagged(&self, lag: u32) -> f64 {
        let i = (lag as usize).min(self.g_history.len().saturating_sub(1));
        self.g_history.get(i).copied().unwrap_or(self.g_t)
    }
}

/// The AI stage (spec 3.1, 5.1.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum AiStage {
    Preboom,
    Boom,
    Bust,
    Postcrash,
}

impl AiStage {
    pub fn name(self) -> &'static str {
        match self {
            AiStage::Preboom => "Preboom",
            AiStage::Boom => "Boom",
            AiStage::Bust => "Bust",
            AiStage::Postcrash => "Postcrash",
        }
    }
}

/// AI labs' long-term rate by stage, from ai-boom.csv (spec 5.1.1).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AiSchedule {
    pub preboom_lt: f64,
    /// By boom year 0, 1, 2...; the last holds for every later year.
    pub boom_lt: Vec<f64>,
    pub bust_lt: f64,
    pub postcrash_lt: f64,
}

/// The AI boom and the bubble (spec 3.1, 5.1.1).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AiBoom {
    pub stage: AiStage,
    /// The boom event (1 January 2030).
    pub boom_date: Date,
    /// The pop, rolled at load.
    pub pop_date: Date,
    /// AI labs' long-term rate this quarter (spec 5.1.1).
    pub ai_labs_lt: f64,
    pub schedule: AiSchedule,
}
