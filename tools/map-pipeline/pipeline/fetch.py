"""P1: fetch the pinned sources into the geodata cache (re-runnable; skips verified files).

Every file and its sha256 is pinned in sources.toml. geoBoundaries geometry is fetched only for
boundaries that pass the P2 license filter, so refused (for example ODbL) data never enters the
cache; their metadata is still fetched, for the license record and the QA report.

`pin` rewrites sources.toml: Natural Earth hashes are computed from a download, geoBoundaries
hashes are read from the git-LFS pointers at the pinned tag (the pointer's oid is the sha256).
"""

from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from pathlib import Path

from . import config, licenses

USER_AGENT = "tc20ff-map-pipeline/1 (+https://github.com/logan-czar/TechnoCapital20FF)"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=600) as r:
        return r.read()


def _download(url: str, dest: Path, sha256: str, size: int | None = None) -> str:
    """Download `url` to `dest` unless a verified copy is there. Returns 'cached' or 'fetched'."""
    if dest.exists() and sha256_file(dest) == sha256:
        return "cached"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    h = hashlib.sha256()
    n = 0
    with urllib.request.urlopen(req, timeout=600) as r, tmp.open("wb") as f:
        for chunk in iter(lambda: r.read(1 << 20), b""):
            f.write(chunk)
            h.update(chunk)
            n += len(chunk)
    got = h.hexdigest()
    if got != sha256:
        tmp.unlink(missing_ok=True)
        raise SystemExit(f"fetch: checksum mismatch for {url}: got {got}, pinned {sha256}")
    if size is not None and n != size:
        tmp.unlink(missing_ok=True)
        raise SystemExit(f"fetch: size mismatch for {url}: got {n}, pinned {size}")
    tmp.replace(dest)
    return "fetched"


def gb_meta(iso: str, level: str, sources: dict) -> dict:
    path = config.gb_dir(iso, level, sources) / f"geoBoundaries-{iso}-{level}-metaData.json"
    return json.loads(path.read_text(encoding="utf-8"))


def fetch(sources: dict | None = None, isos: set[str] | None = None) -> None:
    sources = sources or config.load_sources()
    ne = sources["natural_earth"]
    for f in ne["files"]:
        status = _download(ne["base_url"] + f["name"], config.ne_path(f["name"], sources), f["sha256"])
        print(f"  ne {f['name']}: {status}")
    gb = sources["geoboundaries"]
    for b in gb["boundary"]:
        if isos is not None and b["iso"] not in isos:
            continue
        d = config.gb_dir(b["iso"], b["level"], sources)
        stem = f"geoBoundaries-{b['iso']}-{b['level']}"
        url = f"{gb['base_url']}{b['iso']}/{b['level']}/"
        s = _download(url + f"{stem}-metaData.json", d / f"{stem}-metaData.json", b["meta_sha256"])
        meta = gb_meta(b["iso"], b["level"], sources)
        ok, why = licenses.classify_meta(meta)
        line = f"  gb {b['iso']} {b['level']} meta: {s}; license {meta.get('boundaryLicense')!r} -> {why}"
        if ok:
            name = config.gb_geojson_name(b)
            g = _download(url + name, d / name, b["geojson_sha256"], b["geojson_size"])
            line += f"; geometry: {g}"
        else:
            line += "; geometry: skipped (Voronoi path)"
        print(line)


# --- pin -------------------------------------------------------------------------------------

NE_LAYERS = [
    # admin 0 without lakes cut out: the land mask for the coastal check (lakes count as land
    # there, except the Great Lakes, D608)
    "10m_cultural/ne_10m_admin_0_countries",
    # admin 1 with lakes cut out: the regions (lakes draw as water)
    "10m_cultural/ne_10m_admin_1_states_provinces_lakes",
    "10m_cultural/ne_10m_populated_places",
    "10m_physical/ne_10m_lakes",
]
NE_EXTS = [".shp", ".shx", ".dbf", ".prj", ".cpg", ".VERSION.txt", ".README.html"]


