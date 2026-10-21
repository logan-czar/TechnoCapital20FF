//! Runs the simulation with no window (build-plan 2.1).
//!
//! - `--check-data` (M0.9) loads every data table, prints the row counts and runs the load-time
//!   checks; a bad row exits non-zero with its file, line and field (spec 10 M0).
//! - `run` (M1.8, M1.9, the start of the M10.1 soak harness) runs each seed for N years through the
//!   `Sim` API only, prints the state hash each month with `--hash-monthly`, and writes one metrics
//!   row per seed per year.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use sim::time::{Date, DateTime};
use sim::{Notice, Sim};

const USAGE: &str = "usage:\n  \
    headless --check-data [--data-dir DIR]\n  \
    headless run --years N --seeds A..B [--out metrics.csv] [--hash-monthly] [--data-dir DIR]\n\
    DIR defaults to the repository's docs/design/data; seeds A..B are inclusive (a single seed A \
    also works)";

/// Metrics CSV header; later milestones add columns.
const METRICS_HEADER: &str = "seed,year,ticks,final_hash,wall_ms";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("run") {
        return match RunArgs::parse(&args[1..]) {
            Some(a) => run(&a),
            None => usage(),
        };
    }
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
    dir: PathBuf,
}

impl RunArgs {
    fn parse(args: &[String]) -> Option<RunArgs> {
        let (mut years, mut seeds, mut out, mut hash_monthly) = (None, None, None, false);
        let mut dir = sim_data::default_data_dir();
        let mut it = args.iter();
        while let Some(arg) = it.next() {
            match arg.as_str() {
                "--years" => years = Some(it.next()?.parse().ok()?),
                "--seeds" => seeds = Some(parse_seeds(it.next()?)?),
                "--out" => out = Some(PathBuf::from(it.next()?)),
                "--hash-monthly" => hash_monthly = true,
                "--data-dir" => dir = PathBuf::from(it.next()?),
                _ => return None,
            }
        }
        Some(RunArgs {
            years: years.filter(|&y| y > 0)?,
            seeds: seeds?,
            out,
            hash_monthly,
            dir,
        })
    }
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

fn run(args: &RunArgs) -> ExitCode {
    let data = match sim_data::load_world(&args.dir) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("error: {e}");
            return ExitCode::FAILURE;
        }
    };
    let end_year = sim::time::calendar::EPOCH_YEAR + args.years as i32;
    let end = DateTime::midnight(Date::ymd(end_year, 1, 1));
    let mut csv = format!("{METRICS_HEADER}\n");
    let (mut all_ticks, all_start) = (0u64, Instant::now());
    for seed in args.seeds.0..=args.seeds.1 {
        let mut sim = match Sim::new(data.clone(), seed) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("error: {e}");
                return ExitCode::FAILURE;
            }
        };
        let (seed_start, mut year_start) = (Instant::now(), Instant::now());
        let mut year_ticks = 0u64;
        while sim.now() < end {
            year_ticks += 1;
            for n in sim.step() {
                let Notice::MonthDone(month) = n else {
                    continue;
                };
                let hash = sim.state_hash();
                if args.hash_monthly {
                    println!("seed {seed} {month} {hash}");
                }
                if month.month == 12 {
                    let ms = year_start.elapsed().as_millis();
                    writeln!(csv, "{seed},{},{year_ticks},{hash},{ms}", month.year).unwrap();
                    all_ticks += year_ticks;
                    year_ticks = 0;
                    year_start = Instant::now();
                }
            }
        }
        let secs = seed_start.elapsed().as_secs_f64();
        println!(
            "seed {seed}: {} years to {}, hash {}, {:.0} ms",
            args.years,
            sim.now(),
            sim.state_hash(),
            secs * 1000.0
        );
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
