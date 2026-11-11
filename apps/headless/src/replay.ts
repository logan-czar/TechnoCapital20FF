// `record` and `replay` (build-plan M10.4, 4.3 "Replay test", D403): a run records its seed and
// command log (every player control, with the frame it was sent in) and the state hash at each
// month close; a replay of the log on the same machine and build must give the same hashes.
// Ported from crates/headless/src/replay.rs.
//
// Both drive the sim through the same headless frame loop (`runFrames`): each frame first applies
// that frame's controls, then runs as many ticks as the effective speed allows
// (TICKS_PER_FRAME), stopping early when the sim pauses itself (an alert, a finished SkipTo). So
// the log holds only what the player did; the sim's own pauses, skips and alerts happen again in
// the replay, and a frame or step that moved would show as a changed hash line. `record` plays a
// scripted player whose choices come from its own splitmix64 stream (never the sim's RNG streams,
// D9), seeded by the game seed.
//
// The controls the log can hold are every `Control` the MVP's player can send except NewGame (a
// log is one game) and SetOmniscient (debug builds only): speed 0 to 6, pause, resume, the four
// SkipTos, alert levels, the watchlist, and Save and Load. In TS a save is the sim's `saveBytes`
// kept in memory (the Rust wrote numbered files beside the log); a Load loads the latest one,
// which rewinds the game to it.
//
// Player actions (pivot 16.1, D1027; lane P, D1042): a run may open the player's account at its
// start (`record`'s `player` option; the world must be Full, and one that never hydrates has no
// player otherwise) and then log every action the scripted trader sent that the sim applied, with
// its frame. A frame applies its controls, then its actions, then runs its ticks. The actions are
// inside the state hash, so a replay that drops or changes one fails at the next hash line. The
// trader draws from a stream of its own (`TRADER_SALT`), and only once the account is open, so a
// run without a player makes the same choices as before.
//
// The log is plain text, one record per line:
//
//   version 2
//   seed 7
//   years 2
//   player <difficulty>            optional: the account opens at the start (e.g. "player Normal")
//   control <frame> <control>      e.g. "control 120 speed 4", "control 300 skip next-lock"
//   act <frame> <action as JSON>   e.g. "act 40 {"kind":"Transfer","from":"Brokerage",...}"
//   hash <frame> <step> <month> <state hash>
//   end <frame> <step> <clock> <state hash> controls <digest>
//
// The state hash does not cover the controls (D13), so the end line adds a digest of the final
// `Controls` (speed, pause, skip, alert levels, watchlist): a dropped or changed control that
// moves no frame, step or hash (a watchlist change, say) still fails the replay (D403).
import { readFileSync, writeFileSync } from "node:fs";
import {
  type ActError,
  type AlertKind,
  type AlertLevel,
  type CompanyId,
  type Control,
  type Controls,
  controlsEffectiveSpeed,
  DIFFICULTY_VALUES,
  type Difficulty,
  dateTimeDate,
  formatDateTime,
  formatMonth,
  MAX_SPEED,
  type PlayerAction,
  type SimApi,
  type SimError,
  type SkipKind,
  stockInstrument,
} from "@tc20ff/sim";
import { dateTimeMidnight, playerOpen, simDateYmd } from "@tc20ff/sim/internal";
import type { WorldData } from "@tc20ff/sim-data";
import { isSoakSim } from "./factory.ts";
import type { SimFactory } from "./metrics.ts";

/** The log format version written on the first line (2: the end line carries the controls digest). */
export const LOG_VERSION = 2;

/** FNV-1a 64 (offset basis and prime) for the controls digest on the end line. */
const FNV_OFFSET = 0xcbf2_9ce4_8422_2325n;
const FNV_PRIME = 0x0000_0100_0000_01b3n;
const U64 = 0xffff_ffff_ffff_ffffn;

/**
 * Ticks the headless frame loop runs in one frame at each effective speed, 0 (paused) to 6 (max,
 * and while skipping). The game's own frame budget is wall-clock based (spec 8, 9.1); the replay
 * needs only a fixed one, so these stand in for it (D403). Length MAX_SPEED + 1.
 */
export const TICKS_PER_FRAME: readonly number[] = [0, 1, 2, 4, 8, 16, 24];

