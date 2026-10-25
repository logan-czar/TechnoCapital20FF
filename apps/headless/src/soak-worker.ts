// The soak's worker thread (D333, now a worker_threads Worker instead of a child process): runs one
// SeedTask and posts the SeedOutput (or the error text) back. Kept free of non-erasable TypeScript
// syntax so Node can run it directly (type stripping) as well as under tsx.
import { parentPort, workerData } from "node:worker_threads";
import type { SeedRunner, SeedTask } from "./soak.ts";

async function main(): Promise<void> {
  const { task, taskModule } = workerData as { task: SeedTask; taskModule: string | null };
  try {
    const mod = (await import(taskModule ?? new URL("./seed-task.ts", import.meta.url).href)) as {
      default: SeedRunner;
    };
    const output = await mod.default(task);
    parentPort?.postMessage({ ok: true, output });
  } catch (e) {
    parentPort?.postMessage({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

void main();
