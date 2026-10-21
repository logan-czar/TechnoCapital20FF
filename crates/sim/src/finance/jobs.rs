//! The books on the World (build-plan M4.1 to M4.9): the load's starting rating, line and
//! synthetic history (spec 7.1, 4.4), the monthly ledger through 4.3 steps 9 to 14, the 4.4
//! close (tax paid, statements, archive), the release (removals), the 01:00 rating and credit
//! line review, the 4.5 yearly statements, and the dividend rule ready for the M6 plan lock.
//!
//! The formulas are lane F's pure functions in this module's siblings; each job reads the World,
//! calls them in company id order and writes the results back (the pure step contract, `world`
//! docs). Nothing here draws.
//!
//! A month's ledger is opened at step 9 (from the flows booked since the last close), filled at
//! steps 11, 12 and 13 and posted at step 14. A company frozen when step 9 opens its month
//! (Bankrupt or Removed) posts an empty month (D231). Every posted month of a company still in
//! the game is checked against the balance identity and rolled forward (M4.9, [`check_month`]);
//! the quarter-end month after the close has paid the tax.

use super::balance::{BalanceSheet, Books, balance_sheet, check_month};
use super::credit::{
    CreditLine, MONTHS_PER_YEAR, home_spread, line_limit, line_rate, min_cash, monthly_charges,
    review_line,
};
use super::distress::{
    CompanyStatus, SettleInputs, on_quarter_close, removal_due, remove, settle_month,
};
use super::rating::{
    RatingInputs, StartRatingInputs, implied_rating, notches_between, review_move, starting_rating,
};
use super::state::{Archive, PostedMonth};
use super::statements::{
    KeyFigures, Ledger, MONTHS_PER_QUARTER, Period, QUARTERS_PER_YEAR, SYNTHETIC_YEAR,
    quarter_statement, synthetic_history, trailing_four, year_statement,
};
use super::tax::{accrue_month, close_quarter, quarter_tax};
use crate::ai::archetype::rd_plan_at_load;
use crate::economy::PRODUCTIVITY_SCALE;
use crate::economy::QUARTERS_PER_YEAR as QUARTERS_PER_YEAR_F64;
use crate::economy::assets::sale_factor;
use crate::economy::revenue::variable_cost_share;
use crate::ops::stations::BAREBONES_REVENUE_USD;
use crate::people::traits::Trait;
use crate::time::{JobCtx, Scheduler, Slot};
use crate::world::{AlertKind, AlertPayload, Company, CompanyId, World};

// ---------------------------------------------------------------------------------------------
// Reading a company's books from the World.

/// Σ units asset_book (spec 3.5 `book_equity`, 3.9 business assets at book).
pub fn asset_book(world: &World, c: &Company) -> f64 {
    c.units.iter().map(|&u| world.units[u].asset_book).sum()
}

/// Σ units gross_assets (spec 3.6).
pub fn gross_assets(world: &World, c: &Company) -> f64 {
    c.units.iter().map(|&u| world.units[u].gross_assets).sum()
}

/// The balances the balance sheet reads (spec 3.9).
pub fn books(world: &World, c: &Company) -> Books {
    Books {
        cash: c.cash_usd,
        asset_book: asset_book(world, c),
        line_drawn: c.finance.line.drawn,
        tax: c.finance.tax,
    }
}

/// The company's balance sheet now (spec 3.9; D230).
pub fn sheet(world: &World, c: &Company) -> BalanceSheet {
    balance_sheet(&books(world, c), c.finance.status())
}

/// The company's home spread (spec 5.1.2 batch 156, 5.12): half its zone's credit spread, half
/// its HQ country's sovereign spread. `base` reads the zone's base spread, as the load does
/// (D235); otherwise the effective spread of the quarter.
pub fn company_home_spread(world: &World, c: &Company, base: bool) -> f64 {
    let country = &world.countries[c.hq_country];
    let zone = &world.zones[country.zone];
    let zone_spread = if base {
        zone.credit_spread_base
    } else {
        zone.credit_spread
    };
    home_spread(zone_spread, country.sovereign_spread)
}

/// Trailing annual revenue (spec 6 min_cash, 3.7.1 company size): the trailing four quarters'
/// revenue (D129); 0 with no statements.
pub fn trailing_revenue(c: &Company) -> f64 {
    trailing_four(c.finance.quarters()).map_or(0.0, |l| l.revenue)
}

