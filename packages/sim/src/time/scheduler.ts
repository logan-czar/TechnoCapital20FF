// The scheduler (spec 4; build-plan M1.3). One tick is one hour. Each tick advances the clock,
// then visits the named `Slot`s in spec 4 order (hourly, daily, monthly, quarterly, yearly),
// running every slot that is due at the new time. Each job reads the state the one before left.
// Ported from crates/sim/src/time/scheduler.rs.
//
// The order of slots is fixed here, now, for every milestone. A later milestone fills a slot by
// calling `schedulerRegister` from its own module (wired in jobs.ts's `registerJobs`), never by
// editing this file. A due slot with no job still runs (and shows in the trace), so the golden
// job-order trace locks the order before the jobs exist.
//
// Jobs follow the pure step contract (types/world.ts docs): `(world: World, ctx: JobCtx) => void`,
// with all randomness from `ctx.draws`. Monthly steps can therefore be re-run on a cloned World
// with NoNoise draws through `schedulerRunSlots` (spec 5.16). The scheduler itself reads no wall
// clock and draws nothing.

import type { DateTime, SimDate } from "../types/calendar.ts";
import {
  type Controls,
  PLAN_LOCK_DAY,
  PRICE_MOVE_HOUR,
  REACTION_FIRST_DAY,
  REACTION_LAST_DAY,
  RELEASE_DAY,
} from "../types/control.ts";
import type { DrawSource } from "../types/draws.ts";
import {
  ALERT_KIND_INDEX,
  type AlertKind,
  type AlertPayload,
  type Notice,
  type PauseReason,
} from "../types/notice.ts";
import type { World } from "../types/world.ts";
import {
  dateTimeDate,
  dateTimeHour,
  dateTimeNext,
  monthPrev,
  quarterPrev,
  simDateAddDays,
  simDateIsQuarterFirstMonth,
  simDateMonthOf,
  simDateQuarter,
} from "./calendar.ts";
import { isRecapDay } from "./quarter.ts";

/** A scheduled job (the pure step contract). */
export type JobFn = (world: World, ctx: JobCtx) => void;

// ---------------------------------------------------------------- TickFacts

/** Calendar facts about the tick being run, worked out once per tick. */
export interface TickFacts {
  readonly now: DateTime;
  readonly date: SimDate;
  /** 0 to 23. */
  readonly hour: number;
}

export function tickFactsNew(now: DateTime): TickFacts {
  return { now, date: dateTimeDate(now), hour: dateTimeHour(now) };
}

/** 00:00: the daily, monthly, quarterly and yearly jobs may run (spec 4). */
export function tickFactsIsMidnight(f: TickFacts): boolean {
  return f.hour === 0;
}

/** 00:00 on the 1st: the monthly job (spec 4.3). */
export function tickFactsIsMonthStart(f: TickFacts): boolean {
  return tickFactsIsMidnight(f) && f.date.day === 1;
}

/**
 * 00:00 on 1 January, April, July or October: the quarterly draw (4.3 step 1) and the close
 * (4.4).
 */
export function tickFactsIsQuarterStart(f: TickFacts): boolean {
  return tickFactsIsMonthStart(f) && simDateIsQuarterFirstMonth(f.date);
}

/** 00:00 on 1 January: the yearly job (spec 4.5). */
export function tickFactsIsYearStart(f: TickFacts): boolean {
  return tickFactsIsMonthStart(f) && f.date.month === 1;
}

/** 00:00 on the 2nd of a quarter's first month: the release (spec 4.4 row 1). */
export function tickFactsIsReleaseTick(f: TickFacts): boolean {
  return tickFactsIsMidnight(f) && f.date.day === RELEASE_DAY && simDateIsQuarterFirstMonth(f.date);
}

/** 01:00 on a release day: the price move and earnings jump (spec 4.1 step 3, 4.4). */
export function tickFactsIsPriceMoveTick(f: TickFacts): boolean {
  return f.hour === PRICE_MOVE_HOUR && f.date.day === RELEASE_DAY && simDateIsQuarterFirstMonth(f.date);
}

/** 00:00 on the 9th of a quarter's first month: the plan lock (spec 4.4 row 3). */
export function tickFactsIsLockTick(f: TickFacts): boolean {
  return tickFactsIsMidnight(f) && f.date.day === PLAN_LOCK_DAY && simDateIsQuarterFirstMonth(f.date);
}

