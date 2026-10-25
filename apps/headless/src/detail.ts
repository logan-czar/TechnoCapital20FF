// The soak's read-only detail dump (`soak --detail`, D900): per-industry, per-zone and world
// rows every year, and every company at the decade closes, for long-run economy reports. It
// reads true figures from the world tables (`soakWorld`, no estimate bands) and the views, and
// never writes to the sim, so `years.csv`, `quarters.csv` and the state hashes are the same with
// or without it. Everything is read in id order. Ported from crates/headless/src/detail.rs.
//
// CONTRACT: the Rust reads `Sim::soak_world()` and `soak_stats()`, which are not in SimApi; they
// come from SoakSim (factory.ts). The finance helpers (status, in_game, income, cash flow, Rating
// label, ExchangeIndex::level, companies_by_revenue) are not ported to the sim package yet, so
// small local copies of their definitions are used below.

import type {
  Company,
  CompanyId,
  CompanyStatus,
  ExchangeIndex,
  Ledger,
  Rating,
  SimDate,
  Statement,
  World,
} from "@tc20ff/sim/internal";
import { EPOCH_YEAR, formatSimDate, maxF, roundHalfAway, totalCmp } from "@tc20ff/sim/internal";
import { isSoakSim, type SoakSim } from "./factory.ts";
import type { DetailHook, SoakSimApi } from "./metrics.ts";

/**
 * `industries.csv`: one row per seed, year and industry (industry id order), at the December
 * close. Revenue columns are the year's twelve month closes; the share columns read last
 * month's unit revenue (spec 5.4).
 */
export const INDUSTRIES_HEADER =
  "seed,year,industry,trend_growth,lt,q_growth,label,trend_demand,demand,supply,s,m,fringe_assets,named_revenue_year,fringe_revenue_year,named_share,companies,active,distressed,quoted,born_alive,births_in_year,bankruptcies_in_year,top1_share,top4_share,top10_share,hhi,mean_productivity,named_gross_assets,fair_value,market_cap";

/**
 * `companies.csv`: every company not Removed, at the closes of 2020 and of every tenth year
 * (2029, 2039, ...). TTM figures sum the last four quarterly statements.
 */
export const COMPANIES_HEADER =
  "seed,year,id,name,industry,origin,born_year,status,quoted,exchange,country,archetype,revenue_ttm,ebit_ttm,net_income_ttm,dividends_ttm,cash,line_drawn,line_limit,asset_book,equity,gross_assets,productivity,management,rating,growth_plan,labor_units,price,shares,market_cap,fair_value";

/**
 * `world.csv`: one row per seed and year with the world aggregates and the company
 * distribution (companies Active or Distressed with TTM revenue above 0).
 */
export const WORLD_HEADER =
  "seed,year,ai_stage,pop_date,ai_labs_lt,base_rate,demand,trend_demand,supply,companies_table,in_game,active,distressed,bankrupt,removed,start_alive,born_alive,quoted,private_alive,births_total,bankruptcies_total,cash,line_drawn,equity,gross_assets,fair_value_alive,market_cap,fair_value_quoted,rev_p10,rev_p50,rev_p90,rev_max,margin_p10,margin_p50,margin_p90,ni_positive_share,top10_rev_share,hhi_mean,hhi_max,top1_max,full_characters,characters_table,books_checked,books_failures";

/** `zones.csv`: one row per seed, year and zone exchange (zone id order). */
export const ZONES_HEADER = "seed,year,exchange,level,quoted,market_cap,fair_value,confidence,credit_spread";

/** The detail tables of one seed (rows only, no headers). */
export interface Detail {
  industries: string;
  companies: string;
  world: string;
  zones: string;
}

export function detailNew(): Detail {
  return { industries: "", companies: "", world: "", zones: "" };
}

