//! M9 lane B1: the Company, Character, Country, Zone and Exchange pages. Most tests read the
//! pages' data form ([`PageDoc`], D480), built from the views of a real game; the shell tests
//! open them in the headless workspace and click their links, tabs and section buttons.

mod common;

use std::collections::BTreeSet;

use bevy::picking::pointer::PointerButton;
use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, alerts_off, data, frames, send};
use game::bridge::{SimBridgePlugin, Views};
use game::chart::Chart;
use game::command::index::NameIndex;
use game::config::{self, UiConfig};
use game::links::Link;
use game::pages::character::character_doc;
use game::pages::company::{self, SECTIONS, company_doc};
use game::pages::country::country_doc;
use game::pages::doc::{Block, Live, LiveSpan, PageDoc, SectionDoc, Span, TabButton, current_tab};
use game::pages::exchange::exchange_doc;
use game::pages::zone::{index_chart, zone_doc};
use game::pages::{PageKind, PageRef, SectionHeader};
use game::table::format;
use game::table::{Cell, Table};
use game::test_support::click;
use game::ui::ShellPlugin;
use game::workspace::{OpenPage, OpenTarget, PaneFrame, Workspace};
use sim::births::ipo::{Ballot, BallotVoter, VoteResult, VoterRole};
use sim::people::board::Seat;
use sim::views::company_detail::SeatPerson;
use sim::views::company_rows::Listing;
use sim::views::estimate::Figure;
use sim::world::{IpoVoteRecord, Origin, ZoneId};
use sim::{Control, Notice, Sim, SimViews};

/// Ticks to the end of the first plan lock (9 January 2020 00:00 is tick 192): births, IPO
/// votes and a listing in play have happened.
const AFTER_FIRST_LOCK: usize = 200;

fn fresh() -> Sim {
    Sim::new(data(), 42).unwrap()
}

/// A game just past the first plan lock, with the notices it posted.
fn after_lock() -> (Sim, Vec<Notice>) {
    let mut sim = fresh();
    let mut notices = Vec::new();
    for _ in 0..AFTER_FIRST_LOCK {
        notices.extend(sim.step());
    }
    (sim, notices)
}

fn texts(doc: &PageDoc, v: &SimViews) -> String {
    doc.texts(v).join(" | ")
}

/// Every B1 page of every entity builds from the views of a fresh world and of one past the
/// first lock (born companies, a listing in play): every company, full character, country,
/// zone and exchange, each with its title and its sections.
#[test]
fn every_entity_page_builds() {
    let (sim, _) = after_lock();
    for v in [fresh().views().clone(), sim.views().clone()] {
        let index = NameIndex::build(&v);
        let mut kinds = BTreeSet::new();
        for r in &v.company_rows.get().rows {
            let d = company_doc(r.id, &v, &index);
            assert_eq!(d.title, r.name);
            let ids: Vec<_> = d.sections.iter().map(|s| s.id).collect();
            let want: Vec<_> = SECTIONS.iter().map(|s| s.0).collect();
            assert_eq!(ids, want, "{}", r.name);
            assert!(!texts(&d, &v).contains("No such"), "{}", r.name);
            kinds.insert(r.public);
        }
        assert_eq!(kinds.len(), 2, "public and private companies");
        for c in &v.characters.get().full {
            let sim::views::characters::CharacterRef::Full(id) = c.id else {
                unreachable!()
            };
            let d = character_doc(id, &v, &index);
            assert_eq!(d.title, c.name);
            assert_eq!(d.sections.len(), 3);
        }
        for c in &v.countries.get().countries {
            let d = country_doc(c.id, &v, &index);
            assert_eq!(d.title, c.name);
            let t = d.table("country.companies").unwrap();
            assert_eq!(t.model.len(), c.hq_companies.len(), "{}", c.name);
        }
        for z in &v.zones.get().zones {
            let d = zone_doc(z.id, &v, &index);
            assert_eq!(d.title, z.name);
            assert_eq!(
                d.table("zone.members").unwrap().model.len(),
                z.members.len()
            );
            let x = exchange_doc(z.id, &v, &index);
            assert!(!x.title.is_empty());
            let listed = v.exchanges.get().exchanges[z.id.0 as usize]
                .constituents
                .len();
            assert_eq!(
                x.table("exchange.constituents").unwrap().model.len(),
                listed
            );
        }
    }
}

/// The labels of a doc's fields.
fn labels(doc: &PageDoc) -> BTreeSet<String> {
    doc.fields().into_iter().map(|f| f.label.clone()).collect()
}

fn section<'a>(doc: &'a PageDoc, id: &str) -> &'a SectionDoc {
    doc.section(id).unwrap_or_else(|| panic!("section {id}"))
}

fn section_text(doc: &PageDoc, id: &str, v: &SimViews) -> String {
    let only = PageDoc {
        head: Vec::new(),
        chips: Vec::new(),
        sections: vec![section(doc, id).clone()],
        ..doc.clone()
    };
    texts(&only, v)
}

