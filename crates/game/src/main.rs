//! The desktop app (build-plan M7): the sim bridge and the UI shell.
//!
//! `cargo run -p game --release [-- --seed N]`. Benches (D14): `--bench-table [seconds]
//! [--rows N]`, `--bench-max [seconds]`, `--bench-map [seconds]` (D639) and `--bench-pages` (the M9.9 timing harness: every
//! page, Company tab and Pdoomberg function page to its first laid-out frame, exit 1 when one
//! takes 100 ms or more), which print timings to stdout and exit. `--bench-map` takes
//! `--bench-map-running [SPEED]` (D744), `--bench-map-panes SET` (D778) and
//! `--bench-map-alerts-off` (D802) and exits 1 when its p99 running frame is 16.7 ms or more;
//! `--features profile` adds its span timer (D770).
//!
//! The map (M8) reads `assets/map` (lane P's files, docs/build/m8-map-assets.md); `--map-dir DIR`
//! reads another folder, and `--synthetic-map [DIR]` first writes a synthetic map there (D634;
//! the North American and Taiwanese provinces and one Fijian speck on made-up islands, 4096 x
//! 2048, in a temp folder by default) and runs on it.

use std::path::PathBuf;

use bevy::prelude::*;
use bevy::window::{PresentMode, WindowLevel};
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
    shot: Option<game::shot::ShotPlugin>,
    /// The synthetic map's width (its height is half).
    synthetic_width: u32,
    /// `--map-mode` and `--map-metros`, for a screenshot or `--bench-map`.
    map_mode: Option<sim::views::map_layers::MapMode>,
    map_metros: bool,
    /// `--bench-map-running [SPEED]`: the map bench with the sim running (D744).
    map_speed: u8,
    /// `--bench-map-panes SET`: which panes the map bench opens (D778).
    map_panes: game::bench::MapPanes,
    /// `--bench-map-alerts-off`: every alert Off while the map bench runs the sim (D802).
    map_alerts_off: bool,
    /// `--foreground`: a bench or screenshot window opens as normal, focused (D790).
    foreground: bool,
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
        shot: None,
        synthetic_width: SYNTHETIC_SIZE.0,
        map_mode: None,
        map_metros: false,
        map_speed: 0,
        map_panes: game::bench::MapPanes::All,
        map_alerts_off: false,
        foreground: false,
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
            flag @ ("--bench-table" | "--bench-max" | "--bench-map") => {
                let seconds = number(i).unwrap_or(DEFAULT_BENCH_SECONDS);
                args.bench = Some(match flag {
                    "--bench-table" => BenchMode::Table {
                        seconds,
                        rows: None,
                    },
                    "--bench-max" => BenchMode::Max { seconds },
                    _ => BenchMode::Map {
                        seconds,
                        mode: Default::default(),
                        metros: false,
                        speed: 0,
                        panes: game::bench::MapPanes::All,
                        alerts_off: false,
                    },
                });
                if number(i).is_some() {
                    i += 1;
                }
            }
            "--bench-pages" => args.bench = Some(BenchMode::Pages),
            "--screenshot" => {
                args.shot = Some(game::shot::ShotPlugin {
                    path: PathBuf::from(
                        list.get(i + 1)
                            .unwrap_or_else(|| exit_usage("--screenshot needs a file")),
                    ),
                    look: None,
                    zoom: 0.0,
                    click: false,
                    hide_windows: false,
                    mode: None,
                    metros: false,
                });
                i += 1;
            }
            "--map-look" => {
                let v: Vec<f64> = list
                    .get(i + 1)
                    .map(|s| s.split(',').filter_map(|v| v.parse().ok()).collect())
                    .unwrap_or_default();
                if v.len() != 2 {
                    exit_usage("--map-look needs LON,LAT");
                }
                if let Some(s) = &mut args.shot {
                    s.look = Some((v[0], v[1]));
                }
                i += 1;
            }
            "--map-zoom" => {
                let z = number(i).unwrap_or_else(|| exit_usage("--map-zoom needs a number"));
                if let Some(s) = &mut args.shot {
                    s.zoom = z as f32;
                }
                i += 1;
            }
            "--map-click" => {
                if let Some(s) = &mut args.shot {
                    s.click = true;
                }
            }
            "--map-mode" => {
                args.map_mode = Some(
                    list.get(i + 1)
                        .and_then(|s| game::shot::parse_mode(s))
                        .unwrap_or_else(|| exit_usage("--map-mode needs a mode")),
                );
                i += 1;
            }
            "--map-metros" => args.map_metros = true,
            "--foreground" => args.foreground = true,
            "--bench-map-running" => {
                args.map_speed = match list.get(i + 1).and_then(|s| s.parse::<u8>().ok()) {
                    Some(n) => {
                        i += 1;
                        n.clamp(1, sim::time::control::MAX_SPEED)
                    }
                    None => sim::time::control::MAX_SPEED,
                };
            }
            "--bench-map-alerts-off" => args.map_alerts_off = true,
            "--bench-map-panes" => {
                args.map_panes = list
                    .get(i + 1)
                    .and_then(|s| game::bench::MapPanes::parse(s))
                    .unwrap_or_else(|| {
                        exit_usage("--bench-map-panes needs all, none, lists, company or province")
                    });
                i += 1;
            }
            "--map-hide-windows" => {
                if let Some(s) = &mut args.shot {
                    s.hide_windows = true;
                }
            }
            "--synthetic-width" => {
                args.synthetic_width = number(i)
                    .filter(|w| *w >= 256.0 && *w <= 8192.0)
                    .unwrap_or_else(|| exit_usage("--synthetic-width needs 256 to 8192"))
                    as u32;
                i += 1;
            }
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
        "{msg}\nusage: game [--seed N] [--map-dir DIR | --synthetic-map [DIR] [--synthetic-width W]] [--screenshot PATH [--map-look LON,LAT] [--map-zoom N] [--map-click] [--map-hide-windows]] [--map-mode MODE] [--map-metros] [--bench-table [seconds] [--rows N]] [--bench-max [seconds]] [--bench-map [seconds] [--bench-map-running [SPEED]] [--bench-map-panes SET] [--bench-map-alerts-off]] [--bench-pages] [--foreground]"
    );
    std::process::exit(2)
}

