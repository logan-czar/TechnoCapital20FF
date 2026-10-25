// An append-only history kept in chunks (spec 9.4 "only changed rows are rebuilt"; D139, D148,
// D401): ten years of daily bars per company and the news feed. Ported from
// crates/sim/src/world/log.rs; the types are in types/log.ts.
//
// A view copies a log by sharing two buffers, whatever its length (`appendBufClone`,
// `chunkLogClone`). The open chunk and the list of closed chunks are each an AppendBuf: a shared
// buffer of write-once slots plus the number of rows this copy owns. Appending fills the next
// free slot in place, even while a view shares the buffer, since the view's own count never
// reaches it; the buffer is copied only when another copy already filled that slot (D401). So a
// day's new bar costs one slot write, not a copy of the open month, and closing a month adds one
// chunk pointer, not a copy of the list.
//
// JS has no `OnceLock` and arrays grow, so a slot is "still empty" when `slots.length === len`
// (the buffer holds exactly the rows some copy has filled); the Rust preallocated capacity
// (APPEND_BUF_MIN_SLOTS) is not needed.

import type { AppendBuf, ChunkLog, ChunkLogRepr } from "../types/log.ts";

export type { AppendBuf, ChunkLog, ChunkLogRepr } from "../types/log.ts";
export { APPEND_BUF_MIN_SLOTS } from "../types/log.ts";

// ---------------------------------------------------------------- AppendBuf

/** An empty buffer (Rust `AppendBuf::default`). */
export function appendBufNew<T>(): AppendBuf<T> {
  return { slots: [], len: 0 };
}

/** A buffer owning `rows` (Rust `AppendBuf::from_rows`). */
export function appendBufFromRows<T>(rows: Iterable<T>): AppendBuf<T> {
  const slots = [...rows];
  return { slots, len: slots.length };
}

/** A cheap copy sharing the buffer (Rust `Clone`: cloning the `Arc`). */
export function appendBufClone<T>(buf: AppendBuf<T>): AppendBuf<T> {
  return { slots: buf.slots, len: buf.len };
}

/** The owned rows, oldest first, as a new array (Rust `iter().collect()`). */
export function appendBufRows<T>(buf: AppendBuf<T>): T[] {
  return buf.slots.slice(0, buf.len);
}

/** The owned rows, oldest first (Rust `iter`). */
export function* appendBufIter<T>(buf: AppendBuf<T>): Generator<T, void, undefined> {
  for (let i = 0; i < buf.len; i++) yield buf.slots[i]!;
}

/** Rust `AppendBuf::len`. */
export function appendBufLen<T>(buf: AppendBuf<T>): number {
  return buf.len;
}

/** Rust `AppendBuf::is_empty`. */
export function appendBufIsEmpty<T>(buf: AppendBuf<T>): boolean {
  return buf.len === 0;
}

/** Rust `AppendBuf::first`. */
export function appendBufFirst<T>(buf: AppendBuf<T>): T | null {
  return buf.len === 0 ? null : buf.slots[0]!;
}

/** The owned row at `i` (Rust `AppendBuf::get`). */
export function appendBufGet<T>(buf: AppendBuf<T>, i: number): T | null {
  return Number.isInteger(i) && i >= 0 && i < buf.len ? buf.slots[i]! : null;
}

/** Rust `AppendBuf::last`. */
export function appendBufLast<T>(buf: AppendBuf<T>): T | null {
  return buf.len === 0 ? null : buf.slots[buf.len - 1]!;
}

/** True if `other` is a copy of this buffer with the same rows (a cheap copy, not a rebuild). */
export function appendBufSharesWith<T>(buf: AppendBuf<T>, other: AppendBuf<T>): boolean {
  return buf.slots === other.slots && buf.len === other.len;
}

/** Appends `row` (see the AppendBuf type docs; Rust `AppendBuf::push`). */
export function appendBufPush<T>(buf: AppendBuf<T>, row: T): void {
  if (buf.slots.length === buf.len) {
    // Slot `len` is empty: fill it in place.
    buf.slots.push(row);
    buf.len += 1;
    return;
  }
  // Another copy filled slot `len` first: copy the owned rows into a new buffer and go on alone.
  const slots = buf.slots.slice(0, buf.len);
  slots.push(row);
  buf.slots = slots;
  buf.len += 1;
}

