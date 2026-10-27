// The plan lock (spec 4.4 row 3, 21.7): the order of the lock's steps, the order of one company's
// plan (6.1 to 6.6) and the composed locked plan. Ported from crates/sim/src/ai/plan.rs.
//
// OperatingPlan, LockedPlan and FinancingPlan are in types/state/ai.ts.

import { companyStatusIsFrozen, companyStatusMayBuyAssets } from "../finance/distress.ts";
import type { CompanyId } from "../types/ids.ts";
import type { FinancingPlan, LockedPlan, OperatingPlan } from "../types/state/ai.ts";
import type { CompanyStatus, CreditLine } from "../types/state/finance.ts";
import type { Trait } from "../types/state/people.ts";
import { archetype, archetypeParams } from "./archetype.ts";
import { type Financing, financing } from "./financing.ts";
import { type FundingInputs, growthPlan, quarterPurchases } from "./growth.ts";
import { gDem, liquidity, minCash, planTraits, roa } from "./inputs.ts";
import { rdPlan } from "./rd.ts";
import { monthlyInflowTb, planStations } from "./split.ts";

export type { FinancingPlan, LockedPlan, OperatingPlan };

/**
 * The steps of the 4.4 plan lock, in the spec's order: startup events (5.19: fixed events due,
 * then random events, each startup with its cast), then IPO board votes and listings (5.20.1),
 * then every company's Lite AI plan in one batch, new companies included (section 6), then
 * consensus (5.16).
 */
export type LockStep =
  | "FixedStartupEvents"
  | "RandomStartupEvents"
  | "IpoVotes"
  | "Listings"
  | "LiteAiBatch"
  | "Consensus";

/** Spec 4.4 row 3: the lock's steps in order. */
export const PLAN_LOCK_ORDER: readonly LockStep[] = [
  "FixedStartupEvents",
  "RandomStartupEvents",
  "IpoVotes",
  "Listings",
  "LiteAiBatch",
  "Consensus",
];

/**
 * The steps of one company's plan inside the batch (spec 6.1 to 6.6): the 6.6 raise is checked
 * after 6.2 to 6.4 and before 6.5.
 */
export type PlanStep = "Archetype" | "Growth" | "Rd" | "StationSplit" | "Raise" | "FinancingAndDividend";

/** Spec 6, 6.6: one company's plan steps in order. */
export const COMPANY_PLAN_ORDER: readonly PlanStep[] = [
  "Archetype",
  "Growth",
  "Rd",
  "StationSplit",
  "Raise",
  "FinancingAndDividend",
];

/**
 * The companies the Lite AI batch plans (spec 6 "every company ... in one batch", 4.4 "new
 * companies included"), in id order (D2): every company that is not frozen (5.12 step 2: a
 * Bankrupt or Removed company makes no plan).
 */
export function batchOrder(companies: readonly (readonly [CompanyId, CompanyStatus])[]): CompanyId[] {
  const ids: CompanyId[] = companies.filter(([, s]) => !companyStatusIsFrozen(s)).map(([id]) => id);
  ids.sort((a, b) => a - b);
  return ids;
}

/** Everything one company's plan reads at the lock (spec 6 inputs, 6.1 to 6.5). */
export interface PlanInputs {
  /** companies.csv `control_basis` is `state`. */
  state_controlled: boolean;
  /** The named controller's traits, when the controller is a character. */
  controller_traits: readonly Trait[] | null;
  /** Born in play (5.19): its founders' traits are not read (5.19.5). */
  born_in_play: boolean;
  /** The industry's sector is Tech. */
  tech: boolean;
  /** Trailing annual revenue, USD (starting revenue at load; run rate at birth). */
  ttm_revenue: number;
  /** Trailing 4-quarter EBIT, USD (run rate at load and at birth, D262). */
  ttm_ebit: number;
  /** The industry's current lt (5.1). */
  lt: number;
  /** The industry's current q_growth (5.1). */
  q_growth: number;
  /** The industry's supply ratio S (5.2). */
  supply_ratio: number;
  /** Whole number (u32). */
  loss_q: number;
  gross_assets: number;
  /** d_eff of the unit (5.10). */
  d_eff: number;
  cash: number;
  line: CreditLine;
  status: CompanyStatus;
  /** A raise failed and none has succeeded since (6.6): g is held at −d_eff. */
  raise_pending: boolean;
  /** industries.csv `rd_norm`. */
  rd_norm: number;
  /** industries.csv `data_tb_per_musd`. */
  data_tb_per_musd: number;
  productivity: number;
  /** This month's free R&D, whole percent (5.9; u32). */
  free_rd_pct: number;
  /** Labor units L (5.10; u64). */
  labor: number;
  /** Net income of the quarter just released (5.17). */
  last_quarter_net_income: number;
  /** The experiment's debt aggression level (D971); 0 or absent is spec 6. */
  debt_aggression?: number;
}

