// Canonical JSON for saves and the state hash (D953). Rust used postcard, which writes a fixed
// layout by construction; here one encoder gives both formats the same guarantees:
//
// - object keys are written in sorted order (UTF-16 code units), so insertion order never shows;
// - `Map` and `Set` (the BTreeMap / BTreeSet ports) are written as a tagged array of entries or
//   keys sorted by key (numbers before strings);
// - an `AppendBuf` (world/log.ts) is written as the rows it owns, tagged, never its shared
//   buffer, so rows another copy appended past `len` never reach a save or a hash (D401; a
//   ChunkLog is its two buffers, `{ closed, open }`, the same rows as its `ChunkLogRepr`);
// - numbers that JSON cannot hold (NaN, ±Infinity, -0) are written as a tagged object; every
//   other number is written in JS's shortest round-trip form, which parses back to the same
//   bits, so f64 state is exact;
// - `undefined` object properties are skipped (as JSON.stringify does); `undefined` in an array,
//   a bigint, a function, a symbol or a typed array, a class instance other than the above throws.
//
// Tagged values are objects with a "$" key; no plain object in the world uses that key (the
// encoder throws if one does), so `canonicalRevive` reads the tags back without ambiguity.

import { appendBufFromRows } from "./world/log.ts";

/** Receives the encoded text in pieces, in order. */
export type Sink = (piece: string) => void;

// The writer. The encoder appends to `text` and hands it to `sink` (then empties it) whenever it
// has grown past `chunk` code units, at a value boundary. One string built by `+=` and handed on
// in large pieces costs far less than a callback per token: a hash of ten years of daily bars is
// a third of a billion characters. Module state, saved and restored around each call, so an
// encode started from inside a sink still works.
let text = "";
let sink: Sink = () => {};
let chunk = 0;

/** The pieces `canonicalEncode` hands on, UTF-16 code units (about; a piece ends at a value). */
const OUT_CHUNK = 1 << 16;

