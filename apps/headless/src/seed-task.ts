// What a soak worker runs for one seed (Rust `soak::soak_seed`): load the data, run the seed
// through the default sim factory, return its rows. The default export is a SeedRunner.
import { dataErrorToString } from "@tc20ff/sim-data";
import { loadWorld } from "@tc20ff/sim-data/node";
import { DetailRecorder } from "./detail.ts";
import { defaultFactory } from "./factory.ts";
import { runSeed } from "./metrics.ts";
import type { SeedOutput, SeedTask } from "./soak.ts";

export default function seedTask(task: SeedTask): Promise<SeedOutput> {
  const data = loadWorld(task.dataDir);
  if (!data.ok) return Promise.reject(new Error(dataErrorToString(data.error)));
  const r = runSeed(defaultFactory, data.value, task.seed, task.years, {
    detail: task.detail ? new DetailRecorder(task.seed) : null,
  });
  return r.ok ? Promise.resolve(r.value) : Promise.reject(new Error(r.error));
}
