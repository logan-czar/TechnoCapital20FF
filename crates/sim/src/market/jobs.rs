//! The market on the World (build-plan M5.1 to M5.8): the load's values and prices (spec 7.1),
//! the hourly price step (4.1 step 2, 5.14), the 01:00 price move on release days (4.1 step 3,
//! 4.4: full fair value, earnings jump, buzz), the daily jobs (4.2 steps 1, 2, 3 and 6: bars and
//! buzz, the fair value refresh, the reaction week, index closes and zone confidence), the
//! delisting at bankruptcy (5.12 step 2, D126), the close's result tags (4.4, 21.3.2), the plan
//! lock's consensus (5.16) and the 4.5 bar archive.
//!
//! The formulas are lane F's pure functions in this module's siblings; each job reads the World,
//! calls them in company id order and writes the results back (the pure step contract, `world`
//! docs). The hourly step is the hot path (about 470 stocks on every tick): it allocates nothing
//! and draws exactly as [`super::price::step_prices`] does (D135).

use super::confidence::{ConfidenceHeadline, news_points, update_confidence};
use super::daily::{BarBuilder, decay_buzz, is_reversion_day, revert_toward_value};
use super::earnings::{jumped_buzz, jumped_price, result_tags, surprise};
use super::engine_value::{EngineValueInputs, engine_value_at_load, load_net_income};
use super::fair_value::{
    FairValueBasis, FairValueInputs, book_floor_share, fair_value, per_share, revenue_growth,
};
use super::index::{ExchangeIndex, market_cap};
use super::price::{
    SECTOR_BETA, SECTOR_VOLATILITY, fat_tailed_normal, noise, prices_move,
    reaction_volatility_mult, rho, sigma_hourly, step_price, target_value,
};
use super::projection::consensus;
use super::state::Stock;
use crate::finance::jobs::{company_home_spread, run_rate, sheet};
use crate::finance::statements::trailing_four;
use crate::news::Headline;
use crate::ops::stations::BAREBONES_REVENUE_USD;
use crate::people::management::confidence_factor;
use crate::rng::{NoNoise, Stream};
use crate::time::scheduler::TickFacts;
use crate::time::{Date, DateTime, JobCtx, Scheduler, Slot};
use crate::world::{Company, CompanyId, Ordinal, Table, World, ZoneId};

/// Spec 3.14.2: the estimated fair value error is uniform within ±15% for a listed company (T).
pub const EFV_ERROR_WIDTH: f64 = 0.15;
/// Spec 4.5 step 2: 10 years of daily bars are kept (T).
pub const BAR_YEARS_KEPT: i32 = 10;

// ---------------------------------------------------------------------------------------------
// Reading the World.

/// True if company `c` is frozen or gone (Bankrupt or Removed, spec 5.12): no valuation, no
/// quote (D138).
fn frozen(c: &Company) -> bool {
    c.finance.status().is_frozen()
}

/// The 5.13 inputs of company `c` today on `basis` (D243): book equity from the balance sheet
/// (3.9), M_sector, the HQ home spread on the zone's effective spread (5.1.2, 5.12), the
/// industry's phase label (5.1), the company's own confidence factor (5.7), its listing
/// exchange's confidence (5.1.2; `None` while private) and the industry's book floor.
pub fn fair_value_inputs(
    world: &World,
    id: CompanyId,
    basis: FairValueBasis,
) -> FairValueInputs {
    let c = &world.companies[id];
    let ind = &world.industries[c.industry];
    let exchange = world.market.stocks[id].exchange;
    FairValueInputs {
        basis,
        book_equity: sheet(world, c).equity,
        sector_multiple: ind.params.earnings_multiple,
        home_spread: company_home_spread(world, c, false),
        label: ind.phase_label,
        company_confidence: confidence_factor(c.management_score),
        listing_confidence: exchange.map(|z| world.zones[z].confidence),
        book_floor_share: book_floor_share(&ind.key),
        shares_out: c.shares_out,
    }
}