function cmpKey(a: number | string, b: number | string): number {
  if (typeof a !== typeof b) return typeof a === "number" ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A finite number other than -0 in JS's shortest round-trip form; the others tagged. */
function numberText(n: number): string {
  // -0 is the one finite number tagged.
  if (Number.isFinite(n)) return n === 0 && 1 / n < 0 ? '{"$":"num","v":"-0"}' : String(n);
  if (Number.isNaN(n)) return '{"$":"num","v":"NaN"}';
  return n > 0 ? '{"$":"num","v":"Infinity"}' : '{"$":"num","v":"-Infinity"}';
}

/**
 * One object layout seen by the encoder: its own keys in `Object.keys` order, and the same keys
 * sorted with each one's JSON text and colon, so a run of objects of one layout (a company's
 * daily bars) sorts and quotes its keys once. The text is the same as sorting every time.
 */
interface Shape {
  readonly keys: readonly string[];
  readonly sorted: readonly string[];
  readonly quoted: readonly string[];
}

/** Layouts by first key; emptied when it holds SHAPES_MAX, so it stays small. */
const shapes = new Map<string, Shape[]>();
let shapeCount = 0;
const SHAPES_MAX = 4096;
/** Objects with more keys than this (records keyed by id, say) sort their keys every time. */
const SHAPE_KEYS_MAX = 32;

function newShape(keys: readonly string[]): Shape {
  const sorted = [...keys].sort();
  for (const k of sorted) {
    if (k === "$" || k === "__proto__") throw new TypeError(`saved state may not use the key \`${k}\``);
  }
  return { keys, sorted, quoted: sorted.map((k) => `${JSON.stringify(k)}:`) };
}

function shapeOf(keys: string[]): Shape {
  if (keys.length > SHAPE_KEYS_MAX) return newShape(keys);
  const first = keys[0] as string;
  let list = shapes.get(first);
  if (list !== undefined) {
    for (const s of list) {
      const sk = s.keys;
      if (sk.length !== keys.length) continue;
      let same = true;
      for (let i = 1; i < keys.length; i++) {
        if (sk[i] !== keys[i]) {
          same = false;
          break;
        }
      }
      if (same) return s;
    }
  }
  const shape = newShape(keys);
  if (shapeCount >= SHAPES_MAX) {
    shapes.clear();
    shapeCount = 0;
    list = undefined;
  }
  if (list === undefined) {
    list = [];
    shapes.set(first, list);
  }
  list.push(shape);
  shapeCount += 1;
  return shape;
}

function encodeList(items: readonly unknown[]): void {
  text += "[";
  for (let i = 0; i < items.length; i++) {
    if (i > 0) text += ",";
    encodeValue(items[i]);
  }
  text += "]";
}

/** A Map, a Set, or a value that cannot be saved (a typed array, a class instance). */
function encodeNonPlain(value: object): void {
  if (ArrayBuffer.isView(value)) {
    // They would revive as plain arrays, silently changing type; nothing in the world uses them.
    throw new TypeError("typed arrays are not allowed in saved state; use plain arrays");
  }
  if (value instanceof Map) {
    const entries = [...value.entries()].sort((a, b) => cmpKey(a[0], b[0]));
    text += '{"$":"map","e":';
    encodeList(entries);
    text += "}";
    return;
  }
  if (value instanceof Set) {
    const keys = [...value.values()].sort(cmpKey);
    text += '{"$":"set","k":';
    encodeList(keys);
    text += "}";
    return;
  }
  throw new TypeError("cannot encode a class instance in saved state");
}

function encodeValue(value: unknown): void {
  switch (typeof value) {
    case "number":
      text += numberText(value);
      return;
    case "string":
      text += JSON.stringify(value);
      return;
    case "boolean":
      text += value ? "true" : "false";
      return;
    case "object":
      break;
    default:
      throw new TypeError(`cannot encode a ${typeof value} in saved state`);
  }
  if (value === null) {
    text += "null";
    return;
  }
  if (text.length >= chunk) {
    const piece = text;
    text = "";
    sink(piece);
  }
  if (Array.isArray(value)) {
    text += "[";
    for (let i = 0; i < value.length; i++) {
      if (i > 0) text += ",";
      const v: unknown = value[i];
      if (typeof v === "number") text += numberText(v);
      else if (v === undefined) throw new TypeError(`undefined at index ${i} of an array in saved state`);
      else encodeValue(v);
    }
    text += "]";
    return;
  }
  // A plain object (the common case) is told by its prototype; Maps, Sets and the values that
  // cannot be saved (typed arrays, class instances) never have Object.prototype or null.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    encodeNonPlain(value);
    return;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  // An AppendBuf (exactly `slots` and `len`): the rows it owns.
  if (
    keys.length === 2 &&
    Array.isArray(obj.slots) &&
    typeof obj.len === "number" &&
    Number.isSafeInteger(obj.len)
  ) {
    const slots = obj.slots as unknown[];
    const len = obj.len;
    text += '{"$":"buf","rows":[';
    for (let i = 0; i < len; i++) {
      if (i > 0) text += ",";
      encodeValue(slots[i]);
    }
    text += "]}";
    return;
  }
  if (keys.length === 0) {
    text += "{}";
    return;
  }
  const shape = shapeOf(keys);
  const sorted = shape.sorted;
  const quoted = shape.quoted;
  let first = true;
  for (let i = 0; i < sorted.length; i++) {
    const v = obj[sorted[i] as string];
    if (v === undefined) continue;
    text += first ? "{" : ",";
    first = false;
    text += quoted[i] as string;
    if (typeof v === "number") text += numberText(v);
    else encodeValue(v);
  }
  text += first ? "{}" : "}";
}

/**
 * Writes `value` as canonical JSON to `emit` in pieces of about `chunkChars` code units, each
 * ending at a value boundary (see the file docs). The pieces joined are `canonicalString(value)`.
 */
export function canonicalEncodeChunked(value: unknown, emit: Sink, chunkChars: number): void {
  const saved = [text, sink, chunk] as const;
  text = "";
  sink = emit;
  chunk = chunkChars;
  try {
    encodeValue(value);
    if (text.length > 0) emit(text);
  } finally {
    [text, sink, chunk] = saved;
  }
}

/** Writes `value` as canonical JSON to `emit`, in pieces (see the file docs). */
export function canonicalEncode(value: unknown, emit: Sink): void {
  canonicalEncodeChunked(value, emit, OUT_CHUNK);
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
  for (const k of Object.keys(obj)) {
    if (k === "__proto__") throw new TypeError("saved state may not use the key `__proto__`");
    out[k] = canonicalRevive(obj[k]);
  }
  return out;
}
