// Notices from the sim to the UI (spec 9.3) and the alert kinds and levels they carry (spec 8
// time controls row). Ported from crates/sim/src/world/notice.rs; the types and the constant
// tables (ALERT_KIND_VALUES, ALERT_KIND_INDEX, ALERT_KIND_DEFAULT_LEVEL, ALERT_LEVEL_VALUES,
// SKIP_KIND_VALUES) are in types/notice.ts. What is left here is the functions.

import {
  ALERT_KIND_DEFAULT_LEVEL,
  ALERT_KIND_INDEX,
  ALERT_KIND_VALUES,
  type AlertKind,
  type AlertLevel,
  type AlertLevels,
} from "../types/notice.ts";

export {
  ALERT_KIND_DEFAULT_LEVEL,
  ALERT_KIND_INDEX,
  ALERT_KIND_VALUES,
  ALERT_LEVEL_VALUES,
  SKIP_KIND_VALUES,
} from "../types/notice.ts";

/** Rust `AlertKind::index` (`self as usize`): the slot in `AlertLevels`. */
export function alertKindIndex(kind: AlertKind): number {
  return ALERT_KIND_INDEX[kind];
}

/**
 * The default level (spec 8: Earnings day Pause, Quarterly recap Pause, Bankruptcy in watchlist
 * Notify; spec 5.1.1: World event Pause). Plan lock (spec 8: Log) and Quarter start are Pause, so
 * the game stops on the quarter's heavy ticks (D800, Logan 2026-10-23; design fix 800).
 */
export function alertKindDefaultLevel(kind: AlertKind): AlertLevel {
  return ALERT_KIND_DEFAULT_LEVEL[kind];
}

/** The spec 8 defaults (Rust `AlertLevels::default`). */
export function alertLevelsDefault(): AlertLevels {
  return ALERT_KIND_VALUES.map(alertKindDefaultLevel);
}

/** Every alert Off: for runs whose alerts nobody sees, such as projections (spec 5.16). */
export function alertLevelsAllOff(): AlertLevels {
  return ALERT_KIND_VALUES.map(() => "Off" as const);
}

/** Rust `AlertLevels::get`. */
export function alertLevelsGet(levels: AlertLevels, kind: AlertKind): AlertLevel {
  const level = levels[ALERT_KIND_INDEX[kind]];
  if (level === undefined) throw new RangeError(`no alert level for ${kind}`);
  return level;
}

/** Rust `AlertLevels::set`. */
export function alertLevelsSet(levels: AlertLevels, kind: AlertKind, level: AlertLevel): void {
  levels[ALERT_KIND_INDEX[kind]] = level;
}
