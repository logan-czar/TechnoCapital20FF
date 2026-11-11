// `run.ts` as a plain Node program: `node dist/sim/run-node.mjs '<RunRequest json>'` prints the
// RunReport as JSON. scripts/determinism.ts runs it beside the same run in the Electron utility
// process, so the only difference between the two is the engine (pivot 16.1; D1015).

import type { RunRequest } from "../shared.ts";
import { runYears } from "./run.ts";

const arg = process.argv[2];
if (arg === undefined) {
  console.error("usage: run-node.mjs '<RunRequest json>'");
  process.exit(2);
}
runYears(JSON.parse(arg) as RunRequest).then(
  (report) => {
    console.log(JSON.stringify(report));
  },
  (e: unknown) => {
    console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    process.exit(1);
  },
);
