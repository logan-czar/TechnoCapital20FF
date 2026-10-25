// Argument parsing of the headless commands (crates/headless/src/main.rs): each parser returns
// null on a bad or missing argument, and main prints the usage (exit code 2).
import { resolve } from "node:path";
import { defaultDataDir } from "@tc20ff/sim-data/node";

/**
 * A path the user typed, resolved against the directory they ran the command from: `INIT_CWD`
 * when run through pnpm (`pnpm --filter @tc20ff/headless start ...` runs in apps/headless), else
 * the process's cwd. The defaults (data, map, Rust reference) are found from the repository root
 * instead (sim-data `repoRoot`).
 */
export function userPath(p: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), p);
}

import { DEFAULT_SEEDS, DEFAULT_YEARS, type SoakArgs } from "./soak.ts";

export const USAGE = [
  "usage:",
  "  headless --check-data [--data-dir DIR] [--map-dir DIR]",
  "  headless run --years N --seeds A..B [--out metrics.csv] [--hash-monthly] [--profile] [--tick-costs] [--data-dir DIR]",
  "  headless soak [--years N] [--seeds A..B] [--jobs N] --out DIR [--check] [--detail] [--data-dir DIR]",
  "  headless check DIR",
  "  headless parity DIR [--reference DIR]",
  "  headless record --years N --seed S --out LOG [--data-dir DIR]",
  "  headless replay LOG [--data-dir DIR]",
  "DIR defaults to the repository's docs/design/data; seeds A..B are inclusive (a single seed A also works);",
  "soak defaults to 30 years and seeds 1..50, jobs to half the cores",
].join("\n");

/** A whole number from an argument, or null (Rust `str::parse::<u64>().ok()`). */
export function parseCount(s: string | undefined): number | null {
  if (s === undefined || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** A positive whole number, or null (Rust `.filter(|&y| y > 0)`). */
export function parsePositive(s: string | undefined): number | null {
  const n = parseCount(s);
  return n !== null && n > 0 ? n : null;
}

/** `A..B` (inclusive) or `A`. */
export function parseSeeds(s: string | undefined): [number, number] | null {
  if (s === undefined) return null;
  const i = s.indexOf("..");
  const a = parseCount(i < 0 ? s : s.slice(0, i));
  const b = i < 0 ? a : parseCount(s.slice(i + 2));
  return a !== null && b !== null && a <= b ? [a, b] : null;
}

/** Arguments of `run`. */
export interface RunArgs {
  years: number;
  seeds: [number, number];
  out: string | null;
  hashMonthly: boolean;
  profile: boolean;
  tickCosts: boolean;
  dir: string;
}

export function parseRun(args: readonly string[]): RunArgs | null {
  let years: number | null = null;
  let seeds: [number, number] | null = null;
  let out: string | null = null;
  let hashMonthly = false;
  let profile = false;
  let tickCosts = false;
  let dir = defaultDataDir();
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--years":
        years = parsePositive(args[++i]);
        if (years === null) return null;
        break;
      case "--seeds":
        seeds = parseSeeds(args[++i]);
        if (seeds === null) return null;
        break;
      case "--out": {
        const v = args[++i];
        if (v === undefined) return null;
        out = userPath(v);
        break;
      }
      case "--hash-monthly":
        hashMonthly = true;
        break;
      case "--profile":
        profile = true;
        break;
      case "--tick-costs":
        tickCosts = true;
        break;
      case "--data-dir": {
        const v = args[++i];
        if (v === undefined) return null;
        dir = userPath(v);
        break;
      }
      default:
        return null;
    }
  }
  return years === null || seeds === null
    ? null
    : { years, seeds, out, hashMonthly, profile, tickCosts, dir };
}

/** The `soak` arguments and the data directory. */
export function parseSoak(args: readonly string[]): [SoakArgs, string] | null {
  let years = DEFAULT_YEARS;
  let seeds: [number, number] = [DEFAULT_SEEDS[0], DEFAULT_SEEDS[1]];
  let jobs: number | null = null;
  let out: string | null = null;
  let check = false;
  let detail = false;
  let dir = defaultDataDir();
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--years": {
        const v = parsePositive(args[++i]);
        if (v === null) return null;
        years = v;
        break;
      }
      case "--seeds": {
        const v = parseSeeds(args[++i]);
        if (v === null) return null;
        seeds = v;
        break;
      }
      case "--jobs": {
        const v = parsePositive(args[++i]);
        if (v === null) return null;
        jobs = v;
        break;
      }
      case "--out": {
        const v = args[++i];
        if (v === undefined) return null;
        out = userPath(v);
        break;
      }
      case "--check":
        check = true;
        break;
      case "--detail":
        detail = true;
        break;
      case "--data-dir": {
        const v = args[++i];
        if (v === undefined) return null;
        dir = userPath(v);
        break;
      }
      default:
        return null;
    }
  }
  return out === null ? null : [{ years, seeds, jobs, out, check, detail }, dir];
}

/** `record --years N --seed S --out LOG [--data-dir DIR]`: [seed, years, out, dir]. */
export function parseRecord(args: readonly string[]): [number, number, string, string] | null {
  let seed: number | null = null;
  let years: number | null = null;
  let out: string | null = null;
  let dir = defaultDataDir();
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--seed":
        seed = parseCount(args[++i]);
        if (seed === null) return null;
        break;
      case "--years":
        years = parsePositive(args[++i]);
        if (years === null) return null;
        break;
      case "--out": {
        const v = args[++i];
        if (v === undefined) return null;
        out = userPath(v);
        break;
      }
      case "--data-dir": {
        const v = args[++i];
        if (v === undefined) return null;
        dir = userPath(v);
        break;
      }
      default:
        return null;
    }
  }
  return seed === null || years === null || out === null ? null : [seed, years, out, dir];
}

/** `replay LOG [--data-dir DIR]`: [log, dir]. */
export function parseReplay(args: readonly string[]): [string, string] | null {
  let log: string | null = null;
  let dir = defaultDataDir();
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a === "--data-dir") {
      const v = args[++i];
      if (v === undefined) return null;
      dir = userPath(v);
    } else if (log === null && !a.startsWith("--")) {
      log = userPath(a);
    } else {
      return null;
    }
  }
  return log === null ? null : [log, dir];
}
