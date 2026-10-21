# OpenGS (C# fork) review: what TechnoCapital20FF can reuse

_Reviewed 2026-10-20 from a shallow clone of github.com/JDSweet/opengs-csharp (commit 542105, 2025-12-23) and, for comparison, the upstream github.com/Thomas-Holtvedt/opengs (commit 06838d, 2026-05-22). No code from either repo was run. Adds to [map-sources.md](map-sources.md), which listed the OpenGS Map Tool but not OpenGS itself._

## What it is

- A Godot 4.5 (.NET, Forward Plus) demo of a Paradox-style 3D map: selectable provinces, two map modes (political, ideology), smoothed borders, curved country labels, camera with partial world wrap. It is a map demo, not a game.
- The C# repo is a hand port of an older snapshot of upstream OpenGS (GDScript), by Dustin Jackson (JDSweet). The README calls it "C# Fork of the Original Project". GitHub's API and web pages were blocked from this session, so the formal fork flag, stars and full commit history were not checked. The shallow clone shows one recent commit ("Resolving weird git bug").
- Size: about 1,700 lines of C# in src/csharp/ (each file carries the original GDScript in a comment block), the original GDScript in src/gdscript/, two shaders in map/shaders/. A Visual Studio .vs/ cache folder is committed by mistake.
- Upstream is active and much further along (May 2026): GPU jump-flood (JFA) signed distance field borders, an in-game province editor, JSON history files, texture caching. Upstream is the better reference; the C# fork adds nothing upstream lacks except C#.

## License

- LICENSE: MIT, "Copyright (c) 2025 Thomas-Holtvedt" (same in both repos). The fork adds no license of its own.
- MIT allows use in a commercial closed-source game. The only duty: keep the copyright and permission notice with any copied code (an about or third-party licenses screen is enough).
- Ideas and algorithms are not covered by copyright at all, so porting a technique to Rust in our own words needs nothing.
- Data is the problem, not code. The C# fork's map data has no stated source. map/map_data/States/*.txt (1,120 files with `state={ id name provinces manpower buildings_max_level_factor }`) and "Provinces - Copy.txt" (`id,r,g,b,land,FALSE,plains,1`) match Hearts of Iron IV's state files and definition.csv layout, and ProvinceMap.bmp is 5632x2112, close to HoI4's 5632x2048. That strongly suggests (uncertain) the data is derived from Paradox's copyrighted game files, which MIT from this author cannot relicense. Treat all map data in the fork as off-limits.
- wip/raw_data/ holds Natural Earth zips (public domain), GEBCO 2008 tiles and a NASA Blue Marble image. We get these from the source ourselves; nothing to take.

## What the repo contains (C# fork)

| Area | Where | Notes |
|---|---|---|
| Province bitmap | map/map_data/ProvinceMap.bmp, Provinces.txt | 9,655 rows (5,002 land, 2,043 sea, 2,609 lake): `id,r,g,b,type,x,y`, x and y are label anchor points |
| Lookup texture | src/csharp/Map.cs CreateLookupTexture | Walks every pixel on the CPU at startup, maps each unique RGB to an (R,G) index into a 256x256 table, writes a lookup image |
| Color table | Map.cs CreateColorMap, UpdateColorMap | 256x256 RGB image; row offset 0 = owner color, +100 = controller color, +200 = selection color. One image per map mode; re-uploaded on change |
| 2D shader | map/shaders/map2d.gdshader | Reads lookup, samples color table; checkerboard mixes owner and controller (occupation stripes); selection overrides |
| 3D shader | map/shaders/map3d.gdshader | Renders the 2D result to a SubViewport, then a plane mesh samples it; `diag()` does pixel-art style diagonal smoothing so borders look less blocky; adds a normal map |
| Picking | src/csharp/Player.cs | Ray to the plane, hit position to pixel, pixel color to province |
| Labels | src/csharp/CountryLabelTemplate.cs | Least-squares line through the owned provinces' anchor points; label rotated to that line, font size from its length |
| States, countries | StateImporter.cs, CountryImporter.cs | Hand-rolled substring parser; owners hard-coded in AssignOwners; countries hard-coded in code |
| Save, modding | none | No save system, no mod loading, no tests |

