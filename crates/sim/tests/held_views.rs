//! Views a reader holds do not change the game (D775): a sim whose views are cloned and held
//! across every tick (as the Bevy bridge holds its copy) builds the same views and the same
//! state as one nobody reads, tick for tick. The held copy shares each view's data, so a view
//! rebuilt in place (v_quotes, v_statements) rebuilds from it (`ViewData::rebuild_from`).

mod common;

use common::data;
use sim::{Notice, Sim};

/// Ticks to 10 February 2020: the Q4 2019 release (2 January), its price move, the plan lock
/// (9 January) and two month starts, each with a reader holding the views it replaces.
const TICKS: usize = 41 * 24;

#[test]
fn a_held_copy_of_the_views_changes_nothing() {
    let mut free = Sim::new(data(), 42).unwrap();
    let mut held_sim = Sim::new(data(), 42).unwrap();
    let mut held = held_sim.views().clone();
    for tick in 0..TICKS {
        let a = free.step();
        // The copy taken before the tick is still held while the tick rebuilds the views.
        let b = held_sim.step();
        assert_eq!(a, b, "tick {tick}: notices");
        let (va, vb) = (free.views(), held_sim.views());
        assert!(
            va.statements.get() == vb.statements.get(),
            "tick {tick}: v_statements"
        );
        assert!(va.quotes.get() == vb.quotes.get(), "tick {tick}: v_quotes");
        if a.iter().any(|n| matches!(n, Notice::DayDone(_))) || tick % 24 == 0 {
            assert!(va.same_data(vb), "tick {tick}: every view");
            assert_eq!(
                free.state_hash(),
                held_sim.state_hash(),
                "tick {tick}: state"
            );
        }
        held = held_sim.views().clone();
    }
    drop(held);
}
