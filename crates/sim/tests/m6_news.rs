//! Build-plan M6.5 on the live engine: the Pdoomberg Wire and the recap data (spec 5.18, 8,
//! 21.6.2). Done line: every headline type of 5.18 posts in a test run. The three years 2020 to
//! 2022 post every type but the boom's (the chatbot and F4's rush, checked in
//! `m6_full_year.rs`) and the 6.6 raises, which are parked: no industry is cash_burning, so
//! none posts with the real data.
//!
//! Each headline reads the state it reports: a release's five largest beats and misses among
//! the quoted companies (5.15 tags), a rating move of 2+ notches at the review, each bankruptcy
//! and removal on its day, each startup, IPO vote and listing with 5.18's wording. Every one
//! carries the neutral Pdoomberg Wire byline and posts at the next 00:00 daily job (D158).

mod common;

use common::data;
use sim::Sim;
use sim::market::earnings::SurpriseTag;
use sim::news::{BYLINE, HeadlineKind};
use sim::time::{Date, DateTime};
use sim::world::{CompanyId, Notice};

#[test]
fn every_headline_type_posts_and_reports_its_event() {
    let mut sim = Sim::new(data(), 41).unwrap();
    let end = DateTime::midnight(Date::ymd(2023, 1, 10));
    let mut notices = Vec::new();
    let mut recaps = Vec::new();
    while sim.now() < end {
        for n in sim.step() {
            if matches!(
                n,
                Notice::StartupEvent(_)
                    | Notice::CompanyBorn(_)
                    | Notice::IpoVote { .. }
                    | Notice::CompanyListed(_)
            ) {
                notices.push(n);
            }
        }
        let t = sim.now();
        if t.hour() == 0 && sim::time::quarter::is_recap_day(t.date()) {
            recaps.push(t.date());
            let w = sim.world();
            let r = w.recap.as_ref().expect("the recap is built on its day");
            assert_eq!(r.world.quarter, t.date().quarter());
            let pages = w
                .companies
                .iter()
                .filter(|(_, c)| !c.finance.status().is_frozen())
                .count();
            assert_eq!(r.companies.len(), pages);
            assert!(r.world.expected_beats.len() <= 5 && r.world.expected_misses.len() <= 5);
            for b in &r.world.expected_beats {
                let s = &w.market.stocks[b.company];
                assert!(s.quoted);
                assert_eq!(
                    (b.projection, b.consensus),
                    (s.projection_ni, s.consensus_ni)
                );
                assert!(b.expected_surprise > 0.0);
            }
            // The view copies the recap; a company that does not publish shows bands (D420).
            let v = sim.views().recap.get();
            assert_eq!(v.world.as_ref().map(|p| p.quarter), Some(r.world.quarter));
            assert_eq!(v.companies.len(), r.companies.len());
            for (p, t) in v.companies.iter().zip(&r.companies) {
                assert_eq!(p.company, t.company);
                let estimated = sim::views::estimate::shows_estimates(w, t.company);
                assert_eq!(p.estimated, estimated);
                if estimated {
                    let b = p.expected.consensus.band().unwrap();
                    assert!(b.low < t.expected.consensus && t.expected.consensus < b.high);
                    assert_ne!(b.estimate, t.expected.consensus);
                } else {
                    assert_eq!(p.range.0.exact(), Some(t.range.0));
                    assert_eq!(p.range.1.exact(), Some(t.range.1));
                    assert_eq!(p.expected.projection.exact(), Some(t.expected.projection));
                }
            }
        }
    }
    assert_eq!(
        recaps.len(),
        12,
        "a recap each pre-quarter-end week: {recaps:?}"
    );
    let w = sim.world();
    let feed: Vec<_> = w.news.feed.iter().collect();
    let has = |f: &dyn Fn(&HeadlineKind) -> bool| feed.iter().any(|h| f(&h.kind));
    for h in &feed {
        assert_eq!(h.byline(), BYLINE);
    }
    assert!(has(&|k| matches!(k, HeadlineKind::PhaseChange { .. })));
    assert!(has(&|k| matches!(
        k,
        HeadlineKind::Result {
            tag: SurpriseTag::Beat | SurpriseTag::BigBeat,
            ..
        }
    )));
    assert!(has(&|k| matches!(
        k,
        HeadlineKind::Result {
            tag: SurpriseTag::Miss | SurpriseTag::BigMiss,
            ..
        }
    )));
    assert!(has(&|k| matches!(k, HeadlineKind::Bankruptcy)));
    assert!(has(&|k| matches!(k, HeadlineKind::Removal)));
    assert!(has(&|k| matches!(k, HeadlineKind::RatingChange { .. })));
    assert!(has(&|k| matches!(
        k,
        HeadlineKind::FixedStartupEvent { .. }
    )));
    assert!(has(&|k| matches!(k, HeadlineKind::StartupLaunch)));
    assert!(has(&|k| matches!(k, HeadlineKind::HotCluster { .. })));
    assert!(has(&|k| matches!(
        k,
        HeadlineKind::IpoVote { passed: true, .. }
    )));
    assert!(has(&|k| matches!(
        k,
        HeadlineKind::IpoVote { passed: false, .. }
    )));
    assert!(has(&|k| matches!(k, HeadlineKind::Listing { .. })));
    assert!(
        !has(&|k| matches!(
            k,
            HeadlineKind::Raise { .. } | HeadlineKind::FailedRaise { .. }
        )),
        "6.6 is parked: no raise with the real data"
    );

    // Each headline reports its event (5.18 texts).
    let name = |c: CompanyId| w.companies[c].name.as_str();
    for h in &feed {
        match &h.kind {
            HeadlineKind::Bankruptcy => {
                let c = h.company.unwrap();
                assert_eq!(w.companies[c].finance.bankrupt_on, Some(h.date));
                assert_eq!(
                    h.text,
                    format!("{} goes bankrupt; shareholders wiped out", name(c))
                );
            }
            HeadlineKind::Removal => {
                let c = h.company.unwrap();
                assert_eq!(w.companies[c].finance.removed_on, Some(h.date));
            }
            HeadlineKind::RatingChange { from, to } => {
                let n = sim::finance::rating::notches_between(*from, *to);
                assert!(n.abs() >= 2, "{}", h.text);
            }
            HeadlineKind::Result { surprise, .. } => {
                // Released quarters only: the 2nd of a quarter's first month, 01:00.
                assert_eq!(h.date.day, 2);
                assert!(surprise.abs() > 0.05);
                let c = h.company.unwrap();
                assert!(w.market.stocks[c].exchange.is_some(), "listed only (D157)");
            }
            HeadlineKind::StartupLaunch => {
                let c = h.company.unwrap();
                let co = &w.companies[c];
                let ind = &w.industries[co.industry].name;
                assert!(
                    h.text
                        .starts_with(&format!("{} launches in {ind} in ", co.name)),
                    "{}",
                    h.text
                );
            }
            HeadlineKind::IpoVote {
                passed,
                yes,
                no,
                exchange,
            } => {
                let c = h.company.unwrap();
                let want = if *passed {
                    format!(
                        "{} board votes to list on {exchange}, {yes} to {no}",
                        name(c)
                    )
                } else {
                    format!("{} board votes against listing, {no} to {yes}", name(c))
                };
                assert_eq!(h.text, want);
            }
            HeadlineKind::Listing {
                exchange, price, ..
            } => {
                let c = h.company.unwrap();
                let s = &w.market.stocks[c];
                assert_eq!(s.listed_on, Some(h.date));
                assert_eq!(*price, s.ipo_price);
                let code = &w.zones[s.exchange.unwrap()].exchange_code;
                assert_eq!(exchange, code);
                assert!(
                    h.text
                        .starts_with(&format!("{} lists on {code} at $", name(c)))
                );
            }
            _ => {}
        }
    }
    // Each release posts at most the five largest beats and five largest misses (5.18).
    for q in [4u8, 7, 10] {
        let d = Date::ymd(2021, q, 2);
        let n = feed
            .iter()
            .filter(|h| h.date == d && matches!(h.kind, HeadlineKind::Result { .. }))
            .count();
        assert!(n <= 10, "{d}: {n} result headlines");
    }
    // Notices for 9.3: startup_event, company_born, ipo_vote, company_listed.
    for want in [
        |n: &Notice| matches!(n, Notice::StartupEvent(_)),
        |n: &Notice| matches!(n, Notice::CompanyBorn(_)),
        |n: &Notice| matches!(n, Notice::IpoVote { .. }),
        |n: &Notice| matches!(n, Notice::CompanyListed(_)),
    ] {
        assert!(notices.iter().any(want));
    }
    // v_news (9.2 get_news): every posted headline, oldest first.
    let v = sim.views().news.get();
    assert_eq!(v.get_news(Date::ymd(2020, 1, 1), None).len(), feed.len());
}
