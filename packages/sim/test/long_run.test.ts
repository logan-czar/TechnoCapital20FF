// Port of crates/sim/tests/long_run.rs: spec M1 done line (build-plan M1.9): 10 years tick
// headless and the job order matches section 4 on every tick. The expected order here is written
// straight from the spec 4 text, apart from the scheduler's own due rules, so the two check each
// other.
//
// Expects:
//   ../src/lib.ts      simNew(data, seed) -> Result<Sim, LoadError>, simStep(sim) -> Notice[],
//                         simNow(sim), simSetTrace(sim, on) [Sim::set_trace], simLastTrace(sim)
//                         -> Slot[] [Sim::last_trace]
//   "@tc20ff/sim-data/node"  loadWorld, defaultDataDir
//
// Changed from the Rust: none in the assertions (the job order and the notice counts do not
// depend on draws). SimApi has no set_trace / last_trace (types/sim-api.ts), so they are Sim
// functions in lib.ts; if W1 puts them elsewhere, change the import.
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { simLastTrace, simNew, simNow, simSetTrace, simStep } from "../src/lib.ts";
import { dateTimeDate, dateTimeHour, dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import type { Slot } from "../src/time/scheduler.ts";
import type { DateTime } from "../src/types/calendar.ts";
import { unwrap } from "./common/index.ts";

/** The slots spec 4 runs at `t`, in order. */
function specOrder(t: DateTime): Slot[] {
  const d = dateTimeDate(t);
  const h = dateTimeHour(t);
  const quarterMonth = [1, 4, 7, 10].includes(d.month);
  const newYear = d.month === 1 && d.day === 1;
  const release = quarterMonth && d.day === 2 && h === 0;
  const v: Slot[] = ["AdvanceClock"];
  // 4.1: prices every hour, except all of 1 January and the release tick (4.4).
  if (!newYear && !release) v.push("SharePrices");
  // 4.1 step 3 and the 4.4 price move: 01:00 on the 2nd of Jan, Apr, Jul and Oct.
  if (quarterMonth && d.day === 2 && h === 1) {
    v.push(
      "PriceMoveFairValue",
      "PriceMoveEarningsJump",
      "PriceMoveBuzz",
      "PriceMoveRatingReview",
      "PriceMoveCreditLineReview",
      "PriceMoveResultHeadlines",
    );
  }
  v.push("Alerts");
  if (h !== 0) return v;
  // 4.2 daily; reaction week on the 3rd to the 8th of a release month.
  v.push("DailyPriceBars", "DailyFairValue");
  if (quarterMonth && d.day >= 3 && d.day <= 8) v.push("DailyReactionWeek");
  v.push("DailyProjections", "DailyNews", "DailyZoneConfidence");
  // 4.3 monthly on the 1st; step 1 only at a quarter start.
  if (d.day === 1) {
    if (quarterMonth) {
      v.push(
        "MonthlyAiEvents",
        "MonthlyIndustryLt",
        "MonthlyCycle",
        "MonthlyZoneSpreads",
        "MonthlyGrowthDraws",
      );
    }
    v.push(
      "MonthlyDemand",
      "MonthlyFringe",
      "MonthlyLaborSeats",
      "MonthlyCompute",
      "MonthlySupply",
      "MonthlyRevenue",
      "MonthlyData",
      "MonthlyExpenses",
      "MonthlyProductivity",
      "MonthlyAssets",
      "MonthlyInterest",
      "MonthlyCashSettle",
      "MonthlyLedger",
    );
  }
  // 4.4 quarterly, in table order.
  if (d.day === 1 && quarterMonth) v.push("CloseStatements", "CloseTax", "CloseResultTags");
  if (release) v.push("ReleasePublish");
  if (quarterMonth && d.day === 9) {
    v.push(
      "LockFixedStartupEvents",
      "LockRandomStartupEvents",
      "LockIpoVotes",
      "LockAiPlans",
      "LockConsensus",
    );
  }
  if (
    (d.month === 3 && d.day === 26) ||
    (d.month === 6 && d.day === 25) ||
    (d.month === 9 && d.day === 25) ||
    (d.month === 12 && d.day === 26)
  ) {
    v.push("RecapBuild");
  }
  // 4.5 yearly, after the Q4 close.
  if (newYear) v.push("YearlyAnnualStatements", "YearlyArchive");
  return v;
}

describe("long run", () => {
  it("ten_years_tick_in_spec_order", () => {
    const data = unwrap(loadWorld(defaultDataDir()), "load_world");
    const sim = unwrap(simNew(data, 2020), "Sim::new");
    simSetTrace(sim, true);
    const end = dateTimeMidnight(simDateYmd(2030, 1, 1));
    let ticks = 0;
    let months = 0;
    let releases = 0;
    let locks = 0;
    let recaps = 0;
    while (simNow(sim) < end) {
      const notices = simStep(sim);
      ticks += 1;
      expect(simLastTrace(sim), `${simNow(sim)}`).toEqual(specOrder(simNow(sim)));
      for (const n of notices) {
        if (n.kind === "MonthDone") months += 1;
        else if (n.kind === "EarningsReleased") releases += 1;
        else if (n.kind === "PlanLocked") locks += 1;
      }
      if (simLastTrace(sim).includes("RecapBuild")) recaps += 1;
    }
    // 2020 to 2029: 3 leap years.
    expect(ticks).toBe((365 * 10 + 3) * 24);
    expect([months, releases, locks, recaps]).toEqual([120, 40, 40, 40]);
  }, 180_000); // Ten years with the ported views built on their cadence (Step 3).
});
