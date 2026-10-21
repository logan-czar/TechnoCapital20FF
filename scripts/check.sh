#!/usr/bin/env bash
# The local gate run before every PR (there is no CI; CLAUDE.md). Runs fmt, clippy, tests, the
# Python data validator and the Rust data check, and stops at the first failure.
#
#   scripts/check.sh            full workspace (compiles Bevy for the game crate)
#   scripts/check.sh --sim-only sim, sim-data and headless only (no Bevy compile)
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

pkgs=(--workspace)
if [[ "${1:-}" == "--sim-only" ]]; then
    pkgs=(-p sim -p sim-data -p headless)
fi

py=python3
command -v "$py" >/dev/null 2>&1 || py=python

step() { echo "== $*"; }

step fmt
cargo fmt --all --check
step clippy
cargo clippy "${pkgs[@]}" --all-targets -- -D warnings
step test
cargo test "${pkgs[@]}"
step validate.py
out="$(cd docs/design/tools/mvp-data && "$py" -B validate.py "$root/docs/design/data")"
echo "$out" | grep -E "^(ERROR|OK$|[0-9]+ errors)" || true
echo "$out" | grep -qx "OK"
step check-data
cargo run --quiet -p headless -- --check-data
echo "== all checks passed"
