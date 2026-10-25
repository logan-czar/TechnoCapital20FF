// The real sim worker's brain, free of Worker globals so tests can drive it in-process: it answers
// ToSim requests and paces the clock, returning the FromSim messages to post, in order (the same
// shape as the mock's SimHost). It follows the protocol's rules (types/protocol.ts): after each
// request a Frame with the views it changed FIRST, then the Reply; while running, at most one
// Frame per FRAME_MS carrying every notice since the last frame (D950, D962).

import {
  controlsSecondsPerTick,
  type FromSim,
  type Notice,
  type PostedViews,
  postedViewsNone,
  postedViewsResetNews,
  type Reply,
  type Sim,
  simNew,
  type ToSim,
  viewsPatchSince,
} from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";

/** The most real time one frame spends running ticks at max speed. */
export const MAX_SPEED_BUDGET_MS = 12;

/**
 * Ticks one `tick` call may run at speeds 1 to 4, so a stalled tab or a long frame does not
 * spiral on resume (the real time owed beyond this is dropped, not queued).
 */
export const CATCH_UP_TICKS = 8;

/** Most ticks a max-speed frame runs even if the budget clock stalls (a runaway guard). */
const MAX_TICKS_PER_FRAME = 100_000;

export interface RealHostOptions {
  /** A monotonic clock in ms for the max-speed budget; `performance.now` in the worker. */
  now?: () => number;
  /** The max-speed budget per frame in ms. */
  budgetMs?: number;
}

export class RealHost {
  sim: Sim | null = null;
  private posted: PostedViews = postedViewsNone();
  /** Real milliseconds owed to the clock at speeds 1 to 4. */
  private owedMs = 0;
  private readonly now: () => number;
  private readonly budgetMs: number;

  constructor(
    private readonly data: WorldData,
    opts: RealHostOptions = {},
  ) {
    this.now = opts.now ?? (() => performance.now());
    this.budgetMs = opts.budgetMs ?? MAX_SPEED_BUDGET_MS;
  }

  /** Handles one request: [Frame, Reply], or just a Reply when the sim did not change. */
  handle(msg: ToSim): FromSim[] {
    switch (msg.kind) {
      case "NewGame": {
        const made = simNew(this.data, msg.seed, { debug: false });
        if (!made.ok) {
          return [this.reply(msg.id, { kind: "SimError", error: { kind: "Load", error: made.error } })];
        }
        this.install(made.value);
        return [this.frame([]), this.reply(msg.id, { kind: "Ok", notices: [] })];
      }
      case "Load": {
        // A load before any game builds the sim from the data first (the loaded data stays, D13).
        let target = this.sim;
        if (target === null) {
          const made = simNew(this.data, 0, { debug: false });
          if (!made.ok) {
            return [this.reply(msg.id, { kind: "SimError", error: { kind: "Load", error: made.error } })];
          }
          target = made.value;
        }
        const loaded = target.loadBytes(msg.bytes);
        if (!loaded.ok) return [this.reply(msg.id, { kind: "SimError", error: loaded.error })];
        this.install(target);
        return [this.frame(loaded.value), this.reply(msg.id, { kind: "Ok", notices: loaded.value })];
      }
      case "Save": {
        if (this.sim === null) return [this.refuse(msg.id)];
        return [this.reply(msg.id, { kind: "Saved", bytes: this.sim.saveBytes() })];
      }
      case "Control": {
        if (this.sim === null) return [this.refuse(msg.id)];
        const kind: string = msg.control.kind;
        if (kind === "NewGame" || kind === "Save" || kind === "Load") {
          return [this.reply(msg.id, { kind: "Refused", message: `${kind} is a request, not a control` })];
        }
        const result = this.sim.apply(msg.control);
        if (!result.ok) {
          return [this.reply(msg.id, { kind: "SimError", error: result.error })];
        }
        // Pacing starts fresh after a control (a new speed, a resume): no debt carries over.
        this.owedMs = 0;
        return [this.frame(result.value), this.reply(msg.id, { kind: "Ok", notices: result.value })];
      }
    }
  }

  /**
   * Advances the clock by `dtMs` of real time (called once per FRAME_MS): runs the ticks the speed
   * owes, and returns one Frame with all their notices, or nothing when no tick ran. Paused runs
   * nothing; speeds 1 to 4 run one game hour per SECONDS_PER_HOUR[speed] (D8); max runs as many
   * ticks as fit in the frame budget.
   */
  tick(dtMs: number): FromSim[] {
    const sim = this.sim;
    if (sim === null) return [];
    const notices: Notice[] = [];
    const first = controlsSecondsPerTick(sim.controls());
    if (sim.controls().paused) {
      this.owedMs = 0;
      return [];
    }
    if (first === null) {
      // Max speed (also a SkipTo): as many ticks as fit in the budget, stopping when it pauses.
      this.owedMs = 0;
      const start = this.now();
      for (let n = 0; n < MAX_TICKS_PER_FRAME; n++) {
        notices.push(...sim.step());
        if (sim.controls().paused) break;
        if (this.now() - start >= this.budgetMs) break;
      }
    } else {
      this.owedMs += dtMs;
      let ran = 0;
      for (;;) {
        const spt = controlsSecondsPerTick(sim.controls());
        if (spt === null) break; // paused by an alert, or sped up to max: the next frame decides
        const stepMs = spt * 1000;
        if (this.owedMs < stepMs) break;
        if (ran >= CATCH_UP_TICKS) {
          this.owedMs = 0;
          break;
        }
        this.owedMs -= stepMs;
        notices.push(...sim.step());
        ran++;
      }
    }
    if (notices.length === 0) return [];
    return [this.frame(notices)];
  }

  private install(sim: Sim): void {
    this.sim = sim;
    this.posted = postedViewsNone();
    postedViewsResetNews(this.posted);
    this.owedMs = 0;
  }

  private frame(notices: Notice[]): FromSim {
    const sim = this.sim as Sim;
    return { kind: "Frame", notices, clock: sim.clock(), views: viewsPatchSince(sim.views(), this.posted) };
  }

  private reply(id: number, result: Reply): FromSim {
    return { kind: "Reply", id, result };
  }

  private refuse(id: number): FromSim {
    return this.reply(id, { kind: "Refused", message: "no game yet: send NewGame or Load first" });
  }
}
