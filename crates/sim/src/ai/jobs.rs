//! The Lite AI on the World (build-plan M6.1 to M6.4): the plan at load (D283), the plan lock's
//! batch (spec 4.4 row 3, section 6: every company not frozen, newborns included, in id order),
//! and loss_q at each close (spec 6, 3.6).
//!
//! The formulas are lane F's pure functions in this module's siblings ([`super::plan`] composes
//! 6.1 to 6.5); each job reads the World, calls them in company id order and writes the results
//! back (the pure step contract, `world` docs). The batch draws only for a 6.6 raise (AI stream),
//! which is parked: no industry is cash_burning, so it draws nothing with today's data.

use super::inputs::{g_dem, next_loss_quarters};
use super::plan::{
    LockedPlan, OperatingPlan, PlanInputs, batch_order, plan_financing, plan_operations,
};
use super::raise::{RaiseInputs, RaiseMethod, raise_plan, roll_raise};
use crate::economy::assets::d_eff;
use crate::finance::credit::CreditLine;
use crate::finance::jobs::{gross_assets, pay_dividend, trailing_revenue};
use crate::finance::statements::trailing_four;
use crate::market::jobs::set_shares_out;
use crate::news;
use crate::people::management::confidence_factor;
use crate::people::traits::Trait;
use crate::time::{JobCtx, Scheduler, Slot};
use crate::world::{CompanyId, Holder, Holding, World};

/// The plan at load (spec 6.5 last line, 7.1 Plan row; D283): each unit's growth is g_dem of the
/// Q1 2020 draw (no situation row, nudge or funding cap); R&D is the 6.3 rule at productivity 100
/// and loss_q 0, set by the load with the units (`world::load`); stations stay the 7.1 loadout;
/// no financing move and no dividend. Call after the economy's load draws.
pub fn plan_at_load(world: &mut World) {
    let World {
        units, industries, ..
    } = world;
    for (_, u) in units.iter_mut() {
        let ind = &industries[u.industry];
        u.growth_plan = g_dem(ind.lt, ind.q_growth);
    }
}

/// The traits the batch passes as the controller's (spec 6 "traits"): the named controller's
/// when it is a full character; `plan_traits` drops them for a company born in play (5.19.5).
fn controller_traits(world: &World, id: CompanyId) -> Option<&[Trait]> {
    world.companies[id]
        .controller
        .map(|ch| &world.characters[ch].traits[..])
}

/// Everything one company's plan reads at the lock (spec 6 inputs, D262): TTM revenue and EBIT
/// from the archive (a company born at this lock, with no quarter, reads its run rate at birth),
/// the industry's lt, q_growth and S, the unit's productivity and free R&D, the books.
fn plan_inputs(world: &World, id: CompanyId) -> PlanInputs<'_> {
    let c = &world.companies[id];
    let ind = &world.industries[c.industry];
    let u = &world.units[c.units[0]];
    let gross = gross_assets(world, c);
    let quarters = c.finance.quarters();
    let ttm = trailing_four(quarters);
    let (ttm_revenue, ttm_ebit) = match (ttm, c.birth_run_rate) {
        (Some(l), _) => (trailing_revenue(c), l.ebit()),
        (None, Some(r)) => (r.revenue, r.ebit),
        (None, None) => (0.0, 0.0),
    };
    PlanInputs {
        state_controlled: c.state_controlled,
        controller_traits: controller_traits(world, id),
        born_in_play: c.origin.is_born(),
        tech: ind.sector == super::archetype::STARTUP_SECTOR,
        ttm_revenue,
        ttm_ebit,
        lt: ind.lt,
        q_growth: ind.q_growth,
        supply_ratio: ind.supply_ratio,
        loss_q: c.loss_quarters,
        gross_assets: gross,
        d_eff: d_eff(gross, &ind.params),
        cash: c.cash_usd,
        line: c.finance.line,
        status: c.finance.status(),
        raise_pending: c.raise_pending,
        rd_norm: ind.params.rd_norm,
        data_tb_per_musd: ind.params.data_tb_per_musd,
        productivity: u.productivity,
        free_rd_pct: c.data_in(c.industry).map_or(0, |b| b.free_rd_pct),
        labor: c.labor_units,
        last_quarter_net_income: quarters.last().map_or(0.0, |q| q.lines.net_income()),
    }
}

