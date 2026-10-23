"""P8 city probe and Metro reach scan (D686), independent of the crosswalk.

The probe looks up each point of `checks/city-points.txt` in province-index.png through the
Miller frame of map-meta.toml: a point passes when its pixel or one of the 8 around it is an
expected province (a 5 km pixel can straddle a boundary); a point in the water takes the
nearest province pixel within `WATER_PX`. The QA step fails on a mismatch.

The Metro scan lists Metro provinces whose centroid lies far from their Metro's city, that are
much larger than the Metro's median province, or a region where the Metro provinces take a large
share of the land next to rural provinces (the swallowed-countryside error of D612). It lists;
it does not fail.
"""

from __future__ import annotations

import csv
import math
import tomllib
from collections import defaultdict

import numpy as np

from . import config, text

POINTS = config.PIPELINE_DIR / "checks" / "city-points.txt"
# How far (pixels) a point in the water looks for the nearest province pixel.
WATER_PX = 4
# Metro scan thresholds (D686): a Metro province's centroid this far (km) from its Metro city;
# larger than this many times the Metro's median and this many pixels; a region whose Metro
# provinces hold more than this share of its pixels while it also has rural provinces.
METRO_FAR_KM = 80.0
METRO_BIG_TIMES = 4
METRO_BIG_PX = 250
METRO_SHARE = 0.30
# Smallest land exclave listed (pixels; mapgen's EXCLAVE_MIN_PX, D691).
EXCLAVE_MIN_PX = 5


class Bitmap:
    def __init__(self, assets):
        from PIL import Image

        Image.MAX_IMAGE_PIXELS = None
        meta = tomllib.loads((assets / "map-meta.toml").read_text(encoding="utf-8"))
        self.idx = np.array(Image.open(assets / "province-index.png"), dtype=np.int64)
        self.h, self.w = self.idx.shape
        with (assets / "province-colors.csv").open(encoding="utf-8", newline="") as f:
            self.ids = [r["province_id"] for r in csv.DictReader(f)]
        self.ppu = self.w / (2 * math.pi)
        self.ytop = self._my(meta["lat_max"])

    @staticmethod
    def _my(lat):
        return 1.25 * math.log(math.tan(math.pi / 4 + 0.4 * math.radians(lat)))

    def pixel(self, lon, lat):
        return (int(math.floor((lon + 180.0) / 360.0 * self.w)) % self.w,
                int(math.floor((self.ytop - self._my(lat)) * self.ppu)))

    def at(self, x, y):
        if not 0 <= y < self.h:
            return ""
        v = int(self.idx[y, x % self.w])
        return self.ids[v - 1] if v else ""

    def lookup(self, lon, lat):
        """(province at the point or the nearest within WATER_PX, the 3x3 neighbourhood, water?)"""
        x, y = self.pixel(lon, lat)
        got, water = self.at(x, y), False
        if not got:
            water = True
            best = None
            for dy in range(-WATER_PX, WATER_PX + 1):
                for dx in range(-WATER_PX, WATER_PX + 1):
                    p = self.at(x + dx, y + dy)
                    if p and (best is None or (dx * dx + dy * dy, p) < best):
                        best = (dx * dx + dy * dy, p)
            got = best[1] if best else ""
        near = {self.at(x + dx, y + dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1)} - {""}
        return got, near, water


def read_points(path=POINTS):
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        label, lon, lat, exp = [s.strip() for s in line.split("|")]
        out.append({"label": label, "lon": float(lon), "lat": float(lat), "exp": exp})
    return out


def _wants(exp: str, pid: str) -> bool:
    return any(pid == e or (len(e) == 2 and pid.startswith(e + "-")) for e in exp.split(","))


def probe(assets, points=None) -> list[dict]:
    """Every point with `got`, `ok` (None for `?` points) and how it passed."""
    bm = Bitmap(assets)
    rows = []
    for p in points if points is not None else read_points():
        got, near, water = bm.lookup(p["lon"], p["lat"])
        r = dict(p, got=got, water=water)
        if p["exp"] == "?":
            r["ok"], r["how"] = None, "listed"
        elif got and _wants(p["exp"], got):
            r["ok"], r["how"] = True, "on it" if not water else "nearest across water"
        elif any(_wants(p["exp"], n) for n in near):
            r["ok"], r["how"] = True, "within a pixel"
        else:
            r["ok"], r["how"] = False, "mismatch"
        rows.append(r)
    return rows


def _km(lon1, lat1, lon2, lat2):
    dx = (lon1 - lon2) * math.cos(math.radians((lat1 + lat2) / 2)) * 111.3
    return math.hypot(dx, (lat1 - lat2) * 111.3)


