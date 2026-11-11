// The levers (pivot 4.3): the neutral set every world loads with, the one function that moves them
// (`leversApply`) and the readers the economy calls. Government acts on the economy only through
// `World.levers`: the 1995 world's quarterly party drift (era/policy.ts) writes them through
// `leversApply` until laws and executive actions replace it (pivot 7.7, M3).
//
// What each lever does to which formula, and how strongly, is D1034.
//
// Every reader is an exact no-op at the neutral value: it returns its input untouched, by a branch
// on 0 and not by arithmetic, so the economy with neutral levers is bit for bit the economy without.

import type { CompanyId, CountryId, IndustryId, ProvinceId, UsStateId } from "../types/ids.ts";
import { clamp, minF } from "../types/num.ts";
import type { Levers } from "../types/state/governing.ts";
import type { Company, World } from "../types/world.ts";

/** Every lever but the tax rate at its neutral value, 0 (pivot 4.3). */
export const LEVER_NEUTRAL = 0.0;

/** Operating cost added per point of `regulation`: 1 makes the lever the share itself (pivot 4.3, T). */
export const REGULATION_COST_K = 1.0;
/** Demand added per point of `subsidy`: 1 makes the lever the share itself (pivot 4.3, T). */
export const SUBSIDY_DEMAND_K = 1.0;
/**
 * The yearly growth the largest firm may still plan as `antitrust` leaves 0: the cap is
 * `ANTITRUST_FREE_GROWTH × (1 − antitrust)`, so at 1 it may not plan to grow (pivot 4.3, T).
 */
export const ANTITRUST_FREE_GROWTH = 0.2;
/** Yearly growth plan added per point of `state_growth` to a firm headquartered there (pivot 4.3, T). */
export const STATE_GROWTH_PLAN_K = 1.0;
/** `tariff` and `antitrust` run 0 to 1 (pivot 4.3). */
export const LEVER_SHARE_MAX = 1.0;

/**
 * The neutral levers (pivot 4.3) of a world with `industries` industries and `states` US states:
 * `corpTax` is the USA's corporate tax rate at load, and every other lever is `LEVER_NEUTRAL`.
 */
export function leversNeutral(industries: number, states: number, corpTax: number): Levers {
  const perIndustry = (): number[] => new Array<number>(industries).fill(LEVER_NEUTRAL);
  return {
    corp_tax: corpTax,
    fiscal: LEVER_NEUTRAL,
    rate_bias: LEVER_NEUTRAL,
    regulation: perIndustry(),
    subsidy: perIndustry(),
    antitrust: perIndustry(),
    tariff: perIndustry(),
    state_growth: new Array<number>(states).fill(LEVER_NEUTRAL),
    gains_tax: LEVER_NEUTRAL,
    income_tax: LEVER_NEUTRAL,
  };
}

/**
 * New values for some levers (pivot 4.3, 7.7): what a law, an executive action or, until M3, the
 * party drift hands `leversApply`. A value is the lever's new level, not a step; a lever left out
 * keeps its level. The per-industry and per-state levers name their rows. The player's tax rates
 * are not here: the player lane owns them.
 */
export interface LeversChange {
  corp_tax?: number;
  fiscal?: number;
  rate_bias?: number;
  regulation?: readonly (readonly [IndustryId, number])[];
  subsidy?: readonly (readonly [IndustryId, number])[];
  antitrust?: readonly (readonly [IndustryId, number])[];
  tariff?: readonly (readonly [IndustryId, number])[];
  state_growth?: readonly (readonly [UsStateId, number])[];
}

function setRows(
  into: number[],
  rows: readonly (readonly [number, number])[] | undefined,
  share: boolean,
): void {
  if (rows === undefined) return;
  for (const [id, value] of rows) {
    // A row the world does not have is skipped: the arrays stay as long as their tables.
    if (id < 0 || id >= into.length) continue;
    into[id] = share ? clamp(value, LEVER_NEUTRAL, LEVER_SHARE_MAX) : value;
  }
}

