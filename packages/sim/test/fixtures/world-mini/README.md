# world-mini: the frozen test world

The world the sim and web tests run on when they need a world with no era (no scenario, no reveal): a start on 2020-01-01 with the scripted AI boom, the fixed startup events and Arrowhead.

It is a frozen test fixture. It is never regenerated, and no generator or validator writes to it. The pinned values (`packages/sim/test/results_pinned.slow.test.ts`, `packages/sim/test/golden/job-order-2020.txt`, `long_run.slow.test.ts`, `m1_contracts.test.ts`) were recorded on these bytes, so a change to any file here moves them.

## Where it came from

The 30 CSVs are the files the hand-built 2020 world loaded (`WORLD_FILES` in `packages/sim-data/src/world.ts`), copied from `docs/design/data/` at commit a5b060a; that folder last changed in eb89ce2 (2026-11-01, D980 to D988). Each CSV is the same git blob as its source, so `git ls-files -s` shows the same hash for both. `.gitattributes` here turns line-ending conversion off (`*.csv -text`), so a checkout on any machine has the committed bytes. Seven of the eight province files are committed with CRLF line endings (all but `provinces-east-asia-oceania.csv`) and every other file with LF, as in `docs/design/data/`.

The README and the `provinces-*-summary.md` notes of `docs/design/data/` are not copied: no code reads them.

`manifest.json` holds the values of `MANIFEST_2020` (`packages/sim-data/src/manifest.ts`), which the 2020 world had in code instead of a file. Its id stays `"2020"`: a save of a world with no era carries no world id, and `simLoadBytes` (`packages/sim/src/lib.ts`) reads such a save as world `"2020"` and refuses it in any other world.

## How tests reach it

`worldMini()` in `packages/sim/test/common/world_mini.ts` returns this folder and its parsed manifest; `apps/web/test/world-mini.ts` re-exports it. `loadWorld(worldMini().dir)` loads it.

The name is from the pivot plan. The world is full size (211 countries, 3,963 provinces, 651 companies), about 1.1 MB.
