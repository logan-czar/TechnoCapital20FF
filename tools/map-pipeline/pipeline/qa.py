"""P8: the QA report for a region and CREDITS.md (map-sources.md step 8; build-plan P8).

Checks: every CSV province has pixels (or is tiny with a label point), regions nest exactly,
no source outside the license allowlist reached a province, and the bitmap's coastal flag
against the CSV column. Lists the crosswalk rows under the review threshold, the hinted rows
and the tiny provinces for Logan. Exits non-zero on a missing province or a license problem.
"""

from __future__ import annotations

import csv
import json
import math
from collections import Counter

import geopandas as gpd

from . import PIPELINE_VERSION, anchors, config, crosswalk, fetch, licenses, probe, subdivide

# Regions whose provinces leave more than this share of the region uncovered, or overlap by
# more, are listed as nesting problems (shares of the region's area).
NEST_TOLERANCE = 1e-6
# A province not in a Metro under this share of its region's mean province area is listed
# (a seed that claimed too little, like an offshore city point).
SMALL_SHARE = 0.05
# A block split by Voronoi where one province takes at least this share is listed.
SPLIT_MOSTLY = 0.75
# Width of the preview image Logan opens for the one visual check per region.
PREVIEW_WIDTH = 2400
# Share of the region's centroids the preview frame must hold (far territories fall outside).
PREVIEW_SHARE = 0.97
# A centroid this close (pixels) to the frame's centroids is taken back into it.
PREVIEW_REACH = 250


def _read(path):
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _md_escape(s: str) -> str:
    return (s or "").replace("|", "/").replace("\n", " ")


def _roll(im, shift):
    """The image rolled left by `shift` pixels (wrapping east to west)."""
    from PIL import Image

    w, h = im.size
    shift %= w
    out = Image.new(im.mode, im.size)
    out.paste(im.crop((shift, 0, w, h)), (0, 0))
    out.paste(im.crop((0, 0, shift, h)), (w - shift, 0))
    return out


def _preview(region: config.Region, centroids: list[dict], ids: set[str], out_path) -> str:
    """A cropped, downscaled copy of province-ids.png around the region's provinces."""
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(config.ASSETS_DIR / "province-ids.png")
    pts = sorted((float(r["x"]), float(r["y"]), r["province_id"]) for r in centroids if r["province_id"] in ids)
    w, h = im.size
    # the cut goes in the widest gap between centroids, so a region across the antimeridian
    # (Fiji, Kiribati) is shown in one piece; then the frame is the narrowest window holding
    # PREVIEW_SHARE of the centroids, so a far territory (New Caledonia in the Europe file)
    # does not shrink the rest; the provinces left outside are named
    xs = [p[0] for p in pts]
    gaps = [(xs[(i + 1) % len(xs)] - xs[i]) % w for i in range(len(xs))]
    i = max(range(len(xs)), key=lambda i: (gaps[i], -i))
    start = xs[(i + 1) % len(xs)]
    ux = sorted(((p[0] - start) % w, p[1], p[2]) for p in pts)
    k = max(1, math.ceil(PREVIEW_SHARE * len(ux)))
    j = min(range(len(ux) - k + 1), key=lambda j: (ux[j + k - 1][0] - ux[j][0], j))
    lo, hi = j, j + k - 1
    # then take back every centroid within PREVIEW_REACH pixels of the frame (only the far
    # outliers stay out)
    while lo > 0 and ux[lo][0] - ux[lo - 1][0] <= PREVIEW_REACH:
        lo -= 1
    while hi < len(ux) - 1 and ux[hi + 1][0] - ux[hi][0] <= PREVIEW_REACH:
        hi += 1
    inx = ux[lo:hi + 1]
    ys = sorted(p[1] for p in inx)
    kk = max(1, math.ceil(PREVIEW_SHARE * len(ys)))
    jj = min(range(len(ys) - kk + 1), key=lambda jj: (ys[jj + kk - 1] - ys[jj], jj))
    a, b = jj, jj + kk - 1
    while a > 0 and ys[a] - ys[a - 1] <= PREVIEW_REACH:
        a -= 1
    while b < len(ys) - 1 and ys[b + 1] - ys[b] <= PREVIEW_REACH:
        b += 1
    ylo, yhi = ys[a], ys[b]
    shown = {p[2] for p in inx if ylo <= p[1] <= yhi}
    left_out = sorted(p[2] for p in pts if p[2] not in shown)
    shift = int(start + inx[0][0]) - 250
    im = _roll(im, shift)
    x0, x1 = 0, min(int(inx[-1][0] - inx[0][0]) + 500, w)
    y0 = max(int(ylo) - 250, 0)
    y1 = min(int(yhi) + 250, h)
    crop = im.crop((x0, y0, x1, y1))
    x0, x1 = shift % w, (shift + x1) % w
    scale = PREVIEW_WIDTH / crop.width
    crop = crop.resize((PREVIEW_WIDTH, max(1, int(crop.height * scale))), Image.NEAREST)
    crop.save(out_path, optimize=True)
    note = f"pixels x {x0}..{x1}, y {y0}..{y1}, scaled by {scale:.2f}"
    if left_out:
        note += f"; outside the frame: {', '.join(left_out)}"
    return note