/** 00:00 on the first day of the pre-quarter-end week: the recap (spec 4.4 row 5). */
export function tickFactsIsRecapTick(f: TickFacts): boolean {
  return tickFactsIsMidnight(f) && isRecapDay(f.date);
}

/** 1 January is a market holiday (spec 4.1 step 2, 3.1.0). */
export function tickFactsMarketsClosed(f: TickFacts): boolean {
  return f.date.month === 1 && f.date.day === 1;
}

/** 00:00 on the 3rd to the 8th of a release month (spec 4.2 step 3). */
export function tickFactsIsReactionWeekDay(f: TickFacts): boolean {
  return (
    tickFactsIsMidnight(f) &&
    simDateIsQuarterFirstMonth(f.date) &&
    f.date.day >= REACTION_FIRST_DAY &&
    f.date.day <= REACTION_LAST_DAY
  );
}

// ---------------------------------------------------------------- Group and Slot

/** When a slot's group runs. */
export type Group =
  | "Hourly"
  | "PriceMove"
  | "Daily"
  | "Monthly"
  | "Close"
  | "Release"
  | "PlanLock"
  | "Recap"
  | "Yearly";

/** Rust `Group::label`: the trace label. */
export const GROUP_LABEL: Readonly<Record<Group, string>> = Object.freeze({
  Hourly: "hourly",
  PriceMove: "quarterly.price_move",
  Daily: "daily",
  Monthly: "monthly",
  Close: "quarterly.close",
  Release: "quarterly.release",
  PlanLock: "quarterly.plan_lock",
  Recap: "quarterly.recap",
  Yearly: "yearly",
});

