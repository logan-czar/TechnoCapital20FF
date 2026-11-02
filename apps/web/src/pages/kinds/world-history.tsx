// The World History page (1995-rework 8.1): how this run went, from the history view. Long-run charts,
// a chronology and the top 10 every five years. The 2020 world has no long history, so it says so.

import type { CompanyId, ElectionResult, HistoryView, IndustryId, ZoneId } from "@tc20ff/sim";
import type { NameIndex } from "../../links/names.ts";
import type { Cell } from "../../widgets/cells.ts";
import {
  type Block,
  type ChartModel,
  type ChartSeries,
  emptyDoc,
  field,
  type PageDoc,
  span,
  type TableDoc,
  type Tone,
} from "../doc.ts";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage } from "../spec.ts";
import { linkCell } from "../tables.ts";
import type { ViewsData } from "../views.ts";

export const SECTIONS: readonly SectionSpec[] = [
  { id: "economy", title: "Economy" },
  { id: "industries", title: "Sectors and industries" },
  { id: "zones", title: "Regions" },
  { id: "chronology", title: "Chronology" },
  { id: "top10", title: "Top 10" },
];

const PAGE: PageRef = { kind: "world-history" };
/** A chart holds this many series at most, and the tables give the rest (dataviz: no 9th hue). */
const CHART_SERIES = 5;
/** Industries in the movers table. */
const TOP_INDUSTRIES = 10;
/** The theme's series colors, in a fixed order. */
const SERIES_TONES: readonly Tone[] = ["cyan", "amber", "magenta", "green", "link"];
const dash: Cell = { k: "text", v: "-" };

const note = (text: string): Block => ({ k: "line", spans: [span.muted(text)] });
const chart = (m: ChartModel): Block => ({ k: "chart", chart: m });
const table = (t: TableDoc): Block => ({ k: "table", table: t });

/**
 * A tone for each key, held by the key and not by its rank, so a line keeps its color as others come
 * and go: its key's own slot, or the next free one when another key took that.
 */
export function tonesByKey(keys: readonly number[]): Map<number, Tone> {
  const out = new Map<number, Tone>();
  const free = new Set(SERIES_TONES.keys());
  for (const key of [...keys].sort((a, b) => a - b)) {
    let slot = key % SERIES_TONES.length;
    while (!free.has(slot)) slot = (slot + 1) % SERIES_TONES.length;
    free.delete(slot);
    out.set(key, SERIES_TONES[slot] as Tone);
  }
  return out;
}

/** Each year's total, for shares. */
function totals(rows: readonly (readonly number[])[]): number[] {
  return rows.map((r) => r.reduce((a, b) => a + b, 0));
}

/** Each sector's share of world demand per year, in its sectors' first-seen order. */
export function sectorShares(h: HistoryView): { name: string; shares: number[] }[] {
  const sectors = h.run?.sectors ?? [];
  const names = [...new Set(sectors)];
  const total = totals(h.industry_demand_usd);
  return names.map((name) => ({
    name,
    shares: h.industry_demand_usd.map((year, y) => {
      const sum = year.reduce((a, d, i) => (sectors[i] === name ? a + d : a), 0);
      return (total[y] as number) > 0 ? sum / (total[y] as number) : 0;
    }),
  }));
}

/** A line per row, the largest `CHART_SERIES` at the end of the run. */
function shareSeries(rows: readonly { key: number; name: string; shares: number[] }[]): ChartSeries[] {
  const largest = [...rows]
    .sort((a, b) => (b.shares.at(-1) ?? 0) - (a.shares.at(-1) ?? 0) || a.key - b.key)
    .slice(0, CHART_SERIES);
  const tones = tonesByKey(largest.map((r) => r.key));
  return largest.map((r) => ({
    k: "line",
    name: r.name,
    values: r.shares,
    tone: tones.get(r.key) as Tone,
  }));
}

/** First year's and last year's share of each row, largest now first. */
function shareTable(
  id: string,
  title: string,
  years: readonly number[],
  rows: readonly { name: string; cell?: Cell; shares: number[] }[],
): TableDoc {
  const sorted = [...rows].sort((a, b) => (b.shares.at(-1) ?? 0) - (a.shares.at(-1) ?? 0));
  return {
    id,
    columns: [
      { title, width: 220 },
      { title: String(years[0] ?? ""), width: 80 },
      { title: String(years.at(-1) ?? ""), width: 80 },
      { title: "Change", width: 80 },
    ],
    rows: sorted.map((r): Cell[] => {
      const first = r.shares[0] ?? 0;
      const last = r.shares.at(-1) ?? 0;
      return [
        r.cell ?? { k: "text", v: r.name },
        { k: "percent", v: first },
        { k: "percent", v: last },
        { k: "gain", v: last - first, unit: "percent" },
      ];
    }),
  };
}

