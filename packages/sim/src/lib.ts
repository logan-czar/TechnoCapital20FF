// The TechnoCapital20FF simulation (build-plan 2.1). No DOM and no wall clock: it runs the same in
// the game's Web Worker, in tests and in the headless runner, deterministic on one machine
// (build-plan 6, decision A). Ported from crates/sim/src/lib.rs.
//
// The public API is `Sim` (types/sim-api.ts `SimApi`): `simNew(data, seed)`, `simStep(sim)` (one
// hourly tick, returning its notices) and `simApply(sim, control)`. `Sim` also has the SimApi
// methods (`sim.step()`, ...), which call the free functions.
//
// STEP 2: `startWorld` calls modules ported in Step 2 (economy, births, ai, people, finance,
// market). Those calls go through `StartDeps` below, one member per Rust function; `START_DEPS`
// holds the ported functions, and a test may pass its own. The map build (crate::map, M8) goes
// through `SimDeps.mapDataBuild` the same way, and the view builders through views/index.ts
// `VIEW_BUILDERS`.
//
// Differences from Rust:
// - `cfg!(debug_assertions)` (SetOmniscient, and masking Omniscient on load) is the `debug` option
//   of `SimOptions`: false by default (the game), true in tests that need Omniscient.
// - `Control::Save(path)` and `Control::Load(path)` read and write through `SimOptions.files`
//   (the headless runner passes node:fs; the sim imports no node: module). Without it they fail
//   with an Io save error; the browser uses `saveBytes` and `loadBytes`.
// - The Rust test hooks (feature `test-hooks`) and the soak hooks (feature `soak-stats`) are the
//   free functions `simWorld`, `simRegisterTestJob`, `simSoakStats` and `simSoakWorld`, exported
//   from internal.ts, never from index.ts.

import type { WorldData } from "@tc20ff/sim-data";
import { planAtLoad } from "./ai/jobs.ts";
import { drawFirstVotes, drawTippedLabAtLoad } from "./births/jobs.ts";
import { DEFAULT_PROFILE_ID, LEGACY_PROFILE, profileById } from "./economy/profiles.ts";
import { start as economyStart } from "./economy/start.ts";
import { start as financeStart } from "./finance/index.ts";
import { stateHash } from "./hash.ts";
import { scheduler } from "./jobs.ts";
import { mapDataBuild, mapDataDefault } from "./map.ts";
import { start as marketStart } from "./market/jobs.ts";
import { start as seatingStart } from "./people/seating.ts";
import { type RngStreams, rngStreamsDraws, rngStreamsNew, rngStreamsSeed } from "./rng.ts";
import { decode, encode, saveErrorMessage } from "./save.ts";
import { type SoakStats, soakStats } from "./soak.ts";
import { controlsDefault, skipTarget } from "./time/control.ts";
import {
  type JobFn,
  type Scheduler,
  type Slot,
  schedulerRegister,
  schedulerRunTickObserved,
  type TickObserver,
} from "./time/scheduler.ts";
import type { DateTime } from "./types/calendar.ts";
import { type Control, type Controls, MAX_SPEED } from "./types/control.ts";
import type { DrawSource } from "./types/draws.ts";
import type { Notice, PauseReason } from "./types/notice.ts";
import type { SaveError, SimApi, SimError, StateHash } from "./types/sim-api.ts";
import type { ClockView, SimViews } from "./types/views/index.ts";
import type { EconomyProfile, LoadError, Result, World } from "./types/world.ts";
import {
  type MapData,
  simViewsBuild,
  simViewsClock,
  simViewsRebuild,
  simViewsRefreshAfterControl,
  simViewsRefreshAfterTick,
  VIEW_BUILDERS,
  type ViewBuilders,
  type ViewInput,
} from "./views/index.ts";
import { buildWorld, loadErrorToString } from "./world/load.ts";
import { alertLevelsSet } from "./world/notice.ts";

export type { SoakIndustry, SoakStats } from "./soak.ts";

// ---------------------------------------------------------------- Step 2 dependencies

/**
 * What `start_world` takes from the modules Step 2 ports. Each member is one Rust function (its
 * path in the comment), in the order `start_world` calls them.
 */
