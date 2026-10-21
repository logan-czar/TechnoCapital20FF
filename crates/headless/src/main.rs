//! Runs the simulation with no window (build-plan 2.1).
//!
//! - `--check-data` (M0.9) loads every data table, prints the row counts and runs the load-time
//!   checks; a bad row exits non-zero with its file, line and field (spec 10 M0).
//! - `run` (M1.8, M1.9) runs each seed for N years through the `Sim` API only, prints the state
//!   hash each month with `--hash-monthly`, and writes the soak's yearly metrics rows.
//! - `soak` (M10.1) runs many seeds, each in its own child process (`soak-seed`, D333), and writes
//!   `years.csv`, `quarters.csv` and `timing.csv`; `check` (M10.2, M10.3) marks every spec 10 target per seed (docs/build/
//!   soak.md).

mod metrics;
mod profile;
mod soak;
mod targets;

use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use sim::Sim;

use crate::metrics::{YEARS_HEADER, run_seed};
use crate::profile::Profiler;
use crate::soak::{DEFAULT_SEEDS, DEFAULT_YEARS, SoakArgs};

const USAGE: &str = "usage:\n  \
    headless --check-data [--data-dir DIR]\n  \
    headless run --years N --seeds A..B [--out metrics.csv] [--hash-monthly] [--profile] [--data-dir DIR]\n  \
    headless soak [--years N] [--seeds A..B] [--jobs N] --out DIR [--check] [--data-dir DIR]\n  \
    headless check DIR\n\
    DIR defaults to the repository's docs/design/data; seeds A..B are inclusive (a single seed A \
    also works); soak defaults to 30 years and seeds 1..50, jobs to half the cores";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("run") => match RunArgs::parse(&args[1..]) {
            Some(a) => run(&a),
            None => usage(),
        },
        Some("soak") => match parse_soak(&args[1..]) {
            Some((a, dir)) => soak_command(&a, &dir),
            None => usage(),
        },
        Some("soak-seed") => match parse_soak_seed(&args[1..]) {
            Some((seed, years, dir)) => report(
                sim_data::load_world(&dir)
                    .map_err(|e| e.to_string())
                    .and_then(|d| soak::soak_seed(&d, seed, years)),
            ),
            None => usage(),
        },
        Some("check") => match &args[1..] {
            [dir] => report(targets::check_dir(Path::new(dir))),
            _ => usage(),
        },
        _ => check_data_command(args),
    }
}

fn check_data_command(args: Vec<String>) -> ExitCode {
    let mut check_data = false;
    let mut dir = sim_data::default_data_dir();
    let mut it = args.into_iter();
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--check-data" => check_data = true,
            "--data-dir" => match it.next() {
                Some(d) => dir = PathBuf::from(d),
                None => return usage(),
            },
            _ => return usage(),
        }
    }
    if !check_data {
        return usage();
    }
    check(&dir)
}

fn usage() -> ExitCode {
    eprintln!("{USAGE}");
    ExitCode::from(2)
}

fn report(r: Result<(), String>) -> ExitCode {
    match r {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}

fn check(dir: &Path) -> ExitCode {
    let world = match sim_data::load_world(dir) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("error: {e}");
            return ExitCode::FAILURE;
        }
    };
    println!("Loaded {}", dir.display());
    for (name, n) in world.counts() {
        println!("  {name:18} {n:>6}");
    }
    let errors = sim_data::check(&world);
    for e in &errors {
        eprintln!("error: {e}");
    }
    if errors.is_empty() {
        if let Err(e) = Sim::new(world, 0) {
            eprintln!("error: {e}");
            return ExitCode::FAILURE;
        }
        println!("OK");
        ExitCode::SUCCESS
    } else {
        eprintln!("{} errors", errors.len());
        ExitCode::FAILURE
    }
}

/// Arguments of `run`.
struct RunArgs {
    years: u32,
    seeds: (u64, u64),
    out: Option<PathBuf>,
    hash_monthly: bool,
    profile: bool,
    dir: PathBuf,
}

