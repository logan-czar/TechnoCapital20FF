//! The News feed at scale (M9 C1, task 6 of the requests lanes B1 and B2 logged; D545): late in
//! a game the wire holds tens of thousands of headlines, and the feed table, the industry
//! page's headlines and an event's headlines must cost the same as early on. A synthetic feed
//! of 60,000 headlines checks that the work stays bounded, and a reference build of the whole
//! feed (the old way: every row, sorted) checks the lazy walk gives the same rows in the same
//! order.

mod common;

use std::time::Instant;

use common::data;
use game::command::index::NameIndex;
use game::pages::PageRef;
use game::pages::live::Filter;
use game::pages::news::{FEED_ROWS, Feed, FeedItem, event_headlines, newest_headlines, news_table};
use sim::Sim;
use sim::births::random::{EventKind, EventType};
use sim::news::Headline;
use sim::time::Date;
use sim::views::NewsView;
use sim::views::births::EventRow;
use sim::world::{CompanyId, HeadlineId, IndustryId, StartupEventId};

/// Industries in the synthetic feed.
const INDUSTRIES: u32 = 42;
/// Companies in the synthetic feed.
const COMPANIES: u32 = 900;

/// A feed of `n` headlines over about 30 years, 5 or so a day, with a startup event (and its
/// hot cluster headline) every 40th headline, plus an event a day after the last that posted
/// none (fired today, its headline posts at the next 00:00).
fn synthetic(n: u32) -> (NewsView, Vec<EventRow>) {
    let mut news = NewsView::default();
    let mut events: Vec<EventRow> = Vec::new();
    let start = Date::ymd(2020, 1, 2);
    for i in 0..n {
        let date = start.add_days(i64::from(i / 5));
        let industry = IndustryId(i % INDUSTRIES);
        let company = CompanyId(i % COMPANIES);
        let mut h: Headline = if i % 40 == 7 {
            let id = StartupEventId(events.len() as u32);
            events.push(EventRow {
                id,
                kind: EventKind::Random(EventType::HotCluster),
                name: "Hot cluster".into(),
                date,
                industries: vec![industry],
                startups: vec![CompanyId(COMPANIES + id.0), CompanyId(COMPANIES + id.0 + 1)],
            });
            sim::news::hot_cluster(date, industry, "Drones", "Shenzhen", 2).of_event(id)
        } else {
            sim::news::bankruptcy(date, industry, company, &format!("Company {i}"))
        };
        h.id = HeadlineId(i);
        news.feed
            .push(h, |last, h| last.date.month_of() == h.date.month_of());
    }
    let last = news.feed.last().map_or(start, |h| h.date);
    events.push(EventRow {
        id: StartupEventId(events.len() as u32),
        kind: EventKind::Fixed("F2".into()),
        name: "The crypto and SPAC mania".into(),
        date: last.add_days(1),
        industries: vec![IndustryId(1)],
        startups: vec![CompanyId(5)],
    });
    (news, events)
}

/// The old feed (PR #30): every headline and every unreported event, oldest first with a day's
/// events after its headlines, then reversed. Rows as page links.
fn reference(news: &NewsView, events: &[EventRow]) -> Vec<PageRef> {
    let reported: Vec<StartupEventId> = news.feed.iter().filter_map(|h| h.event).collect();
    let mut rows: Vec<(Date, PageRef)> = news
        .feed
        .iter()
        .map(|h| (h.date, PageRef::Headline(h.id)))
        .collect();
    rows.extend(
        events
            .iter()
            .filter(|e| !reported.contains(&e.id))
            .map(|e| (e.date, PageRef::Event(e.id))),
    );
    rows.sort_by_key(|r| r.0);
    rows.reverse();
    rows.into_iter().map(|r| r.1).collect()
}

fn page(i: &FeedItem<'_>) -> PageRef {
    match i {
        FeedItem::Headline { page, .. } => page.clone(),
        FeedItem::Event(e) => PageRef::Event(e.id),
    }
}

fn ms(f: impl FnOnce()) -> f64 {
    let t = Instant::now();
    f();
    t.elapsed().as_secs_f64() * 1e3
}

