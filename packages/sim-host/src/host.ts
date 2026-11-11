// The real sim's host, free of Worker and Node globals so tests can drive it in-process and both
// the browser worker and the Electron sim process (pivot 15.1) can run it: it answers ToSim
// requests and paces the clock, returning the FromSim messages to post, in order (the same shape
// as the mock's SimHost). It follows the protocol's rules (types/protocol.ts): after each request
// a Frame with the views it changed FIRST, then the Reply; while running, at most one Frame per
// FRAME_MS carrying every notice since the last frame (D950, D962).
//
// Slot saves, autosaves and baked starts (pivot 15.4, 3.5) work when the host is handed their
// stores (saves.ts); without them it answers those requests as unsupported, as the browser does.
// A generated history (pivot 3.2 to 3.5; D1037) runs here too, a chunk of ticks per `tick` call so
// the host's loop yields between chunks: `Progress` after each chunk, `Cancel` stops it, and the
// game it makes is hydrated and installed, with its Frame and then the request's Reply.

import {
  type BakedStart,
  controlsSecondsPerTick,
  dateTimeDate,
  dateTimeHour,
  type FromSim,
  type NewGameChoices,
  type Notice,
  newGameChoices,
  type PostedBars,
  type PostedViews,
  PRESIM_CHUNK_TICKS,
  type Presim,
  type PresimOptions,
  type PresimProgress,
  type PresimStep,
  postedBarsNone,
  postedViewsNone,
  postedViewsResetNews,
  presimAdvance,
  presimCancel,
  presimProgress,
  presimSim,
  presimStart,
  priceBarsCompact,
  type Reply,
  type RequestId,
  type Result,
  type Sim,
  type SimError,
  simErrorMessage,
  simHydrate,
  simNew,
  type ToSim,
  unsupportedMessage,
  type ViewsPatch,
  type ViewWant,
  viewsPatchSince,
} from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import {
  AUTOSAVE_MIN_REAL_MS,
  AUTOSAVE_PREFIX,
  nextAutosaveSlot,
  SAVE_VERSION,
  type SaveStore,
  type StartStore,
  slotNameOk,
} from "./saves.ts";

/** A `NewGame` whose start is a generated history (pivot 3.2 to 3.5). */
export interface GenerateRequest {
  id: RequestId;
  seed: number;
  scenario?: string;
}

/** A generated history being run (pivot 3.2 to 3.5; D1037): the host drives it a chunk at a time. */
export interface GenerateJob {
  /** Where it stands before the first chunk. */
  progress(): PresimProgress;
  /** Runs up to `ticks` more ticks (a whole number, at least 1). */
  advance(ticks: number): PresimStep;
  /** Stops it between chunks. */
  cancel(): void;
  /** The hydrated game once `advance` has said `Done`; null before, or once cancelled. */
  game(): Sim | null;
}

/**
 * What answers a `NewGame` with `start: { kind: "generate" }` (D1037): a job the host runs, or the
 * reason it cannot start (sent as `Refused`). The default is `presimGenerate` on the host's data;
 * tests inject a short one.
 */
export type GenerateStart = (req: GenerateRequest) => Result<GenerateJob, string>;

/** The `GenerateStart` of a build with no pre-simulation: Refused, as unsupported. */
export const generateUnsupported: GenerateStart = () => ({ ok: false, error: unsupportedMessage("NewGame") });

/**
 * The pre-simulation of `data` (packages/sim fidelity/presim.ts; pivot 3.2, 3.4): a new game of the
 * historical world under the hidden random scenario (or the request's), run at Coarse fidelity to
 * the first day of play, then hydrated (`simHydrate`). A world that is not historical is refused.
 * `opts.until` ends it earlier (tests).
 */
export function presimGenerate(data: WorldData, opts: PresimOptions = {}): GenerateStart {
  return (req) => {
    const made = presimStart(data, req.seed, {
      ...opts,
      ...(req.scenario === undefined ? {} : { scenario: req.scenario }),
    });
    if (!made.ok) return { ok: false, error: simErrorMessage({ kind: "Load", error: made.error }) };
    const p: Presim = made.value;
    let hydrated: Sim | null = null;
    return {
      ok: true,
      value: {
        progress: () => presimProgress(p),
        advance: (ticks) => presimAdvance(p, ticks),
        cancel: () => presimCancel(p),
        game: () => {
          if (hydrated !== null) return hydrated;
          const sim = presimSim(p);
          if (sim === null) return null;
          simHydrate(sim);
          hydrated = sim;
          return sim;
        },
      },
    };
  };
}