/// The traits of the company's named controller, if it is a full character (spec 6 "traits").
pub fn controller_traits<'a>(world: &'a World, c: &Company) -> &'a [Trait] {
    c.controller
        .map_or(&[][..], |ch| &world.characters[ch].traits[..])
}

/// Key figures at a period end (spec 3.9): productivity (the units' mean), PC bonus, labor
/// units, held TB, free R&D % of the main industry, management score and rating. The guidance
/// range is the 5.16 projection's (M6); (0, 0) until then.
pub fn key_figures(world: &World, c: &Company) -> KeyFigures {
    let n = c.units.len().max(1) as f64;
    let productivity = c
        .units
        .iter()
        .map(|&u| world.units[u].productivity)
        .sum::<f64>()
        / n;
    KeyFigures {
        productivity,
        pc_bonus: c.pc_bonus.max(0.0) as u32,
        labor_units: c.labor_units,
        held_tb: c.data.iter().map(|d| d.book.held).sum(),
        free_rd_pct: c.data_in(c.industry).map_or(0, |b| b.free_rd_pct),
        management_score: c.management_score,
        rating: c.finance.rating,
        guidance: (0.0, 0.0),
    }
}

// ---------------------------------------------------------------------------------------------
// Load (spec 7.1, 4.4).

/// The starting run rate of one company (spec 7.1 "Rating", "History"; D121): the 7.1 company
/// at M 1.0 for a year. Each unit makes the revenue 7.1 sized it for (companies.csv R; a
/// barebones unit its $100,000 at its p_pre), variable cost `v × revenue`, and fixed cash,
/// depreciation and shared costs together `f × revenue × 100 ÷ p_pre` (5.5: the fixed cost rate
/// holds them at `f × turnover × gross`), split as the load month splits them (depreciation and
/// the 3.8 bill as booked, fixed cash the rest). Paid R&D is the 6.3 plan (archetype and trait
/// mults less free R&D, productivity 100, loss_q 0). The line is at the starting rating (5.12) on
/// company-start.csv's cash and line, tax on each quarter's pre-tax income with no carryforward
/// (5.11) and replacement purchases equal to depreciation (a flat history, D228). Returns the
/// year's ledger, the implied rating of the run rate (7.1, 5.12) and the line, both at the
/// company's starting rating: company-start.csv's, which the implied rating must equal (D241,
/// D132; checked for all 651 in `m4_ratings.rs`).
///
/// The load month itself runs at the load M and on gross assets rounded to the dollar, about
/// 1e-7 off R, enough to move a rating that D236 sizes to a band edge; the run rate does not.
pub fn run_rate(world: &World, c: &Company) -> (Ledger, super::rating::ImpliedRating, CreditLine) {
    let traits = controller_traits(world, c);
    let mut l = Ledger::default();
    let sole = c.units.len() == 1;
    for &u in &c.units {
        let u = &world.units[u];
        let params = &world.industries[u.industry].params;
        let free = c.data_in(u.industry).map_or(0.0, |b| b.free_rd_fraction());
        let p_pre = crate::economy::supply::p_pre(u, c);
        // 7.1: the unit makes R at M 1.0 (one unit per company in the MVP); below $0.1M the
        // barebones loadout makes its assets at p_pre (D107).
        let revenue = if sole && c.revenue_usd >= BAREBONES_REVENUE_USD {
            c.revenue_usd
        } else {
            u.assets_eff() * params.asset_turnover * p_pre / PRODUCTIVITY_SCALE
        };
        let fixed_total = params.fixed_cost_share * revenue * PRODUCTIVITY_SCALE / p_pre;
        let depreciation = MONTHS_PER_YEAR * u.dep_m;
        let shared = MONTHS_PER_YEAR * u.shared_m;
        l.revenue += revenue;
        l.variable += revenue * variable_cost_share(params);
        l.fixed_cash += fixed_total - depreciation - shared;
        l.shared += shared;
        l.depreciation += depreciation;
        l.rd += revenue * rd_plan_at_load(params.rd_norm, c.archetype, traits, free);
    }
    let cash = c.cash_usd;
    let drawn = c.finance.line.drawn;
    let book = asset_book(world, c);
    // D235: the zone's base spread at load.
    let home = company_home_spread(world, c, true);
    let country = &world.countries[c.hq_country];
    let start = starting_rating(&StartRatingInputs {
        cash,
        line_drawn: drawn,
        ebitda: l.ebitda(),
        revenue: l.revenue,
        industry_key: &world.industries[c.industry].key,
        sovereign: country.sovereign_rating,
        base_rate: world.base_rate,
        home_spread: home,
    });
    let rating = c.finance.rating;
    let line = CreditLine {
        drawn,
        limit: line_limit(book, cash, drawn, rating),
        excess_months_left: 0,
    };
    let charges = monthly_charges(
        drawn,
        line.limit,
        cash,
        line_rate(world.base_rate, home, rating),
        world.base_rate,
    );
    l.line_interest = MONTHS_PER_YEAR * charges.interest;
    l.line_fee = MONTHS_PER_YEAR * charges.undrawn_fee;
    l.interest_income = MONTHS_PER_YEAR * charges.cash_interest;
    let quarter_pti = l.pre_tax_income() / QUARTERS_PER_YEAR_F64;
    l.tax = QUARTERS_PER_YEAR_F64 * quarter_tax(quarter_pti, 0.0, country.corp_tax_rate).tax;
    l.tax_paid = l.tax;
    l.asset_purchases = l.depreciation;
    (l, start, line)
}

