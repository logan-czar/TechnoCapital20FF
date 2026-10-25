// `headless soak` (build-plan M10.1, 4.4): many seeds, each its own single-threaded Sim in its own
// Node worker thread (`soak-worker.ts`; Rust used child processes, D333), written in seed order
// so the same seed range gives byte-identical `years.csv` and `quarters.csv` whatever the job
// count. Wall time goes to `timing.csv` only. Ported from crates/headless/src/soak.rs.
//
// Deviations from the Rust: a worker posts its SeedOutput (detail tables included) back as a
// message, so there is no `soak-seed` subcommand, stdout section markers or `detail-parts`
// folder; the parent joins the detail tables itself.
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { FILES as DETAIL_FILES, type Detail, detailParts } from "./detail.ts";
import {
  type SeedOutput as MetricsSeedOutput,
  QUARTERS_HEADER,
  sharesOutCsv,
  YEARS_HEADER,
} from "./metrics.ts";

/** Build-plan 4.4: "2020 to 2050 over 50 seeds (T)": the defaults when `--years` or `--seeds` is not given. */
export const DEFAULT_YEARS = 30;
export const DEFAULT_SEEDS: readonly [number, number] = [1, 50];

/**
 * The `timing.csv` header: one row per seed, wall time of the seed's run (from the sim's
 * construction to its last tick) and per simulated year.
 */
export const TIMING_HEADER = "seed,years,ticks,wall_ms,ms_per_year";

export interface SoakArgs {
  years: number;
  seeds: readonly [number, number];
  /** Seeds run at once (worker threads); null is half the machine's cores (it is shared), at least 1. */
  jobs: number | null;
  out: string;
  /** Run the target checker on the output afterwards (`--check`). */
  check: boolean;
  /** Also write the read-only detail tables (`--detail`, D900): industries.csv, companies.csv, world.csv and zones.csv. */
  detail: boolean;
}

/** One seed's rows with the detail tables of `--detail` (D900). */
export type SeedOutput = MetricsSeedOutput<Detail>;

/** What one worker is asked to run. */
export interface SeedTask {
  dataDir: string;
  seed: number;
  years: number;
  detail: boolean;
}

/** Runs one seed to completion (a worker thread, or a stub in tests); rejects with the seed's error. */
export type SeedRunner = (task: SeedTask) => Promise<SeedOutput>;

/** The default worker count: half the available cores, at least 1. */
export function defaultJobs(): number {
  return Math.max(Math.floor(availableParallelism() / 2), 1);
}

/**
 * A SeedRunner that runs each seed in its own worker thread. `taskModule` (a file URL or path)
 * names the module whose default export runs a SeedTask; the default is `seed-task.ts`, which
 * loads the data and builds the sim through the default factory.
 */
export function workerRunner(taskModule?: string): SeedRunner {
  const workerUrl = new URL("./soak-worker.ts", import.meta.url);
  return (task) =>
    new Promise<SeedOutput>((resolve, reject) => {
      const worker = new Worker(workerUrl, { workerData: { task, taskModule: taskModule ?? null } });
      let settled = false;
      worker.once("message", (m: { ok: true; output: SeedOutput } | { ok: false; error: string }) => {
        settled = true;
        if (m.ok) resolve(m.output);
        else reject(new Error(m.error));
      });
      worker.once("error", (e) => {
        if (!settled) {
          settled = true;
          reject(e);
        }
      });
      worker.once("exit", (code) => {
        if (!settled) {
          settled = true;
          reject(new Error(`worker exited with code ${code}`));
        }
      });
    });
}

/** The error text of a failed seed. */
function errorText(seed: number, e: unknown): string {
  return `seed ${seed}: ${e instanceof Error ? e.message : String(e)}`;
}

/**
 * Runs every seed of `seeds` for `years` years, `jobs` at a time; returns each seed's output or
 * error, in seed order.
 */
export async function runSeeds(
  run: SeedRunner,
  dataDir: string,
  seeds: readonly [number, number],
  years: number,
  jobs: number,
  detail: boolean,
  log: (line: string) => void = console.log,
): Promise<({ ok: true; value: SeedOutput } | { ok: false; error: string })[]> {
  const list: number[] = [];
  for (let s = seeds[0]; s <= seeds[1]; s++) list.push(s);
  const workers = Math.min(Math.max(jobs, 1), Math.max(list.length, 1));
  const slots: ({ ok: true; value: SeedOutput } | { ok: false; error: string })[] = [];
  let next = 0;
  const lane = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      const seed = list[i];
      if (seed === undefined) return;
      try {
        const o = await run({ dataDir, seed, years, detail });
        log(`seed ${seed}: ${years} years to ${o.end}, hash ${o.state_hash}, ${o.wall_ms} ms`);
        slots[i] = { ok: true, value: o };
      } catch (e) {
        slots[i] = { ok: false, error: errorText(seed, e) };
      }
    }
  };
  await Promise.all(Array.from({ length: workers }, lane));
  return slots;
}

