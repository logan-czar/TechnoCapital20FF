# Map sources: real-world borders for TechnoCapital20FF

Researched 2026-10-20. Items marked (uncertain) were not confirmed from an official page.

## What we need

The province CSVs hold 3,255 provinces in 210 countries, 2,015 distinct regions and 2,070 areas. Most regions hold a single province. Big metros are split below the city level (for example CN-0001 "Dongcheng and Xicheng", GB-0001 "City of London-Westminster"). So we need:

- admin-1 shapes for regions;
- admin-2 or admin-3 shapes, or synthetic splits, for the roughly 1,200 provinces that subdivide a region.

## Short answer on open grand strategy maps

None of the open projects ships a real-world province map we can take as-is for a commercial game.

- OpenVic's code is MIT, but its map today comes from the player's own Victoria 2 install, which is Paradox copyright.
- Open Doctrines is non-commercial.
- The useful open items are tools and pipelines, not maps.

## Options table

| Option | What it is | License | Fit for us |
|---|---|---|---|
| OpenVic (github.com/OpenVicProject/OpenVic) | Victoria 2 reimplementation in Godot 4.7.2 plus a C++ GDExtension | Code is MIT (LICENSE.md). Its map is the Vic2 provinces.bmp from a legitimate Vic2 copy. The project says the free default mode will have its own data, but no own world map is shipped yet (uncertain). | Learn from it: the Godot rendering of the provinces.bmp lookup texture and the map shader. Do not reuse the map. |
| Open Doctrines (github.com/Pr1nted/Open-Doctrines) | Source-available grand strategy game with 1,641 provinces | OpenDoctrines Non-Commercial License | Not usable in a commercial game. Its NOTICE.md and provenance file may show its sources. |
| global-province-map-template (github.com/GeorgeQLe/global-province-map-template) | `gpm` CLI that builds strategy-game provinces from open geodata (Natural Earth, geoBoundaries, GHSL, WorldPop) and exports adjacency and topology QA | MIT | Closest match to our pipeline. It is immature: 0 stars, and its own 1444 candidate fails preflight. Read it for design ideas; do not depend on it. Its README also avoids OSM (ODbL) and GADM. |
| OpenGS Map Tool (github.com/Thomas-Holtvedt/opengs-maptool) | Python tool. Takes land, boundary and density images and outputs a Paradox-style province bitmap and CSV through density-weighted Voronoi seeds | MIT | Good for the Voronoi split step if we work in raster. A vector pipeline gives us more control. |
| Province Map Builder, Map Province Creator | Godot editor add-ons that Voronoi-subdivide an image into nested regions | Map Province Creator is MIT. Province Map Builder is open-source on GitLab (license uncertain). | Fantasy-style subdivision, not real borders. Low fit. |
| Natural Earth admin 0 and admin 1 (10m, v5.1.1) | More than 4,500 admin-1 units, about 14 MB shapefile | Public domain (naturalearthdata.com terms) | Best base for countries and regions. Gaps: microstates, some disputed areas, and the admin-1 theme is labelled beta. Three attribute columns came from GADM; drop them if worried. |
| geoBoundaries gbOpen (ADM0 to ADM2+, v6.0.0; CGAZ global composites) | Per-country boundaries from many sources | Per-boundary license in metadata (`boundaryLicense`). Most are CC BY 4.0, but some gbOpen files are ODbL or CC BY-SA. gbAuthoritative is non-commercial. | Best source for admin-2. Filter out ODbL and SA countries and keep a credits file. CGAZ disputed areas follow US State Department lines. Size of the CGAZ ADM2 global file is not confirmed (likely hundreds of MB, uncertain). |
| GADM 4.x | Admin boundaries down to levels 3 to 5 | No redistribution and no commercial use without prior consent | Do not use. |
| OpenStreetMap boundaries (osm-boundaries, Overpass, Geofabrik) | Most detailed and current, any admin level | ODbL. A rendered map in the game is a Produced Work and can be proprietary, but needs attribution. Any extracted or modified polygons we ship or share are a Derivative Database and stay ODbL, with the data offered on request. | Usable only with care. Avoid for the shipped polygon data; acceptable as a reference while hand-editing. |
| Who's On First | Gazetteer with admin polygons, assembled from many sources | Per source (CC BY variants, CC0, OGL, others). The licenses page lists no ODbL, but some sources have no stated license. | Useful for names and IDs and as a fallback for gaps. Check per source; lower priority. |

## Recommended dataset

1. Countries: Natural Earth admin 0 10m (public domain), with our own edits for contested areas (Taiwan, Kashmir, Crimea, Western Sahara and so on) set by a game design decision.
2. Regions: Natural Earth admin 1 10m, matched to our 2,015 regions by name and ISO code. Where a game region groups several admin-1 units, dissolve them.
3. Provinces that subdivide a region: geoBoundaries gbOpen ADM2, or ADM3 for the metro splits. Use only countries whose `boundaryLicense` is CC BY, CC0 or public domain. For the rest, split synthetically with weighted Voronoi from city points, using Natural Earth populated places (public domain) or GeoNames (CC BY 4.0).
4. Credits: geoBoundaries requires attribution of geoBoundaries plus each source. Generate a CREDITS file from the metadata.

