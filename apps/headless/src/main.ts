// Headless runner (build-plan 2.1). Ported from crates/headless/src/main.rs.
//
// - `--check-data` (M0.9) loads every data table (and the assets/map files when there are any, M8),
//   prints the row counts and runs the load-time checks; a bad row exits non-zero with its file,
//   line and field (spec 10 M0).
// - `run`, `soak`, `check`, `record` and `replay` are ported in Steps 2 to 4 (W5).

import { check, type DataError, dataErrorToString, type WorldData, worldDataCounts } from "@tc20ff/sim-data";
import { defaultDataDir, defaultMapDir, loadMap, loadWorld } from "@tc20ff/sim-data/node";

const USAGE = [
  "usage:",
  "  headless --check-data [--data-dir DIR] [--map-dir DIR]",
  "  (run, soak, check, record and replay are not ported yet)",
  "DIR defaults to the repository's docs/design/data (map: assets/map)",
].join("\n");

/** Exit code 2 and the usage text (Rust `usage`). */
function usage(): number {
  console.error(USAGE);
  return 2;
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
        dir = d;
        break;
      }
      case "--map-dir": {
        const d = args[++i];
        if (d === undefined) return usage();
        mapDir = d;
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
    // Step 2: the Rust also builds a `Sim` here (Sim::new(world, 0)) to prove the data starts.
    console.log("OK");
    return 0;
  }
  console.error(`${errors.length} errors`);
  return 1;
}

process.exitCode = checkDataCommand(process.argv.slice(2));
