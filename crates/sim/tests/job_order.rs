//! The golden job-order trace for 2020 (build-plan M1.3): every tick from 2020-01-01 01:00 to
//! 2021-01-01 00:00, with the slots it visited, must match tests/golden/job-order-2020.txt, which
//! was checked by hand against spec 4. Set `UPDATE_GOLDEN=1` to rewrite it after an intended
//! change to the order.

use std::path::Path;

use sim::Sim;
use sim::time::trace::TraceRecorder;
use sim::time::{Date, DateTime};

#[test]
fn job_order_2020_matches_golden() {
    let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
    let mut sim = Sim::new(data, 42).unwrap();
    sim.set_trace(true);
    let end = DateTime::midnight(Date::ymd(2021, 1, 1));
    let mut rec = TraceRecorder::new();
    while sim.now() < end {
        sim.step();
        rec.push(sim.now(), sim.last_trace());
    }
    let got = rec.render();
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/golden/job-order-2020.txt");
    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, &got).unwrap();
    }
    let want = std::fs::read_to_string(&path)
        .expect("golden file exists (run with UPDATE_GOLDEN=1 to create it)")
        .replace("\r\n", "\n");
    if got != want {
        let line = got
            .lines()
            .zip(want.lines())
            .position(|(a, b)| a != b)
            .unwrap_or(got.lines().count().min(want.lines().count()));
        panic!(
            "job order differs from the golden trace at line {}:\n got: {:?}\nwant: {:?}",
            line + 1,
            got.lines().nth(line),
            want.lines().nth(line)
        );
    }
}
