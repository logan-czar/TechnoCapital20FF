// A stand-in for `Sim` while lib.rs is not ported: the clock part of `Sim::step` (lib.rs
// `step_inner`) and the controls part of `Sim::apply` that touch the clock (pause, speed, SkipTo),
// on a world that holds only the clock. The scheduler and the calendar alerts read nothing else,
// and every other job is a notPorted placeholder. Delete it once `Sim` is ported.

import { scheduler } from "../../src/jobs.ts";
import { controlsDefault, skipTarget } from "../../src/time/control.ts";
import { type Scheduler, type Slot, schedulerRunTick } from "../../src/time/scheduler.ts";
import { DATETIME_START, type DateTime } from "../../src/types/calendar.ts";
import type { Controls } from "../../src/types/control.ts";
import type { DrawSource } from "../../src/types/draws.ts";
import type { Notice, PauseReason, SkipKind } from "../../src/types/notice.ts";
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

export class ClockHarness {
  /** Only the clock: the scheduler and the calendar alerts read nothing else. */
  readonly world = { clock: DATETIME_START } as World;
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

  /** Rust `Sim::apply(Control::SetSpeed(n))` for n in 1 to 5: set the speed and resume. */
  resume(speed = 1): void {
    this.controls.skip = null;
    this.controls.speed = speed;
    this.controls.paused = false;
  }

  /** Rust `Sim::apply(Control::SkipTo(kind))`. */
  skipTo(kind: SkipKind): void {
    this.controls.skip = { kind, target: skipTarget(this.world.clock, kind) };
    this.controls.paused = false;
  }

  private pause(notices: Notice[], reason: PauseReason): void {
    if (!this.controls.paused) {
      this.controls.paused = true;
      notices.push({ kind: "Paused", reason });
    }
  }
}
