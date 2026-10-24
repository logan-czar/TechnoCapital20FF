// Collection contracts for the deterministic sim (CLAUDE.md: fixed iteration order;
// crates/sim/src/world/table.rs).

import type { Ordinal } from "./ids.ts";

/**
 * The rows of one entity type in id order: row i has id i (Rust `Table<I, T>`). A plain array, so
 * saves, the state hash and structured clone cover every row. Index with an ordinal of type `Id`.
 */
export type Table<Id extends Ordinal<string>, Row> = Row[] & { readonly __id?: Id };

/** A table built from rows already in id order (Rust `Table::from_rows`). */
export function tableFromRows<Id extends Ordinal<string>, Row>(rows: Row[]): Table<Id, Row> {
  return rows as Table<Id, Row>;
}

/** Appends a row and returns its id, the next ordinal (Rust `Table::push`). */
export function tablePush<Id extends Ordinal<string>, Row>(table: Table<Id, Row>, row: Row): Id {
  table.push(row);
  return (table.length - 1) as Id;
}

/** The row with this id, or throws (Rust `table[id]`, which panics out of range). */
export function row<Id extends Ordinal<string>, Row>(table: Table<Id, Row>, id: Id): Row {
  const r = table[id];
  if (r === undefined) throw new RangeError(`no row ${id} in a table of ${table.length}`);
  return r;
}

/**
 * Rust `BTreeMap<K, V>`: a map whose iteration must be in ascending key order. JS Map iterates in
 * insertion order, so never iterate one directly in sim code: use `sortedEntries`.
 */
export type BTreeMap<K extends number | string, V> = Map<K, V>;

/** Rust `BTreeSet<K>`; iterate with `sortedKeys`. */
export type BTreeSet<K extends number | string> = Set<K>;

function cmpKey(a: number | string, b: number | string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A BTreeMap's entries in ascending key order (code-unit order for strings). */
export function sortedEntries<K extends number | string, V>(map: BTreeMap<K, V>): [K, V][] {
  return [...map.entries()].sort((a, b) => cmpKey(a[0], b[0]));
}

/** A BTreeSet's (or BTreeMap's) keys in ascending order. */
export function sortedKeys<K extends number | string>(set: BTreeSet<K> | BTreeMap<K, unknown>): K[] {
  return [...set.keys()].sort(cmpKey);
}
