// Headless runner (build-plan 2.1). Ported from crates/headless/src/main.rs.
//
// - `--check-data` (M0.9) loads every data table (and the assets/map files when there are any, M8),
//   prints the row counts and runs the load-time checks; a bad row exits non-zero with its file,
//   line and field (spec 10 M0).
// - `run` (M1.8, M1.9) runs each seed for N years through the `SimApi` only, prints the state hash
//   each month with `--hash-monthly`, and writes the soak's yearly metrics rows.
// - `soak` (M10.1) runs many seeds, each in its own worker thread (D333), and writes `years.csv`,
//   `quarters.csv` and `timing.csv`; `check` (M10.2, M10.3) marks every spec 10 target per seed
//   (docs/build/soak.md).
// - `parity DIR` (D951) compares a TS soak's output with the Rust reference in
//   test/fixtures/rust-reference.
// - `run --profile` (M10.6) prints the wall time per scheduler slot, job and view (D400).
// - `run --tick-costs` prints the wall time of whole steps by the kind of tick (D801).
// - `record` and `replay` (M10.4) write a run's seed, command log and monthly hashes, and replay
//   such a log checking every hash (D403).
//
// The sim is built only through a SimFactory (factory.ts), so these commands are testable with a
// stub and are wired to the real `simNew` in one place.
import { writeFileSync } from "node:fs";
import { check, type DataError, dataErrorToString, type WorldData, worldDataCounts } from "@tc20ff/sim-data";
import { defaultDataDir, defaultMapDir, loadMap, loadWorld } from "@tc20ff/sim-data/node";
import { parseRecord, parseReplay, parseRun, parseSoak, type RunArgs, USAGE, userPath } from "./args.ts";
import { defaultFactory, isObservedSim } from "./factory.ts";
import { type RunOptions, runSeed, type SimFactory, YEARS_HEADER } from "./metrics.ts";
import { parityCommand } from "./parity.ts";
import { Profiler, TickCosts } from "./profile.ts";
import { record, replay } from "./replay.ts";
import { soak, workerRunner } from "./soak.ts";
import { checkDir } from "./targets.ts";

/** Exit code 2 and the usage text (Rust `usage`). */
function usage(): number {
  console.error(USAGE);
  return 2;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Rust `report`: Ok is exit code 0, an error prints `error: ...` and exits 1. */
async function report(f: () => void | Promise<void>): Promise<number> {
  try {
    await f();
    return 0;
  } catch (e) {
    console.error(`error: ${messageOf(e)}`);
    return 1;
  }
}

/** Loads the data directory or throws its error text. */
function loadData(dir: string): WorldData {
  const r = loadWorld(dir);
  if (!r.ok) throw new Error(dataErrorToString(r.error));
  return r.value;
}

/** Rust `check_data_command`: parses the arguments of `--check-data`. */
function checkDataCommand(args: string[]): number {
  let checkData = false;
  let dir = defaultDataDir();
  let mapDir = defaultMapDir();
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--check-data":
        checkData = true;
        break;
      case "--data-dir": {
        const d = args[++i];
        if (d === undefined) return usage();
        dir = userPath(d);
        break;
      }
      case "--map-dir": {
        const d = args[++i];
        if (d === undefined) return usage();
        mapDir = userPath(d);
        break;
      }
      default:
        return usage();
    }
  }
  if (!checkData) return usage();
  return checkAll(dir, mapDir);
}