/// Every spec 8 Company field (M9.2 done line) and the startups-and-listings parts (M9.7), on a
/// listed starting company, a private one, a born one and a listing in play.
#[test]
fn company_pages_show_every_spec8_field() {
    let (sim, _) = after_lock();
    let v = sim.views().clone();
    let index = NameIndex::build(&v);
    let rows = &v.company_rows.get().rows;
    let listed = rows
        .iter()
        .find(|r| matches!(r.listing, Listing::BeforeStart { .. }))
        .unwrap();
    let private = rows
        .iter()
        .find(|r| r.listing == Listing::Private && r.origin == Origin::Start)
        .unwrap();
    let born = rows.iter().find(|r| r.origin.is_born()).expect("a birth");
    let in_play = rows
        .iter()
        .find(|r| matches!(r.listing, Listing::InPlay { .. }))
        .expect("a listing at the first lock");
    for r in [listed, private, born, in_play] {
        let doc = company_doc(r.id, &v, &index);
        let l = labels(&doc);
        let all = texts(&doc, &v);
        // Header (spec 8): name, ticker, HQ, industry, owner of record, controller.
        assert_eq!(doc.title, r.name);
        for want in ["Ticker", "HQ", "Industry", "Owner of record", "Controller"] {
            assert!(l.contains(want), "{}: header {want}", r.name);
        }
        assert!(all.contains("Founded"), "{}", r.name);
        assert!(
            all.contains("Listed") || all.contains("Private: not listed"),
            "{}",
            r.name
        );
        // Overview: value, price, confidence, management score, cash, line, rating, next
        // release.
        for want in [
            "Value",
            "Price",
            "Confidence",
            "Management score",
            "Cash",
            "Credit line",
            "Rating",
            "Next release",
        ] {
            assert!(l.contains(want), "{}: overview {want}", r.name);
        }
        // Board: seat cards for labor units 1 to 5 with the skill used, founders, directors,
        // the IPO vote.
        let board = section(&doc, "board");
        let cards: Vec<_> = board
            .blocks
            .iter()
            .filter_map(|b| match b {
                Block::Cards(c) => Some(c),
                _ => None,
            })
            .collect();
        assert_eq!(cards[0].len(), 5, "five seat cards");
        assert!(
            cards[0]
                .iter()
                .all(|c| c.fields.iter().any(|f| f.label == "Skill used"))
        );
        let bt = section_text(&doc, "board", &v);
        for want in ["Seats", "Founders", "Directors", "IPO vote"] {
            assert!(bt.contains(want), "{}: board {want}", r.name);
        }
        // Cap table: the holders, summing to the shares out.
        let ct = doc.table("company.cap_table").unwrap();
        let sum: i64 = (0..ct.model.len())
            .map(|i| match ct.model.cell(i, 2) {
                Cell::Int(n) => *n,
                c => panic!("{c:?}"),
            })
            .sum();
        let d = v.company_detail.get().get(r.id).unwrap();
        assert_eq!(sum as u64, d.shares_out, "{}", r.name);
        // Units: industry, base province, assets, productivity, growth, R&D, revenue, expenses.
        let u = doc.table("company.units").unwrap();
        for want in [
            "Industry",
            "Base province",
            "Assets",
            "Productivity",
            "Growth",
            "R&D",
            "Revenue",
            "Expenses",
        ] {
            assert!(u.model.column_by_key(want).is_some(), "units {want}");
        }
        assert_eq!(u.model.len(), v.units.get().of_company(r.id).count());
        // Financials: the quarterly statements and the Quarter view.
        let s = doc.table("company.statements.quarters").unwrap();
        assert!(s.model.len() >= sim::views::estimate::StatementLine::ALL.len());
        // A born company has no quarter closed yet; a starting one has its 2019 history.
        assert_eq!(
            s.model.columns.len() > 1,
            r.origin == Origin::Start,
            "{}: published quarters",
            r.name
        );
        for want in ["Last results", "Projection range", "Consensus"] {
            assert!(l.contains(want), "{}: financials {want}", r.name);
        }
        // Tech: labor split, stations, PC and the next step, data quests with a bar, inflow
        // against decay.
        for want in ["Labor split", "Stations", "PC", "Next step", "Inflow"] {
            assert!(l.contains(want), "{}: tech {want}", r.name);
        }
        let quests = section(&doc, "tech")
            .blocks
            .iter()
            .find_map(|b| match b {
                Block::Cards(c) => Some(c),
                _ => None,
            })
            .expect("data quests cards");
        assert!(quests.iter().all(|c| c.bar.is_some()), "progress bars");
        // The price chart for a listed company, live on its bars (a listing of this lock has
        // none until its first close, so its chart starts empty).
        let chart = section(&doc, "chart").blocks.iter().find_map(|b| match b {
            Block::Chart(m, live) => Some((m, *live)),
            _ => None,
        });
        let bars = v.price_bars.get().companies.iter().any(|h| h.id == r.id);
        assert_eq!(chart.is_some(), r.public, "{}: chart", r.name);
        if let Some((m, live)) = chart {
            assert_eq!(!m.labels.is_empty(), bars, "{}: bars", r.name);
            assert!(live.is_some(), "{}: live chart", r.name);
        }
        assert!(bars || !matches!(r.listing, Listing::BeforeStart { .. }));
    }
    // Founded [date] ([event]): a born company names its event, and its founders' cards show
    // skills, traits and the home province.
    let doc = company_doc(born.id, &v, &index);
    let Origin::Born { date, event } = born.origin else {
        unreachable!()
    };
    let founded = doc
        .head
        .iter()
        .find_map(|b| match b {
            Block::Line(s)
                if s.iter()
                    .any(|x| matches!(x, Span::Text(t) if t.starts_with("Founded"))) =>
            {
                Some(s)
            }
            _ => None,
        })
        .unwrap();
    assert!(founded.contains(&Span::text(format!("Founded {}", format::date(date)))));
    assert!(
        founded
            .iter()
            .any(|s| matches!(s, Span::Link(_, PageRef::Event(e)) if *e == event))
    );
    let bt = section_text(&doc, "board", &v);
    assert!(bt.contains("lead founder"));
    for want in ["Skills", "Traits", "Home"] {
        assert!(labels(&doc).contains(want), "founder card {want}");
    }
    // Listed [date] on [exchange] at $[price].
    let doc = company_doc(in_play.id, &v, &index);
    let Listing::InPlay {
        exchange,
        date,
        ipo_price,
    } = in_play.listing
    else {
        unreachable!()
    };
    let all = texts(&doc, &v);
    assert!(all.contains(&format!("Listed {} on", format::date(date))));
    assert!(all.contains(&format!("at {}", format::price(ipo_price))));
    assert!(doc.links().contains(&PageRef::Exchange(exchange)));
    // A listed starting company: "listed before 2020".
    let all = texts(&company_doc(listed.id, &v, &index), &v);
    assert!(all.contains("Listed before 2020 on"));
}

