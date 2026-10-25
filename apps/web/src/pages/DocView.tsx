// Draws a PageDoc (crates/game/src/pages/doc.rs `spawn_doc`, `spawn_block`, `spawn_span`): the
// header (title, kind, chips, the tab strip when the page has tabs, the head blocks), then each
// shown section that is not folded. Live spans subscribe to their own view, so a price moving
// every tick re-renders one span, not the page.

import { lazy, memo, Suspense, useMemo } from "react";
import { Link } from "../links/Link.tsx";
import { useViewDataThrottled } from "../sim/hooks.ts";
import type { Cell } from "../widgets/cells.ts";
import type { Column } from "../widgets/DataTable.tsx";
import { DataTable } from "../widgets/DataTable.tsx";
import {
  type Block,
  type CardDoc,
  type Field,
  type Live,
  liveText,
  liveView,
  type PageDoc,
  progressShares,
  type Span,
  spanShown,
  type TableDoc,
} from "./doc.ts";
import { ChipRow, TableBox } from "./parts.tsx";
import { Sections, TabStrip } from "./SectionsView.tsx";
import type { SectionSpec } from "./sections.ts";
import { LIVE_REFRESH_MS, type ViewsData } from "./views.ts";

// The chart widget (lightweight-charts) loads the first time a page draws a chart.
const ChartBlock = lazy(() => import("./ChartBlock.tsx").then((m) => ({ default: m.ChartBlock })));

/** A live value: reads its one view, at most every LIVE_REFRESH_MS. */
function LiveSpan({ live }: { live: Live }) {
  const name = liveView(live);
  const data = useViewDataThrottled(name, LIVE_REFRESH_MS);
  const shown = liveText(live, { [name]: data } as ViewsData);
  return <span className={`tone-${shown.tone}`}>{shown.text}</span>;
}

export function SpanView({ s, views }: { s: Span; views: ViewsData }) {
  if (s.k === "live") return <LiveSpan live={s.live} />;
  if (s.k === "link") return <Link page={s.page}>{s.text}</Link>;
  if (s.k === "cell" && s.cell.k === "link") return <Link page={s.cell.page}>{s.cell.text}</Link>;
  const shown = spanShown(s, views);
  return <span className={`tone-${shown.tone}`}>{shown.text}</span>;
}

function Spans({ spans, views }: { spans: readonly Span[]; views: ViewsData }) {
  return (
    <>
      {spans.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: spans have no identity but their place
        <SpanView key={i} s={s} views={views} />
      ))}
    </>
  );
}

/** A dense label and value grid that wraps to fill the pane. */
function Fields({ fields, views }: { fields: readonly Field[]; views: ViewsData }) {
  return (
    <div className="fields">
      {fields.map((f, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: two fields may share a label
        <div key={i} className="field">
          <span className="field-label">{f.label}</span>
          <span className="field-value">
            <Spans spans={f.value} views={views} />
          </span>
        </div>
      ))}
    </div>
  );
}

interface DocRow {
  i: number;
  cells: Cell[];
}
const rowIndex = (r: DocRow): number => r.i;

/** A table of the doc, with its stable id (its sort persists, D456). */
export function DocTable({ table }: { table: TableDoc }) {
  const columns = useMemo<Column<DocRow>[]>(
    () =>
      table.columns.map((c, i) => ({
        id: String(i),
        header: c.title,
        width: c.width,
        ...(c.hint ? { hint: c.hint } : {}),
        cell: (r) => r.cells[i] ?? { k: "unknown" },
      })),
    [table.columns],
  );
  const rows = useMemo(() => table.rows.map((cells, i): DocRow => ({ i, cells })), [table.rows]);
  const sort = table.sort ? { id: String(table.sort.column), desc: !table.sort.ascending } : undefined;
  return (
    <TableBox rows={table.rows.length}>
      <DataTable
        id={table.id}
        rows={rows}
        columns={columns}
        rowKey={rowIndex}
        {...(sort ? { initialSort: sort } : {})}
      />
    </TableBox>
  );
}

function Bar({ value, max }: { value: CardDoc["bar"] & object; max: number }) {
  const [a, b] = progressShares({ value: value.value, max });
  const banded = value.value.kind === "Band";
  return (
    <div className="bar">
      <div
        className={banded ? "bar-band" : "bar-fill"}
        style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%` }}
      />
    </div>
  );
}

function Cards({ cards, views }: { cards: readonly CardDoc[]; views: ViewsData }) {
  return (
    <div className="cards">
      {cards.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: cards have no identity but their place
        <div key={i} className={`doc-card${c.dim ? " dim" : ""}`}>
          <div className="card-head">
            <Spans spans={c.head} views={views} />
          </div>
          {c.fields.map((f, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two fields may share a label
            <div key={j} className="card-line">
              <span className="card-label muted">{f.label}</span>
              <span>
                <Spans spans={f.value} views={views} />
              </span>
            </div>
          ))}
          {c.bar && <Bar value={c.bar} max={c.bar.max} />}
        </div>
      ))}
    </div>
  );
}

export function BlockView({ block, views }: { block: Block; views: ViewsData }) {
  switch (block.k) {
    case "fields":
      return <Fields fields={block.fields} views={views} />;
    case "line":
      return (
        <ChipRow>
          <Spans spans={block.spans} views={views} />
        </ChipRow>
      );
    case "table":
      return <DocTable table={block.table} />;
    case "chart":
      return (
        <Suspense fallback={<div className="chart-box muted">Loading the chart...</div>}>
          <ChartBlock chart={block.chart} />
        </Suspense>
      );
    case "cards":
      return <Cards cards={block.cards} views={views} />;
    case "heading":
      return <h4 className="doc-heading">{block.text}</h4>;
  }
}

function Blocks({ blocks, views }: { blocks: readonly Block[]; views: ViewsData }) {
  return (
    <>
      {blocks.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no identity but their place
        <BlockView key={i} block={b} views={views} />
      ))}
    </>
  );
}

export interface DocViewProps {
  doc: PageDoc;
  views: ViewsData;
  sections: readonly SectionSpec[];
  tabs?: boolean;
}

/** A whole page doc. */
function DocViewInner({ doc, views, sections, tabs }: DocViewProps) {
  const kind = doc.page.kind;
  return (
    <div className="doc">
      <ChipRow>
        <h2 className="page-title">{doc.title}</h2>
        <span className="muted small">{doc.kind}</span>
        <Spans spans={doc.chips} views={views} />
      </ChipRow>
      {tabs && <TabStrip kind={kind} sections={sections} />}
      <Blocks blocks={doc.head} views={views} />
      <Sections
        kind={kind}
        sections={sections}
        render={(id) => {
          const s = doc.sections.find((x) => x.id === id);
          return s ? <Blocks blocks={s.blocks} views={views} /> : null;
        }}
      />
    </div>
  );
}

export const DocView = memo(DocViewInner);
