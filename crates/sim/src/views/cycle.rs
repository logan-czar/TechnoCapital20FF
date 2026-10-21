//! v_cycle: `get_cycle()` (spec 9.2): the global phase, g_t, quarters left, Z, every zone's
//! cycle settings, effect and spreads, and the AI stage, boom year and boom date; the rolled pop
//! date only in Omniscient. Rebuilt monthly, on load and after a control (the Omniscient toggle
//! shows or hides the pop date).

use super::{Cadence, ViewData, ViewInput};
use crate::economy::ai_boom::{boom_year, stage_at};
use crate::time::Date;
use crate::world::{AiStage, CyclePhase, ZoneId};

/// One zone of the cycle view (spec 8 Financial zones map mode hover, 9.2).
#[derive(Debug, Clone, PartialEq)]
pub struct ZoneCycleRow {
    pub id: ZoneId,
    pub number: u32,
    pub key: String,
    pub name: String,
    pub exchange_code: String,
    pub intensity: f64,
    pub lag_quarters: u32,
    pub contagion: f64,
    /// `intensity × g(t − lag)` plus any own shock, a yearly rate (spec 5.1).
    pub effect: f64,
    pub gdp_share: f64,
    /// Base and effective credit spread, fractions (spec 5.1.2).
    pub credit_spread_base: f64,
    pub credit_spread: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CycleView {
    pub phase: CyclePhase,
    pub g_t: f64,
    pub quarters_left: u32,
    pub z_avg: f64,
    pub base_rate: f64,
    pub zones: Vec<ZoneCycleRow>,
    pub ai_stage: AiStage,
    /// Whole years into the boom, while it runs (spec 5.1.1).
    pub boom_year: Option<u32>,
    pub boom_date: Date,
    /// AI labs' long-term rate this quarter.
    pub ai_labs_lt: f64,
    /// The rolled pop date: only in Omniscient (spec 9.2).
    pub pop_date: Option<Date>,
}

impl ViewData for CycleView {
    const CADENCE: Cadence = Cadence::Monthly;
    const ON_CONTROL: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let c = &w.cycle;
        let (stage, quarters_in) = stage_at(w.clock.date(), w.ai.boom_date, w.ai.pop_date);
        CycleView {
            phase: c.phase,
            g_t: c.g_t,
            quarters_left: c.quarters_left,
            z_avg: c.z_avg,
            base_rate: w.base_rate,
            zones: w
                .zones
                .iter()
                .map(|(id, z)| ZoneCycleRow {
                    id,
                    number: z.number,
                    key: z.key.clone(),
                    name: z.name.clone(),
                    exchange_code: z.exchange_code.clone(),
                    intensity: z.intensity,
                    lag_quarters: z.lag_quarters,
                    contagion: z.contagion,
                    effect: z.effect,
                    gdp_share: z.gdp_share,
                    credit_spread_base: z.credit_spread_base,
                    credit_spread: z.credit_spread,
                    confidence: z.confidence,
                })
                .collect(),
            ai_stage: w.ai.stage,
            boom_year: (stage == AiStage::Boom).then(|| boom_year(quarters_in)),
            boom_date: w.ai.boom_date,
            ai_labs_lt: w.ai.ai_labs_lt,
            pop_date: input.controls.omniscient.then_some(w.ai.pop_date),
        }
    }
}