/** The scripted player sends a control in a frame with this chance while the game runs... */
const PLAYER_ACT_CHANCE = 0.004;
/** ...and resumes (or sets a speed) with this chance in a paused frame. */
const PLAYER_RESUME_CHANCE = 0.25;
/** The player's control mix, in parts per hundred: speed, pause, skip, alert, watchlist, save; the rest is load. */
const PLAYER_MIX: readonly number[] = [30, 10, 20, 15, 12, 9];
/** Salt mixed into the game seed for the player's own stream (not a sim stream, D9). */
const PLAYER_SALT = 0x5245_504c_4159_4c4fn;
/** Salt for the scripted trader's stream, apart from the controls' so they draw as before (D1042). */
const TRADER_SALT = 0x5452_4144_4552_5f50n;
/** The trader sends an action in a frame with this chance while the account is open (D1042). */
const TRADE_CHANCE = 0.02;
/**
 * The trader's mix, in parts per hundred: buy, sell, cancel, transfer, follow, alert; the rest
 * marks the notifications read.
 */
const TRADE_MIX: readonly number[] = [35, 25, 10, 10, 8, 7];
/** Most shares the trader buys in one order. */
const TRADE_MAX_QTY = 50;

/** One recorded control and the frame it was sent in. */
export interface LoggedControl {
  frame: number;
  control: LogControl;
}

/** One player action the sim applied, and the frame it was sent in (D1042). */
export interface LoggedAction {
  frame: number;
  action: PlayerAction;
}

/** The controls a log holds. Save and Load name a save by its number in the run. */
export type LogControl =
  | { kind: "Speed"; n: number }
  | { kind: "Pause" }
  | { kind: "Resume" }
  | { kind: "Skip"; skip: SkipKind }
  | { kind: "Alert"; alert: AlertKind; level: AlertLevel }
  | { kind: "WatchAdd"; id: number }
  | { kind: "WatchRemove"; id: number }
  | { kind: "Save"; n: number }
  | { kind: "Load"; n: number };

export const SKIPS: readonly (readonly [SkipKind, string])[] = [
  ["NextRelease", "next-release"],
  ["NextLock", "next-lock"],
  ["NextRecap", "next-recap"],
  ["MonthEnd", "month-end"],
];

export const ALERTS: readonly (readonly [AlertKind, string])[] = [
  ["EarningsDay", "earnings-day"],
  ["QuarterlyRecap", "quarterly-recap"],
  ["PlanLock", "plan-lock"],
  ["BankruptcyInWatchlist", "bankruptcy-in-watchlist"],
  ["WorldEvent", "world-event"],
  ["QuarterStart", "quarter-start"],
];

/** The alerts the random player sets: the five before Quarter start (D800). */
const PLAYER_ALERTS = 5;

export const LEVELS: readonly (readonly [AlertLevel, string])[] = [
  ["Pause", "pause"],
  ["Notify", "notify"],
  ["Log", "log"],
  ["Off", "off"],
];

function nameOf<T>(table: readonly (readonly [T, string])[], v: T): string {
  const e = table.find(([t]) => t === v);
  if (e === undefined) throw new Error("every value is in its table");
  return e[1];
}

function tableValue<T>(table: readonly (readonly [T, string])[], name: string): T | undefined {
  return table.find(([, n]) => n === name)?.[0];
}

/** Rust `LogControl::text`: the log text. */
export function logControlText(c: LogControl): string {
  switch (c.kind) {
    case "Speed":
      return `speed ${c.n}`;
    case "Pause":
      return "pause";
    case "Resume":
      return "resume";
    case "Skip":
      return `skip ${nameOf(SKIPS, c.skip)}`;
    case "Alert":
      return `alert ${nameOf(ALERTS, c.alert)} ${nameOf(LEVELS, c.level)}`;
    case "WatchAdd":
      return `watch-add ${c.id}`;
    case "WatchRemove":
      return `watch-remove ${c.id}`;
    case "Save":
      return `save ${c.n}`;
    case "Load":
      return `load ${c.n}`;
  }
}

/** A whole number from log text, or undefined (Rust `str::parse::<u32>`). */
function parseUint(s: string | undefined): number | undefined {
  return s !== undefined && /^\d+$/.test(s) ? Number(s) : undefined;
}