/** A game the host starts by itself, before `Ready` (the desktop's `--save`). */
export type Boot = { kind: "new"; seed: number; scenario?: string } | { kind: "load"; bytes: Uint8Array };

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
  /** Where slot saves live (pivot 15.4). Absent: the slot requests are unsupported. */
  saves?: SaveStore;
  /** Write a rotating autosave at each game-month start (pivot 15.4); needs `saves`. Default true. */
  autosave?: boolean;
  /** The least real ms between autosaves; AUTOSAVE_MIN_REAL_MS when absent. */
  autosaveMinMs?: number;
  /** Told when an autosave could not be written: the game goes on. */
  onAutosaveError?: (message: string) => void;
  /** The baked starts (pivot 3.5). Absent: `Ready` lists none and a baked NewGame is unsupported. */
  starts?: StartStore;
  /** What runs a generated history (see `GenerateStart`); `presimGenerate` on the host's data when absent. */
  generate?: GenerateStart;
  /** Ticks a generated history runs per `tick` call, between yields; `PRESIM_CHUNK_TICKS` when absent. */
  generateChunkTicks?: number;
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
  private readonly saves: SaveStore | null;
  private readonly autosave: boolean;
  private readonly autosaveMinMs: number;
  private readonly onAutosaveError: (message: string) => void;
  private readonly startStore: StartStore | null;
  private readonly generate: GenerateStart;
  private readonly generateChunkTicks: number;
  /** The generated history being run, and the request it answers; null when none is. */
  private generating: { id: RequestId; job: GenerateJob } | null = null;
  /** When the last autosave was written, on `now`'s clock; null before the first. */
  private lastAutosaveMs: number | null = null;
  /** `boot` started a game and no Frame has gone out since. */
  private booted = false;

  constructor(
    private readonly data: WorldData,
    opts: RealHostOptions = {},
  ) {
    this.now = opts.now ?? (() => performance.now());
    this.budgetMs = opts.budgetMs ?? MAX_SPEED_BUDGET_MS;
    this.waitForFrameDone = opts.waitForFrameDone ?? false;
    this.debug = opts.debug ?? false;
    this.saves = opts.saves ?? null;
    this.autosave = opts.autosave ?? true;
    this.autosaveMinMs = opts.autosaveMinMs ?? AUTOSAVE_MIN_REAL_MS;
    this.onAutosaveError = opts.onAutosaveError ?? (() => {});
    this.startStore = opts.starts ?? null;
    this.generate = opts.generate ?? presimGenerate(data, { debug: this.debug });
    this.generateChunkTicks = opts.generateChunkTicks ?? PRESIM_CHUNK_TICKS;
  }

  /** A generated history is being run (pivot 3.5). */
  isGenerating(): boolean {
    return this.generating !== null;
  }

  /** Stops the generation, answering its request `Cancelled`; nothing when none runs. */
  private stopGenerating(): FromSim[] {
    const g = this.generating;
    if (g === null) return [];
    g.job.cancel();
    this.generating = null;
    return [this.reply(g.id, { kind: "Cancelled" })];
  }

  private progressOf(id: RequestId, p: PresimProgress): FromSim {
    return { kind: "Progress", id, phase: "Presim", done: p.done, total: p.total, date: p.date };
  }

  /** One chunk of the generated history (pivot 3.5): its progress, or at the end the new game's Frame and Reply. */
  private generateChunk(): FromSim[] {
    const g = this.generating as { id: RequestId; job: GenerateJob };
    const step = g.job.advance(this.generateChunkTicks);
    if (step.kind === "Progress") return [this.progressOf(g.id, step)];
    this.generating = null;
    if (step.kind === "Cancelled") return [this.reply(g.id, { kind: "Cancelled" })];
    const out: FromSim[] = [
      this.progressOf(g.id, step),
      { kind: "Progress", id: g.id, phase: "Hydrate", done: 0, total: 1, date: step.date },
    ];
    const sim = g.job.game();
    if (sim === null)
      return [...out, this.reply(g.id, { kind: "Refused", message: "the history ended without a game" })];
    this.install(sim);
    return [...out, this.frame([]), this.reply(g.id, { kind: "Ok", notices: [] })];
  }

  /**
   * The baked starts for `Ready` (pivot 3.5): those written with this build's SAVE_VERSION. Null
   * when the host was handed no start store, so `Ready` says nothing about them.
   */
  starts(): BakedStart[] | null {
    if (this.startStore === null) return null;
    return this.startStore.list().filter((s) => s.save_version === SAVE_VERSION);
  }

  /**
   * Starts a game before any request: a new one, or a save's. Returns the problem as text, or null.
   * It posts nothing; `refresh` gives the frame once the UI is there to read it.
   */
  boot(boot: Boot): string | null {
    if (boot.kind === "new") {
      const made = simNew(this.data, boot.seed, {
        debug: this.debug,
        ...(boot.scenario === undefined ? {} : { scenario: boot.scenario }),
      });
      if (!made.ok) return simErrorMessage({ kind: "Load", error: made.error });
      this.install(made.value);
      this.booted = true;
      return null;
    }
    const loaded = this.loadInto(boot.bytes);
    if (!loaded.ok) return simErrorMessage(loaded.error);
    this.booted = true;
    return null;
  }

  /**
   * The booted game's first Frame, once: the loop posts it after `Ready`. It goes out even when the
   * UI wants no view yet, because a Frame is how the UI learns that a game it did not ask for is
   * running. Nothing when no game was booted, or on a second call.
   */
  refresh(): FromSim[] {
    if (this.sim === null || !this.booted) return [];
    this.booted = false;
    return [this.frameOf(this.patch(), [])];
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
      // Only a generated history runs long enough to cancel (pivot 3.5).
      case "Cancel":
        return this.generating?.id === msg.id ? this.stopGenerating() : [];
      // Slot saves are written by the sim's own process (pivot 15.4): a host with no store (the
      // browser worker) does not serve them.
      case "SaveSlot":
      case "LoadSlot":
      case "ListSaves":
      case "DeleteSave":
        if (this.saves === null) {
          return [this.reply(msg.id, { kind: "Refused", message: unsupportedMessage(msg.kind) })];
        }
        return this.slotRequest(msg, this.saves);
      case "Act": {
        if (this.sim === null) return [this.refuse(msg.id)];
        const result = this.sim.act(msg.action);
        if (!result.ok) return [this.reply(msg.id, { kind: "ActError", error: result.error })];
        return [this.frame(result.value), this.reply(msg.id, { kind: "Ok", notices: result.value })];
      }
      case "NewGame": {
        // A new game replaces a history still being generated.
        const stopped = this.stopGenerating();
        // Absent is the world's own start. A generated one runs a chunk per `tick` (pivot 3.5).
        if (msg.start?.kind === "generate") {
          const job = this.generate({
            id: msg.id,
            seed: msg.seed,
            ...(msg.scenario === undefined ? {} : { scenario: msg.scenario }),
          });
          if (!job.ok) return [...stopped, this.reply(msg.id, { kind: "Refused", message: job.error })];
          this.generating = { id: msg.id, job: job.value };
          return [...stopped, this.progressOf(msg.id, job.value.progress())];
        }
        if (msg.start?.kind === "baked") return [...stopped, ...this.newGameBaked(msg.id, msg.start.id)];
        const made = simNew(this.data, msg.seed, {
          debug: this.debug,
          ...(msg.scenario === undefined ? {} : { scenario: msg.scenario }),
        });
        if (!made.ok) {
          return [this.reply(msg.id, { kind: "SimError", error: { kind: "Load", error: made.error } })];
        }
        this.install(made.value);
        return [...stopped, this.frame([]), this.reply(msg.id, { kind: "Ok", notices: [] })];
      }
      case "Load": {
        return [...this.stopGenerating(), ...this.load(msg.id, msg.bytes)];
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

  /** Replaces the game with a save's, building the sim from the data first when there is none (D13). */
  private loadInto(bytes: Uint8Array): Result<Notice[], SimError> {
    let target = this.sim;
    if (target === null) {
      const made = simNew(this.data, 0, { debug: this.debug });
      if (!made.ok) return { ok: false, error: { kind: "Load", error: made.error } };
      target = made.value;
    }
    const loaded = target.loadBytes(bytes);
    if (!loaded.ok) return loaded;
    this.install(target);
    return loaded;
  }

  private load(id: RequestId, bytes: Uint8Array): FromSim[] {
    const loaded = this.loadInto(bytes);
    if (!loaded.ok) return [this.reply(id, { kind: "SimError", error: loaded.error })];
    return [this.frame(loaded.value), this.reply(id, { kind: "Ok", notices: loaded.value })];
  }

  /** A new game from a baked start (pivot 3.5): its save, loaded. The request's seed is not used. */
  private newGameBaked(id: RequestId, start: string): FromSim[] {
    const starts = this.starts();
    if (starts === null || this.startStore === null) {
      return [this.reply(id, { kind: "Refused", message: unsupportedMessage("NewGame") })];
    }
    const bytes = starts.some((s) => s.id === start) ? this.startStore.read(start) : null;
    if (bytes === null) return [this.reply(id, { kind: "Refused", message: `no baked start "${start}"` })];
    return this.load(id, bytes);
  }

  /** The four slot requests (pivot 15.4). A store that throws is answered, not Fatal: the game is whole. */
  private slotRequest(
    msg: Extract<ToSim, { kind: "SaveSlot" | "LoadSlot" | "ListSaves" | "DeleteSave" }>,
    saves: SaveStore,
  ): FromSim[] {
    const refused = (message: string): FromSim[] => [this.reply(msg.id, { kind: "Refused", message })];
    const io = (e: unknown): FromSim[] => {
      const message = e instanceof Error ? e.message : String(e);
      return [
        this.reply(msg.id, { kind: "SimError", error: { kind: "Save", error: { kind: "Io", message } } }),
      ];
    };
    if (msg.kind === "ListSaves") {
      try {
        return [this.reply(msg.id, { kind: "Saves", saves: saves.list() })];
      } catch (e) {
        return io(e);
      }
    }
    if (!slotNameOk(msg.slot)) {
      return refused(
        `"${msg.slot}" is not a save name: use letters, digits, spaces, _ and -, starting with a letter or digit`,
      );
    }
    switch (msg.kind) {
      case "SaveSlot": {
        if (this.sim === null) return [this.refuse(msg.id)];
        if (msg.slot.startsWith(AUTOSAVE_PREFIX)) {
          return refused(`names starting "${AUTOSAVE_PREFIX}" are kept for autosaves`);
        }
        try {
          this.writeSlot(this.sim, saves, msg.slot);
        } catch (e) {
          return io(e);
        }
        return [this.reply(msg.id, { kind: "Ok", notices: [] })];
      }
      case "LoadSlot": {
        let bytes: Uint8Array | null;
        try {
          bytes = saves.read(msg.slot);
        } catch (e) {
          return io(e);
        }
        if (bytes === null) return refused(`no save named "${msg.slot}"`);
        return this.load(msg.id, bytes);
      }
      case "DeleteSave":
        try {
          if (!saves.delete(msg.slot)) return refused(`no save named "${msg.slot}"`);
        } catch (e) {
          return io(e);
        }
        return [this.reply(msg.id, { kind: "Ok", notices: [] })];
    }
  }

  private writeSlot(sim: Sim, saves: SaveStore, slot: string): void {
    saves.write(slot, sim.saveBytes(), { time: sim.now(), seed: sim.seed(), save_version: SAVE_VERSION });
  }

  /**
   * Runs one tick. True when it wrote an autosave: at 00:00 on the first of a month, into the
   * oldest of the rotating slots (pivot 15.4), unless one was written under `autosaveMinMs` of real
   * time ago. Saving reads the state and changes nothing, so it cannot move the state hash.
   */
  private step(sim: Sim, notices: Notice[]): boolean {
    for (const n of sim.step()) notices.push(n);
    if (this.saves === null || !this.autosave) return false;
    const now = sim.now();
    if (dateTimeHour(now) !== 0 || dateTimeDate(now).day !== 1) return false;
    const t = this.now();
    if (this.lastAutosaveMs !== null && t - this.lastAutosaveMs < this.autosaveMinMs) return false;
    this.lastAutosaveMs = t;
    try {
      this.writeSlot(sim, this.saves, nextAutosaveSlot(this.saves.list()));
    } catch (e) {
      this.onAutosaveError(e instanceof Error ? e.message : String(e));
      return false;
    }
    return true;
  }

  /**
   * Advances the clock by `dtMs` of real time (called once per FRAME_MS): runs the ticks the speed
   * owes, and returns one Frame with all their notices, or nothing when no tick ran. Paused runs
   * nothing; speeds 1 to 4 run one game hour per SECONDS_PER_HOUR[speed] (D8); max runs as many
   * ticks as fit in the frame budget.
   */
  tick(dtMs: number): FromSim[] {
    // While a history is generated, the timer runs its chunks and the old game (if any) waits.
    if (this.generating !== null) return this.generateChunk();
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
        // An autosave has spent the frame's budget and more.
        if (this.step(sim, notices)) break;
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
        this.step(sim, notices);
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
    const sim = this.sim as Sim;
    const views = viewsPatchSince(sim.views(), this.posted, undefined, this.want, (key) => sim.slice(key));
    priceBarsCompact(views, this.postedBars);
    return views;
  }

  private frame(notices: Notice[]): FromSim {
    return this.frameOf(this.patch(), notices);
  }

  private frameOf(views: ViewsPatch, notices: Notice[]): FromSim {
    const sim = this.sim as Sim;
    this.unread += 1;
    // Any Frame tells the UI of a booted game: `refresh` need not post another.
    this.booted = false;
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