/// The money figures a page shows as fields, by label.
fn figure_fields(doc: &PageDoc) -> Vec<(String, Vec<Figure>)> {
    doc.fields()
        .into_iter()
        .map(|f| {
            let figs = f
                .value
                .iter()
                .filter_map(|s| match s {
                    Span::Figure(x, _) => Some(*x),
                    _ => None,
                })
                .collect::<Vec<_>>();
            (f.label.clone(), figs)
        })
        .filter(|(_, f)| !f.is_empty())
        .collect()
}

/// A private company's pages show bands and never the truth (D420, D461), Omniscient off; in
/// debug builds an Omniscient twin of the same game gives the truth, which lies strictly inside
/// each band and appears nowhere on the private page.
#[test]
fn a_private_company_page_shows_bands_and_never_the_truth() {
    let (mut sim, _) = after_lock();
    assert!(!sim.controls().omniscient);
    let v = sim.views().clone();
    let index = NameIndex::build(&v);
    let row = v
        .company_rows
        .get()
        .rows
        .iter()
        .find(|r| {
            r.estimated && !r.public && r.status == sim::finance::distress::CompanyStatus::Active
        })
        .unwrap()
        .clone();
    let doc = company_doc(row.id, &v, &index);
    let shown = figure_fields(&doc);
    for want in [
        "Value",
        "Value a share",
        "Cash",
        "Credit line",
        "Revenue TTM",
        "Net income TTM",
    ] {
        let (_, figs) = shown
            .iter()
            .find(|(l, _)| l == want)
            .unwrap_or_else(|| panic!("{want}"));
        assert!(figs.iter().all(|f| f.is_band()), "{want} is a band");
    }
    // Every money cell of the statements and units tables is a band, but the compute line
    // (exact by D434).
    for id in ["company.statements.quarters", "company.units"] {
        let t = &doc.table(id).unwrap().model;
        let mut bands = 0;
        for r in 0..t.len() {
            for c in 1..t.columns.len() {
                match t.cell(r, c) {
                    Cell::Money(_) => {
                        let line = t.display(r, 0);
                        let col = &t.columns[c].title;
                        assert!(
                            line.contains("Compute") || col.contains("Compute"),
                            "{id} {line} {col}: a money cell must be a band"
                        );
                    }
                    Cell::Band { .. } => bands += 1,
                    _ => {}
                }
            }
        }
        assert!(bands > 0, "{id}");
    }
    let text = texts(&doc, &v);
    assert!(text.contains("estimates"));
    // The texts that are not bands: a band shows only its own range, whose ends can round to
    // the same three digits as the truth inside it.
    let plain = doc
        .texts(&v)
        .into_iter()
        .filter(|t| !(t.contains("-$") || t.contains(" to ")))
        .collect::<Vec<_>>()
        .join(" | ");
    if !cfg!(debug_assertions) {
        return; // Omniscient is debug-only (spec 1).
    }
    sim.apply(Control::SetOmniscient(true)).unwrap();
    let t = sim.views().clone();
    let truth_doc = company_doc(row.id, &t, &NameIndex::build(&t));
    let truth = figure_fields(&truth_doc);
    let mut checked = 0;
    for (label, figs) in &shown {
        let Some((_, exact)) = truth.iter().find(|(l, _)| l == label) else {
            continue;
        };
        for (f, x) in figs.iter().zip(exact) {
            let (Some(b), Some(x)) = (f.band(), x.exact()) else {
                continue;
            };
            assert!(b.low < x && x < b.high, "{label}: inside");
            assert!(b.low != x && b.high != x && b.estimate != x);
            if x.abs() >= 1e6 {
                let s = format::money(x);
                assert!(!plain.contains(&s), "{label}: the truth {s} shows");
                checked += 1;
            }
        }
    }
    // The statements: each banded quarter against the twin's exact one of the same period.
    let ours = &doc.table("company.statements.quarters").unwrap().model;
    let theirs = &truth_doc
        .table("company.statements.quarters")
        .unwrap()
        .model;
    for c in 1..ours.columns.len() {
        let tc = (1..theirs.columns.len())
            .find(|&k| theirs.columns[k].title == ours.columns[c].title)
            .expect("the twin has the quarter");
        for r in 0..ours.len() {
            if let (Cell::Band { low, high, .. }, Cell::Money(x)) =
                (ours.cell(r, c), theirs.cell(r, tc))
            {
                assert!(
                    low < x && x < high,
                    "{} {}",
                    ours.display(r, 0),
                    ours.columns[c].title
                );
                if x.abs() >= 1e6 {
                    assert!(
                        !plain.contains(&format::money(*x)),
                        "{}",
                        ours.display(r, 0)
                    );
                    checked += 1;
                }
            }
        }
    }
    assert!(checked > 20, "checked {checked} truths");
    // With Omniscient on, the same page shows exact figures and no estimates chip.
    assert!(
        figure_fields(&truth_doc)
            .iter()
            .all(|(_, f)| f.iter().all(|x| !x.is_band()))
    );
}

