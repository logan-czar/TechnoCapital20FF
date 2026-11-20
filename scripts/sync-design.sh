#!/usr/bin/env bash
# Refresh docs/design from the shared design folder (build-plan M0.7, 2.3). The design folder may
# still carry the hand-built 2020 world's data and its generator (data/, tools/mvp-data/); the
# repository keeps those rows as the 1995 generator's input in tools/world-1995/source/ instead, so
# they are not copied (D1055). Then the 1995 world's checks run.
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
rm -rf "$dst/data" "$dst/tools/mvp-data"
find "$dst" -name __pycache__ -type d -prune -exec rm -rf {} +
echo "sync-design: copied $src to docs/design (without data/ and tools/mvp-data/)"

(cd "$root" && python3 -B tools/world-1995/validate.py | grep -E "^(ERROR|OK$|[0-9]+ errors)")
(cd "$root" && corepack pnpm@10.20.0 --filter @tc20ff/headless start --check-data --world 1995)