def metro_scan(csv_rows, centroids, places_by_country) -> list[dict]:
    """Rows: kind (far, big, share), province or region, numbers."""
    out = []
    metros = defaultdict(list)
    for r in csv_rows:
        if r["metro"] and r["id"] in centroids:
            metros[(r["country"], r["metro"])].append(r)
    for (cc, m), ps in sorted(metros.items()):
        cands = []
        for part in [m] + m.replace("/", "-").split("-"):
            cands += places_by_country.get((cc, text.fold(part)), [])
        areas = sorted(int(centroids[p["id"]]["area_px"]) for p in ps)
        med = areas[len(areas) // 2]
        core = max(cands) if cands else None
        for p in ps:
            c = centroids[p["id"]]
            a = int(c["area_px"])
            if core is not None:
                d = _km(float(c["lon"]), float(c["lat"]), core[1], core[2])
                if d > METRO_FAR_KM:
                    out.append({"kind": "far from its Metro city", "what": f"{p['id']} {p['name']}",
                                "detail": f"centroid {d:.0f} km from {core[3]} (Metro {m})"})
            if a > METRO_BIG_PX and a > METRO_BIG_TIMES * med:
                out.append({"kind": "large for its Metro", "what": f"{p['id']} {p['name']}",
                            "detail": f"{a} px, the Metro's median is {med} px (Metro {m})"})
    regions = defaultdict(list)
    for r in csv_rows:
        if r["id"] in centroids:
            regions[(r["country"], r["region"])].append(r)
    for (cc, rg), ps in sorted(regions.items()):
        met = [p for p in ps if p["metro"]]
        rur = [p for p in ps if not p["metro"]]
        if not met or not rur:
            continue
        tot = sum(int(centroids[p["id"]]["area_px"]) for p in ps)
        share = sum(int(centroids[p["id"]]["area_px"]) for p in met) / max(tot, 1)
        if share > METRO_SHARE:
            out.append({"kind": "Metro share of a region", "what": f"{cc}: {rg}",
                        "detail": f"Metro provinces hold {share:.0%} of {tot} px beside {len(rur)} rural"})
    return out


def _unproject(bm: Bitmap, x: float, y: float) -> tuple[float, float]:
    lon = x / bm.w * 360.0 - 180.0
    my = bm.ytop - y / bm.ppu
    return lon, math.degrees(2.5 * math.atan(math.exp(0.8 * my)) - 0.625 * math.pi)


def _on_main_part(geom, lon: float, lat: float) -> bool:
    """The point is nearest the largest polygon of `geom` (the province's simplified shape)."""
    from shapely.geometry import Point

    parts = sorted(getattr(geom, "geoms", [geom]), key=lambda g: -g.area)
    pt = Point(lon, lat)
    return min(range(len(parts)), key=lambda i: parts[i].distance(pt)) == 0


def exclaves(bm: Bitmap, mq_rows: dict, csv_rows: list[dict], places_by_country: dict,
             allowed: dict, seeds: dict | None = None, shapes: dict | None = None) -> list[dict]:
    """D691 (PR #39 review): every land exclave mapgen lists (a part of 5 px or more that is not
    the province's largest and touches no pixel outside every province). One is explained when
    a place a part of the province's composite name names lies in it (Guadalajara in
    Toledo-Guadalajara), when one of the province's own seeds (a hint point, or a place its notes
    name) lies in it, so the land was given to it on purpose, or when `[review.exclave_ok]` gives
    the province a reason; any other fails."""
    from .anchors import _components

    by_id = {r["id"]: r for r in csv_rows}
    out = []
    for pid in sorted(mq_rows):
        spec = (mq_rows[pid].get("exclaves") or "").strip()
        if pid not in by_id or not spec:
            continue
        r = by_id[pid]
        v = bm.ids.index(pid) + 1
        ys, xs = np.nonzero(bm.idx == v)
        # roll a province across the seam so its crop is one piece
        shift = 0
        if xs.min() == 0 and xs.max() == bm.w - 1:
            occ = np.zeros(bm.w, dtype=bool)
            occ[xs] = True
            gaps = np.nonzero(~occ)[0]
            shift = int(gaps[0]) if len(gaps) else 0
        ux = (xs - shift) % bm.w
        x0, y0 = int(ux.min()), int(ys.min())
        mask = np.zeros((int(ys.max()) - y0 + 1, int(ux.max()) - x0 + 1), dtype=bool)
        mask[ys - y0, ux - x0] = True
        lab = _components(mask)
        # parts named by the composite name: the label of each named place's pixel
        parts = text.name_parts(r["name"])
        named: dict[int, str] = {}
        for part in parts[1:] if len(parts) > 1 else []:
            for _, lon, lat, label in places_by_country.get((r["country"], part), []):
                px, py = bm.pixel(lon, lat)
                cx, cy = (px - shift) % bm.w - x0, py - y0
                if 0 <= cy < lab.shape[0] and 0 <= cx < lab.shape[1] and lab[cy, cx]:
                    named.setdefault(int(lab[cy, cx]), label)
        yy, xx = np.nonzero(lab)
        ll = lab[yy, xx]
        sizes = np.bincount(ll)
        seeded: dict[int, str] = {}
        for x, y, label in (seeds or {}).get(pid, []):
            px, py = bm.pixel(x, y)
            cx, cy = (px - shift) % bm.w - x0, py - y0
            if 0 <= cy < lab.shape[0] and 0 <= cx < lab.shape[1] and lab[cy, cx]:
                seeded.setdefault(int(lab[cy, cx]), label)
        sx, sy = np.bincount(ll, weights=xx), np.bincount(ll, weights=yy)
        means = {k: (sx[k] / sizes[k] + 0.5, sy[k] / sizes[k] + 0.5) for k in range(1, len(sizes)) if sizes[k]}
        for item in spec.split("|"):
            n, mx, my = item.split(":")
            n, mx, my = int(n), float(mx), float(my)
            ux_m = (mx - shift) % bm.w - x0
            k = min((k for k in means if sizes[k] == n),
                    key=lambda k: (means[k][0] - ux_m) ** 2 + (means[k][1] - (my - y0)) ** 2, default=None)
            lon, lat = _unproject(bm, mx, my)
            if k is not None and k in named:
                why, ok = f"composite name: {named[k]} lies in it", True
            elif k is not None and k in seeded:
                why, ok = f"its own seed {seeded[k]} lies in it", True
            elif shapes and pid in shapes and _on_main_part(shapes[pid], lon, lat):
                why, ok = "a neck under a pixel wide joins it to the rest in the shapes", True
            elif pid in allowed:
                why, ok = allowed[pid], True
            else:
                why, ok = "unexplained", False
            out.append({"province_id": pid, "name": r["name"], "px": n, "lon": round(lon, 2),
                        "lat": round(lat, 2), "why": why, "ok": ok})
    return out