/// The full recalculation's basis (spec 5.13 steps 1 and 2, 4.4 price move): TTM net income
/// over the archived quarters (annualized for fewer than four, `None` with none; D228, D253),
/// g from the archive's quarterly revenues (D254) and the industry's lt as g_sector (D1).
pub fn release_basis(world: &World, id: CompanyId) -> FairValueBasis {
    let c = &world.companies[id];
    let quarters = c.finance.quarters();
    let revenues: Vec<f64> = quarters.iter().map(|q| q.lines.revenue).collect();
    FairValueBasis::at_release(
        trailing_four(quarters).map(|l| l.net_income()),
        revenue_growth(&revenues),
        world.industries[c.industry].lt,
    )
}

/// Each exchange's quoted market cap, in zone id order (spec 5.14).
pub fn exchange_caps(world: &World) -> Vec<f64> {
    let mut caps = vec![0.0; world.zones.len()];
    for s in world.market.stocks.rows() {
        if let Some(z) = s.exchange {
            caps[z.index()] += s.cap();
        }
    }
    caps
}

/// The quoted cap of one exchange (spec 5.14).
pub fn exchange_cap(world: &World, zone: ZoneId) -> f64 {
    world
        .market
        .stocks
        .rows()
        .iter()
        .filter(|s| s.exchange == Some(zone))
        .map(Stock::cap)
        .sum()
}

/// The headline index level of an exchange now (spec 5.14): `None` with no quoted company.
pub fn index_level(world: &World, zone: ZoneId) -> Option<f64> {
    world.market.indices[zone].level(exchange_cap(world, zone))
}

/// The Pdoomberg Wire headlines posted today on companies listed on `zone`'s exchange (spec
/// 5.1.2 news_z, 5.18). **Hook:** the news wire (`crate::news`, M6.5) is not wired into the World
/// until M6, so this returns none and confidence moves by the index return only (D137). M6
/// fills it from the day's posted headlines; [`confidence_news`] already reads their points.
pub fn confidence_headlines(_world: &World, _zone: ZoneId) -> Vec<Headline> {
    Vec::new()
}

/// news_z of one exchange (spec 5.1.2): the points of the day's headlines on its companies that
/// carry any (beats and misses, bankruptcies, 2+ notch rating changes).
pub fn confidence_news(headlines: &[Headline]) -> f64 {
    let points: Vec<ConfidenceHeadline> =
        headlines.iter().filter_map(Headline::confidence).collect();
    news_points(&points)
}

// ---------------------------------------------------------------------------------------------
// Load (spec 7.1).

/// The market start state (spec 7.1 Shares row, 5.14; build-plan M5.2): each company's engine
/// value at load is its fair value, on the load basis (run-rate net income before line interest
/// at g 0 against the industry's lt, D244); V is that ÷ shares_out; P stays company-start.csv's
/// open_price (set in the load, so P = V up to the share rounding); buzz 0; the consensus for
/// the 2 January 2020 release is the synthetic Q4 2019 net income, so its surprise is 0 (D133);
/// every exchange's index is 1,000 at its listed cap. Call after [`crate::finance::start`]; it
/// draws nothing.
pub fn start(world: &mut World) {
    for id in world.companies.ids() {
        let c = &world.companies[id];
        let ind = &world.industries[c.industry];
        let country = &world.countries[c.hq_country];
        // 7.1 values the run rate at companies.csv revenue R: a company below $0.1M (the
        // barebones loadout, D107) has R 0 and so EBIT 0, and values at its book (D244, D145).
        let ebit = if c.revenue_usd < BAREBONES_REVENUE_USD {
            0.0
        } else {
            run_rate(world, c).0.ebit()
        };
        let exchange = world.market.stocks[id].exchange;
        let ni = load_net_income(ebit, country.corp_tax_rate);
        let value = engine_value_at_load(&EngineValueInputs {
            book_equity: sheet(world, c).equity,
            run_rate_ebit: ebit,
            tax_rate: country.corp_tax_rate,
            sector_multiple: ind.params.earnings_multiple,
            g_sector: ind.lt,
            // D235: the zone's base spread at load.
            home_spread: company_home_spread(world, c, true),
            listing_confidence: exchange.map(|z| world.zones[z].confidence_start),
            book_floor_share: book_floor_share(&ind.key),
        });
        let basis = FairValueBasis::at_release(
            Some(ni),
            super::engine_value::LOAD_REVENUE_GROWTH,
            ind.lt,
        );
        let quarters = c.finance.quarters();
        let (q4_ni, q4_revenue) = quarters
            .last()
            .map_or((0.0, 0.0), |q| (q.lines.net_income(), q.lines.revenue));
        let earlier: Vec<f64> = quarters[..quarters.len().saturating_sub(1)]
            .iter()
            .map(|q| q.lines.revenue)
            .collect();
        let shares = c.shares_out;
        let s = &mut world.market.stocks[id];
        s.fair_value = value;
        s.value = per_share(value, shares);
        s.basis = basis;
        s.consensus_ni = q4_ni;
        let surprise_q4 = surprise(q4_ni, q4_ni);
        s.pending_surprise = Some(surprise_q4);
        s.last_surprise = surprise_q4;
        s.tags = result_tags(surprise_q4, q4_ni, q4_revenue, &earlier);
    }
    let caps = exchange_caps(world);
    world.market.indices = Table::from_rows(
        world
            .zones
            .ids()
            .map(|z| ExchangeIndex::at_load(caps[z.index()]))
            .collect(),
    );
}