/// Each page links where it should: names, places, controllers, exchanges and events.
#[test]
fn pages_link_their_names() {
    let (sim, _) = after_lock();
    let v = sim.views().clone();
    let index = NameIndex::build(&v);
    for r in v.company_rows.get().rows.iter().take(80).chain(
        v.company_rows
            .get()
            .rows
            .iter()
            .filter(|r| r.origin.is_born()),
    ) {
        let links = company_doc(r.id, &v, &index).links();
        assert!(links.contains(&PageRef::Industry(r.industry)), "{}", r.name);
        assert!(
            links.contains(&PageRef::Country(r.hq_country)),
            "{}",
            r.name
        );
        if let Some(z) = r.exchange {
            assert!(links.contains(&PageRef::Exchange(z)));
        }
        if let Some(p) = game::links::names::controller_page(r.controller) {
            assert!(links.contains(&p), "{}: controller", r.name);
        }
        if let Some(o) = r.owner_of_record {
            assert!(links.contains(&PageRef::Character(o)));
        }
        if let Origin::Born { event, .. } = r.origin {
            assert!(links.contains(&PageRef::Event(event)));
            for &f in &v.company_detail.get().get(r.id).unwrap().founders {
                assert!(links.contains(&PageRef::Character(f)), "founder");
            }
        }
        // Full seat holders link; partial ones are marked and not linked.
        for s in &v.company_detail.get().get(r.id).unwrap().board {
            if let Some(p) = &s.holder {
                match p.character {
                    Some(c) if !p.partial => assert!(links.contains(&PageRef::Character(c))),
                    _ => {}
                }
            }
        }
    }
    for c in v.characters.get().full.iter().take(60) {
        let sim::views::characters::CharacterRef::Full(id) = c.id else {
            unreachable!()
        };
        let links = character_doc(id, &v, &index).links();
        if let Some(home) = &c.home {
            assert!(links.contains(&PageRef::Country(home.country)));
        }
        for r in &c.roles {
            let (_, co) = game::links::names::role(r);
            assert!(links.contains(&PageRef::Company(co)));
        }
        for hd in &c.holdings {
            assert!(links.contains(&PageRef::Company(hd.company)));
        }
    }
    for c in &v.countries.get().countries {
        let links = country_doc(c.id, &v, &index).links();
        assert!(links.contains(&PageRef::Zone(c.zone)));
        assert!(links.contains(&PageRef::Exchange(c.zone)));
        for &co in &c.hq_companies {
            assert!(links.contains(&PageRef::Company(co)));
        }
    }
    for z in &v.zones.get().zones {
        let links = zone_doc(z.id, &v, &index).links();
        assert!(links.contains(&PageRef::Exchange(z.id)));
        for &c in &z.members {
            assert!(links.contains(&PageRef::Country(c)));
        }
        let links = exchange_doc(z.id, &v, &index).links();
        assert!(links.contains(&PageRef::Zone(z.id)));
        let x = &v.exchanges.get().exchanges[z.id.0 as usize];
        for &co in &x.constituents {
            assert!(links.contains(&PageRef::Company(co)));
        }
    }
}

/// No page shows a ballot's odds (20-ui 20.1, D482): a vote shows each member's yes or no, and
/// the chances in the view never reach the text, on a hand-made vote and on every real vote of
/// the first lock.
#[test]
fn no_ballot_odds_anywhere() {
    let (sim, notices) = after_lock();
    assert!(notices.iter().any(|n| matches!(n, Notice::IpoVote { .. })));
    let v = sim.views().clone();
    let index = NameIndex::build(&v);
    let odds_texts = |chance: f64| {
        [
            format!("{:.0}%", chance * 100.0),
            format!("{:.1}%", chance * 100.0),
            format!("{chance:.2}"),
            format!("{chance:.3}"),
        ]
    };
    let mut voted = 0;
    for d in &v.company_detail.get().companies {
        let Some(rec) = &d.ipo_last_vote else {
            continue;
        };
        voted += 1;
        let doc = company_doc(d.id, &v, &index);
        let bt = section_text(&doc, "board", &v);
        assert!(bt.contains("Last vote"), "{}", d.name);
        for b in &rec.result.ballots {
            for s in odds_texts(b.chance) {
                assert!(!bt.contains(&s), "{}: {s} in {bt}", d.name);
            }
        }
        let all = texts(&doc, &v).to_ascii_lowercase();
        assert!(!all.contains("odds") && !all.contains("chance"));
    }
    assert!(voted > 0, "votes at the first lock");
    // A hand-made vote with distinctive odds: the CEO who voted has since left (another
    // partial), the CFO who voted still sits, Director 1 is a full character, and the
    // controller's vote is the state's.
    let mut d = v.company_detail.get().companies[0].clone();
    let holder = |i: usize| d.board[i].holder.clone().expect("a seated board");
    let (ceo, cfo) = (holder(0), holder(1));
    let full = &v.characters.get().full[0];
    let sim::views::characters::CharacterRef::Full(full_id) = full.id else {
        unreachable!()
    };
    d.ipo_last_vote = Some(IpoVoteRecord {
        date: sim::time::Date::ymd(2020, 4, 9),
        result: VoteResult {
            ballots: vec![
                Ballot {
                    role: VoterRole::Seat(Seat::Ceo),
                    chance: 0.6137,
                    yes: true,
                    voter: Some(BallotVoter::Partial {
                        id: 9_999,
                        name: "Ona Gone".into(),
                    }),
                },
                Ballot {
                    role: VoterRole::Seat(Seat::Cfo),
                    chance: 0.4413,
                    yes: true,
                    voter: Some(BallotVoter::Partial {
                        id: cfo.partial_id.expect("a partial CFO"),
                        name: cfo.name.clone(),
                    }),
                },
                Ballot {
                    role: VoterRole::Director(0),
                    chance: 0.2291,
                    yes: false,
                    voter: Some(BallotVoter::Full(full_id)),
                },
                Ballot {
                    role: VoterRole::Controller,
                    chance: 0.8846,
                    yes: true,
                    voter: Some(BallotVoter::State),
                },
            ],
            yes: 3,
            no: 1,
            passed: true,
        },
        capped: true,
    });
    d.ipo_next_vote = Some(sim::time::Quarter { year: 2020, q: 3 });
    let doc = PageDoc {
        page: PageRef::Company(d.id),
        title: d.name.clone(),
        kind: "Company".into(),
        chips: Vec::new(),
        head: Vec::new(),
        sections: vec![SectionDoc {
            id: "board",
            blocks: company::board(&d, &v, &index),
        }],
    };
    let bt = texts(&doc, &v);
    for want in [
        "CEO",
        "Director 1",
        "Controller",
        "yes",
        "no",
        "passed 3 to 1",
        "Ona Gone",
        "the state",
    ] {
        assert!(bt.contains(want), "{want} in {bt}");
    }
    // The voter, and today's holder only where it is someone else (D542).
    let fields = doc.sections[0]
        .blocks
        .iter()
        .rev()
        .find_map(|b| match b {
            Block::Fields(f) if f.iter().any(|f| f.label == "Controller") => Some(f),
            _ => None,
        })
        .expect("the ballots");
    let line = |label: &str| {
        let f = fields.iter().find(|f| f.label == label).unwrap();
        f.value.clone()
    };
    let held = |spans: &[Span]| {
        spans
            .iter()
            .any(|s| matches!(s, Span::Muted(t) if t.starts_with("(held now by")))
    };
    let ceo_line = line("CEO");
    assert!(ceo_line.contains(&Span::text("Ona Gone")));
    assert!(ceo_line.contains(&Span::muted(format!(
        "(held now by {} (partial))",
        ceo.name
    ))));
    let cfo_line = line("CFO");
    assert!(cfo_line.contains(&Span::text(cfo.name.clone())));
    assert!(
        !held(&cfo_line),
        "the CFO who voted still sits: {cfo_line:?}"
    );
    assert!(line("Director 1").contains(&Span::link(
        index.title(&PageRef::Character(full_id)),
        PageRef::Character(full_id)
    )));
    assert!(
        line("Director 1").contains(&Span::muted("(vacant now)")),
        "no director sits at position 1 now"
    );
    assert!(bt.contains("Next vote 09 Jul 2020"), "{bt}");
    assert!(bt.contains("world cap"));
    for c in [0.6137, 0.4413, 0.2291, 0.8846] {
        for s in odds_texts(c) {
            assert!(!bt.contains(&s), "{s}");
        }
    }
    assert!(!bt.contains('%'), "no percent on the vote: {bt}");
}

