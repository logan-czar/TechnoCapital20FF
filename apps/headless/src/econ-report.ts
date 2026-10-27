// Economy analysis tooling (D970): runs the sim under a growth profile and records the economy,
// every industry and every exchange once a year, then compares profiles. Read through the views
// and the soak totals only, like the soak (metrics.ts).
//
//   tsx src/econ-report.ts run <profile> <years> <seedLo> <seedHi> <outDir>
//       writes <outDir>/<profile>-s<seed>/{economy,industries,stocks}.csv (one row per year)
//   tsx src/econ-report.ts summary <outDir> [fromYear toYear]
//       merges the seeds (means), prints and writes <outDir>/summary.md: the economy by profile,
//       each industry's demand, revenue, margin factor and share price by profile, and the
//       exchanges' index growth by profile
//   tsx src/econ-report.ts profiles
//       lists the profile ids
//
// Rows are written at each 1 January 00:00 for the year just closed. Demand is effective demand
// (spec 5.1) in USD a year; revenue is the year's named plus fringe revenue; `px_med` is the
// median price change of the industry's quoted stocks over the year; `cap` is their summed
// market cap. Percentages are plain numbers (3.0 is 3%).

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  dateTimeMidnight,
  EPOCH_YEAR,
  PROFILES,
  type SoakIndustry,
  simDateYmd,
  simNew,
  simSoakStats,
  simViews,
} from "@tc20ff/sim/internal";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";

type Row = Record<string, string | number>;

const ECONOMY_COLS = [
  "year",
  "phase",
  "g_t",
  "demand_usd",
  "demand_growth",
  "trend_usd",
  "revenue_usd",
  "profitable_share",
  "active",
  "distressed",
  "bankrupt",
  "removed",
  "companies",
  "quoted",
  "median_gap",
  "mean_confidence",
  "beat_share",
  "miss_share",
  "mean_s",
  "mean_m",
  "boom_inds",
  "bust_inds",
  "glut_inds",
  "line_drawn_usd",
];
const INDUSTRY_COLS = [
  "year",
  "key",
  "sector",
  "demand_usd",
  "demand_growth",
  "lt",
  "growth_annual",
  "label",
  "supply_ratio",
  "market_factor",
  "revenue_usd",
  "alive",
  "quoted",
  "cap_usd",
  "px_med",
];
const STOCK_COLS = ["year", "code", "level", "ret", "quoted"];