// The named job slots, in the order a tick visits them (spec 4): [slot, group, step label].
// Rust's `slots!` macro table; the position is `Slot::index`.
const SLOT_TABLE = Object.freeze([
  // 4.1 Hourly (every tick).
  // 4.1 step 1: the clock advances (done by the scheduler before any slot); controls apply when
  // sent (D5).
  ["AdvanceClock", "Hourly", "1.advance_clock"],
  // 4.1 step 2: share prices of listed companies (5.14); not on 1 January (3.1.0) and frozen on
  // the release tick (4.4, 21.2).
  ["SharePrices", "Hourly", "2.share_prices"],
  // 4.1 step 3 = the 4.4 price move, 01:00 on release days, in the 4.4 order.
  // Full fair value recalculation (5.13).
  ["PriceMoveFairValue", "PriceMove", "1.full_fair_value"],
  // Earnings jump x1.5 (5.15).
  ["PriceMoveEarningsJump", "PriceMove", "2.earnings_jump"],
  // Buzz (3.10, 5.15).
  ["PriceMoveBuzz", "PriceMove", "3.buzz"],
  // Rating review (5.12).
  ["PriceMoveRatingReview", "PriceMove", "4.rating_review"],
  // Credit line review (5.12).
  ["PriceMoveCreditLineReview", "PriceMove", "5.credit_line_review"],
  // Result headlines (5.18).
  ["PriceMoveResultHeadlines", "PriceMove", "6.result_headlines"],
  // 4.1 step 4: alerts due this hour; auto-pause (D6).
  ["Alerts", "Hourly", "4.alerts"],

  // 4.2 Daily (00:00).
  // Daily price bar closes; buzz decays 25%.
  ["DailyPriceBars", "Daily", "1.price_bars"],
  // Fair value refresh (5.13).
  ["DailyFairValue", "Daily", "2.fair_value"],
  // Reaction week reversion, the 3rd to the 8th of a release month (21.3.1).
  ["DailyReactionWeek", "Daily", "3.reaction_week"],
  // Projection ranges (5.16).
  ["DailyProjections", "Daily", "4.projections"],
  // News: post the day's headlines (5.18).
  ["DailyNews", "Daily", "5.news"],
  // Zone exchange confidence (5.1.2).
  ["DailyZoneConfidence", "Daily", "6.zone_confidence"],

  // 4.3 Monthly (00:00 on the 1st). Step 1 only on 1 Jan, Apr, Jul and Oct, in its order.
  // Scripted AI events due today (5.1.1).
  ["MonthlyAiEvents", "Monthly", "1a.ai_events"],
  // Every industry's lt (5.1.1).
  ["MonthlyIndustryLt", "Monthly", "1b.industry_lt"],
  // The global cycle advances one quarter (5.1).
  ["MonthlyCycle", "Monthly", "1c.cycle"],
  // Every zone's effective credit spread (5.1.2).
  ["MonthlyZoneSpreads", "Monthly", "1d.zone_spreads"],
  // Every industry draws its q_growth (5.1).
  ["MonthlyGrowthDraws", "Monthly", "1e.growth_draws"],
  // Demand, rate term, phase labels (5.1).
  ["MonthlyDemand", "Monthly", "2.demand"],
  // Fringe pools (5.3).
  ["MonthlyFringe", "Monthly", "3.fringe"],
  // Labor units, seats, stations (5.10).
  ["MonthlyLaborSeats", "Monthly", "4.labor_seats"],
  // Productive compute and PC bonus (5.8).
  ["MonthlyCompute", "Monthly", "5.compute"],
  // Supply, S and M (5.2).
  ["MonthlySupply", "Monthly", "6.supply"],
  // Unit revenue (5.4).
  ["MonthlyRevenue", "Monthly", "7.revenue"],
  // Data (5.9).
  ["MonthlyData", "Monthly", "8.data"],
  // Expenses (5.5, 5.11).
  ["MonthlyExpenses", "Monthly", "9.expenses"],
  // Productivity (5.6).
  ["MonthlyProductivity", "Monthly", "10.productivity"],
  // Asset decay, growth plan, ramping, new seats' characters (5.10, 3.7.1).
  ["MonthlyAssets", "Monthly", "11.assets"],
  // Interest, line fees, interest on cash (5.12).
  ["MonthlyInterest", "Monthly", "12.interest"],
  // Cash settles; line auto-draw or repay; distress and bankruptcy (5.12).
  ["MonthlyCashSettle", "Monthly", "13.cash_settle"],
  // Post the monthly ledger; tax accrues (5.11).
  ["MonthlyLedger", "Monthly", "14.ledger"],

  // 4.4 Quarterly (exact days).
  // Close and compile, after the monthly job: build the quarter's statements (unpublished).
  ["CloseStatements", "Close", "1.statements"],
  // Pay the quarter's tax (5.11).
  ["CloseTax", "Close", "2.tax"],
  // Tag result types (21.3.2).
  ["CloseResultTags", "Close", "3.result_tags"],
  // Release: statements published to Filings.
  ["ReleasePublish", "Release", "1.publish"],
  // Plan lock: fixed startup events due (5.19.2).
  ["LockFixedStartupEvents", "PlanLock", "1.fixed_startup_events"],
  // Random startup events (5.19.1).
  ["LockRandomStartupEvents", "PlanLock", "2.random_startup_events"],
  // IPO board votes and listings (5.20.1).
  ["LockIpoVotes", "PlanLock", "3.ipo_votes_and_listings"],
  // Every company's Lite AI plan in one batch (6).
  ["LockAiPlans", "PlanLock", "4.ai_plans"],
  // Consensus set (5.16).
  ["LockConsensus", "PlanLock", "5.consensus"],
  // Pre-quarter-end week: the quarterly recap is built (8, 21.6.2).
  ["RecapBuild", "Recap", "1.build"],

  // 4.5 Yearly (1 January 00:00, after the Q4 close).
  // Annual statements (sum of four quarters).
  ["YearlyAnnualStatements", "Yearly", "1.annual_statements"],
  // Archive: 20 quarters of statements, 10 years of daily bars.
  ["YearlyArchive", "Yearly", "2.archive"],
] as const satisfies readonly (readonly [string, Group, string])[]);
for (const row of SLOT_TABLE) Object.freeze(row);

/** The named job slots, in the order a tick visits them (spec 4). */
export type Slot = (typeof SLOT_TABLE)[number][0];

/** Rust `Slot::ALL`: every slot, in run order. */
export const SLOT_VALUES: readonly Slot[] = Object.freeze(SLOT_TABLE.map((r) => r[0]));

/** Rust `Slot::COUNT`: number of slots. */
export const SLOT_COUNT = SLOT_VALUES.length;

const SLOT_INDEX = new Map<Slot, number>(SLOT_VALUES.map((s, i) => [s, i]));

function slotRow(slot: Slot): (typeof SLOT_TABLE)[number] {
  return SLOT_TABLE[slotIndex(slot)]!;
}

