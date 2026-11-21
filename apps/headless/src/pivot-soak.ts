// The pivot milestone soaks (pivot 3.3, 16; pivot-plan "Verification"): per seed, three runs of the
// 1995 world, sampled every 1 January.
//
// - `coarse`: the pre-simulation, 1995 to 2020 at Coarse fidelity (pivot 3.2).
// - `full`: the same seed's state at 1 January 2018, hydrated (pivot 3.4) and played at Full to
//   2020. Pivot 3.3: "the seat, margin and lever distributions of a Full run of 2018 to 2020 must
//   fall inside the Coarse bands". The branch is a save and load of the Coarse run, so up to 2018
//   it is that run exactly.
// - `play`: the Coarse run's 2020 hydrated, as a new game is (a baked start), played to 2022.
//
//   corepack pnpm@10.20.0 exec tsx src/pivot-soak.ts --seeds 1..20 --jobs 4 --out DIR
//
// Writes `samples.csv` (one row per seed, run and year) and `report.txt` (the bands and their
// verdicts). Each seed runs in its own worker thread. Reads the wall clock for timings only.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import {
  dateTimeMidnight,
  RANDOM_SCENARIO_ID,
  type Sim,
  simDateYmd,
  simHydrate,
  simLoadBytes,
  simNew,
  simRunTicks,
  simSaveBytes,
  simWorld,
} from "@tc20ff/sim/internal";
import { DEFAULT_WORLD_ID, type WorldData } from "@tc20ff/sim-data";
import { loadWorld, worldDataDir } from "@tc20ff/sim-data/node";
import { parseSeeds, userPath } from "./args.ts";

/** The pre-simulation's first and last 1 January (pivot 3.1, 3.2). */
const COARSE_YEARS: readonly [number, number] = [1995, 2020];
/** Where the Full branch hydrates (pivot 3.3: "a Full run of 2018 to 2020"). */
const FULL_FROM = 2018;
/** How far a hydrated 2020 start is played: to 1 January 2023, through the 2020 and 2022 generals. */
const PLAY_TO = 2023;

// The sanity bands (T, D1056). Pivot 3.3 and the M2 elections test (D1040) for the chambers; the
// rest are wide on purpose: they catch a broken world, not a miscalibrated one.
/** No chamber may be more one-sided than this share of its seats after a general (D1040). */
const MAX_CHAMBER_SHARE = 0.75;
/** House general turnout over all residents: the US ran about 0.25 to 0.45 in 1994 to 2018. */
const TURNOUT_BAND: readonly [number, number] = [0.15, 0.6];
/**
 * The US headline index at 2020 over its first year-end, 1996 (the 1995 sample is the 1,000 base
 * before the first close): no collapse, no runaway.
 */
const INDEX_RATIO_BAND: readonly [number, number] = [0.5, 20];
/**
 * Pivot 3.3, "inside the Coarse bands", read as one distribution: a two-sample Kolmogorov-Smirnov
 * test of the Full seeds against the Coarse seeds of the same year fails below this p-value. A
 * per-seed quantile band would fail the Coarse run's own extreme seeds, whose Full branch sits
 * next to them.
 */
const KS_MIN_P = 0.05;

type RunKind = "coarse" | "full" | "play";

/** One sample: a run's state at 00:00 on 1 January of `year`. */
export interface Sample {
  seed: number;
  run: RunKind;
  year: number;
  /** Seats after the latest general (D985): Democrats, Republicans. */
  house_d: number;
  house_r: number;
  senate_d: number;
  senate_r: number;
  /** The year of that general. */
  general: number;
  /** The president's party now, first letter. */
  president: string;
  /** House generals counted in the year before: how many, how many with one candidate. */
  house_races: number;
  uncontested: number;
  /** Median winner's margin in points, and the share under 10 points, of the contested ones. */
  median_margin: number;
  competitive: number;
  /** Their votes over all residents. */
  turnout: number;
  corp_tax: number;
  fiscal: number;
  rate_bias: number;
  regulation: number;
  subsidy: number;
  tariff: number;
  /** The US headline index (the largest level of an exchange with listings). */
  index: number;
  /** Quoted stocks, and their lowest and highest price. */
  quoted: number;
  min_price: number;
  max_price: number;
  /** Numbers in the world that are NaN or infinite. */
  nonfinite: number;
}

