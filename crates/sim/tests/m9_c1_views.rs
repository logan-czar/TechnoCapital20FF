//! M9 Phase C lane C1's sim requests (docs/build/m9-plan.md; the requests lanes B1 and B2
//! logged): the index history in v_exchanges (D540). Expected values come from the spec: every
//! headline index is 1,000 at load (5.14) and closes once a day at 00:00 (4.2 step 6).

mod common;

use common::data;
use sim::Sim;
use sim::births::ipo::{BallotVoter, VoterRole};
use sim::births::random::EventKind;
use sim::market::index::INDEX_BASE;
use sim::news::HeadlineKind;
use sim::time::Date;
use sim::views::company_detail::SeatPerson;
use sim::world::{Director, HeadlineId, Ordinal};

#[test]
fn exchanges_serve_each_index_s_daily_closes_from_2020() {
    let mut sim = Sim::new(data(), 1).unwrap();
    let start = Date::ymd(2020, 1, 1);
    {
        let v = sim.views();
        for (e, z) in v.exchanges.get().exchanges.iter().zip(&v.zones.get().zones) {
            match z.index_close {
                Some(_) => {
                    let c: Vec<_> = e.closes.iter().copied().collect();
                    assert_eq!(c.len(), 1, "{}: the load level", e.code);
                    assert_eq!(c[0].date, start);
                    assert!(
                        (c[0].level - INDEX_BASE).abs() < 1e-9,
                        "1,000 at load (5.14)"
                    );
                }
                None => assert!(e.closes.is_empty(), "{}: no level, no close", e.code),
            }
        }
    }
    // Each day's 00:00 close joins the history, dated that day, at v_zones' last close.
    let mut seen: Vec<Vec<(Date, f64)>> = Vec::new();
    let end = Date::ymd(2020, 2, 3);
    loop {
        sim.step();
        let v = sim.views();
        let today = v.clock().date;
        if seen.is_empty() {
            seen = vec![Vec::new(); v.zones.get().zones.len()];
        }
        for (i, z) in v.zones.get().zones.iter().enumerate() {
            if let Some(close) = z.index_close
                && seen[i].last().is_none_or(|l| l.0 != today)
                && v.clock().hour == 0
            {
                seen[i].push((today, close));
            }
        }
        if today >= end && v.clock().hour == 0 {
            break;
        }
    }
    let v = sim.views();
    let mut checked = 0;
    for (i, e) in v.exchanges.get().exchanges.iter().enumerate() {
        let c: Vec<(Date, f64)> = e.closes.iter().map(|c| (c.date, c.level)).collect();
        if c.is_empty() {
            continue;
        }
        checked += 1;
        assert_eq!(c[0].0, start);
        assert_eq!(&c[1..], seen[i].as_slice(), "{}", e.code);
        assert!(c.windows(2).all(|w| w[0].0 < w[1].0), "one close a day");
        assert_eq!(
            c.len(),
            1 + 33,
            "{}: 1 January, then 2 January to 3 February",
            e.code
        );
        assert_eq!(v.exchanges.get().of_zone(e.zone).unwrap().code, e.code);
    }
    assert!(checked > 0);
    // The view shares the World's chunks (D148).
    let w = sim.world();
    let z = v.exchanges.get().exchanges[0].zone;
    assert!(
        v.exchanges.get().exchanges[0]
            .closes
            .shares_with(&w.market.index_history[z])
    );
}

/// A company's directors in seat position order (5.19.4 step 4; D541): the detail view lists
/// them as the World holds them, each a full character by id or a partial one by its 3.7.1 id.
#[test]
fn company_detail_lists_directors_by_position() {
    let mut sim = Sim::new(data(), 1).unwrap();
    // Directors come with a startup whose cast outnumbers its labor seats: run lock by lock
    // until one is born.
    for year in 2020..2026 {
        common::ops::run_to(&mut sim, Date::ymd(year, 1, 10));
        if sim
            .world()
            .companies
            .iter()
            .any(|(_, c)| !c.directors.is_empty())
        {
            break;
        }
    }
    let w = sim.world();
    let v = sim.views().company_detail.get();
    let mut with = 0;
    for (id, c) in w.companies.iter() {
        let d = v.get(id).unwrap();
        assert_eq!(d.directors.len(), c.directors.len());
        for (p, dir) in d.directors.iter().zip(&c.directors) {
            match dir {
                Director::Full(ch) => {
                    assert_eq!(p.character, Some(*ch));
                    assert!(!p.partial && p.partial_id.is_none());
                    assert_eq!(p.name, w.characters[*ch].name);
                }
                Director::Simple(s) => {
                    assert_eq!(p.partial_id, Some(s.id));
                    assert!(p.partial && p.character.is_none());
                    assert_eq!(p.name, s.character.name);
                }
            }
        }
        with += usize::from(!c.directors.is_empty());
    }
    assert!(with > 0, "a startup with directors");
}