function csv(cols: string[], rows: Row[]): string {
  const lines = rows.map((r) => cols.map((c) => String(r[c] ?? "")).join(","));
  return `${[cols.join(","), ...lines].join("\n")}\n`;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

const r4 = (x: number): number => Number(x.toFixed(4));
const pct = (x: number): number => Number((100 * x).toFixed(3));

/** One seed under one profile: the three tables. */
export function runSeed(
  data: Parameters<typeof simNew>[0],
  profile: string,
  seed: number,
  years: number,
): { economy: Row[]; industries: Row[]; stocks: Row[] } {
  const made = simNew(structuredClone(data), seed, { profile });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  const sim = made.value;
  const v0 = simViews(sim);
  const nInd = v0.industry_rows.data.rows.length;
  let prevDemand = v0.industry_rows.data.rows.map((r) => r.demand);
  let prevTotal = prevDemand.reduce((a, b) => a + b, 0);
  let prevPrice = new Map<number, number>();
  const prevLevel = new Map<string, number>();
  let revAcc: number[] = new Array<number>(nInd).fill(0);
  let lastMonth = -1;
  const economy: Row[] = [];
  const industries: Row[] = [];
  const stocks: Row[] = [];
  let y = EPOCH_YEAR;
  let next = dateTimeMidnight(simDateYmd(y + 1, 1, 1));
  const end = dateTimeMidnight(simDateYmd(EPOCH_YEAR + years, 1, 1));
  while (sim.now() < end) {
    for (const n of sim.step()) {
      if (n.kind === "MonthDone" && n.month.month !== lastMonth) {
        lastMonth = n.month.month;
        simSoakStats(sim).industries.forEach((t: SoakIndustry, i: number) => {
          revAcc[i] = (revAcc[i] as number) + t.named_revenue_m + t.fringe_revenue_m;
        });
      }
    }
    if (sim.now() < next) continue;
    const v = simViews(sim);
    const rows = v.industry_rows.data.rows;
    const soak = simSoakStats(sim);
    const cs = v.company_detail.data.companies;
    const q = v.quotes.data;
    const price = new Map<number, number>(q.rows.map((r) => [r.id, r.last]));
    const frozen = (s: string): boolean => s === "Bankrupt" || s === "Removed";
    const total = rows.reduce((a, r) => a + r.demand, 0);
    const count = (s: string): number => cs.filter((c) => c.status === s).length;
    const ms = v.market_stats.data;
    const cyc = v.cycle.data;
    economy.push({
      year: y,
      phase: cyc.phase,
      g_t: r4(cyc.g_t),
      demand_usd: Math.round(total),
      demand_growth: pct(total / prevTotal - 1),
      trend_usd: Math.round(rows.reduce((a, r) => a + r.trend_demand, 0)),
      revenue_usd: Math.round(revAcc.reduce((a, b) => a + b, 0)),
      profitable_share: r4(soak.profitable_companies / Math.max(cs.length, 1)),
      active: count("Active"),
      distressed: count("Distressed"),
      bankrupt: count("Bankrupt"),
      removed: count("Removed"),
      companies: cs.length,
      quoted: ms.quoted,
      median_gap: r4(ms.median_gap),
      mean_confidence: Number(ms.mean_confidence.toFixed(2)),
      beat_share: r4(ms.beats / Math.max(ms.reports, 1)),
      miss_share: r4(ms.misses / Math.max(ms.reports, 1)),
      mean_s: r4(soak.industries.reduce((a, t) => a + t.supply_ratio, 0) / nInd),
      mean_m: r4(soak.industries.reduce((a, t) => a + t.market_factor, 0) / nInd),
      boom_inds: rows.filter((r) => r.phase_label === "Boom").length,
      bust_inds: rows.filter((r) => r.phase_label === "Bust").length,
      glut_inds: rows.filter((r) => r.phase_label === "Glut").length,
      line_drawn_usd: Math.round(soak.line_drawn_usd),
    });
    rows.forEach((r, i) => {
      const mine = cs.filter((c) => c.industry === r.id);
      const live = mine.filter((c) => !frozen(c.status));
      const quoted = live.filter((c) => price.has(c.id));
      const moves = quoted
        .filter((c) => prevPrice.has(c.id))
        .map((c) => (price.get(c.id) as number) / (prevPrice.get(c.id) as number) - 1);
      const cap = q.rows.filter((x) => mine.some((c) => c.id === x.id)).reduce((a, x) => a + x.market_cap, 0);
      const t = soak.industries[i] as SoakIndustry;
      industries.push({
        year: y,
        key: r.key,
        sector: r.sector,
        demand_usd: Math.round(r.demand),
        demand_growth: pct(r.demand / (prevDemand[i] as number) - 1),
        lt: pct(r.lt),
        growth_annual: pct(r.growth_annual),
        label: r.phase_label,
        supply_ratio: r4(t.supply_ratio),
        market_factor: r4(t.market_factor),
        revenue_usd: Math.round(revAcc[i] as number),
        alive: live.length,
        quoted: quoted.length,
        cap_usd: Math.round(cap),
        px_med: pct(median(moves)),
      });
    });
    for (const e of v.exchanges.data.exchanges) {
      const ix = q.indices.find((x) => x.zone === e.zone);
      const level = ix?.level ?? null;
      const before = prevLevel.get(e.code);
      stocks.push({
        year: y,
        code: e.code,
        level: level === null ? "" : Number(level.toFixed(2)),
        ret: level === null || before === undefined ? "" : pct(level / before - 1),
        quoted: q.rows.filter((x) => x.exchange === e.zone).length,
      });
      if (level !== null) prevLevel.set(e.code, level);
    }
    prevDemand = rows.map((r) => r.demand);
    prevTotal = total;
    prevPrice = price;
    revAcc = new Array<number>(nInd).fill(0);
    y++;
    next = dateTimeMidnight(simDateYmd(y + 1, 1, 1));
  }
  return { economy, industries, stocks };
}

function readCsv(path: string): Row[] {
  const [head = "", ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const cols = head.split(",");
  return lines.map((l) => {
    const cells = l.split(",");
    const row: Row = {};
    cols.forEach((c, i) => {
      const s = cells[i] ?? "";
      row[c] = s !== "" && !Number.isNaN(Number(s)) ? Number(s) : s;
    });
    return row;
  });
}

const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const num = (r: Row, k: string): number => Number(r[k] ?? 0);

interface Loaded {
  profile: string;
  seed: number;
  economy: Row[];
  industries: Row[];
  stocks: Row[];
}

function loadAll(dir: string): Loaded[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /-s\d+$/.test(d.name))
    .map((d) => {
      const m = /^(.*)-s(\d+)$/.exec(d.name) as RegExpExecArray;
      const p = join(dir, d.name);
      return {
        profile: m[1] as string,
        seed: Number(m[2]),
        economy: readCsv(join(p, "economy.csv")),
        industries: readCsv(join(p, "industries.csv")),
        stocks: readCsv(join(p, "stocks.csv")),
      };
    });
}

/** Compound yearly growth in percent of `col` between the year-ends `from` and `to`. */
function cagr(rows: Row[], col: string, from: number, to: number): number {
  const a = rows.find((r) => num(r, "year") === from);
  const b = rows.find((r) => num(r, "year") === to);
  if (a === undefined || b === undefined || num(a, col) <= 0 || to <= from) return Number.NaN;
  return ((num(b, col) / num(a, col)) ** (1 / (to - from)) - 1) * 100;
}

/** An exchange needs this many quoted stocks at the end to count in the all-exchange mean. */
const MIN_QUOTED = 5;

const f1 = (x: number): string => (Number.isNaN(x) ? "-" : x.toFixed(1));

function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

/** The comparison text over `from..to` (years closed). */
export function summarize(all: Loaded[], from: number, to: number): string {
  const profiles = [...new Set(all.map((l) => l.profile))];
  const order = PROFILES.map((p) => p.id).filter((id) => profiles.includes(id));
  const runs = (p: string): Loaded[] => all.filter((l) => l.profile === p);
  const out: string[] = [`# Economy by growth profile, year-end ${from} to year-end ${to}`, ""];
  out.push(
    `Seeds per profile: ${order.map((p) => `${p} ${runs(p).length}`).join(", ")}. Means across seeds.`,
    "",
  );

  // 1. The economy.
  out.push("## The economy", "");
  out.push(
    table(
      [
        "profile",
        "demand %/yr",
        "revenue %/yr",
        "worst yr %",
        "best yr %",
        "profitable % (min)",
        "failed",
        "beat/miss %",
      ],
      order.map((p) => {
        const rs = runs(p);
        const yrs = rs.map((l) => l.economy.filter((r) => num(r, "year") >= from && num(r, "year") <= to));
        return [
          p,
          f1(mean(rs.map((l) => cagr(l.economy, "demand_usd", from, to)))),
          f1(mean(rs.map((l) => cagr(l.economy, "revenue_usd", from, to)))),
          f1(mean(yrs.map((r) => Math.min(...r.map((x) => num(x, "demand_growth")))))),
          f1(mean(yrs.map((r) => Math.max(...r.map((x) => num(x, "demand_growth")))))),
          f1(mean(yrs.map((r) => 100 * Math.min(...r.map((x) => num(x, "profitable_share")))))),
          f1(
            mean(
              yrs.map(
                (r) => num(r[r.length - 1] as Row, "bankrupt") + num(r[r.length - 1] as Row, "removed"),
              ),
            ),
          ),
          `${f1(mean(yrs.map((r) => 100 * mean(r.map((x) => num(x, "beat_share"))))))}/${f1(mean(yrs.map((r) => 100 * mean(r.map((x) => num(x, "miss_share"))))))}`,
        ];
      }),
    ),
    "",
  );

  // 2. Exchanges.
  const codes = [...new Set(all.flatMap((l) => l.stocks.map((r) => String(r.code))))];
  const headline = ["ATX", "CBX", "CLX", "HSE", "ESE"].filter((c) => codes.includes(c));
  out.push("## Stock indices, %/yr", "");
  out.push(
    table(
      ["profile", ...headline, `exchanges with ${MIN_QUOTED}+ stocks (mean)`, "max drawdown ATX %"],
      order.map((p) => {
        const rs = runs(p);
        const g = (code: string): number =>
          mean(
            rs
              .map((l) =>
                cagr(
                  l.stocks.filter((r) => r.code === code),
                  "level",
                  from,
                  to,
                ),
              )
              .filter((x) => !Number.isNaN(x)),
          );
        const big = codes.filter(
          (c) =>
            mean(
              rs.map((l) =>
                mean(
                  l.stocks.filter((r) => r.code === c && num(r, "year") === to).map((r) => num(r, "quoted")),
                ),
              ),
            ) >= MIN_QUOTED,
        );
        const allG = mean(big.map(g).filter((x) => !Number.isNaN(x)));
        const dd = mean(
          rs.map((l) => {
            let peak = 0;
            let worst = 0;
            for (const r of l.stocks.filter(
              (x) => x.code === "ATX" && num(x, "year") >= from && num(x, "year") <= to,
            )) {
              peak = Math.max(peak, num(r, "level"));
              worst = Math.min(worst, num(r, "level") / peak - 1);
            }
            return 100 * worst;
          }),
        );
        return [p, ...headline.map((c) => f1(g(c))), f1(allG), f1(dd)];
      }),
    ),
    "",
  );

  // 3. Industries: demand growth by profile.
  const keys = [...new Set(all.flatMap((l) => l.industries.map((r) => String(r.key))))];
  const sectorOf = new Map(
    all.flatMap((l) => l.industries.map((r) => [String(r.key), String(r.sector)] as const)),
  );
  const per = (p: string, key: string, col: string): number =>
    mean(
      runs(p).map((l) =>
        cagr(
          l.industries.filter((r) => r.key === key),
          col,
          from,
          to,
        ),
      ),
    );
  out.push("## Industry demand, %/yr", "");
  out.push(
    table(
      ["industry", "sector", ...order],
      keys.map((k) => [k, sectorOf.get(k) ?? "", ...order.map((p) => f1(per(p, k, "demand_usd")))]),
    ),
    "",
  );

  // 4. Industry revenue, margin factor, share price.
  const avg = (p: string, key: string, col: string): number =>
    mean(
      runs(p).flatMap((l) =>
        l.industries
          .filter((r) => r.key === key && num(r, "year") >= from && num(r, "year") <= to)
          .map((r) => num(r, col)),
      ),
    );
  out.push("## Industry revenue, %/yr", "");
  out.push(
    table(
      ["industry", ...order],
      keys.map((k) => [k, ...order.map((p) => f1(per(p, k, "revenue_usd")))]),
    ),
    "",
  );
  out.push("## Industry market factor M, mean (1.0 is balanced; 0.7 to 1.3)", "");
  out.push(
    table(
      ["industry", ...order],
      keys.map((k) => [k, ...order.map((p) => avg(p, k, "market_factor").toFixed(3))]),
    ),
    "",
  );
  out.push("## Industry median share price change, mean %/yr", "");
  out.push(
    table(
      ["industry", ...order],
      keys.map((k) => [k, ...order.map((p) => f1(avg(p, k, "px_med")))]),
    ),
    "",
  );
  out.push("## Industry phase labels, share of industry-years in Boom / Bust / Glut, %", "");
  out.push(
    table(
      ["profile", "boom", "bust", "glut"],
      order.map((p) => {
        const rows = runs(p).flatMap((l) =>
          l.industries.filter((r) => num(r, "year") >= from && num(r, "year") <= to),
        );
        const share = (lab: string): string =>
          f1((100 * rows.filter((r) => r.label === lab).length) / Math.max(rows.length, 1));
        return [p, share("Boom"), share("Bust"), share("Glut")];
      }),
    ),
    "",
  );
  return out.join("\n");
}

async function main(args: string[]): Promise<number> {
  const [cmd = ""] = args;
  if (cmd === "profiles") {
    for (const p of PROFILES) console.log(`${p.id.padEnd(17)} ${p.description}`);
    return 0;
  }
  if (cmd === "run") {
    const [, profile = "", ys = "", lo = "", hi = "", dir = ""] = args;
    if (!profile || !ys || !lo || !hi || !dir) return usage();
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error("data does not load");
    for (let seed = Number(lo); seed <= Number(hi); seed++) {
      const t = runSeed(r.value, profile, seed, Number(ys));
      const d = join(dir, `${profile}-s${seed}`);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, "economy.csv"), csv(ECONOMY_COLS, t.economy));
      writeFileSync(join(d, "industries.csv"), csv(INDUSTRY_COLS, t.industries));
      writeFileSync(join(d, "stocks.csv"), csv(STOCK_COLS, t.stocks));
      console.log(`${profile} seed ${seed}: ${Number(ys)} years written to ${d}`);
    }
    return 0;
  }
  if (cmd === "summary") {
    const [, dir = "", f = "", t = ""] = args;
    if (!dir) return usage();
    const all = loadAll(dir);
    const maxYear = Math.max(...all.flatMap((l) => l.economy.map((r) => num(r, "year"))));
    const text = summarize(all, f ? Number(f) : EPOCH_YEAR, t ? Number(t) : maxYear);
    writeFileSync(join(dir, "summary.md"), text);
    console.log(text);
    return 0;
  }
  return usage();
}

function usage(): number {
  console.error(
    "usage: econ-report run <profile> <years> <seedLo> <seedHi> <outDir> | summary <outDir> [from to] | profiles",
  );
  return 2;
}

if (process.argv[1]?.endsWith("econ-report.ts")) {
  main(process.argv.slice(2)).then((c) => process.exit(c));
}