const COLUMNS: readonly (keyof Sample)[] = [
  "seed",
  "run",
  "year",
  "house_d",
  "house_r",
  "senate_d",
  "senate_r",
  "general",
  "president",
  "house_races",
  "uncontested",
  "median_margin",
  "competitive",
  "turnout",
  "corp_tax",
  "fiscal",
  "rate_bias",
  "regulation",
  "subsidy",
  "tariff",
  "index",
  "quoted",
  "min_price",
  "max_price",
  "nonfinite",
];

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/** The value at quantile `q` of `xs` (nearest rank on a sorted copy). */
function quantile(xs: readonly number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return Number.NaN;
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] as number;
}

/**
 * The two-sample Kolmogorov-Smirnov statistic of `a` and `b` and its asymptotic p-value (Stephens'
 * small-sample correction, as numerical recipes `kstwo`).
 */
export function ks(a: readonly number[], b: readonly number[]): { d: number; p: number } {
  if (a.length === 0 || b.length === 0) return { d: 0, p: 1 };
  const xs = [...new Set([...a, ...b])].sort((x, y) => x - y);
  const cdf = (v: readonly number[], x: number) => v.filter((y) => y <= x).length / v.length;
  let d = 0;
  for (const x of xs) d = Math.max(d, Math.abs(cdf(a, x) - cdf(b, x)));
  const n = Math.sqrt((a.length * b.length) / (a.length + b.length));
  const lambda = (n + 0.12 + 0.11 / n) * d;
  if (lambda < 1e-9) return { d, p: 1 };
  let p = 0;
  for (let k = 1; k <= 100; k++) p += 2 * (-1) ** (k - 1) * Math.exp(-2 * k * k * lambda * lambda);
  return { d, p: Math.min(1, Math.max(0, p)) };
}

/** NaN or infinite numbers anywhere under `v`. */
function nonfinite(v: unknown, seen = new Set<object>()): number {
  if (typeof v === "number") return Number.isFinite(v) ? 0 : 1;
  if (typeof v !== "object" || v === null || seen.has(v)) return 0;
  seen.add(v);
  let n = 0;
  if (ArrayBuffer.isView(v)) {
    if (v instanceof Float64Array || v instanceof Float32Array)
      for (const x of v) if (!Number.isFinite(x)) n++;
    return n;
  }
  for (const x of Object.values(v)) n += nonfinite(x, seen);
  return n;
}

function sample(sim: Sim, seed: number, run: RunKind, year: number): Sample {
  const w = simWorld(sim);
  const p = w.politics;
  const last = p.elections.at(-1);
  const prezHolder = p.politicians.find((x) => x.office.kind === "President");
  const generals = w.elections.races.filter(
    (r) => r.office === "House" && !r.special && r.cycle === year - 1 && r.result !== null,
  );
  const contested = generals.filter((r) => r.ballot.length >= 2);
  const margins = contested.map((r) => Math.abs(r.result?.margin ?? 0));
  const residents = w.geo.counties.reduce((a, c) => a + c.population, 0);
  const votes = generals.reduce((a, r) => a + (r.result?.turnout ?? 0), 0);
  const listed = w.market.indices.filter((x) => x.divisor !== null).map((x) => x.last_level);
  const prices = w.market.stocks.filter((s) => s.quoted).map((s) => s.price);
  const lv = w.levers;
  return {
    seed,
    run,
    year,
    house_d: last?.house[0] ?? 0,
    house_r: last?.house[1] ?? 0,
    senate_d: last?.senate[0] ?? 0,
    senate_r: last?.senate[1] ?? 0,
    general: last?.date.year ?? 0,
    president: prezHolder?.party[0] ?? "?",
    house_races: generals.length,
    uncontested: generals.length - contested.length,
    median_margin: margins.length === 0 ? 0 : quantile(margins, 0.5),
    competitive: margins.length === 0 ? 0 : margins.filter((m) => m < 10).length / margins.length,
    turnout: residents > 0 ? votes / residents : 0,
    corp_tax: lv.corp_tax,
    fiscal: lv.fiscal,
    rate_bias: lv.rate_bias,
    regulation: mean(lv.regulation),
    subsidy: mean(lv.subsidy),
    tariff: mean(lv.tariff),
    index: listed.length === 0 ? 0 : Math.max(...listed),
    quoted: prices.length,
    min_price: prices.length === 0 ? 0 : Math.min(...prices),
    max_price: prices.length === 0 ? 0 : Math.max(...prices),
    nonfinite: nonfinite({ ...w, name_books: null }),
  };
}

