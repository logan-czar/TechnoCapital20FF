//! Births and listings on the World (build-plan M6.6 to M6.9): the load's births draws (the
//! tipped lab, the starting private companies' first IPO votes), and the first three steps of
//! the 4.4 plan lock: fixed startup events due (5.19.2), random startup events (5.19.1), then
//! IPO board votes and listings (5.20.1). Each startup is carved from its industry's fringe and
//! joins every table: its unit, its company with its books, its stock row (private, valued),
//! its founders in the character table and its cast on the board (5.19.3, 5.19.4).
//!
//! The formulas are lane F's pure functions in this module's siblings; each job reads the World,
//! calls them in id order and writes the results back (the pure step contract, `world` docs).
//! Every draw is a gen-stream draw (5.19, 5.20.1), except a listing's estimated fair value error
//! (prices stream, D140, D150).

use std::sync::Arc;

use super::cast::{CastSeat, seat_cast};
use super::fixed::{FixedEvent, Region, draw_fixed_event};
use super::ipo::{
    IpoTestInputs, VoteResult, apply_cap, draw_first_vote, hold_vote, list_company,
    next_vote_after, passes_ipo_tests, voters,
};
use super::names::ticker;
use super::random::{EventDraft, EventKind, StartupDraft, draw_random_events};
use super::startup::{BirthInputs, build_startup, cap_table, fringe_revenue, sized_revenue};
use super::state::EventRecord;
use super::weights::{hq_weight, industry_weight};
use crate::economy::ai_boom::quarter_index;
use crate::finance::balance::{Books, balance_sheet};
use crate::finance::credit::{home_spread, line_limit};
use crate::finance::distress::CompanyStatus;
use crate::finance::state::CompanyFinance;
use crate::finance::statements::trailing_four;
use crate::market::fair_value::{
    FairValueBasis, book_floor_share, fair_value, per_share, revenue_growth,
};
use crate::market::jobs::{draw_efv_error, fair_value_inputs};
use crate::market::state::Stock;
use crate::news;
use crate::ops::compute::compute_bill;
use crate::ops::data::DataBook;
use crate::ops::stations::productive_compute;
use crate::people::board::Seat;
use crate::people::full::{GENERATED_TIER, HomeChoice, character_key};
use crate::people::management::management_score;
use crate::people::seating::board_of;
use crate::people::traits::Trait;
use crate::rng::DrawSource;
use crate::time::{Date, JobCtx, Quarter, Scheduler, Slot};
use crate::world::{
    BusinessUnit, Character, Company, CompanyData, CompanyId, Director, Holder, Holding,
    IndustryId, IpoVoteRecord, Notice, Ordinal, Origin, ProvinceId, SeatHolder, SimpleSeat,
    StartupEventId, UnitId, World,
};

/// companies.csv id prefix: a born company takes the next CO- id (spec 5.19.3; D4 ordinals
/// append).
pub const COMPANY_KEY_PREFIX: &str = "CO-";
/// industries.csv id of AI labs: the tipped lab's candidates and F4's headline (5.1.1, 5.18).
pub const AI_LABS_KEY: &str = "ai_labs";
/// startup-events.csv id of the boom event, whose headline names the tipped lab (5.18 F4).
pub const CHATBOT_EVENT_ID: &str = "F4";
/// Spec 5.20: a born company may be put to a vote 8 quarters after its birth.
pub const IPO_QUARTERS_AFTER_BIRTH: u32 = super::ipo::MIN_QUARTERS_SINCE_BIRTH;

/// The key of the `n`th company, 1-based (CO-0001 to CO-0651 load; born companies append).
pub fn company_key(n: usize) -> String {
    format!("{COMPANY_KEY_PREFIX}{n:04}")
}

// ---------------------------------------------------------------------------------------------
// Load (spec 5.1.1, 5.20.1 step 1).

