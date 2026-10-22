//! The desktop app (build-plan M7): the sim bridge and the UI shell.
//!
//! `cargo run -p game --release [-- --seed N]`. Benches (D14): `--bench-table [seconds]
//! [--rows N]`, `--bench-max [seconds]` and `--bench-pages` (the M9.9 timing harness: every
//! page, Company tab and Pdoomberg function page to its first laid-out frame, exit 1 when one
//! takes 100 ms or more), which print timings to stdout and exit.
//!
//! The map (M8) reads `assets/map` (lane P's files, docs/build/m8-map-assets.md); `--map-dir DIR`
//! reads another folder, and `--synthetic-map [DIR]` first writes a synthetic map there (D634;
//! the North American and Taiwanese provinces and one Fijian speck on made-up islands, 4096 x
//! 2048, in a temp folder by default) and runs on it.

use std::path::PathBuf;

use bevy::prelude::*;
use bevy::window::PresentMode;
use game::bench::{BenchMode, BenchPlugin};
use game::bridge::SimBridgePlugin;
use game::config::{ConfigStore, default_config_path};
use game::ui::ShellPlugin;
use sim::Sim;

/// The seed when none is given (D305).
const DEFAULT_SEED: u64 = 1;
/// Seconds a bench runs when none is given.
const DEFAULT_BENCH_SECONDS: f64 = 10.0;

struct Args {
    seed: u64,
    bench: Option<BenchMode>,
    rows: Option<usize>,
    map_dir: Option<PathBuf>,
    /// Write a synthetic map into this folder first.
    synthetic: Option<PathBuf>,
}

/// The synthetic map's size (D634).
const SYNTHETIC_SIZE: (u32, u32) = (4096, 2048);

fn parse_args() -> Args {
    let mut args = Args {
        seed: DEFAULT_SEED,
        bench: None,
        rows: None,
        map_dir: None,
        synthetic: None,
    };
    let list: Vec<String> = std::env::args().skip(1).collect();
    let mut i = 0;
    let number = |i: usize| list.get(i + 1).and_then(|s| s.parse::<f64>().ok());
    while i < list.len() {
        match list[i].as_str() {
            "--seed" => {
                args.seed = list
                    .get(i + 1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or_else(|| exit_usage("--seed needs a number"));
                i += 1;
            }
            flag @ ("--bench-table" | "--bench-max") => {
                let seconds = number(i).unwrap_or(DEFAULT_BENCH_SECONDS);
                args.bench = Some(if flag == "--bench-table" {
                    BenchMode::Table {
                        seconds,
                        rows: None,
                    }
                } else {
                    BenchMode::Max { seconds }
                });
                if number(i).is_some() {
                    i += 1;
                }
            }
            "--bench-pages" => args.bench = Some(BenchMode::Pages),
            "--map-dir" => {
                args.map_dir = Some(PathBuf::from(
                    list.get(i + 1)
                        .unwrap_or_else(|| exit_usage("--map-dir needs a folder")),
                ));
                i += 1;
            }
            "--synthetic-map" => match list.get(i + 1).filter(|a| !a.starts_with("--")) {
                Some(dir) => {
                    args.synthetic = Some(PathBuf::from(dir));
                    i += 1;
                }
                None => args.synthetic = Some(std::env::temp_dir().join("tc20ff-synthetic-map")),
            },
            "--rows" => {
                args.rows = Some(
                    list.get(i + 1)
                        .and_then(|s| s.parse().ok())
                        .unwrap_or_else(|| exit_usage("--rows needs a number")),
                );
                i += 1;
            }
            other => exit_usage(&format!("unknown argument {other}")),
        }
        i += 1;
    }
    args
}

fn exit_usage(msg: &str) -> ! {
    eprintln!(
        "{msg}\nusage: game [--seed N] [--map-dir DIR | --synthetic-map [DIR]] [--bench-table [seconds] [--rows N]] [--bench-max [seconds]] [--bench-pages]"
    );
    std::process::exit(2)
}

/// Writes the synthetic map (D634) from the starting data's provinces: North America on the
/// big island, Taiwan (contested) on the second, Fiji's first province as a tiny speck.
fn write_synthetic_map(data: &sim_data::WorldData, dir: &std::path::Path) {
    use game::map::synthetic::{SynthOptions, SynthProvince, generate, write};
    let mut provinces = Vec::new();
    let mut coverage = Vec::new();
    for (table, _, p) in data.all_provinces() {
        let island = if table.file == "provinces-north-america.csv" {
            0
        } else if p.id.starts_with("TW-") {
            1
        } else if p.id == "FJ-0001" {
            2
        } else {
            continue;
        };
        if !coverage.contains(&table.file) {
            coverage.push(table.file.clone());
        }
        provinces.push(SynthProvince {
            id: p.id.clone(),
            country: p.country.clone(),
            region: p.region.clone(),
            island,
        });
    }
    let mut opts = SynthOptions::new(SYNTHETIC_SIZE.0, SYNTHETIC_SIZE.1);
    opts.coverage = coverage;
    let started = std::time::Instant::now();
    let map = generate(&provinces, &opts);
    if let Err(e) = write(dir, &map) {
        eprintln!("cannot write the synthetic map: {e}");
        std::process::exit(1)
    }
    println!(
        "synthetic map: {} provinces in {} ({:.1} s)",
        map.provinces.len(),
        dir.display(),
        started.elapsed().as_secs_f64()
    );
}

/// Exits non-zero when a bench fails its target (`--bench-pages`, D573).
fn main() -> AppExit {
    let mut args = parse_args();
    let mut data = sim_data::load_world(&sim_data::default_data_dir()).unwrap_or_else(|e| {
        eprintln!("cannot load the starting data: {e}");
        std::process::exit(1)
    });
    if let Some(dir) = &args.synthetic {
        write_synthetic_map(&data, dir);
        args.map_dir = Some(dir.clone());
    }
    let map_dir = args
        .map_dir
        .clone()
        .unwrap_or_else(sim_data::default_map_dir);
    data.map = sim_data::load_map(&map_dir).unwrap_or_else(|e| {
        eprintln!("cannot load the map in {}: {e}", map_dir.display());
        std::process::exit(1)
    });
    if data.map.is_none() {
        eprintln!(
            "no map assets in {}; the map stays empty",
            map_dir.display()
        );
    }
    if let (Some(BenchMode::Table { rows, .. }), Some(n)) = (&mut args.bench, args.rows) {
        *rows = Some(n);
    }
    let sim = Sim::new(data, args.seed).unwrap_or_else(|e| {
        eprintln!("cannot build the start state: {e}");
        std::process::exit(1)
    });
    let mut app = App::new();
    app.add_plugins(DefaultPlugins.set(WindowPlugin {
        primary_window: Some(Window {
            title: "TechnoCapital20FF".into(),
            present_mode: if args.bench.is_some() {
                PresentMode::AutoNoVsync
            } else {
                PresentMode::AutoVsync
            },
            ..default()
        }),
        ..default()
    }))
    .add_plugins(SimBridgePlugin::new(sim))
    // The UI config file (D452); benches keep theirs in memory so a run never edits it.
    .insert_resource(match (&args.bench, default_config_path()) {
        (None, Some(path)) => ConfigStore::at(path),
        _ => ConfigStore::in_memory(),
    })
    .add_plugins(ShellPlugin)
    .add_systems(Startup, |mut commands: Commands| {
        commands.spawn(Camera2d);
    });
    if let Some(mode) = args.bench {
        app.add_plugins(BenchPlugin(mode));
    }
    app.run()
}