/** Runs to 00:00 on 1 January of `year`. */
function runTo(sim: Sim, year: number): void {
  simRunTicks(sim, dateTimeMidnight(simDateYmd(year, 1, 1)), Number.MAX_SAFE_INTEGER);
}

function newSim(data: WorldData, seed: number): Sim {
  const made = simNew(data, seed, { scenario: RANDOM_SCENARIO_ID });
  if (!made.ok) throw new Error(`seed ${seed}: ${JSON.stringify(made.error)}`);
  return made.value;
}

export interface SeedResult {
  seed: number;
  samples: Sample[];
  wall_ms: number;
}

/** The three runs of one seed. */
export function runSeed(data: WorldData, seed: number): SeedResult {
  const t = performance.now();
  const out: Sample[] = [];
  const sim = newSim(data, seed);
  out.push(sample(sim, seed, "coarse", COARSE_YEARS[0]));
  let branch: Uint8Array | null = null;
  for (let y = COARSE_YEARS[0] + 1; y <= COARSE_YEARS[1]; y++) {
    runTo(sim, y);
    out.push(sample(sim, seed, "coarse", y));
    if (y === FULL_FROM) branch = simSaveBytes(sim);
  }

  // The Coarse 2020, hydrated as a new game is, and played.
  simHydrate(sim);
  for (let y = COARSE_YEARS[1] + 1; y <= PLAY_TO; y++) {
    runTo(sim, y);
    out.push(sample(sim, seed, "play", y));
  }

  // The 2018 branch at Full.
  if (branch === null) throw new Error("no 2018 branch");
  const full = newSim(data, seed);
  const loaded = simLoadBytes(full, branch);
  if (!loaded.ok)
    throw new Error(`seed ${seed}: the 2018 save does not load: ${JSON.stringify(loaded.error)}`);
  simHydrate(full);
  out.push(sample(full, seed, "full", FULL_FROM));
  for (let y = FULL_FROM + 1; y <= COARSE_YEARS[1]; y++) {
    runTo(full, y);
    out.push(sample(full, seed, "full", y));
  }
  return { seed, samples: out, wall_ms: Math.round(performance.now() - t) };
}

// ---------------------------------------------------------------- the report

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const fmt = (x: number, d = 3): string => (Number.isInteger(x) ? String(x) : x.toFixed(d));

