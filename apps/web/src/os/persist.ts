// The desktop as the viewer left it: which windows are open and where, and whether the phone is
// raised. A per-viewer convenience kept in localStorage beside the UI settings, in the pattern of
// config/settings.ts: read once, sanitized, written a moment after it changes, and never throwing
// (blocked or full storage leaves the desktop working from memory). It is no game state: a save
// file does not hold it.

import type { SettingsStorage } from "../config/settings.ts";
import { type Size, type WmState, wmFromSaved, wmInit, wmToSaved } from "./wm.ts";

/** The document's format version. */
export const DESKTOP_VERSION = 1;
/** The localStorage key. */
export const DESKTOP_KEY = "tc20ff.os.v1";
/** Milliseconds a change waits before it is written, so a drag writes once. */
export const DESKTOP_WRITE_DELAY_MS = 400;

export interface SavedDesktop {
  wm: WmState;
  phoneOpen: boolean;
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** The browser's localStorage, or null where there is none or it is blocked. */
export function safeLocalStorage(): SettingsStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The saved desktop, or an empty one: nothing saved, no storage, or a document that does not read. */
export function loadDesktop(
  storage: SettingsStorage | null,
  bounds: Size,
  known: (app: string) => boolean,
): SavedDesktop {
  const empty: SavedDesktop = { wm: wmInit(bounds), phoneOpen: false };
  if (!storage) return empty;
  try {
    const text = storage.getItem(DESKTOP_KEY);
    if (text === null) return empty;
    const doc: unknown = JSON.parse(text);
    if (!isRecord(doc) || doc.version !== DESKTOP_VERSION) return empty;
    return { wm: wmFromSaved(doc.wm, bounds, known), phoneOpen: doc.phone_open === true };
  } catch {
    return empty;
  }
}

/** The document's text. */
export function desktopText(d: SavedDesktop): string {
  return JSON.stringify({ version: DESKTOP_VERSION, wm: wmToSaved(d.wm), phone_open: d.phoneOpen });
}

/** Writes the desktop; false when it could not (the desktop carries on in memory). */
export function saveDesktop(storage: SettingsStorage | null, d: SavedDesktop): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DESKTOP_KEY, desktopText(d));
    return true;
  } catch {
    return false;
  }
}
