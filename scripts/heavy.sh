#!/usr/bin/env bash
# Runs a command while holding the machine-wide lock for heavy work (a whole Vitest project, a sim
# run of more than a few seconds, anything that launches the real sim), so only one such job runs
# at a time however many agents and worktrees there are.
#
#   scripts/heavy.sh <command> [args...]
#   scripts/heavy.sh corepack pnpm@10.20.0 e2e
#
# The lock is a directory, made with mkdir (which either makes it or fails, never both for two
# callers): .claude/scratch/heavy.lock under the MAIN repository's root, whichever worktree this is
# run from. Its `owner` file says who holds it. While it is held this waits and says so. It is
# removed when the command ends, however it ends (failure, Ctrl+C, a kill signal). A lock nobody has
# touched for two hours is taken to be left over from a crash and is removed with a warning; this
# script touches its own lock every minute, so a long job is not mistaken for one.
#
#   HEAVY_LOCK_DIR             the lock directory (default: as above)
#   HEAVY_LOCK_STALE_SECONDS   age at which a lock is stale (default 7200)
#   HEAVY_LOCK_POLL_SECONDS    how often a waiter looks again (default 15)
#   HEAVY_LOCK_TIMEOUT_SECONDS give up waiting after this long, exit 75 (default 0: never)
#   HEAVY_LOCK_HELD=1          set for the command; under it a nested heavy.sh just runs its command
#
# The exit code is the command's. scripts/heavy.ps1 is the same thing for PowerShell.
set -u

if [ $# -eq 0 ]; then
  echo "usage: scripts/heavy.sh <command> [args...]" >&2
  exit 2
fi
# Already inside a heavy run (this script's own child): the lock is ours, do not wait for ourselves.
if [ "${HEAVY_LOCK_HELD:-}" = "1" ]; then exec "$@"; fi

lock="${HEAVY_LOCK_DIR:-}"
if [ -z "$lock" ]; then
  # The main repository's .git, even from a worktree; its parent is the main root.
  common="$(git -C "$(dirname "$0")" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
  if [ -z "$common" ]; then
    echo "heavy: not in a git repository; set HEAVY_LOCK_DIR" >&2
    exit 2
  fi
  lock="$(dirname "$common")/.claude/scratch/heavy.lock"
fi
stale="${HEAVY_LOCK_STALE_SECONDS:-7200}"
poll="${HEAVY_LOCK_POLL_SECONDS:-15}"
limit="${HEAVY_LOCK_TIMEOUT_SECONDS:-0}"
token="$$-$(date +%s)-$RANDOM"

mkdir -p "$(dirname "$lock")"

# The lock's age in seconds (0 when it has just gone).
age() {
  local m
  m="$(stat -c %Y "$lock" 2>/dev/null || stat -f %m "$lock" 2>/dev/null)" || { echo 0; return; }
  echo $(( $(date +%s) - m ))
}

held=0
beat=""
release() {
  if [ -n "$beat" ]; then kill "$beat" 2>/dev/null; wait "$beat" 2>/dev/null; beat=""; fi
  # Only our own lock: if it was taken from us as stale, the directory there now is someone else's.
  if [ "$held" = "1" ] && [ "$(head -n 1 "$lock/owner" 2>/dev/null)" = "$token" ]; then
    rm -rf "$lock"
  fi
  held=0
}
trap release EXIT
trap 'release; exit 130' INT
trap 'release; exit 143' TERM HUP

waited=0
said=0
while ! mkdir "$lock" 2>/dev/null; do
  a="$(age)"
  if [ "$a" -ge "$stale" ]; then
    was="$(cat "$lock/owner" 2>/dev/null | tr '\n' ' ')"
    echo "heavy: WARNING: the lock $lock is $a s old (stale after $stale s); removing it. It held: ${was:-no owner file}" >&2
    # Renamed away first, so of two waiters that both see it stale only one removes it.
    if mv "$lock" "$lock.stale.$token" 2>/dev/null; then rm -rf "$lock.stale.$token"; fi
    continue
  fi
  if [ "$limit" -gt 0 ] && [ "$waited" -ge "$limit" ]; then
    echo "heavy: gave up after $waited s waiting for $lock" >&2
    exit 75
  fi
  # Said when the wait starts and then once a minute.
  if [ "$said" = "0" ] || [ $(( waited / 60 )) -gt $(( (waited - poll) / 60 )) ]; then
    echo "heavy: waiting for the machine lock $lock (held $a s by: $(sed -n 2,4p "$lock/owner" 2>/dev/null | tr '\n' ' '); waited $waited s)" >&2
    said=1
  fi
  sleep "$poll"
  waited=$(( waited + poll ))
done
held=1
printf '%s\npid %s on %s\nsince %s\n%s\n' "$token" "$$" "$(hostname)" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >"$lock/owner"
if [ "$said" = "1" ]; then echo "heavy: got the lock after $waited s" >&2; fi

# Keeps the lock fresh while the command runs; stops by itself if this script is killed outright.
# It holds none of this script's output, so a pipe reading that output closes when the command ends.
(
  while sleep 60; do
    kill -0 $$ 2>/dev/null || exit 0
    [ "$(head -n 1 "$lock/owner" 2>/dev/null)" = "$token" ] || exit 0
    touch "$lock" 2>/dev/null
  done
) </dev/null >/dev/null 2>&1 &
beat=$!

HEAVY_LOCK_HELD=1 "$@"
code=$?
release
exit $code
