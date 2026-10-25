// Not in the Rust files: the branches of JobCtx::raise_alert (scheduler.rs), Scheduler::run_slots,
// the observer path of run_tick_observed, and the guards the TS port adds (frozen tables,
// no registering while a tick runs).

import { describe, expect, it } from "vitest";
import { dateTimeMidnight, simDateYmd } from "../../src/time/calendar.ts";
import { controlsDefault } from "../../src/time/control.ts";
import {
  GROUP_LABEL,
  type JobCtx,
  type JobFn,
  jobCtxDetached,
  jobCtxNew,
  jobCtxNotice,
  jobCtxPauseRequest,
  jobCtxRaiseAlert,
  SLOT_VALUES,
  schedulerJobs,
  schedulerNew,
  schedulerRegister,
  schedulerRunSlots,
  schedulerRunTick,
  schedulerRunTickObserved,
  type TickPart,
  tickFactsNew,
} from "../../src/time/scheduler.ts";
import type { Controls } from "../../src/types/control.ts";
import type { CompanyId } from "../../src/types/ids.ts";
import { ALERT_KIND_INDEX, type AlertKind, type AlertLevel, type Notice } from "../../src/types/notice.ts";
import { clockWorld, NO_DRAWS } from "./harness.ts";

const FACTS = tickFactsNew(dateTimeMidnight(simDateYmd(2020, 1, 2)));
const Q = { kind: "Quarter", quarter: { year: 2020, q: 1 } } as const;

function withLevel(kind: AlertKind, level: AlertLevel): Controls {
  const c = controlsDefault();
  c.alerts[ALERT_KIND_INDEX[kind]] = level;
  return c;
}

describe("jobCtxRaiseAlert", () => {
  it("Off posts nothing and does not pause", () => {
    const notices: Notice[] = [];
    const ctx = jobCtxNew(FACTS, NO_DRAWS, notices, withLevel("EarningsDay", "Off"));
    jobCtxRaiseAlert(ctx, "EarningsDay", Q);
    expect(notices).toEqual([]);
    expect(jobCtxPauseRequest(ctx)).toBeNull();
  });

  it("Notify and Log post the alert without pausing", () => {
    for (const level of ["Notify", "Log"] as const) {
      const notices: Notice[] = [];
      const ctx = jobCtxNew(FACTS, NO_DRAWS, notices, withLevel("PlanLock", level));
      jobCtxRaiseAlert(ctx, "PlanLock", Q);
      expect(notices).toEqual([{ kind: "Alert", alert_kind: "PlanLock", level, payload: Q }]);
      expect(jobCtxPauseRequest(ctx)).toBeNull();
    }
  });

  it("Pause asks for a pause; the first one wins", () => {
    const notices: Notice[] = [];
    const ctx = jobCtxNew(FACTS, NO_DRAWS, notices, controlsDefault());
    jobCtxRaiseAlert(ctx, "PlanLock", Q);
    jobCtxRaiseAlert(ctx, "EarningsDay", Q);
    expect(notices.length).toBe(2);
    expect(jobCtxPauseRequest(ctx)).toEqual({ kind: "Alert", alert_kind: "PlanLock" });
  });

  it("a SkipTo posts the alert but never pauses (D6)", () => {
    const notices: Notice[] = [];
    const c = controlsDefault();
    c.skip = { kind: "NextLock", target: 1000 };
    const ctx = jobCtxNew(FACTS, NO_DRAWS, notices, c);
    jobCtxRaiseAlert(ctx, "EarningsDay", Q);
    expect(notices.length).toBe(1);
    expect(jobCtxPauseRequest(ctx)).toBeNull();
  });

  it("a detached context posts nothing and never pauses", () => {
    const notices: Notice[] = [];
    const ctx = jobCtxDetached(FACTS, NO_DRAWS, notices);
    jobCtxRaiseAlert(ctx, "EarningsDay", Q);
    jobCtxRaiseAlert(ctx, "BankruptcyInWatchlist", { kind: "Company", company: 3 as CompanyId });
    expect(notices).toEqual([]);
    expect(jobCtxPauseRequest(ctx)).toBeNull();
    jobCtxNotice(ctx, { kind: "CompanyBorn", company: 1 as CompanyId });
    expect(notices).toEqual([{ kind: "CompanyBorn", company: 1 }]);
  });

  it("filters watchlist bankruptcies and needs a company payload", () => {
    const notices: Notice[] = [];
    const c = controlsDefault();
    c.watchlist.add(4 as CompanyId);
    const ctx = jobCtxNew(FACTS, NO_DRAWS, notices, c);
    jobCtxRaiseAlert(ctx, "BankruptcyInWatchlist", { kind: "Company", company: 3 as CompanyId });
    jobCtxRaiseAlert(ctx, "BankruptcyInWatchlist", { kind: "Company", company: 4 as CompanyId });
    expect(notices).toEqual([
      {
        kind: "Alert",
        alert_kind: "BankruptcyInWatchlist",
        level: "Notify",
        payload: { kind: "Company", company: 4 },
      },
    ]);
    expect(() => jobCtxRaiseAlert(ctx, "BankruptcyInWatchlist", { kind: "None" })).toThrow();
  });

  it("keeps the controls, notices and pause private", () => {
    const ctx = jobCtxNew(FACTS, NO_DRAWS, [], controlsDefault());
    expect(Object.keys(ctx).sort()).toEqual(["draws", "facts"]);
  });
});

