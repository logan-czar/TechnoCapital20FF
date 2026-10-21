//! The archetype table (spec 6.1, 2.23.1) and the 6.3 trait R&D mults, the slice of the Lite AI
//! that load needs before M6: the starting run rate's R&D plan (7.1 "Plan", "Rating") and the
//! dividend rule's payout mult (5.17). M6.1 adds the hurdle ROA, growth adj and data coverage
//! columns and the plan lock that reads them.

use serde::{Deserialize, Serialize};

use crate::people::traits::Trait;

/// A company's archetype (spec 3.5, 6.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Archetype {
    StateChampion,
    Startup,
    AggressiveGrower,
    CashCow,
    Incumbent,
}

/// One row of the spec 6.1 archetype table: the columns M4 reads (M6.1 adds the hurdle ROA,
/// growth adj and data coverage).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ArchetypeRow {
    pub archetype: Archetype,
    /// R&D mult (6.3 target).
    pub rd_mult: f64,
    /// Payout mult (5.17 payout ratio).
    pub payout_mult: f64,
}

/// Spec 6.1 (all T), in the enum's order: State champion 1.0 / 1.0, Startup 1.2 / 0, Aggressive
/// grower 1.3 / 0.5, Cash cow 0.7 / 1.3, Incumbent 1.0 / 1.0 (R&D mult / payout mult).
pub const ARCHETYPE_TABLE: [ArchetypeRow; 5] = [
    ArchetypeRow {
        archetype: Archetype::StateChampion,
        rd_mult: 1.0,
        payout_mult: 1.0,
    },
    ArchetypeRow {
        archetype: Archetype::Startup,
        rd_mult: 1.2,
        payout_mult: 0.0,
    },
    ArchetypeRow {
        archetype: Archetype::AggressiveGrower,
        rd_mult: 1.3,
        payout_mult: 0.5,
    },
    ArchetypeRow {
        archetype: Archetype::CashCow,
        rd_mult: 0.7,
        payout_mult: 1.3,
    },
    ArchetypeRow {
        archetype: Archetype::Incumbent,
        rd_mult: 1.0,
        payout_mult: 1.0,
    },
];

/// Spec 6.1: the Startup row applies below this revenue, in the Tech sector.
pub const STARTUP_REVENUE_BELOW_USD: f64 = 50.0e6;
/// Spec 6.1: the Startup row's sector (industries.csv `sector`).
pub const STARTUP_SECTOR: &str = "Tech";
/// Spec 6.1: the State champion row's control basis (companies.csv `control_basis`).
pub const STATE_CONTROL_BASIS: &str = "state";

/// Spec 6.3 trait R&D mults (T): Greedy 0.8, Visionary 1.25, Conservative 0.9, Diligent 1.1.
pub const TRAIT_RD_MULTS: [(Trait, f64); 4] = [
    (Trait::Greedy, 0.8),
    (Trait::Visionary, 1.25),
    (Trait::Conservative, 0.9),
    (Trait::Diligent, 1.1),
];
/// Spec 6.3: rd_plan is clamped to 0 to 3 × rd_norm.
pub const RD_PLAN_MAX_NORMS: f64 = 3.0;

impl Archetype {
    /// Spec 6.1, first match: control_basis state; revenue below $50M in Tech; a controller with
    /// Ambitious or Brave; with Greedy or Cautious; otherwise Incumbent. The rows are matched in
    /// table order, as validate.py and the M3 profit check do (D120; design fix 105 asks whether
    /// the 6.1 note "takes the first trait in its list" should win instead).
    pub fn at_load(control_basis: &str, revenue_usd: f64, sector: &str, traits: &[Trait]) -> Self {
        let has = |t: Trait| traits.contains(&t);
        if control_basis == STATE_CONTROL_BASIS {
            Archetype::StateChampion
        } else if revenue_usd < STARTUP_REVENUE_BELOW_USD && sector == STARTUP_SECTOR {
            Archetype::Startup
        } else if has(Trait::Ambitious) || has(Trait::Brave) {
            Archetype::AggressiveGrower
        } else if has(Trait::Greedy) || has(Trait::Cautious) {
            Archetype::CashCow
        } else {
            Archetype::Incumbent
        }
    }

