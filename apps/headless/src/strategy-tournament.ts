// Strategy tournament (D971, D972): companies play a policy cell, a debt aggression level and a
// focus level (negative: growth-led, positive: R&D-led), side by side in the same world. A company
// plays cell `cells[(id + seed) % n]`, so over a multiple of n seeds each company plays each cell
// once and the cells differ in nothing but policy.
//
//   tsx src/strategy-tournament.ts run <profile> <years> <seedLo> <seedHi> <cells> <outDir>
//       cells is a list of debt/focus pairs such as 0/0,0/1,0/-1,3/1,3/-1
//   tsx src/strategy-tournament.ts summary <outDir>

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
import { type CompanyOutcome, score } from "./debt-tournament.ts";

interface Outcome extends CompanyOutcome {
  cell: string;
  /** Asset-weighted productivity of the company's units at the end; 0 when dead. */
  productivity_end: number;
}
interface Result {
  profile: string;
  seed: number;
  years: number;
  cells: string[];
  companies: Outcome[];
}

const isDead = (s: string): boolean => s === "Bankrupt" || s === "Removed";
const parse = (cell: string): [number, number] => {
  const [d = "0", f = "0"] = cell.split("/");
  return [Number(d), Number(f)];
};
const f2 = (x: number): string => (Number.isNaN(x) ? "-" : x.toFixed(2));
const p1 = (x: number): string => (Number.isNaN(x) ? "-" : `${(100 * x).toFixed(1)}%`);

function runSeed(
  data: Parameters<typeof simNew>[0],
  profile: string,
  seed: number,
  years: number,
  cells: string[],
): Result {
  const n = cells.length;
  const played = cells.map((_, i) => cells[(i + seed) % n] as string);
  const made = simNew(structuredClone(data), seed, {
    profile,
    debt_levels: played.map((c) => parse(c)[0]),
    focus_levels: played.map((c) => parse(c)[1]),
    ...(process.env.RD_X ? { rd_diminishing_x: Number(process.env.RD_X) } : {}),
  });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  const sim = made.value;
  const world = simSoakWorld(sim);
  const n0 = world.companies.length;
  const snap = (id: number): { eq: number; rev: number; dead: boolean } => {
    const c = world.companies[id] as Company;
    const dead = isDead(companyFinanceStatus(c.finance));
    return {
      dead,
      eq: dead ? 0 : Math.max(companySheet(world, c).equity, 0),
      rev: dead ? 0 : companyTrailingRevenue(c),
    };
  };
  const start = Array.from({ length: n0 }, (_, id) => snap(id));
  const ever = new Array<boolean>(n0).fill(false);
  const end = dateTimeMidnight(simDateYmd(EPOCH_YEAR + years, 1, 1));
  let lastMonth = -1;
  while (sim.now() < end) {
    for (const ev of sim.step()) {
      if (ev.kind === "MonthDone" && ev.month.month !== lastMonth) {
        lastMonth = ev.month.month;
        for (let id = 0; id < n0; id++) {
          if (companyFinanceStatus((world.companies[id] as Company).finance) !== "Active") ever[id] = true;
        }
      }
    }
  }
  const pw = new Array<number>(n0).fill(0);
  const pa = new Array<number>(n0).fill(0);
  for (const u of world.units) {
    const id = u.company as number;
    if (id < n0) {
      pw[id] = (pw[id] as number) + u.productivity * u.gross_assets;
      pa[id] = (pa[id] as number) + u.gross_assets;
    }
  }
  const companies: Outcome[] = [];
  for (let id = 0; id < n0; id++) {
    const a = start[id] as ReturnType<typeof snap>;
    const b = snap(id);
    const c = world.companies[id] as Company;
    companies.push({
      id,
      level: parse(played[id % n] as string)[0],
      cell: played[id % n] as string,
      archetype: c.archetype,
      sector: (world.industries[c.industry] as World["industries"][number]).sector,
      equity0: a.eq,
      equity_end: b.eq,
      revenue0: a.rev,
      revenue_end: b.rev,
      drawn_end: b.dead ? 0 : Math.max(c.finance.line.drawn, 0),
      limit_end: b.dead ? 0 : c.finance.line.limit,
      dead: b.dead,
      ever_distressed: ever[id] as boolean,
      productivity_end: b.dead || !((pa[id] as number) > 0) ? 0 : (pw[id] as number) / (pa[id] as number),
    });
  }
  return { profile, seed, years, cells, companies };
}

function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function summarize(all: Result[]): string {
  const out = ["# Strategy tournament (debt / focus)", ""];
  const cells = [...new Set(all.flatMap((r) => r.cells))];
  for (const p of [...new Set(all.map((r) => r.profile))]) {
    const rs = all.filter((r) => r.profile === p);
    const cs = rs.flatMap((r) => r.companies);
    out.push(
      `## ${p}: ${rs.length} seeds, ${rs[0]?.years} years, ${cs.length / cells.length} company-runs per cell`,
      "",
    );
    const prod = (g: Outcome[]): number => {
      const live = g.filter((c) => !c.dead);
      return live.length ? live.reduce((a, c) => a + c.productivity_end, 0) / live.length : Number.NaN;
    };
    out.push(
      table(
        [
          "debt/focus",
          "survive",
          "ever distressed",
          "equity x",
          "median equity x",
          "revenue x",
          "productivity",
          "debt/equity",
        ],
        cells.map((cell) => {
          const g = cs.filter((c) => c.cell === cell);
          const s = score(g);
          return [
            cell,
            p1(s.survival),
            p1(s.distressed),
            f2(s.equityMultiple),
            f2(s.medianMultiple),
            f2(s.revenueMultiple),
            f2(prod(g)),
            f2(s.debtToEquity),
          ];
        }),
      ),
      "",
    );
    const archs = [...new Set(cs.map((c) => c.archetype))].sort();
    out.push("Equity multiple by archetype (productivity in brackets):", "");
    out.push(
      table(
        ["archetype", ...cells],
        archs.map((a) => [
          a,
          ...cells.map((cell) => {
            const g = cs.filter((c) => c.archetype === a && c.cell === cell);
            return g.length < 5 ? "-" : `${f2(score(g).equityMultiple)} (${f2(prod(g))})`;
          }),
        ]),
      ),
      "",
    );
  }
  return out.join("\n");
}

function main(args: string[]): number {
  const [cmd = "", a1 = "", a2 = "", a3 = "", a4 = "", a5 = "", a6 = ""] = args;
  if (cmd === "run" && a6) {
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error("data does not load");
    mkdirSync(a6, { recursive: true });
    for (let seed = Number(a3); seed <= Number(a4); seed++) {
      writeFileSync(
        join(a6, `${a1}-s${seed}.json`),
        JSON.stringify(runSeed(r.value, a1, seed, Number(a2), a5.split(","))),
      );
      console.log(`${a1} seed ${seed} done`);
    }
    return 0;
  }
  if (cmd === "summary" && a1) {
    const all = readdirSync(a1)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(a1, f), "utf8")) as Result);
    const text = summarize(all);
    writeFileSync(join(a1, "summary.md"), text);
    console.log(text);
    return 0;
  }
  console.error(
    "usage: strategy-tournament run <profile> <years> <seedLo> <seedHi> <cells> <outDir> | summary <outDir>",
  );
  return 2;
}

if (process.argv[1]?.endsWith("strategy-tournament.ts")) process.exit(main(process.argv.slice(2)));
