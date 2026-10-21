//! Spec 6.3 (R&D plan), build-plan M6.2: one test per rule, and the 7.1 Arrowhead plan on the
//! live load (Cash cow 0.7, Greedy 0.8: 2.8% less 1% free R&D), the function the M3 Arrowhead
//! check applies by hand today.

mod common;

use common::data;
use common::ops::company;
use sim::Sim;
use sim::ai::archetype::{Archetype, ArchetypeInputs, archetype};
use sim::ai::inputs::plan_traits;
use sim::ai::rd::{RdInputs, productivity_adj, rd_plan, rd_target, trait_mult};
use sim::people::traits::Trait;

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-12
}

fn inputs(mult: f64, productivity: f64, traits: &[Trait], loss_q: u32, free: u32) -> RdInputs<'_> {
    RdInputs {
        rd_norm: 0.05,
        archetype_rd_mult: mult,
        productivity,
        traits,
        loss_q,
        free_rd_pct: free,
    }
}

#[test]
fn productivity_adjustment() {
    assert_eq!(productivity_adj(94.9), 0.25);
    assert_eq!(productivity_adj(95.0), 0.0);
    assert_eq!(productivity_adj(110.0), 0.0);
    assert_eq!(productivity_adj(110.1), -0.2);
    // Incumbent at 90: 0.05 × 1.25; at 120: 0.05 × 0.8.
    assert!(close(rd_target(&inputs(1.0, 90.0, &[], 0, 0)), 0.0625));
    assert!(close(rd_target(&inputs(1.0, 120.0, &[], 0, 0)), 0.04));
}

#[test]
fn trait_mults() {
    assert_eq!(trait_mult(&[Trait::Greedy]), 0.8);
    assert_eq!(trait_mult(&[Trait::Visionary]), 1.25);
    assert_eq!(trait_mult(&[Trait::Conservative]), 0.9);
    assert_eq!(trait_mult(&[Trait::Diligent]), 1.1);
    assert_eq!(trait_mult(&[Trait::Honest]), 1.0);
    // Several multiply (D264).
    assert!(close(trait_mult(&[Trait::Greedy, Trait::Diligent]), 0.88));
}

#[test]
fn loss_cut_and_its_floor() {
    // Startup 1.2 × 0.05 = 6%; loss_q ≥ 2 cuts ×0.8 to 4.8%.
    assert!(close(rd_target(&inputs(1.2, 100.0, &[], 2, 0)), 0.048));
    assert!(close(rd_target(&inputs(1.2, 100.0, &[], 1, 0)), 0.06));
    // Cash cow Greedy 2.8% × 0.8 = 2.24% is under 0.5 × rd_norm (2.5%): held at 2.5%.
    assert!(close(
        rd_target(&inputs(0.7, 100.0, &[Trait::Greedy], 3, 0)),
        0.025
    ));
    // A target already under the floor is not lifted: 0.05 × 0.5 × 0.8 = 2%.
    assert!(close(
        rd_target(&inputs(0.7, 120.0, &[Trait::Greedy], 2, 0)),
        0.02
    ));
}

#[test]
fn free_rd_and_clamp() {
    // rd_plan = max(0, target − free): 2.8% − 1% = 1.8%; 5% free leaves 0.
    assert!(close(
        rd_plan(&inputs(0.7, 100.0, &[Trait::Greedy], 0, 1)),
        0.018
    ));
    assert_eq!(rd_plan(&inputs(0.7, 100.0, &[Trait::Greedy], 0, 5)), 0.0);
    // Clamp at 3 × rd_norm (15%): a 4.0 mult would ask 20%.
    assert!(close(rd_plan(&inputs(4.0, 100.0, &[], 0, 0)), 0.15));
}

#[test]
fn arrowhead_plan_at_load() {
    // Spec 7.1: R&D target 0.05 × 0.7 × 0.8 = 2.8%, less 1% free: paid R&D about $0.7M of $40M.
    let sim = Sim::new(data(), 1).unwrap();
    let w = sim.world();
    let a = &w.companies[company(w, "CO-0001")];
    let u = &w.units[a.units[0]];
    let ind = &w.industries[u.industry];
    let controller = a.controller.map(|c| w.characters[c].traits.as_slice());
    let traits = plan_traits(controller, false);
    let arch = archetype(&ArchetypeInputs {
        state_controlled: false,
        revenue_usd: a.revenue_usd,
        tech: ind.sector == "Tech",
        traits,
    });
    assert_eq!(arch, Archetype::CashCow);
    let book = &a.data[0].book;
    assert_eq!(book.free_rd_pct, 1);
    let i = RdInputs {
        rd_norm: ind.params.rd_norm,
        archetype_rd_mult: arch.params().rd_mult,
        productivity: u.productivity,
        traits,
        loss_q: 0,
        free_rd_pct: book.free_rd_pct,
    };
    assert!((rd_target(&i) - 0.028).abs() < 1e-12);
    let plan = rd_plan(&i);
    assert!((plan - 0.018).abs() < 1e-12, "rd_plan {plan}");
    let paid = a.revenue_usd * plan;
    assert!((paid - 0.72e6).abs() < 0.005e6, "paid R&D {paid}");
}
