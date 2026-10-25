// The virtualized sortable table (replaces crates/game/src/table, 1,700 lines): TanStack Table for
// the model and sorting, TanStack Virtual for the rows. Behavior kept from table/mod.rs: a
// click on a header sorts ascending then descending, unknown cells sort last in both directions,
// ties keep row order, the header stays put while the body scrolls, numbers align right, link cells
// open their page. Only the rows in view (plus a small overscan) exist in the DOM, so 10,000 rows
// scroll and sort smoothly.

import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useMemo, useRef, useState } from "react";
import { type Cell, cellTone, cmpCell, display, isNumeric, type PageRef } from "./cells.ts";

export interface Column<R> {
  id: string;
  header: string;
  /** Pixel width. */
  width: number;
  cell: (row: R) => Cell;
}

export interface DataTableProps<R> {
  rows: readonly R[];
  columns: readonly Column<R>[];
  /** A stable key for a row (its id). */
  rowKey: (row: R) => string | number;
  /** A link cell was clicked. */
  onOpen?: (page: PageRef) => void;
  /** The column sorted at the start. */
  initialSort?: { id: string; desc: boolean };
  /**
   * Changes when the cells of the rows in view should be re-read (live columns) without rebuilding
   * the row model: the sorted order stays as it was until the player sorts again or `rows` changes.
   */
  version?: unknown;
}

/** Row height in pixels (theme.rs size::ROW). */
export const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 26;
const OVERSCAN = 12;

function CellView({ cell, onOpen }: { cell: Cell; onOpen: ((p: PageRef) => void) | undefined }) {
  const tone = cellTone(cell);
  const cls = `cell${isNumeric(cell) ? " num" : ""}${tone ? ` ${tone}` : ""}`;
  if (cell.k === "link") {
    const page = cell.page;
    return (
      <button type="button" className={`${cls} linkbtn`} onClick={() => onOpen?.(page)}>
        {cell.text}
      </button>
    );
  }
  return <span className={cls}>{display(cell)}</span>;
}

function DataTableInner<R>({ rows, columns, rowKey, onOpen, initialSort }: DataTableProps<R>) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ? [initialSort] : []);
  const defs = useMemo<ColumnDef<R, Cell | undefined>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        header: c.header,
        // Unknown cells are undefined here so `sortUndefined: "last"` keeps them last both ways.
        accessorFn: (row: R) => {
          const cell = c.cell(row);
          return cell.k === "unknown" ? undefined : cell;
        },
        sortUndefined: "last",
        sortDescFirst: false,
        sortingFn: (a, b, id) => cmpCell(a.getValue<Cell>(id), b.getValue<Cell>(id)),
        enableSorting: true,
      })),
    [columns],
  );
  const table = useReactTable({
    data: rows as R[],
    columns: defs,
    state: { sorting },
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getRowId: (row) => String(rowKey(row)),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const body = useRef<HTMLDivElement>(null);
  const sorted = table.getRowModel().rows;
  const virt = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => body.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });
  const total = columns.reduce((n, c) => n + c.width, 0);
  const sort = sorting[0];

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
              className={`tr${vr.index % 2 ? " odd" : ""}`}
              style={{ height: ROW_HEIGHT, transform: `translateY(${vr.start}px)` }}
            >
              {columns.map((c) => {
                // Read live (not the sort cache), so a view that moves every frame redraws only these rows.
                const cell = c.cell(row.original);
                return (
                  <div key={c.id} className={`td${isNumeric(cell) ? " num" : ""}`} style={{ width: c.width }}>
                    <CellView cell={cell} onOpen={onOpen} />
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
