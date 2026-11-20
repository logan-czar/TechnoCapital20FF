// The frozen test world (packages/sim/test/fixtures/world-mini/README.md): the hand-built 2020
// world's tables as the sim last loaded them, with its manifest as a file. The research tools
// (econ-report, debt-tournament, strategy-tournament) load it, so their reports stay comparable
// with the ones made on the 2020 world before it was removed (D1053 decision 7, D1055).

import { join } from "node:path";
import { repoRoot } from "@tc20ff/sim-data/node";

/** The frozen test world's folder, for `loadWorld` or `--data-dir`. */
export function worldMiniDir(): string {
  return join(repoRoot(), "packages", "sim", "test", "fixtures", "world-mini");
}