/** Rust `LogControl::parse`: reads the log text back. */
export function logControlParse(words: readonly string[]): LogControl | undefined {
  const [head, a, b] = words;
  const n = parseUint(a);
  switch (head) {
    case "speed":
      return words.length === 2 && n !== undefined ? { kind: "Speed", n } : undefined;
    case "pause":
      return words.length === 1 ? { kind: "Pause" } : undefined;
    case "resume":
      return words.length === 1 ? { kind: "Resume" } : undefined;
    case "skip": {
      const skip = a === undefined ? undefined : tableValue(SKIPS, a);
      return words.length === 2 && skip !== undefined ? { kind: "Skip", skip } : undefined;
    }
    case "alert": {
      const alert = a === undefined ? undefined : tableValue(ALERTS, a);
      const level = b === undefined ? undefined : tableValue(LEVELS, b);
      return words.length === 3 && alert !== undefined && level !== undefined
        ? { kind: "Alert", alert, level }
        : undefined;
    }
    case "watch-add":
      return words.length === 2 && n !== undefined ? { kind: "WatchAdd", id: n } : undefined;
    case "watch-remove":
      return words.length === 2 && n !== undefined ? { kind: "WatchRemove", id: n } : undefined;
    case "save":
      return words.length === 2 && n !== undefined ? { kind: "Save", n } : undefined;
    case "load":
      return words.length === 2 && n !== undefined ? { kind: "Load", n } : undefined;
    default:
      return undefined;
  }
}

/** The sim control for a log control, for the controls that are plain `Control`s (not Save/Load). */
export function logControlToControl(c: LogControl): Control | null {
  switch (c.kind) {
    case "Speed":
      return { kind: "SetSpeed", speed: c.n };
    case "Pause":
      return { kind: "Pause" };
    case "Resume":
      return { kind: "Resume" };
    case "Skip":
      return { kind: "SkipTo", skip: c.skip };
    case "Alert":
      return { kind: "SetAlert", alert_kind: c.alert, level: c.level };
    case "WatchAdd":
      return { kind: "WatchlistAdd", company: c.id as CompanyId };
    case "WatchRemove":
      return { kind: "WatchlistRemove", company: c.id as CompanyId };
    case "Save":
    case "Load":
      return null;
  }
}

/** splitmix64 from `state`: the next state and the draw. */
function splitmix(state: bigint): [bigint, bigint] {
  const next = (state + 0x9e37_79b9_7f4a_7c15n) & U64;
  let z = next;
  z = ((z ^ (z >> 30n)) * 0xbf58_476d_1ce4_e5b9n) & U64;
  z = ((z ^ (z >> 27n)) * 0x94d0_49bb_1331_11ebn) & U64;
  return [next, z ^ (z >> 31n)];
}

/** The scripted trader (D1042): player actions from its own splitmix64 stream. */
export class Trader {
  private state: bigint;

  constructor(seed: number) {
    this.state = BigInt(seed) ^ TRADER_SALT;
  }

  private draw(): bigint {
    const [s, z] = splitmix(this.state);
    this.state = s;
    return z;
  }

  private unit(): number {
    return Number(this.draw() >> 11n) / 2 ** 53;
  }

  private below(n: number): number {
    return Number(this.draw() % BigInt(n));
  }

  private pick<T>(xs: readonly T[]): T | undefined {
    return xs.length === 0 ? undefined : xs[this.below(xs.length)];
  }

  /** A market order (null) half the time, else a limit `lo` to `lo + 6%` of `price`. */
  private limitOr(price: number, lo: number): number | null {
    return this.below(2) === 0 ? null : price * (lo + 0.06 * this.unit());
  }

