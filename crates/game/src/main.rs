//! The desktop app (build-plan M7): the sim bridge and the UI shell.
//!
//! `cargo run -p game --release [-- --seed N]`. Benches (D14): `--bench-table [seconds]
//! [--rows N]` and `--bench-max [seconds]`, which print timings to stdout and exit.

use std::sync::Arc;

use bevy::prelude::*;
use bevy::window::PresentMode;
use game::bench::{BenchMode, BenchPlugin};
use game::bridge::SimBridgePlugin;
use game::ui::ShellPlugin;
use game::ui::screens::demo_tables;
use sim::Sim;

/// The seed when none is given (D305).
const DEFAULT_SEED: u64 = 1;
/// Seconds a bench runs when none is given.
const DEFAULT_BENCH_SECONDS: f64 = 10.0;

struct Args {
    seed: u64,
    bench: Option<BenchMode>,
    rows: Option<usize>,
}

fn parse_args() -> Args {
    let mut args = Args {
        seed: DEFAULT_SEED,
        bench: None,
        rows: None,
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
                    BenchMode::Table { seconds }
                } else {
                    BenchMode::Max { seconds }
                });
                if number(i).is_some() {
                    i += 1;
                }
            }
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
        "{msg}\nusage: game [--seed N] [--bench-table [seconds] [--rows N]] [--bench-max [seconds]]"
    );
    std::process::exit(2)
}

fn main() {
    let args = parse_args();
    let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap_or_else(|e| {
        eprintln!("cannot load the starting data: {e}");
        std::process::exit(1)
    });
    let mut demo = demo_tables(&data);
    if let Some(n) = args.rows {
        demo.provinces = Arc::new(demo.provinces.repeated_to(n));
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
    .insert_resource(demo)
    .add_plugins(ShellPlugin)
    .add_systems(Startup, |mut commands: Commands| {
        commands.spawn(Camera2d);
    });
    if let Some(mode) = args.bench {
        app.add_plugins(BenchPlugin(mode));
    }
    app.run();
}
