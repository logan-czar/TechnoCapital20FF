//! The global business cycle and the zone effects (spec 5.1, Logan batches 150, 152 and 154;
//! 4.3 step 1c).
//!
//! One world cycle sits in one phase at a time. Entering a phase draws g_t and the phase length,
//! both uniform in the phase's ranges; phases change only at quarter boundaries. Each zone feels
//! `zone_effect_z = intensity_z × g(t − lag_z)`, plus a zone-only shock where the zone has its own
//! dynamics (own_shock_sd above 0). World demand reads `Z × g_t` with no lag (spec 5.1 "Zone
//! weighting"); the zone effects move only the zone screens and the credit spreads (5.1.2).

use crate::rng::{DrawSource, Stream};
use crate::time::JobCtx;
use crate::world::{CyclePhase, GlobalCycle, World};

/// What a phase draws on entry and where it goes next (spec 5.1 table, T).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PhaseSpec {
    /// g_t a year, drawn uniform in `lo..hi`.
    pub g_range: (f64, f64),
    /// Length in whole quarters, drawn uniform in `lo..=hi` (D101).
    pub length: (u32, u32),
    pub next: CyclePhase,
}

/// The spec 5.1 phase table (T). The Contraction and Recovery ranges are written low to high, as
/// validate.py draws them, so a replayed uniform gives the same g to the bit.
pub fn phase_spec(phase: CyclePhase) -> PhaseSpec {
    match phase {
        CyclePhase::Expansion => PhaseSpec {
            g_range: (0.0, 0.02),
            length: (12, 28),
            next: CyclePhase::Overheating,
        },
        CyclePhase::Overheating => PhaseSpec {
            g_range: (0.02, 0.04),
            length: (2, 6),
            next: CyclePhase::Contraction,
        },
        CyclePhase::Contraction => PhaseSpec {
            g_range: (-0.06, -0.03),
            length: (2, 8),
            next: CyclePhase::Recovery,
        },
        CyclePhase::Recovery => PhaseSpec {
            g_range: (-0.02, 0.01),
            length: (4, 10),
            next: CyclePhase::Expansion,
        },
    }
}

/// The game starts in Expansion (spec 7.3).
pub const START_PHASE: CyclePhase = CyclePhase::Expansion;

/// The growth and own-shock draws are standard normals clamped to ±3 (spec 5.1; D102 for the
/// own shock).
pub const NORMAL_CLAMP: f64 = 3.0;

/// The draws on entering `phase` (spec 5.1): g_t = lo + (hi − lo) × u from one cycle-stream
/// uniform, then the length as a uniform whole number of quarters (D101). Same order and formula
/// as validate.py's `rng.uniform` then `rng.randint`.
pub fn enter_phase(phase: CyclePhase, draws: &mut dyn DrawSource) -> (f64, u32) {
    let spec = phase_spec(phase);
    let (lo, hi) = spec.g_range;
    let g = lo + (hi - lo) * draws.uniform(Stream::Cycle);
    let (a, b) = spec.length;
    let len = draws.int_inclusive(Stream::Cycle, i64::from(a), i64::from(b));
    (g, u32::try_from(len).expect("phase length is positive"))
}

/// The cycle at load (spec 7.3): Expansion with g_t and its quarters left drawn; the g history
/// holds the starting g_t for every lag (spec 5.1 "before the start, the starting g_t").
pub fn start_cycle(max_lag: u32, z_avg: f64, draws: &mut dyn DrawSource) -> GlobalCycle {
    let (g, len) = enter_phase(START_PHASE, draws);
    GlobalCycle {
        phase: START_PHASE,
        quarters_left: len,
        g_t: g,
        g_history: vec![g; max_lag as usize + 1],
        z_avg,
    }
}

