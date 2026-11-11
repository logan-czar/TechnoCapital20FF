"""Download the spike's raw inputs into raw/<name>/ (gitignored). Standard library only.

Run: python -I -B fetch.py
Each file goes in its own folder; nothing here is executed, only parsed by prep.py.
"""

import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")

# (folder, file name, URL). README.md has the licence of each.
SOURCES = [
    (
        "adjacency",
        "county_adjacency2010.txt",
        "https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency2010.txt",
    ),
    (
        "phct4",
        "tab01.txt",
        "https://www2.census.gov/programs-surveys/decennial/2000/phc/phc-t-04/tab01.txt",
    ),
    (
        "pop2000int",
        "co-est00int-tot.csv",
        "https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/county/co-est00int-tot.csv",
    ),
    (
        "pop2010s",
        "co-est2020-alldata.csv",
        "https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/counties/totals/co-est2020-alldata.csv",
    ),
    (
        "pop2020s",
        "co-est2023-alldata.csv",
        "https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/counties/totals/co-est2023-alldata.csv",
    ),
    (
        "fips",
        "national_county.txt",
        "https://www2.census.gov/geo/docs/reference/codes/files/national_county.txt",
    ),
    (
        "usatlas",
        "counties-10m.json",
        "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json",
    ),
    (
        "usatlas",
        "counties-albers-10m.json",
        "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-albers-10m.json",
    ),
    # The Dataverse record (doi:10.7910/DVN/VOQCHQ, CC0, 2000-2024) answers the API with
    # "may not download without the required Guestbook response", so the spike takes the
    # lab's GitHub copy (2000-2016), which needs no form.
    (
        "mit",
        "countypres_2000-2016.csv",
        "https://raw.githubusercontent.com/MEDSL/county-returns/master/countypres_2000-2016.csv",
    ),
    (
        "mit",
        "readme.md",
        "https://raw.githubusercontent.com/MEDSL/county-returns/master/County%20Presidential%20Returns%202000-2016.md",
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
