// The canonical encoder as main had it before the speed-up (ts4 perf): one callback per token,
// keys sorted on every object, no shape cache. Kept here, unchanged, as the reference that
// test/results_pinned.test.ts holds src/canonical.ts to, byte for byte. Never "fix" it to match
// src: a difference is a change to every save and state hash.

type Sink = (piece: string) => void;

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
    referenceEncode(item, emit);
  }
  emit("]");
}

function referenceEncode(value: unknown, emit: Sink): void {
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
      referenceEncode(value[i], emit);
    }
    emit("]");
    return;
  }
  if (ArrayBuffer.isView(value)) {
    throw new TypeError("typed arrays are not allowed in saved state; use plain arrays");
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
      referenceEncode(value.slots[i], emit);
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
    referenceEncode(v, emit);
  }
  emit("}");
}

/** `value` as one canonical JSON string, the reference way. */
export function referenceCanonicalString(value: unknown): string {
  const parts: string[] = [];
  referenceEncode(value, (s) => parts.push(s));
  return parts.join("");
}