export interface StartDeps {
  /** world/load.rs `World::from_data` (`buildWorld`, with its own `LoadDeps` defaults). */
  worldFromData(data: WorldData): Result<World, LoadError>;
  /** economy/mod.rs `start(world, draws)`: pop date, cycle start, zone shocks, Q1 2020 growth draw (7.3). */
  economyStart(world: World, draws: DrawSource): void;
  /** births/jobs.rs `draw_tipped_lab_at_load(world, draws)` (gen stream, D111, D281). */
  birthsDrawTippedLabAtLoad(world: World, draws: DrawSource): void;
  /** ai/jobs.rs `plan_at_load(world)` (growth g_dem of the Q1 draw, D283; draws nothing). */
  aiPlanAtLoad(world: World): void;
  /** people/seating.rs `start(world, draws)`: the boards' simple characters (3.7.1, 7.1). */
  peopleSeatingStart(world: World, draws: DrawSource): void;
  /** births/jobs.rs `draw_first_votes(world, draws)` (gen stream, after the boards, D276). */
  birthsDrawFirstVotes(world: World, draws: DrawSource): void;
  /** finance/mod.rs `start(world)`: rating, line limit, synthetic history (7.1, 4.4); no draws. */
  financeStart(world: World): void;
  /** market/mod.rs `start(world, draws)`: engine value, V and P, indices, EFV errors (7.1, 5.14, D150). */
  marketStart(world: World, draws: DrawSource): void;
}

/** The default `StartDeps`: every member is the ported Rust function. */
export const START_DEPS: StartDeps = {
  worldFromData: (data) => buildWorld(data),
  economyStart, // economy/start.ts
  birthsDrawTippedLabAtLoad: drawTippedLabAtLoad, // births/jobs.ts
  aiPlanAtLoad: planAtLoad, // ai/jobs.ts
  peopleSeatingStart: seatingStart, // people/seating.ts
  birthsDrawFirstVotes: drawFirstVotes, // births/jobs.ts
  financeStart, // finance/index.ts
  marketStart, // market/jobs.ts start
};

/** Everything `Sim` calls outside lib.ts that Step 2 or 3 ports. */
export interface SimDeps {
  /** `start_world`'s calls. */
  start: StartDeps;
  /**
   * map.rs `MapData::build(data, world)` (M8): the static map data the map views read.
   */
  mapDataBuild(data: WorldData, world: World): Result<MapData, LoadError>;
  /** Every view's builder (views/index.ts). */
  views: ViewBuilders;
}

/** The default `SimDeps`. */
export const SIM_DEPS: SimDeps = {
  start: START_DEPS,
  mapDataBuild, // map.ts
  views: VIEW_BUILDERS,
};

// ---------------------------------------------------------------- start_world and scheduler

/**
 * The whole start state (spec 7): the static tables and 7.1 loadouts, then the load's draws in
 * their frozen order (D163): the economy's (pop date, cycle start, zone shocks, Q1 2020 growth
 * draw; 7.3); the tipped lab (gen stream, right after the pop roll, D111, D281); the plan at load
 * (growth g_dem of the Q1 draw, D283; draws nothing); the boards' simple characters (3.7.1, 7.1);
 * the starting private companies' first IPO votes (gen stream, after the boards, D276); then the
 * books, which draw nothing (the starting rating, line limit and synthetic history, 7.1 and 4.4);
 * then the market (engine value, V and P at open_price, the indices at 1,000, each quoted stock's
 * EFV error; 7.1, 5.14, D150). The news wire starts from the load's phase labels.
 */
export function startWorld(
  data: WorldData,
  draws: DrawSource,
  deps: StartDeps = START_DEPS,
  profile: EconomyProfile = LEGACY_PROFILE,
): Result<World, LoadError> {
  const built = deps.worldFromData(data);
  if (!built.ok) return built;
  const world = built.value;
  world.profile = profile;
  deps.economyStart(world, draws);
  deps.birthsDrawTippedLabAtLoad(world, draws);
  deps.aiPlanAtLoad(world);
  deps.peopleSeatingStart(world, draws);
  deps.birthsDrawFirstVotes(world, draws);
  deps.financeStart(world);
  deps.marketStart(world, draws);
  world.news.labels = world.industries.map((i) => i.phase_label);
  return { ok: true, value: world };
}

// `scheduler()` and `registerJobs` (every module's jobs in their slots, Rust lib.rs `scheduler`
// and `register_jobs`) are in jobs.ts.

// ---------------------------------------------------------------- SimError