/// The finance start state (spec 7.1, 4.4; build-plan M4.2, M4.4, M4.5): each company's run
/// rate and its implied rating (the starting rating itself is company-start.csv's, D241), its
/// line limit, the four synthetic 2019 quarters and the 2019 year, and the opening balance sheet
/// of January 2020. Call once, after the economy and the boards
/// are set (their load month and management scores feed it); it draws nothing.
pub fn start(world: &mut World) {
    for id in world.companies.ids() {
        let c = &world.companies[id];
        let (annual, implied, line) = run_rate(world, c);
        let status = CompanyStatus::Active;
        let opening = balance_sheet(
            &Books {
                cash: c.cash_usd,
                asset_book: asset_book(world, c),
                line_drawn: line.drawn,
                tax: Default::default(),
            },
            status,
        );
        let history = synthetic_history(&annual, opening, key_figures(world, c));
        let year = year_statement(SYNTHETIC_YEAR, &history);
        let f = &mut world.companies[id].finance;
        f.implied = implied;
        f.line = line;
        f.opening = opening;
        f.archive = std::sync::Arc::new(Archive {
            quarters: history.to_vec(),
            years: vec![year],
        });
    }
}

// ---------------------------------------------------------------------------------------------
// The monthly jobs (spec 4.3 steps 9 to 14).

/// 4.3 step 9 (finance part, after the economy's expenses): opens each company's month from the
/// flows booked since the last close (D125) and posts revenue, variable, fixed cash, R&D and
/// shared costs (5.5). Depreciation posts at step 11 with the asset decay it equals.
pub fn open_month_job(world: &mut World, _: &mut JobCtx<'_>) {
    let World {
        companies, units, ..
    } = world;
    for (_, c) in companies.iter_mut() {
        let f = &mut c.finance;
        f.month = std::mem::take(&mut f.pending);
        f.month_active = !f.status().is_frozen();
        if !f.month_active {
            continue;
        }
        for &u in &c.units {
            let u = &units[u];
            f.month.revenue += u.revenue_m;
            f.month.variable += u.variable_m;
            f.month.fixed_cash += u.fixed_m;
            f.month.rd += u.rd_m;
            f.month.shared += u.shared_m;
        }
    }
}

/// 4.3 step 11 (finance part, after the economy's asset step): depreciation (this month's asset
/// decay off the book, 5.5), asset purchases, growth plan sale proceeds and their gain (5.10).
pub fn post_assets_job(world: &mut World, _: &mut JobCtx<'_>) {
    let World {
        companies, units, ..
    } = world;
    for (_, c) in companies.iter_mut() {
        let f = &mut c.finance;
        if !f.month_active {
            continue;
        }
        for &u in &c.units {
            let u = &units[u];
            f.month.depreciation += u.dep_m;
            f.month.asset_purchases += u.capex_m;
            f.month.asset_sale_proceeds += u.sale_proceeds_m;
            f.month.asset_sale_gain += u.sale_gain_m;
        }
    }
}

