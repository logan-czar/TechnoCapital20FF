# Province map pipeline (track P)

Builds `assets/map/` (the format is [docs/build/m8-map-assets.md](../../docs/build/m8-map-assets.md)) from
Natural Earth and geoBoundaries, region CSV by region CSV of `docs/design/data/` (all eight files are built:
3,255 provinces). Python prepares the geodata; the Rust `mapgen` crate rasterizes it. Build-plan 3.3 (P1 to P9),
map-sources.md, docs/build/m8-plan.md.

## Run it

```powershell
tools/map-pipeline/run.ps1 -Region all         # every region file in CSV order, every step
tools/map-pipeline/run.ps1 -Region europe -Steps crosswalk,shapes,simplify,mapgen,qa
```

or `tools/map-pipeline/run.sh [region] [steps]`. Both run `uv sync --frozen` (Python 3.13 venv in
`tools/map-pipeline/.venv`, pinned by `uv.lock`) and `npm ci` (mapshaper, pinned by `package-lock.json`),
then `uv run python run.py --region <slug|all>`. Needs uv, Node and cargo on PATH. A region runs on its own
(its crosswalk, shapes and QA rows are its own; mapgen always draws every region built so far, so the bitmaps
keep the others); `all` runs each step for every region in turn and mapgen once. A full world run takes
about nine minutes once the cache is filled (North America's shapes take four, mapgen about 15 seconds),
with peaks of about 0.5 GB in Python and 0.7 GB in mapgen. Two runs give byte-identical assets.

| Step | Module | Does |
|---|---|---|
| fetch (P1, P2) | `pipeline/fetch.py`, `licenses.py` | Downloads every file pinned in `sources.toml` into the cache, verifying sha256; skips verified files. geoBoundaries geometry is fetched only when `boundaryLicense` (and `licenseDetail`) passes the allowlist (CC BY, CC0, public domain, OGL-Canada 2.0, OGL-UK 3.0; D601); others keep only their metadata and go to the Voronoi path |
| crosswalk (P3) | `crosswalk.py`, `text.py` | Region and province crosswalks with method, source ids, confidence, provenance and a note (D603, D604) |
| shapes (P4) | `shapes.py` | Dissolves whole units, Voronoi-splits shared ones, clips to the region, fills seams; also the land mask for the coastal check |
| simplify (P5, P6) | `simplify.py` | mapshaper `snap`, `-clean`, `-simplify interval=500 keep-shapes`; writes `provinces.geojson` (degrees; mapgen applies Miller, D602) |
| mapgen (P7) | `mapgen_step.py` | `cargo run --release -p mapgen -- build ...`: every bitmap and table of the contract, for every region built so far (one `--geojson` each) |
| qa (P8) | `qa.py` | `assets/map/qa/report-<region>.md`, a preview PNG, `assets/map/CREDITS.md`; fails on a province without pixels or a license problem |

`run.py pin --iso KEN COD --levels ADM1` pins (or re-pins) those boundaries in `sources.toml`, keeping the
others: Natural Earth hashes from a download, geoBoundaries hashes from the git-LFS pointers at the pinned tag.
New pins take geoBoundaries' simplified geometry (D670; `--full` for the full file). Pin a country there before
its region runs; a refused license keeps only the metadata.

## Files

- **Cache** (never committed): `D:\Data\tc20ff-geodata\` (`cache_dir` in `sources.toml`): raw downloads under
  `natural-earth/` and `geoboundaries/`, intermediates (`plan.json`, `provinces_raw.geojson`, `provinces.geojson`,
  `land.geojson`, `mapgen-qa.csv`) under `work/<region>/`.
- **Committed**: `assets/map/*` (bitmaps, tables, `map-meta.toml`, crosswalk CSVs, QA report and preview,
  CREDITS.md) and this folder's code, lock files and hints.
- **Hints**: `hints/<region>.toml` is the builder's review layer (D605, D673-D683), each table listed in the
  QA report:
  - `[regions]` aliases: the NE admin-1 units of a region (iso_3166_2 or adm1_code of any country,
    `region:<NE region group>`, `name:<NE unit name>`, `-<code>` to leave one out);
  - `[carve.<key>]` land from geoBoundaries units or a drawn `polygon` (`from`, `clip`, `replace`);
  - `[split.<key>]` an old NE unit cut among new regions by Voronoi on their towns;
  - `[rebuild.<ISO>]` every region of a country from geoBoundaries ADM1;
  - `[blocks]` `notes_need_place` and `level` per region; `[text]` stopwords `allow` and `stop`;
  - `[provinces.<id>]` units, places or lon/lat seeds for provinces the automatic match could not place;
  - `[review]` `notes` (Known for review) and `watch` (the watched small provinces table).

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
