// A historical world's run (1995-rework 3.3, 6, 8.1): its scenario at the start, the policy rate
// each quarter, and the zones' paths and a history entry each year. Every job does nothing in the
// 2020 world, which has no `era`.

import type { WorldData } from "@tc20ff/sim-data";
import { zAvg } from "../economy/cycle.ts";
import { growthGap } from "../economy/growth.ts";
import { DEFAULT_SCENARIO_ID, RANDOM_SCENARIO_ID, SCENARIOS, scenarioById } from "../economy/scenarios.ts";
import { companyFinanceStatus } from "../finance/state.ts";
import { newsWireQueue, politicsHeadline } from "../news.ts";
import { dateTimeDate } from "../time/calendar.ts";
import type { JobCtx } from "../time/scheduler.ts";
import type { DrawSource } from "../types/draws.ts";
import { clamp, maxF } from "../types/num.ts";
import type { EraMacro, EraState, EraZone } from "../types/state/era.ts";
import type { World } from "../types/world.ts";

/** How much of the gap to its target the policy rate closes each quarter (1995-rework 6.2, T). */
export const RATE_SMOOTH = 0.35;
/** The policy rate's floor (1995-rework 6.2, T). */
export const RATE_FLOOR = 0.0025;
/** The years over which the neutral rate drifts to the scenario's (1995-rework 6.2). */
export const NEUTRAL_DRIFT_YEARS = 25;
/** The AR(1) carry of a zone's shock (1995-rework 6.4, T). */
export const ZONE_SHOCK_CARRY = 0.6;
/** A zone's track is `u²`, so a few zones take off (1995-rework 6.4, T). */
export const TRACK_EXP = 2.0;
/** Companies' plans read this much of their zone's excess growth (1995-rework 6.4, T). */
export const ZONE_TILT_K = 1.0;
/** Startup location weights read a zone's gain in share to this power (1995-rework 6.4, T). */
export const LOCATION_EXP = 1.0;

/** Σ demand, USD a year (1995-rework 6.1). */
function worldDemand(world: World): number {
  let sum = 0.0;
  for (const ind of world.industries) sum += ind.demand;
  return sum;
}

/** The zones at load: shares from GDP, poorness from GDP per head, tracks from the seed (6.4). */
function startMacro(world: World, data: WorldData, draws: DrawSource): EraMacro {
  const people = new Map(data.countries.rows.map((c) => [c.iso3, c.population_m] as const));
  const zoneGdp = new Array<number>(world.zones.length).fill(0.0);
  const zonePeople = new Array<number>(world.zones.length).fill(0.0);
  let gdp = 0.0;
  for (const c of world.countries) {
    zoneGdp[c.zone] = (zoneGdp[c.zone] as number) + c.gdp_usd;
    zonePeople[c.zone] = (zonePeople[c.zone] as number) + (people.get(c.key) ?? 0.0);
    gdp += c.gdp_usd;
  }
  const perHead = zoneGdp.map((g, z) =>
    (zonePeople[z] as number) > 0.0 ? g / (zonePeople[z] as number) : 0.0,
  );
  const richest = perHead.reduce((a, b) => maxF(a, b), 0.0);
  const zones: EraZone[] = world.zones.map((_, z) => {
    const share = (zoneGdp[z] as number) / gdp;
    const u = draws.uniform("Era");
    return {
      share,
      start_share: share,
      poorness: richest > 0.0 ? clamp(1.0 - (perHead[z] as number) / richest, 0.0, 1.0) : 0.0,
      track: u ** TRACK_EXP,
      shock: 0.0,
      tilt: 0.0,
    };
  });
  return {
    gap: 0.0,
    last_phase: world.cycle.phase,
    zones,
    country_share: world.countries.map((c) => {
      const z = zoneGdp[c.zone] as number;
      return z > 0.0 ? c.gdp_usd / z : 0.0;
    }),
  };
}

/**
 * Starts the run on a world fresh from the data, before the economy's draws: the scenario sets the
 * growth profile. `random` draws it on the Era stream and keeps its name back (1995-rework 4.1).
 */
export function eraStart(
  world: World,
  data: WorldData,
  scenarioId: string = DEFAULT_SCENARIO_ID,
  draws: DrawSource,
): void {
  const hidden = scenarioId === RANDOM_SCENARIO_ID;
  const scenario = hidden
    ? SCENARIOS[draws.intInclusive("Era", 0, SCENARIOS.length - 1)]
    : scenarioById(scenarioId);
  if (scenario === undefined) throw new Error(`${scenarioId} is not a scenario`);
  world.profile = scenario.profile;
  let gdp = 0.0;
  for (const c of world.countries) gdp += c.gdp_usd;
  world.era = {
    world_id: data.manifest.id,
    start_year: dateTimeDate(world.clock).year,
    scenario: { id: scenario.id, label: scenario.label, macro: { ...scenario.macro } },
    scenario_hidden: hidden,
    gdp_per_demand: gdp / worldDemand(world),
    neutral_start: world.neutral_rate,
    y10_term: data.manifest.y10_term,
    macro: startMacro(world, data, draws),
    history: { years: [], gdp_usd: [], companies: [], base_rate: [], zone_gdp_usd: [], recessions: [] },
  };
}

