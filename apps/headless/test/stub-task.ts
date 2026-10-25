// A SeedRunner module for the worker-thread test: returns synthetic rows for a seed, or throws
// for seed 13 (a failed seed). Plain erasable TypeScript, so a Worker can load it directly.
import type { SeedOutput, SeedTask } from "../src/soak.ts";

export default function stubTask(task: SeedTask): SeedOutput {
  if (task.seed === 13) throw new Error("boom");
  return {
    seed: task.seed,
    years: `${task.seed},2020\n`,
    quarters: `${task.seed},2020,1\n`,
    ticks: 8784,
    wall_ms: 10 + task.seed,
    state_hash: `hash${task.seed}`,
    end: "2021-01-01 00:00",
    max_shares_out: 1000 + task.seed,
    detail: null,
  };
}