/// 4.3 step 12 (spec 5.12 "Monthly"): line interest, the undrawn fee and interest on own cash,
/// on the month's opening balances, at `base_rate + home_spread + corporate spread(rating)` with
/// the zone's effective spread of the quarter (D235).
pub fn interest_job(world: &mut World, _: &mut JobCtx<'_>) {
    let charges: Vec<Option<super::credit::LineCharges>> = world
        .companies
        .iter()
        .map(|(_, c)| {
            let f = &c.finance;
            f.month_active.then(|| {
                let home = company_home_spread(world, c, false);
                monthly_charges(
                    f.line.drawn,
                    f.line.limit,
                    c.cash_usd,
                    line_rate(world.base_rate, home, f.rating),
                    world.base_rate,
                )
            })
        })
        .collect();
    for ((_, c), ch) in world.companies.iter_mut().zip(charges) {
        if let Some(ch) = ch {
            c.finance.month.line_interest = ch.interest;
            c.finance.month.line_fee = ch.undrawn_fee;
            c.finance.month.interest_income = ch.cash_interest;
        }
    }
}

/// 4.3 step 13 (spec 5.12): cash settles with the month's flows (operating cash, purchases and
/// growth plan sales; D124), then lane F's [`settle_month`]: auto-draw, the review excess, the
/// plan's auto-repay (6.5), forced sales at the industry's sale factor (5.10) and the distress
/// count and bankruptcy. A forced sale takes the same share of every unit's gross assets, book
/// and ramping tranches. A company that goes Bankrupt raises Bankruptcy in watchlist (the
/// scheduler keeps it only for watchlist companies, spec 8), leaves supply from the next step 6
/// (it is frozen) and is wiped (equity 0, its residual on the estate line, D230).
pub fn settle_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let today = ctx.facts.date;
    for id in world.companies.ids() {
        let c = &world.companies[id];
        if !c.finance.month_active {
            continue;
        }
        let m = &c.finance.month;
        let cash = c.cash_usd + m.operating_cash() - m.asset_purchases + m.asset_sale_proceeds;
        let label = world.industries[c.industry].phase_label;
        let s = settle_month(&SettleInputs {
            cash,
            line: c.finance.line,
            min_cash: min_cash(trailing_revenue(c)),
            gross_assets: gross_assets(world, c),
            asset_book: asset_book(world, c),
            sale_factor: sale_factor(label),
            state: c.finance.distress,
        });
        let share = s.forced_sale.share;
        if share > 0.0 {
            let unit_ids = world.companies[id].units.clone();
            for u in unit_ids {
                let u = &mut world.units[u];
                if share >= 1.0 {
                    u.gross_assets = 0.0;
                    u.asset_book = 0.0;
                    u.ramping.clear();
                } else {
                    let keep = 1.0 - share;
                    u.gross_assets *= keep;
                    u.asset_book *= keep;
                    for t in &mut u.ramping {
                        t.amount *= keep;
                    }
                }
            }
        }
        let c = &mut world.companies[id];
        c.cash_usd = s.cash;
        let f = &mut c.finance;
        f.line = s.line;
        f.distress = s.state;
        f.month.line_drawn_or_repaid += s.line_change();
        f.month.asset_sale_proceeds += s.forced_sale.proceeds;
        f.month.asset_sale_gain += s.forced_sale.gain;
        if s.went_bankrupt {
            f.bankrupt_on = Some(today);
            ctx.raise_alert(AlertKind::BankruptcyInWatchlist, AlertPayload::Company(id));
        }
    }
}

/// 4.3 step 14 (spec 5.11): tax accrues on the quarter so far (D227), then the month is posted.
/// Outside a quarter end the M4.9 check runs here; at a quarter end it runs in the close, after
/// the tax is paid (D122).
pub fn ledger_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let closed = ctx.facts.date.month_of().prev();
    let quarter_end = ctx.facts.is_quarter_start();
    for id in world.companies.ids() {
        let rate = world.countries[world.companies[id].hq_country].corp_tax_rate;
        let f = &mut world.companies[id].finance;
        if !f.in_game() {
            continue;
        }
        if f.month_active {
            let pti = f.month.pre_tax_income();
            f.month.tax = accrue_month(&mut f.tax, pti, rate);
        }
        let posted = PostedMonth {
            month: closed,
            lines: std::mem::take(&mut f.month),
        };
        f.months.push(posted);
        f.last_month = Some(posted);
        if !quarter_end {
            check_and_roll(world, id);
        }
    }
}

