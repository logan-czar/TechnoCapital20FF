//! Spec 6 (inputs) and 6.1 (archetype), build-plan M6.1: g_dem, ROA, loss_q, liquidity,
//! min_cash, the traits read, and one test per row of the 6.1 table. Expected values come from
//! the spec text and data, worked by hand.

mod common;

use common::data;
use sim::ai::archetype::{Archetype, ArchetypeInputs, archetype};
use sim::ai::inputs::{g_dem, gap_fade, liquidity, min_cash, next_loss_quarters, plan_traits, roa};
use sim::finance::credit::CreditLine;
use sim::people::traits::Trait;

#[test]
fn retail_in_a_contraction_projects_1_8_percent() {
    // Spec 6: Retail (LT 3%) with q_growth −0.5% projects 1.8%.
    let g = g_dem(0.03, -0.005);
    assert!((g - 0.018).abs() < 0.0005, "g_dem {g}");
    // The fade is φ + φ² + φ³ + φ⁴ = 0.5 + 0.25 + 0.125 + 0.0625 (spec: "0.94 × the gap").
    assert_eq!(gap_fade(), 0.9375);
    // On trend (q_growth = lt_q) the projection is LT itself.
    let lt_q = 1.03f64.powf(0.25) - 1.0;
    assert!((g_dem(0.03, lt_q) - 0.03).abs() < 1e-15);
}

#[test]
fn roa_loss_quarters_liquidity_and_min_cash() {
    // ROA = trailing EBIT ÷ gross assets; no assets reads 0.
    assert_eq!(roa(5.0e6, 50.0e6), 0.1);
    assert_eq!(roa(5.0e6, 0.0), 0.0);
    // loss_q counts consecutive quarters of negative EBIT.
    assert_eq!(next_loss_quarters(0, -1.0), 1);
    assert_eq!(next_loss_quarters(3, -1.0), 4);
    assert_eq!(next_loss_quarters(3, 0.0), 0);
    // Liquidity = own cash (cash − drawn) + undrawn line.
    let line = CreditLine {
        drawn: 30.0e6,
        limit: 50.0e6,
        excess_months_left: 0,
    };
    assert_eq!(liquidity(40.0e6, &line), 10.0e6 + 20.0e6);
    // Own cash floors at 0: drawn above cash leaves only the undrawn line.
    assert_eq!(liquidity(10.0e6, &line), 20.0e6);
    // min_cash = 5% of trailing revenue; 0 with no revenue (D226).
    assert_eq!(min_cash(40.0e6), 2.0e6);
    assert_eq!(min_cash(0.0), 0.0);
}

#[test]
fn traits_read_are_the_controllers_never_founders() {
    let t = [Trait::Greedy, Trait::Brave];
    assert_eq!(plan_traits(Some(&t), false), &t);
    // 5.19.5: a born company's founders count as none.
    assert!(plan_traits(Some(&t), true).is_empty());
    assert!(plan_traits(None, false).is_empty());
}

fn arch(state: bool, revenue_musd: f64, tech: bool, traits: &[Trait]) -> Archetype {
    archetype(&ArchetypeInputs {
        state_controlled: state,
        revenue_usd: revenue_musd * 1e6,
        tech,
        traits,
    })
}

#[test]
fn one_test_per_archetype_row() {
    // Row 1: control_basis state wins over everything.
    assert_eq!(
        arch(true, 10.0, true, &[Trait::Ambitious]),
        Archetype::StateChampion
    );
    // Row 2: revenue below $50M in Tech.
    assert_eq!(
        arch(false, 49.9, true, &[Trait::Greedy]),
        Archetype::Startup
    );
    assert_ne!(arch(false, 50.0, true, &[]), Archetype::Startup);
    assert_ne!(arch(false, 10.0, false, &[]), Archetype::Startup);
    // Row 3: Ambitious or Brave.
    assert_eq!(
        arch(false, 500.0, false, &[Trait::Brave]),
        Archetype::AggressiveGrower
    );
    // Row 4: Greedy or Cautious.
    assert_eq!(
        arch(false, 500.0, false, &[Trait::Cautious]),
        Archetype::CashCow
    );
    // Row 5: otherwise.
    assert_eq!(
        arch(false, 500.0, false, &[Trait::Honest]),
        Archetype::Incumbent
    );
    assert_eq!(arch(false, 500.0, false, &[]), Archetype::Incumbent);
    // Rows match in table order (D120; Logan on design fix 105: table order), so a controller
    // with both Ambitious and Greedy is an Aggressive grower whichever trait it lists first.
    assert_eq!(
        arch(false, 500.0, false, &[Trait::Greedy, Trait::Ambitious]),
        Archetype::AggressiveGrower
    );
    assert_eq!(
        arch(false, 500.0, false, &[Trait::Ambitious, Trait::Greedy]),
        Archetype::AggressiveGrower
    );
}

#[test]
fn archetype_table_values() {
    // Spec 6.1 table: hurdle, growth adj, R&D mult, payout mult, data coverage.
    let rows = [
        (Archetype::StateChampion, 0.06, 0.02, 1.0, 1.0, 0.5),
        (Archetype::Startup, 0.12, 0.04, 1.2, 0.0, 1.0),
        (Archetype::AggressiveGrower, 0.08, 0.05, 1.3, 0.5, 1.0),
        (Archetype::CashCow, 0.15, -0.03, 0.7, 1.3, 0.25),
        (Archetype::Incumbent, 0.10, 0.0, 1.0, 1.0, 0.5),
    ];
    for (a, hurdle, adj, rd, payout, coverage) in rows {
        let p = a.params();
        assert_eq!(
            (
                p.hurdle_roa,
                p.growth_adj,
                p.rd_mult,
                p.payout_mult,
                p.data_coverage
            ),
            (hurdle, adj, rd, payout, coverage),
            "{a:?}"
        );
    }
}

#[test]
fn arrowhead_is_a_cash_cow_from_terrys_traits() {
    // Spec 7.1: Terry's Greedy trait makes Arrowhead (CO-0001, Oil) a Cash cow.
    let d = data();
    let co = d.companies.rows.iter().find(|c| c.id == "CO-0001").unwrap();
    let ch = d
        .characters
        .rows
        .iter()
        .find(|c| c.id == co.controller)
        .unwrap();
    let traits: Vec<Trait> = ch
        .traits
        .iter()
        .filter_map(|t| Trait::from_name(t))
        .collect();
    let ind = d
        .industries
        .rows
        .iter()
        .find(|i| i.name == co.industry)
        .unwrap();
    let a = arch(
        co.control_basis == "state",
        co.revenue_usd_m,
        ind.sector == "Tech",
        &traits,
    );
    assert_eq!(a, Archetype::CashCow);
}