/** Rust `Display for SimError` (thiserror messages). */
export function simErrorMessage(e: SimError): string {
  switch (e.kind) {
    case "BadSpeed":
      return `speed ${e.speed} is outside 0 to ${MAX_SPEED}`;
    case "UnknownCompany":
      return `no company ${e.company}`;
    case "DebugOnly":
      return "Omniscient is only available in debug builds";
    case "Load":
      return loadErrorToString(e.error);
    case "Save":
      return saveErrorMessage(e.error);
  }
}

// ---------------------------------------------------------------- Sim

/** File access for `Control::Save(path)` and `Control::Load(path)`. Each throws on failure. */
export interface SaveFiles {
  read(path: string): Uint8Array;
  write(path: string, bytes: Uint8Array): void;
}

/** How a `Sim` is built. */
export interface SimOptions {
  /**
   * A debug build (Rust `cfg!(debug_assertions)`): SetOmniscient is allowed and Omniscient
   * survives a load. False by default (the game).
   */
  debug?: boolean;
  /** For the Save and Load controls (none by default: they fail with an Io save error). */
  files?: SaveFiles | null;
  /** The growth profile id (economy/profiles.ts, D970); `DEFAULT_PROFILE_ID` when absent. */
  profile?: string;
  /** Replaces some of the default `SIM_DEPS` (tests). */
  deps?: Partial<SimDeps>;
}

/** What stays the same across a NewGame: the data, the build options and the deps. */
export interface SimConfig {
  /** The loaded data this game was built from; null for a Sim built on a test world. */
  readonly data: WorldData | null;
  /** A new game's start state for its draws (Rust `start_world(&data, &mut rng)`). */
  readonly start: (draws: DrawSource) => Result<World, LoadError>;
  /** The built-in scheduler (Rust `scheduler()`): a NewGame drops test jobs by making a new one. */
  readonly makeScheduler: () => Scheduler;
  readonly mapDataBuild: (world: World) => Result<MapData, LoadError>;
  readonly views: ViewBuilders;
  readonly debug: boolean;
  readonly files: SaveFiles | null;
}

/** One game's state (the fields Rust `std::mem::replace`s at a NewGame). */
export interface SimState {
  world: World;
  rng: RngStreams;
  /** `rng` as a DrawSource; rebuilt whenever `rng` is replaced (rng.ts `rngStreamsDraws`). */
  draws: DrawSource;
  scheduler: Scheduler;
  controls: Controls;
  views: SimViews;
  /** The static map data the map views read (M8): built from the data, never saved or hashed. */
  map: MapData;
  trace: Slot[] | null;
}

interface SimInner {
  readonly cfg: SimConfig;
  s: SimState;
}

// The state lives here, not on the class, so the public `Sim` type exposes no world tables
// (spec 9): only lib.ts's free functions reach it.
const INNER = new WeakMap<Sim, SimInner>();

function inner(sim: Sim): SimInner {
  const i = INNER.get(sim);
  if (i === undefined) throw new Error("not a Sim");
  return i;
}

/** The simulation: the world, its RNG streams, the scheduler that runs them and the controls. */
export class Sim implements SimApi {
  /** Use `simNew` (or internal.ts `simFromWorld` in tests). */
  constructor(cfg: SimConfig, s: SimState) {
    INNER.set(this, { cfg, s });
  }

  step(): Notice[] {
    return simStep(this);
  }

  apply(control: Control): Result<Notice[], SimError> {
    return simApply(this, control);
  }

  saveBytes(): Uint8Array {
    return simSaveBytes(this);
  }

  loadBytes(bytes: Uint8Array): Result<Notice[], SimError> {
    return simLoadBytes(this, bytes);
  }

  now(): DateTime {
    return simNow(this);
  }

  stateHash(): StateHash {
    return simStateHash(this);
  }

  seed(): number {
    return simSeed(this);
  }

  views(): SimViews {
    return simViews(this);
  }

  clock(): ClockView {
    return simClock(this);
  }

  controls(): Controls {
    return simControls(this);
  }
}

function viewInput(s: SimState): ViewInput {
  return { world: s.world, controls: s.controls, seed: rngStreamsSeed(s.rng), map: s.map };
}

