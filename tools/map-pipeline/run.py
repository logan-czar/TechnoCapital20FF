"""Entry point for the province map pipeline. See README.md.

    uv run python run.py --region north-america          # the whole pipeline, P1 to P8
    uv run python run.py --region north-america --steps crosswalk,shapes
    uv run python run.py pin --iso USA CAN MEX           # re-pin sources.toml
"""

from __future__ import annotations

import argparse
import sys

STEPS = ["fetch", "crosswalk", "shapes", "simplify", "mapgen", "qa"]


def main(argv: list[str]) -> int:
    if argv and argv[0] == "pin":
        p = argparse.ArgumentParser(prog="run.py pin")
        p.add_argument("--iso", nargs="+", required=True)
        p.add_argument("--levels", nargs="+", default=["ADM2", "ADM3"])
        a = p.parse_args(argv[1:])
        from pipeline import fetch

        fetch.pin(a.iso, a.levels)
        return 0
    if argv and argv[0] == "selftest":
        import runpy

        runpy.run_module("pipeline.licenses", run_name="__main__")
        runpy.run_module("pipeline.text", run_name="__main__")
        return 0

    p = argparse.ArgumentParser(prog="run.py")
    p.add_argument("--region", required=True, help="region slug, e.g. north-america")
    p.add_argument("--steps", default=",".join(STEPS), help=f"comma list from {STEPS}")
    a = p.parse_args(argv)
    from pipeline import config

    if a.region not in config.REGIONS:
        p.error(f"unknown region {a.region!r}; known: {sorted(config.REGIONS)}")
    region = config.REGIONS[a.region]
    steps = [s.strip() for s in a.steps.split(",") if s.strip()]
    for s in steps:
        if s not in STEPS:
            p.error(f"unknown step {s!r}")
    for s in STEPS:
        if s not in steps:
            continue
        print(f"== {s}", flush=True)
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
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
