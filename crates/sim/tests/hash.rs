//! The state hash (build-plan M1.8): the same seed and ticks give the same hash; the seed, the
//! clock and the RNG positions all move it; controls do not (D13).

use sim::Sim;
use sim::time::Control;
use sim::world::{AlertKind, AlertLevel};

fn sim(seed: u64) -> Sim {
    let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
    Sim::new(data, seed).unwrap()
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
