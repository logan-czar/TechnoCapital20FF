// The Industries table and an industry's page (crates/game/src/pages/industries.rs, M9.3, M9.7;
// spec 8 Industries and Startups and listings rows; 20-ui 20.7.6).
//
// - Industries: a header strip with the global phase and g_t (batch 150), then the table of
//   42: demand, supply, S, M, phase label, long-term growth, this quarter's growth as a yearly
//   rate, the fringe share, the births column (the last 4 quarters, D428) and the top 5
//   companies, each a link.
// - An industry: its figures, the 20-quarter chart of demand vs supply, the quarterly
//   growth bars against the long-term rate, the company list with the fringe row, the startups
//   born in it and its latest headlines.
//
// Every figure goes through figureCell or span.figure (D461): an industry with one or two
// companies that do not publish shows its supply, S, M and fringe as bands (D432), and its
// history's supply too (D437).

import { type Figure, formatQuarter, type IndustryId, TOP_COMPANIES } from "@tc20ff/sim";
import { eventName, type NameIndex } from "../../links/names.ts";
import { type Cell, figureCell, gain } from "../../widgets/cells.ts";
import {
  type Block,
  type ChartModel,
  type ChartSeries,
  type DocColumn,
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
import { byId, type ViewsData } from "../views.ts";
import { headlineLinks, linkLine } from "./news.tsx";

/** The detail chart's quarters (spec 8: a 20-quarter chart; D112). */
export const CHART_QUARTERS = 20;
/** Headlines an industry page lists. */
export const INDUSTRY_HEADLINES = 12;
/** The top companies the table shows (spec 8: top 5). */
export const TOP_SHOWN = TOP_COMPANIES;

export const SECTIONS: readonly SectionSpec[] = [
  { id: "figures", title: "Figures" },
  { id: "chart", title: "Demand vs supply" },
  { id: "growth", title: "Growth against the long-term rate" },
  { id: "companies", title: "Companies" },
  { id: "births", title: "Startups" },
  { id: "news", title: "Headlines" },
];

/** Companies born in industry `id` in the last 4 quarters (v_births' births column). */
export function birthsLastFourQuarters(v: ViewsData, id: IndustryId): number {
  return v.births?.births_by_industry[id] ?? 0;
}

/**
 * The header strip (spec 8 Industries, batch 150): the global phase, g_t and quarters left,
 * the AI stage, and the quarters the births column counts.
 */
export function stripText(v: ViewsData): string {
  const c = v.cycle;
  if (!c) return "";
  const q = v.births?.births_column_quarters ?? [];
  const [a, z] = [q[0], q[q.length - 1]];
  const range = a && z ? `${formatQuarter(a)} to ${formatQuarter(z)}` : "-";
  return `Global phase ${c.phase} | g_t ${gain(c.g_t, "percent")} a year | ${c.quarters_left} quarter${
    c.quarters_left === 1 ? "" : "s"
  } left | AI stage ${c.ai_stage} | births column ${range}`;
}

const dash: Cell = { k: "text", v: "-" };

/** The table of 42 (spec 8 Industries; M9.7 births column). */
export function industriesTable(v: ViewsData, index: NameIndex, id = "industries"): TableDoc {
  const rows = (v.industry_rows?.rows ?? []).map((r): Cell[] => {
    const row: Cell[] = [
      linkCell(index, { kind: "industry", id: r.id }),
      { k: "text", v: r.sector },
      { k: "money", v: r.demand },
      figureCell(r.supply, "money"),
      figureCell(r.supply_ratio, "ratio"),
      figureCell(r.market_factor, "ratio"),
      { k: "text", v: r.phase_label },
      { k: "percent", v: r.lt },
      { k: "gain", v: r.growth_annual, unit: "percent" },
      figureCell(r.fringe_share, "percent"),
      { k: "int", v: birthsLastFourQuarters(v, r.id) },
    ];
    for (let i = 0; i < TOP_SHOWN; i++) {
      const c = r.top_companies[i];
      row.push(c === undefined ? dash : linkCell(index, { kind: "company", id: c }));
    }
    return row;
  });
  const columns: DocColumn[] = [
    { title: "Industry", width: 200 },
    { title: "Sector", width: 120 },
    { title: "Demand", width: 80, hint: "Effective demand, USD a year (spec 5.1)" },
    { title: "Supply", width: 110, hint: "USD a year (spec 5.2); a band in an estimated industry (D432)" },
    { title: "S", width: 90, hint: "Supply over demand" },
    // F9 shows M as the price driver; the MVP builds no separate price index (D881).
    { title: "M", width: 90, hint: "The market factor M, the price driver (spec 5.4)" },
    { title: "Phase", width: 60, hint: "The phase label (spec 5.1)" },
    { title: "Long-term", width: 76, hint: "The long-term growth rate, a year" },
    { title: "Growth", width: 70, hint: "This quarter's growth as a yearly rate, (1 + q)^4 - 1 (spec 8)" },
    { title: "Fringe", width: 100, hint: "The fringe's share of supply (spec 5.3)" },
    { title: "Births", width: 56, hint: "Companies born here in the last 4 quarters" },
  ];
  for (let i = 0; i < TOP_SHOWN; i++) {
    columns.push({
      title: `Top ${i + 1}`,
      width: 150,
      hint: "By last month's revenue as shown (bands by their estimate, D420)",
    });
  }
  return { id, columns, rows };
}

/** The Industries page as data. */
export function industriesDoc(v: ViewsData, index: NameIndex): PageDoc {
  const rows = v.industry_rows?.rows ?? [];
  const estimated = rows.filter((r) => r.estimated).length;
  const doc = emptyDoc({ kind: "industries" }, kindName("industries"), `${rows.length} industries`);
  if (estimated > 0)
    doc.chips.push(span.colored(`${estimated} estimated: supply, S, M and fringe as bands (D432)`, "amber"));
  doc.head.push(
    { k: "line", spans: [span.colored(stripText(v), "cyan")] },
    { k: "table", table: industriesTable(v, index) },
  );
  return doc;
}

/**
 * A figure series (chart/data.rs `Series::figures`): the exact values as a line, broken where a
 * figure is a band, with a band strip before it when any figure is one (D466).
 */
export function figureSeries(name: string, figures: readonly Figure[], tone: Tone): ChartSeries[] {
  const line: ChartSeries = {
    k: "line",
    name,
    values: figures.map((f) => (f.kind === "Exact" ? f.value : Number.NaN)),
    tone,
  };
  if (!figures.some((f) => f.kind === "Band")) return [line];
  const bands = figures.map((f): [number, number] | null =>
    f.kind === "Band" ? [f.band.low, f.band.high] : null,
  );
  return [{ k: "band", name, bands, tone }, line];
}

/** The last CHART_QUARTERS closed quarters of an industry, oldest first. */
function chartQuarters(v: ViewsData, id: IndustryId) {
  const d = byId(v.industry_detail?.industries, id);
  return d ? d.history.slice(Math.max(0, d.history.length - CHART_QUARTERS)) : [];
}

/**
 * The 20-quarter chart of demand vs supply (spec 8; D112); supply is a band strip in the
 * quarters the industry was estimated (D437, D466).
 */
export function demandSupplyChart(v: ViewsData, id: IndustryId): ChartModel | null {
  const q = chartQuarters(v, id);
  if (q.length === 0) return null;
  return {
    title: `Demand vs supply, last ${q.length} quarters`,
    labels: q.map((h) => formatQuarter(h.quarter)),
    series: [
      { k: "line", name: "demand", values: q.map((h) => h.demand), tone: "cyan" },
      ...figureSeries(
        "supply",
        q.map((h) => h.supply),
        "amber",
      ),
    ],
    format: "Money",
    reference: null,
  };
}

/**
 * The quarterly growth bars, each as a yearly rate `(1 + q_growth)^4 - 1` as the table shows
 * it (spec 8), against the long-term rate line of each quarter.
 */
export function growthChart(v: ViewsData, id: IndustryId): ChartModel | null {
  const q = chartQuarters(v, id);
  if (q.length === 0) return null;
  return {
    title: "Quarterly growth (a year) against the long-term rate",
    labels: q.map((h) => formatQuarter(h.quarter)),
    series: [
      { k: "bars", name: "growth", values: q.map((h) => (1 + h.q_growth) ** 4 - 1), tone: null },
      { k: "line", name: "long-term", values: q.map((h) => h.lt), tone: "amber" },
    ],
    format: "Percent",
    reference: null,
  };
}

/** The company list (spec 8 detail view) with the fringe row last (spec 5.3). */
export function companiesTable(v: ViewsData, index: NameIndex, id: IndustryId): TableDoc | null {
  const d = byId(v.industry_detail?.industries, id);
  if (!d) return null;
  const rows = d.companies.map((c, i): Cell[] => {
    const row = byId(v.company_rows?.rows, c.company);
    return [
      { k: "int", v: i + 1 },
      linkCell(index, { kind: "company", id: c.company }),
      { k: "text", v: row?.public && row.ticker !== "" ? row.ticker : "-" },
      { k: "text", v: row ? (row.public ? "listed" : "private") : "-" },
      figureCell(c.revenue_m, "money"),
      figureCell(c.share, "percent"),
    ];
  });
  rows.push([
    { k: "unknown" },
    { k: "text", v: "Fringe (unnamed)" },
    dash,
    dash,
    figureCell(d.fringe_revenue_m, "money"),
    figureCell(d.fringe_share, "percent"),
  ]);
  return {
    id: "industry.companies",
    columns: [
      { title: "#", width: 36 },
      { title: "Company", width: 230 },
      { title: "Ticker", width: 60 },
      { title: "Listed", width: 60 },
      { title: "Revenue", width: 130, hint: "Last month's revenue; a band while not published (D420)" },
      { title: "Share", width: 120, hint: "Of the industry's revenue shown" },
    ],
    rows,
  };
}

/** The industry's latest headlines (D518), newest first, each linking to its page. */
export function headlinesTable(v: ViewsData, id: IndustryId): TableDoc {
  const rows = headlineLinks(v, (h) => h.industry === id, INDUSTRY_HEADLINES).map(
    ([d, text, page]): Cell[] => [
      { k: "date", v: d },
      { k: "link", text, page },
    ],
  );
  return {
    id: "industry.news",
    columns: [
      { title: "Date", width: 96 },
      { title: "Headline", width: 640 },
    ],
    rows,
  };
}

/** The note over an industry with no headline yet. */
export const NO_HEADLINES =
  "No headlines yet: phase changes, results, ratings, startups and listings in this industry post here.";

/** The note over an industry's headlines: empty once it has one (PR #30 review). */
export function noHeadlinesNote(v: ViewsData, id: IndustryId): string {
  return headlineLinks(v, (h) => h.industry === id, 1).length === 0 ? NO_HEADLINES : "";
}

const note = (text: string): Block => ({ k: "line", spans: [span.muted(text)] });

/** An industry's page as data. */
export function industryDoc(id: IndustryId, v: ViewsData, index: NameIndex): PageDoc {
  const page: PageRef = { kind: "industry", id };
  const r = byId(v.industry_rows?.rows, id);
  if (!r) {
    const doc = emptyDoc(page, index.title(page), "Industry");
    doc.head.push(note("No such industry."));
    return doc;
  }
  const doc = emptyDoc(page, index.title(page), `Industry, ${r.sector}`);
  if (r.estimated)
    doc.chips.push(
      span.colored(
        "Estimated: one or two companies here do not publish, so the totals are bands (D432)",
        "amber",
      ),
    );
  doc.head.push(...linkLine("Pages", [[index.title({ kind: "industries" }), { kind: "industries" }]]));
  const figures = [
    field.new("Phase", [span.colored(r.phase_label, "cyan")]),
    field.cell("Demand", { k: "money", v: r.demand }),
    field.cell("Trend demand", { k: "money", v: r.trend_demand }),
    field.figure("Supply", r.supply, "money"),
    field.figure("S", r.supply_ratio, "ratio"),
    field.figure("M", r.market_factor, "ratio"),
    field.figure("Fringe share", r.fringe_share, "percent"),
    field.figure("Named revenue (month)", r.named_revenue_m, "money"),
    field.figure("Fringe revenue (month)", r.fringe_revenue_m, "money"),
    field.cell("Long-term", { k: "percent", v: r.lt }),
    field.cell("Growth (a year)", { k: "gain", v: r.growth_annual, unit: "percent" }),
    field.cell("Births (4 quarters)", { k: "int", v: birthsLastFourQuarters(v, id) }),
  ];
  const chart = (m: ChartModel | null): Block[] =>
    m
      ? [{ k: "chart", chart: m }]
      : [note("No closed quarter yet: the chart fills from the first quarter's close.")];
  const companies = companiesTable(v, index, id);
  const births = v.births;
  const born: [string, PageRef][] = (births?.births ?? [])
    .filter((x) => x.industry === id)
    .reverse()
    .map((x) => [index.title({ kind: "company", id: x.id }), { kind: "company", id: x.id }]);
  const events: [string, PageRef][] = (births?.events ?? [])
    .filter((e) => e.industries.includes(id))
    .reverse()
    .map((e) => [eventName(e), { kind: "event", id: e.id }]);
  const noHeadlines = noHeadlinesNote(v, id);
  doc.sections = [
    { id: "figures", blocks: [{ k: "fields", fields: figures }] },
    { id: "chart", blocks: chart(demandSupplyChart(v, id)) },
    { id: "growth", blocks: chart(growthChart(v, id)) },
    { id: "companies", blocks: companies ? [{ k: "table", table: companies }] : [] },
    {
      id: "births",
      blocks: [
        ...(born.length === 0 && events.length === 0 ? [note("No startups born here yet.")] : []),
        ...linkLine("Born here", born),
        ...linkLine("Startup events", events),
      ],
    },
    {
      id: "news",
      blocks: [...(noHeadlines ? [note(noHeadlines)] : []), { k: "table", table: headlinesTable(v, id) }],
    },
  ];
  return doc;
}

export const pages = [
  definePage({
    kind: "industries",
    views: ["industry_rows", "cycle", "births"],
    sections: [],
    doc: (_page, v, index) => industriesDoc(v, index),
  }),
  definePage({
    kind: "industry",
    // Rust lists v_news as a live table on the page; here the page reads it (daily) directly.
    views: ["industry_rows", "industry_detail", "births", "company_rows", "news"],
    sections: SECTIONS,
    doc: (page, v, index) => industryDoc(page.id, v, index),
  }),
];