/// A director who voted and still sits is no change on the ballot line, even after a director
/// before them left and their position moved up (D542, PR #32 review).
#[test]
fn a_director_who_moved_up_still_counts_as_the_voter() {
    let (sim, _) = after_lock();
    let v = sim.views().clone();
    let index = NameIndex::build(&v);
    let mut d = v.company_detail.get().companies[0].clone();
    let stays = SeatPerson {
        name: "Bo Stays".into(),
        age: 50,
        skills: d.board[0].holder.as_ref().unwrap().skills,
        traits: Vec::new(),
        partial: true,
        character: None,
        partial_id: Some(8_002),
    };
    // At the vote: Director 1 was a partial who has since left, Director 2 was Bo. Now Bo is
    // the only director, at position 1.
    d.directors = vec![stays.clone()];
    let ballot = |n: u32, id: u32, name: &str| Ballot {
        role: VoterRole::Director(n),
        chance: 0.5,
        yes: true,
        voter: Some(BallotVoter::Partial {
            id,
            name: name.into(),
        }),
    };
    d.ipo_last_vote = Some(IpoVoteRecord {
        date: sim::time::Date::ymd(2020, 4, 9),
        result: VoteResult {
            ballots: vec![ballot(0, 8_001, "Al Gone"), ballot(1, 8_002, "Bo Stays")],
            yes: 2,
            no: 0,
            passed: true,
        },
        capped: false,
    });
    let blocks = company::ipo_vote(&d, &index);
    let fields = blocks
        .iter()
        .find_map(|b| match b {
            Block::Fields(f) => Some(f),
            _ => None,
        })
        .expect("the ballots");
    let line = |label: &str| {
        fields
            .iter()
            .find(|f| f.label == label)
            .unwrap()
            .value
            .clone()
    };
    let muted = |spans: &[Span]| {
        spans
            .iter()
            .filter(|s| matches!(s, Span::Muted(_)))
            .cloned()
            .collect::<Vec<_>>()
    };
    assert_eq!(
        muted(&line("Director 1")),
        [Span::muted("(held now by Bo Stays (partial))")]
    );
    assert!(line("Director 2").contains(&Span::text("Bo Stays")));
    assert!(
        muted(&line("Director 2")).is_empty(),
        "Bo still sits: {:?}",
        line("Director 2")
    );
}

/// The Board tab lists the view's directors by seat position (D541): Director 1 first, a full
/// character linked, a partial one marked and not linked.
#[test]
fn board_lists_directors_by_position() {
    let (sim, _) = after_lock();
    let v = sim.views().clone();
    let index = NameIndex::build(&v);
    let mut d = v.company_detail.get().companies[0].clone();
    let full = &v.characters.get().full[0];
    let sim::views::characters::CharacterRef::Full(full_id) = full.id else {
        unreachable!()
    };
    let person = |name: &str, character, partial_id: Option<u32>| SeatPerson {
        name: name.into(),
        age: 41,
        skills: full.skills,
        traits: Vec::new(),
        partial: partial_id.is_some(),
        character,
        partial_id,
    };
    d.directors = vec![
        person("Ada Partial", None, Some(9_001)),
        person(&full.name, Some(full_id), None),
    ];
    let doc = PageDoc {
        page: PageRef::Company(d.id),
        title: d.name.clone(),
        kind: "Company".into(),
        chips: Vec::new(),
        head: Vec::new(),
        sections: vec![SectionDoc {
            id: "board",
            blocks: company::board(&d, &v, &index),
        }],
    };
    let blocks = &doc.sections[0].blocks;
    let at = blocks
        .iter()
        .position(|b| matches!(b, Block::Heading(h) if h == "Directors (2)"))
        .expect("the directors heading");
    let Block::Fields(fields) = &blocks[at + 1] else {
        panic!("the directors' fields")
    };
    let labels: Vec<&str> = fields.iter().map(|f| f.label.as_str()).collect();
    assert_eq!(labels, ["Director 1", "Director 2"]);
    assert_eq!(fields[0].value[0], Span::text("Ada Partial"));
    assert!(matches!(&fields[0].value[1], Span::Colored(t, _) if t == "(partial)"));
    assert_eq!(
        fields[1].value[0],
        Span::link(
            index.title(&PageRef::Character(full_id)),
            PageRef::Character(full_id)
        )
    );
    let links = doc.links();
    assert!(links.contains(&PageRef::Character(full_id)));
}

