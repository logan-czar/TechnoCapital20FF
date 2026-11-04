#!/usr/bin/env bash
# The drift plan's scenario matrix (phase B, lane S; D1025): volatility low, normal and high, each
# with the 2050 to 2080 slowdown off and on, under the `mature` profile (the drift fixes), plus the
# `legacy` economy before the fixes, for YEARS years on seeds 1..SEEDS, JOBS runs at a time. Then
# the drift report: OUT/drift.md and drift.json.
#
#   scripts/drift-matrix.sh OUT [YEARS=100] [SEEDS=3] [JOBS=2]
#
# Each run is one profile on one seed (about 6 minutes for 100 years); it uses about 1 GB.
set -euo pipefail
OUT=${1:?usage: drift-matrix.sh OUT [YEARS] [SEEDS] [JOBS]}
YEARS=${2:-100}
SEEDS=${3:-3}
JOBS=${4:-2}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
PROFILES=(legacy mature+vol-low mature+vol-normal mature+vol-high mature+slow+vol-low mature+slow+vol-normal mature+slow+vol-high)
mkdir -p "$OUT"
cd "$ROOT/apps/headless"
for p in "${PROFILES[@]}"; do
  for s in $(seq 1 "$SEEDS"); do echo "$p $s"; done
done | xargs -P "$JOBS" -L 1 sh -c \
  'corepack pnpm@10.20.0 exec tsx src/econ-report.ts run "$0" '"$YEARS"' "$1" "$1" '"\"$OUT\""' >> '"\"$OUT/runs.log\""' 2>&1'
corepack pnpm@10.20.0 exec tsx src/econ-report.ts drift "$OUT"
