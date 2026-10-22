# M8 plan: the map, and track P (the province bitmap pipeline)

_Draft for Logan, 2026-10-22. Built from build-plan M8.1–M8.8 and track P1–P9, mvp-spec 8 (Map row), 9.2 `get_map_layer` and gap G1, map-sources.md, opengs-review.md, and Logan's answers. Nothing here is built yet._

## 1. Where things stand

- **Track P has not started.** There is no geodata, `crates/mapgen` is a 6-line stub, and there is no `assets/` folder.
- **The sim's map views are empty placeholders:** `map_static`, `map_layers` and `province_cards` in `crates/sim/src/views/`.
- **Tools:** this PC has Node 24 (for mapshaper) but not the Python geodata stack, and Python 3.15 is probably too new for geopandas wheels.

## 2. What Logan decided

| Topic | Decision |
|---|---|
| Where the map lives | **Behind the panes.** The map fills the window, CK3 style, and the workspace sits over it. Clicking a province opens its card or page in a pane |
| Pane layout | **Floating panes.** The M9 workspace becomes floating windows over the map; each window keeps the M9 tiling tree inside it, with its own panes, history and breadcrumbs. Windows move, resize, raise, minimize and close, and saved layouts store them. One key hides or shows every window. This changes the M9 workspace (D450 and its neighbours) and is logged as a decision |
| Projection | **Miller.** A plain rectangle, so the pan and texture maths are simple. The map wraps east to west |
| Style | **Flat dark data map.** Flat province fills on a dark sea, crisp borders, and the M9 theme's accents for map modes. No terrain art |
| Crosswalk | **Automatic, with flagged review.** Fuzzy name matching (using the CSV notes) to geoBoundaries units, then weighted Voronoi as the fallback. A report lists the low-confidence provinces, and Logan reviews only those plus one visual check per region |
| Tiny provinces | **8192x4096, plus click targets.** A province under a pixel threshold gets a clickable dot and label at its label point, and draws larger at Province zoom |
| Assets in git | **Commit the outputs only:** province-ids.png, the colour table, centroids and label points, adjacency, the border layer, the crosswalk CSVs and CREDITS.md. Raw downloads and large intermediate GeoJSON stay in a D: cache, rebuilt from pinned versions |
| Province page | **Yes: a hover card and a page.** The spec 8 province card shows on hover. A click opens a Province page in a pane: development, resource, terrain, Metro, key city, HQs and units there. Every province name links to it |
| Order | **North America first** (P9): the whole pipeline end to end on NA, then the world |
| Labels | **Straight, by zoom level:** countries at World zoom, regions and key cities at Country zoom, provinces at Province zoom, with overlap culling |
| Tools and data | Approved: uv, Python 3.13 and geopandas/shapely/pyogrio in a project-local venv; mapshaper via npm; about 2 GB of Natural Earth 10m and geoBoundaries gbOpen data in a D: cache outside the repo |

### Decided by the coordinator (logged, flagged for sign-off)

