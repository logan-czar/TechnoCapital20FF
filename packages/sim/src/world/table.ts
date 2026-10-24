// Table helpers beyond types/collections.ts (tableFromRows, tablePush, row). Ported from
// crates/sim/src/world/table.rs: tables are plain arrays in id order (build-plan 2.3, 4.3), so
// every pass over a table is in a fixed order (no Map iteration, CLAUDE.md).

import type { Table } from "../types/collections.ts";
import type { Ordinal } from "../types/ids.ts";
import { ordinal } from "../types/ids.ts";

export type { Table } from "../types/collections.ts";
export { row, tableFromRows, tablePush } from "../types/collections.ts";

/** An empty table (Rust `Table::default`). */
export function tableNew<Id extends Ordinal<string>, Row>(): Table<Id, Row> {
  return [] as Row[] as Table<Id, Row>;
}

/** The row with this id, or null when out of range (Rust `Table::get`). */
export function tableGet<Id extends Ordinal<string>, Row>(table: Table<Id, Row>, id: Id): Row | null {
  return table[id] ?? null;
}

/** Rust `Table::len`. */
export function tableLen<Id extends Ordinal<string>, Row>(table: Table<Id, Row>): number {
  return table.length;
}

/** Rust `Table::is_empty`. */
export function tableIsEmpty<Id extends Ordinal<string>, Row>(table: Table<Id, Row>): boolean {
  return table.length === 0;
}

/** Every id, in order (Rust `Table::ids`). */
export function tableIds<Id extends Ordinal<string>, Row>(table: Table<Id, Row>): Id[] {
  return table.map((_, i) => ordinal<Id>(i));
}

/** Rows with their ids, in id order (Rust `Table::iter`). */
export function tableIter<Id extends Ordinal<string>, Row>(table: Table<Id, Row>): [Id, Row][] {
  return table.map((r, i) => [ordinal<Id>(i), r]);
}

/** The rows as an array, in id order (Rust `Table::rows`). */
export function tableRows<Id extends Ordinal<string>, Row>(table: Table<Id, Row>): readonly Row[] {
  return table;
}
