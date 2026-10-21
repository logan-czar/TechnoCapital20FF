//! `headless soak` (build-plan M10.1, 4.4): many seeds, each its own single-threaded `Sim` in its
//! own child process (`headless soak-seed`; D333: threads in one process contend on the Windows
//! heap and ran each seed about twice as slow), written in seed order so the same seed range
//! gives byte-identical `years.csv` and `quarters.csv` whatever the job count. Wall time goes to
//! `timing.csv` only.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

use sim_data::WorldData;

use crate::metrics::{QUARTERS_HEADER, SeedOutput, YEARS_HEADER, run_seed};

/// Build-plan 4.4: "2020 to 2050 over 50 seeds (T)": the defaults when `--years` or `--seeds`
/// is not given.
pub const DEFAULT_YEARS: u32 = 30;
pub const DEFAULT_SEEDS: (u64, u64) = (1, 50);

/// The `timing.csv` header: one row per seed, wall time of the seed's run (from `Sim::new` to
/// its last tick) and per simulated year.
pub const TIMING_HEADER: &str = "seed,years,ticks,wall_ms,ms_per_year";

pub struct SoakArgs {
    pub years: u32,
    pub seeds: (u64, u64),
    /// Seeds run at once (child processes); `None` is half the machine's cores (it is shared),
    /// at least 1.
    pub jobs: Option<usize>,
    pub out: PathBuf,
    /// Run the target checker on the output afterwards (`--check`).
    pub check: bool,
}

/// The default worker count: half the available cores, at least 1.
fn default_jobs() -> usize {
    std::thread::available_parallelism().map_or(1, |n| (n.get() / 2).max(1))
}

/// Runs every seed of `seeds` for `years` years, `jobs` at a time, each in its own child process
/// (`headless soak-seed`, D333); returns each seed's output or error, in seed order.
pub fn run_seeds(
    data_dir: &Path,
    seeds: (u64, u64),
    years: u32,
    jobs: usize,
) -> Result<Vec<Result<SeedOutput, String>>, String> {
    let exe = std::env::current_exe().map_err(|e| format!("current exe: {e}"))?;
    let list: Vec<u64> = (seeds.0..=seeds.1).collect();
    let jobs = jobs.clamp(1, list.len().max(1));
    let next = AtomicUsize::new(0);
    let slots: Mutex<Vec<Option<Result<SeedOutput, String>>>> =
        Mutex::new((0..list.len()).map(|_| None).collect());
    std::thread::scope(|s| {
        for _ in 0..jobs {
            s.spawn(|| {
                loop {
                    let i = next.fetch_add(1, Ordering::Relaxed);
                    let Some(&seed) = list.get(i) else { break };
                    let out = run_child(&exe, data_dir, seed, years);
                    if let Ok(o) = &out {
                        println!(
                            "seed {seed}: {years} years to {}, hash {}, {} ms",
                            o.end, o.state_hash, o.wall_ms
                        );
                    }
                    slots.lock().expect("no worker panics holding the lock")[i] = Some(out);
                }
            });
        }
    });
    Ok(slots
        .into_inner()
        .expect("no worker panicked")
        .into_iter()
        .map(|o| o.expect("every seed ran"))
        .collect())
}

/// The seeds that ran, in seed order, and an error naming every seed that failed (None if all
/// ran).
fn split_failures(results: Vec<Result<SeedOutput, String>>) -> (Vec<SeedOutput>, Option<String>) {
    let total = results.len();
    let (mut done, mut failed) = (Vec::new(), Vec::new());
    for r in results {
        match r {
            Ok(o) => done.push(o),
            Err(e) => failed.push(e),
        }
    }
    let error = (!failed.is_empty()).then(|| {
        format!(
            "{} of {total} seeds failed (the others' rows are written):\n  {}",
            failed.len(),
            failed.join("\n  ")
        )
    });
    (done, error)
}

/// Section markers of a `soak-seed` child's stdout.
const YEARS_MARK: &str = "#years";
const QUARTERS_MARK: &str = "#quarters";
const END_MARK: &str = "#end ";

/// `soak-seed`: runs one seed and prints its rows and timing for the parent's [`run_child`].
pub fn soak_seed(data: &WorldData, seed: u64, years: u32) -> Result<(), String> {
    let o = run_seed(data, seed, years, false, None)?;
    print!(
        "{YEARS_MARK}\n{}{QUARTERS_MARK}\n{}{END_MARK}{} {} {} {}\n",
        o.years, o.quarters, o.ticks, o.wall_ms, o.state_hash, o.end
    );
    Ok(())
}

