"""Download the county build's raw inputs into raw/<name>/ (git-ignored). Standard library only.

Run: python -I -B tools/world-1995/counties/fetch.py
Each file goes in its own folder; nothing here is executed, only parsed by build.py.
README.md has the licence of each source.
"""

import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")

# (folder, file name, URL)
SOURCES = [
    # Which counties touch, 2010 vintage (Census).
    (
        "adjacency",
        "county_adjacency2010.txt",
        "https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency2010.txt",
    ),
    # 1990 and 2000 census counts on 2000 county lines (Census PHC-T-4).
    (
        "phct4",
        "tab01.txt",
        "https://www2.census.gov/programs-surveys/decennial/2000/phc/phc-t-04/tab01.txt",
    ),
    # The 2000 estimates base on 2010 county lines (Census intercensal estimates).
    (
        "pop2000int",
        "co-est00int-tot.csv",
        "https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/county/co-est00int-tot.csv",
    ),
    # County names and FIPS codes, 2010 (Census).
    (
        "fips",
        "national_county.txt",
        "https://www2.census.gov/geo/docs/reference/codes/files/national_county.txt",
    ),
    # Land area of each 2010 county (Census 2010 Gazetteer).
    (
        "gazetteer",
        "Gaz_counties_national.zip",
        "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/Gaz_counties_national.zip",
    ),
    # County shapes already projected with d3's geoAlbersUsa (us-atlas 3.0.1, ISC).
    (
        "usatlas",
        "counties-albers-10m.json",
        "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-albers-10m.json",
    ),
    # County presidential returns 1868 to 2020, used for 1992 (Algara and Amlani, CC0,
    # doi:10.7910/DVN/DGUMFI; file id 5028532 of version 1.1). An R save() file, read by rdata.py.
    (
        "algara",
        "dataverse_shareable_presidential_county_returns_1868_2020.Rdata",
        "https://dataverse.harvard.edu/api/access/datafile/5028532",
    ),
    # County presidential returns 2000 to 2016 (MIT Election Data and Science Lab). The CC0 record,
    # doi:10.7910/DVN/VOQCHQ, sits behind a guestbook form, so this is the lab's GitHub copy, which
    # carries no licence file (README.md, "Returns").
    (
        "mit",
        "countypres_2000-2016.csv",
        "https://raw.githubusercontent.com/MEDSL/county-returns/master/countypres_2000-2016.csv",
    ),
]


def main() -> int:
    for folder, name, url in SOURCES:
        d = os.path.join(RAW, folder)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, name)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            print(f"have  {folder}/{name} ({os.path.getsize(path)} bytes)")
            continue
        req = urllib.request.Request(url, headers={"User-Agent": "python-urllib"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
        print(f"got   {folder}/{name} ({os.path.getsize(path)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
