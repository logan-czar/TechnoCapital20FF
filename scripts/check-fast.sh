#!/usr/bin/env bash
# The fast per-change check: what a build agent runs after each change. It is NOT the gate; run
# scripts/check-ts.sh before a PR. It looks at what changed since the merge-base with main
# (committed, uncommitted and untracked) and runs only: install (if a lockfile or package.json
# changed), incremental tsc -b, Biome on the changed files, the sim boundary scan, Vitest for the
# projects the change can reach (without the *.slow.test.* files), and the data checks of a world
# whose data or generator changed.
#
#   scripts/check-fast.sh                     detect from git
#   scripts/check-fast.sh sim web             these Vitest projects (sim-data sim sim-host headless web desktop mapgen)
#   scripts/check-fast.sh packages/sim/test/rng.test.ts    these test files (slow ones included)
#   scripts/check-fast.sh all                 every project
#   scripts/check-fast.sh none                no tests
#   CHECK_FAST_BASE=<commit>                  compare with this commit instead of the merge-base
set -euo pipefail
cd "$(dirname "$0")/.."
start=$(date +%s)

pnpm() { corepack pnpm@10.20.0 "$@"; }
PY=python3; command -v python3 >/dev/null 2>&1 || PY=python
step() { echo; echo "== $1"; }
skip() { echo; echo "== $1 (skipped: $2)"; }

ALL_PROJECTS="sim-data sim sim-host headless web desktop mapgen"
MAX_BIOME_FILES=200 # past this the command line gets long; check the whole tree instead

base="${CHECK_FAST_BASE:-$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null || true)}"
if [ -n "$base" ]; then
  changed="$( (git diff --name-only "$base"; git ls-files --others --exclude-standard) | sort -u)"
else
  echo "check-fast: no merge-base with main; treating everything as changed"
  changed="package.json"
fi
has() { echo "$changed" | grep -qE "$1"; }

# Which Vitest projects a path can reach: a package and everything that depends on it
# (sim-data <- sim <- sim-host <- web, desktop; sim <- headless; mapgen stands alone). World data, map data and the soak
# fixtures are read by tests in every project; the root configs steer them all.
projects=""
add() { for p in "$@"; do case " $projects " in *" $p "*) ;; *) projects="$projects $p" ;; esac; done; }
if has '^packages/sim-data/'; then add sim-data sim sim-host headless web desktop; fi
if has '^packages/sim/'; then add sim sim-host headless web; fi
if has '^packages/sim-host/'; then add sim-host web desktop; fi
if has '^apps/headless/'; then add headless; fi
if has '^apps/web/'; then add web; fi
if has '^apps/desktop/'; then add desktop; fi
if has '^apps/mapgen/'; then add mapgen; fi
if has '^(assets/|docs/design/data/|test/fixtures/)'; then add $ALL_PROJECTS; fi
if has '^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|vitest\.config\.ts|tsconfig[^/]*\.json)$'; then
  add $ALL_PROJECTS
fi

# Arguments override the detection: project names, test paths, `all` or `none`.
paths=()
if [ $# -gt 0 ]; then
  projects=""
  for a in "$@"; do
    case "$a" in
      all) add $ALL_PROJECTS ;;
      none) ;;
      sim-data|sim|sim-host|headless|web|desktop|mapgen) add "$a" ;;
      *) paths+=("$a") ;;
    esac
  done
fi

if [ ! -d node_modules ] || has '(^|/)package\.json$|^pnpm-lock\.yaml$|^pnpm-workspace\.yaml$'; then
  step install; pnpm install --frozen-lockfile --silent
else
  skip install "no lockfile or package.json change"
fi

step typecheck; pnpm exec tsc -b

biome_files=()
while IFS= read -r f; do
  if [ -n "$f" ] && [ -f "$f" ]; then biome_files+=("$f"); fi
done <<<"$changed"
if has '^biome\.json$' || [ ${#biome_files[@]} -gt $MAX_BIOME_FILES ]; then
  step biome; pnpm exec biome check .
elif [ ${#biome_files[@]} -gt 0 ]; then
  step "biome (${#biome_files[@]} changed files)"
  pnpm exec biome check --no-errors-on-unmatched "${biome_files[@]}"
else
  skip biome "no changed files"
fi

step boundary; node scripts/ts/boundary.ts

if [ ${#paths[@]} -gt 0 ]; then
  # Named test files run as given, slow or not.
  args=()
  for p in $projects; do args+=(--project "$p"); done
  step "test (${paths[*]})"; pnpm exec vitest run ${args[@]+"${args[@]}"} "${paths[@]}"
elif [ -n "$projects" ]; then
  args=()
  for p in $projects; do args+=(--project "$p"); done
  step "test ($(echo $projects), no slow files)"
  # Each project's vitest.config.ts reads this (a --exclude flag loses to a project's own exclude).
  CHECK_FAST_SKIP_SLOW=1 pnpm exec vitest run "${args[@]}"
else
  skip test "no project touched"
fi

if has '^docs/design/(data|tools/mvp-data)/'; then
  step validate
  root="$(pwd)"
  out="$(cd docs/design/tools/mvp-data && "$PY" -B validate.py "$root/docs/design/data")"
  echo "$out" | grep -E "^(ERROR|OK$|[0-9]+ errors)" || true
  echo "$out" | grep -qx "OK"
  step check-data; pnpm --filter @tc20ff/headless start --check-data --world 2020
else
  skip validate "2020 world data unchanged"
fi
if has '^(assets/worlds/|tools/world-1995/)'; then
  step validate-1995
  out="$("$PY" -B tools/world-1995/validate.py)"
  echo "$out" | grep -E "^(ERROR|OK$|[0-9]+ errors)" || true
  echo "$out" | grep -qx "OK"
  step check-data-1995; pnpm --filter @tc20ff/headless start --check-data --world 1995
else
  skip validate-1995 "assets/worlds and tools/world-1995 unchanged"
fi

echo; echo "check-fast: all steps passed in $(( $(date +%s) - start )) s (not the gate: run scripts/check-ts.sh before a PR)"