#[test]
fn the_lazy_feed_matches_the_whole_feed() {
    let (news, events) = synthetic(4_000);
    let got: Vec<PageRef> = Feed::new(&news, &events).map(|i| page(&i)).collect();
    assert_eq!(got, reference(&news, &events));
    assert_eq!(
        got[0],
        PageRef::Event(events.last().unwrap().id),
        "today's unreported event"
    );
    // Each hot cluster headline links its event, by id.
    for i in Feed::new(&news, &events) {
        if let FeedItem::Headline { h, event, .. } = i {
            assert_eq!(event.map(|e| e.id), h.event);
        }
    }
    // And on a real game's feed, past the first release and lock.
    let mut sim = Sim::new(data(), 3).unwrap();
    while sim.views().clock().date < Date::ymd(2020, 7, 15) {
        sim.step();
    }
    let v = sim.views();
    let (news, events) = (v.news.get(), &v.births.get().events);
    assert!(news.feed.len() > 50);
    let got: Vec<PageRef> = Feed::new(news, events).map(|i| page(&i)).collect();
    assert_eq!(got, reference(news, events));
}

/// The feed table, an industry's headlines and an event's headlines over 60,000 headlines: the
/// table lists the newest FEED_ROWS rows, and each costs about what it costs over 6,000.
#[test]
fn a_long_feed_costs_what_a_short_one_does() {
    let sim = Sim::new(data(), 1).unwrap();
    let index = NameIndex::build(sim.views());
    let (short, short_events) = synthetic(6_000);
    let (long, long_events) = synthetic(60_000);
    let all = Filter::default();
    let time = |news: &NewsView, events: &[EventRow]| {
        let mut rows = 0;
        let table = ms(|| rows = news_table(news, events, &index, &all).len());
        assert_eq!(rows, FEED_ROWS);
        let links = ms(|| {
            assert_eq!(
                newest_headlines(news, |h| h.industry == Some(IndustryId(3)), 12).len(),
                12
            );
        });
        let e = &events[events.len() / 2];
        let mut n = 0;
        let event = ms(|| n = event_headlines(news, e).count());
        assert_eq!(n, 1, "the event's one headline");
        (table, links, event)
    };
    // Warm up, then take the best of three of each.
    let _ = time(&short, &short_events);
    let best = |news: &NewsView, events: &[EventRow]| {
        (0..3)
            .map(|_| time(news, events))
            .reduce(|a, b| (a.0.min(b.0), a.1.min(b.1), a.2.min(b.2)))
            .unwrap()
    };
    let s = best(&short, &short_events);
    let l = best(&long, &long_events);
    println!(
        "feed table {:.2} ms vs {:.2} ms (6,000 vs 60,000 headlines)",
        s.0, l.0
    );
    println!("industry headlines {:.3} ms vs {:.3} ms", s.1, l.1);
    println!("event headlines {:.3} ms vs {:.3} ms", s.2, l.2);
    // Ten times the headlines, about the same cost: well under twice, with slack for noise.
    assert!(l.0 < 2.0 * s.0 + 5.0, "feed table {s:?} vs {l:?}");
    assert!(l.1 < 2.0 * s.1 + 1.0, "industry headlines {s:?} vs {l:?}");
    assert!(l.2 < 2.0 * s.2 + 1.0, "event headlines {s:?} vs {l:?}");
    // A filter that matches little still walks without building rows; "All" lists everything.
    let none = Filter::default().with("company", u64::from(COMPANIES * 10) + 1);
    let mut rows = usize::MAX;
    let walk = ms(|| rows = news_table(&long, &long_events, &index, &none).len());
    assert_eq!(rows, 0);
    println!("a filter that matches nothing, 60,000 headlines: {walk:.2} ms");
    let every = Filter::default().with("show", 3);
    let mut rows = 0;
    let whole = ms(|| rows = news_table(&long, &long_events, &index, &every).len());
    println!("the whole feed (Show: All, as every move did before), {rows} rows: {whole:.2} ms");
    assert_eq!(
        news_table(&short, &short_events, &index, &every).len(),
        reference(&short, &short_events).len()
    );
}
