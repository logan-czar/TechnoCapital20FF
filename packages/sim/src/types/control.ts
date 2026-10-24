// Controls and quarter phases. Ported from crates/sim/src/time/control.rs (spec 9.1, 8 time
// controls row; build-plan M1.5), crates/sim/src/time/alerts.rs and crates/sim/src/time/quarter.rs
// (spec 4.4, 21.1).
//
// Controls change only how the runner runs the sim (speed, pause, skip, alerts) and what the
// player watches, never the economy, so `Sim::apply` applies them at once (D5) and they are saved
// but not part of the state hash (D13).
//
// alerts.rs has no types: its job (the calendar alerts of 4.1 step 4: Quarter start on the
// quarter's first tick, D800; Earnings day on the release tick; Plan lock on the lock tick;
// Quarterly recap at the start of the pre-quarter-end week) goes to the time/ module port. The
// alert types live in world/notice.rs and are re-exported here.
//
// Left to the time/ module port: Controls::{default, effective_speed, seconds_per_tick},
// skip_target, release_tick, price_move_tick, lock_tick, recap_tick, is_recap_day,
// phase_starts, phase_at, next_phase_start, PhaseInfo::days_to_next_phase.
//
// Field renames (the union tag is `kind`): Control::SetAlert's `kind` is `alert_kind`; tuple
// variants get named fields.

import type { DateTime, SimDate } from "./calendar.ts";
import type { BTreeSet } from "./collections.ts";
import type { CompanyId } from "./ids.ts";
import type { AlertKind, AlertLevel, AlertLevels, SkipKind } from "./notice.ts";

export type { AlertKind, AlertLevel, AlertLevels, AlertPayload, SkipKind } from "./notice.ts";

// ---------------------------------------------------------------- control.rs

/** Fastest speed; 0 is paused (spec 3.1 `speed`, 9.1). */
export const MAX_SPEED = 5;
/** The speed a new game is set to; it starts paused (spec 7.3; D8). */
export const START_SPEED = 1;
/**
 * Real seconds per game hour at speeds 1 to 5 (index speed - 1); speed 5 runs as fast as it can
 * (null) (spec 8, 9.1). Length MAX_SPEED.
 */
export const SECONDS_PER_HOUR: readonly (number | null)[] = [2.0, 1.0, 0.5, 0.2, null];

/** A control event from the UI (spec 9.1, plus design fix 8). */
export type Control =
  /** A new game from the same data (spec 7). `seed` is a whole number (u64; a safe integer here). */
  | { kind: "NewGame"; seed: number }
  /** 0 pauses; 1 to 5 set the speed and resume (D8). Whole number (u8). */
  | { kind: "SetSpeed"; speed: number }
  | { kind: "Pause" }
  | { kind: "Resume" }
  /** Run at max speed until that tick, then pause (spec 9.1). */
  | { kind: "SkipTo"; skip: SkipKind }
  /** Rust `Save(PathBuf)`: write a save file. In the browser the runner saves via `saveBytes`. */
  | { kind: "Save"; path: string }
  /** Rust `Load(PathBuf)`: read a save file. In the browser the runner loads via `loadBytes`. */
  | { kind: "Load"; path: string }
  /** Set one alert's level (spec 8; design fix 8). Rust field `kind` is `alert_kind` here. */
  | { kind: "SetAlert"; alert_kind: AlertKind; level: AlertLevel }
  /** Show every true value (spec 1, Information). Debug builds only (design fix 8). */
  | { kind: "SetOmniscient"; on: boolean }
  /** Watchlist (spec 8 outliner; design fix 8). */
  | { kind: "WatchlistAdd"; company: CompanyId }
  | { kind: "WatchlistRemove"; company: CompanyId };

/** A SkipTo in progress. */
export interface Skip {
  kind: SkipKind;
  /** The tick it stops after. */
  target: DateTime;
}

/**
 * The runner-facing settings (not part of the state hash, D13). A new game (Rust
 * `Controls::default`): paused at speed START_SPEED, no skip, the default alert levels, not
 * omniscient, an empty watchlist (spec 7.3, 8).
 */
export interface Controls {
  /** 1 to 5, kept while paused. Whole number (u8). */
  speed: number;
  paused: boolean;
  skip: Skip | null;
  alerts: AlertLevels;
  omniscient: boolean;
  watchlist: BTreeSet<CompanyId>;
}

// ---------------------------------------------------------------- quarter.rs

/** Release day of the month: statements published at 00:00 (spec 4.4 row 1). */
export const RELEASE_DAY = 2;
/** Hour of the release-day price move and earnings jump (spec 4.1 step 3, 4.4 "Price move"). */
export const PRICE_MOVE_HOUR = 1;
/** Plan lock day of the month, at 00:00 (spec 4.4 row 3). */
export const PLAN_LOCK_DAY = 9;
/**
 * The pre-quarter-end week starts this many days before the next release: 26 March, 25 June,
 * 25 September and 26 December (spec 4.4).
 */
export const RECAP_DAYS_BEFORE_RELEASE = 7;
/** First and last day of the daily reaction-week reversion, in a release month (spec 4.2 step 3). */
export const REACTION_FIRST_DAY = 3;
export const REACTION_LAST_DAY = 8;

/**
 * The quarter phases (spec 3.1 `quarter_phase`, 4.4, 21.1). The quarter starts at each release
 * and ends at the next.
 * - Release: the release tick only: 00:00 on the 2nd (spec 4.4 row 1).
 * - Reaction: 01:00 on the 2nd to the plan lock (spec 4.4 row 2).
 * - Locked: the plan lock to the pre-quarter-end week (spec 4.4 rows 3 and 4).
 * - PreQuarterEnd: the 7 days before the next release (spec 4.4 row 5).
 */
export type QuarterPhase = "Release" | "Reaction" | "Locked" | "PreQuarterEnd";

/** QuarterPhase in declaration (time and Ord) order. */
export const QUARTER_PHASE_VALUES = ["Release", "Reaction", "Locked", "PreQuarterEnd"] as const;

/** Rust `QuarterPhase::name`: the label the UI shows. */
export const QUARTER_PHASE_NAME: Readonly<Record<QuarterPhase, string>> = {
  Release: "Release",
  Reaction: "Reaction week",
  Locked: "Locked quarter",
  PreQuarterEnd: "Pre-quarter-end week",
};

/**
 * When a phase starts: a date and an hour (0 to 23). Kept as (date, hour) rather than DateTime
 * so the Q4 2019 pre-quarter-end week, which starts before the clock does, can be named. Ordered
 * by date, then hour.
 */
export type PhaseStart = [date: SimDate, hour: number];

/** The phase at a time, when it started and what comes next. */
export interface PhaseInfo {
  phase: QuarterPhase;
  started: PhaseStart;
  next_phase: QuarterPhase;
  next_start: PhaseStart;
}
