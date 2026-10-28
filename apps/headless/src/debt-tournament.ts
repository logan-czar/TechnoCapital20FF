// Debt aggression tournament (D971): companies take different debt policies side by side in the
// same world, and the levels are compared on what happens to them. Level 0 is the spec 6.5 AI;
// each level up holds more of its credit line drawn, borrows to fund purchases, spends more of its
// liquidity and grows harder while profitable. A company plays level `levels[id % levels.length]`,
// so every level has the same mix of industries, sizes and archetypes (ids are in CSV order). The
// levels rotate by seed: run a multiple of levels.length seeds and each company plays each level once.
//
//   tsx src/debt-tournament.ts run <profile> <years> <seedLo> <seedHi> <levels> <outDir>
//       levels is a list such as 0,1,2,3,4; writes <outDir>/<profile>-s<seed>.json
//   tsx src/debt-tournament.ts summary <outDir>
//       pools every run, prints and writes <outDir>/summary.md
//
// Only the companies in the world at load are scored (their ids are the first n0); companies born
// in play still play their level but are left out. A company that goes Bankrupt or Removed ends
// with equity 0 (its shareholders are wiped, spec 5.12).

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Company,
  companyFinanceStatus,
  companySheet,
  companyTrailingRevenue,
  dateTimeMidnight,
  EPOCH_YEAR,
  simDateYmd,
  simNew,
  simSoakWorld,
  type World,
} from "@tc20ff/sim/internal";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";

/** What one company was and became. */
export interface CompanyOutcome {
  id: number;
  level: number;
  archetype: string;
  sector: string;
  equity0: number;
  equity_end: number;
  revenue0: number;
  revenue_end: number;
  drawn_end: number;
  limit_end: number;
  /** Bankrupt or Removed at the end. */
  dead: boolean;
  /** Distressed, Bankrupt or Removed at any month close. */
  ever_distressed: boolean;
}

/** One level's pooled books at a year-end. */
export interface YearRow {
  year: number;
  level: number;
  alive: number;
  drawn: number;
  limit: number;
  equity: number;
  revenue: number;
}

export interface SeedResult {
  profile: string;
  seed: number;
  years: number;
  levels: number[];
  companies: CompanyOutcome[];
  rows: YearRow[];
}

const isDead = (s: string): boolean => s === "Bankrupt" || s === "Removed";

function snapshot(
  world: World,
  n0: number,
  levels: readonly number[],
): Map<number, { c: Company; eq: number; rev: number }> {
  const out = new Map<number, { c: Company; eq: number; rev: number }>();
  for (let id = 0; id < n0; id++) {
    const c = world.companies[id] as Company;
    const dead = isDead(companyFinanceStatus(c.finance));
    out.set(id, {
      c,
      eq: dead ? 0 : Math.max(companySheet(world, c).equity, 0),
      rev: dead ? 0 : companyTrailingRevenue(c),
    });
  }
  void levels;
  return out;
}

