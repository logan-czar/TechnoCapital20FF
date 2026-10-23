# Province map pipeline (track P)

Builds `assets/map/` (the format is [docs/build/m8-map-assets.md](../../docs/build/m8-map-assets.md)) from
Natural Earth and geoBoundaries, for one region CSV of `docs/design/data/` at a time. Python prepares the
geodata; the Rust `mapgen` crate rasterizes it. Build-plan 3.3 (P1 to P9), map-sources.md, docs/build/m8-plan.md.

## Run it

```powershell
tools/map-pipeline/run.ps1                     # north-america, every step
tools/map-pipeline/run.ps1 -Steps crosswalk,shapes,simplify,mapgen,qa
```

or `tools/map-pipeline/run.sh [region] [steps]`. Both run `uv sync --frozen` (Python 3.13 venv in
`tools/map-pipeline/.venv`, pinned by `uv.lock`) and `npm ci` (mapshaper, pinned by `package-lock.json`),
then `uv run python run.py --region north-america`. Needs uv, Node and cargo on PATH. A full run takes
about two minutes once the cache is filled.

| Step | Module | Does |
|---|---|---|
| fetch (P1, P2) | `pipeline/fetch.py`, `licenses.py` | Downloads every file pinned in `sources.toml` into the cache, verifying sha256; skips verified files. geoBoundaries geometry is fetched only when `boundaryLicense` (and `licenseDetail`) passes the allowlist (CC BY, CC0, public domain, OGL-Canada 2.0, OGL-UK 3.0; D601); others keep only their metadata and go to the Voronoi path |
| crosswalk (P3) | `crosswalk.py`, `text.py` | Region and province crosswalks with method, source ids, confidence, provenance and a note (D603, D604) |
| shapes (P4) | `shapes.py` | Dissolves whole units, Voronoi-splits shared ones, clips to the region, fills seams; also the land mask for the coastal check |
| simplify (P5, P6) | `simplify.py` | mapshaper `snap`, `-clean`, `-simplify interval=500 keep-shapes`; writes `provinces.geojson` (degrees; mapgen applies Miller, D602) |
| mapgen (P7) | `mapgen_step.py` | `cargo run --release -p mapgen -- build ...`: every bitmap and table of the contract, for every region built so far (one `--geojson` each) |
| qa (P8) | `qa.py` | `assets/map/qa/report-<region>.md`, a preview PNG, `assets/map/CREDITS.md`; fails on a province without pixels or a license problem |

`run.py pin --iso USA CAN MEX` re-pins `sources.toml` (Natural Earth hashes from a download, geoBoundaries
hashes from the git-LFS pointers at the pinned tag). Add a country's ISO codes there before its region runs.

## Files

- **Cache** (never committed): `D:\Data\tc20ff-geodata\` (`cache_dir` in `sources.toml`): raw downloads under
  `natural-earth/` and `geoboundaries/`, intermediates (`plan.json`, `provinces_raw.geojson`, `provinces.geojson`,
  `land.geojson`, `mapgen-qa.csv`) under `work/<region>/`.
- **Committed**: `assets/map/*` (bitmaps, tables, `map-meta.toml`, crosswalk CSVs, QA report and preview,
  CREDITS.md) and this folder's code, lock files and hints.
- **Hints**: `hints/<region>.toml` holds region aliases and builder-placed provinces the automatic match could
  not place (D605). Each hinted row is listed in the QA report.

## Reviewing a region

Open `assets/map/qa/report-<region>.md`: the low-confidence rows (under 0.6) and the hinted rows are the ones to
check, with `qa/preview-<region>.png` beside it. Fix a wrong province with a hint and rerun from `crosswalk`.

## mapgen alone

```
cargo run --release -p mapgen -- build --geojson provinces.geojson --land land.geojson \
    --csv docs/design/data/provinces-north-america.csv --out assets/map --qa mapgen-qa.csv
cargo run --release -p mapgen -- synthetic --csv a.csv [--csv b.csv ...] --out DIR
```

`synthetic` lays every CSV province out as a grid cell (real ids, fake shapes) for testing the game's map code.
