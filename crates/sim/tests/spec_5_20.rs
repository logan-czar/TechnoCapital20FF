//! Spec 5.20 and 5.20.1 (listings), build-plan M6.9: the IPO tests, the board vote with trait
//! modifiers and its tie rule, the cap of 3 with its overflow order, the listing mechanics
//! (open price, re-split, the 20% float, A = L + E after listing, the index divisor) and
//! tickers. Same seed gives the same votes, member by member.

mod common;

use common::data;
use sim::births::ipo::{
    IpoTestInputs, Voter, VoterRole, apply_cap, draw_first_vote, hold_vote, list_company,
    next_vote_after, passes_ipo_tests, trait_modifier, voters, yes_chance,
};
use sim::births::names::{ticker, ticker_candidates};
use sim::births::startup::{open_price, shares_for};
use sim::finance::balance::{Books, balance_sheet, check_identity};
use sim::finance::distress::CompanyStatus;
use sim::finance::rating::Rating;
use sim::market::index::ExchangeIndex;
use sim::people::board::Seat;
use sim::people::traits::Trait;
use sim::rng::{NoNoise, RngStreams, ScriptedDraws, Stream};
use sim::time::Quarter;
use sim::world::{CompanyId, PhaseLabel};

fn eligible() -> IpoTestInputs {
    IpoTestInputs {
        listed: false,
        status: CompanyStatus::Active,
        quarters_since_birth: None,
        ttm_revenue: 300.0e6,
        ttm_net_income: 10.0e6,
        revenue_growth: 0.0,
        rating: Rating::BMinus,
        label: PhaseLabel::Normal,
    }
}

#[test]
fn ipo_tests_one_condition_at_a_time() {
    assert!(passes_ipo_tests(&eligible()));
    let fails = |f: &dyn Fn(&mut IpoTestInputs)| {
        let mut i = eligible();
        f(&mut i);
        !passes_ipo_tests(&i)
    };
    // 8 quarters since birth (starting companies, None, pass at once).
    assert!(fails(&|i| i.quarters_since_birth = Some(7)));
    assert!(!fails(&|i| i.quarters_since_birth = Some(8)));
    // TTM revenue at least $250M.
    assert!(fails(&|i| i.ttm_revenue = 249.9e6));
    assert!(!fails(&|i| i.ttm_revenue = 250.0e6));
    // Net income above 0, or 4-quarter growth of at least 20%.
    assert!(fails(&|i| i.ttm_net_income = 0.0));
    assert!(!fails(&|i| {
        i.ttm_net_income = -5.0e6;
        i.revenue_growth = 0.20;
    }));
    // Rated B or better (B- counts: rating factor above 0); CCC fails.
    assert!(fails(&|i| i.rating = Rating::Ccc));
    // Not Distressed, not already listed, industry not Bust.
    assert!(fails(&|i| i.status = CompanyStatus::Distressed));
    assert!(fails(&|i| i.listed = true));
    assert!(fails(&|i| i.label = PhaseLabel::Bust));
    assert!(!fails(&|i| i.label = PhaseLabel::Glut));
}

#[test]
fn yes_chance_with_phase_confidence_and_traits() {
    // 15% + phase adj + confidence ÷ 10 + trait modifiers, clamped 5% to 95%.
    let close = |a: f64, b: f64| (a - b).abs() < 1e-12;
    assert!(close(yes_chance(PhaseLabel::Normal, 0.0, &[]), 0.15));
    assert!(close(yes_chance(PhaseLabel::Boom, 0.0, &[]), 0.30));
    assert!(close(yes_chance(PhaseLabel::Glut, 0.0, &[]), 0.05));
    assert!(close(yes_chance(PhaseLabel::Normal, 50.0, &[]), 0.20));
    assert!(close(
        yes_chance(PhaseLabel::Normal, 0.0, &[Trait::Ambitious, Trait::Greedy]),
        0.45
    ));
    assert_eq!(
        yes_chance(PhaseLabel::Normal, -100.0, &[Trait::Paranoid]),
        0.05
    );
    let all_in = [
        Trait::Ambitious,
        Trait::Greedy,
        Trait::Brave,
        Trait::Visionary,
        Trait::Narcissist,
    ];
    assert_eq!(yes_chance(PhaseLabel::Boom, 100.0, &all_in), 0.95);
    // The 5.20.1 table.
    let table = [
        (Trait::Ambitious, 0.15),
        (Trait::Greedy, 0.15),
        (Trait::Brave, 0.10),
        (Trait::Visionary, 0.10),
        (Trait::Narcissist, 0.10),
        (Trait::Paranoid, -0.20),
        (Trait::Cautious, -0.15),
        (Trait::Conservative, -0.10),
        (Trait::Content, -0.10),
        (Trait::Shy, -0.10),
        (Trait::Honest, 0.0),
        (Trait::Diligent, 0.0),
    ];
    for (t, m) in table {
        assert_eq!(trait_modifier(t), m, "{t:?}");
    }
}

