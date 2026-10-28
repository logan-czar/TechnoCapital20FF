// The Lite AI on the World (build-plan M6.1 to M6.4): the plan at load (D283), the plan lock's
// batch (spec 4.4 row 3, section 6: every company not frozen, newborns included, in id order),
// and loss_q at each close (spec 6, 3.6). Ported from crates/sim/src/ai/jobs.rs.
//
// The formulas are lane F's pure functions in this module's siblings (./plan.ts composes 6.1 to
// 6.5); each job reads the World, calls them in company id order and writes the results back (the
// pure step contract, `world` docs). The batch draws only for a 6.6 raise (AI stream), which is
// parked: no industry is cash_burning, so it draws nothing with today's data.

import { dEff } from "../economy/assets.ts";
import { companyStatusIsFrozen } from "../finance/distress.ts";
import { grossAssets, payDividend, trailingRevenue } from "../finance/jobs.ts";
import { companyFinanceQuarters, companyFinanceStatus } from "../finance/state.ts";
import { ledgerEbit, ledgerFreeCashFlow, ledgerNetIncome, trailingFour } from "../finance/statements.ts";
import { setSharesOut } from "../market/jobs.ts";
import { failedRaise, newsWireQueue, raise } from "../news.ts";
import { confidenceFactor } from "../people/management.ts";
import { type JobCtx, type Scheduler, schedulerRegister } from "../time/scheduler.ts";
import type { CompanyId } from "../types/ids.ts";
import type { OperatingPlan } from "../types/state/ai.ts";
import type { Trait } from "../types/state/people.ts";
import type { Company, World } from "../types/world.ts";
import { companyDataIn, originIsBorn } from "../world/entities.ts";
import { worldPublishes } from "../world/index.ts";
import { STARTUP_SECTOR } from "./archetype.ts";
import { debtAggressionOf } from "./financing.ts";
import { focusOf } from "./focus.ts";
import { gDem, nextLossQuarters } from "./inputs.ts";
import { batchOrder, type PlanInputs, planFinancing, planOperations } from "./plan.ts";
import { raisePlan, rollRaise } from "./raise.ts";

/**
 * The plan at load (spec 6.5 last line, 7.1 Plan row; D283): each unit's growth is g_dem of the Q1
 * 2020 draw (no situation row, nudge or funding cap); R&D is the 6.3 rule at productivity 100 and
 * loss_q 0, set by the load with the units (`world/load`); stations stay the 7.1 loadout; no
 * financing move and no dividend. Call after the economy's load draws.
 */
export function planAtLoad(world: World): void {
  const { units, industries } = world;
  for (const u of units) {
    const ind = industries[u.industry] as World["industries"][number];
    u.growth_plan = gDem(ind.lt, ind.q_growth);
  }
}

/**
 * The traits the batch passes as the controller's (spec 6 "traits"): the named controller's when
 * it is a full character; `planTraits` drops them for a company born in play (5.19.5).
 */
function controllerTraits(world: World, id: CompanyId): readonly Trait[] | null {
  const ch = (world.companies[id] as Company).controller;
  return ch === null ? null : (world.characters[ch] as World["characters"][number]).traits;
}

/**
 * Everything one company's plan reads at the lock (spec 6 inputs, D262): TTM revenue and EBIT
 * from the archive (a company born at this lock, with no quarter, reads its run rate at birth),
 * the industry's lt, q_growth and S, the unit's productivity and free R&D, the books.
 */
function planInputs(world: World, id: CompanyId): PlanInputs {
  const c = world.companies[id] as Company;
  const ind = world.industries[c.industry] as World["industries"][number];
  const u = world.units[c.units[0] as number] as World["units"][number];
  const gross = grossAssets(world, c);
  const quarters = companyFinanceQuarters(c.finance);
  const ttm = trailingFour(quarters);
  let ttm_revenue = 0.0;
  let ttm_ebit = 0.0;
  if (ttm !== null) {
    ttm_revenue = trailingRevenue(c);
    ttm_ebit = ledgerEbit(ttm);
  } else if (c.birth_run_rate !== null) {
    ttm_revenue = c.birth_run_rate.revenue;
    ttm_ebit = c.birth_run_rate.ebit;
  }
  const last = quarters[quarters.length - 1];
  return {
    state_controlled: c.state_controlled,
    controller_traits: controllerTraits(world, id),
    born_in_play: originIsBorn(c.origin),
    tech: ind.sector === STARTUP_SECTOR,
    ttm_revenue,
    ttm_ebit,
    lt: ind.lt,
    q_growth: ind.q_growth,
    supply_ratio: ind.supply_ratio,
    loss_q: c.loss_quarters,
    gross_assets: gross,
    d_eff: dEff(gross, ind.params),
    cash: c.cash_usd,
    // Rust copies the line (`CreditLine: Copy`).
    line: { ...c.finance.line },
    status: companyFinanceStatus(c.finance),
    raise_pending: c.raise_pending,
    rd_norm: ind.params.rd_norm,
    data_tb_per_musd: ind.params.data_tb_per_musd,
    productivity: u.productivity,
    free_rd_pct: companyDataIn(c, c.industry)?.free_rd_pct ?? 0,
    labor: c.labor_units,
    last_quarter_net_income: last === undefined ? 0.0 : ledgerNetIncome(last.lines),
    debt_aggression: debtAggressionOf(world.debt_levels, id),
    focus: focusOf(world.focus_levels, id),
  };
}

/**
 * The 6.6 raise (parked: only for a cash_burning industry), tried after 6.2 to 6.4 and before
 * 6.5: a line draw or a share issue (listed) or private placement, by one AI-stream roll. A
 * success moves cash now (D125: booked in `pending`), a share issue dilutes every holder through
 * the new investors' line and keeps the index level (`setSharesOut`); a failure counts and holds
 * g at −d_eff until a raise succeeds. Each posts a headline (5.18).
 */
