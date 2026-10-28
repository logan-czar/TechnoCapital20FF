// The AI boom and the bubble (spec 5.1.1, Logan batches 151 and 153; 4.3 steps 1a and 1b).
// Ported from crates/sim/src/economy/ai_boom.rs.
//
// AI labs' long-term rate is a regime switch read from ai-boom.csv by stage and boom year; the
// quarterly draw of 5.1 is unchanged. Every industry's `lt = trend_growth + boom_uplift ×
// (AI labs LT − preboom LT)`. The boom fires at 00:00 on 1 January 2030; the pop on the first
// day of the quarter rolled at load (2040 ± 2, quarter 1 to 4): demand ×(1 − crash_drop) once,
// then 8 quarters of bust and the post-crash rate.

import { quarterFirstDay, simDateQuarter, simDateYmd } from "../time/calendar.ts";
import { type JobCtx, jobCtxRaiseAlert } from "../time/scheduler.ts";
import type { Quarter, SimDate } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import type { AiBoom, AiSchedule, AiStage, PhaseLabel, World } from "../types/world.ts";
import { fadedTrend, growthFactor, profileOf } from "./profiles.ts";

/** The fade counts years from 1 Jan 2020, the game's start (drift plan, D976). */
const FADE_ORIGIN_YEAR = 2020;

/** The boom event: 00:00 on 1 January 2030 (spec 5.1.1, scripted). */
export const BOOM_YEAR = 2030;
/** The pop's base year (spec 5.1.1, A)... */
export const POP_BASE_YEAR = 2040;
/** ...plus a whole number from −2 to +2... */
export const POP_YEAR_ROLL = 2;
/** ...and a quarter from 1 to 4. */
export const POP_QUARTERS: readonly [number, number] = [1, 4];
/** The bust lasts 8 quarters from the pop, then the post-crash rate holds (spec 5.1.1, T). */
export const BUST_QUARTERS = 8;
/** Linked industries read Boom for the boom's first 4 quarters (spec 5.1.1, A). */
export const BOOM_LABEL_QUARTERS = 4;

/** The boom event date. */
export function boomDate(): SimDate {
  return simDateYmd(BOOM_YEAR, 1, 1);
}

/** Quarters in a calendar year, for the quarter counts below. */
export const QUARTERS_IN_YEAR = 4;

/** A quarter's position on one running count (year × 4 + quarter − 1). */
export function quarterIndex(q: Quarter): number {
  return q.year * QUARTERS_IN_YEAR + q.q - 1;
}

/**
 * The boom year (spec 5.1.1): whole years into the boom from `quartersIn`, the quarters since
 * the boom event that `stageAt` gives for the Boom stage. Boom year 0 is 2030. Whole number (u32).
 */
export function boomYear(quartersIn: number): number {
  return Math.trunc(Math.max(0, quartersIn) / QUARTERS_IN_YEAR);
}

/** The stage on `date` and how many whole quarters into it (spec 5.1.1). */
export function stageAt(date: SimDate, boom: SimDate, pop: SimDate): [AiStage, number] {
  const q = quarterIndex(simDateQuarter(date));
  const qb = quarterIndex(simDateQuarter(boom));
  const qp = quarterIndex(simDateQuarter(pop));
  if (q < qb) return ["Preboom", 0];
  if (q < qp) return ["Boom", q - qb];
  if (q < qp + BUST_QUARTERS) return ["Bust", q - qp];
  return ["Postcrash", q - qp - BUST_QUARTERS];
}

/**
 * AI labs' long-term rate in a stage (spec 5.1.1): the boom year is whole years into the boom,
 * the last schedule row holding for every later year ("Boom year 10 and later").
 */
export function aiLabsLt(schedule: AiSchedule, stage: AiStage, quartersIn: number): number {
  switch (stage) {
    case "Preboom":
      return schedule.preboom_lt;
    case "Boom": {
      const year = boomYear(quartersIn);
      const last = Math.max(0, schedule.boom_lt.length - 1);
      return schedule.boom_lt[Math.min(year, last)] ?? schedule.preboom_lt;
    }
    case "Bust":
      return schedule.bust_lt;
    case "Postcrash":
      return schedule.postcrash_lt;
  }
}