/// The index chart draws v_exchanges' closes (D540): the load level, then one close a day.
#[test]
fn the_index_chart_draws_the_sim_s_daily_closes() {
    let mut sim = fresh();
    let z = sim
        .views()
        .zones
        .get()
        .zones
        .iter()
        .find(|z| z.index_close.is_some())
        .unwrap()
        .id;
    let points = |sim: &Sim| {
        let v = sim.views();
        index_chart(z, v, &NameIndex::build(v)).labels.len()
    };
    assert_eq!(points(&sim), 1, "the load level");
    for _ in 0..24 * 3 {
        sim.step();
    }
    assert_eq!(points(&sim), 4, "one close a day");
    let v = sim.views();
    let m = index_chart(z, v, &NameIndex::build(v));
    let closes: Vec<_> = v
        .exchanges
        .get()
        .of_zone(z)
        .unwrap()
        .closes
        .iter()
        .copied()
        .collect();
    assert_eq!(m.labels[0], format::date(sim::time::Date::ymd(2020, 1, 1)));
    let game::chart::Series::Line { values, .. } = &m.series[0] else {
        panic!("a line")
    };
    assert_eq!(*values, closes.iter().map(|c| c.level).collect::<Vec<_>>());
}

// ---- The pages in the shell ----

fn shell_app() -> App {
    let data = data();
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, bevy::input::InputPlugin))
        .insert_resource(TimeUpdateStrategy::ManualDuration(FRAME))
        .add_plugins(SimBridgePlugin::new(Sim::new(data, 42).unwrap()))
        .add_plugins(ShellPlugin);
    app.update();
    app
}

fn focused_page(app: &App) -> PageRef {
    let w = app.world().resource::<Workspace>();
    w.page(w.focused()).cloned().unwrap()
}

fn open(app: &mut App, page: PageRef) {
    app.world_mut().write_message(OpenPage {
        page,
        target: OpenTarget::Focused,
    });
    frames(app, 2);
}

fn body(app: &mut App) -> Entity {
    let pane = app.world().resource::<Workspace>().focused();
    app.world_mut()
        .query::<&PaneFrame>()
        .iter(app.world())
        .find(|f| f.pane == pane)
        .unwrap()
        .body
}

fn under<T: Component + Clone>(app: &mut App, root: Entity) -> Vec<(Entity, T)> {
    let mut out = Vec::new();
    let mut stack = vec![root];
    while let Some(e) = stack.pop() {
        if let Some(t) = app.world().get::<T>(e) {
            out.push((e, t.clone()));
        }
        if let Some(c) = app.world().get::<Children>(e) {
            stack.extend(c.iter());
        }
    }
    out
}

/// The entities under `root` with a `T`.
fn holding<T: Component>(app: &mut App, root: Entity) -> Vec<Entity> {
    let mut out = Vec::new();
    let mut stack = vec![root];
    while let Some(e) = stack.pop() {
        if app.world().get::<T>(e).is_some() {
            out.push(e);
        }
        if let Some(c) = app.world().get::<Children>(e) {
            stack.extend(c.iter());
        }
    }
    out
}

/// The ids of the tables under `root` ("" for a table with none).
fn table_ids(app: &mut App, root: Entity) -> Vec<String> {
    let mut out = Vec::new();
    let mut stack = vec![root];
    while let Some(e) = stack.pop() {
        if let Some(t) = app.world().get::<Table>(e) {
            out.push(t.id().unwrap_or_default().to_owned());
        }
        if let Some(c) = app.world().get::<Children>(e) {
            stack.extend(c.iter());
        }
    }
    out
}

fn texts_under(app: &mut App, root: Entity) -> Vec<String> {
    under::<Text>(app, root)
        .into_iter()
        .map(|(_, t)| t.0)
        .collect()
}

/// The B1 pages a shell test opens: a listed and a private company, a character, a country, a
/// zone and an exchange.
fn b1_pages(v: &SimViews) -> Vec<PageRef> {
    let rows = &v.company_rows.get().rows;
    let listed = rows.iter().find(|r| r.public).unwrap().id;
    let private = rows.iter().find(|r| !r.public).unwrap().id;
    vec![
        PageRef::Company(listed),
        PageRef::Company(private),
        PageRef::Character(sim::world::CharacterId(0)),
        PageRef::Country(rows[0].hq_country),
        PageRef::Zone(ZoneId(0)),
        PageRef::Exchange(ZoneId(0)),
    ]
}

/// Each B1 page opens in a pane with its title, its sections and its tables; clicking a link
/// on it opens that link's page in the pane, and Back returns.
#[test]
fn b1_pages_open_and_their_links_navigate() {
    let mut app = shell_app();
    let v = (**app.world().resource::<Views>()).clone();
    for page in b1_pages(&v) {
        open(&mut app, page.clone());
        assert_eq!(focused_page(&app), page);
        let b = body(&mut app);
        let t = texts_under(&mut app, b);
        let title = app.world().resource::<NameIndex>().title(&page);
        assert!(t.contains(&title), "{page}: {title}");
        assert!(!t.iter().any(|x| x.contains("Placeholder")), "{page}");
        let headers = under::<SectionHeader>(&mut app, b);
        assert!(!headers.is_empty(), "{page}: sections");
        let tables = table_ids(&mut app, b).len();
        assert!(
            tables > 0 || matches!(page, PageRef::Character(_)),
            "{page}: tables"
        );
        // Click the first link that goes elsewhere.
        let (e, Link(target)) = under::<Link>(&mut app, b)
            .into_iter()
            .find(|(_, l)| l.0 != page)
            .unwrap_or_else(|| panic!("{page}: a link"));
        app.world_mut().trigger(click(e, PointerButton::Primary));
        frames(&mut app, 2);
        assert_eq!(
            focused_page(&app),
            target,
            "{page}: the link opens its page"
        );
        open(&mut app, PageRef::World);
    }
}

