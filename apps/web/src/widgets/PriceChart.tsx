// The chart widget (replaces crates/game/src/chart): TradingView lightweight-charts. Price bars
// as candles with the estimated fair value and its +/-15% band (spec 3.14.2, 8 Pdoomberg F3), or
// any line series. A new last bar is an `update`, not a reset, so a daily frame does not redraw the
// whole history; any other change (another company, a different first bar) resets the data.

import type { DailyBar } from "@tc20ff/sim";
import { formatSimDate } from "@tc20ff/sim";
import {
  type CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
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

/** What the chart last drew: its length and first time, to tell an appended bar from new data. */
interface Drawn {
  len: number;
  first: Time | null;
  key: string;
}

const toTime = (d: DailyBar["date"]): Time => formatSimDate(d);

/** True when `next` is `prev` with its last point changed or one point added. */
function isAppend(prev: Drawn, next: readonly { time: Time }[]): boolean {
  return (
    prev.len > 0 && (next.length === prev.len || next.length === prev.len + 1) && next[0]?.time === prev.first
  );
}

function syncCandles(series: ISeriesApi<"Candlestick">, prev: Drawn, next: CandlestickData<Time>[]): void {
  const last = next[next.length - 1];
  if (last && isAppend(prev, next)) series.update(last);
  else series.setData(next);
}

function syncLine(series: ISeriesApi<"Line">, prev: Drawn, next: LineData<Time>[]): void {
  const last = next[next.length - 1];
  if (last && isAppend(prev, next)) series.update(last);
  else series.setData(next);
}

interface Series {
  candles: ISeriesApi<"Candlestick">;
  mid: ISeriesApi<"Line">;
  low: ISeriesApi<"Line">;
  high: ISeriesApi<"Line">;
  plain: ISeriesApi<"Line">;
  drawn: Drawn;
}

export function PriceChart({ bars, efv = true, line, seriesKey }: PriceChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<Series | null>(null);

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
      drawn: { len: 0, first: null, key: "" },
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
    // A new key (another company, the band toggled) redraws from scratch.
    const prev: Drawn = s.drawn.key === key ? s.drawn : { len: 0, first: null, key };
    const candles = list.map(
      (b): CandlestickData<Time> => ({
        time: toTime(b.date),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }),
    );
    const efvLine = (f: (b: DailyBar) => number): LineData<Time>[] =>
      efv ? list.map((b) => ({ time: toTime(b.date), value: f(b) })) : [];
    syncCandles(s.candles, prev, candles);
    syncLine(
      s.mid,
      prev,
      efvLine((b) => b.efv),
    );
    syncLine(
      s.low,
      prev,
      efvLine((b) => b.efv * (1 - EFV_BAND)),
    );
    syncLine(
      s.high,
      prev,
      efvLine((b) => b.efv * (1 + EFV_BAND)),
    );
    const plain = (line ?? []).map((p): LineData<Time> => ({ time: p.time, value: p.value }));
    syncLine(s.plain, prev, plain);
    if (prev.len === 0 && list.length > 0) chart.current?.timeScale().fitContent();
    const first = candles[0]?.time ?? plain[0]?.time ?? null;
    s.drawn = { len: list.length || plain.length, first, key };
  }, [bars, efv, line, seriesKey]);

  return <div className="chart" ref={host} />;
}
