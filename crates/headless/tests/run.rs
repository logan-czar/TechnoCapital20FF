//! `headless run` prints a state hash each month and writes one metrics row per seed per year
//! (build-plan M1.8, M10.1).

use std::process::Command;

fn run(args: &[&str]) -> (bool, String, String) {
    let out = Command::new(env!("CARGO_BIN_EXE_headless"))
        .args(args)
        .output()
        .expect("run headless");
    (
        out.status.success(),
        String::from_utf8_lossy(&out.stdout).into_owned(),
        String::from_utf8_lossy(&out.stderr).into_owned(),
    )
}

#[test]
fn monthly_hashes_and_metrics() {
    let csv = std::path::Path::new(env!("CARGO_TARGET_TMPDIR")).join("metrics.csv");
    let csv_arg = csv.to_str().unwrap();
    let args = [
        "run",
        "--years",
        "1",
        "--seeds",
        "7..8",
        "--hash-monthly",
        "--out",
        csv_arg,
    ];
    let (ok, stdout, stderr) = run(&args);
    assert!(ok, "{stdout}\n{stderr}");
    let hashes: Vec<&str> = stdout
        .lines()
        .filter(|l| l.starts_with("seed 7 2020-"))
        .collect();
    assert_eq!(hashes.len(), 12, "{stdout}");
    assert!(hashes[0].starts_with("seed 7 2020-01 "));
    assert_eq!(hashes[0].rsplit(' ').next().unwrap().len(), 64);
    let seed8_jan = stdout
        .lines()
        .find(|l| l.starts_with("seed 8 2020-01 "))
        .unwrap();
    assert_ne!(hashes[0][7..], seed8_jan[7..], "seeds differ");

    let rows = std::fs::read_to_string(&csv).unwrap();
    let rows: Vec<&str> = rows.lines().collect();
    assert_eq!(rows[0], "seed,year,ticks,final_hash,wall_ms");
    assert_eq!(rows.len(), 3);
    assert!(rows[1].starts_with("7,2020,8784,"), "{}", rows[1]);
    assert!(rows[2].starts_with("8,2020,8784,"), "{}", rows[2]);

    // Same seed, same hashes.
    let (_, again, _) = run(&args);
    let again: Vec<&str> = again
        .lines()
        .filter(|l| l.starts_with("seed 7 2020-"))
        .collect();
    assert_eq!(again, hashes);
}

#[test]
fn bad_run_arguments_print_usage() {
    for args in [
        &["run"][..],
        &["run", "--years", "0", "--seeds", "1"],
        &["run", "--years", "1", "--seeds", "5..2"],
    ] {
        let (ok, _, stderr) = run(args);
        assert!(!ok);
        assert!(stderr.contains("usage"), "{stderr}");
    }
}
