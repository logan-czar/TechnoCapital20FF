//! Runs the simulation with no window (build-plan 2.1). M0.9: `--check-data` loads every data
//! table, prints the row counts and runs the load-time checks; a bad row exits non-zero with its
//! file, line and field (spec 10 M0).

use std::path::PathBuf;
use std::process::ExitCode;

const USAGE: &str = "usage: headless --check-data [--data-dir DIR]\n\
    DIR defaults to the repository's docs/design/data";

fn main() -> ExitCode {
    let mut check_data = false;
    let mut dir = sim_data::default_data_dir();
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--check-data" => check_data = true,
            "--data-dir" => match args.next() {
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

fn check(dir: &std::path::Path) -> ExitCode {
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
        if let Err(e) = sim::Sim::new(world, 0) {
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
