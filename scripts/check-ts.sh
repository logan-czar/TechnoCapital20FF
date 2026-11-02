#!/usr/bin/env bash
# The local gate for TypeScript PRs (CLAUDE.md; there is no CI): typecheck, Biome, the sim
# boundary scan, Vitest, then the design data checks. Run from anywhere; uses pnpm via corepack.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm() { corepack pnpm@10.20.0 "$@"; }
PY=python3; command -v python3 >/dev/null 2>&1 || PY=python

step() { echo; echo "== $1"; }
step install;   pnpm install --frozen-lockfile --silent
step typecheck; pnpm exec tsc -b
step biome;     pnpm exec biome check .
step boundary;  node scripts/ts/boundary.ts
step test;      pnpm exec vitest run
step validate
root="$(pwd)"
out="$(cd docs/design/tools/mvp-data && "$PY" -B validate.py "$root/docs/design/data")"
echo "$out" | grep -E "^(ERROR|OK$|[0-9]+ errors)" || true
echo "$out" | grep -qx "OK"
step check-data; pnpm --filter @tc20ff/headless start --check-data --world 2020
step validate-1995
out="$("$PY" -B tools/world-1995/validate.py)"
echo "$out" | grep -E "^(ERROR|OK$|[0-9]+ errors)" || true
echo "$out" | grep -qx "OK"
step check-data-1995; pnpm --filter @tc20ff/headless start --check-data --world 1995
echo; echo "check-ts: all steps passed"
