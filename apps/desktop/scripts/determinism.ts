// `pnpm --filter @tc20ff/desktop determinism [--years N] [--seed S] [--world ID] [--scenario ID]`:
// the same seed stepped the same number of ticks must give the same state hash in headless Node
// and in the app (pivot 16.1). D1015 found Chrome's and Node's V8 differing in Math.exp and its
// kin; the app's sim process is Node, but built on Electron's V8, so this checks it rather than
// assuming it. Three runs of one seed for N years (1 by default), each printing the state hash at
// every month close and at the end:
//   1. `headless run --hash-monthly` (apps/headless, under this machine's Node);
//   2. apps/desktop's own run loop (src/sim/run.ts) bundled and run under this machine's Node;
//   3. the same bundle in the Electron utility process (`electron . --run=<out>`).
// 2 and 3 differ only in the engine; 1 and 2 only in the code around the sim. Exits 0 when every
// hash agrees. A year of the 1995 world is heavy: take the machine lock before running it.
// Run `desktop:build` first.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { distDir, repoDir, run, runApp, scratchDir } from "./common.ts";

interface Hashes {
  ticks: number | null;
  monthly: string[];
  hash: string;
  versions: string;
  wall_ms: number | null;
}

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}
const years = Number(option("years", "1"));
const seed = Number(option("seed", "1"));
const world = option("world", "1995");
const scenario = option("scenario", "stable");
const historical = world !== "2020";

if (!existsSync(join(distDir, "sim", "run-node.mjs"))) {
  console.error("no build: run `corepack pnpm@10.20.0 desktop:build` first");
  process.exit(2);
}
const out = join(scratchDir, "determinism");
mkdirSync(out, { recursive: true });

/** 1. apps/headless's own command, its printed lines parsed. */
function headless(): Hashes {
  const tsx = join(repoDir, "apps", "headless", "node_modules", "tsx", "dist", "cli.mjs");
  const args = [tsx, "src/main.ts", "run", "--years", `${years}`, "--seeds", `${seed}`, "--hash-monthly"];
  args.push("--world", world);
  if (historical) args.push("--scenario", scenario);
  const r = run(process.execPath, args, join(repoDir, "apps", "headless"));
  writeFileSync(join(out, "headless.log"), r.stdout + r.stderr);
  if (r.code !== 0) throw new Error(`headless run exited ${r.code}: ${r.stderr.slice(-2000)}`);
  const monthly = [...r.stdout.matchAll(/^seed \d+ \S+ ([0-9a-f]{32})$/gm)].map((m) => m[1] as string);
  const last = /hash ([0-9a-f]{32}), (\d+) ms/.exec(r.stdout);
  const ticks = /^(\d+) ticks in/m.exec(r.stdout);
  if (last === null) throw new Error(`headless run printed no final hash:\n${r.stdout.slice(-2000)}`);
  return {
    ticks: ticks === null ? null : Number(ticks[1]),
    monthly,
    hash: last[1] as string,
    versions: `Node ${process.versions.node}, V8 ${process.versions.v8}`,
    wall_ms: Number(last[2]),
  };
}

interface RunReport {
  ok?: boolean;
  error?: string;
  ticks: number;
  monthly: { month: string; hash: string }[];
  hash: string;
  wall_ms: number;
  versions: { node: string; v8: string; electron: string | null; chrome?: string };
}

function hashesOf(report: RunReport): Hashes {
  const v = report.versions;
  const electron = v.electron === null ? "" : `Electron ${v.electron}, Chromium ${v.chrome ?? "?"}, `;
  return {
    ticks: report.ticks,
    monthly: report.monthly.map((m) => m.hash),
    hash: report.hash,
    versions: `${electron}Node ${v.node}, V8 ${v.v8}`,
    wall_ms: report.wall_ms,
  };
}

/** 2. The desktop's run loop, bundled, under plain Node. */
function bundleInNode(): Hashes {
  const request = {
    world: historical ? world : null,
    worldDir: historical ? join(repoDir, "assets", "worlds", world) : join(repoDir, "docs", "design", "data"),
    mapDir: null,
    seed,
    scenario: historical ? scenario : null,
    years,
  };
  const r = run(process.execPath, [join(distDir, "sim", "run-node.mjs"), JSON.stringify(request)]);
  if (r.code !== 0) throw new Error(`run-node.mjs exited ${r.code}: ${r.stderr.slice(-2000)}`);
  writeFileSync(join(out, "node.json"), r.stdout);
  return hashesOf(JSON.parse(r.stdout) as RunReport);
}

/** 3. The same bundle in the app's sim process. */
async function electron(): Promise<Hashes> {
  const file = join(out, "electron.json");
  const flags = [`--run=${file}`, `--years=${years}`, `--seed=${seed}`, `--world=${world}`];
  if (historical) flags.push(`--scenario=${scenario}`);
  flags.push(`--user-data-dir=${join(out, "ud")}`);
  const code = await runApp(flags);
  if (!existsSync(file)) throw new Error(`the app exited ${code} and wrote no report`);
  const report = JSON.parse(readFileSync(file, "utf8")) as RunReport;
  if (code !== 0 || report.ok === false)
    throw new Error(`the app's run failed: ${report.error ?? `exit ${code}`}`);
  return hashesOf(report);
}

console.log(
  `determinism: world ${world}, seed ${seed}, ${years} year(s)${historical ? `, scenario ${scenario}` : ""}`,
);
const runs: [string, Hashes][] = [];
runs.push(["headless (Node)", headless()]);
runs.push(["desktop bundle (Node)", bundleInNode()]);
runs.push(["desktop bundle (Electron utility process)", await electron()]);

const [, first] = runs[0] as [string, Hashes];
let same = true;
for (const [name, h] of runs) {
  const agrees =
    h.hash === first.hash &&
    h.monthly.length === first.monthly.length &&
    h.monthly.every((m, i) => m === first.monthly[i]) &&
    (h.ticks === null || first.ticks === null || h.ticks === first.ticks);
  same &&= agrees;
  console.log(
    `${agrees ? "same" : "DIFF"}  ${h.hash}  ticks ${h.ticks ?? "?"}  months ${h.monthly.length}  ${h.wall_ms ?? "?"} ms  ${name} [${h.versions}]`,
  );
}
if (!same) {
  const n = Math.max(...runs.map(([, h]) => h.monthly.length));
  for (let i = 0; i < n; i++) {
    const row = runs.map(([, h]) => h.monthly[i] ?? "-");
    if (new Set(row).size > 1) {
      console.log(`first month close that differs: #${i + 1}: ${row.join("  ")}`);
      break;
    }
  }
}
writeFileSync(
  join(out, "report.json"),
  `${JSON.stringify({ world, seed, years, scenario: historical ? scenario : null, same, runs: Object.fromEntries(runs) }, null, 2)}\n`,
);
console.log(same ? "determinism: every hash agrees" : "determinism: the hashes DIFFER");
process.exit(same ? 0 : 1);