/// The tipped lab (spec 5.1.1, 7-starting-world 7.6; D111, D281): one uniform gen draw among
/// the five largest AI labs by starting revenue. Called at load right after the economy's
/// draws, so on the gen stream it follows the pop roll and comes before the boards.
pub fn draw_tipped_lab_at_load(world: &mut World, draws: &mut dyn DrawSource) {
    let labs: Vec<(CompanyId, f64)> = world
        .companies
        .iter()
        .filter(|(_, c)| world.industries[c.industry].key == AI_LABS_KEY)
        .map(|(id, c)| (id, c.revenue_usd))
        .collect();
    world.births.tipped_lab = news::draw_tipped_lab(&news::tipped_lab_candidates(&labs), draws);
}

/// Each starting private company's first IPO vote (spec 5.20.1 step 1, A; D276): one of the four
/// 2020 plan locks, a gen draw each in company id order, made at load after the boards.
pub fn draw_first_votes(world: &mut World, draws: &mut dyn DrawSource) {
    for (_, c) in world.companies.iter_mut() {
        if !c.public {
            c.ipo_next_vote = Some(draw_first_vote(draws));
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Where startups go (spec 5.19.1, 5.19.2).

/// Named companies of `industry` with HQ in each province (spec 5.19.1), companies still in the
/// game.
fn named_by_province(world: &World, industry: IndustryId) -> Vec<u32> {
    let mut n = vec![0u32; world.provinces.len()];
    for (_, c) in world.companies.iter() {
        if c.industry == industry && c.finance.in_game() {
            n[c.hq_province.index()] += 1;
        }
    }
    n
}

/// The HQ candidates of a startup in `industry` (spec 5.19.1): every province with its weight
/// `province weight × (1 + named companies there) × 3 if a key city there lists the industry`,
/// in id order; with `regions`, only the provinces inside them (5.19.2).
fn hq_candidates(
    world: &World,
    industry: IndustryId,
    regions: Option<&[Region]>,
) -> Vec<(ProvinceId, f64)> {
    let named = named_by_province(world, industry);
    let sites = &world.births.sites;
    world
        .provinces
        .iter()
        .filter(|(id, p)| {
            regions.is_none_or(|r| {
                world
                    .births
                    .in_regions(*id, &world.countries[p.country].key, r)
            })
        })
        .map(|(id, _)| {
            (
                id,
                hq_weight(
                    sites.weight[id.index()],
                    named[id.index()],
                    sites.key_city_lists(id, industry),
                ),
            )
        })
        .collect()
}

/// The 5.19.1 industry weights, every industry in id order.
fn industry_weights(world: &World) -> Vec<(IndustryId, f64)> {
    world
        .industries
        .iter()
        .map(|(id, ind)| {
            (
                id,
                industry_weight(
                    ind.q_growth,
                    fringe_revenue(ind.fringe_assets, ind.params.asset_turnover),
                    ind.phase_label,
                ),
            )
        })
        .collect()
}

// ---------------------------------------------------------------------------------------------
// One startup (spec 5.19.3, 5.19.4).

/// Builds one startup from its draft and adds it to every table (spec 5.19.3, 5.19.4): the
/// carve from the fringe, the unit, the company with its books and stock row, its name, its
/// founders and its seated cast. None when the 5.19.3 cap skips it (under $1M).
pub fn birth(
    world: &mut World,
    draws: &mut dyn DrawSource,
    draft: &StartupDraft,
    event: StartupEventId,
    date: Date,
) -> Option<CompanyId> {
    let ind = &world.industries[draft.industry];
    let revenue = sized_revenue(
        draft.target_revenue_usd,
        fringe_revenue(ind.fringe_assets, ind.params.asset_turnover),
    )?;
    let id = CompanyId::from_index(world.companies.len());
    let key = company_key(world.companies.len() + 1);
    let country_id = world.provinces[draft.hq].country;
    let country = &world.countries[country_id];
    let zone = &world.zones[country.zone];
    // D271: the home spread at birth on the zone's effective spread.
    let home = home_spread(zone.credit_spread, country.sovereign_spread);
    let params = ind.params.clone();
    let b = build_startup(&BirthInputs {
        key: &key,
        revenue,
        params: &params,
        industry_key: &ind.key,
        sector: &ind.sector,
        fringe_assets: ind.fringe_assets,
        tax_rate: country.corp_tax_rate,
        sovereign: country.sovereign_rating,
        base_rate: world.base_rate,
        home_spread: home,
        g_sector: ind.lt,
        book_floor_share: book_floor_share(&ind.key),
    });
    let lt = ind.lt;
    world.industries[draft.industry].fringe_assets = b.fringe_assets_after;

    // The name first, then the cast (D272, D274).
    let name = {
        let w = &*world;
        w.births.names.draw(
            country_id,
            draft.industry,
            &|n| w.companies.iter().any(|(_, c)| c.name == n),
            draws,
        )
    };
    let cast = {
        let w = &*world;
        let names = w
            .name_books
            .get(country_id)
            .expect("every country has a name book (checked at load)");
        let others = w.births.home_others(country_id, draft.hq);
        seat_cast(
            draws,
            names,
            &|n| w.characters.iter().any(|(_, c)| c.name == n),
            b.labor,
            draft.full,
            draft.partial,
            HomeChoice {
                hq: draft.hq,
                others: &others,
            },
        )
    };

    // The founders join the character table (spec 3.7.2: next CH- ids).
    let founders: Vec<_> = cast
        .founders
        .iter()
        .map(|f| {
            let key = character_key(world.characters.len() as u32 + 1);
            world.characters.push(Character {
                key,
                name: f.name.clone(),
                tier: GENERATED_TIER.to_string(),
                age: f.age,
                skills: f.skills,
                traits: f.traits.to_vec(),
                home_province: f.home_province,
                cash_usd: f.cash_usd,
            })
        })
        .collect();
    let simple = |world: &mut World, character| {
        let sid = world.simple_characters_made;
        world.simple_characters_made += 1;
        SimpleSeat { id: sid, character }
    };
    let mut board: [Option<SeatHolder>; crate::people::board::LABOR_SEAT_COUNT] =
        Default::default();
    for (slot, seat) in cast.seats.iter().enumerate() {
        board[slot] = match seat {
            None => None,
            Some(CastSeat::Founder(i)) => Some(SeatHolder::Full(founders[*i])),
            Some(CastSeat::Partial(c) | CastSeat::Filler(c)) => {
                Some(SeatHolder::Simple(simple(world, c.clone())))
            }
        };
    }
    let directors: Vec<Director> = cast
        .directors
        .iter()
        .map(|d| match d {
            CastSeat::Founder(i) => Director::Full(founders[*i]),
            CastSeat::Partial(c) | CastSeat::Filler(c) => {
                Director::Simple(simple(world, c.clone()))
            }
        })
        .collect();
    let caps = cap_table(b.shares_out, founders.len());
    let mut holders: Vec<Holding> = founders
        .iter()
        .zip(&caps.founders)
        .map(|(&ch, &shares)| Holding {
            holder: Holder::Founder(ch),
            shares,
        })
        .collect();
    holders.push(Holding {
        holder: Holder::SeedInvestors,
        shares: caps.seed_investors,
    });

    // The unit (spec 5.19.3): asset_book = gross, no ramping, productivity 100.
    let unit_id = UnitId::from_index(world.units.len());
    world.units.push(BusinessUnit {
        company: id,
        industry: draft.industry,
        base_province: draft.hq,
        gross_assets: b.gross_assets,
        ramping: Vec::new(),
        asset_book: b.asset_book,
        productivity: crate::ops::stations::START_PRODUCTIVITY,
        location_bonus: 0.0,
        fixed_cost_rate: b.fixed_cost_rate,
        growth_plan: 0.0,
        rd_plan: b.rd_plan,
        revenue_m: 0.0,
        variable_m: 0.0,
        fixed_m: 0.0,
        rd_m: 0.0,
        dep_m: 0.0,
        shared_m: 0.0,
        capex_m: 0.0,
        sale_proceeds_m: 0.0,
        sale_gain_m: 0.0,
    });

    // The books (spec 5.19.3 seed round): cash, no line, the rating implied from the run rate,
    // the limit at that rating, and the opening balance sheet; no history (TTM figures scale
    // the quarters so far, D228).
    let mut finance = CompanyFinance::at_load(0.0, b.rating);
    finance.line.limit = line_limit(b.asset_book, b.cash, 0.0, b.rating);
    finance.opening = balance_sheet(
        &Books {
            cash: b.cash,
            asset_book: b.asset_book,
            line_drawn: 0.0,
            tax: Default::default(),
        },
        CompanyStatus::Active,
    );
    finance.archive = Arc::default();
    let lead = founders.first().copied();
    let lock_q = date.quarter();
    let next_vote = (0..IPO_QUARTERS_AFTER_BIRTH).fold(lock_q, |q, _| q.next());
    world.companies.push(Company {
        key,
        name,
        ticker: String::new(),
        industry: draft.industry,
        hq_country: country_id,
        hq_province: draft.hq,
        public: false,
        revenue_usd: revenue,
        shares_out: b.shares_out,
        units: vec![unit_id],
        controller: lead,
        labor_units: b.labor,
        stations: b.stations,
        pc: productive_compute(&b.stations, params.pc_modifier),
        pc_bonus: f64::from(b.run_rate.pc_bonus),
        compute: compute_bill(&b.stations, 0.0),
        data: vec![CompanyData {
            industry: draft.industry,
            book: DataBook::default(),
        }],
        board,
        seats_to_fill: Vec::new(),
        management_score: 0.0,
        archetype: b.archetype,
        cash_usd: b.cash,
        finance,
        state_controlled: false,
        origin: Origin::Born { date, event },
        founders,
        directors,
        holders,
        loss_quarters: 0,
        plan: None,
        failed_raises: 0,
        raise_pending: false,
        ipo_next_vote: Some(next_vote),
        ipo_last_vote: None,
        birth_run_rate: Some(b.run_rate),
    });
    let score = management_score(&board_of(world, &world.companies[id]));
    world.companies[id].management_score = score;

    // The stock row: private, valued by the 7.1 rule; with no quarter it is valued as a
    // loss-maker from the next daily refresh (D253).
    let mut stock = Stock::at_load(None, 0.0, b.shares_out);
    stock.fair_value = b.engine_value;
    stock.value = per_share(b.engine_value, b.shares_out);
    stock.basis = FairValueBasis::at_release(None, 0.0, lt);
    stock.bar = crate::market::daily::BarBuilder::start(date, 0.0);
    world.market.stocks.push(stock);
    Some(id)
}

/// Builds an event's startups in draft order and logs the event (spec 3.1 `startup_events`).
/// Returns the event's id and the companies made; an event whose every startup the cap skipped
/// is not logged (D154).
fn fire_event(
    world: &mut World,
    ctx: &mut JobCtx<'_>,
    draft: &EventDraft,
) -> Option<(StartupEventId, Vec<CompanyId>)> {
    let date = ctx.facts.date;
    let event = StartupEventId::from_index(world.births.events.len());
    let mut made = Vec::new();
    for s in &draft.startups {
        if let Some(id) = birth(world, ctx.draws, s, event, date) {
            made.push(id);
        }
    }
    if made.is_empty() {
        return None;
    }
    world.births.events.push(EventRecord {
        id: event,
        kind: draft.kind.clone(),
        date,
        industries: made.iter().map(|&c| world.companies[c].industry).collect(),
        companies: made.clone(),
    });
    ctx.notice(Notice::StartupEvent(event));
    for &c in &made {
        ctx.notice(Notice::CompanyBorn(c));
    }
    Some((event, made))
}

// ---------------------------------------------------------------------------------------------
// The plan lock (spec 4.4 row 3).

/// Plan lock step 1 (spec 5.19.2): the fixed events due, in file order (F1 to F9; F9 at the
/// first lock with the AI stage Postcrash, D275). Each event draws its startups' HQs inside its
/// regions, builds them and posts its own headline: F4 "[tipped lab]'s chatbot sets off a
/// startup rush: [n] new AI labs", the others "[event name]: [n] new startups" (5.18, D279).
pub fn fixed_events_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let date = ctx.facts.date;
    let due = super::fixed::due_events(
        &world.births.fixed,
        &world.births.fixed_fired,
        date,
        world.ai.stage,
    );
    for i in due {
        world.births.fixed_fired[i] = true;
        let event: FixedEvent = world.births.fixed[i].clone();
        let draft = {
            let w = &*world;
            draw_fixed_event(
                &event,
                &|name| {
                    w.industries
                        .iter()
                        .find(|(_, ind)| ind.name == name)
                        .map(|(id, _)| id)
                },
                &|industry, regions| hq_candidates(w, industry, Some(regions)),
                ctx.draws,
            )
        };
        let Some((_, made)) = fire_event(world, ctx, &draft) else {
            continue;
        };
        let headline = if event.id == CHATBOT_EVENT_ID {
            let ai_labs = world
                .industries
                .iter()
                .find(|(_, ind)| ind.key == AI_LABS_KEY)
                .map(|(id, _)| id);
            match ai_labs {
                Some(labs) => {
                    let n = made
                        .iter()
                        .filter(|&&c| world.companies[c].industry == labs)
                        .count() as u32;
                    news::chatbot_rush(date, &event.id, labs, &tipped_lab_name(world), n)
                }
                None => news::fixed_event(date, &event.id, &event.name, made.len() as u32),
            }
        } else {
            news::fixed_event(date, &event.id, &event.name, made.len() as u32)
        };
        world.news.queue(headline);
    }
}

/// The tipped lab's name (5.1.1), or a generic name with no candidate.
pub fn tipped_lab_name(world: &World) -> String {
    world.births.tipped_lab.map_or_else(
        || "An AI lab".to_string(),
        |c| world.companies[c].name.clone(),
    )
}

/// Plan lock step 2 (spec 5.19.1): the Poisson count of random events, each placed by the
/// industry and HQ weights and built. A one-startup event posts "[Name] launches in [industry]
/// in [city or province]"; a hot cluster "[n] startups launch in [industry] in [city]" (5.18).
pub fn random_events_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let date = ctx.facts.date;
    let drafts = {
        let w = &*world;
        let weights = industry_weights(w);
        draw_random_events(&weights, &|ind| hq_candidates(w, ind, None), ctx.draws)
    };
    for draft in &drafts {
        let Some((_, made)) = fire_event(world, ctx, draft) else {
            continue;
        };
        let first = &world.companies[made[0]];
        let industry = first.industry;
        let ind_name = world.industries[industry].name.clone();
        let p = first.hq_province;
        let place = world
            .births
            .sites
            .place(p, &world.provinces[p].name)
            .to_string();
        let headline = if made.len() == 1 {
            news::startup_launch(date, industry, made[0], &first.name, &ind_name, &place)
        } else {
            news::hot_cluster(date, industry, &ind_name, &place, made.len() as u32)
        };
        world.news.queue(headline);
    }
}

/// The traits of a seat holder or director (simple or full).
fn holder_traits<'a>(
    world: &'a World,
    h: &'a SeatHolder,
) -> (&'a [Trait], Option<crate::world::CharacterId>) {
    match h {
        SeatHolder::Simple(s) => (&s.character.traits, None),
        SeatHolder::Full(ch) => (&world.characters[*ch].traits, Some(*ch)),
    }
}

