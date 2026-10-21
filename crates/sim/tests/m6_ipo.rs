//! Build-plan M6.9 on the live engine: IPO tests, board votes, the cap of 3 and the listing
//! (spec 5.20, 5.20.1). Done lines: the same seed gives the same votes, member by member;
//! A = L + E after the listing.
//!
//! Expected values from the spec: each member's yes chance `15% + phase adj + confidence ÷ 10 +
//! trait modifiers`, clamped 5% to 95% (the 5.20.1 table), voters in seat order then
//! directors then an unseated named or state controller; a majority passes, a tie goes the
//! controller's way; at most 3 listings a quarter; the listing re-splits to `pre-money ÷
//! open_price` and sells 20% new shares at `open_price × 0.92` less 3% fees; the index level
//! does not jump.

mod common;

use std::sync::Mutex;

use common::data;
use sim::Sim;
use sim::births::ipo::VoterRole;
use sim::people::traits::Trait;
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::{CompanyId, Holder, Notice, Ordinal, PhaseLabel, SeatHolder, World};

/// Spec 5.20.1 trait modifiers (T), in points.
fn modifier(t: Trait) -> f64 {
    match t {
        Trait::Ambitious | Trait::Greedy => 15.0,
        Trait::Brave | Trait::Visionary | Trait::Narcissist => 10.0,
        Trait::Paranoid => -20.0,
        Trait::Cautious => -15.0,
        Trait::Conservative | Trait::Content | Trait::Shy => -10.0,
        _ => 0.0,
    }
}

/// Spec 5.20.1 step 3.
fn spec_chance(label: PhaseLabel, confidence: f64, traits: &[Trait]) -> f64 {
    let phase = match label {
        PhaseLabel::Boom => 15.0,
        PhaseLabel::Glut => -10.0,
        _ => 0.0,
    };
    let mods: f64 = traits.iter().map(|&t| modifier(t)).sum();
    ((15.0 + phase + confidence / 10.0 + mods) / 100.0).clamp(0.05, 0.95)
}

/// The state the IPO step reads, kept per lock: labels, zone confidences, index levels, each
/// company's cash and shares (a test job after the random startup events).
#[derive(Clone)]
struct Before {
    date: Date,
    labels: Vec<PhaseLabel>,
    confidence: Vec<f64>,
    levels: Vec<Option<f64>>,
    cash: Vec<f64>,
    /// Each company's voters with their traits, as the board stood.
    voters: Vec<Vec<(VoterRole, Vec<Trait>)>>,
}

/// After the IPO step: index levels and cash.
type After = (Vec<Option<f64>>, Vec<f64>);

static BEFORE: Mutex<Vec<Before>> = Mutex::new(Vec::new());
static AFTER: Mutex<Vec<After>> = Mutex::new(Vec::new());

fn levels(w: &World) -> Vec<Option<f64>> {
    w.zones
        .ids()
        .map(|z| sim::market::jobs::index_level(w, z))
        .collect()
}

fn before_ipo(w: &mut World, ctx: &mut JobCtx<'_>) {
    BEFORE.lock().unwrap().push(Before {
        date: ctx.facts.date,
        labels: w.industries.rows().iter().map(|i| i.phase_label).collect(),
        confidence: w.zones.rows().iter().map(|z| z.confidence).collect(),
        levels: levels(w),
        cash: w.companies.rows().iter().map(|c| c.cash_usd).collect(),
        voters: w
            .companies
            .ids()
            .map(|id| {
                voter_traits(w, id)
                    .into_iter()
                    .map(|(r, t)| (r, t.to_vec()))
                    .collect()
            })
            .collect(),
    });
}

fn after_ipo(w: &mut World, _: &mut JobCtx<'_>) {
    let cash = w.companies.rows().iter().map(|c| c.cash_usd).collect();
    AFTER.lock().unwrap().push((levels(w), cash));
}

fn run(seed: u64, end: Date, probe: bool) -> (Sim, Vec<Notice>) {
    let mut sim = Sim::new(data(), seed).unwrap();
    if probe {
        sim.register_test_job(Slot::LockRandomStartupEvents, "test.before_ipo", before_ipo);
        sim.register_test_job(Slot::LockIpoVotes, "test.after_ipo", after_ipo);
    }
    let mut seen = Vec::new();
    let end = DateTime::midnight(end);
    while sim.now() < end {
        for n in sim.step() {
            if matches!(n, Notice::IpoVote { .. } | Notice::CompanyListed(_)) {
                seen.push(n);
            }
        }
    }
    (sim, seen)
}

/// The traits of each voter, in the 5.20.1 roll order.
fn voter_traits(w: &World, id: CompanyId) -> Vec<(VoterRole, &[Trait])> {
    let c = &w.companies[id];
    let mut out = Vec::new();
    let mut seated = false;
    for (i, h) in c.board.iter().enumerate() {
        match h {
            Some(SeatHolder::Simple(s)) => out.push((
                VoterRole::Seat(sim::people::board::Seat::LABOR[i]),
                &s.character.traits[..],
            )),
            Some(SeatHolder::Full(ch)) => {
                seated |= Some(*ch) == c.controller;
                out.push((
                    VoterRole::Seat(sim::people::board::Seat::LABOR[i]),
                    &w.characters[*ch].traits[..],
                ));
            }
            None => {}
        }
    }
    for (i, d) in c.directors.iter().enumerate() {
        let t = match d {
            sim::world::Director::Simple(s) => &s.character.traits[..],
            sim::world::Director::Full(ch) => {
                seated |= Some(*ch) == c.controller;
                &w.characters[*ch].traits[..]
            }
        };
        out.push((VoterRole::Director(i as u32), t));
    }
    if !seated {
        if c.state_controlled {
            out.push((VoterRole::Controller, &[][..]));
        } else if let Some(ch) = c.controller {
            out.push((VoterRole::Controller, &w.characters[ch].traits[..]));
        }
    }
    out
}