// ---------------------------------------------------------------------------------------------
// Hourly (spec 4.1 steps 2 and 3).

/// 4.1 step 2 (spec 5.14): every quoted stock steps toward V* in company id order, with one
/// z_market for all 26 exchanges drawn first, then each stock's z_stock (D246). Closed all of
/// 1 January and frozen on the 00:00 release tick (the slot is not due then; checked again
/// here). Each new price goes into the day's bar. Bankrupt companies are delisted (D126) and
/// not stepped, so `step_price`'s $0.01 floor never lifts their $0.00.
pub fn prices_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let t = ctx.facts.now;
    if !prices_move(t) {
        return;
    }
    let mult = reaction_volatility_mult(t);
    let sigma_h = sigma_hourly(SECTOR_VOLATILITY);
    let rho = rho(SECTOR_BETA);
    let z_market = fat_tailed_normal(ctx.draws);
    for (_, s) in world.market.stocks.iter_mut() {
        if !s.quoted {
            continue;
        }
        let z_stock = fat_tailed_normal(ctx.draws);
        let n = noise(sigma_h, rho, mult, z_market, z_stock);
        s.price = step_price(s.price, target_value(s.value, s.buzz), n);
        s.bar.tick(s.price);
    }
}

/// 4.4 price move step 1, 01:00 on release days (spec 5.13, 4.2 step 2 "full recalculation only
/// at the release"): a new basis from the statements just published, then the fair value on it
/// with today's inputs, for every company not frozen (D243).
pub fn full_fair_value_job(world: &mut World, _: &mut JobCtx<'_>) {
    for id in world.companies.ids() {
        if frozen(&world.companies[id]) {
            continue;
        }
        let basis = release_basis(world, id);
        let fv = fair_value(&fair_value_inputs(world, id, basis));
        let shares = world.companies[id].shares_out;
        let s = &mut world.market.stocks[id];
        s.basis = basis;
        s.fair_value = fv;
        s.value = per_share(fv, shares);
    }
}

/// 4.4 price move step 2 (spec 5.15): `P ×= 1 + 1.5 × clamp(0.5 × s, ±25%)` for every quoted
/// stock with a surprise from the close (D142). The jumped price goes into the day's bar.
pub fn earnings_jump_job(world: &mut World, _: &mut JobCtx<'_>) {
    for (_, s) in world.market.stocks.iter_mut() {
        if let (true, Some(sp)) = (s.quoted, s.pending_surprise) {
            s.price = jumped_price(s.price, sp);
            s.bar.tick(s.price);
        }
    }
}

