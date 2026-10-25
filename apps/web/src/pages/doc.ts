// Page documents (crates/game/src/pages/doc.rs, M9 B1; D480): an entity page is first built as a
// PageDoc, plain data made from the views (spec 9), and only then rendered (DocView.tsx). The data
// form is what the tests read (every spec 8 field present, bands and never the truth, every link's
// target, no ballot odds), so a test checks what the page shows without a DOM.
//
// - Span: a piece of a line: text, a link, a view Figure (through figureCell, D461), or a Live
//   value that follows the views as they change (prices, index levels, the projection range)
//   without rebuilding the page.
// - Block: a dense label and value grid (Fields that wrap to fill the pane), a line, a table (with
//   a stable id, D456), a chart, cards, a sub-heading.
// - SectionDoc: a registered section's blocks (D460). The renderer skips collapsed sections.
//
// Not ported (Bevy only): spawn_doc's node records, the shape and leaves walk and patch_doc (D772).
// React reconciles a rebuilt doc against the DOM it already drew, which is what the patch did by
// hand: texts change in place, tables keep their scroll and sort. LiveTable and LiveChart are not
// needed either: a page that wants a table or chart to follow a daily view lists that view.

import { dateTimeDate, type Figure, type SimDate, simDateDaysSinceEpoch } from "@tc20ff/sim";
import {
  bandIn,
  type Cell,
  cellTone,
  date,
  display,
  figureCell,
  fixed,
  type PageRef,
  price,
  type Unit,
} from "../widgets/cells.ts";
import { byId, byKey, type ViewsData } from "./views.ts";

/** A text color: the theme's palette (crates/game/src/ui/theme.rs `color`) or a cell's tone. */
export type Tone =
  | "text"
  | "muted"
  | "link"
  | "cyan"
  | "amber"
  | "magenta"
  | "green"
  | "gain"
  | "loss"
  | "band";

/** A value that follows the views without a page rebuild (prices every tick, daily levels). */
export type Live =
  /** The last price a share (v_quotes), "-" when not quoted. */
  | { k: "Price"; company: number }
  /** The day's change in percent (v_quotes), colored. */
  | { k: "DayChange"; company: number }
  /** The EFV a share and its band (v_quotes). */
  | { k: "Efv"; company: number }
  /** Market cap at the last price (v_quotes). */
  | { k: "MarketCap"; company: number }
  /** The headline index level now (v_quotes). */
  | { k: "IndexLevel"; zone: number }
  /** The index's change since the last daily close (v_quotes). */
  | { k: "IndexChange"; zone: number }
  /** Investor confidence (v_zones, daily). */
  | { k: "ZoneConfidence"; zone: number }
  /** The effective credit spread (v_zones, daily). */
  | { k: "ZoneSpread"; zone: number }
  /** The zone's share of world GDP (v_zones, daily). */
  | { k: "ZoneGdpShare"; zone: number }
  /** The zone's yearly effect, colored (v_zones, daily). */
  | { k: "ZoneEffect"; zone: number }
  /** The headline index's last daily close, "no listing" without one (v_zones, daily). */
  | { k: "IndexClose"; zone: number }
  /** The listed count (v_exchanges, daily). */
  | { k: "ListedCount"; zone: number }
  /** The projection range of this quarter's net income (v_projection, daily). */
  | { k: "ProjectionRange"; company: number }
  /** The consensus (v_projection, daily). */
  | { k: "Consensus"; company: number }
  /** The next release (v_clock). */
  | { k: "NextRelease" };

/** The one view a live value reads. */
export function liveView(l: Live): "quotes" | "zones" | "exchanges" | "projection" | "clock" {
  switch (l.k) {
    case "Price":
    case "DayChange":
    case "Efv":
    case "MarketCap":
    case "IndexLevel":
    case "IndexChange":
      return "quotes";
    case "ZoneConfidence":
    case "ZoneSpread":
    case "ZoneGdpShare":
    case "ZoneEffect":
    case "IndexClose":
      return "zones";
    case "ListedCount":
      return "exchanges";
    case "ProjectionRange":
    case "Consensus":
      return "projection";
    case "NextRelease":
      return "clock";
  }
}

/** A text and its color. */
export interface Shown {
  text: string;
  tone: Tone;
}

const cellShown = (c: Cell): Shown => ({ text: display(c), tone: cellTone(c) ?? "text" });

