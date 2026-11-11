#!/usr/bin/env bash
# merge-lane.sh <branch>: merge a lane branch into the branch checked out here (the orchestrator's
# worktree) and print any conflicts. docs/build/decisions.md merges by union (.gitattributes), so
# parallel lanes' rows no longer conflict; contract tests that several lanes edit still can.
cd "$(git rev-parse --show-toplevel)" || exit 1
git merge --no-ff -m "Merge $1" "$1" 2>&1 | grep -E "CONFLICT|Automatic merge failed|Already up to date"
git status --short | grep -E '^(UU|AA|DU|UD|U.|.U)' && exit 1
git log --oneline -1