function tryRaise(world: World, ctx: JobCtx, id: CompanyId): void {
  const date = ctx.facts.date;
  const c = world.companies[id] as Company;
  const ind = world.industries[c.industry] as World["industries"][number];
  const s = world.market.stocks[id] as World["market"]["stocks"][number];
  const quarters = companyFinanceQuarters(c.finance);
  const lastQ = quarters[quarters.length - 1];
  const last_fcf = lastQ === undefined ? 0.0 : ledgerFreeCashFlow(lastQ.lines);
  const plan = raisePlan({
    cash_burning: ind.params.cash_burning,
    status: companyFinanceStatus(c.finance),
    last_quarter_fcf: last_fcf,
    cash: c.cash_usd,
    line: { ...c.finance.line },
    rating: c.finance.rating,
    listed: s.quoted,
    price: s.price,
    shares_out: c.shares_out,
    value_per_share: s.value,
    confidence_factor: confidenceFactor(c.management_score),
    label: ind.phase_label,
    failed_raises: c.failed_raises,
  });
  if (plan === null) return;
  const industry = c.industry;
  const name = c.name;
  if (!rollRaise(plan, ctx.draws)) {
    c.failed_raises += 1;
    c.raise_pending = true;
    newsWireQueue(world.news, failedRaise(date, industry, id, name, plan.method));
    return;
  }
  switch (plan.method) {
    case "CreditLine":
      c.cash_usd += plan.net;
      c.finance.line.drawn += plan.net;
      c.finance.pending.line_drawn_or_repaid += plan.net;
      break;
    case "ShareIssue":
      setSharesOut(world, id, c.shares_out + plan.new_shares);
      c.holders.push({ holder: { kind: "NewInvestors" }, shares: plan.new_shares });
      c.cash_usd += plan.net;
      c.finance.pending.shares_issued_net += plan.net;
      if (s.quoted) s.price = plan.price_after;
      break;
  }
  c.failed_raises = 0;
  c.raise_pending = false;
  // A company that does not publish raises without the wire printing the amount (D420).
  const net = worldPublishes(world, id) ? plan.net : null;
  newsWireQueue(world.news, raise(date, industry, id, name, plan.method, net));
}

/**
 * Writes an operating plan (spec 6.1 to 6.4): the archetype over the stored one (M4 set it at
 * load, D120), the growth and R&D plans to every unit, the 6.4 split to the company (4.3 step 4
 * fits it to L from now on, D118).
 */
function applyOperating(world: World, id: CompanyId, op: OperatingPlan): void {
  const c = world.companies[id] as Company;
  c.archetype = op.archetype;
  // Rust copies the stations (`Stations: Copy`).
  c.stations = { ...op.stations };
  for (const ui of c.units) {
    const u = world.units[ui] as World["units"][number];
    u.growth_plan = op.growth;
    u.rd_plan = op.rd_plan;
  }
}

/**
 * Plan lock step 4 (spec 4.4 row 3, section 6): every company not frozen, in id order (D2;
 * newborns included, they were born in steps 1 and 2), locks its plan: 6.1 to 6.4, the parked
 * 6.6 raise, then 6.5 on the cash and line after it. The draw or repayment moves cash and the
 * line now, and the dividend (5.17, computed once, in `ai/financing`) is paid through
 * `finance/jobs` `payDividend`; both wait in `pending` for the month's ledger (D125, D160).
 */
export function planLockJob(world: World, ctx: JobCtx): void {
  const statuses = world.companies.map(
    (c, id) => [id as CompanyId, companyFinanceStatus(c.finance)] as const,
  );
  for (const id of batchOrder(statuses)) {
    const op = planOperations(planInputs(world, id));
    applyOperating(world, id, op);
    tryRaise(world, ctx, id);
    const c = world.companies[id] as Company;
    const fin = planFinancing(planInputs(world, id), op, c.cash_usd, { ...c.finance.line });
    const moved = fin.draw - fin.repay;
    c.cash_usd += moved;
    c.finance.line.drawn += moved;
    c.finance.pending.line_drawn_or_repaid += moved;
    payDividend(world, id, fin.dividend);
    // Rust `From<Financing> for FinancingPlan`.
    c.plan = {
      operating: op,
      financing: { draw: fin.draw, repay: fin.repay, dividend: fin.dividend },
    };
  }
}

/**
 * The 4.4 close, after finance has archived the quarter (spec 6 loss_q, 3.6 `loss_quarters`):
 * each company not frozen counts one more loss quarter when the quarter's EBIT is below 0, else
 * starts again at 0.
 */
export function lossQuartersJob(world: World, _ctx: JobCtx): void {
  for (const c of world.companies) {
    if (companyStatusIsFrozen(companyFinanceStatus(c.finance))) continue;
    const quarters = companyFinanceQuarters(c.finance);
    const q = quarters[quarters.length - 1];
    if (q !== undefined) c.loss_quarters = nextLossQuarters(c.loss_quarters, ledgerEbit(q.lines));
  }
}

/**
 * Registers the Lite AI jobs (spec 4.4 close and plan lock step 4). Called from `jobs.ts`'s
 * `registerJobs` after finance (so loss_q reads the quarter the close just archived) and after
 * births (so the batch plans the companies born at this lock).
 */
export function register(s: Scheduler): void {
  schedulerRegister(s, "CloseStatements", "ai.loss_quarters", lossQuartersJob);
  schedulerRegister(s, "LockAiPlans", "ai.plan_lock", planLockJob);
}
