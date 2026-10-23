//! mapgen command line (build-plan P7). Run in release: the 8192 x 4096 passes are slow unoptimized.
//!
//!   mapgen build --geojson provinces.geojson [--geojson more.geojson ...] --land land.geojson --csv provinces-north-america.csv
//!                --out assets/map --qa work/mapgen-qa.csv --pipeline-version pa-1
//!                --source natural_earth=v5.1.2 --source geoboundaries=v6.0.0
//!   mapgen synthetic --csv a.csv [--csv b.csv ...] --out DIR
//!
//! Options for both: --width 8192 --height 4096 --lat-max 84.

use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use mapgen::build;
use mapgen::io::{self, Meta};
use mapgen::miller::{Frame, HEIGHT, LAT_MAX_DEG, WIDTH};
use mapgen::synthetic;

#[derive(Default)]
struct Args {
    mode: String,
    geojson: Vec<PathBuf>,
    land: Option<PathBuf>,
    csv: Vec<PathBuf>,
    out: Option<PathBuf>,
    qa: Option<PathBuf>,
    pipeline_version: String,
    sources: Vec<(String, String)>,
    width: u32,
    height: u32,
    lat_max: f64,
}

fn parse() -> Result<Args, String> {
    let mut it = std::env::args().skip(1);
    let mut a = Args {
        mode: it.next().unwrap_or_default(),
        width: WIDTH,
        height: HEIGHT,
        lat_max: LAT_MAX_DEG,
        ..Args::default()
    };
    a.pipeline_version = "dev".into();
    while let Some(flag) = it.next() {
        let mut val = || it.next().ok_or_else(|| format!("{flag} needs a value"));
        match flag.as_str() {
            "--geojson" => a.geojson.push(val()?.into()),
            "--land" => a.land = Some(val()?.into()),
            "--csv" => a.csv.push(val()?.into()),
            "--out" => a.out = Some(val()?.into()),
            "--qa" => a.qa = Some(val()?.into()),
            "--pipeline-version" => a.pipeline_version = val()?,
            "--source" => {
                let v = val()?;
                let (k, s) = v.split_once('=').ok_or("--source takes name=version")?;
                a.sources.push((k.to_string(), s.to_string()));
            }
            "--width" => a.width = val()?.parse().map_err(|e| format!("--width: {e}"))?,
            "--height" => a.height = val()?.parse().map_err(|e| format!("--height: {e}"))?,
            "--lat-max" => a.lat_max = val()?.parse().map_err(|e| format!("--lat-max: {e}"))?,
            _ => return Err(format!("unknown argument {flag}")),
        }
    }
    Ok(a)
}

fn file_name(p: &Path) -> String {
    p.file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn run() -> Result<(), String> {
    let a = parse()?;
    let frame = Frame::new(a.width, a.height, a.lat_max);
    let out = a.out.clone().ok_or("--out is required")?;
    let mut csv = Vec::new();
    for p in &a.csv {
        csv.extend(io::read_csv(p)?);
    }
    csv.sort_by(|x, y| x.id.cmp(&y.id));
    let coverage: Vec<String> = a.csv.iter().map(|p| file_name(p)).collect();
    let t = Instant::now();
    let (provinces, land, sources) = match a.mode.as_str() {
        "build" => {
            if a.geojson.is_empty() {
                return Err("--geojson is required".into());
            }
            // one file per built region; every region's provinces go into the same bitmap
            let mut provinces = Vec::new();
            for g in &a.geojson {
                provinces.extend(io::read_provinces(g)?);
            }
            let mut seen = std::collections::BTreeSet::new();
            if let Some(dup) = provinces.iter().find(|p| !seen.insert(p.id.clone())) {
                return Err(format!(
                    "province {} appears in more than one --geojson",
                    dup.id
                ));
            }
            let land = match &a.land {
                Some(l) => Some(build::land_mask(&frame, &io::read_polygons(l)?)),
                None => None,
            };
            (provinces, land, a.sources.clone())
        }
        "synthetic" => (
            synthetic::provinces(&frame, &csv),
            None,
            vec![("synthetic".into(), "mapgen grid".into())],
        ),
        _ => return Err("usage: mapgen build|synthetic [options] (see the source header)".into()),
    };
    eprintln!(
        "mapgen: {} provinces read in {:.1}s",
        provinces.len(),
        t.elapsed().as_secs_f64()
    );
    let map = build::build(frame, provinces, land.as_deref());
    eprintln!(
        "mapgen: rasterized and measured in {:.1}s",
        t.elapsed().as_secs_f64()
    );
    let meta = Meta {
        pipeline_version: a.pipeline_version.clone(),
        sources,
        coverage,
    };
    for p in io::write_assets(&map, &meta, &out)? {
        eprintln!("mapgen: wrote {}", p.display());
    }
    if let Some(q) = &a.qa {
        io::write_qa(&map, &csv, q)?;
        eprintln!("mapgen: wrote {}", q.display());
    }
    let tiny = map
        .stats
        .iter()
        .filter(|s| s.area_px < build::TINY_PX)
        .count();
    let forced = map.stats.iter().filter(|s| s.forced).count();
    eprintln!(
        "mapgen: {} provinces, {tiny} tiny, {forced} given a pixel, {} adjacencies, {} sea links",
        map.ids.len(),
        map.adjacency.len(),
        map.sea.len()
    );
    Ok(())
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("mapgen: {e}");
            ExitCode::FAILURE
        }
    }
}