/// The M4.9 check of the month just posted (spec 3.9; build-plan M4.9): the closing sheet
/// balances, and cash, book, line, tax payable and equity plus estate roll forward from the
/// opening sheet through the month's ledger. Failures are counted on the World, not raised, so a
/// run reports them (`World::books_check`). The closing sheet becomes the next opening.
pub fn check_and_roll(world: &mut World, id: CompanyId) {
    let c = &world.companies[id];
    let closing = sheet(world, c);
    let Some(posted) = c.finance.last_month else {
        return;
    };
    let result = check_month(
        &c.finance.opening,
        &posted.lines,
        &closing,
        c.finance.status(),
    );
    let key = c.key.clone();
    let log = &mut world.books_check;
    log.checked += 1;
    if let Err(e) = result {
        log.failures += 1;
        if log.first_failure.is_none() {
            log.first_failure = Some(format!("{key} {}: {e}", posted.month));
        }
    }
    world.companies[id].finance.opening = closing;
}

// ---------------------------------------------------------------------------------------------
// The quarterly and yearly jobs (spec 4.4, 4.5).

/// 4.4 Close and compile, after the monthly job (spec 4.4, 5.11; D122): each company still in
/// the game pays the quarter's accrued tax from cash (frozen companies keep it payable for the
/// removal, D233), booked as the quarter's last month's tax paid; the M4.9 check runs for that
/// month; the quarter's statement is built from its three months (unpublished until the release)
/// and archived (20 quarters); a Bankrupt company counts a frozen quarter (D232).
pub fn close_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let quarter = ctx.facts.date.quarter().prev();
    for id in world.companies.ids() {
        let c = &mut world.companies[id];
        if !c.finance.in_game() {
            continue;
        }
        if !c.finance.status().is_frozen() {
            let paid = close_quarter(&mut c.finance.tax).tax;
            c.cash_usd -= paid;
            if let Some(last) = c.finance.months.last_mut() {
                last.lines.tax_paid += paid;
                c.finance.last_month = Some(*last);
            }
        }
        check_and_roll(world, id);
        let c = &world.companies[id];
        let mut months = [Ledger::default(); MONTHS_PER_QUARTER];
        let posted = &c.finance.months;
        let n = posted.len().min(MONTHS_PER_QUARTER);
        for (slot, m) in months[MONTHS_PER_QUARTER - n..]
            .iter_mut()
            .zip(&posted[posted.len() - n..])
        {
            *slot = m.lines;
        }
        let statement = quarter_statement(quarter, &months, sheet(world, c), key_figures(world, c));
        let f = &mut world.companies[id].finance;
        f.push_quarter(statement);
        f.months.clear();
        f.distress = on_quarter_close(f.distress);
    }
}

/// 4.4 Release, 00:00 (spec 5.12 step 3, C30): a Bankrupt company past its 2 frozen quarters is
/// removed. Its assets sell at the Bust factor to repay the line, then tax; the rest is written
/// off and any cash left leaves the game (D233). Each unit's remaining gross assets go back to
/// its industry's fringe pool, which the next step 6 supply counts; the simple characters are
/// discarded; the filings stay in the company's archive (D127).
pub fn removals_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let today = ctx.facts.date;
    for id in world.companies.ids() {
        let c = &world.companies[id];
        if !removal_due(c.finance.distress) {
            continue;
        }
        let (state, removal) = remove(c.finance.distress, &books(world, c), gross_assets(world, c));
        let unit_ids = c.units.clone();
        for u in unit_ids {
            let unit = &mut world.units[u];
            world.industries[unit.industry].fringe_assets += unit.gross_assets.max(0.0);
            unit.gross_assets = 0.0;
            unit.asset_book = 0.0;
            unit.ramping.clear();
        }
        let c = &mut world.companies[id];
        c.cash_usd = 0.0;
        c.board = Default::default();
        c.seats_to_fill.clear();
        let f = &mut c.finance;
        f.line = CreditLine::default();
        f.tax = Default::default();
        f.distress = state;
        f.removed_on = Some(today);
        f.removal = Some(removal);
    }
}

