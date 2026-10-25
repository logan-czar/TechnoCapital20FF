// The mock views generator: a typed `SimViews` with plausible numbers, built from the starting
// CSVs (mockWorld.ts). The real views land with the sim port (Step 3); this keeps the same shapes
// so the UI is written against the contract. Only the views the shell reads are filled with
// content (clock, places, countries, zones, quotes, price_bars, company_rows, industry_rows, news);
// the rest are valid and empty.

import type {
  ClockView,
  CompanyId,
  CompanyRow,
  CountryId,
  DailyBar,
  DateTime,
  Figure,
  Headline,
  IndustryId,
  IndustryRow,
  QuoteRow,
  SimDate,
  SimViews,
  SkipKind,
  View,
  ZoneId,
} from "@tc20ff/sim";
import { dateOfDays, dateTimeDate, dateTimeHour, dateTimeWeekday, phaseAt } from "./calendar.ts";
import { hashStr, type MockWorld, unitHash } from "./mockWorld.ts";

/** A small seeded generator (sfc32): the mock's own, so mock numbers never touch the sim's streams. */
export class MockRng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  constructor(seed: number) {
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = seed >>> 0;
    for (let i = 0; i < 12; i++) this.next();
  }
  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  /** Roughly standard normal (sum of three uniforms, scaled). */
  normal(): number {
    return (this.next() + this.next() + this.next() - 1.5) * 2;
  }
}

/** A figure as the UI sees it: exact when published, else a band of about +/-25% (D420). */
export function shown(value: number, banded: boolean, key: string): Figure {
  if (!banded) return exact(value);
  const estimate = value * (0.9 + 0.2 * unitHash(key, 31));
  return {
    kind: "Band",
    band: { estimate, low: Math.min(value, estimate) * 0.75, high: Math.max(value, estimate) * 1.25 },
  };
}

export const exact = (value: number) => ({ kind: "Exact" as const, value });
const view = <T>(data: T, version: number): View<T> => ({ data, version, dirty: false });

/** How many of the biggest listed companies carry daily bars in the mock (a worker-cost bound). */
export const MOCK_BAR_COMPANIES = 40;
/** Daily bars of history a new mock game starts with. */
export const MOCK_BAR_HISTORY_DAYS = 180;
/** Index points: every exchange starts here. */
const INDEX_START = 1000;
/** The 15% fair value band (spec 3.14.2). */
const EFV_BAND = 0.15;

/**
 * A `BarHistory` over plain bars, in one closed chunk per calendar month and the latest month open
 * (D139, D148), as the real market keeps them, so readers must flatten both (`barRows`).
 */
export function barHistory(bars: DailyBar[]) {
  const months: DailyBar[][] = [];
  let last: DailyBar | undefined;
  for (const b of bars) {
    if (last && last.date.year === b.date.year && last.date.month === b.date.month) {
      (months[months.length - 1] as DailyBar[]).push(b);
    } else {
      months.push([b]);
    }
    last = b;
  }
  const open = months.pop() ?? [];
  return { log: { closed: { slots: months, len: months.length }, open: { slots: open, len: open.length } } };
}

/** Per-listed-company price state the mock walks. */
export interface MockStock {
  id: CompanyId;
  exchange: ZoneId;
  price: number;
  prevClose: number;
  efv: number;
  shares: number;
  /** The open daily bar being built. */
  open: number;
  high: number;
  low: number;
  buzz: number;
}

export function initialStocks(w: MockWorld): MockStock[] {
  return w.listed.map((id) => {
    const c = w.companies[id] as (typeof w.companies)[number];
    return {
      id,
      exchange: c.zone as ZoneId,
      price: c.startPrice,
      prevClose: c.startPrice,
      efv: c.startPrice * (1 + (unitHash(c.key, 7) - 0.5) * 0.2),
      shares: c.shares,
      open: c.startPrice,
      high: c.startPrice,
      low: c.startPrice,
      buzz: Math.floor((unitHash(c.key, 9) - 0.5) * 80),
    };
  });
}

