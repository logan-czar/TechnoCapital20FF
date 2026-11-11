// The Polls app's charts: small inline SVG, no library. A line chart (the poll average with the
// polls as points, and the forecast's odds over time) and a range bar (a party's seat or
// electoral-vote range). Colours come from CSS variables (polls.css and the party colours of
// apps/_shared), so a theme changes them in one place; every chart carries a text summary for a
// screen reader, and the numbers are printed beside it, never only in colour.

import type { Party } from "@tc20ff/sim";
import { simDateFromDaysSinceEpoch } from "@tc20ff/sim";
import { useLayoutEffect, useRef, useState } from "react";
import { MONTH_NAMES_SHORT } from "../_shared/index.ts";

/** The colour a party's line is drawn in (the shared party colours). */
export function partyColor(party: Party | null): string {
  if (party === null) return "var(--party-none)";
  return party === "Democrats" ? "var(--party-a)" : "var(--party-b)";
}

/** The colours of a list of candidates: their parties' colours, or distinct ones when two share a party (a primary). */
export function seriesColors(parties: readonly (Party | null)[]): string[] {
  const distinct = new Set(parties.map((p) => p ?? "none"));
  if (distinct.size === parties.length) return parties.map(partyColor);
  return parties.map((_, i) => `var(--polls-ser-${i % 8})`);
}

/** "3 Nov" for a day number. */
export function dayLabel(day: number): string {
  const d = simDateFromDaysSinceEpoch(day);
  return `${d.day} ${MONTH_NAMES_SHORT[d.month - 1]}`;
}