/// 4.4 price move, 01:00 on release days (spec 5.12, 3.6.3, 3.6.4): the implied rating from net
/// debt now (line drawn less cash) and the trailing four quarters' EBITDA, line interest and
/// revenue, then a move of 1 notch toward it, 2 when 3 or more away. Frozen companies are not
/// reviewed (D131).
pub fn rating_review_job(world: &mut World, _: &mut JobCtx<'_>) {
    for id in world.companies.ids() {
        let c = &world.companies[id];
        if c.finance.status().is_frozen() {
            continue;
        }
        let Some(ttm) = trailing_four(c.finance.quarters()) else {
            continue;
        };
        let implied = implied_rating(&RatingInputs {
            net_debt: c.finance.line.drawn - c.cash_usd,
            ebitda: ttm.ebitda(),
            interest: ttm.line_interest,
            revenue: ttm.revenue,
            industry_key: &world.industries[c.industry].key,
            sovereign: world.countries[c.hq_country].sovereign_rating,
        });
        let f = &mut world.companies[id].finance;
        let moved = review_move(f.rating, implied.implied);
        f.last_review_notches = notches_between(f.rating, moved);
        f.rating = moved;
        f.implied = implied;
    }
}

/// 4.4 price move, after the rating review (spec 5.12 "Review", 10.0.9): the limit is recomputed
/// at the new rating; a company over it gets 3 months to repay the excess (D224).
pub fn line_review_job(world: &mut World, _: &mut JobCtx<'_>) {
    for id in world.companies.ids() {
        let c = &world.companies[id];
        if c.finance.status().is_frozen() {
            continue;
        }
        let limit = line_limit(
            asset_book(world, c),
            c.cash_usd,
            c.finance.line.drawn,
            c.finance.rating,
        );
        let f = &mut world.companies[id].finance;
        f.line = review_line(f.line, limit);
    }
}

/// 4.5 step 1 (1 January, after the Q4 close): the year's statement, the sum of its four
/// quarters, archived (5 years, D228). A company without the year's four quarters (none of the
/// 651; born companies from M6) gets none.
pub fn annual_statements_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let year = ctx.facts.date.year - 1;
    for (_, c) in world.companies.iter_mut() {
        let f = &mut c.finance;
        let quarters = f.quarters();
        if !f.in_game() || quarters.len() < QUARTERS_PER_YEAR {
            continue;
        }
        let last: [_; QUARTERS_PER_YEAR] =
            std::array::from_fn(|i| quarters[quarters.len() - QUARTERS_PER_YEAR + i]);
        let whole_year = last.iter().enumerate().all(|(i, s)| {
            matches!(s.period, Period::Quarter(q) if q.year == year && usize::from(q.q) == i + 1)
        });
        if whole_year {
            f.push_year(year_statement(year, &last));
        }
    }
}

// ---------------------------------------------------------------------------------------------
// The dividend at the plan lock (spec 5.17; build-plan M4.8, M6.3).

/// Pays a dividend of `amount` at the plan lock (spec 5.17): cash falls now and the dividend is
/// booked into the month it falls in, posted at the next monthly close (D125). The amount is the
/// Lite AI's (`ai::financing`, the one 5.17 calculation, on the balances after the 6.5 draw or
/// repayment); nothing is paid for an amount at or below 0. Returns what was paid.
pub fn pay_dividend(world: &mut World, id: CompanyId, amount: f64) -> f64 {
    if amount <= 0.0 {
        return 0.0;
    }
    let c = &mut world.companies[id];
    c.cash_usd -= amount;
    c.finance.pending.dividends += amount;
    amount
}

// ---------------------------------------------------------------------------------------------
// Registration.

/// Registers the finance jobs (spec 4.3 steps 9 to 14, 4.4, 4.5). Called from `lib.rs`'s
/// `register_jobs` after the economy, operations and people, so in the shared slots (steps 9 and
/// 11) finance posts what the others computed.
pub fn register(s: &mut Scheduler) {
    s.register(Slot::MonthlyExpenses, "finance.open_month", open_month_job);
    s.register(Slot::MonthlyAssets, "finance.post_assets", post_assets_job);
    s.register(Slot::MonthlyInterest, "finance.interest", interest_job);
    s.register(Slot::MonthlyCashSettle, "finance.settle", settle_job);
    s.register(Slot::MonthlyLedger, "finance.ledger", ledger_job);
    // D122: the close pays the tax and then compiles, both here; Slot::CloseTax stays empty.
    s.register(Slot::CloseStatements, "finance.close", close_job);
    s.register(Slot::ReleasePublish, "finance.removals", removals_job);
    s.register(
        Slot::PriceMoveRatingReview,
        "finance.rating_review",
        rating_review_job,
    );
    s.register(
        Slot::PriceMoveCreditLineReview,
        "finance.line_review",
        line_review_job,
    );
    s.register(
        Slot::YearlyAnnualStatements,
        "finance.annual_statements",
        annual_statements_job,
    );
}