/** Rust `PartialEq`: the same owned rows, compared with `eq`. */
export function appendBufEq<T>(a: AppendBuf<T>, b: AppendBuf<T>, eq: (x: T, y: T) => boolean): boolean {
  if (a.len !== b.len) return false;
  for (let i = 0; i < a.len; i++) if (!eq(a.slots[i]!, b.slots[i]!)) return false;
  return true;
}

// ---------------------------------------------------------------- ChunkLog

/** An empty log (Rust `ChunkLog::default`). */
export function chunkLogNew<T>(): ChunkLog<T> {
  return { closed: appendBufNew(), open: appendBufNew() };
}

/** A cheap copy sharing both buffers (Rust `Clone`). */
export function chunkLogClone<T>(log: ChunkLog<T>): ChunkLog<T> {
  return { closed: appendBufClone(log.closed), open: appendBufClone(log.open) };
}

/**
 * The saved form: plain arrays of the owned rows, the layout before D401 (Rust `Serialize` for
 * ChunkLog). The closed chunks are shared, not copied; they are never written again.
 */
export function chunkLogToRepr<T>(log: ChunkLog<T>): ChunkLogRepr<T> {
  return { closed: appendBufRows(log.closed), open: appendBufRows(log.open) };
}

/** Rust `Deserialize` for ChunkLog: rebuilds the buffers from the saved arrays. */
export function chunkLogFromRepr<T>(repr: ChunkLogRepr<T>): ChunkLog<T> {
  return { closed: appendBufFromRows(repr.closed), open: appendBufFromRows(repr.open) };
}

/** Appends `row`. When `sameChunk(last row, row)` is false the open chunk is closed first. */
export function chunkLogPush<T>(log: ChunkLog<T>, row: T, sameChunk: (last: T, row: T) => boolean): void {
  const last = appendBufLast(log.open);
  if (last !== null && !sameChunk(last, row)) {
    const full = log.open;
    log.open = appendBufNew();
    appendBufPush(log.closed, appendBufRows(full));
  }
  appendBufPush(log.open, row);
}

/**
 * Drops the oldest rows while `old(row)` holds (rows are in order, so `old` holds for a prefix).
 * Whole chunks go; a chunk that straddles the edge is trimmed.
 */
export function chunkLogDropWhile<T>(log: ChunkLog<T>, old: (row: T) => boolean): void {
  let gone = 0;
  for (const c of appendBufIter(log.closed)) {
    // Rust `c.last().is_none_or(&old)`.
    const last = c.length === 0 ? null : c[c.length - 1]!;
    if (last === null || old(last)) gone += 1;
    else break;
  }
  if (gone > 0) {
    log.closed = appendBufFromRows(appendBufRows(log.closed).slice(gone));
  }
  const first = appendBufFirst(log.closed);
  if (first !== null && first.length > 0 && old(first[0]!)) {
    const trimmed = first.filter((r) => !old(r));
    const rest = appendBufRows(log.closed).slice(1);
    log.closed = appendBufFromRows([trimmed, ...rest]);
  }
  const openFirst = appendBufFirst(log.open);
  if (appendBufIsEmpty(log.closed) && openFirst !== null && old(openFirst)) {
    log.open = appendBufFromRows(appendBufRows(log.open).filter((r) => !old(r)));
  }
}

/** Every row, oldest first (Rust `ChunkLog::iter`). */
export function* chunkLogIter<T>(log: ChunkLog<T>): Generator<T, void, undefined> {
  for (const c of appendBufIter(log.closed)) yield* c;
  yield* appendBufIter(log.open);
}

/** Every row, oldest first, as a new array. */
export function chunkLogRows<T>(log: ChunkLog<T>): T[] {
  return [...chunkLogIter(log)];
}

/**
 * The rows from index `start` on, oldest first, as a new array: the closed chunks wholly before
 * `start` are skipped by their lengths, so a recent `start` reads only the recent rows. Not Rust.
 */
export function chunkLogRowsFrom<T>(log: ChunkLog<T>, start: number): T[] {
  const out: T[] = [];
  let at = 0;
  for (const c of appendBufIter(log.closed)) {
    if (at + c.length > start) {
      for (let j = Math.max(start - at, 0); j < c.length; j++) out.push(c[j]!);
    }
    at += c.length;
  }
  const open = log.open;
  for (let j = Math.max(start - at, 0); j < open.len; j++) out.push(open.slots[j]!);
  return out;
}

