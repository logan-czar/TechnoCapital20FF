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

    let text = std::fs::read_to_string(&csv).unwrap();
    let rows: Vec<&str> = text.lines().collect();
    assert_eq!(rows.len(), 3);
    let header: Vec<&str> = rows[0].split(',').collect();
    assert_eq!(header[..4], ["seed", "year", "ticks", "state_hash"]);
    assert!(rows[1].starts_with("7,2020,8784,"), "{}", rows[1]);
    assert!(rows[2].starts_with("8,2020,8784,"), "{}", rows[2]);
    let cols: Vec<&str> = rows[1].split(',').collect();
    assert_eq!(cols.len(), header.len(), "{}", rows[1]);
    let at = |name: &str| -> &str {
        let i = header.iter().position(|h| *h == name).expect(name);
        cols[i]
    };
    let num = |name: &str| -> f64 { at(name).parse().unwrap() };
    let int = |name: &str| -> usize { at(name).parse().unwrap() };
    // The year's state hash is the last monthly hash of seed 7 (December, at the 1 January close).
    assert!(hashes[11].ends_with(at("state_hash")), "{}", hashes[11]);
    // M2 columns: a phase name, g_t, a year of revenue and S near 1 in the first year.
    assert!(
        ["Expansion", "Overheating"].contains(&at("phase")),
        "{}",
        rows[1]
    );
    assert!(num("named_revenue_usd") > 1e12, "{}", rows[1]);
    assert!((0.9..1.1).contains(&num("mean_s")), "{}", rows[1]);
    // M3 columns: productivity within the 5.6 clamp, a 0 to 100 score, data held, a share.
    assert!(
        (30.0..=200.0).contains(&num("mean_productivity")),
        "{}",
        rows[1]
    );
    assert!(
        (0.0..=100.0).contains(&num("mean_management")),
        "{}",
        rows[1]
    );
    assert!(num("data_tb") > 0.0, "{}", rows[1]);
    assert!(
        (0.0..=1.0).contains(&num("profitable_share")),
        "{}",
        rows[1]
    );
    // M4 columns: counts of the companies (the 651 and those born in play), an active share, the
    // line drawn and the rating bands of the companies not frozen, which with the Active and
    // Distressed ones make up every company.
    let (distressed, bankrupt, removed) = (int("distressed"), int("bankrupt"), int("removed"));
    let companies = int("named_companies") + removed;
    assert!(companies >= 651 + int("startups_in_year"), "{}", rows[1]);
    assert!(int("distressed_in_year") >= distressed, "{}", rows[1]);
    assert!(
        int("bankruptcies_in_year") >= bankrupt + removed,
        "{}",
        rows[1]
    );
    assert_eq!(int("removals_in_year"), removed, "{}", rows[1]);
    let active = num("active_share") * companies as f64;
    assert_eq!(
        active.round() as usize + distressed + bankrupt + removed,
        companies,
        "{}",
        rows[1]
    );
    assert!(num("line_drawn_usd") >= 0.0, "{}", rows[1]);
    let banded: usize = at("ratings")
        .split('|')
        .map(|b| b.split_once(':').unwrap().1.parse::<usize>().unwrap())
        .sum();
    assert_eq!(banded, companies - bankrupt - removed, "{}", rows[1]);
    // M5 columns: the quoted count is at most the 467 listed at load and those listed in the
    // year, the gap and the tracking share are shares, confidence is on the −100 to +100 scale
    // and ATX (North America) shows a level.
    assert!(
        (1..=467 + int("listings_in_year")).contains(&int("quoted")),
        "{}",
        rows[1]
    );
    assert!((0.0..1.0).contains(&num("median_gap")), "{}", rows[1]);
    assert!((0.0..=1.0).contains(&num("tracking_share")), "{}", rows[1]);
    assert!(
        (-100.0..=100.0).contains(&num("mean_confidence")),
        "{}",
        rows[1]
    );
    assert!(num("index_atx") > 0.0, "{}", rows[1]);
    // M6 columns: 2020 has F1 and random events (startups 1 to 3 each), its listings are of
    // starting private companies, the 651's active share, the shares, the clamp runs, the
    // founders made and the median productivity within the 5.6 clamp.
    let startups = int("startups_in_year");
    assert!(int("events_in_year") >= 1 && startups >= int("events_in_year"));
    assert!(
        int("ai_lab_startups_in_year") >= 2,
        "F1's two AI labs: {}",
        rows[1]
    );
    assert_eq!(int("start_private_listed"), int("listings_in_year"));
    for c in [
        "start_active_share",
        "start_alive_share",
        "beat_share",
        "miss_share",
        "boom_share",
        "bust_share",
    ] {
        assert!((0.0..=1.0).contains(&num(c)), "{c}: {}", rows[1]);
    }
    assert!(num("start_alive_share") >= num("start_active_share"));
    assert!(int("max_m_clamp_quarters") <= 4, "{}", rows[1]);
    let made = int("full_characters_made");
    assert!(made >= startups, "a founder or more each: {}", rows[1]);
    assert_eq!(int("full_characters"), 296 + made, "{}", rows[1]);
    assert!(
        (30.0..=200.0).contains(&num("median_productivity")),
        "{}",
        rows[1]
    );
    // M10 columns: demand against trend after one year, and every birth's cast.
    assert!(num("demand_dev_max_pp") >= 0.0, "{}", rows[1]);
    assert_eq!(int("casts_in_year"), startups, "{}", rows[1]);
    assert!(int("cast_full_min") >= 1 && int("cast_full_max") <= 5);
    assert!(int("cast_simple_min") >= 1 && int("cast_simple_max") <= 5);
    assert_eq!(int("born_empty_seats_max"), 0, "{}", rows[1]);

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
        &["soak", "--years", "1"],
        &["soak", "--out", "x", "--jobs", "0"],
        &["check"],
    ] {
        let (ok, _, stderr) = run(args);
        assert!(!ok);
        assert!(stderr.contains("usage"), "{stderr}");
    }
}
