// The browser's history (D1047): one page at a time with back and forward, as in the app's route
// (route.ts). Pure, so the rules are tested without a DOM. Routes are the window's route texts
// (null for home) in their canonical spelling.

import { canonicalRoute } from "./route.ts";

/** Most pages kept behind the current one. */
export const HISTORY_LIMIT = 100;

export interface History {
  /** Oldest first. Never empty. */
  stack: readonly (string | null)[];
  /** The current page's place in `stack`. */
  index: number;
}

export function historyNew(route: string | null): History {
  return { stack: [canonicalRoute(route)], index: 0 };
}

export const historyCurrent = (h: History): string | null => h.stack[h.index] ?? null;
export const canBack = (h: History): boolean => h.index > 0;
export const canForward = (h: History): boolean => h.index < h.stack.length - 1;

/** Goes to `route`, dropping the forward pages; the page already shown is not pushed again. */
export function historyPush(h: History, route: string | null): History {
  const next = canonicalRoute(route);
  if (next === historyCurrent(h)) return h;
  const kept = [...h.stack.slice(0, h.index + 1), next];
  const stack = kept.length > HISTORY_LIMIT + 1 ? kept.slice(kept.length - HISTORY_LIMIT - 1) : kept;
  return { stack, index: stack.length - 1 };
}

export function historyBack(h: History): History {
  return canBack(h) ? { stack: h.stack, index: h.index - 1 } : h;
}

export function historyForward(h: History): History {
  return canForward(h) ? { stack: h.stack, index: h.index + 1 } : h;
}