fn run_child(exe: &Path, data_dir: &Path, seed: u64, years: u32) -> Result<SeedOutput, String> {
    let out = Command::new(exe)
        .arg("soak-seed")
        .args(["--seed", &seed.to_string(), "--years", &years.to_string()])
        .arg("--data-dir")
        .arg(data_dir)
        .output()
        .map_err(|e| format!("seed {seed}: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "seed {seed}: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    parse_child(seed, &String::from_utf8_lossy(&out.stdout))
        .ok_or(format!("seed {seed}: unreadable child output"))
}

/// The parent's reading of a child's stdout (`soak_seed`).
fn parse_child(seed: u64, text: &str) -> Option<SeedOutput> {
    let rest = text.strip_prefix(YEARS_MARK)?.strip_prefix('\n')?;
    let (years, rest) = rest.split_once(&format!("{QUARTERS_MARK}\n"))?;
    let (quarters, end) = rest.split_once(END_MARK)?;
    let mut f = end.trim_end().splitn(4, ' ');
    let ticks = f.next()?.parse().ok()?;
    let wall_ms = f.next()?.parse().ok()?;
    let state_hash = f.next()?.to_string();
    let end = f.next()?.to_string();
    Some(SeedOutput {
        seed,
        years: years.to_string(),
        quarters: quarters.to_string(),
        ticks,
        wall_ms,
        state_hash,
        end,
    })
}

/// The three files from the outputs (in seed order).
pub fn write_outputs(dir: &Path, outputs: &[SeedOutput], years: u32) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    let mut y = format!("{YEARS_HEADER}\n");
    let mut q = format!("{QUARTERS_HEADER}\n");
    let mut t = format!("{TIMING_HEADER}\n");
    for o in outputs {
        y.push_str(&o.years);
        q.push_str(&o.quarters);
        writeln!(
            t,
            "{},{years},{},{},{:.0}",
            o.seed,
            o.ticks,
            o.wall_ms,
            o.wall_ms as f64 / f64::from(years.max(1))
        )
        .unwrap();
    }
    for (name, text) in [("years.csv", y), ("quarters.csv", q), ("timing.csv", t)] {
        let path = dir.join(name);
        std::fs::write(&path, text).map_err(|e| format!("{}: {e}", path.display()))?;
    }
    Ok(())
}

/// `soak`: runs, writes the three files and prints the timing. If a seed fails, the seeds that ran
/// are still written, and the error lists every failed seed.
pub fn soak(data_dir: &Path, args: &SoakArgs) -> Result<(), String> {
    let jobs = args.jobs.unwrap_or_else(default_jobs);
    let n = args.seeds.1 - args.seeds.0 + 1;
    println!(
        "soak: seeds {}..{} ({n}), {} years, {jobs} jobs",
        args.seeds.0, args.seeds.1, args.years
    );
    let start = Instant::now();
    let (outputs, failed) = split_failures(run_seeds(data_dir, args.seeds, args.years, jobs)?);
    let wall = start.elapsed().as_secs_f64();
    write_outputs(&args.out, &outputs, args.years)?;
    let mut ms: Vec<u128> = outputs.iter().map(|o| o.wall_ms).collect();
    ms.sort_unstable();
    if let (Some(lo), Some(hi)) = (ms.first(), ms.last()) {
        let ticks: u64 = outputs.iter().map(|o| o.ticks).sum();
        println!(
            "{} seeds in {wall:.1} s wall ({jobs} jobs); per seed min {lo} ms, median {} ms, max \
             {hi} ms; {ticks} ticks; wrote {}",
            outputs.len(),
            ms[ms.len() / 2],
            args.out.display()
        );
    }
    failed.map_or(Ok(()), Err)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn output(seed: u64) -> SeedOutput {
        SeedOutput {
            seed,
            years: format!("{seed},2020\n"),
            quarters: String::new(),
            ticks: 1,
            wall_ms: 1,
            state_hash: "h".into(),
            end: "2021-01-01 00:00".into(),
        }
    }

    #[test]
    fn failed_seeds_are_all_named_and_the_rest_kept_in_order() {
        let results = vec![
            Err("seed 1: boom".to_string()),
            Ok(output(2)),
            Err("seed 3: bang".to_string()),
            Ok(output(4)),
        ];
        let (done, error) = split_failures(results);
        assert_eq!(done.iter().map(|o| o.seed).collect::<Vec<_>>(), [2, 4]);
        let e = error.unwrap();
        assert!(e.starts_with("2 of 4 seeds failed"), "{e}");
        assert!(
            e.contains("seed 1: boom") && e.contains("seed 3: bang"),
            "{e}"
        );
        assert!(split_failures(vec![Ok(output(5))]).1.is_none());
    }

    #[test]
    fn child_output_round_trips() {
        let text = format!(
            "{YEARS_MARK}\n1,2020,a\n{QUARTERS_MARK}\n1,2020,1\n{END_MARK}8784 12 abc 2021-01-01 00:00\n"
        );
        let o = parse_child(1, &text).unwrap();
        assert_eq!(
            (o.years.as_str(), o.quarters.as_str()),
            ("1,2020,a\n", "1,2020,1\n")
        );
        assert_eq!(
            (o.ticks, o.wall_ms, o.state_hash.as_str()),
            (8784, 12, "abc")
        );
        assert_eq!(o.end, "2021-01-01 00:00");
        assert!(parse_child(1, "garbage").is_none());
    }
}