/**
 * The one way a lever moves (pivot 4.3, 7.7). `tariff` and `antitrust` are held to 0..1. The USA's
 * `Country.corp_tax_rate` is kept equal to `corp_tax`: it is the copy the country views and the
 * long history show, and nothing in the economy reads it for a US company (`corpTaxRate`).
 */
export function leversApply(world: World, change: LeversChange): void {
  const l = world.levers;
  if (change.corp_tax !== undefined) {
    l.corp_tax = change.corp_tax;
    const usa = world.countries[world.politics.country];
    if (usa !== undefined) usa.corp_tax_rate = change.corp_tax;
  }
  if (change.fiscal !== undefined) l.fiscal = change.fiscal;
  if (change.rate_bias !== undefined) l.rate_bias = change.rate_bias;
  setRows(l.regulation, change.regulation, false);
  setRows(l.subsidy, change.subsidy, false);
  setRows(l.antitrust, change.antitrust, true);
  setRows(l.tariff, change.tariff, true);
  setRows(l.state_growth, change.state_growth, false);
}

/**
 * The corporate tax rate of a company headquartered in `country` (mvp-spec 5.11; pivot 4.3): the
 * `corp_tax` lever in the USA, the country's own rate elsewhere.
 */
export function corpTaxRate(world: World, country: CountryId): number {
  if (country === world.politics.country) return world.levers.corp_tax;
  return (world.countries[country] as World["countries"][number]).corp_tax_rate;
}

/**
 * The fiscal push on every industry's demand (pivot 4.3 `fiscal`; 1995-rework 7.5):
 * `1 + fiscal × US share of world GDP`, and exactly 1 at neutral. An era world reads the share its
 * policy job took at the quarter's start (`EraPolitics.us_share`), as the drift always did; a world
 * without one reads the countries' GDP now.
 */
export function fiscalDemandMult(world: World): number {
  const fiscal = world.levers.fiscal;
  if (fiscal === LEVER_NEUTRAL) return 1.0;
  return 1.0 + fiscal * (world.era === undefined ? usGdpShare(world) : world.era.politics.us_share);
}

/** The USA's share of world GDP now (1995-rework 7.5); 0 for a world with no GDP. */
export function usGdpShare(world: World): number {
  let gdp = 0.0;
  for (const c of world.countries) gdp += c.gdp_usd;
  const usa = world.countries[world.politics.country];
  return gdp > 0.0 && usa !== undefined ? usa.gdp_usd / gdp : 0.0;
}

/** `demand` under the industry's `subsidy` (pivot 4.3): `× (1 + k × subsidy)`; untouched at neutral. */
export function subsidisedDemand(world: World, industry: number, demand: number): number {
  const s = world.levers.subsidy[industry] ?? LEVER_NEUTRAL;
  return s === LEVER_NEUTRAL ? demand : demand * (1.0 + SUBSIDY_DEMAND_K * s);
}

/**
 * An operating cost line under the industry's `regulation` (pivot 4.3): `× (1 + k × regulation)`;
 * untouched at neutral. Operating cost is a unit's variable and fixed cash costs (mvp-spec 5.5).
 */
export function regulatedCost(world: World, industry: number, cost: number): number {
  const r = world.levers.regulation[industry] ?? LEVER_NEUTRAL;
  return r === LEVER_NEUTRAL ? cost : cost * (1.0 + REGULATION_COST_K * r);
}

/**
 * The share of the rest-of-world block's supply a `tariff` lets in (pivot 4.2, 4.3): `1 − tariff`,
 * and exactly 1 at neutral.
 */
export function tariffPass(world: World, industry: number): number {
  const t = world.levers.tariff[industry] ?? LEVER_NEUTRAL;
  return t === LEVER_NEUTRAL ? 1.0 : 1.0 - clamp(t, LEVER_NEUTRAL, LEVER_SHARE_MAX);
}

