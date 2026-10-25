// The chart widget (replaces crates/game/src/chart): TradingView lightweight-charts. Price bars
// as candles with the estimated fair value and its +/-15% band (spec 3.14.2, 8 Pdoomberg F3), or
// any line series. A new last bar is an `update`, not a reset, so a daily frame does not redraw the
// whole history.

import type { DailyBar } from "@tc20ff/sim";
import { formatSimDate } from "@tc20ff/sim";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  LineSeries,
  LineStyle,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

const CYAN = "#00e5ff";
const MAGENTA = "#ff2bd6";
const AMBER = "#ffb000";
const TEXT = "#8d98ae";
const GRID = "#1e2430";
/** The fair value band (spec 3.14.2). */
const EFV_BAND = 0.15;

export interface LinePoint {
  time: string;
  value: number;
}

export interface PriceChartProps {
  /** Daily bars, oldest first. */
  bars?: readonly DailyBar[];
  /** Show the EFV line and its band over the candles. */
  efv?: boolean;
  /** A plain line series (when no bars are given). */
  line?: readonly LinePoint[];
  /** Changes when the data is a different series (another company): the chart resets instead of updating. */
  seriesKey?: string | number;
}

const toTime = (d: DailyBar["date"]): Time => formatSimDate(d) as Time;

function candle(b: DailyBar) {
  return { time: toTime(b.date), open: b.open, high: b.high, low: b.low, close: b.close };
}

/** Sets a series' data, or only `update`s its last point when one bar was added or changed. */
function sync<T extends { time: Time }>(series: ISeriesApi<"Candlestick" | "Line">, prev: number, next: T[]) {
  const s = series as ISeriesApi<"Line">;
  if (next.length === 0) {
    s.setData([]);
  } else if (prev > 0 && (next.length === prev || next.length === prev + 1)) {
    s.update(next[next.length - 1] as never);
  } else {
    s.setData(next as never);
  }
}

export function PriceChart({ bars, efv = true, line, seriesKey }: PriceChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<{
    candles: ISeriesApi<"Candlestick">;
    mid: ISeriesApi<"Line">;
    low: ISeriesApi<"Line">;
    high: ISeriesApi<"Line">;
    plain: ISeriesApi<"Line">;
    len: number;
    key: string;
  } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const c = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#161a22" }, textColor: TEXT },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID },
    });
    const dashed = (color: string) => ({
      color,
      lineWidth: 1 as const,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    series.current = {
      candles: c.addSeries(CandlestickSeries, {
        upColor: CYAN,
        borderUpColor: CYAN,
        wickUpColor: CYAN,
        downColor: MAGENTA,
        borderDownColor: MAGENTA,
        wickDownColor: MAGENTA,
      }),
      mid: c.addSeries(LineSeries, { ...dashed(AMBER), lineStyle: LineStyle.Solid }),
      low: c.addSeries(LineSeries, dashed(AMBER)),
      high: c.addSeries(LineSeries, dashed(AMBER)),
      plain: c.addSeries(LineSeries, { color: CYAN, lineWidth: 2 }),
      len: 0,
      key: "",
    };
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
    };
  }, []);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    const list = bars ?? [];
    const key = `${seriesKey ?? ""}|${efv}`;
    if (s.key !== key) {
      s.key = key;
      s.len = 0;
    }
    sync(s.candles, s.len, list.map(candle));
    sync(s.mid, s.len, efv ? list.map((b) => ({ time: toTime(b.date), value: b.efv })) : []);
    sync(s.low, s.len, efv ? list.map((b) => ({ time: toTime(b.date), value: b.efv * (1 - EFV_BAND) })) : []);
    sync(
      s.high,
      s.len,
      efv ? list.map((b) => ({ time: toTime(b.date), value: b.efv * (1 + EFV_BAND) })) : [],
    );
    sync(
      s.plain,
      s.len,
      (line ?? []).map((p) => ({ time: p.time as Time, value: p.value })),
    );
    if (s.len === 0 && list.length > 0) chart.current?.timeScale().fitContent();
    s.len = list.length || (line?.length ?? 0);
  }, [bars, efv, line, seriesKey]);

  return <div className="chart" ref={host} />;
}
