#!/usr/bin/env bash
# Runs the province map pipeline end to end for one region file (see README.md).
#   tools/map-pipeline/run.sh [region] [steps]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
region="${1:-north-america}"
uv sync --frozen
[[ -d node_modules/mapshaper ]] || npm ci
if [[ -n "${2:-}" ]]; then
    uv run python run.py --region "$region" --steps "$2"
else
    uv run python run.py --region "$region"
fi
