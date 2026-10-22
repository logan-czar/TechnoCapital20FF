"""P2: the license filter on geoBoundaries `boundaryLicense` (map-sources.md, build-plan P2).

Kept: CC BY (any version, no ShareAlike, NonCommercial or NoDerivatives term), CC0 and public
domain. Everything else, and anything whose source names OpenStreetMap or GADM, goes to the
Voronoi path (D601). Unknown strings are refused, never guessed.
"""

from __future__ import annotations

import re

# Terms that disqualify a license string outright.
_BLOCK = [
    (re.compile(r"share\s*-?\s*alike|\bby[- ]?sa\b|\bcc[- ]by[- ]sa\b", re.I), "ShareAlike"),
    (re.compile(r"open\s+database|\bodbl\b|\bodc\b", re.I), "ODbL"),
    (re.compile(r"non\s*-?\s*commercial|\bby[- ]?nc\b|\bnc\b", re.I), "NonCommercial"),
    (re.compile(r"no\s*-?\s*deriv|\bby[- ]?nd\b|\bnd\b", re.I), "NoDerivatives"),
    (re.compile(r"\bgadm\b", re.I), "GADM"),
]
# Sources that make polygons a derivative of a database we refuse to ship (map-sources.md risks).
_BLOCK_SOURCE = [
    (re.compile(r"openstreetmap|\bosm\b", re.I), "OpenStreetMap source"),
    (re.compile(r"\bgadm\b", re.I), "GADM source"),
]
_ALLOW = [
    (re.compile(r"public\s+domain", re.I), "public domain"),
    (re.compile(r"\bcc\s*-?\s*0\b|cc0|creative\s+commons\s+zero", re.I), "CC0"),
    (re.compile(r"creative\s+commons\s+attribution|\bcc[- ]by\b", re.I), "CC BY"),
]


def classify(license_str: str, source_str: str = "") -> tuple[bool, str]:
    """Return (allowed, reason). `reason` is the short license class or why it was refused."""
    lic = (license_str or "").strip()
    for pat, why in _BLOCK:
        if pat.search(lic):
            return False, f"refused: {why} ({lic})"
    for pat, why in _BLOCK_SOURCE:
        if pat.search(source_str or ""):
            return False, f"refused: {why} ({source_str})"
    for pat, cls in _ALLOW:
        if pat.search(lic):
            return True, cls
    return False, f"refused: not in the allowlist ({lic or 'no license stated'})"


def provenance(meta: dict) -> str:
    """The provenance string written on every province built from this boundary file."""
    return (
        f"geoBoundaries gbOpen {meta.get('boundaryISO')} {meta.get('boundaryType')} "
        f"({meta.get('boundarySource')}; {meta.get('boundaryLicense')})"
    )


NE_PROVENANCE = "Natural Earth 10m (public domain)"


if __name__ == "__main__":  # tiny self-check, run by `run.py selftest`
    cases = {
        "Public Domain": True,
        "Creative Commons Attribution 4.0 (CC BY 4.0)": True,
        "CC0 1.0": True,
        "Open Government Canada 2.0": False,
        "Open Data Commons Open Database License 1.0": False,
        "Creative Commons Attribution-ShareAlike 2.0": False,
        "CC BY-SA 4.0": False,
        "Creative Commons Attribution-NonCommercial 4.0": False,
        "": False,
    }
    for s, want in cases.items():
        got, why = classify(s)
        assert got == want, (s, got, why)
    assert classify("CC BY 4.0", "OpenStreetMap contributors")[0] is False
    print("licenses: ok")
