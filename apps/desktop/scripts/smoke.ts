// `pnpm --filter @tc20ff/desktop smoke`: the built app checked with no human (run `desktop:build`
// first). Four launches, each a hidden window with its own user-data folder under .scratch/smoke:
//   1. real: a new game on the real sim in the sim process, 30 frames at max speed;
//   2. mock: the same with `--mock` (the mock sim in a Web Worker, no sim process);
//   3. save: a new game, some frames, a save to a slot, quit;
//   4. load: relaunch with `--save=<that file>` and no ticks: the state hash must equal 3's.
// Exits 0 when all four pass. Each launch's report stays in .scratch/smoke/<name>.json.

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { distDir, runApp, scratchDir } from "./common.ts";

interface Report {
  ok: boolean;
  error?: string;
  mode?: string;
  frames?: number;
  ticks?: number;
  date?: { year: number; month: number; day: number } | null;
  now?: number | null;
  hash?: string | null;
  save_bytes?: number | null;
  slot_reply?: { kind: string } | null;
  slot_path?: string | null;
  versions?: Record<string, string>;
}

const SLOT = "smoke-roundtrip";
const out = join(scratchDir, "smoke");

if (!existsSync(join(distDir, "main", "index.js"))) {
  console.error("no build: run `corepack pnpm@10.20.0 desktop:build` first");
  process.exit(2);
}
rmSync(out, { recursive: true, force: true });

async function launch(name: string, flags: string[], userData = name): Promise<Report> {
  const file = join(out, `${name}.json`);
  const code = await runApp([
    `--smoke=${file}`,
    "--hidden",
    `--user-data-dir=${join(out, `ud-${userData}`)}`,
    ...flags,
  ]);
  if (!existsSync(file)) return { ok: false, error: `the app exited ${code} and wrote no report` };
  const report = JSON.parse(readFileSync(file, "utf8")) as Report;
  return code === 0 ? report : { ...report, ok: false, error: report.error ?? `the app exited ${code}` };
}

const failures: string[] = [];
function check(name: string, report: Report, also: [string, boolean][] = []): void {
  const d = report.date;
  const date = d ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : "-";
  console.log(
    `${name}: ok=${report.ok} frames=${report.frames ?? "-"} ticks=${report.ticks ?? "-"} date=${date} hash=${report.hash ?? "-"}`,
  );
  if (!report.ok) failures.push(`${name}: ${report.error ?? "failed"}`);
  for (const [what, ok] of also) if (!ok) failures.push(`${name}: ${what}`);
}

const real = await launch("real", []);
check("real", real, [
  ["no ticks ran", (real.ticks ?? 0) > 0],
  ["no state hash", typeof real.hash === "string"],
  ["a Save's bytes did not cross the port", (real.save_bytes ?? 0) > 0],
]);

const mock = await launch("mock", ["--mock"]);
check("mock", mock, [["no ticks ran", (mock.ticks ?? 0) > 0]]);

const saved = await launch("save", [`--smoke-save-slot=${SLOT}`], "roundtrip");
check("save", saved, [
  ["the slot save was not Ok", saved.slot_reply?.kind === "Ok"],
  ["the slot's file is not on disk", typeof saved.slot_path === "string" && existsSync(saved.slot_path)],
]);

const loaded = await launch("load", [`--save=${saved.slot_path ?? ""}`, "--smoke-frames=0"], "roundtrip");
check("load", loaded, [
  [
    `the loaded hash ${loaded.hash} is not the saved ${saved.hash}`,
    saved.hash != null && loaded.hash === saved.hash,
  ],
  ["the loaded clock is not the saved one", loaded.now === saved.now],
]);

const v = real.versions;
if (v) console.log(`Electron ${v.electron}, Chromium ${v.chrome}, Node ${v.node}, V8 ${v.v8}`);
if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exit(1);
}
console.log("smoke: all passed");
