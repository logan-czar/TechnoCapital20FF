#!/usr/bin/env bash
# Refresh docs/design from the shared design folder, then run both data checkers: the Python
# validator and the Rust sim-data checks (build-plan M0.7, 2.3).
#
#   scripts/sync-design.sh [design folder]     (default /mnt/project-files/design)
set -euo pipefail

src="${1:-/mnt/project-files/design}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dst="$root/docs/design"

if [[ ! -f "$src/mvp/mvp-spec.md" ]]; then
    echo "sync-design: $src does not look like the design folder" >&2
    exit 1
fi

rm -rf "$dst"
cp -r "$src" "$dst"
find "$dst" -name __pycache__ -type d -prune -exec rm -rf {} +
echo "sync-design: copied $src to docs/design"

(cd "$dst/tools/mvp-data" && python3 -B validate.py "$dst/data" | grep -E "^(ERROR|OK$|[0-9]+ errors)")
(cd "$root" && cargo run --quiet -p headless -- --check-data --data-dir "$dst/data")