## Pipeline (all scriptable, Python first)

1. Fetch. Download Natural Earth 10m admin 0, admin 1 and populated places, plus the geoBoundaries gbOpen ADM2 (and ADM3 where needed) per-country files and their metadata JSON. Use the geoBoundaries API or the GitHub release.
2. License filter. Read `boundaryLicense` per country. Keep the permissive ones and list the rest for the Voronoi path.
3. Crosswalk. Build `region_crosswalk.csv` (game region to admin-1 codes) and `province_crosswalk.csv` (game province to a list of admin-2 IDs, or "voronoi"). The CSV notes already name the constituent districts for many metros, so much of this can be matched by fuzzy name with Python plus a manual review pass. This is the largest piece of work.
4. Build shapes with geopandas and shapely:
   - dissolve admin-2 units into game provinces;
   - clip every province to its admin-1 region so the hierarchy nests exactly;
   - for Voronoi provinces, make seeds from the largest cities in the region (k-means on population-weighted points if there are too few cities), run `shapely.voronoi_polygons`, then clip to the region.
5. Topology and simplification. Run mapshaper (MPL 2.0) to simplify with shared arcs, so neighbors stay gap-free, for example `mapshaper provinces.geojson -simplify 5% keep-shapes -clean -o`. Use GDAL/ogr2ogr for format conversion and reprojection, for example `ogr2ogr -f GeoJSON -t_srs EPSG:4326`. Pick the game projection here; Robinson or Miller fits an EU4-like look.
6. Export.
   - (a) `provinces.geojson` with a `province_id` property, as the canonical vector source.
   - (b) A province-ID color bitmap, the classic Paradox method: rasterize with `gdal_rasterize`, or in Python with rasterio. Give each province a unique RGB and write a CSV from color to ID. Use 8192x4096 or larger so small metro provinces get enough pixels (uncertain; test Singapore and the London splits). In Godot, one shader looks up the ID texture for borders, hover and map modes. This is how OpenVic renders, so its shader is a good reference.
   - (c) Optional: triangulated meshes per province (mapbox_earcut or shapely triangulation) for labels and click polygons. The bitmap is simpler and scales better to 3,255 provinces.
7. Derived data. Compute an adjacency list from shared borders (shapely `touches`, or neighbor pixels in the bitmap), area and centroid, and a coastal flag. Cross-check the coastal flag against the CSV `coastal` column. Feed these to the Rust engine.
8. QA. Every CSV province has exactly one shape, there are no gaps or overlaps inside a region, and each province's island parts are allowed and flagged.

## Risks

- License drift. geoBoundaries licenses are per country and per release. Re-check them on every data update and pin the release version.
- ODbL contamination. Polygons that came from OSM, including through a geoBoundaries country sourced from OSM, would make our shipped map data ODbL. Keep a provenance column on every province.
- Disputed borders. All sources take a side (Natural Earth is de facto; geoBoundaries CGAZ follows the US State Department). This is a political and storefront risk in some markets, notably China and India. Decide our policy explicitly.
- Matching effort. Our provinces are design units, not admin units. About 1,200 need a manual crosswalk or a Voronoi fallback. Expect several days of review.
- Tiny provinces. Sub-city metro provinces may be only a few pixels at world scale. They need a minimum display size, a zoom level, or a merge rule.
- Mismatched sources. Natural Earth admin 1 and geoBoundaries ADM2 lines do not coincide. Clipping ADM2 to Natural Earth leaves slivers; use a snap tolerance or take admin-1 as the dissolve of ADM2 where available.
- Natural Earth admin 1 has beta-quality gaps (microstates, missing codes). Expect hand fixes.

## Sources

- OpenVic repo and README: https://github.com/OpenVicProject/OpenVic
- Open Doctrines: https://github.com/Pr1nted/Open-Doctrines
- global-province-map-template: https://github.com/GeorgeQLe/global-province-map-template
- OpenGS Map Tool: https://github.com/Thomas-Holtvedt/opengs-maptool
- Province Map Builder: https://projects.cs.ut.ee/province-map-builder
- Map Province Creator: https://godotengine.org/asset-library/asset/4733
- Natural Earth admin 1: https://www.naturalearthdata.com/?p=480 and the license note at https://www.naturalearthdata.com/?p=3348
- geoBoundaries license notes (geobounds R package manual): https://ftp.fau.de/cran/web/packages/geobounds/refman/geobounds.html
- geoBoundaries v6 on Earth Engine: https://developers.google.com/earth-engine/datasets/catalog/WM_geoLab_geoBoundaries_600_ADM0
- GADM license text (copy shipped with data): https://mitra.stanford.edu/kundaje/marinovg/oak/papers/2021_COVID_BG-2/2021-03-08-figures/BGR_adm/license.txt
- OSM licence FAQ: https://osmfoundation.org/wiki/Licence_and_Legal_FAQ
- Who's On First licenses: https://whosonfirst.org/docs/licenses/