def run(region: config.Region) -> None:
    sources = config.load_sources()
    work = config.work_dir(region.slug, sources)
    qa_dir = config.ASSETS_DIR / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    countries = set(region.countries)
    csv_rows = _read(config.DATA_DIR / region.csv)
    own_ids = {r["id"] for r in csv_rows}
    own_keys = {f"{r['country']}:{r['region']}" for r in csv_rows}
    xw = {r["province_id"]: r for r in _read(config.ASSETS_DIR / "crosswalk" / "province_crosswalk.csv")
          if r["province_id"] in own_ids}
    rxw = [r for r in _read(config.ASSETS_DIR / "crosswalk" / "region_crosswalk.csv")
           if f"{r['country']}:{r['region']}" in own_keys]
    mq = {r["province_id"]: r for r in _read(work / "mapgen-qa.csv")}
    cent = _read(config.ASSETS_DIR / "province-centroids.csv")
    centroid = {r["province_id"]: r for r in cent}
    nesting = json.loads((work / "nesting.json").read_text(encoding="utf-8"))
    hints = crosswalk.load_hints(region).get("provinces", {})
    meta_txt = (config.ASSETS_DIR / "map-meta.toml").read_text(encoding="utf-8")
    tiny_px = int(next(line.split("=")[1] for line in meta_txt.splitlines() if line.startswith("tiny_px")))

    problems: list[str] = []
    ids = [r["id"] for r in csv_rows]
    names = {r["id"]: r["name"] for r in csv_rows}
    missing_xw = [i for i in ids if i not in xw]
    no_pixels = [i for i in ids if mq.get(i, {}).get("in_bitmap") != "Y" or int(mq[i]["area_px"]) == 0]
    if missing_xw:
        problems.append(f"{len(missing_xw)} provinces have no crosswalk row: {', '.join(missing_xw)}")
    if no_pixels:
        problems.append(f"{len(no_pixels)} provinces have no pixels: {', '.join(no_pixels)}")

    # license check: every province's provenance must be built only from allowed sources
    allowed_prov = {licenses.NE_PROVENANCE, licenses.BUILDER_PROVENANCE}
    used_gb = []
    for b in sources["geoboundaries"]["boundary"]:
        if b["iso"] not in countries:
            continue
        meta = fetch.gb_meta(b["iso"], b["level"], sources)
        ok, why = licenses.classify_meta(meta)
        used_gb.append((b["iso"], b["level"], meta, ok, why))
        if ok:
            allowed_prov.add(licenses.provenance(meta))
    lic_bad = []
    for pid, r in xw.items():
        rest = r["provenance"]
        for a in sorted(allowed_prov, key=len, reverse=True):
            rest = rest.replace(a, "")
        if rest.strip("; ") or not r["provenance"]:
            lic_bad.append(f"{pid}: {r['provenance'] or 'no provenance'}")
        for word in ("OpenStreetMap", "ODbL", "Open Database", "ShareAlike", "GADM"):
            if word.lower() in r["provenance"].lower():
                lic_bad.append(f"{pid}: provenance names {word}")
    if lic_bad:
        problems.append("license problems: " + "; ".join(lic_bad))

    nest_bad = {k: v for k, v in nesting.items() if k in own_keys and
                (v["uncovered"] > NEST_TOLERANCE or v["overlap"] > NEST_TOLERANCE or v["outside"] > NEST_TOLERANCE)}

    flagged = sorted((r for r in xw.values() if float(r["confidence"]) < crosswalk.FLAG_BELOW),
                     key=lambda r: (float(r["confidence"]), r["province_id"]))
    hinted = sorted(pid for pid in xw if pid in hints)
    tiny = sorted((r for r in mq.values() if r["province_id"] in names and r["tiny"] == "Y"),
                  key=lambda r: int(r["area_px"]))
    coast_bad = sorted(r["province_id"] for r in mq.values() if r["province_id"] in names and r["coastal_match"] == "N")
    multi = sorted((r for r in mq.values() if r["province_id"] in names and r["components"] not in ("", "1")),
                   key=lambda r: -int(r["components"]))
    methods = Counter(r["method"] for r in xw.values())
    # provinces small for their region (Metro provinces are small by design and are skipped)
    by_region: dict[str, list] = {}
    for r in csv_rows:
        by_region.setdefault((r["country"], r["region"]), []).append(r)
    small = []
    for members in by_region.values():
        areas = {r["id"]: int(mq[r["id"]]["area_px"]) for r in members if r["id"] in mq}
        if len(areas) < 2:
            continue
        mean = sum(areas.values()) / len(areas)
        for r in members:
            if not r["metro"] and r["id"] in areas and areas[r["id"]] < SMALL_SHARE * mean:
                small.append((r["id"], r["name"], r["region"], areas[r["id"]], mean))
    small.sort()
    splits = json.loads((work / "splits.json").read_text(encoding="utf-8"))
    mostly = sorted((v for v in splits.values() if v["region"] in own_keys
                     and max(v["shares"].values()) >= SPLIT_MOSTLY), key=lambda v: (v["region"], v["name"]))
    outside = [o for o in json.loads((work / "named-outside.json").read_text(encoding="utf-8"))
               if o["province_id"] in names]
    anchor_rows = anchors.check(region, config.ASSETS_DIR / "province-index.png",
                                config.ASSETS_DIR / "map-meta.toml", sources,
                                crosswalk.load_hints(region).get("review", {}).get("anchor_ok", {}))
    anchor_misses = [m for m in anchor_rows if not anchors.is_info(m["kind"])]
    anchor_info = [m for m in anchor_rows if anchors.is_info(m["kind"])]
    review = crosswalk.load_hints(region).get("review", {})
    review_notes = review.get("notes", [])
    watch = review.get("watch", [])
    unclaimed = json.loads((work / "unclaimed.json").read_text(encoding="utf-8")) \
        if (work / "unclaimed.json").exists() else []
    adjacency = _read(config.ASSETS_DIR / "province-adjacency.csv")
    sea = sorted((r for r in adjacency if r["kind"] == "sea" and (r["a"] in own_ids or r["b"] in own_ids)),
                 key=lambda r: (r["a"], r["b"]))
    rx_by_key = {f"{r['country']}:{r['region']}": r for r in rxw}
    overwritten = sum(int(r.get("overwritten_px") or 0) for r in mq.values() if r["province_id"] in names)
    by_country = Counter(r["country"] for r in xw.values())

    # D686: the city probe (fails on a mismatch) and the Metro reach scan (listed)
    prefixes = {i.split("-")[0] for i in own_ids}
    probe_rows = [r for r in probe.probe(config.ASSETS_DIR)
                  if (r["exp"] != "?" and any(e in own_ids or (len(e) == 2 and e in prefixes)
                                              for e in r["exp"].split(",")))
                  or (r["exp"] == "?" and r["got"] in own_ids)]
    probe_bad = [r for r in probe_rows if r["ok"] is False]
    if probe_bad:
        problems.append(f"{len(probe_bad)} city probe points land on the wrong province: "
                        + ", ".join(f"{r['label']} on {r['got'] or 'water'} (expected {r['exp']})" for r in probe_bad))
    ne_labels = json.loads((work / "ne-labels.json").read_text(encoding="utf-8")) \
        if (work / "ne-labels.json").exists() else []
    ne_ok = set(crosswalk.load_hints(region).get("review", {}).get("ne_label_ok", []))
    ne_bad = [n for n in ne_labels if n["region"] not in ne_ok]
    if ne_bad:
        problems.append(f"{len(ne_bad)} Natural Earth units hold a capital another region names: "
                        + ", ".join(f"{n['region']} ({n['capital']})" for n in ne_bad))
    centroid_rows = {r["province_id"]: r for r in cent}
    places = anchors._place_lookup(countries, sources)
    metro_rows = probe.metro_scan(csv_rows, centroid_rows, places)
    # D690: a builder hint seed off its region is an error in the hints, not a seed to drop
    outside_hints = sorted(pid for pid, r in xw.items() if "HINT SEED OUTSIDE THE REGION" in r["note"])
    if outside_hints:
        problems.append(f"{len(outside_hints)} provinces have a hint seed outside their region: "
                        + ", ".join(outside_hints))
    # D691: land exclaves, each explained by a composite name or `[review.exclave_ok]`
    seeds = json.loads((work / "seeds.json").read_text(encoding="utf-8")) if (work / "seeds.json").exists() else {}
    shp = gpd.read_file(work / "provinces.geojson")
    exclave_rows = probe.exclaves(probe.Bitmap(config.ASSETS_DIR), mq, csv_rows, places,
                                  review.get("exclave_ok", {}), seeds, dict(zip(shp.province_id, shp.geometry)))
    exclave_bad = [e for e in exclave_rows if not e["ok"]]
    if exclave_bad:
        problems.append(f"{len(exclave_bad)} land exclaves are unexplained: "
                        + ", ".join(f"{e['province_id']} ({e['px']} px at {e['lon']}, {e['lat']})" for e in exclave_bad))
    # D820: every part of a split giant is at most the cap (Eastern Iowa), on the final shapes
    split_rows = []
    geom_of = dict(zip(shp.province_id, shp.geometry))
    for pid, spec in sorted(crosswalk.load_hints(region).get("subdivide", {}).items()):
        part_ids = [pid] + sorted(spec.get("children", {}))
        areas = {i: subdivide.area_km2(geom_of[i]) for i in part_ids if i in geom_of}
        over = [i for i in part_ids if i not in areas or areas[i] > subdivide.CAP_KM2]
        split_rows.append((pid, names.get(pid, ""), len(part_ids), spec["blocks"], sum(areas.values()),
                           min(areas.values(), default=0.0), max(areas.values(), default=0.0),
                           sum(int(mq[i]["components"] or 1) > 1 for i in part_ids if i in mq), over))
    over_cap = [i for r in split_rows for i in r[8]]
    if over_cap:
        problems.append(f"{len(over_cap)} parts of split giants are over the {subdivide.CAP_KM2:,.0f} km2 cap: "
                        + ", ".join(over_cap))
    # D692: pairs the hints say must meet only by sea (Little and Big Diomede)
    pair_rows = {(r["a"], r["b"]): r["kind"] for r in adjacency}
    sea_only_bad = []
    for a, b in review.get("sea_only", []):
        k = pair_rows.get((min(a, b), max(a, b)))
        if k != "sea":
            sea_only_bad.append(f"{a}-{b} is {k or 'not adjacent'}")
    if sea_only_bad:
        problems.append("pairs that must meet only by sea: " + "; ".join(sea_only_bad))

    preview_name = f"preview-{region.slug}.png"
    preview_note = _preview(region, cent, set(ids), qa_dir / preview_name)

    L = []
    L.append(f"# Map QA report: {region.slug}")
    L.append("")
    L.append(f"_Written by `tools/map-pipeline/run.py --region {region.slug}` (pipeline {PIPELINE_VERSION}). "
             f"Source of the rows: `{region.csv}`. "
             "Format: docs/build/m8-map-assets.md; threshold and methods: docs/build/decisions.md D600-D612 and "
             "D670-D699._")
    L.append("")
    L.append("## Result")
    L.append("")
    if problems:
        L.append("**FAIL**")
        L.append("")
        for p in problems:
            L.append(f"- {p}")
    else:
        L.append(f"**Pass.** All {len(ids)} provinces of `{region.csv}` have a crosswalk row and pixels "
                 f"({len(tiny)} of them tiny, with a click target at the label point). "
                 "No source outside the license allowlist reached a province.")
    L.append("")
    L.append("## Coverage")
    L.append("")
    L.append("| Measure | Count |")
    L.append("|---|---|")
    L.append(f"| Provinces in the CSV | {len(ids)} |")
    for c in sorted(by_country):
        L.append(f"| ... {c} | {by_country[c]} |")
    L.append(f"| Regions matched | {sum(1 for r in rxw if float(r['confidence']) > 0)} of {len(rxw)} |")
    for m in ("admin1", "admin2", "admin3", "voronoi"):
        L.append(f"| Provinces by method: {m} | {methods.get(m, 0)} |")
    L.append(f"| Flagged for review (confidence < {crosswalk.FLAG_BELOW}) | {len(flagged)} |")
    L.append(f"| Placed by a builder hint (`hints/{region.slug}.toml`) | {len(hinted)} |")
    L.append(f"| Tiny (under {tiny_px} px) | {len(tiny)} |")
    L.append(f"| Given a pixel at their interior point (no pixel centre inside) | "
             f"{sum(1 for r in mq.values() if r['province_id'] in names and r['forced'] == 'Y')} |")
    L.append(f"| More than one part (islands, exclaves) | {len(multi)} |")
    L.append(f"| Coastal flag differs from the CSV | {len(coast_bad)} |")
    L.append(f"| Small for their region (not Metro, under {SMALL_SHARE:.0%} of the region's mean) | {len(small)} |")
    L.append(f"| Voronoi-split blocks where one province takes {SPLIT_MOSTLY:.0%} or more | {len(mostly)} |")
    L.append(f"| Places named in a province's name or notes that lie in another province | {len(outside)} |")
    L.append(f"| Pixels drawn over another province (overlapping shapes) | {overwritten} |")
    L.append(f"| Contested provinces (drawn by our own files) | {sum(1 for r in csv_rows if r.get('contested'))} |")
    L.append(f"| Admin-1 units left without a province | {len(unclaimed)} |")
    L.append(f"| Sea links with a province of this file | {len(sea)} |")
    L.append(f"| City probe points (fail on a mismatch; D686) | {sum(1 for r in probe_rows if r['ok'])} pass, "
             f"{len(probe_bad)} mismatch, {sum(1 for r in probe_rows if r['ok'] is None)} listed |")
    L.append(f"| Metro reach scan rows (listed; D686) | {len(metro_rows)} |")
    L.append(f"| Land exclaves of {probe.EXCLAVE_MIN_PX} px or more (fail unless explained; D691) | "
             f"{len(exclave_rows)} ({len(exclave_bad)} unexplained) |")
    L.append(f"| Anchor cities off their province (own name, Metro, key city, off centre, not in the largest part) "
             f"| {len(anchor_misses)} |")
    L.append(f"| Metro cities across a narrow strait, or own cities on the province's edge (listed, allowed) "
             f"| {len(anchor_info)} |")
    L.append("")
    L.append("Methods: `admin1` is a whole Natural Earth admin-1 unit or a dissolve of them; `admin2` a dissolve "
             "of whole geoBoundaries ADM2 units clipped to the region; `voronoi` a province with at least one "
             "Voronoi cut (inside an ADM2 unit two provinces share, or on a region with no usable ADM2 data).")
    L.append("")
    if split_rows:
        L.append("## Split giants")
        L.append("")
        L.append(f"Provinces over {subdivide.GIANT_KM2:,.0f} km2 that are not Arctic, cut into parts of at most "
                 f"{subdivide.CAP_KM2:,.0f} km2 (Eastern Iowa, {subdivide.CAP_PROVINCE}) by `run.py giants` and "
                 "`[subdivide]` in the hints (D820). Areas are geodesic, of the final shapes; the step fails on a "
                 "part over the cap.")
        L.append("")
        L.append("| Province | Name | Parts | Pieces | Area (km2) | Smallest part | Largest part | Parts in several pieces |")
        L.append("|---|---|---|---|---|---|---|---|")
        for pid, nm, n, blocks, tot, lo, hi, multi_n, _ in split_rows:
            L.append(f"| {pid} | {_md_escape(nm)} | {n} | {blocks} | {tot:,.0f} | {lo:,.0f} | {hi:,.0f} | {multi_n} |")
        L.append("")
    L.append("## Sources and licenses")
    L.append("")
    L.append("| Boundary file | License | Used |")
    L.append("|---|---|---|")
    L.append(f"| Natural Earth 10m {sources['natural_earth']['version']} (admin 0, admin 1, populated places, lakes) "
             "| Public domain | yes |")
    for iso, level, meta, ok, why in used_gb:
        L.append(f"| geoBoundaries gbOpen {iso} {level} ({_md_escape(meta.get('boundarySource'))}) | "
                 f"{_md_escape(meta.get('boundaryLicense'))} | {'yes' if ok else 'no: ' + why + '; Voronoi path'} |")
    L.append("")
    gov = sorted({_md_escape(m.get("boundaryLicense")) for _, _, m, ok, why in used_gb
                  if not ok and "allowlist" in why})
    if gov:
        L.append("Refused as not on the allowlist (for Logan: attribution-only government licences are refused until "
                 "allowed, D601): " + "; ".join(gov) + ".")
        L.append("")
    if any(not ok for *_, ok, _ in used_gb):
        L.append("Refused boundary files are never downloaded and never used (D601). The allowlist is CC BY, CC0, "
                 "public domain and the attribution-only government licences OGL-Canada 2.0, OGL-UK 3.0, Data licence "
                 "Germany Attribution 2.0, Etalab 2.0, Spain's INE licence, Singapore ODL 1.0 and Korea OGL Type 1 "
                 "(D685); a region whose country has no allowed ADM2 is split by Voronoi.")
        L.append("")
    risky = [(iso, level) for iso, level, meta, ok, why in used_gb if ok and iso in licenses.PROVENANCE_RISK]
    if risky:
        L.append("Provenance to check (for Logan; these files pass the allowlist and are used):")
        L.append("")
        for iso, level in risky:
            L.append(f"- {iso} {level}: {licenses.PROVENANCE_RISK[iso]}")
        L.append("")
    L.append("## Low-confidence rows for review")
    L.append("")
    if flagged:
        L.append("The automatic match placed these provinces from direction words or a Metro's core city only. "
                 "Check each on the preview; fix a wrong one with a hint in "
                 f"`tools/map-pipeline/hints/{region.slug}.toml` and rerun.")
        L.append("")
        L.append("| Province | Name | Region | Method | Confidence | How it was placed |")
        L.append("|---|---|---|---|---|---|")
        for r in flagged:
            L.append(f"| {r['province_id']} | {_md_escape(r['name'])} | {_md_escape(r['region'])} | {r['method']} | "
                     f"{r['confidence']} | {_md_escape(r['note'])} |")
    else:
        L.append("None.")
    L.append("")
    L.append("## Builder hints (review these too)")
    L.append("")
    L.append("The automatic match could not place these from the CSV name and notes (a suburb or district Natural "
             "Earth has no point for, or a county the notes do not name), so the builder supplied units or points. "
             "They carry confidence 0.85.")
    L.append("")
    L.append("| Province | Name | Placed by |")
    L.append("|---|---|---|")
    for pid in hinted:
        L.append(f"| {pid} | {_md_escape(names.get(pid, ''))} | {_md_escape(xw[pid]['note'])} |")
    L.append("")
    L.append("## Tiny provinces (click targets)")
    L.append("")
    L.append(f"Under {tiny_px} pixels at 8192 x 4096: the map draws a clickable dot at the label point.")
    L.append("")
    L.append("| Province | Name | Pixels | Parts | Label point (px) |")
    L.append("|---|---|---|---|---|")
    for r in tiny:
        c = centroid.get(r["province_id"], {})
        L.append(f"| {r['province_id']} | {_md_escape(r['name'])} | {r['area_px']} | {r['components']} | "
                 f"{c.get('label_x')}, {c.get('label_y')} |")
    L.append("")
    L.append("## Anchor cities")
    L.append("")
    L.append("Checked from the bitmap, independently of the crosswalk: the Natural Earth place a province's own "
             "name names lands on that province (and, for a Metro province, near its middle and in its largest "
             "4-connected part; a part joined to the largest only across 3 or fewer water pixels, like San "
             "Francisco and Marin across the Golden Gate, is listed but allowed), its Metro's city lands on a "
             "province of that Metro, and each key city lands on one of its provinces (key-cities.csv).")
    L.append("")
    if anchor_rows:
        L.append("| Check | Province | Place | Expected | Got |")
        L.append("|---|---|---|---|---|")
        for m in anchor_misses + anchor_info:
            L.append(f"| {m['kind']} | {m['province_id']} | {_md_escape(m['place'])} | {_md_escape(m['expected'])} | "
                     f"{m['got'] or 'no province'} |")
    else:
        L.append("All anchors land on their own provinces.")
    if anchor_rows and not anchor_misses:
        L.append("")
        L.append("No misses; the rows above are allowed: a city part across a narrow strait, or a city whose own "
                 "pixel a neighbour took while its province holds a touching pixel.")
    L.append("")
    L.append("## Natural Earth labels")
    L.append("")
    L.append("Natural Earth units whose capital another region of the country names (in a province name or notes) "
             "while their own region does not: the sign of NE giving units each other's names, as in Eritrea and "
             "Guyana (D687). Each row fails the step unless `[review] ne_label_ok` in the hints names the region.")
    L.append("")
    if ne_labels:
        L.append("| Region | NE unit | Capital | Named by |")
        L.append("|---|---|---|---|")
        for n in ne_labels:
            ok = " (checked)" if n["region"] in ne_ok else ""
            L.append(f"| {_md_escape(n['region'])}{ok} | {_md_escape(n['unit'])} | {_md_escape(n['capital'])} | "
                     f"{_md_escape(', '.join(n['named_by']))} |")
    else:
        L.append("None.")
    L.append("")
    L.append("## City probe")
    L.append("")
    L.append("Points of `tools/map-pipeline/checks/city-points.txt` whose expected province is in this file, looked up "
             "in province-index.png: a point passes on its pixel or one of the 8 around it (D686). The step fails on "
             "a mismatch.")
    L.append("")
    if probe_rows:
        L.append("| Point | Expected | Got | Result |")
        L.append("|---|---|---|---|")
        for r in sorted(probe_rows, key=lambda r: (r["ok"] is not False, r["ok"] is not None, r["label"])):
            res = {False: "**mismatch**", None: "listed"}.get(r["ok"], r["how"])
            L.append(f"| {_md_escape(r['label'])} ({r['lon']}, {r['lat']}) | {r['exp']} | {r['got'] or 'water'} | {res} |")
    else:
        L.append("No points for this file.")
    L.append("")
    L.append("## Metro reach")
    L.append("")
    L.append(f"Metro provinces whose centroid is over {probe.METRO_FAR_KM:.0f} km from their Metro's city, that are over "
             f"{probe.METRO_BIG_TIMES} times the Metro's median and {probe.METRO_BIG_PX} px, and regions where Metro "
             f"provinces hold over {probe.METRO_SHARE:.0%} of the land beside rural ones (the D612 error). Listed for "
             "review; a Metro made of whole metropolitan units can be large by design.")
    L.append("")
    if metro_rows:
        L.append("| Check | Province or region | Detail |")
        L.append("|---|---|---|")
        for m in metro_rows:
            L.append(f"| {m['kind']} | {_md_escape(m['what'])} | {_md_escape(m['detail'])} |")
    else:
        L.append("None.")
    L.append("")
    L.append("## Land exclaves")
    L.append("")
    L.append(f"Parts of {probe.EXCLAVE_MIN_PX} px or more that are not a province's largest part and touch no pixel "
             "outside every province (islands are not listed). Each is explained by a place its composite name "
             "names lying in it, by one of the province's own seeds (a hint point, or a place its notes name) lying "
             "in it, by a neck under a pixel wide that joins it to the rest in the shapes, or by a reason in "
             "`[review.exclave_ok]`; an unexplained one fails the step (D691).")
    L.append("")
    if exclave_rows:
        L.append("| Province | Name | Pixels | At | Why |")
        L.append("|---|---|---|---|---|")
        for e in exclave_rows:
            why = e["why"] if e["ok"] else "**unexplained**"
            L.append(f"| {e['province_id']} | {_md_escape(e['name'])} | {e['px']} | {e['lon']}, {e['lat']} | "
                     f"{_md_escape(why)} |")
    else:
        L.append("None.")
    L.append("")
    if review_notes:
        L.append("## Known for review")
        L.append("")
        for n in review_notes:
            L.append(f"- {n}")
        L.append("")
    L.append("## Watched small provinces")
    L.append("")
    L.append("The microstates, city-states and metro splits the plan names (P8: Singapore, the London and Beijing "
             "splits, Hong Kong and Macau): every one has pixels, and a tiny one a click target at its label point.")
    L.append("")
    watched = [r for r in csv_rows if any(r["id"].startswith(w) or r["country"] == w for w in watch)]
    if watched:
        L.append("| Province | Name | Pixels | Tiny | Label point (px) |")
        L.append("|---|---|---|---|---|")
        for r in watched:
            q, c = mq.get(r["id"], {}), centroid.get(r["id"], {})
            L.append(f"| {r['id']} | {_md_escape(r['name'])} | {q.get('area_px', 0)} | {q.get('tiny', '')} | "
                     f"{c.get('label_x')}, {c.get('label_y')} |")
    else:
        L.append("None in this file.")
    L.append("")
    L.append("## Contested provinces")
    L.append("")
    L.append("Drawn by our own province files (decision C), not the sources' de facto lines: each contested "
             "province sits in the region the CSV gives it, built as listed (an alias or carve hint where Natural "
             "Earth draws the land elsewhere). The game hatches them.")
    L.append("")
    contested = [r for r in csv_rows if r.get("contested")]
    if contested:
        L.append("| Province | Name | Country | Contested | Region drawn from |")
        L.append("|---|---|---|---|---|")
        for r in contested:
            rx = rx_by_key.get(f"{r['country']}:{r['region']}", {})
            L.append(f"| {r['id']} | {_md_escape(r['name'])} | {r['country']} | {_md_escape(r['contested'])} | "
                     f"{_md_escape(r['region'])}: {_md_escape(rx.get('note', ''))} |")
    else:
        L.append("None in this file.")
    L.append("")
    L.append("## Region matching")
    L.append("")
    L.append("Regions not matched one-to-one by name: builder aliases, Natural Earth region groups, composite names "
             "matched part by part, carves (D676) and admin-1 units no region named, given to the touching region "
             "(D673). Check these on the preview too.")
    L.append("")
    special = [r for r in rxw if any(w in r["note"] for w in ("alias", "parts", "Natural Earth region", "carve",
                                                              "plus unclaimed", "less "))]
    if special:
        L.append("| Region | Matched by | Units |")
        L.append("|---|---|---|")
        for r in sorted(special, key=lambda r: (r["country"], r["region"])):
            L.append(f"| {r['country']}: {_md_escape(r['region'])} | {_md_escape(r['note'])} | "
                     f"{len([u for u in r['source_ids'].split(';') if u])} |")
    else:
        L.append("None.")
    L.append("")
    L.append("## Land without a province")
    L.append("")
    L.append("Natural Earth admin-1 units of this file's countries that no region claims and that touch no region "
             "of their country (overseas territories, remote islands). They stay water on the map.")
    L.append("")
    if unclaimed:
        L.append("| Country (NE) | Unit | Area (sq deg) |")
        L.append("|---|---|---|")
        for u in unclaimed:
            L.append(f"| {u['adm0']} | {_md_escape(u['name'])} ({u['adm1_code']}) | {u['area_deg2']} |")
    else:
        L.append("None.")
    L.append("")
    gaps = json.loads((work / "land-gaps.json").read_text(encoding="utf-8"))         if (work / "land-gaps.json").exists() else []
    if gaps:
        L.append("Natural Earth land of a country that none of its regions covers (over 0.01% of the country):")
        L.append("")
        L.append("| Country | Area (sq deg) | Share of the country |")
        L.append("|---|---|---|")
        for g in gaps:
            L.append(f"| {g['country']} | {g['area_deg2']} | {g['share']:.2%} |")
        L.append("")
    L.append("## Sea links")
    L.append("")
    L.append("`sea` rows of province-adjacency.csv with a province of this file: coastal provinces whose shapes do "
             "not touch but face each other across a strait (D678).")
    L.append("")
    if sea:
        L.append(", ".join(f"{r['a']}-{r['b']}" for r in sea))
    else:
        L.append("None.")
    L.append("")
    L.append("## Small provinces")
    L.append("")
    if small:
        L.append("| Province | Name | Region | Pixels | Region mean |")
        L.append("|---|---|---|---|---|")
        for pid, name, reg, a, mean in small:
            L.append(f"| {pid} | {_md_escape(name)} | {_md_escape(reg)} | {a} | {mean:.0f} |")
    else:
        L.append("None.")
    L.append("")
    L.append("## Uneven Voronoi splits")
    L.append("")
    L.append("Blocks (ADM2 units, or admin-1 units for Greenland) that several provinces share, where one "
             "province takes most of the block. Check that the larger part belongs where it went.")
    L.append("")
    if mostly:
        L.append("| Region | Block | Shares |")
        L.append("|---|---|---|")
        for v in mostly:
            shares = ", ".join(f"{pid} {sh:.0%}" for pid, sh in sorted(v["shares"].items(), key=lambda t: -t[1]))
            L.append(f"| {_md_escape(v['region'])} | {_md_escape(v['name'])} | {shares} |")
    else:
        L.append("None.")
    L.append("")
    L.append("## Named places outside their province")
    L.append("")
    if outside:
        L.append("A Natural Earth place matched in the name or notes that ended up in another province (usually a "
                 "neighbour that names the same city more directly, as Long Beach-Harbor's notes name Los Angeles).")
        L.append("")
        L.append("| Province | Name | Place | Lies in |")
        L.append("|---|---|---|---|")
        for o in outside:
            L.append(f"| {o['province_id']} | {_md_escape(names[o['province_id']])} | {_md_escape(o['place'])} | "
                     f"{o['in'] or 'no province'} |")
    else:
        L.append("None.")
    L.append("")
    L.append("## Region nesting")
    L.append("")
    if nest_bad:
        L.append("| Region | Uncovered | Overlap | Outside |")
        L.append("|---|---|---|---|")
        for k, v in sorted(nest_bad.items()):
            L.append(f"| {k} | {v['uncovered']:.2e} | {v['overlap']:.2e} | {v['outside']:.2e} |")
    else:
        L.append(f"Every region is tiled exactly by its provinces before simplification (gaps, overlaps and spill "
                 f"each under {NEST_TOLERANCE:g} of the region's area); mapshaper then simplifies shared arcs once, "
                 "so neighbours stay gap-free.")
    L.append("")
    L.append("## Coastal cross-check")
    L.append("")
    L.append("Bitmap coastal means at least 4 pixel edges on the sea or the Great Lakes (D608). Differences are "
             "listed for review; the CSV is not changed.")
    L.append("")
    if coast_bad:
        L.append("| Province | Name | Water edges (px) | Bitmap | CSV |")
        L.append("|---|---|---|---|---|")
        for pid in coast_bad:
            r = mq[pid]
            L.append(f"| {pid} | {_md_escape(r['name'])} | {r['coastal_px']} | {r['coastal_bitmap']} | {r['coastal_csv']} |")
    else:
        L.append("No differences.")
    L.append("")
    L.append("## Provinces in several parts")
    L.append("")
    L.append("Islands and exclaves are allowed; the label point sits in the largest part.")
    L.append("")
    L.append(", ".join(f"{r['province_id']} ({r['components']})" for r in multi) or "None.")
    L.append("")
    L.append("## Visual check")
    L.append("")
    L.append(f"`{preview_name}` in this folder is province-ids.png around the region ({preview_note}).")
    L.append("")
    (qa_dir / f"report-{region.slug}.md").write_text("\n".join(L), encoding="utf-8")
    write_credits(sources)
    print(f"  report: {len(flagged)} flagged, {len(hinted)} hinted, {len(tiny)} tiny, {len(coast_bad)} coastal "
          f"differences, {len(nest_bad)} nesting problems, {'FAIL' if problems else 'pass'}")
    if problems:
        raise SystemExit("qa: " + " / ".join(problems))