/** The four detail files, in the order written: name and header. */
export const FILES: readonly (readonly [name: string, header: string])[] = [
  ["industries.csv", INDUSTRIES_HEADER],
  ["companies.csv", COMPANIES_HEADER],
  ["world.csv", WORLD_HEADER],
  ["zones.csv", ZONES_HEADER],
];

/** Rust `Detail::parts`: the rows of each file, in FILES order. */
export function detailParts(d: Detail): [string, string, string, string] {
  return [d.industries, d.companies, d.world, d.zones];
}

/** Commas and quotes out of a free-text field (company names). */
export function clean(s: string): string {
  return s.replace(/[,"]/g, " ");
}

/** Rust `{:.6e}`: no `+`, no exponent padding. */
export function sci(x: number): string {
  return x.toExponential(6).replace("e+", "e");
}

/** The `q` quantile (nearest rank on sorted values); 0 when empty. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0.0;
  const i = roundHalfAway((sorted.length - 1) * q);
  return sorted[Math.min(i, sorted.length - 1)] ?? 0.0;
}

/** Top-k share and HHI of a list of revenues sorted biggest first: [top1, top4, top10, hhi]. */
export function concentration(sortedDesc: readonly number[]): [number, number, number, number] {
  const total = sortedDesc.reduce((s, r) => s + r, 0);
  if (total <= 0.0) return [0.0, 0.0, 0.0, 0.0];
  const top = (k: number): number => sortedDesc.slice(0, k).reduce((s, r) => s + r, 0) / total;
  const hhi = sortedDesc.reduce((s, r) => s + (r / total) * (r / total), 0);
  return [top(1), top(4), top(10), hhi];
}

/** The year's events: its own days, and the 1 January close that ends it (as books_columns). */
export function inYear(d: SimDate | null, year: number): boolean {
  return d !== null && (d.year === year || (d.year === year + 1 && d.month === 1 && d.day === 1));
}

/** Rust `Rating::label`: "AAA", "AA+", "BBB-" and so on. */
export function ratingLabel(r: Rating): string {
  return r.toUpperCase().replace("PLUS", "+").replace("MINUS", "-");
}

/** Rust `Ledger::ebit` (3.9). */
function ledgerEbit(l: Ledger): number {
  return l.revenue - (l.variable + l.fixed_cash) - l.rd - l.shared - l.depreciation;
}

/** Rust `Ledger::net_income` (3.9). */
function ledgerNetIncome(l: Ledger): number {
  return ledgerEbit(l) - (l.line_interest + l.line_fee) + l.interest_income + l.asset_sale_gain - l.tax;
}

const PHASE_NAMES = { Boom: "Boom", Normal: "Normal", Glut: "Glut", Bust: "Bust" } as const;

/** Builds the detail rows from month and year closes. */
export class DetailRecorder implements DetailHook<Detail> {
  private namedYear: number[] = [];
  private fringeYear: number[] = [];
  readonly out: Detail = detailNew();

  private readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /** A month close: adds the month's revenue per industry. */
  monthClose(sim: SoakSimApi): void {
    const stats = sim.soakStats().industries;
    this.namedYear.length = stats.length;
    this.fringeYear.length = stats.length;
    stats.forEach((t, i) => {
      this.namedYear[i] = (this.namedYear[i] ?? 0) + t.named_revenue_m;
      this.fringeYear[i] = (this.fringeYear[i] ?? 0) + t.fringe_revenue_m;
    });
  }

  /** The December close of `year`. */
  yearClose(sim: SoakSimApi, year: number): void {
    const s = soakSim(sim);
    const w: World = s.soakWorld();
    const seed = this.seed;
    const companies = w.companies;
    const stocks = w.market.stocks;
    // Per company: gross assets, asset-weighted productivity, last month's revenue.
    const gross: number[] = companies.map(() => 0);
    const prodW: number[] = companies.map(() => 0);
    for (const u of w.units) {
      gross[u.company] = (gross[u.company] ?? 0) + u.gross_assets;
      prodW[u.company] = (prodW[u.company] ?? 0) + u.gross_assets * u.productivity;
    }
    // TTM figures: (revenue, ebit, net income, dividends).
    const ttm: [number, number, number, number][] = companies.map((c) => {
      const q: Statement[] = c.finance.archive.quarters;
      const last = q.slice(Math.max(q.length - 4, 0));
      return last.reduce<[number, number, number, number]>(
        (a, st) => [
          a[0] + st.lines.revenue,
          a[1] + ledgerEbit(st.lines),
          a[2] + ledgerNetIncome(st.lines),
          a[3] + st.lines.dividends,
        ],
        [0, 0, 0, 0],
      );
    });
    const equity = (c: Company): number => c.finance.archive.quarters.at(-1)?.balance.equity ?? 0.0;
    const status = (i: number): CompanyStatus => (companies[i] as Company).finance.distress.status;
    const inGame = (c: Company): boolean => c.finance.distress.status !== "Removed";
    // CompanyStatus::is_frozen: Bankrupt or Removed.
    const alive = (i: number): boolean => {
      const st = status(i);
      return st !== "Bankrupt" && st !== "Removed";
    };
    const cap = (i: number): number => {
      const st = stocks[i];
      return st?.quoted ? st.price * st.shares : 0.0;
    };
    const bornYear = (c: Company): number | null => (c.origin.kind === "Born" ? c.origin.date.year : null);
    const views = sim.views();
    const births = views.births.data;
    // sim::views::industry_rows::companies_by_revenue: each industry's units by last month's
    // revenue, biggest first, ties to the lower company id.
    const ranked: [CompanyId, number][][] = w.industries.map(() => []);
    for (const u of w.units) ranked[u.industry]?.push([u.company, u.revenue_m]);
    for (const list of ranked) list.sort((a, b) => totalCmp(b[1], a[1]) || a[0] - b[0]);

    // Industries.
    const hhis: number[] = [];
    const top1s: number[] = [];
    w.industries.forEach((ind, k) => {
      const members: number[] = [];
      companies.forEach((c, i) => {
        if (c.industry === k && inGame(c)) members.push(i);
      });
      const count = (st: CompanyStatus): number => members.filter((i) => status(i) === st).length;
      const quoted = members.filter((i) => stocks[i]?.quoted).length;
      const bornAlive = members.filter((i) => alive(i) && bornYear(companies[i] as Company) !== null).length;
      const birthsInYear = births.births.filter((b) => b.date.year === year && b.industry === k).length;
      const bankruptcies = companies.filter(
        (c) => c.industry === k && inYear(c.finance.bankrupt_on, year),
      ).length;
      const revs = (ranked[k] ?? []).map(([, r]) => r);
      const [t1, t4, t10, hhi] = concentration(revs);
      hhis.push(hhi);
      top1s.push(t1);
      const namedM = revs.reduce((a, r) => a + r, 0);
      const namedShare = namedM / maxF(namedM + ind.fringe_revenue_m, Number.MIN_VALUE);
      const liveUnits = w.units.filter((u) => u.industry === k && u.gross_assets > 0.0 && alive(u.company));
      const ga = liveUnits.reduce((a, u) => a + u.gross_assets, 0);
      const meanProd = liveUnits.reduce((a, u) => a + u.productivity, 0) / Math.max(liveUnits.length, 1);
      const fv = members.reduce((a, i) => a + (stocks[i]?.fair_value ?? 0), 0);
      const mc = members.reduce((a, i) => a + cap(i), 0);
      this.out.industries += `${[
        seed,
        year,
        ind.key,
        ind.params.trend_growth.toFixed(4),
        ind.lt.toFixed(4),
        ind.q_growth.toFixed(5),
        PHASE_NAMES[ind.phase_label],
        sci(ind.trend_demand),
        sci(ind.demand),
        sci(ind.supply),
        ind.supply_ratio.toFixed(4),
        ind.market_factor.toFixed(4),
        sci(ind.fringe_assets),
        sci(this.namedYear[k] ?? 0.0),
        sci(this.fringeYear[k] ?? 0.0),
        namedShare.toFixed(4),
        members.length,
        count("Active"),
        count("Distressed"),
        quoted,
        bornAlive,
        birthsInYear,
        bankruptcies,
        t1.toFixed(4),
        t4.toFixed(4),
        t10.toFixed(4),
        hhi.toFixed(4),
        meanProd.toFixed(2),
        sci(ga),
        sci(fv),
        sci(mc),
      ].join(",")}\n`;
    });

    // Companies, at the 2020 close and every tenth year.
    const yearsRun = year + 1 - EPOCH_YEAR;
    if (year === EPOCH_YEAR || yearsRun % 10 === 0) {
      companies.forEach((c, i) => {
        if (!inGame(c)) return;
        const st = stocks[i];
        if (st === undefined) return;
        const zone = st.exchange === null ? undefined : w.zones[st.exchange];
        const exchange = zone?.exchange_code ?? "";
        const country = w.countries[c.hq_country]?.key ?? "";
        const [rev, ebit, ni, div] = ttm[i] as [number, number, number, number];
        const g = gross[i] ?? 0;
        const prod = g > 0.0 ? (prodW[i] ?? 0) / g : 0.0;
        const firstUnit = c.units[0];
        const growth = firstUnit === undefined ? 0.0 : (w.units[firstUnit]?.growth_plan ?? 0.0);
        const by = bornYear(c);
        const assetBook = c.units.reduce((a, u) => a + (w.units[u]?.asset_book ?? 0), 0);
        this.out.companies += `${[
          seed,
          year,
          i,
          clean(c.name),
          w.industries[c.industry]?.key ?? "",
          by !== null ? "born" : "start",
          by === null ? "" : String(by),
          status(i),
          st.quoted ? 1 : 0,
          exchange,
          country,
          c.archetype,
          sci(rev),
          sci(ebit),
          sci(ni),
          sci(div),
          sci(c.cash_usd),
          sci(c.finance.line.drawn),
          sci(c.finance.line.limit),
          sci(assetBook),
          sci(equity(c)),
          sci(g),
          prod.toFixed(2),
          c.management_score.toFixed(2),
          ratingLabel(c.finance.rating),
          growth.toFixed(4),
          c.labor_units,
          st.price.toFixed(4),
          st.shares,
          sci(cap(i)),
          sci(st.fair_value),
        ].join(",")}\n`;
      });
    }

    // World.
    const aliveIds: number[] = [];
    companies.forEach((_, i) => {
      if (alive(i)) aliveIds.push(i);
    });
    const countStatus = (st: CompanyStatus): number =>
      companies.filter((c) => c.finance.distress.status === st).length;
    const startAlive = aliveIds.filter((i) => bornYear(companies[i] as Company) === null).length;
    const quotedAll = stocks.filter((x) => x.quoted).length;
    const sum = (f: (i: number) => number, ids: readonly number[]): number =>
      ids.reduce((a, i) => a + f(i), 0);
    const inGameIds: number[] = [];
    companies.forEach((c, i) => {
      if (inGame(c)) inGameIds.push(i);
    });
    const revs = aliveIds
      .map((i) => (ttm[i] as [number, number, number, number])[0])
      .filter((r) => r > 0.0)
      .sort(totalCmp);
    const margins = aliveIds
      .filter((i) => (ttm[i] as [number, number, number, number])[0] > 0.0)
      .map((i) => {
        const t = ttm[i] as [number, number, number, number];
        return t[1] / t[0];
      })
      .sort(totalCmp);
    const niPos =
      aliveIds.filter((i) => (ttm[i] as [number, number, number, number])[2] > 0.0).length /
      Math.max(aliveIds.length, 1);
    const revTotal = revs.reduce((a, r) => a + r, 0);
    const top10 =
      [...revs]
        .reverse()
        .slice(0, 10)
        .reduce((a, r) => a + r, 0) / maxF(revTotal, Number.MIN_VALUE);
    const fvQuoted = sum((i) => (stocks[i]?.quoted ? (stocks[i]?.fair_value ?? 0) : 0.0), aliveIds);
    const hhiMean = hhis.reduce((a, h) => a + h, 0) / Math.max(hhis.length, 1);
    const hhiMax = hhis.reduce((a, h) => maxF(a, h), 0.0);
    const top1Max = top1s.reduce((a, h) => maxF(a, h), 0.0);
    const demand = w.industries.reduce((a, d) => a + d.demand, 0);
    const trend = w.industries.reduce((a, d) => a + d.trend_demand, 0);
    const supply = w.industries.reduce((a, d) => a + d.supply, 0);
    const bankruptciesTotal = companies.filter((c) => c.finance.bankrupt_on !== null).length;
    this.out.world += `${[
      seed,
      year,
      w.ai.stage,
      formatSimDate(w.ai.pop_date),
      w.ai.ai_labs_lt.toFixed(4),
      w.base_rate.toFixed(4),
      sci(demand),
      sci(trend),
      sci(supply),
      companies.length,
      inGameIds.length,
      countStatus("Active"),
      countStatus("Distressed"),
      countStatus("Bankrupt"),
      countStatus("Removed"),
      startAlive,
      aliveIds.length - startAlive,
      quotedAll,
      aliveIds.filter((i) => !stocks[i]?.quoted).length,
      births.births.length,
      bankruptciesTotal,
      sci(sum((i) => (companies[i] as Company).cash_usd, inGameIds)),
      sci(sum((i) => (companies[i] as Company).finance.line.drawn, inGameIds)),
      sci(sum((i) => equity(companies[i] as Company), inGameIds)),
      sci(sum((i) => gross[i] ?? 0, inGameIds)),
      sci(sum((i) => stocks[i]?.fair_value ?? 0, aliveIds)),
      sci(sum(cap, aliveIds)),
      sci(fvQuoted),
      sci(quantile(revs, 0.1)),
      sci(quantile(revs, 0.5)),
      sci(quantile(revs, 0.9)),
      sci(revs.at(-1) ?? 0.0),
      quantile(margins, 0.1).toFixed(4),
      quantile(margins, 0.5).toFixed(4),
      quantile(margins, 0.9).toFixed(4),
      niPos.toFixed(4),
      top10.toFixed(4),
      hhiMean.toFixed(4),
      hhiMax.toFixed(4),
      top1Max.toFixed(4),
      births.full_characters,
      w.characters.length,
      w.books_check.checked,
      w.books_check.failures,
    ].join(",")}\n`;

    // Zones.
    w.zones.forEach((zone, z) => {
      const listed: number[] = [];
      stocks.forEach((st, i) => {
        if (st.quoted && st.exchange === z) listed.push(i);
      });
      const mc = sum(cap, listed);
      const fv = sum((i) => stocks[i]?.fair_value ?? 0, listed);
      const level = indexLevel(w.market.indices[z], mc);
      this.out.zones += `${[
        seed,
        year,
        zone.exchange_code,
        level === null ? "" : sci(level),
        listed.length,
        sci(mc),
        sci(fv),
        zone.confidence.toFixed(3),
        zone.credit_spread.toFixed(6),
      ].join(",")}\n`;
    });
    this.namedYear = this.namedYear.map(() => 0);
    this.fringeYear = this.fringeYear.map(() => 0);
  }
}

/** Rust `ExchangeIndex::level` (spec 5.14): `Σ cap ÷ divisor`; null with no listing. */
function indexLevel(x: ExchangeIndex | undefined, totalCap: number): number | null {
  return x === undefined || x.divisor === null ? null : totalCap / x.divisor;
}

function soakSim(sim: SoakSimApi): SoakSim {
  if (!isSoakSim(sim)) throw new Error("--detail needs a sim with soakWorld() and soakStats() (SoakSim)");
  return sim;
}