describe("scheduler", () => {
  it("runSlots runs the given slots in the given order, with no due check or clock step", () => {
    const s = schedulerNew();
    const ran: string[] = [];
    const job =
      (name: string): JobFn =>
      (_w, ctx) => {
        ran.push(`${name}@${ctx.facts.now}`);
      };
    schedulerRegister(s, "MonthlyDemand", "a", job("demand"));
    schedulerRegister(s, "MonthlySupply", "b", job("supply1"));
    schedulerRegister(s, "MonthlySupply", "c", job("supply2"));
    const world = clockWorld();
    const ctx = jobCtxDetached(FACTS, NO_DRAWS, []);
    schedulerRunSlots(s, ["MonthlySupply", "MonthlyDemand"], world, ctx);
    expect(ran).toEqual([`supply1@${FACTS.now}`, `supply2@${FACTS.now}`, `demand@${FACTS.now}`]);
    expect(world.clock).toBe(0);
  });

  it("tells the observer each due slot and job, and the tick is the same without one", () => {
    const build = (log: string[]) => {
      const s = schedulerNew();
      schedulerRegister(s, "Alerts", "one", () => log.push("one"));
      schedulerRegister(s, "Alerts", "two", (_w: unknown, ctx: JobCtx) =>
        jobCtxRaiseAlert(ctx, "PlanLock", Q),
      );
      return s;
    };
    const parts: string[] = [];
    const label = (p: TickPart) =>
      p.kind === "Slot" ? p.slot : p.kind === "Job" ? `${p.slot}/${p.name}` : p.kind;
    const observer = {
      started: (p: TickPart) => parts.push(`+${label(p)}`),
      finished: (p: TickPart) => parts.push(`-${label(p)}`),
    };
    const withLog: string[] = [];
    const n1: Notice[] = [];
    const p1 = schedulerRunTickObserved(
      build(withLog),
      clockWorld(),
      NO_DRAWS,
      n1,
      controlsDefault(),
      null,
      observer,
    );
    expect(parts).toEqual([
      "+AdvanceClock",
      "-AdvanceClock",
      "+Alerts",
      "+Alerts/one",
      "-Alerts/one",
      "+Alerts/two",
      "-Alerts/two",
      "-Alerts",
    ]);
    const plainLog: string[] = [];
    const n2: Notice[] = [];
    const p2 = schedulerRunTick(build(plainLog), clockWorld(), NO_DRAWS, n2, controlsDefault(), null);
    expect([withLog, n1, p1]).toEqual([plainLog, n2, p2]);
    expect(p1).toEqual({ kind: "Alert", alert_kind: "PlanLock" });
  });

  it("refuses to register while a tick runs, and hands out copies", () => {
    const s = schedulerNew();
    schedulerRegister(s, "Alerts", "sneaky", () => schedulerRegister(s, "YearlyArchive", "late", () => {}));
    expect(() => schedulerRunTick(s, clockWorld(), NO_DRAWS, [], controlsDefault(), null)).toThrow(/while/);
    expect(s.running).toBe(false);
    const jobs = schedulerJobs(s, "Alerts");
    expect(Object.isFrozen(jobs)).toBe(true);
    expect(jobs).not.toBe(schedulerJobs(s, "Alerts"));
  });

  it("freezes the shared tables", () => {
    expect(Object.isFrozen(SLOT_VALUES)).toBe(true);
    expect(Object.isFrozen(GROUP_LABEL)).toBe(true);
  });
});
