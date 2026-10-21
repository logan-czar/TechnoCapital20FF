//! Spec 6.4 (station split) through the Lite AI, build-plan M6.2: archetype coverage, the
//! Visionary research row, the idle floor and the L = 1 CEO. Expected values worked by hand.

use sim::ai::archetype::Archetype;
use sim::ai::split::{monthly_inflow_tb, plan_stations};
use sim::ops::stations::Stations;
use sim::people::traits::Trait;

#[test]
fn arrowhead_cash_cow_split() {
    // 392 labor units; inflow $40M ÷ 12 × 1 TB = 3.33 TB a month; Cash cow covers 25%:
    // E = ceil(0.25 × 3.33 ÷ 0.9125) = 1. P = the largest 10^k ≤ 40% × 392 = 156.8, so 100.
    let inflow = monthly_inflow_tb(40.0e6, 1.0);
    assert!((inflow - 40.0 / 12.0).abs() < 1e-12);
    let s = plan_stations(392, &Archetype::CashCow.params(), inflow, &[]);
    assert_eq!(
        s,
        Stations {
            productivity: 100,
            enterprise: 1,
            fifty_fifty: 0,
            research: 0,
            idle: 291,
        }
    );
}

#[test]
fn coverage_by_archetype_and_visionary_research() {
    // Startup (100%) with 50 labor and 10 TB a month: E = ceil(10 ÷ 0.9125) = 11; P = 10.
    let s = plan_stations(50, &Archetype::Startup.params(), 10.0, &[]);
    assert_eq!((s.productivity, s.enterprise, s.research), (10, 11, 0));
    assert_eq!(s.idle, 29);
    // A Visionary controller puts floor(10% of 29) = 2 into research.
    let v = plan_stations(50, &Archetype::Startup.params(), 10.0, &[Trait::Visionary]);
    assert_eq!(
        (v.productivity, v.enterprise, v.research, v.idle),
        (10, 11, 2, 27)
    );
    // Incumbent (50%) covers half: ceil(5 ÷ 0.9125) = 6.
    let i = plan_stations(50, &Archetype::Incumbent.params(), 10.0, &[]);
    assert_eq!(i.enterprise, 6);
}

#[test]
fn idle_floor_cuts_enterprise_first() {
    // L 20: P 1 (40% is 8, largest 10^k is 1); full coverage of 30 TB wants 33 stations, capped
    // at the 19 left; the 10% idle floor (2) cuts E to 17.
    let s = plan_stations(20, &Archetype::Startup.params(), 30.0, &[]);
    assert_eq!((s.productivity, s.enterprise, s.idle), (1, 17, 2));
    assert_eq!(s.total(), 20);
}

#[test]
fn single_labor_unit_ceo() {
    // L = 1 at 100% coverage: the CEO splits 50/50; otherwise it is productivity.
    let s = plan_stations(1, &Archetype::Startup.params(), 0.1, &[]);
    assert_eq!((s.fifty_fifty, s.productivity), (1, 0));
    let s = plan_stations(1, &Archetype::Incumbent.params(), 0.1, &[]);
    assert_eq!((s.fifty_fifty, s.productivity), (0, 1));
}
