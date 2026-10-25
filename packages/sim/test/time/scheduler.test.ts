// Ported from the tests in crates/sim/src/time/scheduler.rs.

import { describe, expect, it } from "vitest";
import { scheduler } from "../../src/jobs.ts";
import { dateTimeMidnight, simDateYmd } from "../../src/time/calendar.ts";
import {
  type Group,
  SLOT_VALUES,
  type Slot,
  schedulerJobs,
  slotGroup,
  slotIndex,
} from "../../src/time/scheduler.ts";
import type { Notice } from "../../src/types/notice.ts";
import { minimalSim } from "../test_sim.ts";

describe("scheduler", () => {
  it("slots are in spec group order", () => {
    // Hourly (with the 01:00 price move as step 3), daily, monthly, quarterly, yearly.
    const order = (g: Group) => SLOT_VALUES.findIndex((s) => slotGroup(s) === g);
    expect(order("Hourly")).toBeLessThan(order("PriceMove"));
    expect(order("PriceMove")).toBeLessThan(order("Daily"));
    expect(order("Daily")).toBeLessThan(order("Monthly"));
    expect(order("Monthly")).toBeLessThan(order("Close"));
    expect(order("Close")).toBeLessThan(order("Release"));
    expect(order("Release")).toBeLessThan(order("PlanLock"));
    expect(order("PlanLock")).toBeLessThan(order("Recap"));
    expect(order("Recap")).toBeLessThan(order("Yearly"));
    expect(SLOT_VALUES[SLOT_VALUES.length - 1]).toBe("YearlyArchive");
    // 14 steps, step 1 in five parts.
    expect(SLOT_VALUES.filter((s) => slotGroup(s) === "Monthly").length).toBe(18);
    SLOT_VALUES.forEach((s, i) => {
      expect(slotIndex(s)).toBe(i);
    });
  });
});

// Not in the Rust file: the notice order of one tick (spec 9.3, D6, D10), through the clock part
// of `Sim::step` (lib.ts), on a minimal world (test_sim.ts).
describe("tick notices", () => {
  const q4_2019 = { year: 2019, q: 4 };

  it("the release tick posts its alert, the day and the release, then pauses", () => {
    const sim = minimalSim(1);
    sim.apply({ kind: "Resume" });
    for (let h = 1; h < 24; h++) expect(sim.step()).toEqual([{ kind: "TickDone", time: h }]);
    expect(sim.step()).toEqual([
      {
        kind: "Alert",
        alert_kind: "EarningsDay",
        level: "Pause",
        payload: { kind: "Quarter", quarter: q4_2019 },
      },
      { kind: "DayDone", date: simDateYmd(2020, 1, 1) },
      { kind: "EarningsReleased", quarter: q4_2019 },
      { kind: "Paused", reason: { kind: "Alert", alert_kind: "EarningsDay" } },
      { kind: "TickDone", time: 24 },
    ]);
    expect(sim.controls().paused).toBe(true);
  });

  it("a SkipTo posts alerts without pausing, then pauses on its target", () => {
    const sim = minimalSim(1);
    sim.apply({ kind: "SkipTo", skip: "NextLock" });
    const lock = dateTimeMidnight(simDateYmd(2020, 1, 9));
    expect(sim.controls().skip?.target).toBe(lock);
    const paused: Notice[][] = [];
    while (sim.now() < lock) {
      const n = sim.step();
      if (n.some((x) => x.kind === "Paused")) paused.push(n);
    }
    expect(paused).toEqual([
      [
        {
          kind: "Alert",
          alert_kind: "PlanLock",
          level: "Pause",
          payload: { kind: "Quarter", quarter: { year: 2020, q: 1 } },
        },
        { kind: "DayDone", date: simDateYmd(2020, 1, 8) },
        { kind: "PlanLocked", quarter: { year: 2020, q: 1 } },
        { kind: "Paused", reason: { kind: "SkipDone", skip: "NextLock" } },
        { kind: "TickDone", time: lock },
      ],
    ]);
    expect(sim.controls().skip).toBeNull();
  });

  it("the month and quarter start posts its alert before the month's close", () => {
    const sim = minimalSim(1);
    sim.apply({ kind: "Resume" });
    const apr1 = dateTimeMidnight(simDateYmd(2020, 4, 1));
    let last: Notice[] = [];
    while (sim.now() < apr1) {
      last = sim.step();
      if (sim.controls().paused) sim.apply({ kind: "Resume" });
    }
    expect(last).toEqual([
      {
        kind: "Alert",
        alert_kind: "QuarterStart",
        level: "Pause",
        payload: { kind: "Quarter", quarter: { year: 2020, q: 2 } },
      },
      { kind: "DayDone", date: simDateYmd(2020, 3, 31) },
      { kind: "MonthDone", month: { year: 2020, month: 3 } },
      { kind: "Paused", reason: { kind: "Alert", alert_kind: "QuarterStart" } },
      { kind: "TickDone", time: apr1 },
    ]);
  });
});

// Not in the Rust file: the slots more than one module shares keep lib.rs's `register_jobs`
// order (its docs list them), so a Step 2 swap of a placeholder cannot reorder a slot.
describe("registerJobs", () => {
  it("keeps Rust's order in the shared slots", () => {
    const s = scheduler();
    const names = (slot: Slot) => schedulerJobs(s, slot).map(([n]) => n);
    expect(names("Alerts")).toEqual(["time.calendar_alerts"]);
    expect(names("MonthlyAiEvents")).toEqual(["economy.ai_events", "news.chatbot"]);
    expect(names("MonthlyDemand")).toEqual(["economy.demand", "news.phase_changes"]);
    expect(names("MonthlyExpenses")).toEqual(["economy.expenses", "finance.open_month"]);
    expect(names("MonthlyAssets")).toEqual(["economy.assets", "people.new_seats", "finance.post_assets"]);
    expect(names("MonthlyCashSettle")).toEqual(["finance.settle", "market.delist", "news.bankruptcies"]);
    expect(names("CloseStatements")).toEqual(["finance.close", "ai.loss_quarters"]);
    expect(names("CloseTax")).toEqual([]);
    expect(names("ReleasePublish")).toEqual(["finance.removals", "news.removals"]);
    expect(SLOT_VALUES.reduce((n, slot) => n + names(slot).length, 0)).toBe(51);
  });
});
