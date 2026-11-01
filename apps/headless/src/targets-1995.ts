// The calibration targets of a historical world's run (1995-rework 4.3), read from a soak's era.csv
// and run.json. A skeleton: the run's length and the 2020 GDP bands, with the bands on sector shares,
// drawdowns, failures, entries and turnover added as the systems they read arrive (spec 10).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ERA_FILE = "era.csv";
export const RUN_FILE = "run.json";
export const ERA_TARGETS_FILE = "era-targets.csv";

/** The years a full run closes (1995-rework 2.1). */
export const ERA_YEARS: readonly [number, number] = [1995, 2019];

/** World GDP at the close of 2019, USD, by scenario (1995-rework 4.3). */
export const GDP_2020_BANDS_USD: Readonly<Record<string, readonly [number, number]>> = {
  stable: [70e12, 100e12],
  unstable: [50e12, 110e12],
  stagnation: [45e12, 60e12],
};

/** One target on one seed. */
export interface EraResult {
  seed: number;
  target: string;
  value: string;
  bound: string;
  met: boolean;
}

/** Whether a soak's output is a historical world's. */
export function isEraDir(dir: string): boolean {
  return existsSync(join(dir, ERA_FILE));
}

/** Marks every target per seed from era.csv's text (`seed,year,gdp_usd,companies`). */
export function evaluateEra(text: string, scenario: string): EraResult[] {
  const bySeed = new Map<number, { year: number; gdp: number }[]>();
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [seed, year, gdp] = line.split(",").map(Number) as [number, number, number];
    const rows = bySeed.get(seed) ?? [];
    rows.push({ year, gdp });
    bySeed.set(seed, rows);
  }
  const out: EraResult[] = [];
  const [first, last] = ERA_YEARS;
  const band = GDP_2020_BANDS_USD[scenario];
  for (const seed of [...bySeed.keys()].sort((a, b) => a - b)) {
    const rows = bySeed.get(seed) ?? [];
    const firstRow = rows[0];
    const lastRow = rows.at(-1);
    out.push({
      seed,
      target: "full_run",
      value: `${firstRow?.year}-${lastRow?.year}`,
      bound: `${first}-${last}`,
      met: firstRow?.year === first && lastRow?.year === last && rows.length === last - first + 1,
    });
    if (band !== undefined && lastRow !== undefined) {
      out.push({
        seed,
        target: "gdp_2020_usd",
        value: lastRow.gdp.toExponential(3),
        bound: `${band[0]} to ${band[1]}`,
        met: lastRow.gdp >= band[0] && lastRow.gdp <= band[1],
      });
    }
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