#[test]
fn voters_in_seat_order_then_directors_then_controller() {
    let none: &[Trait] = &[];
    let seats = [
        (Seat::Cmo, none, false),
        (Seat::Ceo, none, false),
        (Seat::Cfo, none, false),
    ];
    let dirs = [(none, false)];
    let v = voters(&seats, &dirs, Some(none));
    let roles: Vec<VoterRole> = v.iter().map(|v| v.role).collect();
    assert_eq!(
        roles,
        vec![
            VoterRole::Seat(Seat::Ceo),
            VoterRole::Seat(Seat::Cfo),
            VoterRole::Seat(Seat::Cmo),
            VoterRole::Director(0),
            VoterRole::Controller,
        ]
    );
    assert!(v[4].is_controller);
}

fn board<'a>(n: usize, controller_at: Option<usize>, traits: &'a [Trait]) -> Vec<Voter<'a>> {
    (0..n)
        .map(|i| Voter {
            role: VoterRole::Director(i as u32),
            traits,
            is_controller: controller_at == Some(i),
        })
        .collect()
}

#[test]
fn majority_and_the_tie_rule() {
    // Normal, confidence 0, no traits: each yes chance is 15%. Scripted uniforms decide.
    let vote = |us: &[f64], ctl: Option<usize>| {
        let mut s = ScriptedDraws::new();
        s.push(Stream::Gen, us.iter().copied());
        hold_vote(&board(us.len(), ctl, &[]), PhaseLabel::Normal, 0.0, &mut s)
    };
    // 3 yes of 5 pass.
    let r = vote(&[0.1, 0.1, 0.1, 0.9, 0.9], None);
    assert_eq!((r.yes, r.no, r.passed), (3, 2, true));
    // 2 to 3 fails.
    assert!(!vote(&[0.1, 0.1, 0.9, 0.9, 0.9], Some(0)).passed);
    // A 2 to 2 tie goes the controller's way...
    assert!(vote(&[0.1, 0.1, 0.9, 0.9], Some(0)).passed);
    assert!(!vote(&[0.1, 0.1, 0.9, 0.9], Some(3)).passed);
    // ...and fails with no voting controller.
    assert!(!vote(&[0.1, 0.1, 0.9, 0.9], None).passed);
}

#[test]
fn same_seed_same_votes_member_by_member() {
    let t = [Trait::Ambitious];
    let b = board(7, Some(0), &t);
    let a = hold_vote(&b, PhaseLabel::Boom, 20.0, &mut RngStreams::new(42));
    let c = hold_vote(&b, PhaseLabel::Boom, 20.0, &mut RngStreams::new(42));
    assert_eq!(a, c);
    assert_eq!(a.ballots.len(), 7);
    // Each member's chance is 15 + 15 + 2 + 15 = 47%.
    assert!(a.ballots.iter().all(|b| (b.chance - 0.47).abs() < 1e-12));
    // The votes draw from the gen stream only (5.20.1 step 3).
    let mut r = RngStreams::new(42);
    hold_vote(&b, PhaseLabel::Boom, 20.0, &mut r);
    let mut fresh = RngStreams::new(42);
    for s in [Stream::Cycle, Stream::Growth, Stream::Prices, Stream::Ai] {
        assert_eq!(
            sim::DrawSource::next_u64(&mut r, s),
            sim::DrawSource::next_u64(&mut fresh, s)
        );
    }
}