/// 4.4 price move step 3 (spec 5.15, 3.10): `buzz += clamp(20 × s, ±30)` for every quoted stock,
/// spending the surprise; then each quoted stock draws its estimated fair value error for the
/// quarter, uniform within ±15%, in company id order (spec 3.14.2; D140).
pub fn buzz_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    for (_, s) in world.market.stocks.iter_mut() {
        if let Some(sp) = s.pending_surprise.take()
            && s.quoted
        {
            s.buzz = jumped_buzz(s.buzz, sp);
        }
    }
    for (_, s) in world.market.stocks.iter_mut() {
        if s.quoted {
            s.efv_error = EFV_ERROR_WIDTH * (2.0 * ctx.draws.uniform(Stream::Prices) - 1.0);
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Daily (spec 4.2 steps 1, 2, 3 and 6).

/// 4.2 step 1: each quoted stock's bar closes (none for a day with no trading tick, D248) and
/// every buzz decays 25%.
pub fn bars_job(world: &mut World, _: &mut JobCtx<'_>) {
    for (_, s) in world.market.stocks.iter_mut() {
        if s.quoted
            && let Some(bar) = s.bar.close()
        {
            s.bars.push(bar);
        }
        s.buzz = decay_buzz(s.buzz);
    }
}

/// 4.2 step 2 (spec 5.13): every company not frozen reruns fair value on its stored basis with
/// today's book equity, label, confidence factor, home spread and exchange confidence (D243).
pub fn fair_value_job(world: &mut World, _: &mut JobCtx<'_>) {
    for id in world.companies.ids() {
        if frozen(&world.companies[id]) {
            continue;
        }
        let basis = world.market.stocks[id].basis;
        let fv = fair_value(&fair_value_inputs(world, id, basis));
        let shares = world.companies[id].shares_out;
        let s = &mut world.market.stocks[id];
        s.fair_value = fv;
        s.value = per_share(fv, shares);
    }
}

/// 4.2 step 3 (spec 21.3.1): on the 3rd to the 8th of a release month each quoted stock closes
/// 20% of the gap between P and V.
pub fn reaction_week_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    if !is_reversion_day(ctx.facts.date) {
        return;
    }
    for (_, s) in world.market.stocks.iter_mut() {
        if s.quoted {
            s.price = revert_toward_value(s.price, s.value);
        }
    }
}

/// 4.2 step 6 (spec 5.1.2): each exchange in zone id order closes its index for the day (the
/// return in %, 0 with no quoted company) and its confidence moves by `0.9 × c + 3 × r + news`,
/// news from [`confidence_headlines`] (none until M6.5, D137); share counts changed since the
/// last close are synced first, keeping each level (D147). Then the day's bars open at the
/// price the daily jobs leave and the day's change resets (D136).
pub fn zone_confidence_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    for id in world.companies.ids() {
        sync_shares(world, id);
    }
    let caps = exchange_caps(world);
    for z in world.zones.ids() {
        let r = world.market.indices[z].close_day(caps[z.index()]);
        let news = confidence_news(&confidence_headlines(world, z));
        let zone = &mut world.zones[z];
        zone.confidence = update_confidence(zone.confidence, r, news);
    }
    let today = ctx.facts.date;
    for (_, s) in world.market.stocks.iter_mut() {
        s.bar = BarBuilder::start(today, s.price);
        s.prev_close = s.price;
    }
}

// ---------------------------------------------------------------------------------------------
// Monthly, quarterly and yearly.

/// 4.3 step 13, after the finance settle (spec 5.12 step 2, D126): a company that went Bankrupt
/// is delisted. Its exchange's divisor is rescaled at the same prices so the index does not
/// move (D250), then its price is $0.00, its fair value 0 and its open bar dropped (D134, D138).
/// Private companies that go Bankrupt lose their value the same way.
pub fn delist_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    for id in world.companies.ids() {
        let c = &world.companies[id];
        let s = &world.market.stocks[id];
        if !frozen(c) || (s.fair_value == 0.0 && !s.quoted) {
            continue;
        }
        if s.quoted
            && let Some(z) = s.exchange
        {
            let before = exchange_cap(world, z);
            let after = before - s.cap();
            world.market.indices[z].reweight(before, after.max(0.0));
        }
        let s = &mut world.market.stocks[id];
        s.quoted = false;
        s.price = 0.0;
        s.fair_value = 0.0;
        s.value = 0.0;
        s.buzz = 0.0;
        s.pending_surprise = None;
        s.bar = BarBuilder::start(ctx.facts.date, 0.0);
    }
}