/** Rust `Sim::from_shared` without the data: a new game's state for `seed`. */
function freshState(cfg: SimConfig, seed: number): Result<SimState, LoadError> {
  const rng = rngStreamsNew(seed);
  const draws = rngStreamsDraws(rng);
  // The load's draws: cycle start, pop date, Q1 2020 growth draw (spec 7.3, D12), then the
  // boards (7.1).
  const world = cfg.start(draws);
  if (!world.ok) return world;
  const controls = controlsDefault();
  const map = cfg.mapDataBuild(world.value);
  if (!map.ok) return map;
  const s: SimState = {
    world: world.value,
    rng,
    draws,
    scheduler: cfg.makeScheduler(),
    controls,
    views: undefined as unknown as SimViews,
    map: map.value,
    trace: null,
  };
  s.views = simViewsBuild(viewInput(s), cfg.views);
  return { ok: true, value: s };
}

function simFromConfig(cfg: SimConfig, seed: number): Result<Sim, LoadError> {
  const s = freshState(cfg, seed);
  if (!s.ok) return s;
  return { ok: true, value: new Sim(cfg, s.value) };
}

/**
 * A new game from the loaded data and a seed: the start state of spec 7, paused at 2020-01-01
 * 00:00 (spec 7.3). Rust `Sim::new`.
 */
export function simNew(data: WorldData, seed: number, opts: SimOptions = {}): Result<Sim, LoadError> {
  const deps: SimDeps = { ...SIM_DEPS, ...opts.deps };
  const profile = profileById(opts.profile ?? DEFAULT_PROFILE_ID);
  if (profile === null) {
    return {
      ok: false,
      error: {
        kind: "BadValue",
        table: "profile",
        key: opts.profile ?? "",
        message: "unknown growth profile",
      },
    };
  }
  return simFromConfig(
    {
      data,
      start: (draws) => startWorld(data, draws, deps.start, profile),
      makeScheduler: scheduler,
      mapDataBuild: (world) => deps.mapDataBuild(data, world),
      views: deps.views,
      debug: opts.debug ?? false,
      files: opts.files ?? null,
    },
    seed,
  );
}

/** How `simFromWorld` builds a test Sim. */
export interface SimFromWorldOptions extends SimOptions {
  /** The scheduler (default: `scheduler()`, every module's jobs). */
  makeScheduler?: () => Scheduler;
}

/**
 * For tests only (internal.ts): a Sim on a given start world instead of the data, so the Sim's
 * own logic runs before every Step 2 module is ported. A NewGame restarts from a copy of the
 * same world (no draws), with a new scheduler from `makeScheduler`. `opts.deps.views` picks the
 * view builders (views/index.ts `viewBuildersOnly` for a world too small for them).
 */
export function simFromWorld(world: World, seed: number, opts: SimFromWorldOptions = {}): Sim {
  const start = structuredClone(world);
  const views = opts.deps?.views ?? VIEW_BUILDERS;
  const r = simFromConfig(
    {
      data: null,
      start: () => ({ ok: true, value: structuredClone(start) }),
      makeScheduler: opts.makeScheduler ?? scheduler,
      mapDataBuild: () => ({ ok: true, value: mapDataDefault() }),
      views,
      debug: opts.debug ?? false,
      files: opts.files ?? null,
    },
    seed,
  );
  if (!r.ok) throw new Error(`simFromWorld: ${loadErrorToString(r.error)}`);
  return r.value;
}

/**
 * Runs one tick (one hour, spec 4) and returns its notices in order; the last is always
 * TickDone. It runs whether or not the game is paused: the runner decides how many steps to run
 * from the controls' effective speed (spec 9.1).
 */
export function simStep(sim: Sim): Notice[] {
  return stepInner(inner(sim), null);
}

/**
 * `simStep`, telling `observer` when each slot, job and the view refresh start and finish
 * (build-plan M10.6 profiling, D400). The tick is the same as `simStep`'s: the observer sees no
 * state and cannot change any.
 */
export function simStepObserved(sim: Sim, observer: TickObserver): Notice[] {
  return stepInner(inner(sim), observer);
}

