// Which articles this viewer has opened: a per-viewer convenience kept in localStorage, never part
// of the game (a save does not hold it). Every storage access is wrapped: a browser with storage
// blocked, full or cleared just shows everything as unread.

import { useSyncExternalStore } from "react";

/** The storage key. */
export const READ_KEY = "tc20ff.news.read.v1";
/** The most article ids kept; older ones drop out first. */
export const READ_LIMIT = 5000;

let read: Set<number> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function load(): Set<number> {
  if (read !== null) return read;
  read = new Set();
  try {
    const raw = globalThis.localStorage?.getItem(READ_KEY);
    if (raw) {
      const ids: unknown = JSON.parse(raw);
      if (Array.isArray(ids)) for (const id of ids) if (typeof id === "number") read.add(id);
    }
  } catch {
    // Unreadable or blocked: start empty.
  }
  return read;
}

function save(set: Set<number>): void {
  try {
    globalThis.localStorage?.setItem(READ_KEY, JSON.stringify([...set]));
  } catch {
    // Blocked or full: the marks last for this session only.
  }
}

/** True when the article has been opened. */
export function isRead(id: number): boolean {
  return load().has(id);
}

/** Marks articles opened; a no-op for ones already marked. */
export function markRead(...ids: number[]): void {
  const set = load();
  let changed = false;
  for (const id of ids) {
    if (!set.has(id)) {
      set.add(id);
      changed = true;
    }
  }
  if (!changed) return;
  while (set.size > READ_LIMIT) {
    const oldest = set.values().next().value;
    if (oldest === undefined) break;
    set.delete(oldest);
  }
  version++;
  save(set);
  for (const l of listeners) l();
}

/** Forgets every mark (tests, and "mark all unread"). */
export function resetRead(): void {
  read = new Set();
  version++;
  try {
    globalThis.localStorage?.removeItem(READ_KEY);
  } catch {
    // Nothing to clear.
  }
  for (const l of listeners) l();
}

/** Drops the in-memory copy so the next read goes to storage again (tests). */
export function reloadRead(): void {
  read = null;
  version++;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The read test as a hook: the component redraws when a mark changes. */
export function useIsRead(): (id: number) => boolean {
  useSyncExternalStore(subscribe, () => version);
  return isRead;
}