#[test]
fn ipo_votes_and_listings_follow_5_20() {
    // Past the Q1 2021 close, so a listing at the 9 January 2021 lock has its quarter's
    // statements (the shares-issued check below).
    let end = Date::ymd(2021, 4, 2);
    let (sim, seen) = run(31, end, true);
    let w = sim.world();
    let before = BEFORE.lock().unwrap().clone();
    let after = AFTER.lock().unwrap().clone();
    assert_eq!(before.len(), after.len());

    // Each vote (5.20.1 steps 2 to 5): the voters and their chances, the majority and the tie.
    let mut votes = 0;
    for (id, c) in w.companies.iter() {
        let Some(v) = &c.ipo_last_vote else { continue };
        votes += 1;
        let b = before.iter().find(|b| b.date == v.date).unwrap();
        let label = b.labels[c.industry.index()];
        let zone = w.countries[c.hq_country].zone;
        let conf = b.confidence[zone.index()];
        let voters = &b.voters[id.index()];
        assert_eq!(v.result.ballots.len(), voters.len(), "{}", c.key);
        for (ballot, (role, traits)) in v.result.ballots.iter().zip(voters) {
            assert_eq!(ballot.role, *role);
            assert!((ballot.chance - spec_chance(label, conf, traits)).abs() < 1e-12);
        }
        let yes = v.result.ballots.iter().filter(|b| b.yes).count() as u32;
        assert_eq!(
            (v.result.yes, v.result.no),
            (yes, voters.len() as u32 - yes)
        );
        if 2 * yes != voters.len() as u32 {
            assert_eq!(v.result.passed, 2 * yes > voters.len() as u32);
        }
    }
    assert!(
        votes > 20,
        "{votes} companies voted (68 starting private ones are big enough)"
    );

    // The cap (5.20.1 step 6) and the listings.
    let mut listed = Vec::new();
    for b in &before {
        let at: Vec<CompanyId> = w
            .companies
            .iter()
            .filter(|(id, _)| w.market.stocks[*id].listed_on == Some(b.date))
            .map(|(id, _)| id)
            .collect();
        assert!(at.len() <= 3, "{}: {} listings", b.date, at.len());
        for id in at {
            listed.push((b.clone(), id));
        }
    }
    assert!(!listed.is_empty(), "some company lists in 2020");
    let listed_notices = seen
        .iter()
        .filter(|n| matches!(n, Notice::CompanyListed(_)))
        .count();
    assert_eq!(listed_notices, listed.len());
    for (b, id) in &listed {
        let c = &w.companies[*id];
        let s = &w.market.stocks[*id];
        let k = before.iter().position(|x| x.date == b.date).unwrap();
        // The index level does not move (D250).
        let zone = w.countries[c.hq_country].zone;
        let (l0, l1) = (b.levels[zone.index()], after[k].0[zone.index()]);
        if let (Some(a), Some(z)) = (l0, l1) {
            assert!((a - z).abs() <= 1e-9 * a, "{}: index {a} to {z}", c.key);
        }
        // Listing steps 2 and 3: the float is 20% of the re-split shares (halves to even), sold
        // at open_price × 0.92 less 3% fees.
        let p = s.ipo_price;
        assert!((5.0..=200.0).contains(&p));
        let float = c
            .holders
            .iter()
            .find(|h| h.holder == Holder::PublicFloat)
            .unwrap()
            .shares;
        let resplit = c.shares_out - float;
        assert_eq!(
            float,
            (0.2 * resplit as f64).round_ties_even() as u64,
            "{}",
            c.key
        );
        let net = float as f64 * p * 0.92 * 0.97;
        let raised = after[k].1[id.index()] - b.cash[id.index()];
        assert!(
            (raised - net).abs() <= 1e-6 * net,
            "{}: cash rose {raised}, net {net}",
            c.key
        );
        let total: u64 = c.holders.iter().map(|h| h.shares).sum();
        assert_eq!(total, c.shares_out, "{}: the cap table sums", c.key);
        assert!(c.public && s.quoted);
        assert!((3..=4).contains(&c.ticker.len()));
        assert!(
            w.companies
                .iter()
                .filter(|(_, o)| o.ticker == c.ticker)
                .count()
                == 1
        );
        // A = L + E (build-plan M6.9): the month of the listing posts the shares issued, net of
        // fees, and every month balances.
        let issued: f64 = c
            .finance
            .quarters()
            .iter()
            .map(|q| q.lines.shares_issued_net)
            .sum();
        assert!(
            (issued - net).abs() < 1e-3,
            "{}: shares issued {issued} vs {net}",
            c.key
        );
    }
    assert_eq!(
        w.books_check.failures, 0,
        "{:?}",
        w.books_check.first_failure
    );
}

#[test]
fn the_same_seed_gives_the_same_votes_member_by_member() {
    let end = Date::ymd(2020, 10, 10);
    let (a, seen_a) = run(32, end, false);
    let (b, seen_b) = run(32, end, false);
    assert_eq!(seen_a, seen_b);
    let (wa, wb) = (a.world(), b.world());
    let mut votes = 0;
    for (id, c) in wa.companies.iter() {
        assert_eq!(c.ipo_last_vote, wb.companies[id].ipo_last_vote, "{}", c.key);
        votes += usize::from(c.ipo_last_vote.is_some());
    }
    assert!(votes > 10);
    assert_eq!(a.state_hash(), b.state_hash());
}
