#!/usr/bin/env bash
# Moves finished pending tests up out of test/pending, once the modules they import exist.
#   test/pending/promote.sh [file ...]     (paths relative to test/pending; default: everything)
# A file directly in pending moves to test/ and a file in a pending subfolder (common/,
# finance_common/) to test/<subfolder>/; relative imports of ../src are re-pointed one level up.
# Run it from packages/sim or packages/sim-data. Review with git diff, then run the gate.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
test_dir="$(dirname "$here")"
cd "$here"
files=("$@")
if [ ${#files[@]} -eq 0 ]; then mapfile -t files < <(find . -type f \( -name '*.ts' \) | sed 's|^\./||' | sort); fi
for f in "${files[@]}"; do
  dest="$test_dir/$f"
  mkdir -p "$(dirname "$dest")"
  git mv "$f" "$dest"
  case "$f" in
    */*) sed -i 's|"\.\./\.\./\.\./src/|"../../src/|g' "$dest" ;;
    *)   sed -i 's|"\.\./\.\./src/|"../src/|g' "$dest" ;;
  esac
done
echo "moved ${#files[@]} file(s); run: bash scripts/check-ts.sh"