/** What `leverGrowthPlan` reads of the world, taken once a plan lock. */
export interface PlanLevers {
  /** Per industry, the company with the most revenue there last month; null with none (antitrust). */
  largest: (CompanyId | null)[];
  /** The US state of each province that has one; null when no `state_growth` is set. */
  state_of: Map<ProvinceId, UsStateId> | null;
}

/**
 * The plan lock's lever context (pivot 4.3), or null when `antitrust` and `state_growth` are all
 * neutral, so a neutral world does no work here.
 */
export function planLevers(world: World): PlanLevers | null {
  const l = world.levers;
  const anti = l.antitrust.some((v) => v !== LEVER_NEUTRAL);
  const growth = l.state_growth.some((v) => v !== LEVER_NEUTRAL);
  if (!anti && !growth) return null;
  return {
    largest: anti ? largestFirms(world) : world.industries.map(() => null),
    state_of: growth ? usStateOfProvinces(world) : null,
  };
}

/**
 * Each industry's largest firm (pivot 4.3 `antitrust`): the company, not Bankrupt or Removed, whose
 * units there booked the most revenue last month. Ties go to the lower id.
 */
export function largestFirms(world: World): (CompanyId | null)[] {
  const best: (CompanyId | null)[] = world.industries.map(() => null);
  const bestRevenue = world.industries.map(() => 0.0);
  world.companies.forEach((c: Company, id) => {
    const status = c.finance.distress.status;
    if (status === "Bankrupt" || status === "Removed") return;
    const mine = new Map<number, number>();
    for (const ui of c.units) {
      const u = world.units[ui] as World["units"][number];
      mine.set(u.industry, (mine.get(u.industry) ?? 0.0) + u.revenue_m);
    }
    for (const [industry, revenue] of mine) {
      if (best[industry] === null || revenue > (bestRevenue[industry] as number)) {
        best[industry] = id as CompanyId;
        bestRevenue[industry] = revenue;
      }
    }
  });
  return best;
}

/**
 * Which US state each province is in (pivot 4.3 `state_growth`). An era world knows every state's
 * provinces (1995-rework 7.4); another world knows only the home provinces of its districts (D982),
 * so a company headquartered in a province with no district there has no state and the lever does
 * not reach it. Counties, the lever's other half, are not simulated yet (pivot 5.1, M2).
 */
export function usStateOfProvinces(world: World): Map<ProvinceId, UsStateId> {
  const out = new Map<ProvinceId, UsStateId>();
  const era = world.era;
  if (era !== undefined) {
    era.politics.states.forEach((s, state) => {
      for (const p of s.provinces) out.set(p.id, state as UsStateId);
    });
    return out;
  }
  for (const d of world.politics.districts) {
    if (!out.has(d.home_province)) out.set(d.home_province, d.state);
  }
  return out;
}

/**
 * A company's yearly growth plan `g` under the levers (pivot 4.3), at the plan lock: `state_growth`
 * of its headquarters' state is added, then `antitrust` caps the plan of its industry's largest firm
 * at `ANTITRUST_FREE_GROWTH × (1 − antitrust)`. A plan to shrink is never raised by the cap. `g`
 * comes back untouched when `ctx` is null or both levers are neutral for this company.
 */
export function leverGrowthPlan(world: World, ctx: PlanLevers | null, id: CompanyId, g: number): number {
  if (ctx === null) return g;
  const c = world.companies[id] as Company;
  let out = g;
  const state = ctx.state_of?.get(c.hq_province);
  if (state !== undefined) {
    const shift = world.levers.state_growth[state] ?? LEVER_NEUTRAL;
    if (shift !== LEVER_NEUTRAL) out += STATE_GROWTH_PLAN_K * shift;
  }
  const level = world.levers.antitrust[c.industry] ?? LEVER_NEUTRAL;
  if (level !== LEVER_NEUTRAL && ctx.largest[c.industry] === id) {
    out = minF(out, ANTITRUST_FREE_GROWTH * (1.0 - clamp(level, LEVER_NEUTRAL, LEVER_SHARE_MAX)));
  }
  return out;
}
