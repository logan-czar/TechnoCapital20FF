// Canonical JSON for saves and the state hash (D953). Rust used postcard, which writes a fixed
// layout by construction; here one encoder gives both formats the same guarantees:
//
// - object keys are written in sorted order (UTF-16 code units), so insertion order never shows;
// - `Map` and `Set` (the BTreeMap / BTreeSet ports) are written as a tagged array of entries or
//   keys sorted by key (numbers before strings);
// - typed arrays are written as plain arrays;
// - an `AppendBuf` (world/log.ts) is written as the rows it owns, tagged, never its shared
//   buffer, so rows another copy appended past `len` never reach a save or a hash (D401; a
//   ChunkLog is its two buffers, `{ closed, open }`, the same rows as its `ChunkLogRepr`);
// - numbers that JSON cannot hold (NaN, ±Infinity, -0) are written as a tagged object; every
//   other number is written in JS's shortest round-trip form, which parses back to the same
//   bits, so f64 state is exact;
// - `undefined` object properties are skipped (as JSON.stringify does); `undefined` in an array,
//   a bigint, a function, a symbol or a class instance other than the above throws.
//
// Tagged values are objects with a "$" key; no plain object in the world uses that key (the
// encoder throws if one does), so `canonicalRevive` reads the tags back without ambiguity.

import { appendBufFromRows } from "./world/log.ts";

/** Receives the encoded text in pieces, in order. */
export type Sink = (piece: string) => void;

function cmpKey(a: number | string, b: number | string): number {
  if (typeof a !== typeof b) return typeof a === "number" ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function encodeNumber(n: number, emit: Sink): void {
  if (Number.isNaN(n)) emit('{"$":"num","v":"NaN"}');
  else if (n === Number.POSITIVE_INFINITY) emit('{"$":"num","v":"Infinity"}');
  else if (n === Number.NEGATIVE_INFINITY) emit('{"$":"num","v":"-Infinity"}');
  else if (Object.is(n, -0)) emit('{"$":"num","v":"-0"}');
  else emit(String(n));
}

function isPlainObject(v: object): v is Record<string, unknown> {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function isAppendBuf(v: Record<string, unknown>): v is { slots: unknown[]; len: number } {
  return (
    Array.isArray(v.slots) &&
    typeof v.len === "number" &&
    Number.isSafeInteger(v.len) &&
    Object.keys(v).length === 2
  );
}

function encodeList(items: Iterable<unknown>, emit: Sink): void {
  emit("[");
  let first = true;
  for (const item of items) {
    if (!first) emit(",");
    first = false;
    canonicalEncode(item, emit);
  }
  emit("]");
}

/** Writes `value` as canonical JSON to `emit` (see the file docs). */
export function canonicalEncode(value: unknown, emit: Sink): void {
  switch (typeof value) {
    case "number":
      encodeNumber(value, emit);
      return;
    case "string":
      emit(JSON.stringify(value));
      return;
    case "boolean":
      emit(value ? "true" : "false");
      return;
    case "object":
      break;
    default:
      throw new TypeError(`cannot encode a ${typeof value} in saved state`);
  }
  if (value === null) {
    emit("null");
    return;
  }
  if (Array.isArray(value)) {
    emit("[");
    for (let i = 0; i < value.length; i++) {
      if (i > 0) emit(",");
      if (value[i] === undefined) throw new TypeError(`undefined at index ${i} of an array in saved state`);
      canonicalEncode(value[i], emit);
    }
    emit("]");
    return;
  }
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    encodeList(value as unknown as Iterable<number>, emit);
    return;
  }
  if (value instanceof Map) {
    const entries = [...value.entries()].sort((a, b) => cmpKey(a[0], b[0]));
    emit('{"$":"map","e":');
    encodeList(entries, emit);
    emit("}");
    return;
  }
  if (value instanceof Set) {
    const keys = [...value.values()].sort(cmpKey);
    emit('{"$":"set","k":');
    encodeList(keys, emit);
    emit("}");
    return;
  }
  if (!isPlainObject(value)) {
    throw new TypeError("cannot encode a class instance in saved state");
  }
  if (isAppendBuf(value)) {
    emit('{"$":"buf","rows":[');
    for (let i = 0; i < value.len; i++) {
      if (i > 0) emit(",");
      canonicalEncode(value.slots[i], emit);
    }
    emit("]}");
    return;
  }
  const keys = Object.keys(value).sort();
  emit("{");
  let first = true;
  for (const k of keys) {
    if (k === "$" || k === "__proto__") throw new TypeError(`saved state may not use the key \`${k}\``);
    const v = value[k];
    if (v === undefined) continue;
    if (!first) emit(",");
    first = false;
    emit(JSON.stringify(k));
    emit(":");
    canonicalEncode(v, emit);
  }
  emit("}");
}

/** `value` as one canonical JSON string. */
export function canonicalString(value: unknown): string {
  const parts: string[] = [];
  canonicalEncode(value, (s) => parts.push(s));
  return parts.join("");
}

function reviveNumber(v: unknown): number {
  switch (v) {
    case "NaN":
      return Number.NaN;
    case "Infinity":
      return Number.POSITIVE_INFINITY;
    case "-Infinity":
      return Number.NEGATIVE_INFINITY;
    case "-0":
      return -0;
    default:
      throw new TypeError(`bad number tag \`${String(v)}\``);
  }
}

/**
 * Turns parsed canonical JSON (`JSON.parse` of `canonicalString`) back into state: tagged
 * numbers, Maps, Sets and AppendBufs are rebuilt; everything else is as parsed. Throws a
 * TypeError on a malformed tag.
 */
export function canonicalRevive(tree: unknown): unknown {
  if (tree === null || typeof tree !== "object") return tree;
  if (Array.isArray(tree)) return tree.map(canonicalRevive);
  const obj = tree as Record<string, unknown>;
  if ("$" in obj) {
    switch (obj.$) {
      case "num":
        return reviveNumber(obj.v);
      case "map": {
        if (!Array.isArray(obj.e)) throw new TypeError("bad map tag");
        const m = new Map<unknown, unknown>();
        for (const e of obj.e as unknown[]) {
          if (!Array.isArray(e) || e.length !== 2) throw new TypeError("bad map entry");
          m.set(canonicalRevive(e[0]), canonicalRevive(e[1]));
        }
        return m;
      }
      case "set": {
        if (!Array.isArray(obj.k)) throw new TypeError("bad set tag");
        return new Set((obj.k as unknown[]).map(canonicalRevive));
      }
      case "buf": {
        if (!Array.isArray(obj.rows)) throw new TypeError("bad buffer tag");
        return appendBufFromRows((obj.rows as unknown[]).map(canonicalRevive));
      }
      default:
        throw new TypeError(`unknown tag \`${String(obj.$)}\``);
    }
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) out[k] = canonicalRevive(obj[k]);
  return out;
}