function stepInner(i: SimInner, observer: TickObserver | null): Notice[] {
  const s = i.s;
  const notices: Notice[] = [];
  if (s.trace !== null) s.trace.length = 0;
  const alertPause = schedulerRunTickObserved(
    s.scheduler,
    s.world,
    s.draws,
    notices,
    s.controls,
    s.trace,
    observer,
  );
  // Pauses go in just before the final TickDone.
  const done = notices.pop();
  const skip = s.controls.skip;
  if (skip !== null && s.world.clock >= skip.target) {
    s.controls.skip = null;
    pause(s, notices, { kind: "SkipDone", skip: skip.kind });
  } else if (alertPause !== null) {
    pause(s, notices, alertPause);
  }
  if (done !== undefined) notices.push(done);
  observer?.started({ kind: "Views" });
  simViewsRefreshAfterTick(s.views, viewInput(s), observer, i.cfg.views);
  observer?.finished({ kind: "Views" });
  return notices;
}

/** Pauses (once: a second pause posts nothing). */
function pause(s: SimState, notices: Notice[], reason: PauseReason): void {
  if (!s.controls.paused) {
    s.controls.paused = true;
    notices.push({ kind: "Paused", reason });
  }
}

function fail(error: SimError): Result<never, SimError> {
  return { ok: false, error };
}

/** Applies a control at once (D5) and returns any notices it causes. */
export function simApply(sim: Sim, control: Control): Result<Notice[], SimError> {
  const i = inner(sim);
  const notices: Notice[] = [];
  const c = i.s.controls;
  switch (control.kind) {
    case "NewGame": {
      const fresh = freshState(i.cfg, control.seed);
      if (!fresh.ok) return fail({ kind: "Load", error: fresh.error });
      // The old views carry their refresh count over, so versions keep climbing. The alert
      // levels carry over too; everything else (speed, watchlist, test jobs, trace) is new.
      const views = i.s.views;
      i.s = fresh.value;
      i.s.controls.alerts = c.alerts;
      simViewsRebuild(views, viewInput(i.s), i.cfg.views);
      i.s.views = views;
      break;
    }
    case "SetSpeed":
      if (control.speed === 0) {
        c.skip = null;
        pause(i.s, notices, { kind: "Player" });
      } else if (Number.isInteger(control.speed) && control.speed > 0 && control.speed <= MAX_SPEED) {
        c.skip = null;
        c.speed = control.speed;
        c.paused = false;
      } else {
        return fail({ kind: "BadSpeed", speed: control.speed });
      }
      break;
    case "Pause":
      c.skip = null;
      pause(i.s, notices, { kind: "Player" });
      break;
    case "Resume":
      c.paused = false;
      break;
    case "SkipTo":
      c.skip = { kind: control.skip, target: skipTarget(i.s.world.clock, control.skip) };
      c.paused = false;
      break;
    case "Save": {
      const r = saveFile(i, control.path);
      if (!r.ok) return r;
      break;
    }
    case "Load": {
      const r = loadFile(i, control.path);
      if (!r.ok) return r;
      notices.push(...r.value);
      break;
    }
    case "SetAlert":
      alertLevelsSet(c.alerts, control.alert_kind, control.level);
      break;
    case "SetOmniscient":
      if (!i.cfg.debug) return fail({ kind: "DebugOnly" });
      c.omniscient = control.on;
      break;
    case "WatchlistAdd":
      if (i.s.world.companies[control.company] === undefined) {
        return fail({ kind: "UnknownCompany", company: control.company });
      }
      c.watchlist.add(control.company);
      break;
    case "WatchlistRemove":
      c.watchlist.delete(control.company);
      break;
  }
  simViewsRefreshAfterControl(i.s.views, viewInput(i.s), i.cfg.views);
  return { ok: true, value: notices };
}

/** The state as save bytes (spec 9.1 `Save`; build-plan M1.7). */
export function simSaveBytes(sim: Sim): Uint8Array {
  const s = inner(sim).s;
  return encode(s.world, s.rng, s.controls);
}

function ioError(e: unknown): Result<never, SimError> {
  const error: SaveError = { kind: "Io", message: e instanceof Error ? e.message : String(e) };
  return fail({ kind: "Save", error });
}

/** Rust `Sim::save`: writes a save file through `SimOptions.files`. */
function saveFile(i: SimInner, path: string): Result<null, SimError> {
  if (i.cfg.files === null) return ioError("no file access in this runner; use saveBytes");
  try {
    i.cfg.files.write(path, encode(i.s.world, i.s.rng, i.s.controls));
  } catch (e) {
    return ioError(e);
  }
  return { ok: true, value: null };
}

