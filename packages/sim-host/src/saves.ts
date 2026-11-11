// Saves in named slots and the baked starts (pivot 15.4, 3.5), as the host sees them: two small
// stores it is handed. The Node process gives it files on disk (node.ts); the browser worker gives
// it none, and answers the slot requests as unsupported; tests use the in-memory store here.

import type { BakedStart, DateTime, SaveInfo } from "@tc20ff/sim";
// The public face of the sim does not export SAVE_VERSION yet (it is a contract file, D1029), so
// this one import reaches past it. Replace it with the package import once index.ts exports it.
import { SAVE_VERSION } from "../../sim/src/save.ts";

export { SAVE_VERSION };

/** How many autosaves are kept: the oldest is overwritten (pivot 15.4). */
export const AUTOSAVE_SLOTS = 3;

/** An autosave's slot is this and a number from 1 to AUTOSAVE_SLOTS; a player's save cannot use it. */
export const AUTOSAVE_PREFIX = "autosave-";

/**
 * The least real time between two autosaves. A save of the 1995 world takes about a quarter of a
 * second and a game month at max speed about a tenth, so saving at every month start there would
 * spend most of the time saving. At speeds 1 to 4 a month is longer than this and every one is saved.
 */
export const AUTOSAVE_MIN_REAL_MS = 60_000;

/** The longest slot name. */
export const SLOT_NAME_MAX = 64;

/**
 * A slot is a file name without folder or extension (protocol.ts `SaveInfo.slot`): letters, digits,
 * spaces, `_` and `-`, starting with a letter or digit, so it can name no other folder.
 */
export function slotNameOk(slot: string): boolean {
  return slot.length <= SLOT_NAME_MAX && /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(slot) && !slot.endsWith(" ");
}

/** The slot of autosave `n` (1 to AUTOSAVE_SLOTS). */
export function autosaveSlot(n: number): string {
  return `${AUTOSAVE_PREFIX}${n}`;
}

export function isAutosaveSlot(slot: string): boolean {
  if (!slot.startsWith(AUTOSAVE_PREFIX)) return false;
  const n = slot.slice(AUTOSAVE_PREFIX.length);
  return /^[1-9]\d*$/.test(n) && Number(n) <= AUTOSAVE_SLOTS;
}

/** What a save says about itself, kept beside its bytes so a listing need not decode it. */
export interface SaveMeta {
  time: DateTime;
  seed: number;
  save_version: number;
}

/** Where slot saves live. Every method may throw on an I/O error; the host answers it Refused. */
export interface SaveStore {
  /** Writes the slot whole or not at all (a temp file, then a rename, on disk). */
  write(slot: string, bytes: Uint8Array, meta: SaveMeta): void;
  /** The slot's bytes, or null when there is no such save. */
  read(slot: string): Uint8Array | null;
  /** Every save, newest first. */
  list(): SaveInfo[];
  /** False when there was no such save. */
  delete(slot: string): boolean;
}

/** The baked starts this build ships (pivot 3.5; `assets/starts/`, written by headless `--bake`). */
export interface StartStore {
  /** Every start in the index, whatever its version. */
  list(): BakedStart[];
  /** A start's save bytes, or null when the index names a file that is not there. */
  read(id: string): Uint8Array | null;
}

/**
 * The slot the next autosave goes to: the first of the AUTOSAVE_SLOTS not yet written, else the
 * oldest. `saves` is a store's listing, newest first.
 */
export function nextAutosaveSlot(saves: readonly SaveInfo[]): string {
  const have = saves.filter((s) => s.autosave).map((s) => s.slot);
  for (let n = 1; n <= AUTOSAVE_SLOTS; n++) {
    if (!have.includes(autosaveSlot(n))) return autosaveSlot(n);
  }
  return have.at(-1) as string;
}

/** A store in memory, for tests: the newest save is the last written. */
export class MemorySaveStore implements SaveStore {
  private saves = new Map<string, { bytes: Uint8Array; meta: SaveMeta }>();

  write(slot: string, bytes: Uint8Array, meta: SaveMeta): void {
    this.saves.delete(slot);
    this.saves.set(slot, { bytes, meta });
  }

  read(slot: string): Uint8Array | null {
    return this.saves.get(slot)?.bytes ?? null;
  }

  list(): SaveInfo[] {
    return [...this.saves.entries()]
      .map(([slot, s]) => ({ slot, autosave: isAutosaveSlot(slot), ...s.meta, bytes: s.bytes.length }))
      .reverse();
  }

  delete(slot: string): boolean {
    return this.saves.delete(slot);
  }
}
