//! Today's data in docs/design/data loads with the expected counts and passes every check
//! (build-plan M0.2, M0.4).

use sim_data::{EXPECTED_COUNTS, check, default_data_dir, load_world};

#[test]
fn loads_with_expected_counts() {
    let w = load_world(&default_data_dir()).unwrap_or_else(|e| panic!("{e}"));
    let counts = w.counts();
    for (name, expected) in EXPECTED_COUNTS {
        let (_, n) = counts.iter().find(|(k, _)| *k == name).unwrap();
        assert_eq!(*n, expected, "{name}");
    }
}

#[test]
fn passes_all_checks() {
    let w = load_world(&default_data_dir()).unwrap_or_else(|e| panic!("{e}"));
    let errors = check(&w);
    let text: Vec<String> = errors.iter().map(ToString::to_string).collect();
    assert!(errors.is_empty(), "{}", text.join("\n"));
}

#[test]
fn fixed_startup_events_load() {
    let w = load_world(&default_data_dir()).unwrap_or_else(|e| panic!("{e}"));
    let ev = &w.startup_events.rows;
    assert_eq!(ev.len(), 9);
    let f6 = &ev[5];
    assert_eq!(f6.startups[0].industry, "AI labs");
    assert_eq!(f6.startups[0].regions, ["CHN"]);
    assert_eq!(ev[8].trigger, sim_data::EventTrigger::AfterBust);
    let total: u32 = ev.iter().flat_map(|e| &e.startups).map(|g| g.count).sum();
    assert_eq!(total, 32);
}
