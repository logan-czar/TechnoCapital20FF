// Generic CSV table loading (build-plan 2.1). Ported from crates/sim-data/src/load.rs, where serde
// derives the row from the header. Here each row type has a `RowSpec`: its columns in declaration
// order with a parser each, which gives the same errors: an unknown column, a missing column or a
// bad value names the file, the line and the column (spec 10 M0).
//
// The core is pure: it reads text from a `Files` map (relative path to contents), so it runs in a
// browser Web Worker as well as in Node. Node file reading is in ./node.ts.

import { parseCsv } from "./csv.ts";
import { type DataError, dataErrorField, dataErrorFile, err, ok, type Result } from "./error.ts";

/** File contents by path relative to the data directory, as Rust opens them (`names/x.csv`). */
export type Files = Readonly<Record<string, string | Uint8Array>>;

/** The rows of one CSV file, with the line each row starts on. */
export interface Table<T> {
  /** Path relative to the data directory, as used in error messages. */
  file: string;
  rows: T[];
  /** 1-based line of each row (the header is line 1). */
  lines: number[];
}

/** An empty table for `file`. */
export function tableNew<T>(file: string): Table<T> {
  return { file, rows: [], lines: [] };
}

export function tableLen<T>(t: Table<T>): number {
  return t.rows.length;
}

export function tableIsEmpty<T>(t: Table<T>): boolean {
  return t.rows.length === 0;
}

/** Rows with their line numbers. */
export function tableIter<T>(t: Table<T>): [number, T][] {
  return t.rows.map((r, i): [number, T] => [t.lines[i] as number, r]);
}

/** An error in `field` of the row on `line`. */
export function tableErr<T>(t: Table<T>, line: number, field: string, message: string): DataError {
  return dataErrorField(t.file, line, field, message);
}

/** An error about the whole file. */
export function tableFileErr<T>(t: Table<T>, message: string): DataError {
  return dataErrorFile(t.file, message);
}

// ---------------------------------------------------------------- field parsers

/** Parses one cell: the value, or the message serde would give. */
export type Parse<V> = ((cell: string) => Result<V, string>) & {
  /** An `Option` column: serde fills null when the whole column is absent. */
  optional?: true;
};

/** Marks a parser as an `Option` column. */
function optionalOf<V>(p: (cell: string) => Result<V, string>): Parse<V> {
  return Object.assign(p, { optional: true as const });
}

/** A row type: its columns in declaration order. Build with `rowSpec`. */
export interface RowSpec<T> {
  fields: readonly (readonly [string, Parse<unknown>])[];
  /** Phantom: ties the spec to its row type. */
  readonly __row?: T;
}

/** The columns of `T` in the order the object lists them (the struct field order). */
export function rowSpec<T>(parsers: { [K in keyof T & string]-?: Parse<T[K]> }): RowSpec<T> {
  return { fields: Object.entries(parsers) as [string, Parse<unknown>][] };
}

/** A `String` column. */
export const str: Parse<string> = (s) => ok(s);

const FLOAT_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const SPECIAL_FLOAT_RE = /^([+-]?)(inf|infinity|nan)$/i;