  /**
   * This frame's action, if any: only while the account is open and the run goes on, so it draws
   * nothing in a game with no player. It reads only the views, as the player does; the sim may
   * still refuse what it sends (not enough cash, say), and only what it applies is logged.
   */
  act(sim: SimApi): PlayerAction | null {
    const views = sim.views();
    const account = views.account?.data;
    if (account === undefined || !account.open || account.bankrupt) return null;
    if (this.unit() >= TRADE_CHANCE) return null;
    const quotes = views.quotes.data.rows;
    let roll = this.below(100);
    let kind = TRADE_MIX.length;
    for (let i = 0; i < TRADE_MIX.length; i++) {
      const part = TRADE_MIX[i] as number;
      if (roll < part) {
        kind = i;
        break;
      }
      roll -= part;
    }
    switch (kind) {
      case 0: {
        const q = this.pick(quotes);
        if (q === undefined) return null;
        return {
          kind: "PlaceOrder",
          venue: "Brokerage",
          instrument: stockInstrument(q.id),
          side: "Buy",
          qty: 1 + this.below(TRADE_MAX_QTY),
          limit: this.limitOr(q.last, 0.97),
          tif: this.below(2) === 0 ? "Day" : "Gtc",
        };
      }
      case 1: {
        const pos = this.pick(account.positions);
        if (pos === undefined) return null;
        return {
          kind: "PlaceOrder",
          venue: "Brokerage",
          instrument: pos.instrument,
          side: "Sell",
          qty: 1 + this.below(pos.qty),
          limit: this.limitOr(pos.mark, 0.97),
          tif: this.below(2) === 0 ? "Day" : "Gtc",
        };
      }
      case 2: {
        const o = this.pick(account.orders.filter((x) => x.status === "Open"));
        return o === undefined ? null : { kind: "CancelOrder", order: o.id };
      }
      case 3: {
        const out = this.below(2) === 0;
        const from = out ? "Brokerage" : "Exchange";
        const cash = account.cash.find((c) => c.venue === from);
        const free = cash === undefined ? 0 : cash.cash - cash.reserved;
        const amount = free * (0.05 + 0.2 * this.unit());
        return free < 1 ? null : { kind: "Transfer", from, to: out ? "Exchange" : "Brokerage", amount };
      }
      case 4: {
        const q = this.pick(quotes);
        if (q === undefined) return null;
        const followed = account.follows.some((f) => f.kind === "Company" && f.id === q.id);
        return { kind: followed ? "Unfollow" : "Follow", target: { kind: "Company", id: q.id } };
      }
      case 5: {
        const q = this.pick(quotes);
        if (q === undefined) return null;
        const up = this.below(2) === 0;
        const price = q.last * (up ? 1.02 : 0.98);
        const pause = this.below(2) === 0;
        return {
          kind: "AlertRuleAdd",
          rule: {
            target: { kind: "Company", id: q.id },
            when: { kind: up ? "PriceAbove" : "PriceBelow", price },
            pause,
          },
        };
      }
      default: {
        const n = views.notifications.data.items.length;
        return n === 0 ? null : { kind: "NotificationsRead", through: n - 1 };
      }
    }
  }
}

/** splitmix64: the scripted player's own stream. */
export class Player {
  private state: bigint;
  saves = 0;
  /** The trader that sends the player actions (D1042). */
  readonly trader: Trader;

  constructor(seed: number) {
    this.state = BigInt(seed) ^ PLAYER_SALT;
    this.trader = new Trader(seed);
  }

  next(): bigint {
    this.state = (this.state + 0x9e37_79b9_7f4a_7c15n) & U64;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58_476d_1ce4_e5b9n) & U64;
    z = ((z ^ (z >> 27n)) * 0x94d0_49bb_1331_11ebn) & U64;
    return z ^ (z >> 31n);
  }

  unit(): number {
    return Number(this.next() >> 11n) / 2 ** 53;
  }

  below(n: number): number {
    return Number(this.next() % BigInt(n));
  }

  /** This frame's controls (at most one). */
  act(sim: SimApi): LogControl | null {
    if (sim.controls().paused) {
      if (this.unit() >= PLAYER_RESUME_CHANCE) return null;
      return this.below(2) === 0 ? { kind: "Resume" } : { kind: "Speed", n: 1 + this.below(MAX_SPEED) };
    }
    if (this.unit() >= PLAYER_ACT_CHANCE) return null;
    const companies = Math.max(sim.views().company_rows.data.rows.length, 1);
    let roll = this.below(100);
    for (let i = 0; i < PLAYER_MIX.length; i++) {
      const part = PLAYER_MIX[i] as number;
      if (roll >= part) {
        roll -= part;
        continue;
      }
      switch (i) {
        case 0:
          return { kind: "Speed", n: this.below(MAX_SPEED + 1) };
        case 1:
          return { kind: "Pause" };
        case 2:
          return { kind: "Skip", skip: (SKIPS[this.below(SKIPS.length)] as readonly [SkipKind, string])[0] };
        case 3:
          // The first five kinds only, so the player's draws stay as they were before Quarter
          // start (D800).
          return {
            kind: "Alert",
            alert: (ALERTS[this.below(PLAYER_ALERTS)] as readonly [AlertKind, string])[0],
            level: (LEVELS[this.below(LEVELS.length)] as readonly [AlertLevel, string])[0],
          };
        case 4: {
          const id = this.below(companies);
          return this.below(3) === 0 ? { kind: "WatchRemove", id } : { kind: "WatchAdd", id };
        }
        default:
          this.saves += 1;
          return { kind: "Save", n: this.saves };
      }
    }
    return this.saves > 0 ? { kind: "Load", n: this.saves } : null;
  }
}