Quality: a tutorial-grade prototype. Scene-tree lookups by name, null checks that print and continue, CPU per-pixel loops, hard-coded data. Fine to read, not a base to build on.

## What to reuse

Ideas (port to Rust, WGSL and our own code; no notice needed):

1. Two-texture lookup: an ID texture plus a small per-province color table, so a map-mode change rewrites only the table (3,255 entries), never the big bitmap. This is what 12-tech-and-roadmap.md and build-plan.md M8.2 already plan; OpenGS confirms it works at 9,655 and 18,000 provinces.
2. Skip their CPU color-to-index pass. Our `mapgen` draws the bitmap, so it can write the province ID directly (R16Uint, or two 8-bit channels) and the shader needs no color dictionary.
3. Several layers in one table (their rows at +0, +100, +200, upstream uses height/3): owner, controller or second color, highlight. For us: primary color, secondary color for hatching (contested provinces, decision C) or occupation, and selection or hover. Upstream map2d.gdshader shows the fix their first version lacked: sample at texel centers (`cm_uv`, `lut_coords` with +0.5), otherwise colors bleed between neighbor IDs.
4. Hatching pattern: their checkerboard in map2d.gdshader is the same idea as our contested hatching; use diagonal stripes from screen or map coordinates instead.
5. Borders: the fork's `diag()` smoothing in map3d.gdshader is a cheap way to round staircase edges. Upstream's better method is a GPU jump-flood distance field from a border mask (map/map_shaders/jfa.glsl, jfa_encode.glsl, map/map_texture_sdf.gd): smooth, zoom-independent borders, thick selection outlines, and a country-color fade toward the interior. For us this can run once in `mapgen` on the CPU (3,255 provinces, borders change only with ownership), with an optional Bevy compute pass later.
6. Upstream's dirty-rectangle refresh (map/map_texture_generator.gd): only recompute the border field around provinces whose owner changed, and a downscaled country field (COUNTRY_SDF_SCALE 4). Useful when conquest or acquisitions change owners mid-game.
7. Country labels by least-squares line through province centroids (CountryLabelTemplate.cs); upstream adds curved labels (core/utils/curved_label.gd). Easy to port; our `mapgen` already outputs centroids.
8. World wrap by moving the camera by one map width (Player.cs); fine for a flat map.

Code: nothing worth copying line by line. If a shader file is ever copied rather than rewritten, keep the MIT notice with it.

Data: none. The fork's map data is likely HoI4-derived (see License). Upstream ships its own 5000x2500 provinces.png with 18,147 provinces and no stated source either; also not needed, since our map comes from Natural Earth and geoBoundaries.

## What not to take

- Any file under map/map_data/ in either repo, and wip/.
- The architecture: Godot node tree as the data model, owners stored on scene nodes. Our sim is a headless Rust crate with ECS views; the map only reads a color table built from sim state.
- The text formats (Paradox-style state files, substring parsing). We use our own CSV or RON from sim-data.
- The SubViewport-to-3D-plane setup. We are flat 2D in Bevy; one material on a quad is enough.

## Recommended next step

When M8.2 starts, write province_map.wgsl from the ideas above: ID texture from `mapgen`, a 3-layer color table texture, texel-center sampling, neighbor-ID border test first, hatching for `contested`. Add a `mapgen` step that writes a border distance field (jump flood on the CPU) only if the plain neighbor test looks too jagged at our zoom levels. Add OpenGS (upstream) to the reference list in map-sources.md as a shader and border reference, not a data source.

Sources: github.com/JDSweet/opengs-csharp, github.com/Thomas-Holtvedt/opengs, local clones under the session scratchpad (ext/opengs, ext/opengs-upstream).