/** `lt = trend_growth + boom_uplift × (AI labs LT − preboom LT)` (spec 5.1.1, batch 153 Q2). */
export function linkedLt(trendGrowth: number, boomUplift: number, aiLt: number, preboomLt: number): number {
  return trendGrowth + boomUplift * (aiLt - preboomLt);
}

/**
 * The pop date, rolled at load from the gen stream (spec 5.1.1, A): 2040 plus −2 to +2, the
 * first day of quarter 1 to 4.
 */
export function rollPopDate(draws: DrawSource): SimDate {
  const year = draws.intInclusive("Gen", -POP_YEAR_ROLL, POP_YEAR_ROLL);
  const q = draws.intInclusive("Gen", POP_QUARTERS[0], POP_QUARTERS[1]);
  return quarterFirstDay({ year: POP_BASE_YEAR + year, q });
}

/**
 * The label the boom forces on a linked industry (boom_uplift above 0): Boom for the boom's
 * first 4 quarters, Bust for the 8 bust quarters, whatever the gap (spec 5.1.1).
 */
export function forcedLabel(boomUplift: number, ai: AiBoom, date: SimDate): PhaseLabel | null {
  if (boomUplift <= 0.0) return null;
  const [stage, q] = stageAt(date, ai.boom_date, ai.pop_date);
  if (stage === "Boom" && q < BOOM_LABEL_QUARTERS) return "Boom";
  if (stage === "Bust") return "Bust";
  return null;
}

/**
 * 4.3 step 1a: the scripted AI events due today. On the boom, every linked industry carries over
 * from its new lt_q (D103) and a World event alert fires. On the pop, every industry's demand_core
 * and trend_demand fall by crash_drop once, linked industries carry over from the new lt_q, and a
 * World event alert fires. The bust's end needs no event: lt moves to the post-crash rate.
 */
export function aiEventsJob(world: World, ctx: JobCtx): void {
  const [stage] = stageAt(ctx.facts.date, world.ai.boom_date, world.ai.pop_date);
  if (stage === world.ai.stage) return;
  world.ai.stage = stage;
  switch (stage) {
    case "Boom":
      markLinkedCarryReset(world);
      jobCtxRaiseAlert(ctx, "WorldEvent", { kind: "None" });
      break;
    case "Bust":
      for (const ind of world.industries) {
        const keep = 1.0 - ind.params.crash_drop;
        ind.demand_core *= keep;
        ind.trend_demand *= keep;
      }
      markLinkedCarryReset(world);
      jobCtxRaiseAlert(ctx, "WorldEvent", { kind: "None" });
      break;
    case "Postcrash":
    case "Preboom":
      break;
  }
}

function markLinkedCarryReset(world: World): void {
  for (const ind of world.industries) {
    if (ind.params.boom_uplift > 0.0) ind.carry_reset = true;
  }
}

/** Sets AI labs' rate for `date` and every industry's lt; the old lt is kept as prev_lt (D100). */
export function setIndustryLt(world: World, date: SimDate): void {
  const [stage, quartersIn] = stageAt(date, world.ai.boom_date, world.ai.pop_date);
  const aiLt = aiLabsLt(world.ai.schedule, stage, quartersIn);
  world.ai.ai_labs_lt = aiLt;
  const pre = world.ai.schedule.preboom_lt;
  // The growth profile scales the CSV rates (D970) and, with the drift plan (D976, D977), fades
  // them to the mature rates, then applies the world growth scale and the slowdown. All 1 or off
  // for legacy, so its rates are the CSV's.
  const profile = profileOf(world);
  const q = simDateQuarter(date);
  const scale = profile.lt_scale * growthFactor(profile, q.year);
  const years = (quarterIndex(q) - FADE_ORIGIN_YEAR * QUARTERS_IN_YEAR) / QUARTERS_IN_YEAR;
  for (const ind of world.industries) {
    ind.prev_lt = ind.lt;
    const p = ind.params;
    const trend = fadedTrend(p.trend_growth, p.mature_rate, p.fade_half_life_years, years, profile.fade);
    ind.lt = linkedLt(trend * scale, p.boom_uplift, aiLt, pre);
  }
}

/** 4.3 step 1b: every industry's lt. */
export function industryLtJob(world: World, ctx: JobCtx): void {
  setIndustryLt(world, ctx.facts.date);
}