/** What a run of the frame loop saw: its controls, player actions and hash lines, in order. */
export interface RunLog {
  controls: LoggedControl[];
  /** `hash` and `end` lines, as written. */
  hashes: string[];
  /** The player actions applied (D1042); absent in a run that sent none. */
  actions?: LoggedAction[];
  /** The player's account opened at the start at this difficulty (D1042); absent for none. */
  player?: Difficulty;
}

function logAction(run: RunLog, a: LoggedAction): void {
  if (run.actions === undefined) run.actions = [];
  run.actions.push(a);
}

function runLogNew(): RunLog {
  return { controls: [], hashes: [] };
}

/** Where the controls of a run come from: the scripted player, or a log (checked as it goes). */
type Source = { kind: "Player"; player: Player } | { kind: "Log"; log: RunLog };

/** Adds a hash line; in a replay it must be the log's line at that place. */
function addHash(out: RunLog, line: string, source: Source): void {
  if (source.kind === "Log") {
    const i = out.hashes.length;
    const expected = source.log.hashes[i];
    if (expected !== line) {
      throw new Error(
        `replay differs at hash line ${i + 1}: log ${expected === undefined ? "None" : JSON.stringify(expected)}, replay ${JSON.stringify(line)}`,
      );
    }
  }
  out.hashes.push(line);
}

/** Rust `SimError`'s Display. */
export function simErrorToString(e: SimError): string {
  switch (e.kind) {
    case "BadSpeed":
      return `speed ${e.speed} is outside 0 to ${MAX_SPEED}`;
    case "BadStep":
      return `a step of ${e.hours} hours is out of range`;
    case "UnknownCompany":
      return `no company ${e.company}`;
    case "DebugOnly":
      return "Omniscient is only available in debug builds";
    case "BadFixedPause":
      return `the ${e.pause} pause cannot be switched off`;
    case "Load":
      return `load error: ${JSON.stringify(e.error)}`;
    case "Save":
      return `save error: ${JSON.stringify(e.error)}`;
  }
}

/** Opens the player's account in the sim's world at the start of a run (D1042). */
function openPlayer(sim: SimApi, difficulty: Difficulty): void {
  if (!isSoakSim(sim)) throw new Error("this sim cannot open a player (no world access)");
  const world = sim.soakWorld();
  if (world.fidelity !== "Full") throw new Error("the player opens only in a Full world (pivot 3.3)");
  playerOpen(world, difficulty);
}

function actErrorText(e: ActError): string {
  return e.kind === "NotAvailable" ? `${e.action} is not available` : e.message;
}

/**
 * The headless frame loop (see the file comment) from a new game of `seed` to 1 January of
 * 2020 + `years`, 00:00. `out` is filled as it goes, so a caller sees what the run did even when
 * it stopped on a thrown error. With `out.player` set the account opens at the start.
 */