/** Rust `Sim::load`: reads a save file through `SimOptions.files`. */
function loadFile(i: SimInner, path: string): Result<Notice[], SimError> {
  if (i.cfg.files === null) return ioError("no file access in this runner; use loadBytes");
  let bytes: Uint8Array;
  try {
    bytes = i.cfg.files.read(path);
  } catch (e) {
    return ioError(e);
  }
  return loadBytesInner(i, bytes);
}

/**
 * Replaces the state with a save's (spec 9.1 `Load`). The game comes back paused with no skip
 * running (D13); the views are rebuilt (spec 9.4 "and on load"). The loaded data stays, for a
 * later NewGame. A save that does not decode changes nothing.
 */
export function simLoadBytes(sim: Sim, bytes: Uint8Array): Result<Notice[], SimError> {
  return loadBytesInner(inner(sim), bytes);
}

function loadBytesInner(i: SimInner, bytes: Uint8Array): Result<Notice[], SimError> {
  const state = decode(bytes);
  if (!state.ok) return fail({ kind: "Save", error: state.error });
  const s = i.s;
  s.world = state.value.world;
  s.rng = state.value.rng;
  s.draws = rngStreamsDraws(s.rng);
  s.controls = state.value.controls;
  s.controls.skip = null;
  s.controls.omniscient &&= i.cfg.debug;
  const notices: Notice[] = [];
  s.controls.paused = false;
  pause(s, notices, { kind: "Loaded" });
  simViewsRebuild(s.views, viewInput(s), i.cfg.views);
  return { ok: true, value: notices };
}

/** The time of the last finished tick. */
export function simNow(sim: Sim): DateTime {
  return inner(sim).s.world.clock;
}

/** The hash of the world and RNG positions (build-plan M1.8, 4.3). */
export function simStateHash(sim: Sim): StateHash {
  const s = inner(sim).s;
  return stateHash(s.world, s.rng);
}

/** The game seed. */
export function simSeed(sim: Sim): number {
  return rngStreamsSeed(inner(sim).s.rng);
}

/** The read-only views the UI reads (spec 9.2, 9.4). Read them; never change them. */
export function simViews(sim: Sim): SimViews {
  return inner(sim).s.views;
}

/** The clock (spec 9.1 `clock()`). */
export function simClock(sim: Sim): ClockView {
  return simViewsClock(inner(sim).s.views);
}

/** Speed, pause, skip, alert levels, Omniscient and the watchlist. Read them; never change them. */
export function simControls(sim: Sim): Controls {
  return inner(sim).s.controls;
}

/** Records which slots each tick visits (build-plan M1.3). A NewGame turns it off. */
export function simSetTrace(sim: Sim, on: boolean): void {
  inner(sim).s.trace = on ? [] : null;
}

/** The slots the last tick visited, in order (empty unless tracing). */
export function simLastTrace(sim: Sim): readonly Slot[] {
  return inner(sim).s.trace ?? [];
}

/** The loaded data this game was built from (null for a Sim built on a test world). */
export function simData(sim: Sim): WorldData | null {
  return inner(sim).cfg.data;
}

// ---------------------------------------------------------------- test and soak hooks

/**
 * Read access to the world tables, for sim's own tests only (Rust feature `test-hooks`;
 * internal.ts). The game reads only `simViews` (spec 9).
 */
export function simWorld(sim: Sim): World {
  return inner(sim).s.world;
}

/**
 * Adds a job to a slot after the built-in ones, for sim's own tests only (Rust feature
 * `test-hooks`): it lets determinism, save and hash tests run jobs that draw and write. A
 * NewGame control drops it.
 */
export function simRegisterTestJob(sim: Sim, slot: Slot, name: string, job: JobFn): void {
  schedulerRegister(inner(sim).s.scheduler, slot, name, job);
}

/**
 * The engine's true totals for the headless soak (D427; Rust feature `soak-stats`): the game
 * reads only `simViews` (spec 9).
 */
export function simSoakStats(sim: Sim): SoakStats {
  return soakStats(inner(sim).s.world);
}

/**
 * Read access to the world tables for the headless runner's `--detail` dump (D900; Rust feature
 * `soak-stats`): it reads true figures (no estimate bands, D420) and never writes, so a run's rows
 * and hashes are the same with or without it.
 */
export function simSoakWorld(sim: Sim): World {
  return inner(sim).s.world;
}