/** The bands, judged over every sample. */
export function report(results: readonly SeedResult[]): { checks: Check[]; text: string } {
  const all = results.flatMap((r) => r.samples);
  const coarse = all.filter((s) => s.run === "coarse");
  const full = all.filter((s) => s.run === "full");
  const play = all.filter((s) => s.run === "play");
  const checks: Check[] = [];
  const add = (name: string, bad: readonly string[], ofWhat: string) =>
    checks.push({
      name,
      ok: bad.length === 0,
      detail: bad.length === 0 ? `all ${ofWhat}` : bad.slice(0, 12).join("; "),
    });
  const at = (s: Sample) => `s${s.seed} ${s.run} ${s.year}`;

  add(
    "no NaN or infinite number",
    all.filter((s) => s.nonfinite > 0).map((s) => `${at(s)}: ${s.nonfinite}`),
    `${all.length} samples`,
  );
  add(
    "stock prices positive",
    all.filter((s) => s.quoted > 0 && !(s.min_price > 0)).map((s) => `${at(s)}: min ${s.min_price}`),
    `${all.length} samples`,
  );
  const afterGeneral = all.filter((s) => s.general > 0);
  add(
    `no chamber above ${MAX_CHAMBER_SHARE} of its seats`,
    afterGeneral
      .filter((s) => {
        const h = Math.max(s.house_d, s.house_r) / Math.max(1, s.house_d + s.house_r);
        const n = Math.max(s.senate_d, s.senate_r) / Math.max(1, s.senate_d + s.senate_r);
        return h > MAX_CHAMBER_SHARE || n > MAX_CHAMBER_SHARE;
      })
      .map((s) => `${at(s)}: House ${s.house_d}-${s.house_r}, Senate ${s.senate_d}-${s.senate_r}`),
    `${afterGeneral.length} samples`,
  );
  const withVote = all.filter((s) => s.house_races > 0);
  add(
    `House turnout in ${TURNOUT_BAND.join(" to ")} of residents`,
    withVote
      .filter((s) => s.turnout < TURNOUT_BAND[0] || s.turnout > TURNOUT_BAND[1])
      .map((s) => `${at(s)}: ${fmt(s.turnout)}`),
    `${withVote.length} general years`,
  );
  const presidents = new Set(
    results.map((r) =>
      r.samples
        .filter((s) => s.run === "coarse")
        .map((s) => s.president)
        .join(""),
    ),
  );
  const bothParties = results.filter((r) => {
    const ps = new Set(r.samples.filter((s) => s.run === "coarse" && s.year > 1997).map((s) => s.president));
    return ps.has("D") && ps.has("R");
  }).length;
  checks.push({
    name: "presidency changes party in the Coarse run",
    ok: bothParties >= Math.ceil(results.length / 2),
    detail: `${bothParties} of ${results.length} seeds have both parties in office after 1997 (${presidents.size} distinct paths)`,
  });
  const ratios = results.map((r) => {
    const a = r.samples.find((s) => s.run === "coarse" && s.year === COARSE_YEARS[0] + 1);
    const b = r.samples.find((s) => s.run === "coarse" && s.year === COARSE_YEARS[1]);
    return { seed: r.seed, ratio: a && b && a.index > 0 ? b.index / a.index : Number.NaN };
  });
  add(
    `US index 2020 over 1996 in ${INDEX_RATIO_BAND.join(" to ")}`,
    ratios
      .filter((x) => !(x.ratio >= INDEX_RATIO_BAND[0] && x.ratio <= INDEX_RATIO_BAND[1]))
      .map((x) => `s${x.seed}: ${fmt(x.ratio)}`),
    `${ratios.length} seeds (median ${fmt(
      quantile(
        ratios.map((x) => x.ratio),
        0.5,
      ),
    )})`,
  );
  add(
    "the 2020 and 2022 generals are counted in play",
    play.filter((s) => s.house_races === 0 && (s.year === 2021 || s.year === 2023)).map(at),
    `${play.length} play samples`,
  );

  // Pivot 3.3: the Full 2018 to 2020 run inside the Coarse bands of the same years. The vote
  // metrics are read after the 2018 general (1 January 2019); the levers at both year-ends.
  const share = (a: number, b: number) => a / Math.max(1, a + b);
  const vote: readonly [string, (s: Sample) => number][] = [
    ["House D share", (s) => share(s.house_d, s.house_r)],
    ["Senate D share", (s) => share(s.senate_d, s.senate_r)],
    ["median margin", (s) => s.median_margin],
    ["competitive share", (s) => s.competitive],
    ["uncontested", (s) => s.uncontested],
    ["turnout", (s) => s.turnout],
  ];
  const levers: readonly [string, (s: Sample) => number][] = [
    ["corp_tax", (s) => s.corp_tax],
    ["fiscal", (s) => s.fiscal],
    ["rate_bias", (s) => s.rate_bias],
    ["regulation", (s) => s.regulation],
    ["subsidy", (s) => s.subsidy],
    ["tariff", (s) => s.tariff],
  ];
  const lines: string[] = [];
  const compare = (year: number, metrics: readonly [string, (s: Sample) => number][]) => {
    const c = coarse.filter((s) => s.year === year);
    const f = full.filter((s) => s.year === year);
    for (const [name, get] of metrics) {
      const cv = c.map(get);
      const fv = f.map(get);
      const { d, p } = ks(cv, fv);
      const ok = p >= KS_MIN_P;
      const q = (xs: number[]) => [0.1, 0.5, 0.9].map((t) => fmt(quantile(xs, t))).join("/");
      const paired = f.map((s) => {
        const twin = c.find((x) => x.seed === s.seed);
        return twin === undefined ? 0 : Math.abs(get(s) - get(twin));
      });
      lines.push(
        `  ${year} ${name.padEnd(18)} Coarse p10/p50/p90 ${q(cv)}; Full ${q(fv)}; KS D ${fmt(d)} p ${fmt(p, 2)}; same seed differs by median ${fmt(quantile(paired, 0.5))}, max ${fmt(Math.max(0, ...paired))}${ok ? "" : "  <-- OUT"}`,
      );
      checks.push({
        name: `Full ${year} ${name} distributed as Coarse (KS p >= ${KS_MIN_P})`,
        ok,
        detail: `D ${fmt(d)}, p ${fmt(p, 2)}, ${f.length} Full against ${c.length} Coarse seeds`,
      });
    }
  };
  compare(FULL_FROM + 1, [...vote, ...levers]);
  compare(FULL_FROM + 2, levers);

  // Coarse distributions over the run, per general year: the bands themselves.
  const dist: string[] = [];
  for (let y = COARSE_YEARS[0] + 2; y <= COARSE_YEARS[1]; y += 2) {
    const c = coarse.filter((s) => s.year === y);
    const q = (get: (s: Sample) => number) =>
      `${fmt(quantile(c.map(get), 0.1))}/${fmt(quantile(c.map(get), 0.5))}/${fmt(quantile(c.map(get), 0.9))}`;
    dist.push(
      `  ${y}: House D ${q((s) => s.house_d)}, Senate D ${q((s) => s.senate_d)}, margin ${q((s) => s.median_margin)}, competitive ${q((s) => s.competitive)}, turnout ${q((s) => s.turnout)}, index ${q((s) => s.index)}`,
    );
  }

  const failed = checks.filter((c) => !c.ok);
  const text = [
    `pivot soak: ${results.length} seeds (${results.map((r) => r.seed).join(", ")}), ${all.length} samples`,
    `per seed wall: median ${fmt(
      quantile(
        results.map((r) => r.wall_ms / 1000),
        0.5,
      ),
      1,
    )} s`,
    "",
    `checks: ${checks.length - failed.length} of ${checks.length} pass`,
    ...checks.map((c) => `  ${c.ok ? "PASS" : "FAIL"}  ${c.name}: ${c.detail}`),
    "",
    "Full 2018 to 2020 against the Coarse run of the same years (pivot 3.3):",
    ...lines,
    "",
    "Coarse distribution after each general, p10/p50/p90 across seeds:",
    ...dist,
    "",
  ].join("\n");
  return { checks, text };
}