/** The neutral rate in `year`: a straight drift to the scenario's (1995-rework 6.2). */
export function neutralRate(era: EraState, year: number): number {
  const t = clamp((year - era.start_year) / NEUTRAL_DRIFT_YEARS, 0.0, 1.0);
  return era.neutral_start + (era.scenario.macro.neutral_end - era.neutral_start) * t;
}

/**
 * The growth gap (1995-rework 6.1): this quarter's growth above the long-term rate, a year, by
 * demand. Stationary, where `Σ demand_core ÷ Σ trend_demand − 1` drifts for good, since demand does
 * not revert to trend (D995).
 */
export function growthGapOfWorld(world: World): number {
  let weighted = 0.0;
  let total = 0.0;
  for (const ind of world.industries) {
    weighted += ind.demand * growthGap(ind.q_growth, ind.lt);
    total += ind.demand;
  }
  return total > 0.0 ? weighted / total : 0.0;
}

/**
 * Each quarter, after the cycle (1995-rework 6.2, 6.3): the policy rate moves toward
 * `neutral + a × gap + b × g_t`, and a contraction's first quarter starts a recession (4.2).
 */
export function eraMacroJob(world: World, ctx: JobCtx): void {
  const era = world.era;
  if (era === undefined) return;
  const m = era.scenario.macro;
  const date = ctx.facts.date;
  era.macro.gap = growthGapOfWorld(world);
  world.neutral_rate = neutralRate(era, date.year);
  const target = world.neutral_rate + m.rate_gap_k * era.macro.gap + m.rate_g_k * world.cycle.g_t;
  world.base_rate = maxF(world.base_rate + RATE_SMOOTH * (target - world.base_rate), RATE_FLOOR);
  if (world.cycle.phase === "Contraction" && era.macro.last_phase !== "Contraction") {
    era.history.recessions.push(date.year);
    newsWireQueue(world.news, politicsHeadline(date, "The world economy slips into recession"));
  }
  era.macro.last_phase = world.cycle.phase;
}

/**
 * 1 January: each zone's growth against the world (1995-rework 6.4), `catchup × poorness × track`
 * plus an AR(1) shock. Shares renormalise, countries keep their share of their zone, and Z follows
 * the new weights. Industry demand stays global, so world GDP does not move.
 */
function advanceZones(world: World, era: EraState, gdp: number, draws: DrawSource): void {
  const m = era.scenario.macro;
  const zones = era.macro.zones;
  const raw = zones.map((z) => {
    z.shock = ZONE_SHOCK_CARRY * z.shock + m.zone_shock_sd * draws.normal("Era");
    return z.share * Math.exp(m.catchup * z.poorness * z.track + z.shock);
  });
  const total = raw.reduce((a, b) => a + b, 0.0);
  zones.forEach((z, i) => {
    const share = (raw[i] as number) / total;
    z.tilt = ZONE_TILT_K * Math.log(share / z.share);
    z.share = share;
    const row = world.zones[i] as World["zones"][number];
    row.gdp_share = share;
    row.gdp_usd = share * gdp;
  });
  world.countries.forEach((c, i) => {
    c.gdp_usd = (era.macro.country_share[i] as number) * (world.zones[c.zone]?.gdp_usd ?? 0.0);
  });
  world.cycle.z_avg = zAvg(
    world.countries.map((c) => [c.gdp_usd, world.zones[c.zone]?.intensity ?? 0.0] as const),
  );
}

/** 1 January: the zones move, then the year just closed joins the long history (1995-rework 8.1). */
export function eraYearCloseJob(world: World, ctx: JobCtx): void {
  const era = world.era;
  if (era === undefined) return;
  const gdp = era.gdp_per_demand * worldDemand(world);
  advanceZones(world, era, gdp, ctx.draws);
  const h = era.history;
  h.years.push(ctx.facts.date.year - 1);
  h.gdp_usd.push(gdp);
  h.base_rate.push(world.base_rate);
  h.zone_gdp_usd.push(world.zones.map((z) => z.gdp_usd));
  let companies = 0;
  for (const c of world.companies) {
    if (companyFinanceStatus(c.finance) !== "Removed") companies += 1;
  }
  h.companies.push(companies);
}

/** A startup's HQ weight multiplier for a province in `zone` (1995-rework 6.4). */
export function zoneLocationFactor(era: EraState, zone: number): number {
  const z = era.macro.zones[zone];
  return z === undefined || z.start_share <= 0.0 ? 1.0 : (z.share / z.start_share) ** LOCATION_EXP;
}