export interface LineSeries {
  key: string | number;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

export interface DotSet {
  color: string;
  points: { x: number; y: number }[];
}

export interface LineChartProps {
  lines: LineSeries[];
  /** Individual observations (the polls), drawn under the lines. */
  dots?: DotSet[];
  yMin: number;
  yMax: number;
  yStep: number;
  yFormat: (v: number) => string;
  /** A dashed vertical rule, such as election day. */
  rules?: { x: number; label: string }[];
  /** The screen-reader summary. */
  summary: string;
  testId?: string;
}

/** A chart's width before it is measured (and in a DOM with no layout). */
const DEFAULT_W = 480;
const MIN_W = 260;
const H = 200;
const PAD = { l: 38, r: 44, t: 10, b: 24 };

/** The width of the box a chart sits in, so its text is drawn at its true size. */
function useChartWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(DEFAULT_W);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const read = () => {
      if (el.clientWidth > 0) setW(Math.max(MIN_W, Math.floor(el.clientWidth)));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(lo: number, hi: number, n: number): number[] {
  const step = Math.max(1, Math.ceil((hi - lo) / n));
  const out: number[] = [];
  for (let v = lo; v <= hi; v += step) out.push(v);
  if (out[out.length - 1] !== hi) out.push(hi);
  return out;
}

/** Lines and dots over days: x is a day number, y is whatever `yFormat` prints. */
export function LineChart(p: LineChartProps) {
  const [box, W] = useChartWidth();
  const xs = [
    ...p.lines.flatMap((l) => l.points.map((q) => q.x)),
    ...(p.dots ?? []).flatMap((d) => d.points.map((q) => q.x)),
    ...(p.rules ?? []).map((r) => r.x),
  ];
  if (xs.length === 0) return null;
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  if (x1 - x0 < 6) {
    const mid = (x0 + x1) / 2;
    x0 = mid - 3;
    x1 = mid + 3;
  }
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - (y - p.yMin) / (p.yMax - p.yMin)) * (H - PAD.t - PAD.b);
  const yTicks: number[] = [];
  for (let v = p.yMin; v <= p.yMax + 1e-9; v += p.yStep) yTicks.push(v);
  const xTicks = niceTicks(Math.ceil(x0), Math.floor(x1), 4);
  return (
    <div ref={box} className="polls-chartbox">
      <svg
        className="polls-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={p.summary}
        data-testid={p.testId}
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{p.summary}</title>
        {yTicks.map((v) => (
          <g key={v}>
            <line className="polls-grid" x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} />
            <text className="polls-axis" x={PAD.l - 6} y={sy(v)} textAnchor="end" dominantBaseline="middle">
              {p.yFormat(v)}
            </text>
          </g>
        ))}
        {xTicks.map((v) => (
          <text key={v} className="polls-axis" x={sx(v)} y={H - 6} textAnchor="middle">
            {dayLabel(v)}
          </text>
        ))}
        {(p.rules ?? []).map((r) => (
          <g key={r.label}>
            <line className="polls-rule" x1={sx(r.x)} x2={sx(r.x)} y1={PAD.t} y2={H - PAD.b} />
            <text className="polls-axis" x={sx(r.x)} y={PAD.t + 8} textAnchor="end" dx={-3}>
              {r.label}
            </text>
          </g>
        ))}
        {(p.dots ?? []).map((d, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: dot sets are in series order
          <g key={i} fill={d.color} fillOpacity={0.4}>
            {d.points.map((q) => (
              <circle key={`${q.x}/${q.y}`} cx={sx(q.x)} cy={sy(q.y)} r={2.8} />
            ))}
          </g>
        ))}
        {p.lines.map((l) => {
          const last = l.points[l.points.length - 1];
          return (
            <g key={l.key} stroke={l.color} fill={l.color}>
              {l.points.length > 1 ? (
                <polyline
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  points={l.points.map((q) => `${sx(q.x)},${sy(q.y)}`).join(" ")}
                />
              ) : null}
              {last === undefined ? null : (
                <>
                  <circle cx={sx(last.x)} cy={sy(last.y)} r={3.4} stroke="none" />
                  <text
                    className="polls-endlabel"
                    x={sx(last.x) + 7}
                    y={sy(last.y)}
                    dominantBaseline="middle"
                    stroke="none"
                  >
                    {p.yFormat(last.y)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export interface RangeRow {
  key: string;
  label: string;
  color: string;
  /** The 10th, 50th and 90th percentiles. */
  range: readonly [number, number, number];
}

/**
 * A party's range of seats (or electoral votes) on a 0 to `total` axis: a band from the 10th to the
 * 90th percentile, a tick at the middle estimate and a dashed rule where control is won.
 */
export function RangeBar(p: {
  total: number;
  majority: number;
  majorityLabel: string;
  rows: RangeRow[];
  summary: string;
  testId?: string;
}) {
  const [box, W] = useChartWidth();
  const rowH = 40;
  const h = PAD.t + 14 + p.rows.length * rowH + 22;
  const sx = (v: number) => 14 + (v / p.total) * (W - 28);
  const ticks = niceTicks(0, p.total, 5);
  return (
    <div ref={box} className="polls-chartbox">
      <svg
        className="polls-chart polls-range"
        viewBox={`0 0 ${W} ${h}`}
        role="img"
        aria-label={p.summary}
        data-testid={p.testId}
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{p.summary}</title>
        {p.rows.map((r, i) => {
          const y = PAD.t + 14 + i * rowH;
          return (
            <g key={r.key}>
              <rect
                className="polls-track"
                x={sx(0)}
                y={y + 16}
                width={sx(p.total) - sx(0)}
                height={14}
                rx={2}
              />
              <rect
                x={sx(r.range[0])}
                y={y + 16}
                width={Math.max(2, sx(r.range[2]) - sx(r.range[0]))}
                height={14}
                rx={2}
                fill={r.color}
                fillOpacity={0.4}
                stroke={r.color}
              />
              <line
                x1={sx(r.range[1])}
                x2={sx(r.range[1])}
                y1={y + 12}
                y2={y + 34}
                stroke={r.color}
                strokeWidth={3}
              />
              <text
                className="polls-endlabel"
                x={sx(r.range[1])}
                y={y + 8}
                textAnchor={
                  r.range[1] < p.total * 0.2 ? "start" : r.range[1] > p.total * 0.8 ? "end" : "middle"
                }
              >
                {r.label} {r.range[1]} ({r.range[0]} to {r.range[2]})
              </text>
            </g>
          );
        })}
        <line className="polls-rule" x1={sx(p.majority)} x2={sx(p.majority)} y1={PAD.t + 6} y2={h - 20} />
        <text className="polls-axis" x={sx(p.majority)} y={PAD.t + 2} textAnchor="middle">
          {p.majorityLabel}
        </text>
        {ticks.map((v) => (
          <text key={v} className="polls-axis" x={sx(v)} y={h - 6} textAnchor="middle">
            {v}
          </text>
        ))}
      </svg>
    </div>
  );
}
