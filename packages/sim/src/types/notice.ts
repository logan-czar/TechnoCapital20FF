// Notices from the sim to the UI (spec 9.3) and the alert kinds and levels they carry (spec 8
// time controls row). Ported from crates/sim/src/world/notice.rs. Shared by every module.
//
// Field renames: Rust's `Notice::Alert { kind, .. }` and `PauseReason`'s tuple fields would clash
// with the union tag `kind`, so the alert kind is `alert_kind` and tuple fields get names below.

import type { DateTime, Month, Quarter, SimDate } from "./calendar.ts";
import type { CompanyId, StartupEventId } from "./ids.ts";

/**
 * One thing that happened in a tick, in the order it happened (spec 9.3). `Sim::step` returns
 * them as a list; the UI bridge turns each into an event (build-plan M7.2).
 */
export type Notice =
  /** The tick at this time finished; always the last notice of a step. */
  | { kind: "TickDone"; time: DateTime }
  /** The daily jobs closed this day (the day just ended; decision D10). */
  | { kind: "DayDone"; date: SimDate }
  /** The monthly jobs closed this month (the month just ended; D10). */
  | { kind: "MonthDone"; month: Month }
  /**
   * This quarter's statements were published (the quarter just ended: the 2 Jan 2020 release is
   * Q4 2019; D10).
   */
  | { kind: "EarningsReleased"; quarter: Quarter }
  /** Plans were locked for this quarter (the calendar quarter the lock falls in; D10). */
  | { kind: "PlanLocked"; quarter: Quarter }
  | { kind: "StartupEvent"; event: StartupEventId }
  | { kind: "CompanyBorn"; company: CompanyId }
  | { kind: "IpoVote"; company: CompanyId; passed: boolean }
  | { kind: "CompanyListed"; company: CompanyId }
  /**
   * An alert fired at a level other than Off. The level is carried so the UI knows whether to
   * show a toast or only log it (D6). Rust field `kind` is `alert_kind` here.
   */
  | { kind: "Alert"; alert_kind: AlertKind; level: AlertLevel; payload: AlertPayload }
  | { kind: "Paused"; reason: PauseReason };

/**
 * The alerts the player can set (spec 8 time controls row; 5.1.1 for the world event).
 * - EarningsDay: the release tick (spec 4.4 row 1).
 * - QuarterlyRecap: the start of the pre-quarter-end week (spec 4.4 row 5).
 * - PlanLock: the plan lock tick (spec 4.4 row 3).
 * - BankruptcyInWatchlist: a watchlist company went bankrupt (spec 8, 5.12).
 * - WorldEvent: a scripted world event: the AI boom and the pop (spec 5.1.1).
 * - QuarterStart: the quarter's first tick, 00:00 on the 1st (spec 4.4): the month's and the
 *   quarter's close, the costliest tick (D800). Last, so the other kinds keep their saved order.
 */
export type AlertKind =
  | "EarningsDay"
  | "QuarterlyRecap"
  | "PlanLock"
  | "BankruptcyInWatchlist"
  | "WorldEvent"
  | "QuarterStart";

/** Rust `AlertKind::ALL`, in declaration order (the saved order; `AlertLevels` is indexed by it). */
export const ALERT_KIND_VALUES = [
  "EarningsDay",
  "QuarterlyRecap",
  "PlanLock",
  "BankruptcyInWatchlist",
  "WorldEvent",
  "QuarterStart",
] as const;

/** Rust `AlertKind::index` (`self as usize`): the slot in `AlertLevels`. */
export const ALERT_KIND_INDEX: Readonly<Record<AlertKind, number>> = {
  EarningsDay: 0,
  QuarterlyRecap: 1,
  PlanLock: 2,
  BankruptcyInWatchlist: 3,
  WorldEvent: 4,
  QuarterStart: 5,
};

/**
 * What an alert does when it fires (spec 8), in declaration (Ord) order.
 * - Pause: notify and pause the game after this tick.
 * - Notify: show it.
 * - Log: only write it to the log.
 * - Off: nothing.
 */
export type AlertLevel = "Pause" | "Notify" | "Log" | "Off";

/** AlertLevel in declaration order (Rust derives `Ord`). */
export const ALERT_LEVEL_VALUES = ["Pause", "Notify", "Log", "Off"] as const;

/**
 * Rust `AlertKind::default_level` (spec 8: Earnings day Pause, Quarterly recap Pause, Bankruptcy
 * in watchlist Notify; spec 5.1.1: World event Pause). Plan lock (spec 8: Log) and Quarter start
 * are Pause, so the game stops on the quarter's heavy ticks (D800, Logan 2026-10-23; design fix
 * 800).
 */
export const ALERT_KIND_DEFAULT_LEVEL: Readonly<Record<AlertKind, AlertLevel>> = {
  EarningsDay: "Pause",
  QuarterlyRecap: "Pause",
  PlanLock: "Pause",
  BankruptcyInWatchlist: "Notify",
  WorldEvent: "Pause",
  QuarterStart: "Pause",
};

/**
 * The level set for each alert kind (spec 8; changed by `Control::SetAlert`). Rust newtype
 * `AlertLevels([AlertLevel; 6])`: length ALERT_KIND_VALUES.length (6), indexed by
 * `ALERT_KIND_INDEX`. Default: `ALERT_KIND_VALUES.map(k => ALERT_KIND_DEFAULT_LEVEL[k])`; every
 * Off (`AlertLevels::all_off`) for runs whose alerts nobody sees, such as projections (spec 5.16).
 */
export type AlertLevels = AlertLevel[];

/** What an alert is about. */
export type AlertPayload =
  | { kind: "None" }
  | { kind: "Quarter"; quarter: Quarter }
  | { kind: "Company"; company: CompanyId };

/**
 * The SkipTo targets (spec 9.1, 8 Skip menu), in declaration (Ord) order.
 * - NextRelease: the next release tick (spec 4.4 row 1).
 * - NextLock: the next plan lock tick (spec 4.4 row 3).
 * - NextRecap: the next start of the pre-quarter-end week, when the recap opens (spec 4.4 row 5).
 * - MonthEnd: the next monthly close: 00:00 on the 1st (spec 4.3).
 */
export type SkipKind = "NextRelease" | "NextLock" | "NextRecap" | "MonthEnd";

/** SkipKind in declaration order (Rust derives `Ord`). */
export const SKIP_KIND_VALUES = ["NextRelease", "NextLock", "NextRecap", "MonthEnd"] as const;

/** Why the game paused. */
export type PauseReason =
  /** A `Pause` or `SetSpeed(0)` control. */
  | { kind: "Player" }
  /** An alert set to Pause fired. */
  | { kind: "Alert"; alert_kind: AlertKind }
  /** A SkipTo reached its tick. */
  | { kind: "SkipDone"; skip: SkipKind }
  /** A save was loaded (D13). */
  | { kind: "Loaded" };