#[test]
fn cap_of_three_by_ttm_revenue_then_lower_id() {
    let passed = [
        (CompanyId(9), 400.0e6),
        (CompanyId(2), 900.0e6),
        (CompanyId(7), 500.0e6),
        (CompanyId(4), 500.0e6),
        (CompanyId(1), 300.0e6),
    ];
    let (listing, capped) = apply_cap(&passed);
    assert_eq!(listing, vec![CompanyId(2), CompanyId(4), CompanyId(7)]);
    assert_eq!(capped, vec![CompanyId(9), CompanyId(1)]);
    // The capped and the failed come back at the lock 4 quarters later.
    assert_eq!(
        next_vote_after(Quarter { year: 2021, q: 3 }),
        Quarter { year: 2022, q: 3 }
    );
    // A starting private company's first vote: one of the four 2020 locks (NoNoise: Q2).
    assert_eq!(draw_first_vote(&mut NoNoise), Quarter { year: 2020, q: 2 });
    let mut r = RngStreams::new(1);
    for _ in 0..100 {
        let q = draw_first_vote(&mut r);
        assert!(q.year == 2020 && (1..=4).contains(&q.q));
    }
}

#[test]
fn listing_mechanics_and_a_equals_l_plus_e() {
    // Pre-money $500M: the 7.1 open price, existing shares re-split to value ÷ price, 20% new
    // shares at price × 0.92, less 3% fees.
    let l = list_company(500.0e6, "CO-0700");
    let p = open_price(500.0e6, "CO-0700");
    assert_eq!(l.open_price, p);
    assert_eq!(l.resplit_shares, shares_for(500.0e6, p));
    assert_eq!(l.new_shares, (0.2 * l.resplit_shares as f64).round() as u64);
    assert!((l.gross - l.new_shares as f64 * p * 0.92).abs() < 1e-6);
    assert!((l.net - 0.97 * l.gross).abs() < 1e-6);
    assert_eq!(l.shares_out, l.resplit_shares + l.new_shares);
    // A holder of 60% before keeps 60% of the re-split, 50% after the 20% issue.
    let old = 1_000_000;
    let h = l.resplit_holding(600_000, old);
    assert!((h as f64 / l.resplit_shares as f64 - 0.6).abs() < 1e-6);
    assert!((h as f64 / l.shares_out as f64 - 0.5).abs() < 1e-5);

    // A = L + E after listing: cash rises by the net, equity by the same.
    let before = Books {
        cash: 50.0e6,
        asset_book: 300.0e6,
        line_drawn: 100.0e6,
        ..Books::default()
    };
    let after = Books {
        cash: before.cash + l.net,
        ..before
    };
    let (s0, s1) = (
        balance_sheet(&before, CompanyStatus::Active),
        balance_sheet(&after, CompanyStatus::Active),
    );
    check_identity(&s1, CompanyStatus::Active).unwrap();
    assert!((s1.total_assets - s1.total_liabilities - s1.equity).abs() < 1e-6);
    assert!((s1.equity - s0.equity - l.net).abs() < 1e-6);

    // The exchange index does not jump when it joins: the divisor takes the new cap.
    let mut idx = ExchangeIndex::at_load(2.0e9);
    let level = idx.level(2.2e9).unwrap();
    idx.reweight(2.2e9, 2.2e9 + l.market_cap());
    assert!((idx.level(2.2e9 + l.market_cap()).unwrap() - level).abs() < 1e-9);
}

#[test]
fn tickers_follow_world_gen_and_never_repeat() {
    // world-gen gen.py: initials, 2 + 2, 3 + 1, first 4 letters, first 3; 3 or 4 letters.
    assert_eq!(
        ticker_candidates("Arrowhead Drilling"),
        vec!["ARDR", "ARRD", "ARRO", "ARR"]
    );
    assert_eq!(ticker("Arrowhead Drilling", &|_| false), "ARDR");
    // Replaying the scheme over companies.csv's public companies, in file order.
    let d = data();
    let mut used: Vec<String> = Vec::new();
    let (mut same, mut all) = (0, 0);
    for c in d.companies.rows.iter().filter(|c| c.public) {
        let t = ticker(&c.name, &|x| used.iter().any(|u| u == x));
        all += 1;
        same += usize::from(t == c.ticker);
        used.push(c.ticker.clone());
    }
    println!("{same} of {all} companies.csv tickers follow the scheme");
    assert_eq!(same, all);
    // With every candidate taken, the fixed fallback: the first letter, then AAA up.
    let t = ticker("Arrowhead Drilling", &|x| {
        x.len() == 3 || x.starts_with("AR")
    });
    assert_eq!(t, "AAAA");
    let t = ticker("Zed Co", &|x| x != "ZAAB");
    assert_eq!(t, "ZAAB");
}