/** Rust `Slot::index`: the position in run order. */
export function slotIndex(slot: Slot): number {
  const i = SLOT_INDEX.get(slot);
  if (i === undefined) throw new RangeError(`unknown slot ${slot}`);
  return i;
}

export function slotGroup(slot: Slot): Group {
  return slotRow(slot)[1];
}

/** The step label within the group, numbered as in the spec. */
export function slotStep(slot: Slot): string {
  return slotRow(slot)[2];
}

/** `group.step`, for messages. */
export function slotName(slot: Slot): string {
  return `${GROUP_LABEL[slotGroup(slot)]}.${slotStep(slot)}`;
}

/** Whether this slot runs on the tick described by `f` (spec 4). */
export function slotIsDue(slot: Slot, f: TickFacts): boolean {
  switch (slotGroup(slot)) {
    case "Hourly":
      return slot === "SharePrices" ? !tickFactsMarketsClosed(f) && !tickFactsIsReleaseTick(f) : true;
    case "PriceMove":
      return tickFactsIsPriceMoveTick(f);
    case "Daily":
      return slot === "DailyReactionWeek" ? tickFactsIsReactionWeekDay(f) : tickFactsIsMidnight(f);
    case "Monthly":
      switch (slot) {
        case "MonthlyAiEvents":
        case "MonthlyIndustryLt":
        case "MonthlyCycle":
        case "MonthlyZoneSpreads":
        case "MonthlyGrowthDraws":
          return tickFactsIsQuarterStart(f);
        default:
          return tickFactsIsMonthStart(f);
      }
    case "Close":
      return tickFactsIsQuarterStart(f);
    case "Release":
      return tickFactsIsReleaseTick(f);
    case "PlanLock":
      return tickFactsIsLockTick(f);
    case "Recap":
      return tickFactsIsRecapTick(f);
    case "Yearly":
      return tickFactsIsYearStart(f);
  }
}

/** The spec 9.3 notice posted once this slot has run, if it ends a job (D10). */
function slotNoticeAfter(slot: Slot, f: TickFacts): Notice | null {
  switch (slot) {
    case "DailyZoneConfidence":
      return { kind: "DayDone", date: simDateAddDays(f.date, -1) };
    case "MonthlyLedger":
      return { kind: "MonthDone", month: monthPrev(simDateMonthOf(f.date)) };
    case "ReleasePublish":
      return { kind: "EarningsReleased", quarter: quarterPrev(simDateQuarter(f.date)) };
    case "LockConsensus":
      return { kind: "PlanLocked", quarter: simDateQuarter(f.date) };
    default:
      return null;
  }
}

// ---------------------------------------------------------------- JobCtx

/**
 * What a job may touch besides the World (the pure step contract).
 *
 * The player's controls ride along read-only and private: jobs cannot read them, but
 * `jobCtxRaiseAlert` uses them to apply alert levels, the SkipTo rule and the watchlist filter.
 * So a job raises every alert it sees (for example a bankruptcy for every company) and stays a
 * pure function of the world. The notice list, the controls and the pause request are `#private`
 * fields, as Rust keeps them private; jobs use only `facts`, `draws`, `jobCtxNotice` and
 * `jobCtxRaiseAlert`. Build one with `jobCtxNew` or `jobCtxDetached`.
 */
export class JobCtx {
  /** The tick being run. */
  readonly facts: TickFacts;
  /** Every random number comes from here. */
  readonly draws: DrawSource;
  readonly #notices: Notice[];
  /** null for detached runs (projections): every alert is off. */
  readonly #controls: Controls | null;
  #pause: PauseReason | null = null;

  private constructor(facts: TickFacts, draws: DrawSource, notices: Notice[], controls: Controls | null) {
    this.facts = facts;
    this.draws = draws;
    this.#notices = notices;
    this.#controls = controls;
  }

  /** Rust `JobCtx::new`. Use `jobCtxNew`. */
  static new(facts: TickFacts, draws: DrawSource, notices: Notice[], controls: Controls): JobCtx {
    return new JobCtx(facts, draws, notices, controls);
  }

  /** Rust `JobCtx::detached`. Use `jobCtxDetached`. */
  static detached(facts: TickFacts, draws: DrawSource, notices: Notice[]): JobCtx {
    return new JobCtx(facts, draws, notices, null);
  }

