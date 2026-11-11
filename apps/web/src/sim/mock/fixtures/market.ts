// The stock market fixture (v_quotes, v_price_bars): a random walk per listed company, moved as it
// was from mockViews.ts.

import {
  type CompanyId,
  type DailyBar,
  type QuoteRow,
  type SimDate,
  type SimViews,
  simDateFromDaysSinceEpoch,
  type ZoneId,
} from "@tc20ff/sim";
import { type MockWorld, unitHash } from "../mockWorld.ts";
import type { MockRng } from "./rng.ts";

/** How many of the biggest listed companies carry daily bars in the mock (a worker-cost bound). */
export const MOCK_BAR_COMPANIES = 40;
/** Daily bars of history a new mock game starts with. */
export const MOCK_BAR_HISTORY_DAYS = 180;
/** Index points: every exchange starts here. */
export const INDEX_START = 1000;
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
        date: simDateFromDaysSinceEpoch(endDay - MOCK_BAR_HISTORY_DAYS + i),
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
