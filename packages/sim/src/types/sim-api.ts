// The simulation's public API (build-plan 2.1). Ported from the `Sim` methods, `SimError` and
// the re-exports of crates/sim/src/lib.rs, plus `SaveError` (crates/sim/src/save.rs) and
// `StateHash` (crates/sim/src/hash.rs), which SimError and `state_hash` expose.
//
// The sim has no DOM: it runs the same in the game's Web Worker, in tests and in the headless
// runner, deterministic on one machine (build-plan 6, decision A). The UI reaches it only through
// this interface and reads only `views()` (spec 9).
//
// Construction (module port, not a method): Rust `Sim::new(data: WorldData, seed: u64) ->
// Result<Sim, LoadError>` builds the start state of spec 7, paused at 2020-01-01 00:00 (spec
// 7.3), via `start_world(data, draws)` (the load's draws in their frozen order, D163) and
// `scheduler()` (every module's jobs in their slots, spec 4).
//
// Not in SimApi:
// - `save(path)` / `load(path)`: file system; the runner uses saveBytes / loadBytes.
// - `data()`: the loaded WorldData (sim-data port), for a later NewGame.
// - `step_observed(observer)`: profiling (build-plan M10.6, D400); needs the scheduler's
//   TickObserver / TickPart, owned by the time/ port.
// - `set_trace(on)` / `last_trace()`: slot tracing (build-plan M1.3); needs the scheduler's Slot.
// - Feature-gated: `soak_stats()` and `soak_world()` (feature `soak-stats`, headless only, D427,
//   D900); `world()` and `register_test_job(slot, name, job)` (feature `test-hooks`, sim's own
//   tests only).

import type { DateTime } from "./calendar.ts";
import type { Control, Controls } from "./control.ts";
import type { CompanyId } from "./ids.ts";
import type { Notice } from "./notice.ts";
import type { ClockView, SimViews } from "./views/index.ts";
import type { LoadError, Result } from "./world.ts";

export type { Control, Controls } from "./control.ts";
export type { ClockView, SimViews } from "./views/index.ts";
// World is not re-exported: the public face never exposes raw tables (spec 9; src/index.ts).
export type { LoadError, Notice, Result } from "./world.ts";

/**
 * A 256-bit state hash of the world and RNG positions (build-plan M1.8, 4.3), as 64 lowercase hex
 * digits. Rust `StateHash([u8; 32])`; `short()` is the first 16 digits, for logs. In TS it is a
 * fast hash over the canonical state, for determinism tests only (ts-migration-plan Stack).
 */
export type StateHash = string;

/**
 * Why a save could not be written or read (save.rs). Rust messages: Io "save file: {message}";
 * BadMagic "not a TechnoCapital20FF save"; Version: a version-specific message (D826); Format
 * "save data: {message}".
 */
export type SaveError =
  | { kind: "Io"; message: string }
  | { kind: "BadMagic" }
  /** The save's version. Whole number (u32). */
  | { kind: "Version"; found: number }
  | { kind: "Format"; message: string };

/** A control that could not be applied. */
export type SimError =
  /** "speed {speed} is outside 0 to {MAX_SPEED}". Whole number (u8). */
  | { kind: "BadSpeed"; speed: number }
  /** "no company {company}". */
  | { kind: "UnknownCompany"; company: CompanyId }
  /** "Omniscient is only available in debug builds". */
  | { kind: "DebugOnly" }
  | { kind: "Load"; error: LoadError }
  | { kind: "Save"; error: SaveError };

/** The simulation: the world, its RNG streams, the scheduler that runs them and the controls. */
export interface SimApi {
  /**
   * Runs one tick (one hour, spec 4) and returns its notices in order; the last is always
   * TickDone. It runs whether or not the game is paused: the runner decides how many steps to run
   * from the controls' effective speed (spec 9.1). Pauses (SkipDone, then alert pauses) go in just
   * before the final TickDone; the views refresh after the tick (spec 9.4).
   */
  step(): Notice[];

  /** Applies a control at once (D5) and returns any notices it causes. */
  apply(control: Control): Result<Notice[], SimError>;

  /** The state as save bytes (spec 9.1 `Save`; build-plan M1.7): world, RNG and controls. */
  saveBytes(): Uint8Array;

  /**
   * Replaces the state with a save's (spec 9.1 `Load`). The game comes back paused with no skip
   * running (D13); the views are rebuilt (spec 9.4 "and on load"). The loaded data stays, for a
   * later NewGame.
   */
  loadBytes(bytes: Uint8Array): Result<Notice[], SimError>;

  /** The time of the last finished tick. */
  now(): DateTime;

  /** The hash of the world and RNG positions (build-plan M1.8, 4.3). */
  stateHash(): StateHash;

  /** The game seed. Whole number (u64; a safe integer here). */
  seed(): number;

  /** The read-only views the UI reads (spec 9.2, 9.4). */
  views(): SimViews;

  /** The clock (spec 9.1 `clock()`). */
  clock(): ClockView;

  /** Speed, pause, skip, alert levels, Omniscient and the watchlist. */
  controls(): Controls;
}
