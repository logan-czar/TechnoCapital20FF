// The virtualized sortable table (replaces crates/game/src/table, 1,700 lines): TanStack Table for
// the model and the sort state, TanStack Virtual for the rows. Behavior kept from table/mod.rs: a
// click on a header sorts ascending then descending, unknown cells sort last in both directions,
// ties keep row order, the header stays put while the body scrolls, numbers align right, link cells
// open their page (a Link: click, Shift+click or middle click, and a hover card). A table with an
// `id` keeps its sort in the settings under that id (D456). The row height follows the settings'
// density and font scale (D458). Only the rows in view (plus a small overscan) exist in the DOM, so 10,000 rows
// scroll and sort smoothly.
//
// The order is computed here (`sortOrder`, the port of `sort_order`) from the cells as they are now,
// not from a cache, so a live column (a price) sorts by its current values. The order is recomputed
// when the rows change, the sort changes, or, while a live column is the sort key, when `version`
// changes; otherwise the rows in view redraw in place and the order stays put.

import { type ColumnDef, getCoreRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type MouseEvent, memo, useEffect, useMemo, useRef, useState } from "react";
import { useRowHeight, useSettings } from "../config/hooks.ts";
import { Link } from "../links/Link.tsx";
import { type Cell, cellTone, display, isNumeric, sortOrder } from "./cells.ts";

export interface Column<R> {
  id: string;
  header: string;
  /** Pixel width. */
  width: number;
  cell: (row: R) => Cell;
  /** A hover hint on the header. */
  hint?: string;
  /** The cell reads data that moves between `rows` changes (a price); sorting it re-reads it. */
  live?: boolean;
}

export interface DataTableProps<R> {
  rows: R[];
  columns: readonly Column<R>[];
  /** A stable key for a row (its id). */
  rowKey: (row: R) => string | number;
  /** The table's stable id (D456): its sort is saved in the settings under it. */
  id?: string;
  /** The column sorted at the start (a saved sort wins). */
  initialSort?: { id: string; desc: boolean };
  /** Changes when live cells changed: redraws the rows in view, and re-sorts a live sort column. */
  version?: unknown;
  /**
   * A click on a row outside its links: `button` is 0 (primary) or 2 (right-click, which opens no
   * browser menu then). Pdoomberg's rows watch and load companies (pdoomberg/mod.rs row_clicks).
   */
  onRowClick?: (row: R, button: number) => void;
}

/** Row height in pixels at normal density (theme.rs size::ROW); the settings scale it. */
export const ROW_HEIGHT = 22;
export const HEADER_HEIGHT = 26;
const OVERSCAN = 12;

function CellView({ cell }: { cell: Cell }) {
  const tone = cellTone(cell);
  const cls = `cell${isNumeric(cell) ? " num" : ""}${tone ? ` ${tone}` : ""}`;
  if (cell.k === "link") {
    return (
      <Link page={cell.page} className={cls}>
        {cell.text}
      </Link>
    );
  }
  return <span className={cls}>{display(cell)}</span>;
}

function DataTableInner<R>({
  rows,
  columns,
  rowKey,
  id,
  initialSort,
  version,
  onRowClick,
}: DataTableProps<R>) {
  const settings = useSettings();
  const rowHeight = useRowHeight();
  const [sorting, setSortingState] = useState<SortingState>(() => {
    const saved = id ? settings.config.tables[id]?.sort : null;
    if (saved && columns.some((c) => c.id === saved.key)) return [{ id: saved.key, desc: !saved.ascending }];
    return initialSort ? [initialSort] : [];
  });
  const setSorting = (u: SortingState | ((old: SortingState) => SortingState)) => {
    const next = typeof u === "function" ? u(sorting) : u;
    setSortingState(next);
    const s = next[0];
    if (id && s) {
      settings.update((c) => ({
        ...c,
        tables: { ...c.tables, [id]: { sort: { key: s.id, ascending: !s.desc } } },
      }));
    }
  };
  const defs = useMemo<ColumnDef<R>[]>(
    () => columns.map((c) => ({ id: c.id, header: c.header, enableSorting: true })),
    [columns],
  );
  const table = useReactTable({
    data: rows,
    columns: defs,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSortingRemoval: false,
    getRowId: (row) => String(rowKey(row)),
    getCoreRowModel: getCoreRowModel(),
  });
  const core = table.getCoreRowModel().rows;
  const sort = sorting[0];
  const sortColumn = sort ? columns.find((c) => c.id === sort.id) : undefined;
  // A live sort column re-sorts when `version` moves; any other column keeps its order.
  const orderVersion = sortColumn?.live ? version : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: orderVersion is the re-sort trigger
  const sorted = useMemo(() => {
    if (!sortColumn || !sort) return core;
    const cells = core.map((r) => sortColumn.cell(r.original));
    return sortOrder(cells, !sort.desc).flatMap((i) => {
      const r = core[i];
      return r ? [r] : [];
    });
  }, [core, sortColumn, sort, orderVersion]);

  const body = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => body.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });
  // A density or font change re-measures the rows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rowHeight is the trigger
  useEffect(() => virt.measure(), [virt, rowHeight]);
  const total = columns.reduce((n, c) => n + c.width, 0);

  return (
    <div className="table" ref={body}>
      <div className="thead" style={{ width: total, height: HEADER_HEIGHT }}>
        {columns.map((c) => {
          const active = sort?.id === c.id;
          return (
            <button
              type="button"
              key={c.id}
              className={`th${active ? " active" : ""}`}
              style={{ width: c.width }}
              title={c.hint}
              onClick={() => table.getColumn(c.id)?.toggleSorting(active ? !sort?.desc : false)}
            >
              {c.header}
              {active ? (sort?.desc ? " ▼" : " ▲") : ""}
            </button>
          );
        })}
      </div>
      <div className="tbody" style={{ height: virt.getTotalSize(), width: total }}>
        {virt.getVirtualItems().map((vr) => {
          const row = sorted[vr.index];
          if (!row) return null;
          return (
            <div
              key={row.id}
              className={`tr${vr.index % 2 ? " odd" : ""}${onRowClick ? " clickable" : ""}`}
              style={{ height: rowHeight, transform: `translateY(${vr.start}px)` }}
              {...(onRowClick
                ? {
                    role: "row",
                    onClick: () => onRowClick(row.original, 0),
                    onContextMenu: (e: MouseEvent) => {
                      e.preventDefault();
                      onRowClick(row.original, 2);
                    },
                  }
                : {})}
            >
              {columns.map((c) => {
                // Read live (not from a cache), so a view that moves every frame redraws only these rows.
                const cell = c.cell(row.original);
                return (
                  <div key={c.id} className={`td${isNumeric(cell) ? " num" : ""}`} style={{ width: c.width }}>
                    <CellView cell={cell} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const DataTable = memo(DataTableInner) as typeof DataTableInner;