/** A spread (a fraction) in basis points: "245 bps". */
export function bps(f: number): string {
  return `${fixed(f * 1e4, 0)} bps`;
}

/** A signed figure with one decimal: "+12.5" (confidence). */
function signed1(x: number): string {
  const s = fixed(x, 1);
  return x >= 0 && !s.startsWith("-") ? `+${s}` : s;
}

/** A view figure as text ("$1.20M" or its band), for a range. */
function figureText(f: Figure, unit: Unit): string {
  return display(figureCell(f, unit));
}

/** Days from one date to another. */
const daysBetween = (a: SimDate, b: SimDate) => simDateDaysSinceEpoch(b) - simDateDaysSinceEpoch(a);

/** The text and color a live value shows now. */
export function liveText(l: Live, v: ViewsData): Shown {
  const dash: Shown = { text: "-", tone: "muted" };
  const quote = (id: number) => byId(v.quotes?.rows, id);
  const zone = (id: number) => byId(v.zones?.zones, id);
  const index = (z: number) => byKey(v.quotes?.indices, (i) => i.zone, z);
  switch (l.k) {
    case "Price": {
      const q = quote(l.company);
      return q ? cellShown({ k: "price", v: q.last }) : dash;
    }
    case "DayChange": {
      const q = quote(l.company);
      return q ? cellShown({ k: "gain", v: q.change_pct, unit: "percent" }) : dash;
    }
    case "Efv": {
      const q = quote(l.company);
      return q
        ? { text: `${price(q.efv)} (band ${bandIn("price", q.efv_low, q.efv_high)})`, tone: "text" }
        : dash;
    }
    case "MarketCap": {
      const q = quote(l.company);
      return q ? cellShown({ k: "money", v: q.market_cap }) : dash;
    }
    case "IndexLevel": {
      const i = index(l.zone);
      return i?.level != null ? cellShown({ k: "number", v: i.level }) : dash;
    }
    case "IndexChange": {
      const i = index(l.zone);
      if (i?.level == null || i.prev_close == null || !(i.prev_close > 0)) return dash;
      return cellShown({ k: "gain", v: i.level / i.prev_close - 1, unit: "percent" });
    }
    case "ZoneConfidence": {
      const z = zone(l.zone);
      return z ? { text: signed1(z.confidence), tone: "text" } : dash;
    }
    case "ZoneSpread": {
      const z = zone(l.zone);
      return z ? { text: bps(z.credit_spread), tone: "text" } : dash;
    }
    case "ZoneGdpShare": {
      const z = zone(l.zone);
      return z ? cellShown({ k: "percent", v: z.gdp_share }) : dash;
    }
    case "ZoneEffect": {
      const z = zone(l.zone);
      return z ? cellShown({ k: "gain", v: z.effect, unit: "percent" }) : dash;
    }
    case "IndexClose": {
      const z = zone(l.zone);
      if (!z) return dash;
      return z.index_close === null
        ? { text: "no listing", tone: "muted" }
        : cellShown({ k: "number", v: z.index_close });
    }
    case "ListedCount": {
      const x = v.exchanges?.exchanges[l.zone];
      return x ? cellShown({ k: "int", v: x.listed_count }) : dash;
    }
    case "ProjectionRange": {
      const p = byId(v.projection?.companies, l.company);
      if (!p) return dash;
      const [lo, hi] = p.range;
      const text = `${figureText(lo, "money")} to ${figureText(hi, "money")} (+/-${fixed(p.width * 100, 0)}%)`;
      return { text, tone: lo.kind === "Band" || hi.kind === "Band" ? "band" : "text" };
    }
    case "Consensus": {
      const p = byId(v.projection?.companies, l.company);
      return p ? cellShown(figureCell(p.consensus_ni, "money")) : dash;
    }
    case "NextRelease": {
      const c = v.clock;
      if (!c) return dash;
      const next = dateTimeDate(c.next_release);
      return { text: `${date(next)} (${Math.max(0, daysBetween(c.date, next))} days)`, tone: "text" };
    }
  }
}

/** A piece of a line. */
export type Span =
  | { k: "text"; text: string }
  | { k: "muted"; text: string }
  | { k: "colored"; text: string; tone: Tone }
  | { k: "link"; text: string; page: PageRef }
  /** A view's figure: its exact value, or its band in the estimate color (D461). */
  | { k: "figure"; figure: Figure; unit: Unit }
  /** A plain cell (a price, a percent, a rating, a link cell). */
  | { k: "cell"; cell: Cell }
  | { k: "live"; live: Live };

