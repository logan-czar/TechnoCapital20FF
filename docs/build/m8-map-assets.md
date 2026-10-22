# M8 map assets: the contract between lane P and lane M

_Coordinator, 2026-10-22, for M8 (docs/build/m8-plan.md). Lane P writes these files with `mapgen`; lane M reads them. Either lane may propose a change by logging a decision and telling the coordinator; neither changes the format alone._

All files live in `assets/map/` at the repo root. Province ids are the CSV ids (for example `GB-0001`), never sim ordinals; the reader maps them to ordinals at load. A province with no shape yet (for example outside North America during Phase A) has no row in any file. Readers must accept that.

| File | Format |
|---|---|
| `map-meta.toml` | `width = 8192`, `height = 4096`, `projection = "miller"`, `lon_min = -180.0`, `lon_max = 180.0`, `lat_max` and `lat_min` (the Miller y extent kept), `pipeline_version` (string), `sources` (pinned source versions), `coverage` (list of region CSV files included, for example `["provinces-north-america.csv"]`) |
| `province-ids.png` | 8-bit RGB, width x height. Each province has one unique colour; `0,0,0` is water or no province. For people and tools |
| `province-index.png` | 16-bit greyscale PNG, same size. The value is the 1-based row number of the province in `province-colors.csv`; 0 is water. This is what the game uploads as an R16Uint texture and copies for picking |
| `province-colors.csv` | `province_id,r,g,b`, one row per province in the bitmap, sorted by `province_id` |
| `province-centroids.csv` | `province_id,lon,lat,x,y,label_x,label_y,area_px,tiny`. lon and lat are the centroid in degrees; x and y are the centroid in bitmap pixels; label_x and label_y are the label point in pixels (inside the shape, the pole of inaccessibility of its largest part); area_px is the pixel count; tiny is `Y` when area_px is under the click-target threshold (named in map-meta.toml as `tiny_px`), else `N` |
| `province-adjacency.csv` | `a,b,border_px,kind`, with `a < b` by id. border_px is the shared edge length in pixels; kind is `land`, or `sea` for a strait link the pipeline adds between coastal provinces whose shapes don't touch (optional; may be empty in Phase A) |
| `province-borders.png` | 8-bit RGB distance field, same size. R = distance in pixels to the nearest province edge, G = to the nearest region edge, B = to the nearest country edge, each clamped to 0..255. The shader draws lines by thresholding these by zoom |
| `crosswalk/region_crosswalk.csv`, `crosswalk/province_crosswalk.csv` | The P3 crosswalks, with a `method` (`admin1`, `admin2`, `admin3`, `voronoi`), `source_ids`, `confidence` (0 to 1), `provenance` (source and license) and `note` column |
| `qa/report-<region>.md` | The P8 QA report per region file, with the low-confidence crosswalk rows for Logan |
| `CREDITS.md` | Attribution built from the source metadata |

Large intermediates (`provinces.geojson`, raw downloads) are not committed; they live in the geodata cache named in `tools/map-pipeline/sources.toml`.