/// Each IPO ballot names who held the role at the vote (D542): right after the first lock the
/// board has not moved, so every seat and director ballot names today's holder.
#[test]
fn ipo_ballots_name_their_voters() {
    let mut sim = Sim::new(data(), 1).unwrap();
    common::ops::run_to(&mut sim, Date::ymd(2020, 1, 10));
    let w = sim.world();
    let v = sim.views().company_detail.get();
    let mut ballots = 0;
    for d in &v.companies {
        let Some(rec) = &d.ipo_last_vote else {
            continue;
        };
        let c = &w.companies[d.id];
        for b in &rec.result.ballots {
            ballots += 1;
            let voter = b.voter.clone().expect("a voter");
            let same = |p: &SeatPerson| match &voter {
                BallotVoter::Full(ch) => p.character == Some(*ch),
                BallotVoter::Partial { id, name } => p.partial_id == Some(*id) && &p.name == name,
                BallotVoter::State => false,
            };
            match b.role {
                VoterRole::Seat(seat) => {
                    let card = d.board.iter().find(|s| s.seat == seat).unwrap();
                    assert!(same(card.holder.as_ref().unwrap()), "{}", d.name);
                }
                VoterRole::Director(i) => assert!(same(&d.directors[i as usize])),
                VoterRole::Controller => match voter {
                    BallotVoter::State => assert!(c.state_controlled),
                    BallotVoter::Full(ch) => assert_eq!(c.controller, Some(ch)),
                    BallotVoter::Partial { .. } => panic!("a controller is full or the state"),
                },
            }
        }
    }
    assert!(ballots > 0, "votes at the first lock");
}

/// Each startup headline carries the id of the event it reports (D543), and every event fired
/// is reported by exactly one posted headline.
#[test]
fn startup_headlines_carry_their_event() {
    let mut sim = Sim::new(data(), 1).unwrap();
    common::ops::run_to(&mut sim, Date::ymd(2020, 4, 11));
    let w = sim.world();
    let mut reports = vec![0; w.births.events.len()];
    for h in w.news.feed.iter() {
        let startup = matches!(
            h.kind,
            HeadlineKind::FixedStartupEvent { .. }
                | HeadlineKind::StartupLaunch
                | HeadlineKind::HotCluster { .. }
        );
        assert_eq!(h.event.is_some(), startup, "{}", h.text);
        let Some(id) = h.event else {
            continue;
        };
        let e = &w.births.events[id.index()];
        assert_eq!(e.id, id);
        assert_eq!(e.date, h.date, "dated at the plan lock");
        match &h.kind {
            HeadlineKind::StartupLaunch => assert_eq!(e.companies, vec![h.company.unwrap()]),
            HeadlineKind::HotCluster { startups } => {
                assert_eq!(e.companies.len(), *startups as usize);
            }
            HeadlineKind::FixedStartupEvent { event, .. } => {
                assert!(matches!(&e.kind, EventKind::Fixed(k) if k == event));
            }
            _ => unreachable!(),
        }
        reports[id.index()] += 1;
    }
    assert!(!reports.is_empty());
    assert!(reports.iter().all(|&n| n == 1), "{reports:?}");
}

/// Each posted headline has a stable id, its place in post order from 0 (D544); v_news finds
/// any headline by it, and a save keeps it.
#[test]
fn headlines_have_stable_ids() {
    let mut sim = Sim::new(data(), 1).unwrap();
    common::ops::run_to(&mut sim, Date::ymd(2020, 7, 12));
    let v = sim.views().news.get();
    let ids: Vec<u32> = v.feed.iter().map(|h| h.id.0).collect();
    assert!(ids.len() > 50, "a half year of headlines");
    assert_eq!(ids, (0..ids.len() as u32).collect::<Vec<_>>());
    for h in v.feed.iter() {
        assert_eq!(v.get(h.id), Some(h));
    }
    assert_eq!(v.get(HeadlineId(ids.len() as u32)), None);
    let today: Vec<_> = sim.world().news.today.iter().map(|h| h.id).collect();
    for id in today {
        assert_eq!(
            v.get(id).map(|h| h.id),
            Some(id),
            "today's posts carry their ids"
        );
    }
    let bytes = sim.save_bytes();
    let mut back = Sim::new(data(), 2).unwrap();
    back.load_bytes(&bytes).unwrap();
    assert_eq!(back.views().news.get().feed, v.feed);
}
