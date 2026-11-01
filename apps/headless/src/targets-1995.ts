// The calibration targets of a historical world's run (1995-rework 4.3), read from a soak's era.csv
// and run.json. These read the macro layer; the bands on sector shares and top-10 turnover arrive
// with the sector lifecycle (spec 10).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCENARIOS } from "@tc20ff/sim/internal";
import { type SeedRunner, type SoakArgs, soak } from "./soak.ts";

export const ERA_FILE = "era.csv";
export const RUN_FILE = "run.json";
export const ERA_TARGETS_FILE = "era-targets.csv";

/** The years a full run closes (1995-rework 2.1). */
export const ERA_YEARS: readonly [number, number] = [1995, 2019];

/** One scenario's bands. A null bound is not judged (1995-rework 4.3, T). */
export interface EraBands {
  /** World GDP at the close of 2019, USD. */
  gdp_2020_usd: readonly [number, number];
  /** The largest fall in yearly GDP from a earlier peak, as a share of it. */
  max_drawdown: readonly [number | null, number | null];
  /** The policy rate at the close of 2019. */
  end_rate: readonly [number | null, number | null];
  /** Named companies gained over the run. */
  entries: readonly [number | null, number | null];
  /** Recessions started over the run. */
  recessions: readonly [number | null, number | null];
  /** The largest gain in a zone's share of world GDP over the run. */
  top_zone_gain: readonly [number | null, number | null];
}

export const ERA_BANDS: Readonly<Record<string, EraBands>> = {
  stable: {
    gdp_2020_usd: [70e12, 100e12],
    max_drawdown: [null, 0.06],
    end_rate: [0.01, 0.06],
    entries: [150, null],
    recessions: [1, 5],
    top_zone_gain: [0.02, null],
  },
  unstable: {
    gdp_2020_usd: [50e12, 110e12],
    max_drawdown: [0.08, null],
    end_rate: [null, 0.09],
    entries: [100, null],
    recessions: [3, null],
    top_zone_gain: [0.02, null],
  },
  stagnation: {
    gdp_2020_usd: [45e12, 60e12],
    max_drawdown: [null, null],
    end_rate: [null, 0.03],
    entries: [null, 120],
    recessions: [1, null],
    top_zone_gain: [null, null],
  },
};

/** One target on one seed. */
export interface EraResult {
  seed: number;
  target: string;
  value: number | string;
  bound: string;
  met: boolean;
}

interface EraRow {
  year: number;
  gdp: number;
  companies: number;
  rate: number;
  started: number;
  zones: number[];
}

/** Whether a soak's output is a historical world's. */
export function isEraDir(dir: string): boolean {
  return existsSync(join(dir, ERA_FILE));
}

function parseRows(text: string): Map<number, EraRow[]> {
  const bySeed = new Map<number, EraRow[]>();
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [seed, year, gdp, companies, rate, started, zones] = line.split(",") as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const rows = bySeed.get(Number(seed)) ?? [];
    rows.push({
      year: Number(year),
      gdp: Number(gdp),
      companies: Number(companies),
      rate: Number(rate),
      started: Number(started),
      zones: zones.split(";").map(Number),
    });
    bySeed.set(Number(seed), rows);
  }
  return bySeed;
}

/** The largest fall in yearly GDP from an earlier peak, as a share of it. */
export function maxDrawdown(gdp: readonly number[]): number {
  let peak = 0;
  let worst = 0;
  for (const g of gdp) {
    peak = Math.max(peak, g);
    if (peak > 0) worst = Math.max(worst, (peak - g) / peak);
  }
  return worst;
}

function shares(zones: readonly number[]): number[] {
  const total = zones.reduce((a, b) => a + b, 0);
  return zones.map((z) => (total > 0 ? z / total : 0));
}

function band(
  seed: number,
  target: string,
  value: number,
  [lo, hi]: readonly [number | null, number | null],
): EraResult {
  return {
    seed,
    target,
    value,
    bound: `${lo ?? "-"} to ${hi ?? "-"}`,
    met: (lo === null || value >= lo) && (hi === null || value <= hi),
  };
}

/** Marks every target per seed from era.csv's text. Random has no bands: its seeds differ. */
export function evaluateEra(text: string, scenario: string): EraResult[] {
  const out: EraResult[] = [];
  const [first, last] = ERA_YEARS;
  const bands = ERA_BANDS[scenario];
  const bySeed = parseRows(text);
  for (const seed of [...bySeed.keys()].sort((a, b) => a - b)) {
    const rows = bySeed.get(seed) ?? [];
    const a = rows[0];
    const z = rows.at(-1);
    out.push({
      seed,
      target: "full_run",
      value: `${a?.year}-${z?.year}`,
      bound: `${first}-${last}`,
      met: a?.year === first && z?.year === last && rows.length === last - first + 1,
    });
    if (bands === undefined || a === undefined || z === undefined) continue;
    const from = shares(a.zones);
    const gain = shares(z.zones).reduce((m, s, i) => Math.max(m, s - (from[i] ?? 0)), 0);
    out.push(
      band(seed, "gdp_2020_usd", z.gdp, bands.gdp_2020_usd),
      band(seed, "max_drawdown", maxDrawdown(rows.map((r) => r.gdp)), bands.max_drawdown),
      band(seed, "end_rate", z.rate, bands.end_rate),
      band(seed, "entries", z.companies - a.companies, bands.entries),
      band(
        seed,
        "recessions",
        rows.reduce((n, r) => n + r.started, 0),
        bands.recessions,
      ),
      band(seed, "top_zone_gain", gain, bands.top_zone_gain),
    );
  }
  return out;
}

/** `check` on a historical world's soak: writes era-targets.csv and prints how many were met. */
export function checkEraDir(dir: string): void {
  const run = JSON.parse(readFileSync(join(dir, RUN_FILE), "utf8")) as { scenario: string };
  const results = evaluateEra(readFileSync(join(dir, ERA_FILE), "utf8"), run.scenario);
  const csv = results.map((r) => `${r.seed},${r.target},${r.value},${r.bound},${r.met ? "MET" : "MISSED"}`);
  writeFileSync(join(dir, ERA_TARGETS_FILE), `seed,target,value,bound,verdict\n${csv.join("\n")}\n`);
  const met = results.filter((r) => r.met).length;
  console.log(
    `${run.scenario}: ${met} of ${results.length} targets met; wrote ${join(dir, ERA_TARGETS_FILE)}`,
  );
  for (const r of results.filter((x) => !x.met)) {
    console.log(`  MISSED seed ${r.seed} ${r.target}: ${r.value}, wanted ${r.bound}`);
  }
}

/**
 * `calibrate`: a soak of every scenario, each in its own folder of `args.out`, marked against its
 * bands. The way to tune a scenario (1995-rework 4.3).
 */
export async function calibrate(run: SeedRunner, dataDir: string, args: SoakArgs): Promise<void> {
  for (const s of SCENARIOS) {
    const out = join(args.out, s.id);
    await soak(run, dataDir, { ...args, out, scenario: s.id });
    checkEraDir(out);
  }
}