/// Quarters from `from` to `to` (to − from).
fn quarters_between(from: Quarter, to: Quarter) -> u32 {
    (quarter_index(to) - quarter_index(from)).max(0) as u32
}

/// One company's IPO vote (spec 5.20.1 steps 2 to 5), if it is due and passes the 5.20 tests.
fn vote(
    world: &World,
    id: CompanyId,
    q: Quarter,
    draws: &mut dyn DrawSource,
) -> Option<VoteResult> {
    let c = &world.companies[id];
    let s = &world.market.stocks[id];
    if s.exchange.is_some() || !c.ipo_next_vote.is_some_and(|v| v <= q) {
        return None;
    }
    let quarters = c.finance.quarters();
    let ttm = trailing_four(quarters)?;
    let label = world.industries[c.industry].phase_label;
    let since_birth = match c.origin {
        Origin::Start => None,
        Origin::Born { date, .. } => Some(quarters_between(date.quarter(), q)),
    };
    let revenues: Vec<f64> = quarters.iter().map(|s| s.lines.revenue).collect();
    if !passes_ipo_tests(&IpoTestInputs {
        listed: false,
        status: c.finance.status(),
        quarters_since_birth: since_birth,
        ttm_revenue: ttm.revenue,
        ttm_net_income: ttm.net_income(),
        revenue_growth: revenue_growth(&revenues),
        rating: c.finance.rating,
        label,
    }) {
        return None;
    }
    // Voters (5.20.1 steps 2 and 4; D276): the seated labor seats, the directors, then a named or
    // state controller holding no seat.
    let mut seated_controller = false;
    let mut seats: Vec<(Seat, &[Trait], bool)> = Vec::new();
    for (i, h) in c.board.iter().enumerate() {
        if let Some(h) = h {
            let (traits, ch) = holder_traits(world, h);
            let ctl = ch.is_some() && ch == c.controller;
            seated_controller |= ctl;
            seats.push((Seat::LABOR[i], traits, ctl));
        }
    }
    let directors: Vec<(&[Trait], bool)> = c
        .directors
        .iter()
        .map(|d| match d {
            Director::Simple(s) => (&s.character.traits[..], false),
            Director::Full(ch) => {
                let ctl = Some(*ch) == c.controller;
                seated_controller |= ctl;
                (&world.characters[*ch].traits[..], ctl)
            }
        })
        .collect();
    let unseated: Option<&[Trait]> = if seated_controller {
        None
    } else if c.state_controlled {
        Some(&[])
    } else {
        c.controller.map(|ch| &world.characters[ch].traits[..])
    };
    let v = voters(&seats, &directors, unseated);
    let zone = world.countries[c.hq_country].zone;
    Some(hold_vote(&v, label, world.zones[zone].confidence, draws))
}

