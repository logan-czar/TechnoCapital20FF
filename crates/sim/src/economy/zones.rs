//! Zone economy: the effective credit spread (spec 5.1.2, Logan batch 157; 4.3 step 1d).
//!
//! `credit_spread_z = round(clamp(base_z × (1 − 8 × zone_effect_z), 0.5 × base_z, 2 × base_z))`
//! in bps, recomputed each quarter from the fixed base after the cycle advances, so it always
//! reverts to the base as the cycle does. Confidence (daily, 4.2 step 6) is M5's.

use crate::time::JobCtx;
use crate::world::World;
use crate::world::units::BPS_PER_UNIT;

/// k of the spread formula: how far one point of zone effect moves the spread (spec 5.1.2, T).
pub const SPREAD_CYCLE_K: f64 = 8.0;
/// The effective spread stays within these multiples of the base (spec 5.1.2, T).
pub const SPREAD_MIN_MULT: f64 = 0.5;
pub const SPREAD_MAX_MULT: f64 = 2.0;

/// The effective zone spread in whole bps from the base in bps and the zone effect (spec 5.1.2).
/// A zone with base 0 stays at 0.
pub fn effective_spread_bps(base_bps: f64, zone_effect: f64) -> f64 {
    let raw = base_bps * (1.0 - SPREAD_CYCLE_K * zone_effect);
    raw.clamp(SPREAD_MIN_MULT * base_bps, SPREAD_MAX_MULT * base_bps)
        .round()
}

/// The same as a fraction, as the world stores rates (D3).
pub fn effective_spread(base: f64, zone_effect: f64) -> f64 {
    effective_spread_bps(base * BPS_PER_UNIT, zone_effect) / BPS_PER_UNIT
}

/// Recomputes every zone's effective credit spread from its effect.
pub fn set_zone_spreads(world: &mut World) {
    for (_, z) in world.zones.iter_mut() {
        z.credit_spread = effective_spread(z.credit_spread_base, z.effect);
    }
}

/// 4.3 step 1d: every zone's effective credit spread.
pub fn zone_spreads_job(world: &mut World, _: &mut JobCtx<'_>) {
    set_zone_spreads(world);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spread_widens_in_downturns_and_clamps() {
        assert_eq!(effective_spread_bps(100.0, 0.0), 100.0);
        assert_eq!(effective_spread_bps(100.0, -1.0), 200.0);
        assert_eq!(effective_spread_bps(100.0, 1.0), 50.0);
        assert_eq!(effective_spread_bps(0.0, -0.05), 0.0);
    }
}