export function runSeed(
  data: Parameters<typeof simNew>[0],
  profile: string,
  seed: number,
  years: number,
  levels: number[],
): SeedResult {
  // The levels rotate by seed, so over a multiple of levels.length seeds every company plays
  // every level once and the groups differ in nothing but their policy.
  const played = levels.map((_, i) => levels[(i + seed) % levels.length] as number);
  const made = simNew(structuredClone(data), seed, { profile, debt_levels: played });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  const sim = made.value;
  const world = simSoakWorld(sim);
  const n0 = world.companies.length;
  const start = snapshot(world, n0, levels);
  const everDistressed = new Array<boolean>(n0).fill(false);
  const rows: YearRow[] = [];
  let y = EPOCH_YEAR;
  let next = dateTimeMidnight(simDateYmd(y + 1, 1, 1));
  const end = dateTimeMidnight(simDateYmd(EPOCH_YEAR + years, 1, 1));
  let lastMonth = -1;
  const level = (id: number): number => played[id % played.length] as number;
  const yearRows = (): void => {
    const acc = new Map<number, YearRow>(
      levels.map((l) => [l, { year: y, level: l, alive: 0, drawn: 0, limit: 0, equity: 0, revenue: 0 }]),
    );
    for (const [id, s] of snapshot(world, n0, levels)) {
      const r = acc.get(level(id)) as YearRow;
      const dead = isDead(companyFinanceStatus(s.c.finance));
      if (!dead) {
        r.alive++;
        r.drawn += Math.max(s.c.finance.line.drawn, 0);
        r.limit += s.c.finance.line.limit;
      }
      r.equity += s.eq;
      r.revenue += s.rev;
    }
    rows.push(...acc.values());
  };
  while (sim.now() < end) {
    for (const n of sim.step()) {
      if (n.kind === "MonthDone" && n.month.month !== lastMonth) {
        lastMonth = n.month.month;
        for (let id = 0; id < n0; id++) {
          const st = companyFinanceStatus((world.companies[id] as Company).finance);
          if (st !== "Active") everDistressed[id] = true;
        }
      }
    }
    if (sim.now() >= next) {
      yearRows();
      y++;
      next = dateTimeMidnight(simDateYmd(y + 1, 1, 1));
    }
  }
  const fin = snapshot(world, n0, levels);
  const companies: CompanyOutcome[] = [];
  for (let id = 0; id < n0; id++) {
    const a = start.get(id) as { c: Company; eq: number; rev: number };
    const b = fin.get(id) as { c: Company; eq: number; rev: number };
    const dead = isDead(companyFinanceStatus(b.c.finance));
    companies.push({
      id,
      level: level(id),
      archetype: b.c.archetype,
      sector: (world.industries[b.c.industry] as World["industries"][number]).sector,
      equity0: a.eq,
      equity_end: b.eq,
      revenue0: a.rev,
      revenue_end: b.rev,
      drawn_end: dead ? 0 : Math.max(b.c.finance.line.drawn, 0),
      limit_end: dead ? 0 : b.c.finance.line.limit,
      dead,
      ever_distressed: everDistressed[id] as boolean,
    });
  }
  return { profile, seed, years, levels, companies, rows };
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const median = (xs: number[]): number => {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};
const f2 = (x: number): string => (Number.isNaN(x) ? "-" : x.toFixed(2));
const p1 = (x: number): string => (Number.isNaN(x) ? "-" : `${(100 * x).toFixed(1)}%`);

function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

/** Pooled outcome of one group of companies. */
export function score(cs: CompanyOutcome[]): {
  n: number;
  survival: number;
  distressed: number;
  equityMultiple: number;
  medianMultiple: number;
  revenueMultiple: number;
  utilization: number;
  debtToEquity: number;
} {
  const start = sum(cs.map((c) => c.equity0));
  const alive = cs.filter((c) => !c.dead);
  return {
    n: cs.length,
    survival: alive.length / Math.max(cs.length, 1),
    distressed: cs.filter((c) => c.ever_distressed).length / Math.max(cs.length, 1),
    equityMultiple: start > 0 ? sum(cs.map((c) => c.equity_end)) / start : Number.NaN,
    medianMultiple: median(cs.filter((c) => c.equity0 > 0).map((c) => c.equity_end / c.equity0)),
    revenueMultiple:
      sum(cs.map((c) => c.revenue0)) > 0
        ? sum(cs.map((c) => c.revenue_end)) / sum(cs.map((c) => c.revenue0))
        : Number.NaN,
    utilization:
      sum(alive.map((c) => c.limit_end)) > 0
        ? sum(alive.map((c) => c.drawn_end)) / sum(alive.map((c) => c.limit_end))
        : Number.NaN,
    debtToEquity:
      sum(alive.map((c) => c.equity_end)) > 0
        ? sum(alive.map((c) => c.drawn_end)) / sum(alive.map((c) => c.equity_end))
        : Number.NaN,
  };
}

export function summarize(all: SeedResult[]): string {
  const out: string[] = ["# Debt aggression tournament", ""];
  const profiles = [...new Set(all.map((r) => r.profile))];
  const levels = [...new Set(all.flatMap((r) => r.levels))].sort((a, b) => a - b);
  for (const p of profiles) {
    const rs = all.filter((r) => r.profile === p);
    const years = rs[0]?.years ?? 0;
    const cs = rs.flatMap((r) => r.companies);
    out.push(
      `## ${p}: ${rs.length} seeds, ${years} years, ${cs.length / levels.length} starting companies per level`,
      "",
    );
    out.push(
      table(
        [
          "level",
          "survive",
          "ever distressed",
          "equity x",
          "median equity x",
          "revenue x",
          "line drawn / limit",
          "debt / equity",
        ],
        levels.map((l) => {
          const s = score(cs.filter((c) => c.level === l));
          return [
            String(l),
            p1(s.survival),
            p1(s.distressed),
            f2(s.equityMultiple),
            f2(s.medianMultiple),
            f2(s.revenueMultiple),
            p1(s.utilization),
            f2(s.debtToEquity),
          ];
        }),
      ),
      "",
    );
    // Leverage over time at level 0: how much debt companies take on under the spec AI.
    out.push("Debt over time (line drawn / limit, then drawn / equity), by level:", "");
    const ys = [...new Set(rs.flatMap((r) => r.rows.map((x) => x.year)))].sort((a, b) => a - b);
    out.push(
      table(
        ["year", ...levels.map((l) => `L${l} drawn/limit`), ...levels.map((l) => `L${l} debt/equity`)],
        ys
          .filter((_, i) => i % 3 === 2 || i === ys.length - 1)
          .map((yr) => {
            const at = (l: number): YearRow[] =>
              rs.flatMap((r) => r.rows.filter((x) => x.year === yr && x.level === l));
            return [
              String(yr),
              ...levels.map((l) =>
                p1(sum(at(l).map((x) => x.drawn)) / Math.max(sum(at(l).map((x) => x.limit)), 1)),
              ),
              ...levels.map((l) =>
                f2(sum(at(l).map((x) => x.drawn)) / Math.max(sum(at(l).map((x) => x.equity)), 1)),
              ),
            ];
          }),
      ),
      "",
    );
    // The same by archetype, so a level's win is not just the mix.
    const archs = [...new Set(cs.map((c) => c.archetype))].sort();
    out.push("Equity multiple by archetype and level (survival in brackets):", "");
    out.push(
      table(
        ["archetype", ...levels.map((l) => `L${l}`)],
        archs.map((a) => [
          a,
          ...levels.map((l) => {
            const g = cs.filter((c) => c.archetype === a && c.level === l);
            const s = score(g);
            return g.length < 5 ? "-" : `${f2(s.equityMultiple)} (${p1(s.survival)})`;
          }),
        ]),
      ),
      "",
    );
  }
  return out.join("\n");
}

function main(args: string[]): number {
  const [cmd = ""] = args;
  if (cmd === "run") {
    const [, profile = "", ys = "", lo = "", hi = "", lv = "", dir = ""] = args;
    if (!profile || !ys || !lo || !hi || !lv || !dir) return usage();
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error("data does not load");
    const levels = lv.split(",").map(Number);
    mkdirSync(dir, { recursive: true });
    for (let seed = Number(lo); seed <= Number(hi); seed++) {
      const res = runSeed(r.value, profile, seed, Number(ys), levels);
      writeFileSync(join(dir, `${profile}-s${seed}.json`), JSON.stringify(res));
      console.log(`${profile} seed ${seed}: ${Number(ys)} years, levels ${lv}`);
    }
    return 0;
  }
  if (cmd === "summary") {
    const [, dir = ""] = args;
    if (!dir) return usage();
    const all = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as SeedResult);
    const text = summarize(all);
    writeFileSync(join(dir, "summary.md"), text);
    console.log(text);
    return 0;
  }
  return usage();
}

function usage(): number {
  console.error(
    "usage: debt-tournament run <profile> <years> <seedLo> <seedHi> <levels> <outDir> | summary <outDir>",
  );
  return 2;
}

if (process.argv[1]?.endsWith("debt-tournament.ts")) process.exit(main(process.argv.slice(2)));