export const span = {
  text: (text: string): Span => ({ k: "text", text }),
  muted: (text: string): Span => ({ k: "muted", text }),
  colored: (text: string, tone: Tone): Span => ({ k: "colored", text, tone }),
  link: (text: string, page: PageRef): Span => ({ k: "link", text, page }),
  figure: (figure: Figure, unit: Unit): Span => ({ k: "figure", figure, unit }),
  cell: (cell: Cell): Span => ({ k: "cell", cell }),
  live: (live: Live): Span => ({ k: "live", live }),
};

/** The text and color a span shows now. */
export function spanShown(s: Span, v: ViewsData): Shown {
  switch (s.k) {
    case "text":
      return { text: s.text, tone: "text" };
    case "muted":
      return { text: s.text, tone: "muted" };
    case "colored":
      return { text: s.text, tone: s.tone };
    case "link":
      return { text: s.text, tone: "link" };
    case "figure":
      return cellShown(figureCell(s.figure, s.unit));
    case "cell":
      return cellShown(s.cell);
    case "live":
      return liveText(s.live, v);
  }
}

/** A label and its value. */
export interface Field {
  label: string;
  value: Span[];
}

export const field = {
  new: (label: string, value: Span[]): Field => ({ label, value }),
  text: (label: string, value: string): Field => ({ label, value: [span.text(value)] }),
  figure: (label: string, f: Figure, unit: Unit): Field => ({ label, value: [span.figure(f, unit)] }),
  cell: (label: string, c: Cell): Field => ({ label, value: [span.cell(c)] }),
  live: (label: string, l: Live): Field => ({ label, value: [span.live(l)] }),
  link: (label: string, text: string, page: PageRef): Field => ({ label, value: [span.link(text, page)] }),
};

/**
 * A progress bar toward `max`: a fill for an exact value, a translucent strip over the band for a
 * banded one (never a fill at the band's hidden estimate, D466).
 */
export interface Progress {
  value: Figure;
  max: number;
}

/** The bar's filled share, or for a band the share range it covers, each in 0 to 1. */
export function progressShares(p: Progress): [number, number] {
  const s = (x: number) => (p.max > 0 ? Math.min(1, Math.max(0, x / p.max)) : 0);
  return p.value.kind === "Exact" ? [0, s(p.value.value)] : [s(p.value.band.low), s(p.value.band.high)];
}

/** A small card (a board seat, a founder, a data quest). */
export interface CardDoc {
  head: Span[];
  fields: Field[];
  bar: Progress | null;
  /** A dim card (an open seat). */
  dim: boolean;
}

/** A table column (crates/game/src/table `Column`). */
export interface DocColumn {
  title: string;
  width: number;
  /** A hover hint on the header ("A band while not published"). */
  hint?: string;
}

/** A table with its stable id (per page kind, D456): the sort it keeps is saved under the id. */
export interface TableDoc {
  id: string;
  columns: DocColumn[];
  rows: Cell[][];
  /** The column sorted at the start, by index. */
  sort?: { column: number; ascending: boolean };
}

/** How a chart's values read on the axis and in the readout (chart/data.rs ValueFormat). */
export type ValueFormat = "Price" | "Money" | "Percent" | "Number";

/** One bar: a day's, or a week's when aggregated, with the EFV band at its close when known. */
export interface Ohlc {
  date: SimDate;
  open: number;
  high: number;
  low: number;
  close: number;
  /** The estimated fair value band (low, high), USD a share (3.14.2; spec 8 F3). */
  band: [number, number] | null;
}

/** One series of a chart (chart/data.rs `Series`); every series has one value per x slot. */
export type ChartSeries =
  | { k: "line"; name: string; values: number[]; tone: Tone }
  /** Bars from zero; a null tone colors them by sign (gains cyan, losses magenta). */
  | { k: "bars"; name: string; values: number[]; tone: Tone | null }
  /** Candles, drawn over their EFV band. */
  | { k: "candles"; bars: Ohlc[] }
  /**
   * An estimate band per slot (D420, D466): a strip from low to high, null where the figure is
   * exact. Put it before the series it belongs to.
   */
  | { k: "band"; name: string; bands: ([number, number] | null)[]; tone: Tone };