/// Runs the game at max speed (no alert pausing it) until `done` holds on the views, then
/// pauses and draws a frame.
fn run_until(app: &mut App, done: impl Fn(&SimViews) -> bool) {
    alerts_off(app);
    send(app, Control::SetSpeed(5));
    send(app, Control::Resume);
    for _ in 0..20_000 {
        app.update();
        if done(app.world().resource::<Views>()) {
            break;
        }
    }
    assert!(done(app.world().resource::<Views>()), "ran out of frames");
    send(app, Control::Pause);
    frames(app, 1);
}

/// A listed company page's price follows v_quotes without a rebuild: the same live span's text
/// moves with the price as the game runs.
#[test]
fn live_values_follow_the_views() {
    let mut app = shell_app();
    let v = (**app.world().resource::<Views>()).clone();
    let id = v.quotes.get().rows[0].id;
    open(&mut app, PageRef::Company(id));
    // Past the Q4 2019 release (2 January), whose quarterly views rebuild the page.
    run_until(&mut app, |v| {
        v.clock().date >= sim::time::Date::ymd(2020, 1, 3)
    });
    let b = body(&mut app);
    let lives = under::<LiveSpan>(&mut app, b);
    let (e, _) = *lives
        .iter()
        .find(|(_, l)| l.0 == Live::Price(id))
        .expect("a live price");
    let shown = app.world().get::<Text>(e).unwrap().0.clone();
    let price = |v: &SimViews| format::price(v.quotes.get().get(id).unwrap().last);
    assert_eq!(shown, price(app.world().resource::<Views>()));
    run_until(&mut app, |v| price(v) != shown);
    let now = app.world().get::<Text>(e).expect("the same span").0.clone();
    assert_ne!(now, shown, "the price moved");
    assert_eq!(now, price(app.world().resource::<Views>()));
}

/// A Zone and an Exchange page do not rebuild on the daily views (D485), yet their daily
/// figures, index chart and constituents table follow the first day that passes after they
/// open (D488): the chart and table were seeded with the versions they were built from.
#[test]
fn live_tables_and_charts_follow_the_first_change() {
    let mut app = shell_app();
    let v = (**app.world().resource::<Views>()).clone();
    let z = v
        .zones
        .get()
        .zones
        .iter()
        .find(|z| z.index_close.is_some())
        .unwrap()
        .id;
    let today = v.clock().date;
    let points = |app: &App, e: Entity| -> usize {
        let c = app.world().get::<Chart>(e).expect("not rebuilt");
        c.model().labels.len()
    };
    // The Zone page: its chart and last close.
    open(&mut app, PageRef::Zone(z));
    let b = body(&mut app);
    let chart = holding::<Chart>(&mut app, b)[0];
    assert_eq!(points(&app, chart), 1, "today's close");
    let (close, _) = *under::<LiveSpan>(&mut app, b)
        .iter()
        .find(|(_, l)| l.0 == Live::IndexClose(z))
        .expect("a live last close");
    run_until(&mut app, |v| v.clock().date > today);
    let views: &SimViews = app.world().resource::<Views>();
    // The load level, then a close for each day that passed (a frame may pass more than one).
    let closes = views.exchanges.get().of_zone(z).unwrap().closes.len();
    assert!(closes >= 2);
    assert_eq!(points(&app, chart), closes, "the next day's close");
    let want = format::number(views.zones.get().get(z).unwrap().index_close.unwrap());
    assert_eq!(app.world().get::<Text>(close).unwrap().0, want);
    // The Exchange page: its constituents table.
    open(&mut app, PageRef::Exchange(z));
    let b = body(&mut app);
    let table = holding::<Table>(&mut app, b)
        .into_iter()
        .find(|&e| app.world().get::<Table>(e).unwrap().id() == Some("exchange.constituents"))
        .expect("the constituents table");
    let day = app.world().resource::<Views>().clock().date;
    run_until(&mut app, |v| v.clock().date > day);
    let views = (**app.world().resource::<Views>()).clone();
    let index = app.world().resource::<NameIndex>();
    let want = game::pages::exchange::constituents_model(z, &views, index);
    let t = app.world().get::<Table>(table).expect("not rebuilt");
    assert_eq!(
        *t.model(),
        want,
        "the table follows the first v_exchanges move"
    );
}

/// A load shows the loaded game's whole index history (D540): its closes come from the save,
/// not from what the UI saw this session.
#[test]
fn a_load_shows_the_saved_index_history() {
    // Removed when the test ends, pass or fail.
    let dir = game::test_support::Scratch::new("m9-c1-index-load");
    let path = dir.join("save.bin");
    let mut saved = fresh();
    for _ in 0..60 {
        saved.step();
    }
    saved.save(&path).unwrap();
    let mut app = shell_app();
    let z = app
        .world()
        .resource::<Views>()
        .zones
        .get()
        .zones
        .iter()
        .find(|z| z.index_close.is_some())
        .unwrap()
        .id;
    open(&mut app, PageRef::Zone(z));
    let b = body(&mut app);
    let chart = holding::<Chart>(&mut app, b)[0];
    let points = |app: &App| {
        app.world()
            .get::<Chart>(chart)
            .map(|c| c.model().labels.len())
    };
    assert_eq!(points(&app), Some(1), "a fresh game: the load level");
    send(&mut app, Control::Load(path.clone()));
    frames(&mut app, 3);
    assert_eq!(
        app.world().resource::<Views>().clock().date,
        sim::time::Date::ymd(2020, 1, 3)
    );
    let b = body(&mut app);
    let chart = holding::<Chart>(&mut app, b)[0];
    let n = app
        .world()
        .get::<Chart>(chart)
        .unwrap()
        .model()
        .labels
        .len();
    assert_eq!(n, 3, "1, 2 and 3 January: the saved game's whole history");
}