impl RunArgs {
    fn parse(args: &[String]) -> Option<RunArgs> {
        let (mut years, mut seeds, mut out, mut hash_monthly) = (None, None, None, false);
        let mut profile = false;
        let mut dir = sim_data::default_data_dir();
        let mut it = args.iter();
        while let Some(arg) = it.next() {
            match arg.as_str() {
                "--years" => years = Some(it.next()?.parse().ok()?),
                "--seeds" => seeds = Some(parse_seeds(it.next()?)?),
                "--out" => out = Some(PathBuf::from(it.next()?)),
                "--hash-monthly" => hash_monthly = true,
                "--profile" => profile = true,
                "--data-dir" => dir = PathBuf::from(it.next()?),
                _ => return None,
            }
        }
        Some(RunArgs {
            years: years.filter(|&y| y > 0)?,
            seeds: seeds?,
            out,
            hash_monthly,
            profile,
            dir,
        })
    }
}

/// The `soak` arguments and the data directory.
fn parse_soak(args: &[String]) -> Option<(SoakArgs, PathBuf)> {
    let (mut years, mut seeds, mut jobs, mut out, mut check) =
        (DEFAULT_YEARS, DEFAULT_SEEDS, None, None, false);
    let mut dir = sim_data::default_data_dir();
    let mut it = args.iter();
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--years" => years = it.next()?.parse().ok().filter(|&y| y > 0)?,
            "--seeds" => seeds = parse_seeds(it.next()?)?,
            "--jobs" => jobs = Some(it.next()?.parse().ok().filter(|&j| j > 0)?),
            "--out" => out = Some(PathBuf::from(it.next()?)),
            "--check" => check = true,
            "--data-dir" => dir = PathBuf::from(it.next()?),
            _ => return None,
        }
    }
    let args = SoakArgs {
        years,
        seeds,
        jobs,
        out: out?,
        check,
    };
    Some((args, dir))
}

/// `soak-seed --seed S --years N [--data-dir DIR]` (the soak's child process, D333).
fn parse_soak_seed(args: &[String]) -> Option<(u64, u32, PathBuf)> {
    let (mut seed, mut years, mut dir) = (None, None, sim_data::default_data_dir());
    let mut it = args.iter();
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--seed" => seed = Some(it.next()?.parse().ok()?),
            "--years" => years = it.next()?.parse().ok().filter(|&y| y > 0),
            "--data-dir" => dir = PathBuf::from(it.next()?),
            _ => return None,
        }
    }
    Some((seed?, years?, dir))
}

/// `A..B` (inclusive) or `A`.
fn parse_seeds(s: &str) -> Option<(u64, u64)> {
    let (a, b) = match s.split_once("..") {
        Some((a, b)) => (a.parse().ok()?, b.parse().ok()?),
        None => {
            let a = s.parse().ok()?;
            (a, a)
        }
    };
    (a <= b).then_some((a, b))
}

fn soak_command(args: &SoakArgs, dir: &Path) -> ExitCode {
    let r = soak::soak(dir, args).and_then(|()| {
        if args.check {
            targets::check_dir(&args.out)
        } else {
            Ok(())
        }
    });
    report(r)
}

fn run(args: &RunArgs) -> ExitCode {
    let data = match sim_data::load_world(&args.dir) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("error: {e}");
            return ExitCode::FAILURE;
        }
    };
    let mut csv = format!("{YEARS_HEADER}\n");
    let (mut all_ticks, all_start) = (0u64, Instant::now());
    for seed in args.seeds.0..=args.seeds.1 {
        let mut profiler = args.profile.then(Profiler::new);
        let out = match run_seed(
            &data,
            seed,
            args.years,
            args.hash_monthly,
            profiler.as_mut(),
        ) {
            Ok(o) => o,
            Err(e) => {
                eprintln!("error: {e}");
                return ExitCode::FAILURE;
            }
        };
        println!(
            "seed {seed}: {} years to {}, hash {}, {} ms",
            args.years, out.end, out.state_hash, out.wall_ms
        );
        if let Some(p) = &profiler {
            println!("profile, seed {seed}:\n{}", p.table());
        }
        csv.push_str(&out.years);
        all_ticks += out.ticks;
    }
    let secs = all_start.elapsed().as_secs_f64();
    println!(
        "{all_ticks} ticks in {:.0} ms: {:.0} ticks/s",
        secs * 1000.0,
        all_ticks as f64 / secs.max(f64::MIN_POSITIVE)
    );
    if let Some(path) = &args.out
        && let Err(e) = std::fs::write(path, csv)
    {
        eprintln!("error: {}: {e}", path.display());
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}
