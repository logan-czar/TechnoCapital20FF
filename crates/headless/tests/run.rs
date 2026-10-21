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
    assert_eq!(
        rows[0],
        "seed,year,ticks,final_hash,wall_ms,phase,g_t,named_revenue_usd,fringe_revenue_usd,\
         mean_s,min_s,max_s,mean_m,mean_productivity,mean_management,data_tb,profitable_share,\
         distressed_in_year,distressed,bankrupt,removed,bankruptcies_in_year,removals_in_year,\
         active_share,line_drawn_usd,ratings,quoted,median_gap,tracking_share,mean_confidence,\
         index_atx,index_cbx,index_hse,index_ese"
    );
    assert_eq!(rows.len(), 3);
    assert!(rows[1].starts_with("7,2020,8784,"), "{}", rows[1]);
    assert!(rows[2].starts_with("8,2020,8784,"), "{}", rows[2]);
    // M2 columns: a phase name, g_t, a year of revenue and S near 1 in the first year.
    let cols: Vec<&str> = rows[1].split(',').collect();
    assert_eq!(cols.len(), 34, "{}", rows[1]);
    assert!(
        ["Expansion", "Overheating"].contains(&cols[5]),
        "{}",
        rows[1]
    );
    let named: f64 = cols[7].parse().unwrap();
    assert!(named > 1e12, "named revenue a year {named}");
    let mean_s: f64 = cols[9].parse().unwrap();
    assert!((0.9..1.1).contains(&mean_s), "{mean_s}");
    // M3 columns: productivity within the 5.6 clamp, a 0 to 100 score, data held, a share.
    let num = |i: usize| -> f64 { cols[i].parse().unwrap() };
    assert!((30.0..=200.0).contains(&num(13)), "{}", rows[1]);
    assert!((0.0..=100.0).contains(&num(14)), "{}", rows[1]);
    assert!(num(15) > 0.0, "{}", rows[1]);
    assert!((0.0..=1.0).contains(&num(16)), "{}", rows[1]);
    // M4 columns: counts of the 651, an active share, the line drawn and the rating bands of
    // the companies not frozen, which with the Active and Distressed ones make up the 651.
    let int = |i: usize| -> usize { cols[i].parse().unwrap() };
    let (distressed, bankrupt, removed) = (int(18), int(19), int(20));
    assert!(int(17) >= distressed, "{}", rows[1]);
    assert!(int(21) >= bankrupt + removed, "{}", rows[1]);
    assert_eq!(int(22), removed, "{}", rows[1]);
    let active = num(23) * 651.0;
    assert!(
        (active.round() as usize + distressed + bankrupt + removed) == 651,
        "{}",
        rows[1]
    );
    assert!(num(24) >= 0.0, "{}", rows[1]);
    let banded: usize = cols[25]
        .split('|')
        .map(|b| b.split_once(':').unwrap().1.parse::<usize>().unwrap())
        .sum();
    assert_eq!(banded, 651 - bankrupt - removed, "{}", rows[1]);
    // M5 columns: the quoted count is at most the 467 listed, the gap and the tracking share
    // are shares, confidence is on the −100 to +100 scale and ATX (North America) shows a level.
    assert!((1..=467).contains(&int(26)), "{}", rows[1]);
    assert!((0.0..1.0).contains(&num(27)), "{}", rows[1]);
    assert!((0.0..=1.0).contains(&num(28)), "{}", rows[1]);
    assert!((-100.0..=100.0).contains(&num(29)), "{}", rows[1]);
    assert!(num(30) > 0.0, "{}", rows[1]);

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
