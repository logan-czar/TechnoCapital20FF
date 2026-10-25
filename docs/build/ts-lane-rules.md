# TS port: rules for builder, tester and orchestrator lanes

_The working rules every agent lane follows (docs/build/ts-migration-plan.md, "Implementation plan"). Written for Step 1, extended for Step 2._

The game's deterministic economic sim is being ported from Rust (`crates/`) to TypeScript (a pnpm workspace). Before starting, read these:
- `CLAUDE.md`;
- `docs/build/ts-migration-plan.md`, the "Implementation plan" section;
- `docs/build/decisions.md`, rows D950 to D954.

## Where you work
- Work ONLY in your own worktree. Your first branch is already checked out from main, with dependencies installed. Make only the branches your brief and these rules call for, and never touch another worktree.
- Run pnpm as `corepack pnpm@10.20.0 ...`.
- Use gh at `"/c/Program Files/GitHub CLI/gh.exe"`.

## Contracts
- The contracts live in `packages/sim/src/types/`: types for World, state, views, controls, calendar, draws and protocol, plus the `num.ts` and `collections.ts` helpers.
- Import types from there; never redefine them or edit them.
- If a contract is wrong or missing something, do not edit it. Work around it locally with a `// CONTRACT:` comment, and list the change you need in your final report.

## Porting conventions
Mirror Rust exactly, so tests and other lanes line up without coordinating:
- **Paths:** `crates/<crate>/src/a/b.rs` becomes `packages/<crate>/src/a/b.ts`, and `mod.rs` becomes `index.ts`. The sim-data crate goes to `packages/sim-data`.
- **Free functions:** `pub fn foo_bar` becomes `export function fooBar`.
- **Methods and associated functions:** `Type::foo_bar(self, ...)` becomes a free function `typeFooBar(self, ...)`. Examples:
  - `World::from_data` becomes `worldFromData`.
  - `DateTime::midnight` becomes `dateTimeMidnight`.
  - Rust's `Date` type is named `SimDate`, so `Date::ymd` becomes `simDateYmd`.
- **Trait impls** become free functions as well.
- **Names:** constants keep their SCREAMING_SNAKE names; data fields are snake_case, exactly as in the contracts.
- **Errors:** an expected error (a load error, say) returns `Result<T, E>` from `types/world.ts`. A `panic!`, `expect` or `unwrap` on an invariant becomes a `throw`.
- **Numbers** (D952):
  - Never use `Math.round`, `Math.random`, `localeCompare` or `Date`.
  - Use the `num.ts` helpers wherever Rust uses `.round()`, `round_ties_even`, `as` casts, f64 `.max`/`.min`/`.clamp`, float sorts (`totalCmp`) or string order (`cmpStr`).
  - Assert share counts with `assertCount`.
  - Iterate BTreeMap and BTreeSet ports with `sortedEntries`/`sortedKeys`. Tables are arrays in id order. Ties go to the lower id (D2).
- **Comments:** keep every spec section and D-number comment from the Rust (CLAUDE.md: every formula cites its spec section), and match the Rust's comment density. Tuning values come from data tables or named constants.
- **Unit tests:** if a Rust file you port has an in-file `#[cfg(test)] mod tests`, port it to `packages/<crate>/test/<same path>.test.ts`.
- **Integration tests** (`crates/*/tests/`) are ported by the tester lane (W5) ahead of the code, into `packages/<pkg>/test/pending/` (excluded from typecheck and tests). When you port a module, promote its pending tests: `git mv` them up out of `pending/`, fix the relative import depth, and make them pass. If a pending test names a function differently from the conventions above, follow the conventions and fix the test. If a test is wrong against the Rust, fix it with a comment saying why. Never weaken an assertion silently.
- **Seams:** `packages/sim/src/jobs.ts` registers every Rust job with a `notPorted(...)` placeholder; when you port a job, swap its placeholder for the real function on the same line. `buildWorld` in `world/load.ts` takes the Step 2 load calls through `LoadDeps` (`UNPORTED_LOAD_DEPS`); when you port one of them, wire it into the default deps object and drop any constant copied there.

## Working across lanes (Step 2 on)
- The sim modules depend on each other (economy, ops and people form a cycle; finance, market, ai and births use them all). Port in this order within your modules: pure formula files first, then the `jobs.rs` glue.
- If a file needs a function or constant from a module another lane owns that is not on `origin/main` yet, skip that file for now. Port the next one, and come back after merging main. Never create a stub file at another lane's path.
- Ship in chunks: one PR per module (or small module group). When a chunk is ready, open its PR and message the orchestrator with `SendMessage` (to `main`), giving the PR URL. Then carry on with the next chunk on a new branch made from your current one (`git checkout -b build/ts2-<next>`).
- Before opening the next chunk's PR, run `git fetch origin && git merge origin/main`. If your previous chunk is not merged yet (check with `gh pr view <n> --json state`), do not open a stacked PR. Keep working, and message `main` that you are waiting.
- Merge `origin/main` into your branch often, because other lanes land modules you may need. Re-run the gate after every merge.
- Shared files (`jobs.ts`, `world/load.ts` deps, `src/index.ts`, `src/internal.ts`): edit only the lines for your own module, so merges stay clean.

## Dependencies and shared files
- Add a dependency only if you need it: `corepack pnpm@10.20.0 --filter <pkg> add -E <dep>`. Say so in your report; the orchestrator resolves lockfile conflicts.
- Do not edit root config (`package.json`, `tsconfig*.json`, `biome.json`, `vitest.config.ts`, `.gitattributes`) or `docs/build/decisions.md` unless your brief says so. List any decisions you make in your report, and the orchestrator logs them.

## Memory and CPU (Logan's PC)
- The full gate starts several Vitest workers, and each holds a whole simulated world. While iterating, run only the test files you touched (`corepack pnpm@10.20.0 exec vitest run <files>`); run `bash scripts/check-ts.sh` once, at the end.
- Reviewers run the gate once and only the affected tests otherwise. Never start a soak, a dev server or a second gate in parallel with another.
- Stop what you started: no dev servers or watchers left running when you finish.
- The orchestrator runs at most two agents at once (one builder and one reviewer).

## Finishing
- `bash scripts/check-ts.sh` must pass.
- Commit with a short imperative summary line, then the details, ending with `Co-Authored-By: Claude <your model, e.g. Sonnet 5.5> <noreply@anthropic.com>`.
- Push (`git push -u origin <branch>`) and open a PR against main. The PR body says what was ported, what is left, deviations and decisions, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do NOT merge.
- When your whole brief is done, your final report gives:
  - the PR URL;
  - what was ported and what is left;
  - the contract changes you need;
  - the decisions you made (spec or Rust ambiguity, with a proposed D-number-free wording);
  - your gate result.
