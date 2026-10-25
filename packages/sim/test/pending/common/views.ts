// Helpers for the view tests (pending/views/*, m10_*): the Rust view accessors (`Figure::exact`,
// `View::get`, `CapTableView::get(id)` and the like) as plain functions over the view data, which
// is plain data in TS (types/views/). They are written here, against the contract types, so the
// tests need only the logic functions the view builders own (listed in each test's Expects).
//
// Expects: nothing from src beyond the types.
import type { Band, Figure } from "../../../src/types/views/estimate.ts";
import type { View } from "../../../src/types/views/index.ts";

/** Figure::exact. */
export function figExact(f: Figure): number | null {
  return f.kind === "Exact" ? f.value : null;
}

/** Figure::band. */
export function figBand(f: Figure): Band | null {
  return f.kind === "Band" ? f.band : null;
}

/** Figure::is_band. */
export function figIsBand(f: Figure): boolean {
  return f.kind === "Band";
}

/** Figure::shown: the exact value, or the band's estimate. */
export function figShown(f: Figure): number {
  return f.kind === "Exact" ? f.value : f.band.estimate;
}

/** Figure::exact().unwrap(). */
export function figExactOrThrow(f: Figure): number {
  if (f.kind !== "Exact") throw new Error("a banded figure where an exact one was expected");
  return f.value;
}

/** View::get (the data), View::version, View::is_dirty as one-liners. */
export const viewData = <T>(v: View<T>): T => v.data;
export const viewVersion = <T>(v: View<T>): number => v.version;
export const viewDirty = <T>(v: View<T>): boolean => v.dirty;

/** A row by its `id` field (the Rust views' `get(id)` lookups over a Vec sorted by id). */
export function byId<Id extends number, R extends { id: Id }>(rows: readonly R[], id: Id): R | undefined {
  return rows.find((r) => r.id === id);
}

/** A row by a named id field (`company`, `zone`, ...). */
export function byField<R, K extends keyof R>(rows: readonly R[], field: K, id: R[K]): R | undefined {
  return rows.find((r) => r[field] === id);
}

/** The largest of the values (Rust `fold(init, f64::max)`). */
export function maxOf(values: Iterable<number>, init = Number.NEGATIVE_INFINITY): number {
  let m = init;
  for (const v of values) if (v > m) m = v;
  return m;
}

/** Rust `{x:?}` for an f64: whole numbers print with ".0"; used to scan view dumps for truths. */
export function debugF64(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}