/// Advances the cycle one quarter (spec 4.3 step 1c): one quarter of the phase is used up; when
/// none is left the next phase starts with fresh draws. The g history shifts by one quarter.
pub fn advance_cycle(cycle: &mut GlobalCycle, draws: &mut dyn DrawSource) {
    cycle.quarters_left = cycle.quarters_left.saturating_sub(1);
    if cycle.quarters_left == 0 {
        cycle.phase = phase_spec(cycle.phase).next;
        let (g, len) = enter_phase(cycle.phase, draws);
        cycle.g_t = g;
        cycle.quarters_left = len;
    }
    if !cycle.g_history.is_empty() {
        cycle.g_history.rotate_right(1);
        cycle.g_history[0] = cycle.g_t;
    }
}

/// `Z = Σ gdp_c × intensity_zone(c) ÷ Σ gdp_c` (spec 5.1), from `(gdp, intensity)` per country in
/// id order. 1.07 at the 2020 data; static while GDP is static.
pub fn z_avg(countries: impl IntoIterator<Item = (f64, f64)>) -> f64 {
    let (mut weighted, mut total) = (0.0, 0.0);
    for (gdp, intensity) in countries {
        weighted += gdp * intensity;
        total += gdp;
    }
    if total > 0.0 { weighted / total } else { 0.0 }
}

/// `zone_effect = intensity × g(t − lag) + own_shock` (spec 5.1), a yearly rate.
pub fn zone_effect(intensity: f64, g_lagged: f64, own_shock: f64) -> f64 {
    intensity * g_lagged + own_shock
}

/// This quarter's zone-only shock (spec 5.1): `own_shock_sd × z` with z a cycle-stream standard
/// normal clamped to ±3. No draw is made for a zone with no own dynamics, so adding such a zone
/// never shifts the cycle stream (D102).
pub fn draw_own_shock(own_shock_sd: f64, draws: &mut dyn DrawSource) -> f64 {
    if own_shock_sd <= 0.0 {
        return 0.0;
    }
    own_shock_sd
        * draws
            .normal(Stream::Cycle)
            .clamp(-NORMAL_CLAMP, NORMAL_CLAMP)
}

/// Draws every zone's own shock (zone id order) and sets its effect from the lagged g.
pub fn set_zone_effects(world: &mut World, draws: &mut dyn DrawSource) {
    for (_, z) in world.zones.iter_mut() {
        z.own_shock = draw_own_shock(z.own_shock_sd, draws);
        z.effect = zone_effect(
            z.intensity,
            world.cycle.g_lagged(z.lag_quarters),
            z.own_shock,
        );
    }
}

/// 4.3 step 1c: the global cycle advances one quarter, then the zone effects follow.
pub fn cycle_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    advance_cycle(&mut world.cycle, ctx.draws);
    set_zone_effects(world, ctx.draws);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::ScriptedDraws;

    #[test]
    fn phases_follow_the_table() {
        let mut s = ScriptedDraws::new();
        s.push(Stream::Cycle, [0.5, 3.0, 0.0, 2.0]);
        let mut c = GlobalCycle {
            phase: CyclePhase::Expansion,
            quarters_left: 2,
            g_t: 0.01,
            g_history: vec![0.01; 3],
            z_avg: 1.0,
        };
        advance_cycle(&mut c, &mut s);
        assert_eq!((c.phase, c.quarters_left), (CyclePhase::Expansion, 1));
        advance_cycle(&mut c, &mut s);
        assert_eq!((c.phase, c.quarters_left), (CyclePhase::Overheating, 3));
        assert!((c.g_t - 0.03).abs() < 1e-15);
        assert_eq!(c.g_history, vec![c.g_t, 0.01, 0.01]);
        assert_eq!(c.g_lagged(1), 0.01);
        for _ in 0..3 {
            advance_cycle(&mut c, &mut s);
        }
        assert_eq!((c.phase, c.quarters_left), (CyclePhase::Contraction, 2));
        assert_eq!(c.g_t, -0.06);
    }

    #[test]
    fn z_is_gdp_weighted() {
        assert_eq!(z_avg([(1.0, 1.0), (3.0, 2.0)]), 1.75);
        assert_eq!(z_avg([]), 0.0);
    }
}