/** A chart (chart/data.rs `ChartModel`). */
export interface ChartModel {
  title: string;
  /** The x slots' labels (dates, quarters), for the axis and the readout. */
  labels: string[];
  series: ChartSeries[];
  format: ValueFormat;
  /** A horizontal reference line (an industry's long-term growth). */
  reference: { value: number; tone: Tone } | null;
}

/** One block of a section. */
export type Block =
  /** A dense label and value grid that wraps to fill the pane. */
  | { k: "fields"; fields: Field[] }
  | { k: "line"; spans: Span[] }
  | { k: "table"; table: TableDoc }
  | { k: "chart"; chart: ChartModel }
  | { k: "cards"; cards: CardDoc[] }
  /** A titled sub-heading inside a section. */
  | { k: "heading"; text: string };

/** A registered section's content. */
export interface SectionDoc {
  id: string;
  blocks: Block[];
}

/** A whole page. */
export interface PageDoc {
  page: PageRef;
  title: string;
  /** The kind's name, shown after the title. */
  kind: string;
  /** Chips after the title (status, "estimates"). */
  chips: Span[];
  /** The header's blocks (identity fields and the Founded and Listed lines). */
  head: Block[];
  sections: SectionDoc[];
}

export function docSection(d: PageDoc, id: string): SectionDoc | undefined {
  return d.sections.find((s) => s.id === id);
}

/** Every block, header first. */
export function docBlocks(d: PageDoc): Block[] {
  return [...d.head, ...d.sections.flatMap((s) => s.blocks)];
}

/** Every field, header first, cards included. */
export function docFields(d: PageDoc): Field[] {
  return docBlocks(d).flatMap((b) =>
    b.k === "fields" ? b.fields : b.k === "cards" ? b.cards.flatMap((c) => c.fields) : [],
  );
}

/** The first field labelled `label`. */
export function docField(d: PageDoc, label: string): Field | undefined {
  return docFields(d).find((f) => f.label === label);
}

/** Every span, chips first (fields, lines, cards). */
export function docSpans(d: PageDoc): Span[] {
  const out: Span[] = [...d.chips];
  for (const b of docBlocks(d)) {
    if (b.k === "fields") out.push(...b.fields.flatMap((f) => f.value));
    else if (b.k === "line") out.push(...b.spans);
    else if (b.k === "cards")
      for (const c of b.cards) out.push(...c.head, ...c.fields.flatMap((f) => f.value));
  }
  return out;
}

/**
 * Every text the page shows now: the title, labels, spans, table cells and headers, chart titles
 * and labels (for the leak and odds scans).
 */
export function docTexts(d: PageDoc, v: ViewsData): string[] {
  const out = [d.title, d.kind];
  for (const f of docFields(d)) out.push(f.label);
  for (const s of docSpans(d)) out.push(spanShown(s, v).text);
  for (const b of docBlocks(d)) {
    if (b.k === "table") {
      out.push(...b.table.columns.map((c) => c.title));
      for (const r of b.table.rows) for (const c of r) out.push(display(c));
    } else if (b.k === "chart") {
      out.push(b.chart.title, ...b.chart.labels);
    } else if (b.k === "heading") out.push(b.text);
  }
  return out;
}

/** Every page the page links to: spans and table link cells. */
export function docLinks(d: PageDoc): PageRef[] {
  const out: PageRef[] = [];
  for (const s of docSpans(d)) {
    if (s.k === "link") out.push(s.page);
    else if (s.k === "cell" && s.cell.k === "link") out.push(s.cell.page);
  }
  for (const b of docBlocks(d)) {
    if (b.k !== "table") continue;
    for (const r of b.table.rows) for (const c of r) if (c.k === "link") out.push(c.page);
  }
  return out;
}

/** A table by id. */
export function docTable(d: PageDoc, id: string): TableDoc | undefined {
  for (const b of docBlocks(d)) if (b.k === "table" && b.table.id === id) return b.table;
  return undefined;
}

/** An empty doc for a page: its title and kind, no sections (a builder fills it). */
export function emptyDoc(page: PageRef, title: string, kind: string): PageDoc {
  return { page, title, kind, chips: [], head: [], sections: [] };
}

/** The "no such thing" line a doc shows when its entity is not in the views. */
export function notFound(what: string): Block {
  return { k: "line", spans: [span.muted(`No such ${what} in the views.`)] };
}