/// 4.4 Close and compile, step 3 (spec 4.4 "tag result types", 5.15, 21.3.2): each company not
/// frozen compares the quarter just archived with its consensus (D142): the surprise s waits for
/// the 01:00 price move; the tags are kept for the headlines.
pub fn result_tags_job(world: &mut World, _: &mut JobCtx<'_>) {
    for id in world.companies.ids() {
        let c = &world.companies[id];
        if frozen(c) {
            continue;
        }
        let quarters = c.finance.quarters();
        let Some(last) = quarters.last() else {
            continue;
        };
        let (ni, revenue) = (last.lines.net_income(), last.lines.revenue);
        let earlier: Vec<f64> = quarters[..quarters.len() - 1]
            .iter()
            .map(|q| q.lines.revenue)
            .collect();
        let s = &mut world.market.stocks[id];
        let sp = surprise(ni, s.consensus_ni);
        s.pending_surprise = Some(sp);
        s.last_surprise = sp;
        s.tags = result_tags(sp, ni, revenue, &earlier);
    }
}

/// The 4.3 slots a projection re-runs for one month close (steps 2 to 14; step 1's quarterly
/// draws are "new rolls" and are skipped, D141).
pub const PROJECTION_SLOTS: [Slot; 13] = [
    Slot::MonthlyDemand,
    Slot::MonthlyFringe,
    Slot::MonthlyLaborSeats,
    Slot::MonthlyCompute,
    Slot::MonthlySupply,
    Slot::MonthlyRevenue,
    Slot::MonthlyData,
    Slot::MonthlyExpenses,
    Slot::MonthlyProductivity,
    Slot::MonthlyAssets,
    Slot::MonthlyInterest,
    Slot::MonthlyCashSettle,
    Slot::MonthlyLedger,
];

/// The engine's projection of each company's net income for the calendar quarter `lock` falls in
/// (spec 5.16 "from the locked plan with current demand, no new rolls"; D141): a clone of the
/// world runs the quarter's remaining month closes (4.3 steps 2 to 14) with
/// [`NoNoise`] draws, the close on the next quarter's first day reading this quarter's growth
/// as its own (the quarterly draw is skipped). The result is the sum of the months the clone
/// posts, in company id order; 0 for a company frozen in the clone.
pub fn project_quarter_net_income(world: &World, lock: DateTime) -> Vec<f64> {
    let mut clone = world.clone();
    let scheduler: Scheduler = crate::scheduler();
    let quarter = lock.date().quarter();
    let end = quarter.next().first_day();
    let posted_before: Vec<usize> = clone
        .companies
        .iter()
        .map(|(_, c)| c.finance.months.len())
        .collect();
    let mut close = lock.date().month_of().next().first_day();
    let mut notices = Vec::new();
    while close <= end {
        if close == end {
            for (_, ind) in clone.industries.iter_mut() {
                ind.prev_q_growth = ind.q_growth;
                ind.prev_lt = ind.lt;
            }
        }
        let now = DateTime::midnight(close);
        clone.clock = now;
        let mut draws = NoNoise;
        let mut ctx = JobCtx::detached(TickFacts::new(now), &mut draws, &mut notices);
        scheduler.run_slots(&PROJECTION_SLOTS, &mut clone, &mut ctx);
        notices.clear();
        close = close.month_of().next().first_day();
    }
    clone
        .companies
        .iter()
        .map(|(id, c)| {
            c.finance.months[posted_before[id.index()].min(c.finance.months.len())..]
                .iter()
                .map(|m| m.lines.net_income())
                .sum()
        })
        .collect()
}

/// 4.4 plan lock step 5 (spec 5.16): every company not frozen gets its consensus for the quarter,
/// `projection × (1 + e)` with e from one prices-stream uniform, in company id order (D252,
/// D141).
pub fn consensus_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let projection = project_quarter_net_income(world, ctx.facts.now);
    for id in world.companies.ids() {
        if frozen(&world.companies[id]) {
            continue;
        }
        world.market.stocks[id].consensus_ni = consensus(projection[id.index()], ctx.draws);
    }
}

