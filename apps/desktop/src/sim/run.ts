// A plain run of the sim, for the determinism check (pivot 16.1): the same seed stepped the same
// number of ticks must give the same state hash in headless Node and in the app's sim process.
// This is `headless run --hash-monthly`'s loop (apps/headless/src/metrics.ts `runSeed`) and nothing
// else, so the two can be compared line by line: it runs in the Electron utility process
// (entry.ts) and, bundled the same way, in plain Node (run-node.ts).

import { dateTimeDate, dateTimeMidnight, formatMonth, simDateYmd, simNew } from "@tc20ff/sim";
import { loadWorldData } from "@tc20ff/sim-host/node";
import type { RunReport, RunRequest } from "../shared.ts";

export async function runYears(req: RunRequest): Promise<RunReport> {
  const data = await loadWorldData(req.world, { world: req.worldDir, map: req.mapDir });
  const start = performance.now();
  const made = simNew(data, req.seed, req.scenario === null ? {} : { scenario: req.scenario });
  if (!made.ok) throw new Error(`new game: ${JSON.stringify(made.error)}`);
  const sim = made.value;
  const end = dateTimeMidnight(simDateYmd(dateTimeDate(sim.now()).year + req.years, 1, 1));
  const monthly: RunReport["monthly"] = [];
  let ticks = 0;
  while (sim.now() < end) {
    ticks += 1;
    for (const n of sim.step()) {
      if (n.kind === "MonthDone") monthly.push({ month: formatMonth(n.month), hash: sim.stateHash() });
    }
  }
  return {
    seed: req.seed,
    years: req.years,
    ticks,
    end: sim.now(),
    monthly,
    hash: sim.stateHash(),
    wall_ms: Math.trunc(performance.now() - start),
    versions: {
      node: process.versions.node,
      v8: process.versions.v8,
      electron: process.versions.electron ?? null,
    },
  };
}
