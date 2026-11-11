#!/usr/bin/env bash
# Bakes the pre-simulated 2020 starts that ship with the game (pivot 3.5; D1035) into
# assets/starts/: one save per seed and index.json. The saves are tens of MB each and git-ignored;
# only this script and index.template.json are checked in. Re-run it after any change that moves
# the state hash or SAVE_VERSION (pivot 16.2 "re-baked starts").
#
#   scripts/bake-starts.sh [OUT=assets/starts] [SEEDS="1 2 3"]
#
# One seed at a time: each bake takes about a minute and 1.5 to 2 GB.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-$ROOT/assets/starts}
SEEDS=${2:-"1 2 3"}
case "$OUT" in /* | ?:*) ;; *) OUT="$PWD/$OUT" ;; esac
mkdir -p "$OUT"
[ -f "$OUT/index.json" ] || cp "$ROOT/assets/starts/index.template.json" "$OUT/index.json"
cd "$ROOT/apps/headless"
for s in $SEEDS; do
  corepack pnpm@10.20.0 exec tsx src/main.ts bake --seed "$s" --out "$OUT"
done
