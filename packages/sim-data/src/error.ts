// Load and check errors that name the file, line and field (spec 10 M0, build-plan M0.3).
// Ported from crates/sim-data/src/error.rs. The Rust `Result` is the plain-data one below; it is
// structurally the same as `Result` in the sim contracts (packages/sim/src/types/world.ts), which
// sim-data cannot import (sim depends on sim-data).

/** Rust `Result<T, E>`, as plain data. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** `Ok(value)`. */
export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

/** `Err(error)`. */
export function err<E>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}

/** One problem in the data: where it is and what is wrong. */
export interface DataError {
  /** File path relative to the data directory, such as `provinces-europe.csv`. */
  file: string;
  /** 1-based line in the file (the header is line 1), when the problem is in one row. */
  line: number | null;
  /** Column name, when the problem is in one field. */
  field: string | null;
  message: string;
}

/** A problem with a whole file (missing, unreadable, wrong row count). */
export function dataErrorFile(file: string, message: string): DataError {
  return { file, line: null, field: null, message };
}

/** A problem in one field of one row. */
export function dataErrorField(file: string, line: number, field: string, message: string): DataError {
  return { file, line, field, message };
}

/** Rust `Display for DataError`: `file:line: field `x`: message`. */
export function dataErrorToString(e: DataError): string {
  let s = e.file;
  if (e.line !== null) s += `:${e.line}`;
  if (e.field !== null) s += `: field \`${e.field}\``;
  return `${s}: ${e.message}`;
}