    /// This archetype's row of [`ARCHETYPE_TABLE`].
    pub fn row(self) -> &'static ArchetypeRow {
        &ARCHETYPE_TABLE[self as usize]
    }

    /// Spec 6.1 R&D mult (T).
    pub fn rd_mult(self) -> f64 {
        self.row().rd_mult
    }

    /// Spec 6.1 payout mult (T), read by the 5.17 payout ratio.
    pub fn payout_mult(self) -> f64 {
        self.row().payout_mult
    }

    pub fn name(self) -> &'static str {
        match self {
            Archetype::StateChampion => "State champion",
            Archetype::Startup => "Startup",
            Archetype::AggressiveGrower => "Aggressive grower",
            Archetype::CashCow => "Cash cow",
            Archetype::Incumbent => "Incumbent",
        }
    }
}

/// Spec 6.3 trait mult: the product of the controller's trait mults.
pub fn trait_rd_mult(traits: &[Trait]) -> f64 {
    TRAIT_RD_MULTS
        .iter()
        .filter(|(t, _)| traits.contains(t))
        .map(|&(_, k)| k)
        .product()
}

/// The 6.3 R&D plan at load (spec 7.1 "Plan"): productivity 100 (no productivity adj) and loss_q
/// 0, so `rd_plan = clamp(rd_norm × archetype mult × trait mult − free R&D, 0, 3 × rd_norm)`, a
/// share of revenue. `free_rd` is a fraction.
pub fn rd_plan_at_load(rd_norm: f64, archetype: Archetype, traits: &[Trait], free_rd: f64) -> f64 {
    let target = rd_norm * archetype.rd_mult() * trait_rd_mult(traits);
    (target - free_rd).clamp(0.0, RD_PLAN_MAX_NORMS * rd_norm)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arrowhead_is_a_greedy_cash_cow() {
        // Spec 7.1: Terry is Greedy, so a Cash cow with an R&D target of 0.05 × 0.7 × 0.8.
        let a = Archetype::at_load("majority", 40.0e6, "Energy", &[Trait::Greedy]);
        assert_eq!(a, Archetype::CashCow);
        let plan = rd_plan_at_load(0.05, a, &[Trait::Greedy], 0.01);
        assert!((plan - 0.018).abs() < 1e-12);
        assert_eq!(a.payout_mult(), 1.3);
    }

    #[test]
    fn the_table_is_in_enum_order() {
        for (i, row) in ARCHETYPE_TABLE.iter().enumerate() {
            assert_eq!(row.archetype as usize, i);
        }
    }

    #[test]
    fn rows_match_in_table_order() {
        assert_eq!(
            Archetype::at_load("state", 1.0, "Tech", &[Trait::Brave]),
            Archetype::StateChampion
        );
        assert_eq!(
            Archetype::at_load("majority", 10.0e6, "Tech", &[Trait::Greedy]),
            Archetype::Startup
        );
        assert_eq!(
            Archetype::at_load(
                "majority",
                1.0e9,
                "Tech",
                &[Trait::Cautious, Trait::Ambitious]
            ),
            Archetype::AggressiveGrower
        );
        assert_eq!(
            Archetype::at_load("widely_held", 1.0e9, "Energy", &[]),
            Archetype::Incumbent
        );
        assert_eq!(
            trait_rd_mult(&[Trait::Visionary, Trait::Diligent]),
            1.25 * 1.1
        );
        assert_eq!(rd_plan_at_load(0.05, Archetype::Incumbent, &[], 0.07), 0.0);
    }
}
