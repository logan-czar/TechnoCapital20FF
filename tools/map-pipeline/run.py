"""Entry point for the province map pipeline. See README.md.

    uv run python run.py --region north-america          # the whole pipeline, P1 to P8
    uv run python run.py --region north-america --steps crosswalk,shapes
    uv run python run.py --region all                     # every region file, mapgen once
    uv run python run.py pin --iso USA CAN MEX           # re-pin sources.toml
    uv run python run.py giants [--write | --coastal]    # the giant-province split (D820)
"""

from __future__ import annotations

import argparse
import sys
import time

STEPS = ["fetch", "crosswalk", "shapes", "simplify", "mapgen", "qa"]


def main(argv: list[str]) -> int:
    if argv and argv[0] == "pin":
        p = argparse.ArgumentParser(prog="run.py pin")
        p.add_argument("--iso", nargs="+", required=True)
        p.add_argument("--levels", nargs="+", default=["ADM2"])
        p.add_argument("--full", action="store_true", help="pin the full geometry, not the simplified file")
        a = p.parse_args(argv[1:])
        from pipeline import fetch

        fetch.pin(a.iso, a.levels, simplified=not a.full)
        return 0
    if argv and argv[0] == "giants":
        p = argparse.ArgumentParser(prog="run.py giants")
        p.add_argument("--write", action="store_true", help="cut the giants and write the data and hints")
        p.add_argument("--coastal", action="store_true", help="set the split parts' coastal flags from mapgen")
        a = p.parse_args(argv[1:])
        from pipeline import giants

        giants.run(write=a.write, coastal=a.coastal, log=lambda s: print(s, flush=True))
        return 0
    if argv and argv[0] == "selftest":
        import runpy

        runpy.run_module("pipeline.licenses", run_name="__main__")
        runpy.run_module("pipeline.text", run_name="__main__")
        return 0

    p = argparse.ArgumentParser(prog="run.py")
    p.add_argument("--region", required=True,
                   help="region slug, e.g. north-america, or `all` for every region file in CSV order")
    p.add_argument("--steps", default=",".join(STEPS), help=f"comma list from {STEPS}")
    a = p.parse_args(argv)
    from pipeline import config

    if a.region != "all" and a.region not in config.REGIONS:
        p.error(f"unknown region {a.region!r}; known: all, {', '.join(config.REGION_SLUGS)}")
    regions = [config.REGIONS[s] for s in config.REGION_SLUGS] if a.region == "all" else [config.REGIONS[a.region]]
    steps = [s.strip() for s in a.steps.split(",") if s.strip()]
    for s in steps:
        if s not in STEPS:
            p.error(f"unknown step {s!r}")
    for s in STEPS:
        if s not in steps:
            continue
        # mapgen draws every built region at once, so `all` runs it once, after the last
        # region's simplify; every other step runs per region
        todo = regions[-1:] if s == "mapgen" else regions
        for region in todo:
            started = time.monotonic()
            print(f"== {s} {region.slug}", flush=True)
            run_step(s, region)
            print(f"   ({s} {region.slug}: {time.monotonic() - started:.0f}s)", flush=True)
    return 0


def run_step(s: str, region) -> None:
    if s == "fetch":
        from pipeline import fetch

        fetch.fetch(isos=set(region.countries))
    elif s == "crosswalk":
        from pipeline import crosswalk

        crosswalk.run(region)
    elif s == "shapes":
        from pipeline import shapes

        shapes.run(region)
    elif s == "simplify":
        from pipeline import simplify

        simplify.run(region)
    elif s == "mapgen":
        from pipeline import mapgen_step

        mapgen_step.run(region)
    elif s == "qa":
        from pipeline import qa

        qa.run(region)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
