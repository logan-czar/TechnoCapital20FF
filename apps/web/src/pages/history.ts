// One pane's history (crates/game/src/workspace/model.rs `History`, D450): the page shown, the pages
// behind it and ahead of it, as in a browser. Plain data (page keys) so a pane's dockview params
// hold it and the saved layout restores it. Pure functions: each returns a new history, or the same
// one when nothing changed.

import { type PageRef, pageEq, pageFromKey, pageKey } from "./ref.ts";

/** Pages kept in each of a pane's back and forward lists. */
export const HISTORY_CAP = 64;

export interface History {
  /** The pages behind the current one, oldest first. */
  back: PageRef[];
  current: PageRef;
  /** The pages ahead, the next one last. */
  forward: PageRef[];
}

export function historyNew(page: PageRef): History {
  return { back: [], current: page, forward: [] };
}

/**
 * Opens `page`: the current one goes on the back list and the forward list clears. Opening the
 * page already shown does nothing.
 */
export function historyOpen(h: History, page: PageRef): History {
  if (pageEq(page, h.current)) return h;
  return { back: [...h.back, h.current].slice(-HISTORY_CAP), current: page, forward: [] };
}

export function historyBack(h: History): History {
  const prev = h.back.at(-1);
  if (!prev) return h;
  return { back: h.back.slice(0, -1), current: prev, forward: [...h.forward, h.current].slice(-HISTORY_CAP) };
}

export function historyForward(h: History): History {
  const next = h.forward.at(-1);
  if (!next) return h;
  return { back: [...h.back, h.current], current: next, forward: h.forward.slice(0, -1) };
}

/**
 * Goes back to `back[i]` (a breadcrumb click): the pages after it move to the forward list, so
 * Forward retraces them.
 */
export function historyBackTo(h: History, i: number): History {
  if (i < 0 || i >= h.back.length) return h;
  let out = h;
  while (out.back.length > i) out = historyBack(out);
  return out;
}

/** The serialized form a pane's params hold. */
export interface SavedHistory {
  back: string[];
  current: string;
  forward: string[];
}

export function historyToSaved(h: History): SavedHistory {
  return { back: h.back.map(pageKey), current: pageKey(h.current), forward: h.forward.map(pageKey) };
}

/**
 * A saved history back: keys that no longer name a page are dropped, and an unknown current page
 * opens the World page (D452: an unknown key costs only its pane's page).
 */
export function historyFromSaved(x: unknown): History | null {
  if (typeof x !== "object" || x === null) return null;
  const s = x as Partial<SavedHistory>;
  if (typeof s.current !== "string") return null;
  const pages = (a: unknown): PageRef[] =>
    Array.isArray(a)
      ? a.flatMap((k) => {
          const p = typeof k === "string" ? pageFromKey(k) : null;
          return p ? [p] : [];
        })
      : [];
  return {
    back: pages(s.back).slice(-HISTORY_CAP),
    current: pageFromKey(s.current) ?? { kind: "world" },
    forward: pages(s.forward).slice(-HISTORY_CAP),
  };
}
