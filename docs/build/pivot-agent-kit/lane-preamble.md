# Lane preamble for the TechnoCapital20FF pivot (read fully before starting)

You are one of several agents building one milestone of the pivot in parallel. Each agent works in its own git worktree and owns disjoint folders. An orchestrator reviews and merges your branch.

Setup
- Create your branch (named in your task). Your base is the tip of `claude/stock-market-prediction-game-7c4f97`: run `git merge claude/stock-market-prediction-game-7c4f97` first if your worktree is behind it (check `git log -1 claude/stock-market-prediction-game-7c4f97`). Note that tip's commit hash: it is your CHECK_FAST_BASE.
- Read: CLAUDE.md; docs/design/pivot/spec.md (the sections your task names, carefully); docs/build/pivot-lanes.md (rules, the contract-file list, "Pinned values"); the last ten rows of docs/build/decisions.md.
- Use `corepack pnpm@10.20.0 ...` if pnpm is not on PATH. Run `corepack pnpm@10.20.0 install --frozen-lockfile` once if node_modules is missing or stale (set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1).

Rules
- Edit only the folders your task says you own. Never edit a contract file (docs/build/pivot-lanes.md lists them; the contracts change of your milestone may have added more: your task names them) unless your task explicitly allows one named change. If you need a contract changed, do not change it: put a concrete proposal in your final report.
- Tests while iterating: only the test files you touched, by path: `CHECK_FAST_BASE=<base> bash scripts/check-fast.sh <path> [<path>...]` (or the .ps1 twin). Machine memory is limited and other agents are running.
- Anything heavy goes through the machine lock: `bash scripts/heavy.sh <command...>` (or `scripts/heavy.ps1`). Heavy means: a whole Vitest project or more, the auto-detected check-fast with no arguments, any sim run longer than a few seconds, any `*.slow.test.*` file, any Electron launch on the real sim, the e2e suites. Hold the lock only for the run itself. Do the auto-detected `CHECK_FAST_BASE=<base> bash scripts/heavy.sh bash scripts/check-fast.sh` once at the end. Never run the full gate `scripts/check-ts.*`.
- The owner is using this PC. Never launch the Electron app in a way that takes focus or comes to the front: always pass `--background` (apps/desktop/scripts/drive.ts and the e2e fixtures do it for you; never set TC_E2E_SHOW). Do not open other GUI windows. Do not start long-lived servers and leave them running; stop anything you start and check no stray node/electron processes from your worktree remain.
- Keep scratch, logs and downloads on D: inside your worktree in a git-ignored folder (`.claude/scratch/`). Never commit downloaded raw data or files over about 5 MB.
- Sim code follows the determinism rules in CLAUDE.md (seeded RNG via ctx.draws and the named streams, fixed iteration order, no Math.round/Math.random/Date/localeCompare, libm.ts for exp/log/sin/cos, num.ts for rounding) and cites spec sections in comments (`pivot N.N`). Tuning values are named constants with a comment; values marked (T) in the spec are yours to choose sensibly. Belief/media code never reads hidden state (pivot 11.5).
- The same seed must give the same results for anything your task does not intend to change. If you move the state hash or a pinned value, re-record only what docs/build/pivot-lanes.md "Pinned values" lists, in the same commit, and say why.
- Choices the spec leaves open: one row in docs/build/decisions.md using the decision number your task assigns you (so parallel lanes do not collide). Do not edit docs/design prose.
- Commit on your branch in logical commits (short imperative summary line; end each message with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`). Do not push, do not open a PR.

Final report (to the orchestrator; factual, no padding): branch and commits; what you built, as a short file list; what you verified and how (commands, results, measured numbers); pinned values re-recorded and why; decisions made; anything not done, not verified or failing, stated plainly; contract changes you need (concrete); bugs you found in files you do not own.