- **Layout:**
  - The pipeline lives in `tools/map-pipeline/` (build-plan 2.3), with its venv in `tools/map-pipeline/.venv` (gitignored).
  - The geodata cache is `D:\Data\tc20ff-geodata\`, with every source and version pinned in `tools/map-pipeline/sources.toml`.
  - Outputs go in `assets/map/`.
- **ID texture:** R16Uint (3,255 ids fit in 16 bits), 8192x4096, about 64 MB on the GPU. The PNG on disk stays RGB, one colour per province, Paradox style, with a colour-to-id CSV. mapgen also writes the R16 form, so the game needs no conversion at load.
- **Borders:** a precomputed distance-field layer, as batch 172 decided, with separate province, region and country edges. The shader picks the line width by zoom.
- **Contested provinces** are hatched, per decision C.
- **Picking** reads a CPU copy of the id bitmap under the cursor. A tiny province's click target takes priority within its radius.
- **Map modes** are chosen from a mode bar on the map. They do not use function keys, which M9 reserved for Pdoomberg.
- **The sim fills `map_static`** (centroids, label points, adjacency, area and the tiny-province flag, from assets/map loaded through sim-data), **plus `map_layers` and `province_cards`.** The UI keeps reading only views (spec 9).

## 3. Lanes and phases (at most 2 worktrees: slot-a and slot-b)

Lane P is Python plus the Rust `mapgen` tool, with no Bevy compile. Lane M is the game crate (Bevy) plus the sim views. They own separate folders, so they run in parallel.

### Phase A (in parallel)

| Lane | Owns | Work |
|---|---|---|
| **PA: NA pipeline** (slot-a) | `tools/map-pipeline/`, `crates/mapgen/`, `assets/map/` | Set up the tools. P1 fetch (pinned) → P2 license filter with a provenance column → P3 crosswalk for NA with the confidence report → P4 shapes (dissolve, clip, Voronoi) → P5 mapshaper simplify and Miller projection → P6 provinces.geojson → P7 mapgen: id bitmap (NA filled, the rest of the world as water or a placeholder), colour table, centroids and label points, adjacency, border distance field, coastal cross-check → P8 QA report for NA. Also a mapgen `--synthetic` mode that makes a test world bitmap, so lane M never waits on real data |
| **MA: map foundation** (slot-b) | `crates/game/src/map/`, `assets/shaders/`, `crates/game/src/workspace/` (the floating windows), `crates/sim/src/views/{map_static,map_layers,province_cards}.rs`, the sim-data loader for assets/map | Sim views and loader. Then:<br>M8.1 texture load;<br>M8.2 WGSL shader: id lookup, colour table texture, distance-field borders, contested hatching;<br>M8.3 camera: pan, wrap, and World, Country and Province zoom at 60 fps;<br>M8.4 picking with hover outline and select;<br>the floating-window workspace over the map. Built on the synthetic bitmap, then on NA data once PA lands |

**Gate after Phase A:** Logan looks at the NA map running in the game and reviews the NA crosswalk flags.

### Phase B (in parallel)

| Lane | Work |
|---|---|
| **PB: the world** (slot-a) | P3–P8 for the other 7 regions, in CSV-file order. One crosswalk report per region. Tiny-province report (Singapore, the London and Beijing splits). CREDITS.md built from geoBoundaries metadata. All 3,255 provinces have pixels or a click target |
| **MB: modes and pages** (slot-b) | M8.5 modes: Political, Development (Commerce, Industry, Population, Total), Industry (track or picked industry), Company HQs (pins sized by revenue and coloured by sector, with filters), Financial zones (effect shading, hub pins with exchange code and index level, zone hover card, legend), and Metro outlines over any mode.<br>M8.6 labels by zoom level with culling.<br>M8.7 the province card and zone hover card, the Province page, and province links throughout M9 pages and the command bar |

**Gate after Phase B:** Logan reviews the flagged crosswalk rows for each region.

### Phase C: closing checks (one lane)

- **M8.8 click test:** clicking each of the 3,255 label points (or click targets) gets the right id.
- 60 fps at each zoom level with the panes open, measured in release.
- Extend the M9 checks to the new pieces:
  - The leak test also covers the province card, the Province page and the HQ pins.
  - The timing harness also covers the Province page and each map mode switch.
- The P8 QA report is clean, or each issue is signed off.
- The full gate passes twice.

Every PR gets an independent reviewer before merge.

## 4. Spec and design-doc changes to log for Logan

- **20-ui (screen layout):** the map behind floating panes replaces fixed panels.
- **mvp-spec 8:** the Province page goes beyond the province card.
- **build-plan P9:** "NA by M2" slipped; NA comes now, at the start of M8.
- **map-sources.md** names Robinson or Miller; Miller is chosen.

## 5. Risks

| Risk | Mitigation |
|---|---|
| The crosswalk is the biggest piece of work (about 1,200 provinces) | Fuzzy match using the CSV notes; Voronoi fallback; Logan reviews only flagged rows; one region at a time |
| geoBoundaries license drift, or ODbL contamination | Pinned release; P2 filter; a provenance column; the QA report fails on any ODbL, SA or GADM source |
| Natural Earth admin-1 and geoBoundaries ADM2 lines don't coincide (slivers) | Snap tolerance, or take admin-1 as the dissolve of ADM2 where that exists; mapshaper `-clean` |
| GPU memory and frame time with the map plus dense panes | R16 id texture; one draw for the map; colour table updated only when a view's version moves; 60 fps checked in Phase C |
| Floating windows reopen M9's workspace code | Kept in lane MA, built on the existing tiling tree (a window holds a tree); M9's workspace tests keep passing |
| Python 3.15 too new for the geodata wheels | uv pins Python 3.13 in the venv |

## 6. Verification at the end

- Main has M8.1–M8.8 and P1–P9 merged, and the full gate passes twice.
- A release build shows the world map behind floating panes at 60 fps, with every map mode, labels, cards and the Province page.
- The click test covers all 3,255 provinces.
- The QA report is clean or signed off, and CREDITS.md is complete.
- The soak CSVs are byte-identical to before M8: map views don't move the economy.
- Logan tries the map by hand: pan, zoom, modes, picking, panes over the map, and province links.