/** One hourly random-walk step of every stock (volatility from the company key, a small drift). */
export function stepStocks(stocks: MockStock[], rng: MockRng, w: MockWorld): void {
  for (const s of stocks) {
    const vol = 0.002 + 0.004 * unitHash((w.companies[s.id] as { key: string }).key, 11);
    s.price = Math.max(0.5, s.price * (1 + vol * rng.normal()));
    s.efv += (s.price - s.efv) * 0.002;
    if (s.price > s.high) s.high = s.price;
    if (s.price < s.low) s.low = s.price;
  }
}

/** Closes the daily bar of every stock and returns the bar per company. */
export function closeDay(stocks: MockStock[], date: SimDate): Map<CompanyId, DailyBar> {
  const out = new Map<CompanyId, DailyBar>();
  for (const s of stocks) {
    out.set(s.id, { date, open: s.open, high: s.high, low: s.low, close: s.price, efv: s.efv });
    s.prevClose = s.price;
    s.open = s.price;
    s.high = s.price;
    s.low = s.price;
  }
  return out;
}

export function quotesView(
  stocks: MockStock[],
  w: MockWorld,
  indexLevels: number[],
): SimViews["quotes"]["data"] {
  const rows: QuoteRow[] = stocks.map((s) => ({
    id: s.id,
    exchange: s.exchange,
    last: s.price,
    prev_close: s.prevClose,
    change: s.price - s.prevClose,
    change_pct: s.prevClose > 0 ? (s.price - s.prevClose) / s.prevClose : 0,
    volume: 0,
    efv: s.efv,
    efv_low: s.efv * (1 - EFV_BAND),
    efv_high: s.efv * (1 + EFV_BAND),
    buzz: s.buzz,
    market_cap: s.price * s.shares,
    value: null,
  }));
  return {
    rows,
    indices: w.data.financial_zones.rows.map((_, i) => ({
      zone: i as ZoneId,
      level: indexLevels[i] ?? null,
      prev_close: indexLevels[i] ?? null,
    })),
  };
}

/** The mock history: a backwards walk ending at each stock's price now, one bar a day. */
export function initialBars(stocks: MockStock[], w: MockWorld, rng: MockRng, endDay: number) {
  const top = [...stocks]
    .sort((a, b) => b.price * b.shares - a.price * a.shares || a.id - b.id)
    .slice(0, MOCK_BAR_COMPANIES)
    .sort((a, b) => a.id - b.id);
  return top.map((s) => {
    const key = (w.companies[s.id] as { key: string }).key;
    const vol = 0.008 + 0.012 * unitHash(key, 13);
    const closes: number[] = [s.price];
    for (let i = 1; i < MOCK_BAR_HISTORY_DAYS; i++) {
      const prev = closes[i - 1] as number;
      closes.push(Math.max(0.5, prev / (1 + vol * rng.normal())));
    }
    closes.reverse();
    const bars: DailyBar[] = closes.map((close, i) => {
      const open = i === 0 ? close : (closes[i - 1] as number);
      const spread = Math.abs(close - open) + close * vol * 0.5 * rng.next();
      return {
        date: dateOfDays(endDay - MOCK_BAR_HISTORY_DAYS + i),
        open,
        high: Math.max(open, close) + spread * 0.5,
        low: Math.max(0.1, Math.min(open, close) - spread * 0.5),
        close,
        efv: close * (1 + (unitHash(key, i) - 0.5) * 0.1),
      };
    });
    return { id: s.id, bars: barHistory(bars) };
  });
}