/// Writes the synthetic map (D634) from the starting data's provinces: North America on the
/// big island, Taiwan (contested) on the second, Fiji's first province as a tiny speck.
fn write_synthetic_map(data: &sim_data::WorldData, dir: &std::path::Path, width: u32) {
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
    let mut opts = SynthOptions::new(width, width / 2);
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
        write_synthetic_map(&data, dir, args.synthetic_width);
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
    let data_has_map = data.map.is_some();
    if let (Some(BenchMode::Table { rows, .. }), Some(n)) = (&mut args.bench, args.rows) {
        *rows = Some(n);
    }
    if let Some(BenchMode::Map {
        mode,
        metros,
        speed,
        panes,
        alerts_off,
        ..
    }) = &mut args.bench
    {
        *panes = args.map_panes;
        *alerts_off = args.map_alerts_off;
        *mode = args.map_mode.unwrap_or_default();
        *metros = args.map_metros;
        *speed = args.map_speed;
    }
    if let Some(s) = &mut args.shot {
        s.mode = args.map_mode;
        s.metros = args.map_metros;
    }
    let sim = Sim::new(data, args.seed).unwrap_or_else(|e| {
        eprintln!("cannot build the start state: {e}");
        std::process::exit(1)
    });
    // A screenshot or `--bench-pages` runs unattended: its window opens behind the player's
    // other windows and never takes focus (D790). The frame-rate benches keep the normal,
    // focused window, because a window that is not the active one is held at 60 fps here and
    // they would only measure that. `--foreground` gives the normal window to every run.
    let behind = match &args.bench {
        None => args.shot.is_some(),
        Some(bench) => matches!(bench, BenchMode::Pages),
    } && !args.foreground;
    let mut app = App::new();
    app.add_plugins(
        DefaultPlugins
            // The benches' span timer (D770; records only with the `profile` feature).
            .set(bevy::log::LogPlugin {
                custom_layer: game::profile::layer,
                ..default()
            })
            .set(WindowPlugin {
                primary_window: Some(Window {
                    title: "TechnoCapital20FF".into(),
                    present_mode: if args.bench.is_some() {
                        PresentMode::AutoNoVsync
                    } else {
                        PresentMode::AutoVsync
                    },
                    focused: !behind,
                    window_level: if behind {
                        WindowLevel::AlwaysOnBottom
                    } else {
                        WindowLevel::Normal
                    },
                    ..default()
                }),
                ..default()
            }),
        // Nothing is loaded through the asset server: the map shader is compiled in (D741) and
        // the map's files are read from the map folder named above.
    )
    .insert_resource(game::map::MapSource(data_has_map.then_some(map_dir)))
    .add_plugins(SimBridgePlugin::new(sim))
    // The UI config file (D452); benches and screenshots keep theirs in memory so a run never
    // edits it.
    .insert_resource(match (&args.bench, &args.shot, default_config_path()) {
        (None, None, Some(path)) => ConfigStore::at(path),
        _ => ConfigStore::in_memory(),
    })
    .add_plugins(ShellPlugin)
    .add_plugins(game::map::render::MapRenderPlugin)
    .add_systems(Startup, |mut commands: Commands| {
        commands.spawn(Camera2d);
    });
    if let Some(shot) = args.shot {
        app.add_plugins(shot);
    }
    if let Some(mode) = args.bench {
        app.add_plugins(BenchPlugin(mode));
    }
    app.run()
}
