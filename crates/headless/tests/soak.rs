//! `headless soak` is deterministic (build-plan M10.1): the same seeds give byte-identical
//! `years.csv` and `quarters.csv`, whatever the job count; `check` reads them (M10.2, M10.3).

use std::path::Path;
use std::process::Command;

fn headless(args: &[&str]) -> String {
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

fn soak(dir: &Path, jobs: &str) {
    let d = dir.to_str().unwrap();
    headless(&[
        "soak", "--years", "1", "--seeds", "3..4", "--jobs", jobs, "--out", d,
    ]);
}

#[test]
fn tiny_soak_twice_gives_the_same_tables_and_checks() {
    let tmp = Path::new(env!("CARGO_TARGET_TMPDIR"));
    let (a, b) = (tmp.join("soak-a"), tmp.join("soak-b"));
    soak(&a, "2");
    soak(&b, "1");
    for name in ["years.csv", "quarters.csv"] {
        let (x, y) = (
            std::fs::read(a.join(name)).unwrap(),
            std::fs::read(b.join(name)).unwrap(),
        );
        assert!(x == y, "{name} differs between runs");
    }

    // Seed then year (then quarter) order; 2 seeds × 1 year, 2 × 4 quarters.
    let years = std::fs::read_to_string(a.join("years.csv")).unwrap();
    let keys: Vec<&str> = years.lines().skip(1).map(|l| &l[..6]).collect();
    assert_eq!(keys, ["3,2020", "4,2020"]);
    let quarters = std::fs::read_to_string(a.join("quarters.csv")).unwrap();
    let keys: Vec<String> = quarters
        .lines()
        .skip(1)
        .map(|l| l.split(',').take(3).collect::<Vec<_>>().join(","))
        .collect();
    assert_eq!(
        keys,
        [
            "3,2020,1", "3,2020,2", "3,2020,3", "3,2020,4", "4,2020,1", "4,2020,2", "4,2020,3",
            "4,2020,4"
        ]
    );
    // The first quarter holds the 2 January 2020 release of Q4 2019, 42 industries × 3 months.
    let q1: Vec<&str> = quarters.lines().nth(1).unwrap().split(',').collect();
    assert_eq!(q1[3], "2019Q4");
    assert_eq!((q1[7], q1[8]), ("42", "126"));
    let timing = std::fs::read_to_string(a.join("timing.csv")).unwrap();
    assert_eq!(timing.lines().count(), 3, "{timing}");
    assert!(timing.starts_with("seed,years,ticks,wall_ms,ms_per_year\n3,1,8784,"));

    let out = headless(&["check", a.to_str().unwrap()]);
    assert!(out.contains("named_companies"), "{out}");
    let targets = std::fs::read_to_string(a.join("targets.csv")).unwrap();
    let rows: Vec<Vec<&str>> = targets
        .lines()
        .skip(1)
        .map(|l| l.split(',').collect())
        .collect();
    // 21 targets since D363 (two revenue targets), D366 and D368 (Cloud's two waived rows).
    assert_eq!(rows.len(), 21 * 2, "{targets}");
    assert!(rows.iter().all(|r| r.len() == 5), "{targets}");
    // One year covers only the per-birth cast check (every other target needs 10 or 30 years),
    // and each 2020 cast has 1 to 5 founders and 1 to 5 simple characters.
    for r in &rows {
        let want = if r[0] == "cast_sizes" { "PASS" } else { "NA" };
        assert_eq!(r[2], want, "{r:?}");
    }
    assert!(a.join("summary.csv").exists());
}

#[test]
fn failed_seeds_are_each_named_and_the_run_exits_non_zero() {
    let tmp = Path::new(env!("CARGO_TARGET_TMPDIR"));
    let (out, bad) = (tmp.join("soak-fail"), tmp.join("no-such-data"));
    let run = Command::new(env!("CARGO_BIN_EXE_headless"))
        .args([
            "soak", "--years", "1", "--seeds", "5..6", "--jobs", "2", "--out",
        ])
        .arg(&out)
        .arg("--data-dir")
        .arg(&bad)
        .output()
        .expect("run headless");
    assert!(!run.status.success());
    let stderr = String::from_utf8_lossy(&run.stderr);
    assert!(stderr.contains("2 of 2 seeds failed"), "{stderr}");
    assert!(
        stderr.contains("seed 5:") && stderr.contains("seed 6:"),
        "{stderr}"
    );
    // The tables are still written, with their headers and no rows.
    let years = std::fs::read_to_string(out.join("years.csv")).unwrap();
    assert_eq!(years.lines().count(), 1, "{years}");
}