export function companyRowsView(w: MockWorld, stocks: MockStock[]): CompanyRow[] {
  const byId = new Map(stocks.map((s) => [s.id, s]));
  return w.companies.map((c): CompanyRow => {
    const s = byId.get(c.id);
    return {
      id: c.id,
      key: c.key,
      name: c.name,
      ticker: c.ticker,
      industry: c.industry,
      hq_country: c.country,
      public: c.public,
      revenue_ttm: shown(c.revenueUsd, !c.public, `${c.key}r`),
      net_income_ttm: shown(c.revenueUsd * (0.04 + 0.12 * unitHash(c.key, 3)), !c.public, `${c.key}n`),
      rating: c.rating,
      status: c.status,
      exchange: s ? s.exchange : null,
      price: s ? s.price : 0,
      change: s && s.prevClose > 0 ? (s.price - s.prevClose) / s.prevClose : 0,
      value: shown(s ? s.price * s.shares : c.valueUsd * 0.7, !c.public, `${c.key}v`),
      archetype: "Incumbent",
      origin: { kind: "Start" },
      listing: s ? { kind: "BeforeStart", exchange: s.exchange } : { kind: "Private" },
      owner_of_record: null,
      owner_of_record_name: null,
      controller: { kind: "None" },
      controller_name: null,
      estimated: !c.public,
    };
  });
}

export function industryRowsView(w: MockWorld, now: DateTime): IndustryRow[] {
  const year = now / (24 * 365);
  return w.data.industries.rows.map((x, i): IndustryRow => {
    const demand = x.world_size_2020_usd_bn * 1e9 * (1 + x.trend_growth) ** year;
    const supplyRatio = 1 + (unitHash(x.id, 21) - 0.5) * 0.2;
    const labels = ["Boom", "Normal", "Normal", "Glut", "Bust"] as const;
    const top = w.companies
      .filter((c) => c.industry === (i as IndustryId))
      .sort((a, b) => b.revenueUsd - a.revenueUsd || a.id - b.id)
      .slice(0, 5)
      .map((c) => c.id);
    return {
      id: i as IndustryId,
      key: x.id,
      name: x.name,
      sector: x.sector,
      demand,
      trend_demand: demand,
      supply: exact(demand * supplyRatio),
      supply_ratio: exact(supplyRatio),
      market_factor: exact(1 / supplyRatio),
      phase_label: labels[hashStr(x.id) % labels.length] as IndustryRow["phase_label"],
      lt: x.trend_growth,
      growth_annual: x.trend_growth + (unitHash(x.id, 22) - 0.5) * 0.04,
      fringe_share: exact(0.1 + 0.2 * unitHash(x.id, 23)),
      named_revenue_m: exact((demand / 12) * 0.8),
      fringe_revenue_m: exact((demand / 12) * 0.2),
      top_companies: top,
      estimated: false,
    };
  });
}

const NEWS_TEMPLATES = [
  "{n} posts a quarterly beat as margins widen",
  "{n} warns on demand; shares slip in early trade",
  "{n} announces a share buyback",
  "{n} raises capital in a secondary offering",
  "Analysts upgrade {n} on stronger cash flow",
];

export function mockHeadline(w: MockWorld, rng: MockRng, id: number, date: SimDate): Headline {
  const c = w.companies[Math.floor(rng.next() * w.companies.length)] as (typeof w.companies)[number];
  const text = (NEWS_TEMPLATES[Math.floor(rng.next() * NEWS_TEMPLATES.length)] as string).replace(
    "{n}",
    c.name,
  );
  return {
    id,
    date,
    industry: c.industry,
    company: c.id,
    event: null,
    kind: { kind: "StartupLaunch" },
    text,
  } as Headline;
}

export function clockView(
  now: DateTime,
  speed: number,
  selected: number,
  paused: boolean,
  skipping: SkipKind | null,
): ClockView {
  const p = phaseAt(now);
  return {
    now,
    date: dateTimeDate(now),
    hour: dateTimeHour(now),
    weekday: dateTimeWeekday(now),
    speed,
    selected_speed: selected,
    paused,
    skipping,
    quarter_phase: p.phase,
    next_phase: p.nextPhase,
    days_to_next_phase: p.daysToNextPhase,
    next_release: p.nextRelease,
  };
}

