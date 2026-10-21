//! The Pdoomberg Wire on the World (build-plan M6.5): each headline type of spec 5.18 queued
//! where its event happens, and the daily post (4.2 step 5) whose headlines move their
//! exchanges' confidence (4.2 step 6, 5.1.2; D137).
//!
//! | Headline (5.18) | Queued in |
//! |---|---|
//! | Phase change | 4.3 step 2, after the labels move |
//! | Chatbot (5.1.1) | 4.3 step 1a, the boom day |
//! | Bankruptcy | 4.3 step 13, after the settle and the delisting |
//! | Removal | 4.4 release, after the removals |
//! | Five largest beats and misses; rating changes of 2+ notches | 4.4 price move step 6 |
//! | Startup events, IPO votes, listings | the plan lock (`births::jobs`) |
//! | Raises and failed raises | the plan lock's batch (`ai::jobs`, parked with 6.6) |
//!
//! A headline is dated the day it is made and posts at the next 00:00 daily job (4.2 step 5
//! runs before the monthly and quarterly jobs of the same tick; D158).

use crate::time::{JobCtx, Scheduler, Slot};
use crate::world::{AiStage, Ordinal, World};

/// 4.3 step 2 (news part, after the economy's labels): each industry whose phase label changed
/// since the last month posts one headline (spec 5.18; D279 text).
pub fn phase_news_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let date = ctx.facts.date;
    if world.news.labels.len() == world.industries.len() {
        for (id, ind) in world.industries.iter() {
            let old = world.news.labels[id.index()];
            if old != ind.phase_label {
                let h = super::phase_change(date, id, &ind.name, old, ind.phase_label);
                world.news.queued.push(h);
            }
        }
    }
    world.news.labels = world
        .industries
        .rows()
        .iter()
        .map(|i| i.phase_label)
        .collect();
}

/// 4.3 step 1a (news part, after the boom event): on the boom day "[tipped lab] launches its
/// chatbot" (spec 5.1.1, 5.18).
pub fn chatbot_news_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let date = ctx.facts.date;
    if date != world.ai.boom_date || world.ai.stage != AiStage::Boom {
        return;
    }
    let Some(labs) = world
        .industries
        .iter()
        .find(|(_, i)| i.key == crate::births::jobs::AI_LABS_KEY)
        .map(|(id, _)| id)
    else {
        return;
    };
    let name = crate::births::jobs::tipped_lab_name(world);
    let h = super::chatbot(date, labs, world.births.tipped_lab, &name);
    world.news.queue(h);
}

/// 4.3 step 13 (news part, after finance's settle and the delisting): each company that went
/// Bankrupt today (spec 5.12 step 2, 5.18). D137 supersedes D126: the headline is the wire's,
/// and its −5 confidence reaches the company's exchange through the next daily post.
pub fn bankruptcy_news_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let date = ctx.facts.date;
    for (id, c) in world.companies.iter() {
        if c.finance.bankrupt_on == Some(date) {
            let h = super::bankruptcy(date, c.industry, id, &c.name);
            world.news.queued.push(h);
        }
    }
}

/// 4.4 release (news part, after the removals): each company removed today (spec 5.12 step 3).
pub fn removal_news_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let date = ctx.facts.date;
    for (id, c) in world.companies.iter() {
        if c.finance.removed_on == Some(date) {
            let h = super::removal(date, c.industry, id, &c.name);
            world.news.queued.push(h);
        }
    }
}

/// 4.4 price move step 6 (spec 5.18): the release's five largest beats and five largest misses
/// among the quoted companies (a private company publishes no results, D157), then every rating
/// change of 2 or more notches at this morning's review.
pub fn result_news_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let date = ctx.facts.date;
    let results: Vec<_> = world
        .companies
        .iter()
        .filter(|(id, c)| !c.finance.status().is_frozen() && world.market.stocks[*id].quoted)
        .map(|(id, _)| (id, world.market.stocks[id].last_surprise))
        .collect();
    let (beats, misses) = super::top_results(&results);
    for (id, s) in beats.into_iter().chain(misses) {
        let c = &world.companies[id];
        if let Some(h) = super::result(date, c.industry, id, &c.name, s) {
            world.news.queued.push(h);
        }
    }
    for (id, c) in world.companies.iter() {
        let f = &c.finance;
        if f.status().is_frozen() || f.last_review_notches == 0 {
            continue;
        }
        let from = f.rating.shifted(-f.last_review_notches);
        if let Some(h) = super::rating_change(date, c.industry, id, &c.name, from, f.rating) {
            world.news.queued.push(h);
        }
    }
}

/// 4.2 step 5 (spec 5.18): the day's queued headlines post to the feed; 4.2 step 6 reads them.
pub fn daily_news_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    world.news.post_day(ctx.facts.date);
}

/// Registers the news jobs. Called from `lib.rs`'s `register_jobs` after the economy, finance
/// and market, so each reads the state its slot's other jobs leave.
pub fn register(s: &mut Scheduler) {
    s.register(Slot::MonthlyAiEvents, "news.chatbot", chatbot_news_job);
    s.register(Slot::MonthlyDemand, "news.phase_changes", phase_news_job);
    s.register(
        Slot::MonthlyCashSettle,
        "news.bankruptcies",
        bankruptcy_news_job,
    );
    s.register(Slot::ReleasePublish, "news.removals", removal_news_job);
    s.register(
        Slot::PriceMoveResultHeadlines,
        "news.results_and_ratings",
        result_news_job,
    );
    s.register(Slot::DailyNews, "news.post", daily_news_job);
}