  /** Rust `JobCtx::notice`. Use `jobCtxNotice`. */
  notice(notice: Notice): void {
    this.#notices.push(notice);
  }

  /** Rust `JobCtx::raise_alert`. Use `jobCtxRaiseAlert`. */
  raiseAlert(kind: AlertKind, payload: AlertPayload): void {
    const controls = this.#controls;
    if (controls === null) return;
    if (kind === "BankruptcyInWatchlist") {
      if (payload.kind !== "Company") throw new Error("BankruptcyInWatchlist needs a company payload");
      if (!controls.watchlist.has(payload.company)) return;
    }
    // CONTRACT: Rust `AlertLevels::get` (world/notice.rs) has no TS helper; indexed directly.
    const level = controls.alerts[ALERT_KIND_INDEX[kind]];
    if (level === undefined) throw new Error(`no alert level for ${kind}`);
    if (level === "Off") return;
    this.#notices.push({ kind: "Alert", alert_kind: kind, level, payload });
    const skipping = controls.skip !== null;
    if (level === "Pause" && !skipping && this.#pause === null) {
      this.#pause = { kind: "Alert", alert_kind: kind };
    }
  }

  /** Rust `JobCtx::pause_request`. Use `jobCtxPauseRequest`. */
  pauseRequest(): PauseReason | null {
    return this.#pause;
  }
}

/** Rust `JobCtx::new`: a context for a game tick, with the player's controls. */
export function jobCtxNew(
  facts: TickFacts,
  draws: DrawSource,
  notices: Notice[],
  controls: Controls,
): JobCtx {
  return JobCtx.new(facts, draws, notices, controls);
}

/**
 * Rust `JobCtx::detached`: a context for a run nobody watches, such as the spec 5.16 projections
 * on a cloned world: alerts post nothing and never pause.
 */
export function jobCtxDetached(facts: TickFacts, draws: DrawSource, notices: Notice[]): JobCtx {
  return JobCtx.detached(facts, draws, notices);
}

/** Posts a notice (spec 9.3). */
export function jobCtxNotice(ctx: JobCtx, notice: Notice): void {
  ctx.notice(notice);
}

/**
 * Fires an alert at its set level: Off posts nothing; Pause also pauses after this tick, except
 * during a SkipTo (spec 4.1 step 4, 8; D6). Bankruptcy in watchlist fires only for a company on
 * the watchlist (spec 8), so jobs raise it for every bankruptcy.
 */
export function jobCtxRaiseAlert(ctx: JobCtx, kind: AlertKind, payload: AlertPayload): void {
  ctx.raiseAlert(kind, payload);
}

/** The pause an alert asked for this tick, if any. */
export function jobCtxPauseRequest(ctx: JobCtx): PauseReason | null {
  return ctx.pauseRequest();
}

// ---------------------------------------------------------------- TickObserver

/** A part of a tick a `TickObserver` is told about (build-plan M10.6 profiling). */
export type TickPart =
  /** A due slot, all its jobs. */
  | { kind: "Slot"; slot: Slot }
  /** One job of a slot, by its registered name. */
  | { kind: "Job"; slot: Slot; name: string }
  /** The view refresh after the tick's jobs (spec 9.4). */
  | { kind: "Views" }
  /** One view rebuilt in that refresh, by its `SimViews` field name. */
  | { kind: "View"; name: string };

/**
 * Watches the parts of a tick as they run, for profiling (build-plan M10.6, D400). It is told only
 * which part starts and finishes, never sees the world or the draws, so it cannot change a run: a
 * step with an observer gives the same world, draws and notices as one without. Any wall clock
 * lives in the observer (headless `run --profile`), never in sim logic (build-plan 4.3).
 */
export interface TickObserver {
  started(part: TickPart): void;
  finished(part: TickPart): void;
}

// ---------------------------------------------------------------- Scheduler

/** One registered job: its name and function. */
export type NamedJob = readonly [name: string, job: JobFn];

/**
 * The registered jobs of every slot. Rust's `&mut self` forbids registering while a tick runs;
 * here `schedulerRegister` throws while `schedulerRunTick*` or `schedulerRunSlots` is running.
 */