/** A `SimViews` for a new game: every view present, those the shell reads filled. */
export function initialViews(
  w: MockWorld,
  stocks: MockStock[],
  rng: MockRng,
  clock: ClockView,
  indexLevels: number[],
): SimViews {
  const v = 1;
  const endDay = Math.floor(clock.now / 24);
  return {
    refresh: v,
    omniscient: false,
    clock: view(clock, v),
    places: view(
      {
        provinces: w.provinces.map((p) => ({ id: p.id, key: p.key, name: p.name, country: p.country })),
        countries: w.countryOrder.map((row, id) => {
          const c = w.data.countries.rows[row] as { iso3: string; name: string };
          return { id: id as CountryId, iso3: c.iso3, name: c.name };
        }),
      },
      v,
    ),
    countries: view(
      {
        countries: w.countryOrder.map((row, id) => {
          const c = w.data.countries.rows[row] as {
            iso3: string;
            name: string;
            superregion: string;
            gdp_usd_bn: number;
          };
          const hq = w.companies.filter((x) => x.country === id).map((x) => x.id);
          return {
            id: id as CountryId,
            iso3: c.iso3,
            name: c.name,
            superregion: c.superregion,
            zone: (w.zoneOfIso3.get(c.iso3) ?? 0) as ZoneId,
            zone_name: "",
            gdp_usd: c.gdp_usd_bn * 1e9,
            corp_tax_rate: 0.21,
            sovereign_rating: "Bbb",
            sovereign_spread: 0.01,
            hq_companies: hq,
          };
        }),
      },
      v,
    ),
    zones: view({ zones: [] }, v),
    rates: view({ base_rate: 0.02, zones: [], sovereigns: [], rating_spreads: [] }, v),
    characters: view({ full: [], partial: [] }, v),
    cap_table: view({ companies: [] }, v),
    quotes: view(quotesView(stocks, w, indexLevels), v),
    price_bars: view({ companies: initialBars(stocks, w, rng, endDay) }, v),
    exchanges: view({ exchanges: [] }, v),
    market_stats: view(
      {
        listed: stocks.length,
        quoted: stocks.length,
        median_gap: 0.05,
        within_band: stocks.length,
        mean_confidence: 0,
        reports: 0,
        beats: 0,
        misses: 0,
      },
      v,
    ),
    news: view({ feed: [] }, v),
    births: view(
      {
        events: [],
        births: [],
        listings: [],
        full_characters_made: 0,
        full_characters: 0,
        births_column_quarters: [],
        births_by_industry: [],
      },
      v,
    ),
    projection: view({ elapsed_share: 0, companies: [] }, v),
    company_rows: view({ rows: companyRowsView(w, stocks) }, v),
    company_detail: view({ companies: [] }, v),
    units: view({ units: [] }, v),
    tech: view({ companies: [] }, v),
    industry_rows: view({ rows: industryRowsView(w, clock.now) }, v),
    industry_detail: view({ industries: [] }, v),
    cycle: view(
      {
        phase: "Expansion",
        g_t: 0.02,
        quarters_left: 4,
        z_avg: 0,
        base_rate: 0.02,
        zones: [],
        ai_stage: "Preboom",
        boom_year: null,
        boom_date: { year: 2023, month: 1, day: 1 },
        ai_labs_lt: 0.1,
        pop_date: null,
      },
      v,
    ),
    map_layers: view(
      {
        political: { country: [], contested: [] },
        country_names: [],
        tracks: [],
        zone: [],
        unit_assets: [],
        hqs: [],
        sectors: [],
        industry_names: [],
      },
      v,
    ),
    province_cards: view({ cards: [] }, v),
    statements: view({ companies: [] }, v),
    filings: view({ quarter: null, filings: [] }, v),
    ratings: view({ companies: [], base_rate: 0.02 }, v),
    recap: view({ recaps: [], watchlist: [] }, v),
    map_static: view({ provinces: [], metros: [], key_cities: [], regions: [], geo: null }, v),
  };
}

export { INDEX_START };
