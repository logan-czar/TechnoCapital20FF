// Chart blocks of the race and state pages: the poll average with the polls as points, and the
// forecast's odds over time. Each is a chart, its legend with the latest numbers, and a line saying
// what it is built from.

import type { Party, PersonRow, Poll } from "@tc20ff/sim";
import { formatDay } from "../_shared/index.ts";
import { type DotSet, LineChart, type LineSeries, seriesColors } from "./charts.tsx";
import { Candidate, Empty } from "./components.tsx";
import { type OddsPoint, personName } from "./hooks.ts";
import { dayNum, formatOdds, pollAverage } from "./model.ts";

/** The legend: a swatch, the candidate and the latest value. */
function Legend({
  columns,
  colors,
  values,
  people,
  parties,
}: {
  columns: readonly number[];
  colors: readonly string[];
  values: readonly string[];
  people: ReadonlyMap<number, PersonRow>;
  parties: readonly (Party | null)[];
}) {
  return (
    <ul className="polls-legend">
      {columns.map((c, i) => (
        <li key={c}>
          <span className="polls-swatch" style={{ background: colors[i] }} aria-hidden="true" />
          <Candidate id={c} people={people} party={parties[i] ?? null} />
          <span className="polls-legend-value">{values[i]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Rounds a percent range outward to the chart's grid. */
function percentRange(values: number[]): { yMin: number; yMax: number; yStep: number } {
  if (values.length === 0) return { yMin: 0, yMax: 100, yStep: 25 };
  const lo = Math.max(0, Math.floor((Math.min(...values) - 3) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...values) + 3) / 10) * 10);
  const span = Math.max(hi - lo, 10);
  return { yMin: lo, yMax: lo + span, yStep: span <= 30 ? 5 : 10 };
}

/**
 * The poll average over time with each poll as a point (pivot 8.4): one line per person of
 * `columns`, which is the stage's ballot order. The average is the plain one of model.ts
 * `pollAverage`; the polls carry the firms' house effects, which are hidden from the player.
 */
export function PollTrend({
  polls,
  columns,
  parties,
  people,
  rule,
  testId,
}: {
  polls: readonly Poll[];
  columns: readonly number[];
  /** Each column's party, for its colour. */
  parties: readonly (Party | null)[];
  people: ReadonlyMap<number, PersonRow>;
  /** A dashed rule at a day, such as election day. */
  rule?: { day: number; label: string };
  testId?: string;
}) {
  if (polls.length === 0) return <Empty testId="trend-empty">No polls have been published yet.</Empty>;
  const colors = seriesColors(parties);
  const avg = pollAverage(polls, columns);
  const lines: LineSeries[] = columns.map((c, i) => ({
    key: c,
    label: personName(people, c),
    color: colors[i] as string,
    points: avg.flatMap((a) => {
      const v = a.shares[i];
      return v === null || v === undefined ? [] : [{ x: a.day, y: v * 100 }];
    }),
  }));
  const dots: DotSet[] = columns.map((c, i) => ({
    color: colors[i] as string,
    points: polls.flatMap((p) => {
      const s = p.shares.find((x) => x.person === c);
      return s === undefined ? [] : [{ x: dayNum(p.published), y: s.share * 100 }];
    }),
  }));
  const all = [...lines, ...dots].flatMap((l) => l.points.map((q) => q.y));
  const last = avg[avg.length - 1];
  const latest = columns.map((_, i) => {
    const v = last?.shares[i];
    return v === null || v === undefined ? "-" : `${Math.round(v * 100)}%`;
  });
  const summary = `Poll average over time from ${polls.length} polls. Latest: ${columns
    .map((c, i) => `${personName(people, c)} ${latest[i]}`)
    .join(", ")}.`;
  return (
    <div className="polls-chartblock" data-testid={testId ?? "poll-trend"}>
      <LineChart
        lines={lines}
        dots={dots}
        {...percentRange(all)}
        yFormat={(v) => `${Math.round(v)}`}
        {...(rule === undefined ? {} : { rules: [{ x: rule.day, label: rule.label }] })}
        summary={summary}
        testId="poll-trend-svg"
      />
      <Legend columns={columns} colors={colors} values={latest} people={people} parties={parties} />
      <p className="polls-note">
        Lines are the average of polls from the last 14 days, weighted by sample; points are single polls.
        Latest poll {formatDay((polls[polls.length - 1] as Poll).published)}.
      </p>
    </div>
  );
}

/** The site's win odds on each run of its model, so far as this app has seen them. */
export function OddsHistory({
  history,
  columns,
  parties,
  people,
}: {
  history: readonly OddsPoint[];
  columns: readonly number[];
  parties: readonly (Party | null)[];
  people: ReadonlyMap<number, PersonRow>;
}) {
  if (history.length === 0) return <Empty testId="history-empty">The model has not run yet.</Empty>;
  const colors = seriesColors(parties);
  const lines: LineSeries[] = columns.map((c, i) => ({
    key: c,
    label: personName(people, c),
    color: colors[i] as string,
    points: history.flatMap((h) => {
      const o = h.odds.find((x) => x.person === c);
      return o === undefined ? [] : [{ x: h.day, y: o.win * 100 }];
    }),
  }));
  const lastRun = history[history.length - 1] as OddsPoint;
  const latest = columns.map((c) => {
    const o = lastRun.odds.find((x) => x.person === c);
    return o === undefined ? "-" : formatOdds(o.win);
  });
  return (
    <div className="polls-chartblock" data-testid="odds-history">
      <LineChart
        lines={lines}
        yMin={0}
        yMax={100}
        yStep={25}
        yFormat={(v) => `${Math.round(v)}%`}
        summary={`The forecast's win odds over ${history.length} runs. Latest: ${columns
          .map((c, i) => `${personName(people, c)} ${latest[i]}`)
          .join(", ")}.`}
        testId="odds-history-svg"
      />
      <Legend columns={columns} colors={colors} values={latest} people={people} parties={parties} />
      {history.length < 2 ? (
        <p className="polls-note" data-testid="history-short">
          The site publishes only its latest run; this history builds as the model reruns while you watch.
        </p>
      ) : (
        <p className="polls-note">{history.length} daily runs of the model seen since you opened Polls.</p>
      )}
    </div>
  );
}