/** The row at index `i` (oldest first), or null past the end. Not Rust. */
export function chunkLogAt<T>(log: ChunkLog<T>, i: number): T | null {
  if (!Number.isInteger(i) || i < 0) return null;
  let at = 0;
  for (const c of appendBufIter(log.closed)) {
    if (i < at + c.length) return c[i - at]!;
    at += c.length;
  }
  return appendBufGet(log.open, i - at);
}

/** The number of rows kept (Rust `ChunkLog::len`). */
export function chunkLogLen<T>(log: ChunkLog<T>): number {
  let n = log.open.len;
  for (const c of appendBufIter(log.closed)) n += c.length;
  return n;
}

/** Rust `ChunkLog::is_empty`. */
export function chunkLogIsEmpty<T>(log: ChunkLog<T>): boolean {
  if (log.open.len > 0) return false;
  for (const c of appendBufIter(log.closed)) if (c.length > 0) return false;
  return true;
}

/** The newest row (Rust `ChunkLog::last`). */
export function chunkLogLast<T>(log: ChunkLog<T>): T | null {
  const open = appendBufLast(log.open);
  if (open !== null) return open;
  const c = appendBufLast(log.closed);
  return c === null || c.length === 0 ? null : c[c.length - 1]!;
}

/** The open chunk (the newest rows, at most a chunk's worth; Rust `open_chunk`). */
export function chunkLogOpenChunk<T>(log: ChunkLog<T>): Generator<T, void, undefined> {
  return appendBufIter(log.open);
}

/** The default key order: numbers and strings by `<` (UTF-16 code units for strings). */
function cmpKey<K extends number | string>(a: K, b: K): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The rows whose key is `key` or later, oldest first, when the rows are in ascending (or
 * non-descending) key order: a binary search over the closed chunks by their last row, then
 * within the one chunk, so finding the start costs O(log n) (D545). `cmp` orders keys; the
 * default suits numbers and strings.
 */
export function* chunkLogIterFrom<T, K extends number | string>(
  log: ChunkLog<T>,
  key: K,
  keyOf: (row: T) => K,
  cmp: (a: K, b: K) => number = cmpKey,
): Generator<T, void, undefined> {
  const closed = log.closed;
  let lo = 0;
  let hi = closed.len;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const c = appendBufGet(closed, mid);
    const last = c === null || c.length === 0 ? null : c[c.length - 1]!;
    if (last !== null && cmp(keyOf(last), key) >= 0) hi = mid;
    else lo = mid + 1;
  }
  let inChunk = 0;
  let inOpen = 0;
  const chunk = appendBufGet(closed, lo);
  if (chunk !== null) {
    // Rust `partition_point(|r| key_of(r) < key)`.
    let a = 0;
    let b = chunk.length;
    while (a < b) {
      const mid = Math.floor((a + b) / 2);
      if (cmp(keyOf(chunk[mid]!), key) < 0) a = mid + 1;
      else b = mid;
    }
    inChunk = a;
  } else {
    let a = 0;
    let b = log.open.len;
    while (a < b) {
      const mid = Math.floor((a + b) / 2);
      if (cmp(keyOf(log.open.slots[mid]!), key) < 0) a = mid + 1;
      else b = mid;
    }
    inOpen = a;
  }
  for (let i = lo; i < closed.len; i++) {
    const c = closed.slots[i]!;
    for (let j = i === lo ? inChunk : 0; j < c.length; j++) yield c[j]!;
  }
  for (let j = inOpen; j < log.open.len; j++) yield log.open.slots[j]!;
}

/** The row whose key is `key`, when the rows are in ascending key order (D544). */
export function chunkLogFindSorted<T, K extends number | string>(
  log: ChunkLog<T>,
  key: K,
  keyOf: (row: T) => K,
  cmp: (a: K, b: K) => number = cmpKey,
): T | null {
  const next = chunkLogIterFrom(log, key, keyOf, cmp).next();
  if (next.done) return null;
  return cmp(keyOf(next.value), key) === 0 ? next.value : null;
}

/** True if `other` shares this log's chunks with the same rows (a cheap copy, not a rebuild). */
export function chunkLogSharesWith<T>(log: ChunkLog<T>, other: ChunkLog<T>): boolean {
  return appendBufSharesWith(log.closed, other.closed) && appendBufSharesWith(log.open, other.open);
}
