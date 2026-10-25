// The archetype table (spec 6.1, 2.23.1) and the 6.3 trait R&D mults, the slice of the Lite AI
// that load needs before M6: the starting run rate's R&D plan (7.1 "Plan", "Rating") and the
// dividend rule's payout mult (5.17). M6.1 (F6) adds the hurdle ROA, growth adj and data
// coverage columns, read by the 6.2 growth plan and the 6.4 station split. Ported from
// crates/sim/src/ai/archetype.rs.
//
// Archetype (and ARCHETYPE_VALUES, in Rust enum order) is in types/state/ai.ts.

import { START_PRODUCTIVITY } from "../ops/stations.ts";
import { roundHalfAway, toU32Sat } from "../types/num.ts";
import type { Archetype } from "../types/state/ai.ts";
import { ARCHETYPE_VALUES } from "../types/state/ai.ts";
import type { Trait } from "../types/state/people.ts";
import { PERCENT, rdPlan } from "./rd.ts";

export type { Archetype };

/** One row of the spec 6.1 archetype table (all T). */
export interface ArchetypeRow {
  archetype: Archetype;
  /** Hurdle ROA (6.2 situation rows). */
  hurdle_roa: number;
  /** Added to the 6.2 growth when ROA meets the hurdle, a fraction a year. */
  growth_adj: number;
  /** R&D mult (6.3 target). */
  rd_mult: number;
  /** Payout mult (5.17 payout ratio). */
  payout_mult: number;
  /** Share of the monthly unstructured inflow the 6.4 split covers with enterprise stations. */
  data_coverage: number;
}

/**
 * Spec 6.1 (all T), in the enum's order: hurdle ROA, growth adj, R&D mult, payout mult, data
 * coverage: State champion 6%, +2 pp, 1.0, 1.0, 50%; Startup 12%, +4 pp, 1.2, 0, 100%;
 * Aggressive grower 8%, +5 pp, 1.3, 0.5, 100%; Cash cow 15%, −3 pp, 0.7, 1.3, 25%; Incumbent
 * 10%, 0, 1.0, 1.0, 50%.
 */
export const ARCHETYPE_TABLE: readonly ArchetypeRow[] = [
  {
    archetype: "StateChampion",
    hurdle_roa: 0.06,
    growth_adj: 0.02,
    rd_mult: 1.0,
    payout_mult: 1.0,
    data_coverage: 0.5,
  },
  {
    archetype: "Startup",
    hurdle_roa: 0.12,
    growth_adj: 0.04,
    rd_mult: 1.2,
    payout_mult: 0.0,
    data_coverage: 1.0,
  },
  {
    archetype: "AggressiveGrower",
    hurdle_roa: 0.08,
    growth_adj: 0.05,
    rd_mult: 1.3,
    payout_mult: 0.5,
    data_coverage: 1.0,
  },
  {
    archetype: "CashCow",
    hurdle_roa: 0.15,
    growth_adj: -0.03,
    rd_mult: 0.7,
    payout_mult: 1.3,
    data_coverage: 0.25,
  },
  {
    archetype: "Incumbent",
    hurdle_roa: 0.1,
    growth_adj: 0.0,
    rd_mult: 1.0,
    payout_mult: 1.0,
    data_coverage: 0.5,
  },
];

/** Spec 6.1: the Startup row applies below this revenue, in the Tech sector. */
export const STARTUP_REVENUE_BELOW_USD = 50.0e6;
/** Spec 6.1: the Startup row's sector (industries.csv `sector`). */
export const STARTUP_SECTOR = "Tech";
/** Spec 6.1: the State champion row's control basis (companies.csv `control_basis`). */
export const STATE_CONTROL_BASIS = "state";

/** Spec 6.3 trait R&D mults (T): Greedy 0.8, Visionary 1.25, Conservative 0.9, Diligent 1.1. */
export const TRAIT_RD_MULTS: readonly (readonly [Trait, number])[] = [
  ["Greedy", 0.8],
  ["Visionary", 1.25],
  ["Conservative", 0.9],
  ["Diligent", 1.1],
];
/** Spec 6.3: rd_plan is clamped to 0 to 3 × rd_norm. */
export const RD_PLAN_MAX_NORMS = 3.0;

/** Spec 7.1: productivity at load (no 6.3 productivity adj). */
export const LOAD_PRODUCTIVITY = START_PRODUCTIVITY;

/**
 * Spec 6.1, first match: control_basis state; revenue below $50M in Tech; a controller with
 * Ambitious or Brave; with Greedy or Cautious; otherwise Incumbent. The rows are matched in table
 * order, as validate.py and the M3 profit check do (D120; design fix 105 asks whether the 6.1
 * note "takes the first trait in its list" should win instead). Rust `Archetype::at_load`.
 */
