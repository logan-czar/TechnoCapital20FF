// The real sim worker's brain, free of Worker globals so tests can drive it in-process: it answers
// ToSim requests and paces the clock, returning the FromSim messages to post, in order (the same
// shape as the mock's SimHost). It follows the protocol's rules (types/protocol.ts): after each
// request a Frame with the views it changed FIRST, then the Reply; while running, at most one
// Frame per FRAME_MS carrying every notice since the last frame (D950, D962).

import {
  controlsSecondsPerTick,
  type FromSim,
  type NewGameChoices,
  type Notice,
  newGameChoices,
  type PostedBars,
  type PostedViews,
  postedBarsNone,
  postedViewsNone,
  postedViewsResetNews,
  priceBarsCompact,
  type Reply,
  type Sim,
  simNew,
  type ToSim,
  type ViewsPatch,
  type ViewWant,
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
  /** Hold the next running frame until the UI answers `FrameDone` (D1004); the worker sets this. */
  waitForFrameDone?: boolean;
  /**
   * Build the sim as a debug sim (D961), so SetOmniscient works: the dev server's worker sets this,
   * as Rust's debug builds allowed Omniscient (spec 1, D1014). False in a production build.
   */
  debug?: boolean;
}

export class RealHost {
  sim: Sim | null = null;
  private posted: PostedViews = postedViewsNone();
  private postedBars: PostedBars = postedBarsNone();
  private readonly waitForFrameDone: boolean;
  private readonly debug: boolean;
  /** What the UI reads (D1016); null until its first `Want`: every view then, whole. */
  private want: ViewWant | null = null;
  /** Frames the UI has not answered yet. */
  private unread = 0;
  /** Notices of ticks run while a frame was unread: the next frame carries them first. */
  private held: Notice[] = [];
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
    this.waitForFrameDone = opts.waitForFrameDone ?? false;
    this.debug = opts.debug ?? false;
  }

  /** What a new game of this world can be, for `Ready`; null when it needs no picking. */
  choices(): NewGameChoices | null {
    return newGameChoices(this.data);
  }

  /**
   * Handles one request: [Frame, Reply], or just a Reply when the sim did not change. A throw
   * from the sim (a panic in Rust terms) is not caught here: it is Fatal by design (protocol.ts),
   * and the worker loop posts it once and stops.
   */
  handle(msg: ToSim): FromSim[] {
    switch (msg.kind) {
      case "FrameDone":
        this.unread = Math.max(0, this.unread - 1);
        return [];
      case "Want": {
        this.want = { views: new Set(msg.views), slices: msg.slices };
        if (this.sim === null) return [];
        // Whatever is newly wanted goes out now, even while paused (no frame would carry it).
        const views = this.patch();
        return Object.keys(views).length > 0 ? [this.frameOf(views, [])] : [];
      }
      case "NewGame": {
        const made = simNew(this.data, msg.seed, {
          debug: this.debug,
          ...(msg.scenario === undefined ? {} : { scenario: msg.scenario }),
        });
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
          const made = simNew(this.data, 0, { debug: this.debug });
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
        const before = this.pacing(this.sim);
        const result = this.sim.apply(msg.control);
        if (!result.ok) {
          return [this.reply(msg.id, { kind: "SimError", error: result.error })];
        }
        // Pacing starts fresh only when the control changed it (a new speed, a pause or resume,
        // a skip): a SetAlert or watchlist control must not drop the real time owed to the clock.
        if (this.pacing(this.sim) !== before) this.owedMs = 0;
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
    } else if (first === null) {
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
    if (notices.length === 0 && this.held.length === 0) return [];
    if (this.waitForFrameDone && this.unread > 0) {
      this.held.push(...notices);
      return [];
    }
    return [this.frame(notices)];
  }

  /** What the clock's pacing depends on: paused, or the real seconds per tick (null at max). */
  private pacing(sim: Sim): string {
    const c = sim.controls();
    return c.paused ? "paused" : `${controlsSecondsPerTick(c)}`;
  }

  private install(sim: Sim): void {
    this.sim = sim;
    this.posted = postedViewsNone();
    postedViewsResetNews(this.posted);
    this.postedBars = postedBarsNone();
    this.held = [];
    this.owedMs = 0;
  }

  /** The views to post: those that moved since the last frame, as the UI wants them (D1016). */
  private patch(): ViewsPatch {
    const views = viewsPatchSince((this.sim as Sim).views(), this.posted, undefined, this.want);
    priceBarsCompact(views, this.postedBars);
    return views;
  }

  private frame(notices: Notice[]): FromSim {
    return this.frameOf(this.patch(), notices);
  }

  private frameOf(views: ViewsPatch, notices: Notice[]): FromSim {
    const sim = this.sim as Sim;
    this.unread += 1;
    const all = this.held.length === 0 ? notices : [...this.held, ...notices];
    this.held = [];
    return { kind: "Frame", notices: all, clock: sim.clock(), views };
  }

  private reply(id: number, result: Reply): FromSim {
    return { kind: "Reply", id, result };
  }

  private refuse(id: number): FromSim {
    return this.reply(id, { kind: "Refused", message: "no game yet: send NewGame or Load first" });
  }
}
