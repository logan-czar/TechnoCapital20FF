//! The state hash (build-plan M1.8, 4.3): the same seed and ticks give the same hash; the seed, the
//! clock, the tables and the RNG positions all move it; controls do not (D13).

mod common;

use common::{churning_sim, data, draw_only};
use sim::time::{Control, Slot};
use sim::world::{AlertKind, AlertLevel};
use sim::{Notice, Sim, StateHash};

fn sim(seed: u64) -> Sim {
    Sim::new(data(), seed).unwrap()
}

fn monthly_hashes(sim: &mut Sim, months: usize) -> Vec<StateHash> {
    let mut out = Vec::new();
    while out.len() < months {
        if sim.step().iter().any(|n| matches!(n, Notice::MonthDone(_))) {
            out.push(sim.state_hash());
        }
    }
    out
}

#[test]
fn hash_follows_state_not_controls() {
    let (mut a, mut b, c) = (sim(1), sim(1), sim(2));
    assert_eq!(a.state_hash(), b.state_hash());
    assert_ne!(
        a.state_hash(),
        c.state_hash(),
        "the seed is part of the state"
    );
    let start = a.state_hash();
    for _ in 0..100 {
        a.step();
        b.step();
    }
    assert_eq!(a.state_hash(), b.state_hash());
    assert_ne!(a.state_hash(), start, "the clock is part of the state");
    let h = a.state_hash();
    a.apply(Control::SetSpeed(4)).unwrap();
    a.apply(Control::SetAlert {
        kind: AlertKind::PlanLock,
        level: AlertLevel::Off,
    })
    .unwrap();
    assert_eq!(a.state_hash(), h);
    assert_eq!(a.state_hash().to_string().len(), 64);
}

#[test]
fn rng_positions_move_the_hash() {
    let d = data();
    let mut drawn = Sim::new(d.clone(), 1).unwrap();
    drawn.register_test_job(Slot::Alerts, "test.draw_only", draw_only);
    let mut idle = Sim::new(d, 1).unwrap();
    drawn.step();
    idle.step();
    assert_eq!(drawn.world(), idle.world(), "the draws wrote nothing");
    assert_ne!(drawn.state_hash(), idle.state_hash());
}

#[test]
fn replay_with_draws_gives_the_same_monthly_hashes() {
    let d = data();
    let (mut a, mut b, mut c) = (
        churning_sim(&d, 5),
        churning_sim(&d, 5),
        churning_sim(&d, 6),
    );
    let (ha, hb, hc) = (
        monthly_hashes(&mut a, 14),
        monthly_hashes(&mut b, 14),
        monthly_hashes(&mut c, 14),
    );
    assert_eq!(ha, hb);
    assert!(ha.iter().zip(&hc).all(|(x, y)| x != y), "seeds differ");
    assert_eq!(a.world(), b.world());
    assert_ne!(a.world(), c.world(), "the draws reached the tables");
}