/** Rust `check`: loads the tables and the map assets and runs the load-time checks. */
function checkAll(dir: string, mapDir: string): number {
  const loaded = loadWorld(dir);
  if (!loaded.ok) {
    console.error(`error: ${dataErrorToString(loaded.error)}`);
    return 1;
  }
  const world: WorldData = loaded.value;
  console.log(`Loaded ${dir}`);
  for (const [name, n] of worldDataCounts(world)) {
    console.log(`  ${name.padEnd(18)} ${String(n).padStart(6)}`);
  }
  // The map assets (M8), checked when the folder has them: the CSVs, label points inside the
  // bitmap, the PNG sizes against map-meta.toml.
  const map = loadMap(mapDir);
  if (!map.ok) {
    console.error(`error: ${mapDir}: ${dataErrorToString(map.error)}`);
    return 1;
  }
  world.map = map.value;
  if (map.value !== null) {
    const m = map.value;
    console.log(
      `Loaded ${mapDir}: ${m.colors.rows.length} provinces, ${m.adjacency.rows.length} adjacencies, coverage ${m.meta.coverage.join(", ")}`,
    );
  } else {
    console.log(`No map assets in ${mapDir}`);
  }
  const errors: DataError[] = check(world);
  for (const e of errors) console.error(`error: ${dataErrorToString(e)}`);
  if (errors.length === 0) {
    // Step 2: the Rust also builds a `Sim` here (Sim::new(world, 0)) to prove the data starts;
    // do it through `defaultFactory` once simNew builds from the real data (lib.ts START_DEPS).
    console.log("OK");
    return 0;
  }
  console.error(`${errors.length} errors`);
  return 1;
}

/** Rust `run`: each seed in turn, in this thread, through the SimApi only. */
export function runCommand(args: RunArgs, factory: SimFactory): void {
  const data = loadData(args.dir);
  let csv = `${YEARS_HEADER}\n`;
  let allTicks = 0;
  const allStart = performance.now();
  for (let seed = args.seeds[0]; seed <= args.seeds[1]; seed++) {
    const profiler = args.profile ? new Profiler() : null;
    const costs = args.tickCosts && profiler === null ? new TickCosts() : null;
    const opts: RunOptions = { hashMonthly: args.hashMonthly };
    if (profiler !== null) {
      // `run --profile`: Sim::step_observed times each part (M10.6, D400).
      opts.stepper = (sim) => {
        if (!isObservedSim(sim)) throw new Error("--profile needs a sim with stepObserved()");
        const t = performance.now();
        const notices = sim.stepObserved(profiler);
        profiler.addStep(performance.now() - t);
        return notices;
      };
    } else if (costs !== null) {
      opts.onTick = (now, ms) => costs.add(now, ms);
    }
    const r = runSeed(factory, data, seed, args.years, opts);
    if (!r.ok) throw new Error(r.error);
    const out = r.value;
    console.log(`seed ${seed}: ${args.years} years to ${out.end}, hash ${out.state_hash}, ${out.wall_ms} ms`);
    if (profiler !== null) console.log(`profile, seed ${seed}:\n${profiler.table()}`);
    if (costs !== null) console.log(`tick costs, seed ${seed}:\n${costs.table()}`);
    csv += out.years;
    allTicks += out.ticks;
  }
  const secs = (performance.now() - allStart) / 1000;
  console.log(
    `${allTicks} ticks in ${(secs * 1000).toFixed(0)} ms: ${(allTicks / Math.max(secs, Number.MIN_VALUE)).toFixed(0)} ticks/s`,
  );
  if (args.out !== null) writeFileSync(args.out, csv);
}

/** The command line: argv without the node and script paths. Returns the exit code. */
export async function main(args: string[], factory: SimFactory = defaultFactory): Promise<number> {
  switch (args[0]) {
    case "run": {
      const a = parseRun(args.slice(1));
      return a === null ? usage() : report(() => runCommand(a, factory));
    }
    case "soak": {
      const p = parseSoak(args.slice(1));
      if (p === null) return usage();
      const [a, dir] = p;
      return report(async () => {
        await soak(workerRunner(), dir, a);
        if (a.check) checkDir(a.out);
      });
    }
    case "record": {
      const p = parseRecord(args.slice(1));
      if (p === null) return usage();
      const [seed, years, out, dir] = p;
      return report(() => {
        console.log(`recorded ${out}: ${record(factory, loadData(dir), seed, years, out)}`);
      });
    }
    case "replay": {
      const p = parseReplay(args.slice(1));
      if (p === null) return usage();
      const [log, dir] = p;
      return report(() => {
        console.log(`replay of ${log} matches: ${replay(factory, loadData(dir), log)}`);
      });
    }
    case "check": {
      const dir = args[1];
      return args.length === 2 && dir !== undefined ? report(() => checkDir(userPath(dir))) : usage();
    }
    case "parity":
      // Exit 1 when any target or yearly metric fails the parity gate (D951).
      return parityCommand(args.slice(1));
    default:
      return checkDataCommand(args);
  }
}
