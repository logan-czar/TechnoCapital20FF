// How a page reads the sim's views (spec 9: pages read only the views). A page names the views
// it reads (its PageSpec `views`, Rust's ViewKey list); `usePageViews` hands it their data as one
// object and re-renders the page when one of them moves, at most every PAGE_REFRESH_MS, so a page
// that reads a daily view does not rebuild every frame at max speed (Rust's pacing, D773).
// Values that move every tick (a price) are `live` spans instead (doc.ts): they re-render alone.

import type { SimViews, ViewName } from "@tc20ff/sim";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { useSim } from "../sim/hooks.ts";

/** The data of the views a page reads; a view the store does not have yet is absent. */
export type ViewsData = { readonly [K in ViewName]?: SimViews[K]["data"] };

/** Most often a page rebuilds from its views, in ms (Rust LIVE_TEXT_SECS pacing). */
export const PAGE_REFRESH_MS = 200;
/** Most often a live span re-reads its view, in ms. */
export const LIVE_REFRESH_MS = 250;

/** Every view's data, from a SimViews (tests build docs from a sim's views this way). */
export function viewsData(v: SimViews): ViewsData {
  const out: Record<string, unknown> = {};
  for (const [k, view] of Object.entries(v)) {
    if (typeof view === "object" && view !== null && "data" in view) out[k] = view.data;
  }
  return out as ViewsData;
}

/** The row with id `id` of rows sorted by id (every view table is in id order); a binary search. */
export function byId<T extends { id: number }>(rows: readonly T[] | undefined, id: number): T | undefined {
  if (!rows) return undefined;
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const r = rows[mid] as T;
    if (r.id === id) return r;
    if (r.id < id) lo = mid + 1;
    else hi = mid;
  }
  return undefined;
}

/** The same lookup on another key (an exchange's `zone`). */
export function byKey<T>(rows: readonly T[] | undefined, key: (r: T) => number, id: number): T | undefined {
  if (!rows) return undefined;
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const k = key(rows[mid] as T);
    if (k === id) return rows[mid];
    if (k < id) lo = mid + 1;
    else hi = mid;
  }
  return undefined;
}

/**
 * The views `names` as one object, stable while none of them moves. Re-renders at most every
 * `ms` (the first read is immediate: a page opens with the views as they are).
 */
export function usePageViews(names: readonly ViewName[], ms = PAGE_REFRESH_MS): ViewsData {
  const { store } = useSim();
  const key = names.join(",");
  const cache = useRef<{ key: string; deps: unknown[]; value: ViewsData } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `names`
  const subscribe = useCallback(
    (cb: () => void) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const wake = () => {
        if (timer !== null) return;
        timer = setTimeout(() => {
          timer = null;
          cb();
        }, ms);
      };
      const offs = names.map((n) => store.subscribe(n, wake));
      return () => {
        for (const off of offs) off();
        if (timer !== null) clearTimeout(timer);
      };
    },
    [store, key, ms],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `names`
  const get = useCallback((): ViewsData => {
    const deps = names.map((n) => store.getView(n)?.data);
    const c = cache.current;
    if (c && c.key === key && c.deps.every((d, i) => d === deps[i])) return c.value;
    const value: Record<string, unknown> = {};
    names.forEach((n, i) => {
      if (deps[i] !== undefined) value[n] = deps[i];
    });
    cache.current = { key, deps, value: value as ViewsData };
    return value as ViewsData;
  }, [store, key]);
  return useSyncExternalStore(subscribe, get);
}
