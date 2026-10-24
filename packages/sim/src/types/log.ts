// An append-only history kept in chunks (spec 9.4 "only changed rows are rebuilt"; D139, D148,
// D401): ten years of daily bars per company and the news feed. Ported from
// crates/sim/src/world/log.rs, type definitions only: AppendBuf's and ChunkLog's methods (push,
// iter, len, last, drop_while, open_chunk, iter_from, find_sorted, shares_with, from_rows) are
// left to the world/ module port.
//
// In Rust a view copies a log by cloning two `Arc`s. In TS the same sharing works with plain
// arrays: copies share one `slots` array and each owns its first `len` slots. JS has no
// `OnceLock`, so "slot `len` is still empty" is `slots.length === len`.

/** Slots in a new AppendBuf: a month of daily bars fits. A full buffer doubles. */
export const APPEND_BUF_MIN_SLOTS = 32;

/**
 * An append-only list whose copies share one buffer of write-once slots (D401). Each copy owns
 * the first `len` slots, all filled and never written again; a push fills slot `len` if it is
 * still empty, else (another copy that pushed first filled it) copies the owned rows into a new
 * buffer. A copy therefore always reads exactly the rows it pushed or was cloned with.
 *
 * Saved and hashed as the plain sequence of the owned rows (`slots.slice(0, len)`), as a `Vec<T>`.
 */
export interface AppendBuf<T> {
  /** The shared buffer; rows past `len` belong to other copies. */
  slots: T[];
  /** Rows this copy owns. Whole number (usize). */
  len: number;
}

/**
 * An append-only list in chunks: the closed chunks, oldest first, and the open chunk, each an
 * AppendBuf (D401). Rows arrive in order; the caller says when a row starts a new chunk (a new
 * month). Saves and hashes as `ChunkLogRepr`, the layout before D401, so neither the save format
 * nor any state hash moved with D401.
 */
export interface ChunkLog<T> {
  /** Closed chunks, oldest first (Rust `AppendBuf<Arc<Vec<T>>>`). */
  closed: AppendBuf<T[]>;
  /** The open chunk (the newest rows, at most a chunk's worth). */
  open: AppendBuf<T>;
}

/** The saved form of a ChunkLog: the same fields, read as plain arrays (Rust `ChunkLogRepr`). */
export interface ChunkLogRepr<T> {
  closed: T[][];
  open: T[];
}