/// 4.5 step 2 (spec 3.10, 4.5): each company keeps 10 years of daily bars.
pub fn archive_bars_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let d = ctx.facts.date;
    let first_kept = Date::ymd(d.year - BAR_YEARS_KEPT, d.month, d.day);
    for (_, s) in world.market.stocks.iter_mut() {
        s.bars.drop_before(first_kept);
    }
}

// ---------------------------------------------------------------------------------------------
// Constituent changes (spec 5.20 listing, 6.6 share issue), for M6.

/// Lists a private company on its HQ zone's exchange at `price` on `date` (spec 5.20, 5.14): it
/// joins the index with the divisor rescaled at the same prices, so the level does not move
/// (D250). Its bar opens at the listing price. Returns false if it was already listed or is
/// frozen.
pub fn list_company(world: &mut World, id: CompanyId, price: f64, date: Date) -> bool {
    let c = &world.companies[id];
    if frozen(c) || world.market.stocks[id].exchange.is_some() {
        return false;
    }
    let zone = world.countries[c.hq_country].zone;
    let shares = c.shares_out;
    let before = exchange_cap(world, zone);
    let after = before + market_cap(price, shares);
    world.market.indices[zone].reweight(before, after);
    world.companies[id].public = true;
    let s = &mut world.market.stocks[id];
    s.shares = shares;
    s.exchange = Some(zone);
    s.quoted = true;
    s.listed_on = Some(date);
    s.ipo_price = price;
    s.price = price;
    s.prev_close = price;
    s.bar = BarBuilder::start(date, price);
    true
}

/// Changes a company's shares outstanding (spec 6.6 share issue, 3.10 "rises with share
/// issues"), keeping its exchange's index level: the divisor is rescaled by cap after ÷ cap
/// before at the same prices (D250), and V follows the new count.
pub fn set_shares_out(world: &mut World, id: CompanyId, shares_out: u64) {
    world.companies[id].shares_out = shares_out;
    sync_shares(world, id);
    let s = &mut world.market.stocks[id];
    s.value = per_share(s.fair_value, shares_out);
}

/// Brings the index's share count of company `id` to its shares_out (D147), rescaling its
/// exchange's divisor by cap after ÷ cap before at the same price (D250), so the level does not
/// move.
fn sync_shares(world: &mut World, id: CompanyId) {
    let shares_out = world.companies[id].shares_out;
    let s = &world.market.stocks[id];
    if s.shares == shares_out {
        return;
    }
    if let (true, Some(z)) = (s.quoted, s.exchange) {
        let before = exchange_cap(world, z);
        let after = before - s.cap() + market_cap(s.price, shares_out);
        world.market.indices[z].reweight(before, after);
    }
    world.market.stocks[id].shares = shares_out;
}

// ---------------------------------------------------------------------------------------------
// Registration.

/// Registers the market jobs (spec 4.1 steps 2 and 3, 4.2 steps 1 to 3 and 6, 4.3 step 13, the
/// 4.4 close, price move and lock, 4.5 step 2). Called from `lib.rs`'s `register_jobs` after
/// finance, so the delisting at step 13 follows the settle that made the bankruptcy.
pub fn register(s: &mut Scheduler) {
    s.register(Slot::SharePrices, "market.prices", prices_job);
    s.register(
        Slot::PriceMoveFairValue,
        "market.full_fair_value",
        full_fair_value_job,
    );
    s.register(
        Slot::PriceMoveEarningsJump,
        "market.earnings_jump",
        earnings_jump_job,
    );
    s.register(Slot::PriceMoveBuzz, "market.buzz", buzz_job);
    s.register(Slot::DailyPriceBars, "market.bars", bars_job);
    s.register(Slot::DailyFairValue, "market.fair_value", fair_value_job);
    s.register(
        Slot::DailyReactionWeek,
        "market.reaction_week",
        reaction_week_job,
    );
    s.register(
        Slot::DailyZoneConfidence,
        "market.zone_confidence",
        zone_confidence_job,
    );
    s.register(Slot::MonthlyCashSettle, "market.delist", delist_job);
    s.register(Slot::CloseResultTags, "market.result_tags", result_tags_job);
    s.register(Slot::LockConsensus, "market.consensus", consensus_job);
    s.register(Slot::YearlyArchive, "market.archive_bars", archive_bars_job);
}
