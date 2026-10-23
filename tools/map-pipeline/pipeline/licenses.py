"""P2: the license filter on geoBoundaries `boundaryLicense` (map-sources.md, build-plan P2).

Kept (D601): CC BY (any version, no ShareAlike, NonCommercial or NoDerivatives term), CC0,
public domain, and the attribution-only government open licences Logan allowed: the Open
Government Licence - Canada 2.0 and the UK Open Government Licence 3.0 (PR #34), and Germany's
Data licence Attribution 2.0, France's Etalab Open Licence 2.0, Spain's INE data licence, the
Singapore Open Data Licence 1.0 and Korea's Open Government Licence Type 1 (PR #38, D685), each
credited in CREDITS.md. swisstopo's licence and "Other - Direct Permission" stay refused. Everything else, any
license or license detail naming a refused term, and anything whose source names
OpenStreetMap or GADM, goes to the Voronoi path. Unknown strings are refused, never guessed.
"""

from __future__ import annotations

import re

# Terms that disqualify a license string (or its detail) outright.
_BLOCK = [
    (re.compile(r"share\s*-?\s*alike|\bby[- ]?sa\b|\bcc[- ]by[- ]sa\b", re.I), "ShareAlike"),
    (re.compile(r"open\s+database|\bodbl\b|\bodc\b", re.I), "ODbL"),
    (re.compile(r"non\s*-?\s*commercial|\bby[- ]?nc\b|\bnc\b", re.I), "NonCommercial"),
    (re.compile(r"no\s*-?\s*deriv|\bby[- ]?nd\b|\bnd\b", re.I), "NoDerivatives"),
    (re.compile(r"\bgadm\b", re.I), "GADM"),
]
# Sources that make polygons a derivative of a database we refuse to ship (map-sources.md risks).
_BLOCK_SOURCE = [
    # also "Open Street Map" with spaces (geoBoundaries NER ADM3 and DZA ADM3 write it so, D671)
    (re.compile(r"open\s*-?\s*street\s*-?\s*map|\bosm\b", re.I), "OpenStreetMap source"),
    (re.compile(r"\bgadm\b", re.I), "GADM source"),
]
_ALLOW = [
    (re.compile(r"public\s+domain", re.I), "public domain"),
    (re.compile(r"\bcc\s*-?\s*0\b|cc0|creative\s+commons\s+zero", re.I), "CC0"),
    (re.compile(r"creative\s+commons\s+attribution|\bcc[- ]by\b", re.I), "CC BY"),
    # D601 (Logan): attribution-only government open licences
    (re.compile(r"open\s+government\s+(licen[cs]e\s*-?\s*)?canada\s*2(\.0)?\b", re.I), "OGL-Canada 2.0"),
    # the UK OGL is the only Open Government Licence with a version 3
    (re.compile(r"open\s+government\s+licen[cs]e(?!.*canada).*\bv?3(\.0)?\b|\bogl[- ]uk[- ]v?3", re.I), "OGL-UK 3.0"),
    # D685 (Logan, PR #38 review): five more attribution-only government licences
    (re.compile(r"data\s+licen[cs]e\s+germany\s*-?\s*attribution\s*-?\s*(version\s*)?2(\.0)?\b|dl-de/by-2-0", re.I),
     "DL-DE-BY 2.0"),
    (re.compile(r"etalab\s+open\s+licen[cs]e\s*2(\.0)?\b|licence\s+ouverte\s*(v|version\s*)?2(\.0)?\b", re.I), "Etalab 2.0"),
    (re.compile(r"national\s+institute\s+of\s+statistics\s*\(ine\)\s*data\s+licen[cs]e", re.I), "INE"),
    (re.compile(r"singapore\s+open\s+data\s+licen[cs]e\s*(version\s*)?1(\.0)?\b", re.I), "SG-ODL 1.0"),
    # Type 1 only: types 2 to 4 add non-commercial or no-derivatives terms
    (re.compile(r"korea\s+open\s+government\s+licen[cs]e\s+type\s*1\b", re.I), "KOGL Type 1"),
]


def classify(license_str: str, source_str: str = "", detail_str: str = "") -> tuple[bool, str]:
    """Return (allowed, reason). `reason` is the short license class or why it was refused."""
    lic = (license_str or "").strip()
    for text_, what in ((lic, "license"), ((detail_str or "").strip(), "license detail")):
        for pat, why in _BLOCK:
            if text_ and pat.search(text_):
                return False, f"refused: {why} in {what} ({text_})"
    for pat, why in _BLOCK_SOURCE:
        if pat.search(source_str or ""):
            return False, f"refused: {why} ({source_str})"
    for pat, cls in _ALLOW:
        if pat.search(lic):
            return True, cls
    return False, f"refused: not in the allowlist ({lic or 'no license stated'})"


def classify_meta(meta: dict) -> tuple[bool, str]:
    """classify() on a geoBoundaries metadata record: license, source and license detail."""
    return classify(meta.get("boundaryLicense", ""), meta.get("boundarySource", ""), meta.get("licenseDetail", ""))


def provenance(meta: dict) -> str:
    """The provenance string written on every province built from this boundary file."""
    return (
        f"geoBoundaries gbOpen {meta.get('boundaryISO')} {meta.get('boundaryType')} "
        f"({meta.get('boundarySource')}; {meta.get('boundaryLicense')})"
    )


NE_PROVENANCE = "Natural Earth 10m (public domain)"
# A line the builder drew in a hints file (contested land drawn by our own province files,
# decision C; D676): our own work, no third-party license.
BUILDER_PROVENANCE = "builder-drawn line (hints file)"


if __name__ == "__main__":  # tiny self-check, run by `run.py selftest`
    cases = {
        "Public Domain": True,
        "Creative Commons Attribution 4.0 (CC BY 4.0)": True,
        "CC0 1.0": True,
        "Open Government Canada 2.0": True,
        "Open Government Licence - Canada 2.0": True,
        "Open Government Licence v3.0 (UK)": True,
        "UK Open Government Licence 3.0": True,
        "Open Government Licence 2.0": False,
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
    assert classify("Public Domain", "", "derived from OpenStreetMap, ODbL")[0] is False
    assert classify("Open Government Canada 2.0", "Statistics Canada", "")[0] is True
    assert classify("Creative Commons Attribution 4.0 (CC BY 4.0)", "OCHA ROWCA, Open Street Map")[0] is False
    # D685: allowed since the PR #38 review; swisstopo and direct permission stay refused
    for lic in ("Data license Germany - Attribution - Version 2.0", "Etalab Open License 2.0",
                "Singapore Open Data License Version 1.0", "Korea Open Government License Type 1 (Source Indication)",
                "National Institute of Statistics (INE) Data License"):
        assert classify(lic)[0] is True, lic
    for lic in ("Federal Office of Topography swisstopo License", "Other - Direct Permission",
                "Korea Open Government License Type 2", "Korea Open Government License Type 4"):
        assert classify(lic)[0] is False, lic
    print("licenses: ok")