/// Plan lock step 3 (spec 5.20, 5.20.1): every private Active company whose vote is due
/// (`ipo_next_vote` at or before this lock) and that passes the 5.20 tests holds its board vote,
/// in id order; a failed vote comes back 4 quarters later; each vote posts a headline. Then the
/// cap of 3 a quarter (the largest by TTM revenue, ties to the lower id; the rest count as failed)
/// and the listings, in id order (D155). A due company that fails the tests is not put to a vote
/// and stays due (D156).
pub fn ipo_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let date = ctx.facts.date;
    let q = date.quarter();
    let mut passed: Vec<(CompanyId, f64)> = Vec::new();
    for id in world.companies.ids() {
        let Some(result) = vote(world, id, q, ctx.draws) else {
            continue;
        };
        let c = &world.companies[id];
        let zone = world.countries[c.hq_country].zone;
        world.news.queue(news::ipo_vote(
            date,
            c.industry,
            id,
            &c.name,
            &world.zones[zone].exchange_code,
            result.passed,
            (result.yes, result.no),
        ));
        ctx.notice(Notice::IpoVote {
            company: id,
            passed: result.passed,
        });
        if result.passed {
            let ttm = trailing_four(c.finance.quarters()).map_or(0.0, |l| l.revenue);
            passed.push((id, ttm));
        }
        let c = &mut world.companies[id];
        if !result.passed {
            c.ipo_next_vote = Some(next_vote_after(q));
        }
        c.ipo_last_vote = Some(IpoVoteRecord {
            date,
            result,
            capped: false,
        });
    }
    let (mut listing, capped) = apply_cap(&passed);
    for id in capped {
        let c = &mut world.companies[id];
        c.ipo_next_vote = Some(next_vote_after(q));
        if let Some(v) = &mut c.ipo_last_vote {
            v.capped = true;
        }
    }
    listing.sort_unstable();
    for id in listing {
        list(world, ctx, id);
    }
}