export function runFrames(
  out: RunLog,
  factory: SimFactory,
  data: WorldData,
  seed: number,
  years: number,
  source: Source,
): void {
  const made = factory(structuredClone(data), seed);
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  const sim = made.value;
  if (out.player !== undefined) openPlayer(sim, out.player);
  const saves = new Map<number, Uint8Array>();
  const end = dateTimeMidnight(simDateYmd(dateTimeDate(sim.now()).year + years, 1, 1));
  const logged = source.kind === "Log" ? (source.log.actions ?? []) : [];
  let frame = 0;
  let step = 0;
  let nextLogged = 0;
  let nextAction = 0;
  while (sim.now() < end) {
    const controls: LogControl[] = [];
    if (source.kind === "Player") {
      const c = source.player.act(sim);
      if (c !== null) controls.push(c);
    } else {
      for (let c = source.log.controls[nextLogged]; c !== undefined && c.frame === frame; ) {
        controls.push(c.control);
        nextLogged += 1;
        c = source.log.controls[nextLogged];
      }
    }
    for (const c of controls) {
      applyLogControl(sim, c, saves, frame);
      out.controls.push({ frame, control: c });
    }
    // The frame's player actions, after its controls (D1042).
    if (source.kind === "Player") {
      const a = source.player.trader.act(sim);
      if (a !== null && sim.act(a).ok) logAction(out, { frame, action: a });
    } else {
      for (let a = logged[nextAction]; a !== undefined && a.frame === frame; a = logged[nextAction]) {
        const r = sim.act(a.action);
        if (!r.ok)
          throw new Error(`frame ${frame}: act ${JSON.stringify(a.action)}: ${actErrorText(r.error)}`);
        logAction(out, a);
        nextAction += 1;
      }
    }
    const ticks = TICKS_PER_FRAME[controlsEffectiveSpeed(sim.controls())] ?? 0;
    // A paused replay with nothing left to send would wait for ever: the log does not match.
    if (
      ticks === 0 &&
      source.kind === "Log" &&
      nextLogged === source.log.controls.length &&
      nextAction === logged.length
    ) {
      throw new Error(
        `the game is paused at ${formatDateTime(sim.now())} (frame ${frame}) and the log has no control left`,
      );
    }
    for (let t = 0; t < ticks; t++) {
      if (sim.now() >= end) break;
      step += 1;
      const notices = sim.step();
      for (const n of notices) {
        if (n.kind === "MonthDone") {
          addHash(out, `hash ${frame} ${step} ${formatMonth(n.month)} ${sim.stateHash()}`, source);
        }
      }
      if (sim.controls().paused) break;
    }
    frame += 1;
  }
  if (source.kind === "Log" && nextLogged < source.log.controls.length) {
    throw new Error(
      `the run ended at frame ${frame} with ${source.log.controls.length - nextLogged} logged controls unsent`,
    );
  }
  if (nextAction < logged.length) {
    throw new Error(
      `the run ended at frame ${frame} with ${logged.length - nextAction} logged actions unsent`,
    );
  }
  const line = `end ${frame} ${step} ${formatDateTime(sim.now())} ${sim.stateHash()} controls ${controlsDigest(sim.controls())}`;
  addHash(out, line, source);
  if (source.kind === "Log" && out.hashes.length !== source.log.hashes.length) {
    throw new Error(`replay made ${out.hashes.length} hash lines, the log has ${source.log.hashes.length}`);
  }
}

/** Applies one log control: Save and Load go through the sim's bytes, kept in `saves`. */
function applyLogControl(sim: SimApi, c: LogControl, saves: Map<number, Uint8Array>, frame: number): void {
  const fail = (e: SimError): never => {
    throw new Error(`frame ${frame}: ${logControlText(c)}: ${simErrorToString(e)}`);
  };
  if (c.kind === "Save") {
    saves.set(c.n, sim.saveBytes());
    return;
  }
  if (c.kind === "Load") {
    const bytes = saves.get(c.n);
    if (bytes === undefined) throw new Error(`frame ${frame}: ${logControlText(c)}: no save ${c.n}`);
    const r = sim.loadBytes(bytes);
    if (!r.ok) fail(r.error);
    return;
  }
  const control = logControlToControl(c) as Control;
  const r = sim.apply(control);
  if (!r.ok) fail(r.error);
}

/**
 * A 16-hex-digit digest of the controls (FNV-1a 64 of their canonical JSON: fixed field order,
 * and the watchlist sorted, so the same controls always give the same digest).
 */
export function controlsDigest(c: Controls): string {
  const canonical = JSON.stringify({
    speed: c.speed,
    paused: c.paused,
    skip: c.skip,
    alerts: c.alerts,
    omniscient: c.omniscient,
    watchlist: [...c.watchlist].sort((a, b) => a - b),
  });
  let h = FNV_OFFSET;
  for (const b of new TextEncoder().encode(canonical)) {
    h = ((h ^ BigInt(b)) * FNV_PRIME) & U64;
  }
  return h.toString(16).padStart(16, "0");
}