/// The 6.6 raise (parked: only for a cash_burning industry), tried after 6.2 to 6.4 and before
/// 6.5: a line draw or a share issue (listed) or private placement, by one AI-stream roll. A
/// success moves cash now (D125: booked in `pending`), a share issue dilutes every holder through
/// the new investors' line and keeps the index level (`set_shares_out`); a failure counts and
/// holds g at −d_eff until a raise succeeds. Each posts a headline (5.18).
fn try_raise(world: &mut World, ctx: &mut JobCtx<'_>, id: CompanyId) {
    let date = ctx.facts.date;
    let c = &world.companies[id];
    let ind = &world.industries[c.industry];
    let s = &world.market.stocks[id];
    let last_fcf = c
        .finance
        .quarters()
        .last()
        .map_or(0.0, |q| q.lines.free_cash_flow());
    let Some(plan) = raise_plan(&RaiseInputs {
        cash_burning: ind.params.cash_burning,
        status: c.finance.status(),
        last_quarter_fcf: last_fcf,
        cash: c.cash_usd,
        line: c.finance.line,
        rating: c.finance.rating,
        listed: s.quoted,
        price: s.price,
        shares_out: c.shares_out,
        value_per_share: s.value,
        confidence_factor: confidence_factor(c.management_score),
        label: ind.phase_label,
        failed_raises: c.failed_raises,
    }) else {
        return;
    };
    let (industry, name) = (c.industry, c.name.clone());
    if !roll_raise(&plan, ctx.draws) {
        let c = &mut world.companies[id];
        c.failed_raises += 1;
        c.raise_pending = true;
        world
            .news
            .queue(news::failed_raise(date, industry, id, &name, plan.method));
        return;
    }
    match plan.method {
        RaiseMethod::CreditLine => {
            let c = &mut world.companies[id];
            c.cash_usd += plan.net;
            c.finance.line.drawn += plan.net;
            c.finance.pending.line_drawn_or_repaid += plan.net;
        }
        RaiseMethod::ShareIssue => {
            let old = world.companies[id].shares_out;
            set_shares_out(world, id, old + plan.new_shares);
            let c = &mut world.companies[id];
            c.holders.push(Holding {
                holder: Holder::NewInvestors,
                shares: plan.new_shares,
            });
            c.cash_usd += plan.net;
            c.finance.pending.shares_issued_net += plan.net;
            let s = &mut world.market.stocks[id];
            if s.quoted {
                s.price = plan.price_after;
            }
        }
    }
    let c = &mut world.companies[id];
    c.failed_raises = 0;
    c.raise_pending = false;
    // A company that does not publish raises without the wire printing the amount (D420).
    let net = world.publishes(id).then_some(plan.net);
    world
        .news
        .queue(news::raise(date, industry, id, &name, plan.method, net));
}

/// Writes an operating plan (spec 6.1 to 6.4): the archetype over the stored one (M4 set it at
/// load, D120), the growth and R&D plans to every unit, the 6.4 split to the company (4.3 step 4
/// fits it to L from now on, D118).
fn apply_operating(world: &mut World, id: CompanyId, op: &OperatingPlan) {
    let c = &mut world.companies[id];
    c.archetype = op.archetype;
    c.stations = op.stations;
    for &u in &c.units {
        let u = &mut world.units[u];
        u.growth_plan = op.growth;
        u.rd_plan = op.rd_plan;
    }
}

/// Plan lock step 4 (spec 4.4 row 3, section 6): every company not frozen, in id order (D2;
/// newborns included, they were born in steps 1 and 2), locks its plan: 6.1 to 6.4, the parked
/// 6.6 raise, then 6.5 on the cash and line after it. The draw or repayment moves cash and the
/// line now, and the dividend (5.17, computed once, in `ai::financing`) is paid through
/// `finance::jobs::pay_dividend`; both wait in `pending` for the month's ledger (D125, D160).
pub fn plan_lock_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let statuses: Vec<_> = world
        .companies
        .iter()
        .map(|(id, c)| (id, c.finance.status()))
        .collect();
    for id in batch_order(&statuses) {
        let op = plan_operations(&plan_inputs(world, id));
        apply_operating(world, id, &op);
        try_raise(world, ctx, id);
        let c = &world.companies[id];
        let (cash, line): (f64, CreditLine) = (c.cash_usd, c.finance.line);
        let fin = plan_financing(&plan_inputs(world, id), &op, cash, line);
        let c = &mut world.companies[id];
        let moved = fin.draw - fin.repay;
        c.cash_usd += moved;
        c.finance.line.drawn += moved;
        c.finance.pending.line_drawn_or_repaid += moved;
        pay_dividend(world, id, fin.dividend);
        world.companies[id].plan = Some(LockedPlan {
            operating: op,
            financing: fin.into(),
        });
    }
}

/// The 4.4 close, after finance has archived the quarter (spec 6 loss_q, 3.6 `loss_quarters`):
/// each company not frozen counts one more loss quarter when the quarter's EBIT is below 0, else
/// starts again at 0.
pub fn loss_quarters_job(world: &mut World, _: &mut JobCtx<'_>) {
    for (_, c) in world.companies.iter_mut() {
        if c.finance.status().is_frozen() {
            continue;
        }
        if let Some(q) = c.finance.quarters().last() {
            c.loss_quarters = next_loss_quarters(c.loss_quarters, q.lines.ebit());
        }
    }
}

/// Registers the Lite AI jobs (spec 4.4 close and plan lock step 4). Called from `lib.rs`'s
/// `register_jobs` after finance (so loss_q reads the quarter the close just archived) and after
/// births (so the batch plans the companies born at this lock).
pub fn register(s: &mut Scheduler) {
    s.register(Slot::CloseStatements, "ai.loss_quarters", loss_quarters_job);
    s.register(Slot::LockAiPlans, "ai.plan_lock", plan_lock_job);
}