/**
 * Spec 6.1 to 6.4 for one company: archetype, growth plan (with the funding cap), R&D plan and
 * station split. The traits read are the controller's, none for a born company (5.19.5).
 */
export function planOperations(i: PlanInputs): OperatingPlan {
  const traits = planTraits(i.controller_traits, i.born_in_play);
  const arch = archetype({
    state_controlled: i.state_controlled,
    revenue_usd: i.ttm_revenue,
    tech: i.tech,
    traits,
  });
  const params = archetypeParams(arch);
  const min_cash = minCash(i.ttm_revenue);
  const funding: FundingInputs = {
    gross_assets: i.gross_assets,
    d_eff: i.d_eff,
    liquidity: liquidity(i.cash, i.line),
    min_cash,
    purchases_stopped: !companyStatusMayBuyAssets(i.status) || i.raise_pending,
    debt_aggression: i.debt_aggression ?? 0,
  };
  const growth = growthPlan({
    loss_q: i.loss_q,
    roa: roa(i.ttm_ebit, i.gross_assets),
    g_dem: gDem(i.lt, i.q_growth),
    supply_ratio: i.supply_ratio,
    archetype: params,
    traits,
    tech: i.tech,
    funding,
    debt_aggression: i.debt_aggression ?? 0,
  });
  const rd = rdPlan({
    rd_norm: i.rd_norm,
    archetype_rd_mult: params.rd_mult,
    productivity: i.productivity,
    traits,
    loss_q: i.loss_q,
    free_rd_pct: i.free_rd_pct,
  });
  const inflow = monthlyInflowTb(i.ttm_revenue, i.data_tb_per_musd);
  return {
    archetype: arch,
    growth,
    rd_plan: rd,
    stations: planStations(i.labor, params, inflow, traits),
    planned_purchases: quarterPurchases(i.gross_assets, i.d_eff, growth),
    min_cash,
  };
}

/**
 * Spec 6.5 for one company after its operating plan (and after any 6.6 raise, whose cash and line
 * the caller passes in `cash` and `line`).
 */
export function planFinancing(i: PlanInputs, op: OperatingPlan, cash: number, line: CreditLine): Financing {
  return financing({
    cash,
    line,
    min_cash: op.min_cash,
    planned_purchases: op.planned_purchases,
    traits: planTraits(i.controller_traits, i.born_in_play),
    last_quarter_net_income: i.last_quarter_net_income,
    archetype_payout_mult: archetypeParams(op.archetype).payout_mult,
    status: i.status,
    debt_aggression: i.debt_aggression ?? 0,
  });
}

/**
 * One company's locked plan with no 6.6 raise (spec 6.1 to 6.5; every company in the MVP, where no
 * industry is cash_burning). Also the plan at load (7.1 Plan row: loss_q 0, D119).
 */
export function lockPlan(i: PlanInputs): LockedPlan {
  const operating = planOperations(i);
  const fin = planFinancing(i, operating, i.cash, i.line);
  return {
    operating,
    // Rust `From<Financing> for FinancingPlan`.
    financing: { draw: fin.draw, repay: fin.repay, dividend: fin.dividend },
  };
}