export interface Scheduler {
  /** Indexed by `slotIndex`. Read through `schedulerJobs`; add through `schedulerRegister`. */
  readonly jobs: NamedJob[][];
  /** True while a tick or `schedulerRunSlots` runs. */
  running: boolean;
}

/** Rust `Scheduler::new`: a scheduler with every slot empty. */
export function schedulerNew(): Scheduler {
  return { jobs: SLOT_VALUES.map(() => []), running: false };
}

/** Rust `Clone for Scheduler`. */
export function schedulerClone(s: Scheduler): Scheduler {
  return { jobs: s.jobs.map((js) => js.slice()), running: false };
}

/** Adds `job` to `slot`. Jobs in one slot run in registration order. */
export function schedulerRegister(s: Scheduler, slot: Slot, name: string, job: JobFn): void {
  if (s.running) throw new Error(`cannot register ${name} while the scheduler is running`);
  s.jobs[slotIndex(slot)]!.push(Object.freeze([name, job] as const));
}

/** The jobs registered in `slot`, with their names (a frozen copy). */
export function schedulerJobs(s: Scheduler, slot: Slot): readonly NamedJob[] {
  return Object.freeze(s.jobs[slotIndex(slot)]!.slice());
}

/** Runs `f` with `s` marked running, so nothing registers meanwhile. */
function whileRunning<T>(s: Scheduler, f: () => T): T {
  if (s.running) throw new Error("the scheduler is already running");
  s.running = true;
  try {
    return f();
  } finally {
    s.running = false;
  }
}

/**
 * Runs one tick: advances `world.clock` one hour, then every due slot in order (spec 4). Pushes
 * each visited slot to `trace` when given.
 */
export function schedulerRunTick(
  s: Scheduler,
  world: World,
  ctxDraws: DrawSource,
  notices: Notice[],
  controls: Controls,
  trace: Slot[] | null,
): PauseReason | null {
  return schedulerRunTickObserved(s, world, ctxDraws, notices, controls, trace, null);
}

/**
 * `schedulerRunTick`, telling `observer` when each due slot and each of its jobs starts and
 * finishes (D400). The tick itself is the same with or without one.
 */
export function schedulerRunTickObserved(
  s: Scheduler,
  world: World,
  ctxDraws: DrawSource,
  notices: Notice[],
  controls: Controls,
  trace: Slot[] | null,
  observer: TickObserver | null,
): PauseReason | null {
  return whileRunning(s, () => runTick(s, world, ctxDraws, notices, controls, trace, observer));
}

function runTick(
  s: Scheduler,
  world: World,
  ctxDraws: DrawSource,
  notices: Notice[],
  controls: Controls,
  trace: Slot[] | null,
  observer: TickObserver | null,
): PauseReason | null {
  // 4.1 step 1: advance the clock. Jobs then run for the new time, so the first tick is
  // 2020-01-01 01:00; the 00:00 start state is the load (spec 7.3, D12).
  world.clock = dateTimeNext(world.clock);
  const facts = tickFactsNew(world.clock);
  const ctx = jobCtxNew(facts, ctxDraws, notices, controls);
  for (const slot of SLOT_VALUES) {
    if (!slotIsDue(slot, facts)) continue;
    trace?.push(slot);
    const jobs = schedulerJobs(s, slot);
    if (observer === null) {
      for (const [, job] of jobs) job(world, ctx);
    } else {
      observer.started({ kind: "Slot", slot });
      for (const [name, job] of jobs) {
        observer.started({ kind: "Job", slot, name });
        job(world, ctx);
        observer.finished({ kind: "Job", slot, name });
      }
      observer.finished({ kind: "Slot", slot });
    }
    const n = slotNoticeAfter(slot, facts);
    if (n !== null) jobCtxNotice(ctx, n);
  }
  const pause = jobCtxPauseRequest(ctx);
  notices.push({ kind: "TickDone", time: facts.now });
  return pause;
}

/**
 * Runs the given slots once, in the order given, on the tick `ctx.facts` describes, without
 * advancing the clock or checking due rules. For re-running steps on a cloned world, such as the
 * monthly economy for the spec 5.16 projections.
 */
export function schedulerRunSlots(s: Scheduler, slots: readonly Slot[], world: World, ctx: JobCtx): void {
  whileRunning(s, () => {
    for (const slot of slots) {
      for (const [, job] of schedulerJobs(s, slot)) job(world, ctx);
    }
  });
}