def _lfs_pointer(url: str) -> tuple[str, int] | None:
    try:
        text = _get(url).decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    oid = size = None
    for line in text.splitlines():
        if line.startswith("oid sha256:"):
            oid = line.split(":", 1)[1].strip()
        elif line.startswith("size "):
            size = int(line.split()[1])
    if not oid:
        raise SystemExit(f"pin: {url} is not a git-LFS pointer")
    return oid, size


def _boundary_lines(b: dict) -> list[str]:
    out = ["[[geoboundaries.boundary]]", f'iso = "{b["iso"]}"', f'level = "{b["level"]}"']
    if b.get("file"):
        out.append(f'file = "{b["file"]}"')
    out += [f'meta_sha256 = "{b["meta_sha256"]}"', f'geojson_sha256 = "{b["geojson_sha256"]}"',
            f"geojson_size = {b['geojson_size']}", ""]
    return out


def pin(isos: list[str], levels: list[str], simplified: bool = True) -> None:
    """Pin (or re-pin) the named countries and levels; other pinned boundaries are kept.
    New pins take geoBoundaries' `_simplified` geometry unless `simplified` is False (D670)."""
    old = config.load_sources()
    ne = old["natural_earth"]
    gb = old["geoboundaries"]
    lines = [
        "# Pinned map sources (build-plan P1). Written by `run.py pin`; checked by `run.py fetch`.",
        "# Only these official sources are used. No OSM, GADM, ODbL or CC BY-SA data is shipped (P2).",
        "",
        f"cache_dir = '{old['cache_dir']}'",
        "",
        "[natural_earth]",
        "# The official Natural Earth repository (naturalearthdata.com links to it), pinned by tag.",
        "# File names are paths under base_url; the cache keeps them by base name.",
        f'version = "{ne["version"]}"',
        f'commit = "{ne["commit"]}"',
        f'base_url = "{ne["base_url"]}"',
        'license = "Public domain (https://www.naturalearthdata.com/about/terms-of-use/)"',
        "files = [",
    ]
    for layer in NE_LAYERS:
        for ext in NE_EXTS:
            name = layer + ext
            dest = config.ne_path(name, old)
            if not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(_get(ne["base_url"] + name))
            lines.append(f'    {{ name = "{name}", sha256 = "{sha256_file(dest)}" }},')
    lines += [
        "]",
        "",
        "[geoboundaries]",
        "# geoBoundaries gbOpen, pinned by release tag; files are git-LFS objects, so the sha256 is the LFS oid.",
        '# `file = "simplified"` pins the geoBoundaries topology-preserving simplified geometry (D670).',
        f'version = "{gb["version"]}"',
        f'commit = "{gb["commit"]}"',
        f'base_url = "{gb["base_url"]}"',
        f'pointer_url = "{gb["pointer_url"]}"',
        'citation = "Runfola, D. et al. (2020) geoBoundaries: A global database of political administrative '
        'boundaries. PLoS ONE 15(4): e0231866. https://doi.org/10.1371/journal.pone.0231866"',
        "",
    ]
    want = {(i, lv) for i in isos for lv in levels}
    entries = {(b["iso"], b["level"]): b for b in gb.get("boundary", []) if (b["iso"], b["level"]) not in want}
    for iso in isos:
        for level in levels:
            stem = f"geoBoundaries-{iso}-{level}"
            base = f"{gb['pointer_url']}{iso}/{level}/"
            meta = _lfs_pointer(base + f"{stem}-metaData.json")
            if meta is None:
                print(f"  {iso} {level}: not in the release")
                continue
            b = {"iso": iso, "level": level}
            if simplified:
                b["file"] = "simplified"
            geo = _lfs_pointer(base + config.gb_geojson_name(b))
            if geo is None:
                print(f"  {iso} {level}: no geometry file")
                continue
            b.update(meta_sha256=meta[0], geojson_sha256=geo[0], geojson_size=geo[1])
            entries[(iso, level)] = b
            print(f"  {iso} {level}: pinned ({geo[1]} bytes)")
    # full-geometry pins (North America's) first, then the rest by country and level
    order = sorted(entries, key=lambda k: (entries[k].get("file") == "simplified", k))
    for k in order:
        lines += _boundary_lines(entries[k])
    config.SOURCES_TOML.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    fetch()
    sys.exit(0)