def write_credits(sources: dict) -> None:
    """CREDITS.md from the source metadata of every boundary file that reached a province (its
    provenance, in either crosswalk, names it)."""
    import re

    rows = (_read(config.ASSETS_DIR / "crosswalk" / "province_crosswalk.csv")
            + _read(config.ASSETS_DIR / "crosswalk" / "region_crosswalk.csv"))
    used = sorted({m.groups() for r in rows for m in re.finditer(r"geoBoundaries gbOpen (\w+) (ADM\d)", r["provenance"])})
    drawn = any(licenses.BUILDER_PROVENANCE in r["provenance"] for r in rows)
    ne, gb = sources["natural_earth"], sources["geoboundaries"]
    L = ["# Map data credits", ""]
    L.append("_Generated by `tools/map-pipeline/run.py` from the pinned source metadata (tools/map-pipeline/sources.toml)._")
    L.append("")
    L.append("## Natural Earth")
    L.append("")
    L.append(f"Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com. Version {ne['version']} "
             f"(github.com/nvkelso/natural-earth-vector, commit {ne['commit'][:7]}): admin 0 countries, admin 1 states "
             "and provinces, populated places and lakes at 1:10m. Public domain.")
    L.append("")
    L.append("## geoBoundaries")
    L.append("")
    L.append(gb["citation"] + f" Release {gb['version']} (github.com/wmgeolab/geoBoundaries, commit {gb['commit'][:7]}), gbOpen.")
    L.append("")
    metas = []
    for iso, level in used:
        meta = fetch.gb_meta(iso, level, sources)
        if licenses.classify_meta(meta)[0]:
            metas.append((iso, level, meta))
    if metas:
        L.append(f"Boundary files used ({len(metas)}), with their original sources and licenses:")
        L.append("")
        L.append("| Country | Level | Source | License | Year |")
        L.append("|---|---|---|---|---|")
        for iso, level, meta in metas:
            L.append(f"| {iso} | {level} | {_md_escape(meta.get('boundarySource'))} | "
                     f"{_md_escape(meta.get('boundaryLicense'))} | {meta.get('boundaryYear', '')} |")
        L.append("")
        # source strings are geoBoundaries' own; a misspelt one gets its correct name beside it
        fixes = {"Estadstica": "El Instituto Nacional de Estadística (INE), Spain"}
        for iso, level, meta in metas:
            for bad, good in fixes.items():
                if bad in (meta.get("boundarySource") or ""):
                    L.append(f"{iso} {level}: the source string is geoBoundaries' metadata as published, with a typo; "
                             f"the source is {good}.")
                    L.append("")
    classes = {licenses.classify_meta(meta)[1] for _, _, meta in metas}
    if "OGL-Canada 2.0" in classes:
        L.append("Contains information licensed under the Open Government Licence - Canada "
                 "(https://open.canada.ca/en/open-government-licence-canada), from Statistics Canada.")
        L.append("")
    if "OGL-UK 3.0" in classes:
        L.append("Contains public sector information licensed under the Open Government Licence v3.0 "
                 "(https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/), from the Office for "
                 "National Statistics.")
        L.append("")
    # D685: the attribution each government licence asks for
    gov_notes = {
        "DL-DE-BY 2.0": "Germany: © GeoBasis-DE / BKG (Federal Agency for Cartography and Geodesy), licensed under the "
                        "Data licence Germany - attribution - version 2.0 (https://www.govdata.de/dl-de/by-2-0).",
        "Etalab 2.0": "France: source IGN (Institut national de l'information géographique et forestière), Licence "
                      "Ouverte / Etalab Open Licence 2.0 (https://www.etalab.gouv.fr/licence-ouverte-open-licence).",
        "INE": "Spain: fuente INE (Instituto Nacional de Estadística), used under the INE data licence "
               "(https://www.ine.es/aviso_legal).",
        "SG-ODL 1.0": "Singapore: contains information from the Urban Redevelopment Authority's planning areas, made "
                      "available under the terms of the Singapore Open Data Licence version 1.0 "
                      "(https://data.gov.sg/open-data-licence).",
        "KOGL Type 1": "Korea: source Statistics Korea (KOSTAT), under the Korea Open Government Licence Type 1 "
                       "(source indication).",
    }
    for cls in sorted(gov_notes):
        if cls in classes:
            L.append(gov_notes[cls])
            L.append("")
    L.append("Province shapes are derived works: admin units dissolved and clipped to Natural Earth regions, and "
             "synthetic Voronoi splits where no permissively licensed admin units exist."
             + (" A few lines (contested land drawn by the game's own province files, cities and islands the sources "
                "lack) are drawn by the builder; they are listed in the QA reports." if drawn else ""))
    L.append("")
    (config.ASSETS_DIR / "CREDITS.md").write_text("\n".join(L), encoding="utf-8")
