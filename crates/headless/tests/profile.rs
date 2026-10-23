//! `headless run --profile` (build-plan M10.6, D400) prints the time per scheduler slot, job and
//! view, and leaves the run itself alone: the metrics rows (with their state hashes) are the
//! same bytes as an unprofiled run's.

use std::process::Command;

fn run(args: &[&str]) -> String {
    let out = Command::new(env!("CARGO_BIN_EXE_headless"))
        .args(args)
        .output()
        .expect("run headless");
    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    assert!(
        out.status.success(),
        "{stdout}\n{}",
        String::from_utf8_lossy(&out.stderr)
    );
    stdout
}

#[test]
fn profile_prints_slots_and_keeps_the_run() {
    let dir = std::path::Path::new(env!("CARGO_TARGET_TMPDIR"));
    let (plain, profiled) = (dir.join("m10_plain.csv"), dir.join("m10_profiled.csv"));
    let base = ["run", "--years", "1", "--seeds", "4"];
    run(&[&base[..], &["--out", plain.to_str().unwrap()]].concat());
    let out = run(&[
        &base[..],
        &["--profile", "--out", profiled.to_str().unwrap()],
    ]
    .concat());
    for part in [
        "hourly.2.share_prices",
        "daily.1.price_bars",
        "monthly.13.cash_settle",
        "quarterly.plan_lock.4.ai_plans",
        "yearly.2.archive",
        "views (refresh after each tick)",
        "all steps",
        "slowest 15 jobs",
        "view quotes",
    ] {
        assert!(out.contains(part), "{part} missing:\n{out}");
    }
    assert_eq!(
        std::fs::read(&plain).unwrap(),
        std::fs::read(&profiled).unwrap(),
        "profiling changed the run"
    );
}

/// `run --tick-costs` (D801) times whole steps by the kind of tick and keeps the run.
#[test]
fn tick_costs_list_the_quarter_ticks_and_keep_the_run() {
    let dir = std::path::Path::new(env!("CARGO_TARGET_TMPDIR"));
    let (plain, timed) = (dir.join("m10_plain_tc.csv"), dir.join("m10_timed.csv"));
    let base = ["run", "--years", "1", "--seeds", "4"];
    run(&[&base[..], &["--out", plain.to_str().unwrap()]].concat());
    let out = run(&[
        &base[..],
        &["--tick-costs", "--out", timed.to_str().unwrap()],
    ]
    .concat());
    for kind in [
        "hourly",
        "daily",
        "monthly",
        "quarter start",
        "release",
        "price move",
        "plan lock",
    ] {
        assert!(
            out.lines().any(|l| l.starts_with(kind)),
            "{kind} missing:\n{out}"
        );
    }
    assert_eq!(
        std::fs::read(&plain).unwrap(),
        std::fs::read(&timed).unwrap(),
        "timing changed the run"
    );
}
