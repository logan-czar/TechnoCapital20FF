// `pnpm e2e` and `pnpm e2e:smoke`: build the app if its build is missing or stale, then run the
// Playwright suites in this folder.
//
//   node e2e/run.ts                 everything: @smoke, @visual and @real
//   node e2e/run.ts --smoke         only @smoke (mock sim; under a minute)
//   node e2e/run.ts --visual        only the screenshot checks
//   node e2e/run.ts --real          only the real-sim suite
//   node e2e/run.ts --build | --no-build     build whatever the check says | never build
//   anything else goes to Playwright: --update-snapshots, --repeat-each 3, -g "phone"
//
// A run that includes @real launches the real sim, so it is made through scripts/heavy (the
// machine-wide lock for heavy work) unless the caller already holds the lock.
//
// When the build is stale: apps/desktop/dist holds `.e2e-inputs`, a hash of every file the build
// reads (see INPUTS: the sources of the shell, the UI and the three sim packages, their
// package.json files and the lockfile; names and contents, so a deleted file counts and a `git
// checkout` that only moves modification times does not). The build is stale when a main output is
// missing or the hash differs. A build somebody made by hand (`pnpm desktop:build`) has no hash
// file: it is then judged by time, stale when any input is newer than its oldest main output, and
// given a hash file when it is not. The world and map data are not inputs: the unpackaged app
// reads them from the repository, not from the build.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { desktopDir, distDir, repoDir } from "../scripts/common.ts";

/** What the build reads, from the repository root: folders are walked, files are taken as they are. */
const INPUTS = [
  "apps/desktop/src",
  "apps/desktop/scripts/build.ts",
  "apps/desktop/scripts/common.ts",
  "apps/desktop/package.json",
  "apps/web/src",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "apps/web/package.json",
  "packages/sim/src",
  "packages/sim/package.json",
  "packages/sim-data/src",
  "packages/sim-data/package.json",
  "packages/sim-host/src",
  "packages/sim-host/package.json",
  "pnpm-lock.yaml",
];
/** One file from each of the build's four parts: all there means the build finished. */
const OUTPUTS = ["renderer/index.html", "main/index.js", "preload/index.cjs", "sim/entry.mjs"];
const STAMP = join(distDir, ".e2e-inputs");

function inputFiles(): string[] {
  const files: string[] = [];
  const walk = (path: string): void => {
    if (!existsSync(path)) return;
    if (!statSync(path).isDirectory()) {
      files.push(path);
      return;
    }
    for (const name of readdirSync(path).sort()) if (name !== "node_modules") walk(join(path, name));
  };
  for (const input of INPUTS) walk(join(repoDir, input));
  return files;
}

function inputsHash(files: readonly string[]): string {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(repoDir, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

/** Why the build must be made again, or null when it is good; a good build gets its hash file. */
function staleReason(): string | null {
  const missing = OUTPUTS.find((o) => !existsSync(join(distDir, o)));
  if (missing !== undefined) return `no ${missing} in the build`;
  const files = inputFiles();
  const hash = inputsHash(files);
  if (existsSync(STAMP)) return readFileSync(STAMP, "utf8").trim() === hash ? null : "a source file changed";
  const built = Math.min(...OUTPUTS.map((o) => statSync(join(distDir, o)).mtimeMs));
  const newer = files.find((f) => statSync(f).mtimeMs > built);
  if (newer !== undefined) return `${relative(repoDir, newer)} is newer than the build`;
  writeFileSync(STAMP, `${hash}\n`);
  return null;
}

function build(): void {
  const started = Date.now();
  const r = spawnSync(process.execPath, ["scripts/build.ts"], {
    cwd: desktopDir,
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (r.status !== 0) {
    console.error("e2e: the build failed (run `corepack pnpm@10.20.0 desktop:build` to see it)");
    process.exit(r.status ?? 1);
  }
  writeFileSync(STAMP, `${inputsHash(inputFiles())}\n`);
  console.log(`e2e: built in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

const TAGS: Record<string, string> = { "--smoke": "@smoke", "--visual": "@visual", "--real": "@real" };
let grep: string | null = null;
let buildMode: "auto" | "always" | "never" = "auto";
const passed: string[] = [];
for (const a of process.argv.slice(2)) {
  const tag = TAGS[a];
  if (tag !== undefined) grep = grep === null ? tag : `${grep}|${tag}`;
  else if (a === "--build") buildMode = "always";
  else if (a === "--no-build") buildMode = "never";
  // pnpm hands the separator on.
  else if (a !== "--") passed.push(a);
}

if (buildMode === "always") build();
else if (buildMode === "auto") {
  const why = staleReason();
  if (why === null) console.log("e2e: the build is up to date");
  else {
    console.log(`e2e: building (${why})`);
    build();
  }
}

const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
let command = [
  process.execPath,
  cli,
  "test",
  "-c",
  "e2e/playwright.config.ts",
  ...(grep === null ? [] : ["--grep", grep]),
  ...passed,
];
const real = grep === null || grep.includes("@real");
if (real && process.env.HEAVY_LOCK_HELD !== "1") {
  command =
    process.platform === "win32"
      ? [
          "powershell",
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          join(repoDir, "scripts", "heavy.ps1"),
          ...command,
        ]
      : ["bash", join(repoDir, "scripts", "heavy.sh"), ...command];
}
const run = spawnSync(command[0] as string, command.slice(1), {
  cwd: desktopDir,
  stdio: "inherit",
  // Playwright drives Electron here; it must never fetch a browser of its own.
  env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" },
});
process.exit(run.status ?? 1);
