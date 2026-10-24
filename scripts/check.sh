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
# The binaries that use sim, checked without test targets: sim's tests enable its `test-hooks`
# feature (raw world access), and a workspace build with tests unifies it into every crate. Each
# is checked in its own cargo run: together, cargo would unify headless's `soak-stats` feature
# into the game's sim too (D438).
bins=(headless game)
if [[ "${1:-}" == "--sim-only" ]]; then
    pkgs=(-p sim -p sim-data -p headless)
    bins=(headless)
fi

py=python3
command -v "$py" >/dev/null 2>&1 || py=python

step() { echo "== $*"; }

step fmt
cargo fmt --all --check
step clippy
cargo clippy "${pkgs[@]}" --all-targets -- -D warnings
# The spec 9 boundary: the binaries must build without sim's test-only API.
step boundary
for bin in "${bins[@]}"; do
    cargo check -p "$bin"
done
step test
# cargo-nextest runs the test binaries in parallel (cargo test runs them one at a time); it does
# not run doc tests, so those go through cargo test (D870). Without nextest, plain cargo test.
if cargo nextest --version >/dev/null 2>&1; then
    cargo nextest run "${pkgs[@]}" --no-fail-fast
    cargo test "${pkgs[@]}" --doc
else
    cargo test "${pkgs[@]}"
fi
step validate.py
out="$(cd docs/design/tools/mvp-data && "$py" -B validate.py "$root/docs/design/data")"
echo "$out" | grep -E "^(ERROR|OK$|[0-9]+ errors)" || true
echo "$out" | grep -qx "OK"
step check-data
cargo run --quiet -p headless -- --check-data
echo "== all checks passed"