/// Lists a company whose vote passed (spec 5.20.1 Listing): pre-money value = the 5.13 fair
/// value with its exchange's X and no private discount; the 7.1 open price; existing holdings
/// re-split to `pre-money ÷ open_price` (any rounding remainder to the largest holding, ties to
/// the earlier, D153); 20% new shares to the public float at `open_price × 0.92` less 3% fees,
/// the net into cash and booked as shares issued (D125), so assets = liabilities + equity; a
/// unique ticker; P = open_price, buzz 0; it joins its exchange's index with the divisor
/// rescaled (`market::jobs::list_company`, the level does not move). V is then refreshed for the
/// new book and X, and its estimated fair value error drawn (D140, D150).
pub fn list(world: &mut World, ctx: &mut JobCtx<'_>, id: CompanyId) {
    let date = ctx.facts.date;
    let c = &world.companies[id];
    let zone = world.countries[c.hq_country].zone;
    let basis = world.market.stocks[id].basis;
    let mut inputs = fair_value_inputs(world, id, basis);
    inputs.listing_confidence = Some(world.zones[zone].confidence);
    let pre_money = fair_value(&inputs);
    let l = list_company(pre_money, &c.key);
    let symbol = ticker(&c.name, &|t| {
        world.companies.iter().any(|(_, o)| o.ticker == t)
    });

    let c = &mut world.companies[id];
    let old = c.shares_out;
    let mut held = 0u64;
    for h in &mut c.holders {
        h.shares = l.resplit_holding(h.shares, old);
        held += h.shares;
    }
    if let Some(big) = (0..c.holders.len()).max_by(|&a, &b| {
        c.holders[a]
            .shares
            .cmp(&c.holders[b].shares)
            .then(b.cmp(&a))
    }) {
        let h = &mut c.holders[big].shares;
        *h = (*h + l.resplit_shares).saturating_sub(held);
    }
    c.holders.push(Holding {
        holder: Holder::PublicFloat,
        shares: l.new_shares,
    });
    c.shares_out = l.shares_out;
    c.cash_usd += l.net;
    c.finance.pending.shares_issued_net += l.net;
    c.ticker = symbol;
    c.ipo_next_vote = None;
    crate::market::jobs::list_company(world, id, l.open_price, date);
    let fv = fair_value(&fair_value_inputs(world, id, basis));
    let shares = world.companies[id].shares_out;
    let s = &mut world.market.stocks[id];
    s.fair_value = fv;
    s.value = per_share(fv, shares);
    s.buzz = 0.0;
    s.efv_error = draw_efv_error(ctx.draws);
    let c = &world.companies[id];
    world.news.queue(news::listing(
        date,
        c.industry,
        id,
        &c.name,
        &world.zones[zone].exchange_code,
        l.open_price,
        l.net,
    ));
    ctx.notice(Notice::CompanyListed(id));
}

/// Registers the births jobs in the plan lock's first three slots (spec 4.4 row 3). Called from
/// `lib.rs`'s `register_jobs`.
pub fn register(s: &mut Scheduler) {
    s.register(
        Slot::LockFixedStartupEvents,
        "births.fixed_events",
        fixed_events_job,
    );
    s.register(
        Slot::LockRandomStartupEvents,
        "births.random_events",
        random_events_job,
    );
    s.register(Slot::LockIpoVotes, "births.ipo_votes_and_listings", ipo_job);
}

/// For tests: an event's kind is fixed (5.19.2).
pub fn is_fixed(kind: &EventKind) -> bool {
    matches!(kind, EventKind::Fixed(_))
}