function csv(results: readonly SeedResult[]): string {
  const rows = results.flatMap((r) => r.samples).map((s) => COLUMNS.map((k) => String(s[k])).join(","));
  return `${COLUMNS.join(",")}\n${rows.join("\n")}\n`;
}

// ---------------------------------------------------------------- the threads

interface Task {
  dataDir: string;
  seed: number;
}

function runInWorker(task: Task): Promise<SeedResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: task });
    worker.once("message", (m: { ok: true; result: SeedResult } | { ok: false; error: string }) =>
      m.ok ? resolve(m.result) : reject(new Error(m.error)),
    );
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`seed ${task.seed}: worker exited ${code}`));
    });
  });
}

function workerMain(): void {
  const task = workerData as Task;
  try {
    const data = loadWorld(task.dataDir);
    if (!data.ok) throw new Error(JSON.stringify(data.error));
    parentPort?.postMessage({ ok: true, result: runSeed(data.value, task.seed) });
  } catch (e) {
    parentPort?.postMessage({ ok: false, error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}

async function main(args: readonly string[]): Promise<number> {
  let seeds: readonly [number, number] | null = [1, 10];
  let jobs = 4;
  let out: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--seeds") seeds = parseSeeds(args[++i]);
    else if (a === "--jobs") jobs = Math.max(1, Number(args[++i]));
    else if (a === "--out") out = userPath(args[++i] ?? "");
    else seeds = null;
  }
  if (seeds === null || out === null) {
    console.error("usage: tsx src/pivot-soak.ts [--seeds A..B] [--jobs N] --out DIR");
    return 2;
  }
  mkdirSync(out, { recursive: true });
  const dataDir = worldDataDir(DEFAULT_WORLD_ID);
  const queue: number[] = [];
  for (let s = seeds[0]; s <= seeds[1]; s++) queue.push(s);
  const results: SeedResult[] = [];
  const errors: string[] = [];
  const t = performance.now();
  await Promise.all(
    Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      for (let s = queue.shift(); s !== undefined; s = queue.shift()) {
        try {
          const r = await runInWorker({ dataDir, seed: s });
          results.push(r);
          console.log(`seed ${s}: ${(r.wall_ms / 1000).toFixed(1)} s`);
        } catch (e) {
          errors.push(`seed ${s}: ${e instanceof Error ? e.message : String(e)}`);
          console.log(errors.at(-1));
        }
      }
    }),
  );
  results.sort((a, b) => a.seed - b.seed);
  writeFileSync(join(out, "samples.csv"), csv(results));
  const { checks, text } = report(results);
  const full = `${text}${errors.length > 0 ? `\nseeds that failed:\n${errors.join("\n")}\n` : ""}wall ${((performance.now() - t) / 1000).toFixed(0)} s\n`;
  writeFileSync(join(out, "report.txt"), full);
  console.log(full);
  return errors.length > 0 || checks.some((c) => !c.ok) ? 1 : 0;
}

if (!isMainThread) workerMain();
else if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop() ?? "")
) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