/** The log text of a run. */
export function logText(seed: number, years: number, run: RunLog): string {
  let s = `version ${LOG_VERSION}\nseed ${seed}\nyears ${years}\n`;
  if (run.player !== undefined) s += `player ${run.player}\n`;
  // Controls, actions and hashes in run order: a control or action sent in frame f comes before
  // the hashes of that frame's ticks, and a frame's controls before its actions.
  const frameOf = (line: string): number => {
    const f = parseUint(line.split(" ")[1]);
    return f === undefined ? Number.MAX_SAFE_INTEGER : f;
  };
  const sent: { frame: number; line: string }[] = [
    ...run.controls.map((c) => ({ frame: c.frame, line: `control ${c.frame} ${logControlText(c.control)}` })),
    ...(run.actions ?? []).map((a) => ({
      frame: a.frame,
      line: `act ${a.frame} ${JSON.stringify(a.action)}`,
    })),
  ];
  // A stable sort by frame keeps a frame's controls ahead of its actions.
  sent.sort((a, b) => a.frame - b.frame);
  let h = 0;
  for (const c of sent) {
    while (h < run.hashes.length && frameOf(run.hashes[h] as string) < c.frame) {
      s += `${run.hashes[h]}\n`;
      h += 1;
    }
    s += `${c.line}\n`;
  }
  for (; h < run.hashes.length; h++) s += `${run.hashes[h]}\n`;
  return s;
}

/** An `act` line's action: a JSON object with a `kind`, or undefined. The sim checks the rest. */
function parseAction(text: string): PlayerAction | undefined {
  try {
    const a: unknown = JSON.parse(text);
    return typeof a === "object" && a !== null && "kind" in a ? (a as PlayerAction) : undefined;
  } catch {
    return undefined;
  }
}

/** A parsed log. */
export interface Log {
  seed: number;
  years: number;
  run: RunLog;
}

/** Reads a log's text. */
export function parseLog(text: string): Log {
  let seed: number | undefined;
  let years: number | undefined;
  let version: number | undefined;
  const run = runLogNew();
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  lines.forEach((line, i) => {
    const bad = (): never => {
      throw new Error(`log line ${i + 1}: ${JSON.stringify(line)}`);
    };
    const words = line.split(/\s+/).filter((w) => w !== "");
    const num = (s: string | undefined): number => parseUint(s) ?? bad();
    switch (words[0]) {
      case undefined:
        break;
      case "version":
        version = num(words[1]);
        break;
      case "seed":
        seed = num(words[1]);
        break;
      case "years":
        years = num(words[1]);
        break;
      case "control": {
        const control = logControlParse(words.slice(2)) ?? bad();
        run.controls.push({ frame: num(words[1]), control });
        break;
      }
      case "player": {
        const d = (words.length === 2 ? DIFFICULTY_VALUES.find((v) => v === words[1]) : undefined) ?? bad();
        run.player = d;
        break;
      }
      case "act": {
        const action = parseAction(words.slice(2).join(" ")) ?? bad();
        logAction(run, { frame: num(words[1]), action });
        break;
      }
      case "hash":
      case "end":
        run.hashes.push(words.join(" "));
        break;
      default:
        bad();
    }
  });
  if (version !== LOG_VERSION) {
    throw new Error(
      `log version ${version === undefined ? "None" : `Some(${version})`}, this build reads ${LOG_VERSION}`,
    );
  }
  if (seed === undefined) throw new Error("the log has no seed");
  if (years === undefined || years === 0) throw new Error("the log has no years");
  return { seed, years, run };
}

function summary(run: RunLog): string {
  const acts = run.actions === undefined ? "" : `${run.actions.length} actions, `;
  return `${run.controls.length} controls, ${acts}${run.hashes.length} hash lines, ${run.hashes.at(-1) ?? ""}`;
}

/** How `record` plays (D1042). */
export interface RecordOptions {
  /** Open the player's account at the start at this difficulty, and trade (a Full world only). */
  player?: Difficulty;
}

/**
 * `record --years N --seed S --out LOG`: plays the scripted player and writes the log. With
 * `opts.player` it opens the account and the scripted trader sends player actions too.
 */
export function record(
  factory: SimFactory,
  data: WorldData,
  seed: number,
  years: number,
  out: string,
  opts: RecordOptions = {},
): string {
  const run = runLogNew();
  if (opts.player !== undefined) run.player = opts.player;
  runFrames(run, factory, data, seed, years, { kind: "Player", player: new Player(seed) });
  writeFileSync(out, logText(seed, years, run));
  return summary(run);
}

/**
 * `replay LOG`: replays the log's controls and checks every hash line as it is made. The error
 * names the first line that differs.
 */
export function replay(factory: SimFactory, data: WorldData, logPath: string): string {
  const log = parseLog(readFileSync(logPath, "utf8"));
  const run = runLogNew();
  if (log.run.player !== undefined) run.player = log.run.player;
  runFrames(run, factory, data, log.seed, log.years, { kind: "Log", log: log.run });
  return summary(run);
}