/// The Company page's sections fold, move and hide from their header buttons, and its tab
/// strip shows one section at a time; every choice lives in the UI config, survives its text
/// round trip (the config file), and rebuilds the page.
#[test]
fn company_sections_and_tabs_persist() {
    let mut app = shell_app();
    let v = (**app.world().resource::<Views>()).clone();
    let id = v.company_rows.get().rows[0].id;
    open(&mut app, PageRef::Company(id));
    let header = |app: &mut App, id: &str| -> Entity {
        let b = body(app);
        under::<SectionHeader>(app, b)
            .into_iter()
            .find(|(_, h)| h.id == id)
            .unwrap()
            .0
    };
    let button = |app: &mut App, id: &str, n: usize| -> Entity {
        let h = header(app, id);
        let c: Vec<Entity> = app.world().get::<Children>(h).unwrap().iter().collect();
        // Fold toggle, spacer, then up, down, hide.
        c[if n == 0 { 0 } else { n + 1 }]
    };
    // Fold the board.
    let e = button(&mut app, "board", 0);
    app.world_mut().trigger(click(e, PointerButton::Primary));
    frames(&mut app, 2);
    let cfg = app.world().resource::<UiConfig>().clone();
    assert!(cfg.sections["company"].collapsed.contains("board"));
    // Move Tech up, hide the cap table.
    let e = button(&mut app, "tech", 1);
    app.world_mut().trigger(click(e, PointerButton::Primary));
    frames(&mut app, 2);
    let e = button(&mut app, "cap_table", 3);
    app.world_mut().trigger(click(e, PointerButton::Primary));
    frames(&mut app, 2);
    let cfg = app.world().resource::<UiConfig>().clone();
    let s = &cfg.sections["company"];
    assert!(s.hidden.contains("cap_table"));
    let order: Vec<_> = game::pages::arrange_sections(SECTIONS, Some(s))
        .into_iter()
        .map(|((id, _), _)| id)
        .collect();
    assert_eq!(
        order,
        ["overview", "chart", "board", "units", "tech", "financials"]
    );
    let b = body(&mut app);
    assert!(
        under::<SectionHeader>(&mut app, b)
            .iter()
            .all(|(_, h)| h.id != "cap_table"),
        "the page rebuilt without it"
    );
    assert!(texts_under(&mut app, b).contains(&"[show Cap table]".to_owned()));
    // The config file keeps it.
    let back = config::from_text(&config::to_text(&cfg)).unwrap();
    assert_eq!(back.sections, cfg.sections);
    // The tab strip: Units only, then All.
    let tab = |app: &mut App, id: Option<&str>| -> Entity {
        let b = body(app);
        under::<TabButton>(app, b)
            .into_iter()
            .find(|(_, t)| t.id == id)
            .unwrap()
            .0
    };
    let e = tab(&mut app, Some("units"));
    app.world_mut().trigger(click(e, PointerButton::Primary));
    frames(&mut app, 2);
    let cfg = app.world().resource::<UiConfig>().clone();
    assert_eq!(
        current_tab(&cfg, PageKind::Company, SECTIONS),
        Some("units")
    );
    let b = body(&mut app);
    let tables = table_ids(&mut app, b);
    assert_eq!(tables, ["company.units"], "only the tab's section is built");
    let e = tab(&mut app, None);
    app.world_mut().trigger(click(e, PointerButton::Primary));
    frames(&mut app, 2);
    let cfg = app.world().resource::<UiConfig>().clone();
    assert!(cfg.sections["company"].collapsed.is_empty());
    let b = body(&mut app);
    let ids = table_ids(&mut app, b);
    assert!(
        ids.contains(&"company.units".to_owned()),
        "every tab again: {ids:?}"
    );
    // Show the hidden cap table from its line under the sections.
    let (e, _) = under::<Text>(&mut app, b)
        .into_iter()
        .find(|(_, t)| t.0 == "[show Cap table]")
        .unwrap();
    let button = app.world().get::<ChildOf>(e).unwrap().parent();
    app.world_mut()
        .trigger(click(button, PointerButton::Primary));
    frames(&mut app, 2);
    let b = body(&mut app);
    let ids = table_ids(&mut app, b);
    assert!(ids.contains(&"company.cap_table".to_owned()), "{ids:?}");
}

/// The alert log names companies and startup events from the views (no demo names, no "#n").
#[test]
fn the_event_log_names_events_and_companies() {
    let mut app = shell_app();
    // Run past the first plan lock at max speed, with no alert pausing it.
    alerts_off(&mut app);
    send(&mut app, Control::SetSpeed(5));
    send(&mut app, Control::Resume);
    for _ in 0..20_000 {
        app.update();
        let clock = app.world().resource::<Views>().clock().now;
        if clock.date() > sim::time::Date::ymd(2020, 1, 9) {
            break;
        }
    }
    let lines = app
        .world()
        .resource::<game::ui::alerts::EventLog>()
        .0
        .clone();
    let events: Vec<_> = lines
        .iter()
        .filter(|l| l.contains("Startup event"))
        .collect();
    assert!(!events.is_empty(), "{lines:?}");
    for l in &events {
        assert!(!l.contains('#'), "{l}");
    }
    let v = (**app.world().resource::<Views>()).clone();
    let e = &v.births.get().events[0];
    assert!(
        lines.iter().any(|l| l.ends_with(&format!(
            "Startup event: {}",
            game::command::index::event_name(e)
        ))),
        "{lines:?}"
    );
    let founded: Vec<_> = lines.iter().filter(|l| l.contains("Founded: ")).collect();
    assert!(!founded.is_empty(), "{lines:?}");
    for l in founded {
        // A company the name index misses would show its page key ("Company company/12").
        assert!(!l.contains("company/"), "{l}");
    }
}
