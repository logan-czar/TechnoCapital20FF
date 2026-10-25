// A doc chart block (crates/game/src/chart, D457): a ChartModel drawn with lightweight-charts.
// Candles are dated; the other series have one value per x slot, so the slots become fake days
// (slot i is day i) and the axis and readout show the model's labels instead. A band series is a
// pair of dashed lines (low and high) where the figure is a band, and nothing where it is exact
// (D466: never a line at the hidden estimate). Loaded lazily (DocView), with the chart library.

import { formatSimDate } from "@tc20ff/sim";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  LineSeries,
  LineStyle,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { money, percent, price } from "../widgets/cells.ts";
import type { ChartModel, Tone, ValueFormat } from "./doc.ts";

/** The theme palette (styles.css), for the canvas. */
const TONES: Readonly<Record<Tone, string>> = {
  text: "#e6e8ee",
  muted: "#8d98ae",
  link: "#8ec5ff",
  cyan: "#00e5ff",
  amber: "#ffb000",
  magenta: "#ff2bd6",
  green: "#39ff88",
  gain: "#00e5ff",
  loss: "#ff2bd6",
  band: "#ffb000",
};
const GRID = "#1e2430";
const DAY = 86_400;

/** The height a chart block takes (doc.rs CHART_HEIGHT). */
export const CHART_HEIGHT = 230;

function formatValue(f: ValueFormat, v: number): string {
  switch (f) {
    case "Price":
      return price(v);
    case "Money":
      return money(v);
    case "Percent":
      return percent(v);
    case "Number":
      return v.toFixed(2);
  }
}

const slotTime = (i: number): Time => ((i + 1) * DAY) as UTCTimestamp;

function draw(c: IChartApi, m: ChartModel): void {
  const dated = m.series.some((s) => s.k === "candles");
  const dashed = (color: string) => ({
    color,
    lineWidth: 1 as const,
    lineStyle: LineStyle.Dashed,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  let first: {
    createPriceLine: (o: { price: number; color: string; lineStyle: LineStyle }) => unknown;
  } | null = null;
  for (const s of m.series) {
    switch (s.k) {
      case "candles": {
        const low = c.addSeries(LineSeries, dashed(TONES.amber));
        const high = c.addSeries(LineSeries, dashed(TONES.amber));
        const series = c.addSeries(CandlestickSeries, {
          upColor: TONES.cyan,
          borderUpColor: TONES.cyan,
          wickUpColor: TONES.cyan,
          downColor: TONES.magenta,
          borderDownColor: TONES.magenta,
          wickDownColor: TONES.magenta,
        });
        series.setData(
          s.bars.map((b) => ({
            time: formatSimDate(b.date),
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          })),
        );
        low.setData(
          s.bars.map((b) =>
            b.band ? { time: formatSimDate(b.date), value: b.band[0] } : { time: formatSimDate(b.date) },
          ),
        );
        high.setData(
          s.bars.map((b) =>
            b.band ? { time: formatSimDate(b.date), value: b.band[1] } : { time: formatSimDate(b.date) },
          ),
        );
        first ??= series;
        break;
      }
      case "line": {
        const series = c.addSeries(LineSeries, { color: TONES[s.tone], lineWidth: 2, title: s.name });
        series.setData(s.values.map((value, i) => ({ time: slotTime(i), value })));
        first ??= series;
        break;
      }
      case "bars": {
        const series = c.addSeries(HistogramSeries, { title: s.name, priceLineVisible: false });
        series.setData(
          s.values.map((value, i) => ({
            time: slotTime(i),
            value,
            color: s.tone ? TONES[s.tone] : value < 0 ? TONES.loss : TONES.gain,
          })),
        );
        first ??= series;
        break;
      }
      case "band": {
        const low = c.addSeries(LineSeries, dashed(TONES[s.tone]));
        const high = c.addSeries(LineSeries, dashed(TONES[s.tone]));
        low.setData(s.bands.map((b, i) => (b ? { time: slotTime(i), value: b[0] } : { time: slotTime(i) })));
        high.setData(s.bands.map((b, i) => (b ? { time: slotTime(i), value: b[1] } : { time: slotTime(i) })));
        break;
      }
    }
  }
  if (m.reference && first) {
    first.createPriceLine({
      price: m.reference.value,
      color: TONES[m.reference.tone],
      lineStyle: LineStyle.Dotted,
    });
  }
  if (!dated) {
    // Slot labels on the axis and in the readout.
    const label = (t: Time) => m.labels[Math.round(Number(t) / DAY) - 1] ?? "";
    c.applyOptions({
      timeScale: { tickMarkFormatter: label },
      localization: { timeFormatter: label, priceFormatter: (v: number) => formatValue(m.format, v) },
    });
  } else {
    c.applyOptions({ localization: { priceFormatter: (v: number) => formatValue(m.format, v) } });
  }
  c.timeScale().fitContent();
}

export function ChartBlock({ chart }: { chart: ChartModel }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const c = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#161a22" }, textColor: TONES.muted },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID },
    });
    draw(c, chart);
    return () => c.remove();
  }, [chart]);
  return (
    <figure className="chart-box">
      <figcaption className="muted small">{chart.title}</figcaption>
      <div ref={host} style={{ height: CHART_HEIGHT, position: "relative" }} />
    </figure>
  );
}
