"""Build the USA map's county shapes: assets/usmap/counties.topo.json (pivot 5.1, 15.3; D1048).

Run: python -I -B tools/usmap/build.py [--src <counties-albers-10m.json>]

Input: us-atlas 3.0.1 `counties-albers-10m.json` (ISC licence; the Census 2017 cartographic boundary
files, already projected with d3's geoAlbersUsa at scale 1300 into a 975 by 610 box, y down, Alaska
and Hawaii inset). It is the plane of the game's county centroids (tools/world-1995/counties/README.md,
"centroid_x, centroid_y"), so the shapes and the centroids line up with no transform. Without
`--src` the file is downloaded into tools/usmap/raw/ (git-ignored), or taken from there if present.

Output: a TopoJSON topology with one object, `counties`, whose geometries are in FIPS order, so a
feature's index is the county's index (`CountyId`) and the index of every column of v_usmap_layers.
The set must equal assets/worlds/1995/counties.csv exactly (3,142 counties: the 2010 set with
Bedford city VA merged, which is us-atlas 3.0.1's own set); the build stops if it does not. The
`states` and `nation` objects and the names are dropped (the views carry the names; state borders
are the arcs between counties of two states), arcs no county uses are pruned, and the arcs stay
quantized and delta-encoded as in the source. Standard library only.
"""

import argparse
import csv
import gzip
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, "raw")
SOURCE_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-albers-10m.json"
SOURCE_NAME = "counties-albers-10m.json"
COUNTIES_CSV = os.path.join(REPO, "assets", "worlds", "1995", "counties.csv")
OUT = os.path.join(REPO, "assets", "usmap", "counties.topo.json")
# The frozen county set's size (pivot 5.1).
COUNTY_COUNT = 3142
# The plane's box (README of tools/world-1995/counties): written into the output for the app.
PLANE_WIDTH = 975
PLANE_HEIGHT = 610


def source_path(src: str | None) -> str:
    if src is not None:
        return src
    path = os.path.join(RAW, SOURCE_NAME)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    os.makedirs(RAW, exist_ok=True)
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "python-urllib"})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())
    print(f"downloaded {SOURCE_URL} ({os.path.getsize(path)} bytes)")
    return path


def game_fips() -> list[str]:
    with open(COUNTIES_CSV, newline="", encoding="utf-8") as f:
        return [row["fips"] for row in csv.DictReader(f)]


def arc_refs(geom: dict) -> list:
    """The arc index lists of a Polygon or MultiPolygon, as nested lists of rings."""
    if geom["type"] == "Polygon":
        return [geom["arcs"]]
    if geom["type"] == "MultiPolygon":
        return geom["arcs"]
    raise ValueError(f"{geom.get('id')}: unexpected geometry {geom['type']}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=None)
    args = ap.parse_args()
    topo = json.load(open(source_path(args.src), encoding="utf-8"))

    counties = topo["objects"]["counties"]["geometries"]
    by_fips = {g["id"]: g for g in counties}
    if len(by_fips) != len(counties):
        raise SystemExit("duplicate county ids in the source")
    want = game_fips()
    if len(want) != COUNTY_COUNT or want != sorted(want):
        raise SystemExit(f"counties.csv: expected {COUNTY_COUNT} codes in order")
    missing = [f for f in want if f not in by_fips]
    extra = sorted(set(by_fips) - set(want))
    if missing or extra:
        raise SystemExit(f"county sets differ: missing {missing[:10]}, extra {extra[:10]}")

    # Prune and renumber the arcs the counties use, in first-use order.
    remap: dict[int, int] = {}
    arcs: list = []

    def use(i: int) -> int:
        j = i if i >= 0 else ~i
        if j not in remap:
            remap[j] = len(arcs)
            arcs.append(topo["arcs"][j])
        k = remap[j]
        return k if i >= 0 else ~k

    geoms = []
    empty = 0
    for fips in want:
        g = by_fips[fips]
        polys = [[[use(i) for i in ring] for ring in poly] for poly in arc_refs(g)]
        if not polys:
            empty += 1
        if len(polys) == 1:
            geoms.append({"type": "Polygon", "arcs": polys[0], "id": fips})
        else:
            geoms.append({"type": "MultiPolygon", "arcs": polys, "id": fips})

    out = {
        "type": "Topology",
        "bbox": topo["bbox"],
        "transform": topo["transform"],
        "plane": [PLANE_WIDTH, PLANE_HEIGHT],
        "source": "us-atlas 3.0.1 counties-albers-10m.json (ISC); tools/usmap/build.py",
        "objects": {"counties": {"type": "GeometryCollection", "geometries": geoms}},
        "arcs": arcs,
    }
    text = json.dumps(out, separators=(",", ":"))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    raw = len(text.encode("utf-8"))
    gz = len(gzip.compress(text.encode("utf-8"), 9))
    print(
        f"wrote {os.path.relpath(OUT, REPO)}: {len(geoms)} counties, {len(arcs)} of "
        f"{len(topo['arcs'])} arcs, {raw:,} bytes ({gz:,} gzipped); {empty} without rings"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
