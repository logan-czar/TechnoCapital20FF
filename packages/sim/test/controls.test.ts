// Controls (build-plan M1.5): speeds 0 to 5, pause, resume, SkipTo stopping on exactly the right
// tick, and alert levels. Ported from crates/sim/tests/controls.rs, driven by ClockHarness
// (test/time/harness.ts) until `Sim` is ported: bankruptcy_alerts_fire_only_for_the_watchlist,
// skip_to_stops_on_exactly_the_right_tick, pause_alerts_pause_after_their_tick and
// speeds_pause_and_resume. Left for the Sim port: watchlist_and_omniscient (it needs the company
// table and the debug-build check).

import { describe, expect, it } from "vitest";
import { dateTimeAt, formatDateTime, simDateYmd } from "../src/time/calendar.ts";
import { controlsEffectiveSpeed, controlsSecondsPerTick } from "../src/time/control.ts";
import { type JobCtx, jobCtxRaiseAlert } from "../src/time/scheduler.ts";
import type { DateTime } from "../src/types/calendar.ts";
import { MAX_SPEED } from "../src/types/control.ts";
import type { CompanyId } from "../src/types/ids.ts";
import type { AlertLevel, AlertPayload, Notice, PauseReason, SkipKind } from "../src/types/notice.ts";
import type { World } from "../src/types/world.ts";
import { ClockHarness } from "./time/harness.ts";

const at = (y: number, m: number, d: number, h: number): DateTime => dateTimeAt(simDateYmd(y, m, d), h);
const company = (n: number) => n as CompanyId;

/** tests/common `bankrupt_three_and_four`: raises a watchlist bankruptcy for companies 3 and 4. */
function bankruptThreeAndFour(_world: World, ctx: JobCtx): void {
  for (const id of [company(3), company(4)]) {
    jobCtxRaiseAlert(ctx, "BankruptcyInWatchlist", { kind: "Company", company: id });
  }
}

/** Steps until a Paused notice; returns the tick it came on and the reason. */
function runToPause(sim: ClockHarness): [DateTime, PauseReason] {
  for (let i = 0; i < 400 * 24; i++) {
    const notices = sim.step();
    expect(notices[notices.length - 1]?.kind).toBe("TickDone");
    const paused = notices.find((n) => n.kind === "Paused");
    if (paused !== undefined) {
      expect(sim.controls.paused).toBe(true);
      return [sim.now(), paused.reason];
    }
  }
  throw new Error("never paused");
}