/** The largest industries now, with where they started. */
function industriesTable(h: HistoryView, index: NameIndex): TableDoc {
  const first = h.industry_demand_usd[0] ?? [];
  const last = h.industry_demand_usd.at(-1) ?? [];
  const order = last
    .map((d, i) => [d, i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .slice(0, TOP_INDUSTRIES);
  return {
    id: "history.industries",
    columns: [
      { title: "Industry", width: 220 },
      { title: "Sector", width: 90 },
      { title: String(h.years[0] ?? ""), width: 90 },
      { title: String(h.years.at(-1) ?? ""), width: 90 },
    ],
    rows: order.map(([d, i]): Cell[] => [
      linkCell(index, { kind: "industry", id: i as IndustryId }),
      { k: "text", v: h.run?.sectors[i] ?? "" },
      (first[i] ?? 0) > 0 ? { k: "money", v: first[i] as number } : { k: "text", v: "not yet" },
      { k: "money", v: d },
    ]),
  };
}

/** One row of the chronology. */
interface Event {
  year: number;
  kind: string;
  cell: Cell;
}

/** The party's letter, as the politics page shows it. */
const partyLetter = (p: string): string => p.charAt(0);

function voteText(e: ElectionResult): string {
  const seats = `House ${e.house[0]} D, ${e.house[1]} R; Senate ${e.senate[0]} D, ${e.senate[1]} R`;
  return e.president === null
    ? seats
    : `${e.president.winner} (${partyLetter(e.president.party)}) beats ${e.president.loser}. ${seats}`;
}

/**
 * A company by the name the history kept, since a removed one has left the name index. It links
 * while its page exists.
 */
function companyCell(h: HistoryView, id: CompanyId, name: string): Cell {
  return h.run?.removed.includes(id)
    ? { k: "text", v: name }
    : { k: "link", text: name, page: { kind: "company", id } };
}

/** Everything dated in the run, oldest first; within a year, in the order of this list. */
export function chronology(h: HistoryView, votes: readonly ElectionResult[]): Event[] {
  const run = h.run;
  const out: Event[] = [
    ...(run?.presidents ?? []).map(
      (p): Event => ({
        year: p.year,
        kind: "President",
        cell: { k: "text", v: `${p.name} (${partyLetter(p.party)}) takes office` },
      }),
    ),
    ...votes.map((e): Event => ({ year: e.date.year, kind: "US vote", cell: { k: "text", v: voteText(e) } })),
    ...h.recessions.map(
      (year): Event => ({
        year,
        kind: "Recession",
        cell: { k: "text", v: "The world economy slips into recession" },
      }),
    ),
    ...h.emergences.map(
      (e): Event => ({ year: e.year, kind: "New industry", cell: { k: "text", v: e.industry } }),
    ),
    ...(run?.founders ?? []).map(
      (f): Event => ({
        year: f.year,
        kind: `Founded by ${f.name}`,
        cell: companyCell(h, f.company, f.company_name),
      }),
    ),
    ...(run?.major_failures ?? []).map(
      (f): Event => ({
        year: f.year,
        kind: "Major failure",
        cell: companyCell(h, f.company, f.company_name),
      }),
    ),
    ...(run?.successions ?? []).map(
      (s): Event => ({
        year: s.year,
        kind: `${s.from} dies; ${s.to} inherits`,
        cell: companyCell(h, s.company, s.company_name),
      }),
    ),
  ];
  return out
    .map((e, i) => [e, i] as const)
    .sort((a, b) => a[0].year - b[0].year || a[1] - b[1])
    .map(([e]) => e);
}

/** The ranks down the side and each snapshot's year across the top. */
function topTable(h: HistoryView): TableDoc {
  const ranks = Math.max(0, ...h.top10.map((t) => t.companies.length));
  return {
    id: "history.top10",
    columns: [{ title: "#", width: 30 }, ...h.top10.map((t) => ({ title: String(t.year), width: 170 }))],
    rows: Array.from({ length: ranks }, (_, r): Cell[] => [
      { k: "int", v: r + 1 },
      ...h.top10.map((t): Cell => {
        const c = t.companies[r];
        return c ? companyCell(h, c.company, c.name) : dash;
      }),
    ]),
  };
}

/** What the page says of the scenario. */
export function scenarioText(h: HistoryView): string {
  return h.scenario ?? "Hidden until the run ends";
}

/** The whole page as data. */
export function worldHistoryDoc(v: ViewsData, index: NameIndex): PageDoc {
  const doc = emptyDoc(PAGE, index.title(PAGE), kindName("world-history"));
  const h = v.history;
  const run = h?.run;
  if (!h || !run) {
    doc.head.push(note("This world starts in 2020 and keeps no long history."));
    return doc;
  }
  const labels = h.years.map(String);
  const president = run.presidents.at(-1);
  doc.head.push({
    k: "fields",
    fields: [
      field.text("Scenario", scenarioText(h)),
      field.text("Years", h.years.length === 0 ? "None closed yet" : `${h.years[0]} to ${h.years.at(-1)}`),
      field.text("Recessions", String(h.recessions.length)),
      field.text("Failures", String(h.failures.at(-1) ?? 0)),
      field.text("President", president ? `${president.name} (${partyLetter(president.party)})` : "-"),
    ],
  });
  if (run.ended) {
    doc.head.push(
      note(`The run reached ${run.reveal_year}. You can keep watching, but nothing past here is tuned.`),
    );
  }
  if (h.years.length === 0) {
    doc.head.push(note("The first year closes on 1 January: the charts start then."));
  }
  const sectors = sectorShares(h).map((s, key) => ({ ...s, key }));
  const zoneTotal = totals(h.zone_gdp_usd);
  const zoneRows = (h.zone_gdp_usd[0] ?? []).map((_, key) => {
    const page: PageRef = { kind: "zone", id: key as ZoneId };
    return {
      key,
      name: index.title(page),
      cell: linkCell(index, page),
      shares: h.zone_gdp_usd.map((year, y) =>
        (zoneTotal[y] as number) > 0 ? (year[key] ?? 0) / (zoneTotal[y] as number) : 0,
      ),
    };
  });
  const events = chronology(h, v.politics?.elections.slice().reverse() ?? []);
  doc.sections = [
    {
      id: "economy",
      blocks: [
        chart({
          title: "World GDP",
          labels,
          series: [{ k: "line", name: "World GDP", values: h.gdp_usd, tone: "cyan" }],
          format: "Money",
          reference: null,
        }),
        chart({
          title: "Policy rate",
          labels,
          series: [{ k: "line", name: "Policy rate", values: h.base_rate, tone: "cyan" }],
          format: "Percent",
          reference: null,
        }),
        chart({
          title: "US corporate tax",
          labels,
          series: [{ k: "line", name: "US corporate tax", values: run.us_corp_tax, tone: "cyan" }],
          format: "Percent",
          reference: null,
        }),
      ],
    },
    {
      id: "industries",
      blocks: [
        chart({
          title: "Largest sectors, share of world demand",
          labels,
          series: shareSeries(sectors),
          format: "Percent",
          reference: null,
        }),
        table(shareTable("history.sectors", "Sector", h.years, sectors)),
        { k: "heading", text: "Largest industries" },
        table(industriesTable(h, index)),
      ],
    },
    {
      id: "zones",
      blocks: [
        chart({
          title: "Largest financial zones, share of world GDP",
          labels,
          series: shareSeries(zoneRows),
          format: "Percent",
          reference: null,
        }),
        table(shareTable("history.zones", "Financial zone", h.years, zoneRows)),
      ],
    },
    {
      id: "chronology",
      blocks:
        events.length === 0
          ? [note("Nothing yet.")]
          : [
              table({
                id: "history.chronology",
                columns: [
                  { title: "Year", width: 50 },
                  { title: "What", width: 260 },
                  { title: "Detail", width: 480 },
                ],
                rows: events.map((e): Cell[] => [
                  { k: "text", v: String(e.year) },
                  { k: "text", v: e.kind },
                  e.cell,
                ]),
              }),
            ],
    },
    {
      id: "top10",
      blocks:
        h.top10.length === 0
          ? [note("The first snapshot comes when the first year closes.")]
          : [note("By market cap at each year's close, listed companies only."), table(topTable(h))],
    },
  ];
  return doc;
}

export const pages = [
  definePage({
    kind: "world-history",
    // Only views that move at most monthly, so its charts do not redraw daily at the watching speed.
    views: ["history", "politics"],
    sections: SECTIONS,
    doc: (_page, v, index) => worldHistoryDoc(v, index),
  }),
];