/** An `f64` column: Rust `str::parse::<f64>`. */
export const f64: Parse<number> = (s) => {
  if (s === "") return err("cannot parse float from empty string");
  if (FLOAT_RE.test(s)) return ok(Number(s));
  const m = SPECIAL_FLOAT_RE.exec(s);
  if (m !== null) {
    if ((m[2] as string).toLowerCase() === "nan") return ok(Number.NaN);
    return ok(m[1] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
  }
  return err("invalid float literal");
};

/** An `Option<f64>` column: an empty cell is None (null). */
export const optF64: Parse<number | null> = optionalOf<number | null>((s) => (s === "" ? ok(null) : f64(s)));

/** An `Option<u32>` column: an empty cell is None (null). */
export const optU32: Parse<number | null> = optionalOf<number | null>((s) => (s === "" ? ok(null) : u32(s)));

/** Rust `str::parse` for an unsigned integer type whose largest value is `max`. */
export function uint(max: number): Parse<number> {
  return (s) => {
    if (s === "") return err("cannot parse integer from empty string");
    // The csv crate reads a `0x` prefix as hex (deserializer.rs), whatever the integer type.
    const hex = s.startsWith("0x");
    const body = hex ? s.slice(2) : s;
    const digits = body.startsWith("+") ? body.slice(1) : body;
    if (hex && body === "") return err("cannot parse integer from empty string");
    if (digits === "" || !(hex ? /^[0-9a-fA-F]+$/ : /^\d+$/).test(digits)) {
      return err("invalid digit found in string");
    }
    const n = hex ? Number.parseInt(digits, 16) : Number(digits);
    if (n > max) return err("number too large to fit in target type");
    return ok(n);
  };
}

/** A `u8` column. */
export const u8: Parse<number> = uint(0xff);
/** A `u32` column. */
export const u32: Parse<number> = uint(0xffff_ffff);
/** A `u64` column; above 2^53 - 1 a JS number is no longer exact, so that is the limit. */
export const u64: Parse<number> = uint(Number.MAX_SAFE_INTEGER);

/** `Y` or `N` (rows.rs `yes_no`). */
export const yesNo: Parse<boolean> = (s) => {
  if (s === "Y") return ok(true);
  if (s === "N") return ok(false);
  return err(`expected Y or N, found \`${s}\``);
};

/** A `;`-separated list; an empty cell is an empty list (rows.rs `semi_list`). */
export const semiList: Parse<string[]> = (s) => ok(s.split(";").filter((p) => p !== ""));

/**
 * A unit-variant enum column: the CSV writes serde names (`rename_all = "snake_case"`), the value
 * is the Rust variant name (unit enums are string unions of variant names, D952). `names` maps
 * each serde name to its variant, in declaration order (the order serde lists them in errors).
 */
export function enumOf<V extends string>(names: Readonly<Record<string, V>>): Parse<V> {
  const serde = Object.keys(names);
  return (s) => {
    const hit = Object.hasOwn(names, s) ? names[s] : undefined;
    if (hit !== undefined) return ok(hit);
    return err(`unknown variant \`${s}\`, ${oneOf(serde)}`);
  };
}

/** serde's `OneOf` list: "there are no fields", "expected `a`", "expected `a` or `b`", "expected one of `a`, `b`". */
export function oneOf(names: readonly string[]): string {
  const q = names.map((n) => `\`${n}\``);
  if (q.length === 0) return "there are no fields";
  if (q.length === 1) return `expected ${q[0]}`;
  if (q.length === 2) return `expected ${q[0]} or ${q[1]}`;
  return `expected one of ${q.join(", ")}`;
}

// ---------------------------------------------------------------- loading

/** The text of a file; `invalid` when bytes were not UTF-8 (they decode to U+FFFD, found per row). */
function textOf(contents: string | Uint8Array): { text: string; invalid: boolean } {
  if (typeof contents === "string") return { text: contents, invalid: false };
  try {
    // A BOM is dropped by the decoder.
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(contents), invalid: false };
  } catch {
    return { text: new TextDecoder("utf-8").decode(contents), invalid: true };
  }
}

/**
 * Loads `files[file]` into rows of `T`, using the header row to match columns to fields. A header
 * with no rows loads as an empty table, as csv does (the column checks run per row).
 */
export function loadTable<T>(files: Files, file: string, spec: RowSpec<T>): Result<Table<T>, DataError> {
  const contents = files[file];
  if (contents === undefined) return err(dataErrorFile(file, "file not found"));
  const { text, invalid } = textOf(contents);
  const { records, lines } = parseCsv(text);
  const table = tableNew<T>(file);
  const headers = records[0] ?? [];
  const parsers = new Map(spec.fields);
  for (let r = 1; r < records.length; r++) {
    const record = records[r] as string[];
    const line = lines[r] as number;
    // csv reports invalid UTF-8 as it reads the record, before any deserializing (load.rs).
    const badCol = invalid ? record.findIndex((c) => c.includes("�")) : -1;
    if (badCol >= 0) {
      return err(dataErrorField(file, line, headers[badCol] ?? "", "not valid UTF-8"));
    }
    if (record.length !== headers.length) {
      return err({
        file,
        line,
        field: null,
        message: `row has ${record.length} fields, the header has ${headers.length}`,
      });
    }
    const row = deserializeRow(file, line, spec, parsers, headers, record);
    if (!row.ok) return row;
    table.rows.push(row.value);
    table.lines.push(line);
  }
  return ok(table);
}

/**
 * Struct-from-map order, as serde does it: columns left to right (an unknown or repeated column,
 * or a bad value, fails at once), then the first field of the struct that no column gave.
 */
function deserializeRow<T>(
  file: string,
  line: number,
  spec: RowSpec<T>,
  parsers: ReadonlyMap<string, Parse<unknown>>,
  headers: readonly string[],
  record: readonly string[],
): Result<T, DataError> {
  const out: Record<string, unknown> = {};
  for (let col = 0; col < headers.length; col++) {
    const name = headers[col] as string;
    const parse = parsers.get(name);
    if (parse === undefined) {
      const expected = oneOf(spec.fields.map(([f]) => f));
      return err(dataErrorField(file, line, name, `unknown field \`${name}\`, ${expected}`));
    }
    if (Object.hasOwn(out, name)) {
      return err(dataErrorField(file, line, name, `duplicate field \`${name}\``));
    }
    const parsed = parse(record[col] as string);
    if (!parsed.ok) return err(dataErrorField(file, line, name, parsed.error));
    out[name] = parsed.value;
  }
  for (const [name, parse] of spec.fields) {
    if (!Object.hasOwn(out, name)) {
      if (parse.optional) {
        out[name] = null;
        continue;
      }
      return err(dataErrorField(file, line, name, `missing field \`${name}\``));
    }
  }
  return ok(out as T);
}