export function archetypeAtLoad(
  control_basis: string,
  revenue_usd: number,
  sector: string,
  traits: readonly Trait[],
): Archetype {
  return archetype({
    state_controlled: control_basis === STATE_CONTROL_BASIS,
    revenue_usd,
    tech: sector === STARTUP_SECTOR,
    traits,
  });
}

/** This archetype's row of `ARCHETYPE_TABLE` (Rust `Archetype::row`). */
export function archetypeRow(a: Archetype): ArchetypeRow {
  return ARCHETYPE_TABLE[ARCHETYPE_VALUES.indexOf(a)] as ArchetypeRow;
}

/** This archetype's row, by value (the 6.2 to 6.5 inputs; Rust `Archetype::params`). */
export function archetypeParams(a: Archetype): ArchetypeRow {
  return { ...archetypeRow(a) };
}

/** Spec 6.1 R&D mult (T; Rust `Archetype::rd_mult`). */
export function archetypeRdMult(a: Archetype): number {
  return archetypeRow(a).rd_mult;
}

/** Spec 6.1 payout mult (T), read by the 5.17 payout ratio (Rust `Archetype::payout_mult`). */
export function archetypePayoutMult(a: Archetype): number {
  return archetypeRow(a).payout_mult;
}

/** Rust `Archetype::name`. */
export function archetypeName(a: Archetype): string {
  switch (a) {
    case "StateChampion":
      return "State champion";
    case "Startup":
      return "Startup";
    case "AggressiveGrower":
      return "Aggressive grower";
    case "CashCow":
      return "Cash cow";
    case "Incumbent":
      return "Incumbent";
  }
}

/** What the archetype reads (spec 6.1), for the plan lock. */
export interface ArchetypeInputs {
  /**
   * companies.csv `control_basis` is `STATE_CONTROL_BASIS` (a born company is founder-controlled,
   * never state).
   */
  state_controlled: boolean;
  /** Trailing annual revenue, USD (starting revenue at load; the sized revenue at birth). */
  revenue_usd: number;
  /** The industry's sector is `STARTUP_SECTOR`. */
  tech: boolean;
  /**
   * The traits the AI reads (`planTraits`): the named controller's, or none for widely held
   * companies and companies born in play (5.19.5).
   */
  traits: readonly Trait[];
}

/**
 * The 6.1 first-match rule, the one place it is written (`archetypeAtLoad` calls it): State
 * champion; Startup (revenue below $50M in Tech); Aggressive grower (Ambitious or Brave); Cash
 * cow (Greedy or Cautious); otherwise Incumbent. Rows match in **table order** (D120), so a
 * controller with both Ambitious and Greedy is an Aggressive grower whatever the order of its
 * traits; design fix 105 asks Logan whether the 6.1 note ("takes the first trait in its list")
 * should win instead, which would change only the two trait rows here.
 */
export function archetype(i: ArchetypeInputs): Archetype {
  const has = (t: Trait): boolean => i.traits.includes(t);
  if (i.state_controlled) return "StateChampion";
  if (i.revenue_usd < STARTUP_REVENUE_BELOW_USD && i.tech) return "Startup";
  if (has("Ambitious") || has("Brave")) return "AggressiveGrower";
  if (has("Greedy") || has("Cautious")) return "CashCow";
  return "Incumbent";
}

/** Spec 6.3 trait mult: the product of the controller's trait mults. */
export function traitRdMult(traits: readonly Trait[]): number {
  let product = 1.0;
  for (const [t, k] of TRAIT_RD_MULTS) {
    if (traits.includes(t)) product *= k;
  }
  return product;
}

/**
 * The 6.3 R&D plan at load (spec 7.1 "Plan"): productivity 100 (no productivity adj) and loss_q
 * 0, so `rd_plan = clamp(rd_norm × archetype mult × trait mult − free R&D, 0, 3 × rd_norm)`, a
 * share of revenue. `free_rd` is a fraction.
 */
export function rdPlanAtLoad(
  rd_norm: number,
  archetype: Archetype,
  traits: readonly Trait[],
  free_rd: number,
): number {
  // The one 6.3 rule (`rdPlan`), at productivity 100 and loss_q 0; free R&D is a whole percent
  // there (D211).
  return rdPlan({
    rd_norm,
    archetype_rd_mult: archetypeRdMult(archetype),
    productivity: LOAD_PRODUCTIVITY,
    traits,
    loss_q: 0,
    free_rd_pct: toU32Sat(roundHalfAway(free_rd * PERCENT)),
  });
}