/** The seeds that ran, in seed order, and an error naming every seed that failed (null if all ran). */
export function splitFailures(
  results: readonly ({ ok: true; value: SeedOutput } | { ok: false; error: string })[],
): [SeedOutput[], string | null] {
  const done: SeedOutput[] = [];
  const failed: string[] = [];
  for (const r of results) {
    if (r.ok) done.push(r.value);
    else failed.push(r.error);
  }
  const error =
    failed.length > 0
      ? `${failed.length} of ${results.length} seeds failed (the others' rows are written):\n  ${failed.join("\n  ")}`
      : null;
  return [done, error];
}

/** The three files from the outputs (in seed order). */
export function timingRow(o: SeedOutput, years: number): string {
  return `${o.seed},${years},${o.ticks},${o.wall_ms},${(o.wall_ms / Math.max(years, 1)).toFixed(0)}`;
}

/** The text of years.csv, quarters.csv and timing.csv for the outputs (in seed order). */
export function outputTexts(
  outputs: readonly SeedOutput[],
  years: number,
): [years: string, quarters: string, timing: string] {
  let y = `${YEARS_HEADER}\n`;
  let q = `${QUARTERS_HEADER}\n`;
  let t = `${TIMING_HEADER}\n`;
  for (const o of outputs) {
    y += o.years;
    q += o.quarters;
    t += `${timingRow(o, years)}\n`;
  }
  return [y, q, t];
}

/** Writes years.csv, quarters.csv and timing.csv to `dir`. */
export function writeOutputs(dir: string, outputs: readonly SeedOutput[], years: number): void {
  mkdirSync(dir, { recursive: true });
  const [y, q, t] = outputTexts(outputs, years);
  writeFileSync(join(dir, "years.csv"), y);
  writeFileSync(join(dir, "quarters.csv"), q);
  writeFileSync(join(dir, "timing.csv"), t);
  // Not a Rust file: the largest share count per seed, for `headless parity` (D951).
  writeFileSync(join(dir, "shares_out.csv"), sharesOutCsv(outputs));
}

/** Joins the seeds' detail tables in seed order under their headers (D900) and writes them. */
export function writeDetail(dir: string, outputs: readonly SeedOutput[]): void {
  DETAIL_FILES.forEach(([name, header], k) => {
    let text = `${header}\n`;
    for (const o of outputs) {
      if (o.detail !== null) text += detailParts(o.detail)[k] ?? "";
    }
    writeFileSync(join(dir, name), text);
  });
}

/**
 * `soak`: runs, writes the three files and prints the timing. If a seed fails, the seeds that ran
 * are still written, and the error lists every failed seed (thrown after the write).
 */
export async function soak(run: SeedRunner, dataDir: string, args: SoakArgs): Promise<void> {
  const jobs = args.jobs ?? defaultJobs();
  const n = args.seeds[1] - args.seeds[0] + 1;
  console.log(`soak: seeds ${args.seeds[0]}..${args.seeds[1]} (${n}), ${args.years} years, ${jobs} jobs`);
  const start = performance.now();
  const [outputs, failed] = splitFailures(
    await runSeeds(run, dataDir, args.seeds, args.years, jobs, args.detail),
  );
  const wall = (performance.now() - start) / 1000;
  writeOutputs(args.out, outputs, args.years);
  if (args.detail) writeDetail(args.out, outputs);
  const ms = outputs.map((o) => o.wall_ms).sort((a, b) => a - b);
  const lo = ms[0];
  const hi = ms.at(-1);
  if (lo !== undefined && hi !== undefined) {
    const ticks = outputs.reduce((s, o) => s + o.ticks, 0);
    console.log(
      `${outputs.length} seeds in ${wall.toFixed(1)} s wall (${jobs} jobs); per seed min ${lo} ms, median ${ms[Math.floor(ms.length / 2)]} ms, max ${hi} ms; ${ticks} ticks; wrote ${args.out}`,
    );
  }
  if (failed !== null) throw new Error(failed);
}
