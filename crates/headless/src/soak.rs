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
/// (`headless soak-seed`, D333); returns the outputs in seed order.
pub fn run_seeds(
    data_dir: &Path,
    seeds: (u64, u64),
    years: u32,
    jobs: usize,
) -> Result<Vec<SeedOutput>, String> {
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
    slots
        .into_inner()
        .expect("no worker panicked")
        .into_iter()
        .map(|o| o.expect("every seed ran"))
        .collect()
}

/// Section markers of a `soak-seed` child's stdout.
const YEARS_MARK: &str = "#years";
const QUARTERS_MARK: &str = "#quarters";
const END_MARK: &str = "#end ";

/// `soak-seed`: runs one seed and prints its rows and timing for the parent's [`run_child`].
pub fn soak_seed(data: &WorldData, seed: u64, years: u32) -> Result<(), String> {
    let o = run_seed(data, seed, years, false)?;
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

/// `soak`: runs, writes the three files and prints the timing.
pub fn soak(data_dir: &Path, args: &SoakArgs) -> Result<(), String> {
    let jobs = args.jobs.unwrap_or_else(default_jobs);
    let n = args.seeds.1 - args.seeds.0 + 1;
    println!(
        "soak: seeds {}..{} ({n}), {} years, {jobs} jobs",
        args.seeds.0, args.seeds.1, args.years
    );
    let start = Instant::now();
    let outputs = run_seeds(data_dir, args.seeds, args.years, jobs)?;
    let wall = start.elapsed().as_secs_f64();
    write_outputs(&args.out, &outputs, args.years)?;
    let mut ms: Vec<u128> = outputs.iter().map(|o| o.wall_ms).collect();
    ms.sort_unstable();
    let ticks: u64 = outputs.iter().map(|o| o.ticks).sum();
    println!(
        "{n} seeds in {wall:.1} s wall ({jobs} jobs); per seed min {} ms, median {} ms, max {} ms; \
         {ticks} ticks; wrote {}",
        ms[0],
        ms[ms.len() / 2],
        ms[ms.len() - 1],
        args.out.display()
    );
    Ok(())
}