describe("controls", () => {
  it("bankruptcy alerts fire only for the watchlist", () => {
    const s = new ClockHarness();
    s.registerTestJob("DailyNews", "test.bankrupt", bankruptThreeAndFour);
    const bankruptcies = (ns: Notice[]): [AlertLevel, AlertPayload][] =>
      ns.flatMap((n) =>
        n.kind === "Alert" && n.alert_kind === "BankruptcyInWatchlist"
          ? [[n.level, n.payload] as [AlertLevel, AlertPayload]]
          : [],
      );
    // Empty watchlist: the job raises both on 2 Jan 00:00, nothing fires.
    const seen: [AlertLevel, AlertPayload][] = [];
    while (s.now() < at(2020, 1, 2, 0)) seen.push(...bankruptcies(s.step()));
    expect(seen).toEqual([]);
    // Company 3 watched: only its alert fires, at Notify (spec 8), and does not pause.
    s.apply({ kind: "WatchlistAdd", company: company(3) });
    s.apply({ kind: "SetAlert", alert_kind: "EarningsDay", level: "Off" });
    s.apply({ kind: "Resume" });
    while (s.now() < at(2020, 1, 3, 0)) seen.push(...bankruptcies(s.step()));
    expect(seen).toEqual([["Notify", { kind: "Company", company: 3 }]]);
    expect(s.controls.paused).toBe(false);
  });

  it("SkipTo stops on exactly the right tick", () => {
    const s = new ClockHarness();
    // From the start, 2020-01-01 00:00, each kind in turn; alerts do not stop a skip (D6).
    const plan: [SkipKind, DateTime][] = [
      ["MonthEnd", at(2020, 2, 1, 0)],
      ["NextRelease", at(2020, 4, 2, 0)],
      ["NextRelease", at(2020, 7, 2, 0)],
      ["NextLock", at(2020, 7, 9, 0)],
      ["NextRecap", at(2020, 9, 25, 0)],
      ["NextRecap", at(2020, 12, 26, 0)],
      ["MonthEnd", at(2021, 1, 1, 0)],
      ["NextLock", at(2021, 1, 9, 0)],
      ["NextRecap", at(2021, 3, 26, 0)],
      ["MonthEnd", at(2021, 4, 1, 0)],
    ];
    for (const [kind, want] of plan) {
      s.apply({ kind: "SkipTo", skip: kind });
      expect(controlsEffectiveSpeed(s.controls)).toBe(MAX_SPEED);
      const [t, r] = runToPause(s);
      expect([formatDateTime(t), r]).toEqual([formatDateTime(want), { kind: "SkipDone", skip: kind }]);
      expect(controlsEffectiveSpeed(s.controls)).toBe(0);
    }
    // From the first hour of a release day, the next release is a quarter away.
    const s2 = new ClockHarness();
    s2.apply({ kind: "SkipTo", skip: "NextRelease" });
    runToPause(s2);
    s2.step();
    expect(s2.now()).toBe(at(2020, 1, 2, 1));
    s2.apply({ kind: "SkipTo", skip: "NextRelease" });
    expect(runToPause(s2)[0]).toBe(at(2020, 4, 2, 0));
  });

  it("pause alerts pause after their tick", () => {
    const s = new ClockHarness();
    s.apply({ kind: "Resume" });
    // Earnings day at the 2 Jan release (Pause by default, spec 8).
    expect(runToPause(s)).toEqual([at(2020, 1, 2, 0), { kind: "Alert", alert_kind: "EarningsDay" }]);
    // Plan lock pauses by default (D800), then the recap.
    s.apply({ kind: "Resume" });
    expect(runToPause(s)).toEqual([at(2020, 1, 9, 0), { kind: "Alert", alert_kind: "PlanLock" }]);
    // Set to Log, it posts a notice but does not pause.
    s.apply({ kind: "SetAlert", alert_kind: "PlanLock", level: "Log" });
    s.apply({ kind: "Resume" });
    expect(runToPause(s)).toEqual([at(2020, 3, 26, 0), { kind: "Alert", alert_kind: "QuarterlyRecap" }]);
    // Quarter start (D800) pauses at the quarter's first tick, with the new quarter.
    s.apply({ kind: "Resume" });
    const quarterStart: Notice[] = [];
    for (;;) {
      const n = s.step();
      quarterStart.push(...n.filter((x) => x.kind === "Alert" && x.alert_kind === "QuarterStart"));
      if (s.controls.paused) break;
    }
    expect(s.now()).toBe(at(2020, 4, 1, 0));
    expect(quarterStart).toEqual([
      {
        kind: "Alert",
        alert_kind: "QuarterStart",
        level: "Pause",
        payload: { kind: "Quarter", quarter: { year: 2020, q: 2 } },
      },
    ]);
    s.apply({ kind: "SetAlert", alert_kind: "QuarterStart", level: "Off" });
    // Off posts nothing and does not pause.
    s.apply({ kind: "SetAlert", alert_kind: "EarningsDay", level: "Off" });
    s.apply({ kind: "Resume" });
    let alerts = 0;
    while (s.now() < at(2020, 4, 3, 0)) alerts += s.step().filter((n) => n.kind === "Alert").length;
    expect(alerts).toBe(0);
    expect(s.controls.paused).toBe(false);
  });

  it("speeds, pause and resume", () => {
    const s = new ClockHarness();
    // A new game starts paused (spec 7.3).
    expect(s.controls.paused).toBe(true);
    expect(controlsEffectiveSpeed(s.controls)).toBe(0);
    expect(controlsSecondsPerTick(s.controls)).toBeNull();
    for (let n = 1; n <= MAX_SPEED; n++) {
      s.apply({ kind: "SetSpeed", speed: n });
      expect(controlsEffectiveSpeed(s.controls)).toBe(n);
    }
    // Speed 5 is max.
    expect(controlsSecondsPerTick(s.controls)).toBeNull();
    s.apply({ kind: "SetSpeed", speed: 1 });
    expect(controlsSecondsPerTick(s.controls)).toBe(2.0);
    s.apply({ kind: "SetSpeed", speed: 4 });
    expect(controlsSecondsPerTick(s.controls)).toBe(0.2);
    s.apply({ kind: "SetSpeed", speed: 1 });
    expect(s.apply({ kind: "Pause" })).toEqual([{ kind: "Paused", reason: { kind: "Player" } }]);
    s.apply({ kind: "Resume" });
    // Resume keeps the speed.
    expect(controlsEffectiveSpeed(s.controls)).toBe(1);
    s.apply({ kind: "SetSpeed", speed: 0 });
    expect(s.controls.paused).toBe(true);
    expect(() => s.apply({ kind: "SetSpeed", speed: 6 })).toThrow();
    // Pause cancels a skip.
    s.apply({ kind: "SkipTo", skip: "NextLock" });
    expect(controlsSecondsPerTick(s.controls)).toBeNull();
    s.apply({ kind: "Pause" });
    expect(s.controls.skip).toBeNull();
  });
});
