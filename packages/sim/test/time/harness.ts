// A stand-in for `Sim` while lib.rs is not ported: the clock part of `Sim::step` (lib.rs
// `step_inner`) and the clock and alert controls of `Sim::apply`, on a world that holds only the
// clock. The scheduler and the calendar alerts read nothing else, and every other job is a
// notPorted placeholder. Delete it once `Sim` is ported.

import { scheduler } from "../../src/jobs.ts";
import { controlsDefault, skipTarget } from "../../src/time/control.ts";
import {
  type JobFn,
  type Scheduler,
  type Slot,
  schedulerRegister,
  schedulerRunTick,
} from "../../src/time/scheduler.ts";
import { DATETIME_START, type DateTime } from "../../src/types/calendar.ts";
import { type Control, type Controls, MAX_SPEED } from "../../src/types/control.ts";
import type { DrawSource } from "../../src/types/draws.ts";
import { ALERT_KIND_INDEX, type Notice, type PauseReason } from "../../src/types/notice.ts";
import type { World } from "../../src/types/world.ts";

function noDraw(): never {
  throw new Error("no draws expected");
}

/** A DrawSource for runs that must draw nothing. */
export const NO_DRAWS: DrawSource = {
  nextU32: noDraw,
  uniform: noDraw,
  normal: noDraw,
  poisson: noDraw,
  intInclusive: noDraw,
  chance: noDraw,
};

/**
 * A world that holds the clock at the game start and empty tables, so the ported modules' jobs run
 * as no-ops: no industries, units or companies, a cycle with far more quarters left than a test
 * runs (so it never draws), and the AI boom in Preboom with the boom in 2030 (Step 2).
 */
export function clockWorld(): World {
  return {
    clock: DATETIME_START,
    zones: [],
    countries: [],
    provinces: [],
    industries: [],
    companies: [],
    characters: [],
    units: [],
    base_rate: 0.03,
    neutral_rate: 0.03,
    cycle: { phase: "Expansion", quarters_left: 1_000_000, g_t: 0, g_history: [], z_avg: 1 },
    ai: {
      stage: "Preboom",
      boom_date: { year: 2030, month: 1, day: 1 },
      pop_date: { year: 2040, month: 1, day: 1 },
      ai_labs_lt: 0,
      schedule: { preboom_lt: 0, boom_lt: [], bust_lt: 0, postcrash_lt: 0 },
    },
  } as unknown as World;
}

export class ClockHarness {
  /** Only the clock: the scheduler and the calendar alerts read nothing else. */
  readonly world = clockWorld();
  readonly controls: Controls = controlsDefault();
  readonly scheduler: Scheduler = scheduler();
  private trace: Slot[] | null = null;

  now(): DateTime {
    return this.world.clock;
  }

  /** Rust `Sim::set_trace`. */
  setTrace(on: boolean): void {
    this.trace = on ? [] : null;
  }

  /** Rust `Sim::last_trace`: the slots the last tick visited, in order (empty unless tracing). */
  lastTrace(): readonly Slot[] {
    return this.trace ?? [];
  }

  /** Rust `Sim::register_test_job`: adds a job to a slot after the built-in ones. */
  registerTestJob(slot: Slot, name: string, job: JobFn): void {
    schedulerRegister(this.scheduler, slot, name, job);
  }

  /** Rust `Sim::step` without the view refresh. */
  step(): Notice[] {
    const notices: Notice[] = [];
    if (this.trace !== null) this.trace.length = 0;
    const alertPause = schedulerRunTick(
      this.scheduler,
      this.world,
      NO_DRAWS,
      notices,
      this.controls,
      this.trace,
    );
    // Pauses go in just before the final TickDone.
    const done = notices.pop();
    const skip = this.controls.skip;
    if (skip !== null && this.world.clock >= skip.target) {
      this.controls.skip = null;
      this.pause(notices, { kind: "SkipDone", skip: skip.kind });
    } else if (alertPause !== null) {
      this.pause(notices, alertPause);
    }
    if (done !== undefined) notices.push(done);
    return notices;
  }

  /**
   * Rust `Sim::apply` for the controls that need no world tables: speed, pause, resume, SkipTo,
   * alert levels and the watchlist (without WatchlistAdd's company check). Throws where Rust
   * returns an error.
   */
  apply(control: Control): Notice[] {
    const notices: Notice[] = [];
    const c = this.controls;
    switch (control.kind) {
      case "SetSpeed":
        if (control.speed === 0) {
          c.skip = null;
          this.pause(notices, { kind: "Player" });
        } else if (control.speed <= MAX_SPEED) {
          c.skip = null;
          c.speed = control.speed;
          c.paused = false;
        } else {
          throw new RangeError(`speed ${control.speed} is outside 0 to ${MAX_SPEED}`);
        }
        break;
      case "Pause":
        c.skip = null;
        this.pause(notices, { kind: "Player" });
        break;
      case "Resume":
        c.paused = false;
        break;
      case "SkipTo":
        c.skip = { kind: control.skip, target: skipTarget(this.world.clock, control.skip) };
        c.paused = false;
        break;
      case "SetAlert":
        c.alerts[ALERT_KIND_INDEX[control.alert_kind]] = control.level;
        break;
      case "WatchlistAdd":
        c.watchlist.add(control.company);
        break;
      case "WatchlistRemove":
        c.watchlist.delete(control.company);
        break;
      default:
        throw new Error(`ClockHarness does not apply ${control.kind}`);
    }
    return notices;
  }

  private pause(notices: Notice[], reason: PauseReason): void {
    if (!this.controls.paused) {
      this.controls.paused = true;
      notices.push({ kind: "Paused", reason });
    }
  }
}
