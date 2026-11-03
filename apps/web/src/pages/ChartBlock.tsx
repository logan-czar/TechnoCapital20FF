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
import type { ChartModel, SeriesTone, Tone, ValueFormat } from "./doc.ts";

/**
 * The theme palette (styles.css), for the canvas, and the series colors: cyan, amber, magenta, green
 * and violet at OKLCH L 0.60 to 0.66, which pass the dataviz checks on the chart surface.
 */
const TONES: Readonly<Record<Tone | SeriesTone, string>> = {
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
  series1: "#05a5b3",
  series2: "#c68206",
  series3: "#cd509f",
  series4: "#01a84d",
  series5: "#796ae5",
};
const GRID = "#1e2430";
const DAY = 86_400;
/**
 * lightweight-charts rejects values beyond ±MAX_SAFE_INTEGER / 100 (about $90T), which a 1995 run's
 * world GDP passes, so a chart with values above SCALE_ABOVE is drawn in millions and labelled back.
 */
const SCALE_ABOVE = 1e12;
const SCALE = 1e6;

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

/** The divisor the chart's values are drawn with: SCALE when any value passes SCALE_ABOVE, else 1. */
function valueScale(m: ChartModel): number {
  const values = m.series.flatMap((s) =>
    s.k === "candles"
      ? s.bars.flatMap((b) => [b.high, b.low, ...(b.band ?? [])])
      : s.k === "band"
        ? s.bands.flatMap((b) => b ?? [])
        : s.values,
  );
  return values.some((v) => Math.abs(v) > SCALE_ABOVE) ? SCALE : 1;
}

function draw(c: IChartApi, m: ChartModel): void {
  const dated = m.series.some((s) => s.k === "candles");
  const k = valueScale(m);
  const at = (v: number) => v / k;
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
            open: at(b.open),
            high: at(b.high),
            low: at(b.low),
            close: at(b.close),
          })),
        );
        low.setData(
          s.bars.map((b) =>
            b.band ? { time: formatSimDate(b.date), value: at(b.band[0]) } : { time: formatSimDate(b.date) },
          ),
        );
        high.setData(
          s.bars.map((b) =>
            b.band ? { time: formatSimDate(b.date), value: at(b.band[1]) } : { time: formatSimDate(b.date) },
          ),
        );
        first ??= series;
        break;
      }
      case "line": {
        const series = c.addSeries(LineSeries, { color: TONES[s.tone], lineWidth: 2, title: s.name });
        series.setData(s.values.map((value, i) => ({ time: slotTime(i), value: at(value) })));
        first ??= series;
        break;
      }
      case "bars": {
        const series = c.addSeries(HistogramSeries, { title: s.name, priceLineVisible: false });
        series.setData(
          s.values.map((value, i) => ({
            time: slotTime(i),
            value: at(value),
            color: s.tone ? TONES[s.tone] : value < 0 ? TONES.loss : TONES.gain,
          })),
        );
        first ??= series;
        break;
      }
      case "band": {
        const low = c.addSeries(LineSeries, dashed(TONES[s.tone]));
        const high = c.addSeries(LineSeries, dashed(TONES[s.tone]));
        low.setData(
          s.bands.map((b, i) => (b ? { time: slotTime(i), value: at(b[0]) } : { time: slotTime(i) })),
        );
        high.setData(
          s.bands.map((b, i) => (b ? { time: slotTime(i), value: at(b[1]) } : { time: slotTime(i) })),
        );
        break;
      }
    }
  }
  if (m.reference && first) {
    first.createPriceLine({
      price: at(m.reference.value),
      color: TONES[m.reference.tone],
      lineStyle: LineStyle.Dotted,
    });
  }
  const priceFormatter = (v: number) => formatValue(m.format, v * k);
  if (!dated) {
    // Slot labels on the axis and in the readout.
    const label = (t: Time) => m.labels[Math.round(Number(t) / DAY) - 1] ?? "";
    c.applyOptions({
      timeScale: { tickMarkFormatter: label },
      localization: { timeFormatter: label, priceFormatter },
    });
  } else {
    c.applyOptions({ localization: { priceFormatter } });
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
    // A chart drawn in a small pane must fit its data again when the pane grows.
    let width = el.clientWidth;
    const refit = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      c.timeScale().fitContent();
    });
    refit.observe(el);
    return () => {
      refit.disconnect();
      c.remove();
    };
  }, [chart]);
  return (
    <figure className="chart-box">
      <figcaption className="muted small">{chart.title}</figcaption>
      <div ref={host} style={{ height: CHART_HEIGHT, position: "relative" }} />
    </figure>
  );
}
