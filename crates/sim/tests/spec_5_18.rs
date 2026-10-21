//! Spec 5.18 (Pdoomberg Wire headlines) and 8 (News feed, Quarterly recap), build-plan M6.5:
//! one test per headline type, the release picks, the daily post, the tipped lab, and the
//! recap's world and company pages. Texts are checked against 5.18's wording where it gives
//! one.

use sim::ai::raise::RaiseMethod;
use sim::finance::rating::Rating;
use sim::market::confidence::ConfidenceHeadline;
use sim::news::{
    self, BYLINE, HeadlineKind, NewsWire, draw_tipped_lab, tipped_lab_candidates, top_results,
};
use sim::recap::{ExpectedResult, Outlook, RatingWatch, company_recap, rating_watch, world_recap};
use sim::rng::{NoNoise, RngStreams};
use sim::time::{Date, Quarter};
use sim::world::{CompanyId, CyclePhase, IndustryId, PhaseLabel};

const D: Date = Date {
    year: 2021,
    month: 4,
    day: 9,
};
const IND: IndustryId = IndustryId(3);
const CO: CompanyId = CompanyId(42);

#[test]
fn every_headline_has_the_pdoomberg_wire_byline() {
    let h = news::bankruptcy(D, IND, CO, "Acme");
    assert_eq!(h.byline(), "Pdoomberg Wire");
    assert_eq!(BYLINE, "Pdoomberg Wire");
    assert_eq!((h.date, h.industry, h.company), (D, Some(IND), Some(CO)));
}

#[test]
fn phase_change() {
    let h = news::phase_change(D, IND, "Retail", PhaseLabel::Normal, PhaseLabel::Bust);
    assert_eq!(h.text, "Retail moves from Normal to Bust");
    assert_eq!(h.company, None);
    assert!(matches!(h.kind, HeadlineKind::PhaseChange { .. }));
}

#[test]
fn results_beats_and_misses() {
    let h = news::result(D, IND, CO, "Acme", 0.12).unwrap();
    assert_eq!(h.text, "Acme beats consensus by 12%");
    assert_eq!(h.confidence(), Some(ConfidenceHeadline::Beat));
    let h = news::result(D, IND, CO, "Acme", 0.35).unwrap();
    assert_eq!(h.text, "Acme posts a big beat, 35% over consensus");
    assert_eq!(h.confidence(), Some(ConfidenceHeadline::BigBeat));
    let h = news::result(D, IND, CO, "Acme", -0.08).unwrap();
    assert_eq!(h.text, "Acme misses consensus by 8%");
    let h = news::result(D, IND, CO, "Acme", -0.5).unwrap();
    assert_eq!(h.text, "Acme posts a big miss, 50% under consensus");
    assert_eq!(h.confidence(), Some(ConfidenceHeadline::BigMiss));
    // Inside ±5% there is no story.
    assert_eq!(news::result(D, IND, CO, "Acme", 0.05), None);
}

#[test]
fn release_posts_the_five_largest_beats_and_misses() {
    let r: Vec<(CompanyId, f64)> = [
        0.30, 0.06, 0.5, 0.1, 0.1, 0.2, 0.04, -0.06, -0.3, -0.2, -0.04,
    ]
    .iter()
    .enumerate()
    .map(|(i, s)| (CompanyId(i as u32), *s))
    .collect();
    let (beats, misses) = top_results(&r);
    let ids = |v: &[(CompanyId, f64)]| v.iter().map(|(c, _)| c.0).collect::<Vec<_>>();
    // 0.5, 0.30, 0.2, then the 0.1 tie to the lower id (3 before 4).
    assert_eq!(ids(&beats), vec![2, 0, 5, 3, 4]);
    // Worst first; −4% is not a miss.
    assert_eq!(ids(&misses), vec![8, 9, 7]);
}

#[test]
fn bankruptcy_and_removal() {
    let b = news::bankruptcy(D, IND, CO, "Acme");
    assert_eq!(b.text, "Acme goes bankrupt; shareholders wiped out");
    assert_eq!(b.confidence(), Some(ConfidenceHeadline::Bankruptcy));
    let r = news::removal(D, IND, CO, "Acme");
    assert_eq!(r.text, "Acme is wound up and removed after its bankruptcy");
    assert_eq!(r.confidence(), None);
}

#[test]
fn rating_changes_of_two_notches_or_more() {
    assert_eq!(
        news::rating_change(D, IND, CO, "Acme", Rating::Bbb, Rating::BbbMinus),
        None
    );
    let h = news::rating_change(D, IND, CO, "Acme", Rating::Bbb, Rating::BbMinus).unwrap();
    assert_eq!(h.text, "Acme downgraded 4 notches to BB-, from BBB");
    assert_eq!(
        h.confidence(),
        Some(ConfidenceHeadline::RatingChange { notches: -4 })
    );
    let h = news::rating_change(D, IND, CO, "Acme", Rating::A, Rating::AaMinus).unwrap();
    assert_eq!(h.text, "Acme upgraded 2 notches to AA-, from A");
}

#[test]
fn raises_and_failed_raises() {
    let h = news::raise(D, IND, CO, "Acme", RaiseMethod::ShareIssue, Some(58.2e6));
    assert_eq!(h.text, "Acme raises $58.2M in a share issue");
    let h = news::raise(D, IND, CO, "Acme", RaiseMethod::CreditLine, Some(60.0e6));
    assert_eq!(h.text, "Acme raises $60.0M on its credit line");
    // A company that does not publish: no amount on the wire (D420).
    let h = news::raise(D, IND, CO, "Acme", RaiseMethod::CreditLine, None);
    assert_eq!(h.text, "Acme raises money on its credit line");
    let h = news::failed_raise(D, IND, CO, "Acme", RaiseMethod::ShareIssue);
    assert_eq!(h.text, "Acme fails to sell new shares");
}

#[test]
fn startup_events() {
    // F4 has its own line (5.18).
    let h = news::chatbot_rush(D, "F4", IND, "Lattice Labs", 5);
    assert_eq!(
        h.text,
        "Lattice Labs's chatbot sets off a startup rush: 5 new AI labs"
    );
    let h = news::fixed_event(D, "F2", "The crypto and SPAC mania", 3);
    assert_eq!(h.text, "The crypto and SPAC mania: 3 new startups");
    // Random: "[Name] launches in [industry] in [city or province]".
    let h = news::startup_launch(D, IND, CO, "Ironbark Software", "Software", "Toronto");
    assert_eq!(h.text, "Ironbark Software launches in Software in Toronto");
    // Hot cluster: "[n] startups launch in [industry] in [city]".
    let h = news::hot_cluster(D, IND, "Drones", "Shenzhen", 3);
    assert_eq!(h.text, "3 startups launch in Drones in Shenzhen");
}

#[test]
fn ipo_votes_and_listings() {
    let h = news::ipo_vote(D, IND, CO, "Acme", "ATX", true, (4, 2));
    assert_eq!(h.text, "Acme board votes to list on ATX, 4 to 2");
    let h = news::ipo_vote(D, IND, CO, "Acme", "ATX", false, (1, 4));
    assert_eq!(h.text, "Acme board votes against listing, 4 to 1");
    let h = news::listing(D, IND, CO, "Acme", "ATX", 24.0, 105.3e6);
    assert_eq!(h.text, "Acme lists on ATX at $24, raising $105.3M");
}

#[test]
fn chatbot_and_the_tipped_lab() {
    let h = news::chatbot(D, IND, Some(CO), "Lattice Labs");
    assert_eq!(h.text, "Lattice Labs launches its chatbot");
    // The five largest AI labs by starting revenue, ties to the lower id (D281).
    let labs = [
        (CompanyId(10), 300.0),
        (CompanyId(11), 900.0),
        (CompanyId(12), 50.0),
        (CompanyId(13), 300.0),
        (CompanyId(14), 400.0),
        (CompanyId(15), 700.0),
    ];
    let c = tipped_lab_candidates(&labs);
    assert_eq!(
        c,
        vec![
            CompanyId(11),
            CompanyId(15),
            CompanyId(14),
            CompanyId(10),
            CompanyId(13)
        ]
    );
    assert_eq!(draw_tipped_lab(&c, &mut NoNoise), Some(CompanyId(14)));
    let a = draw_tipped_lab(&c, &mut RngStreams::new(8));
    assert_eq!(a, draw_tipped_lab(&c, &mut RngStreams::new(8)));
    assert_eq!(draw_tipped_lab(&[], &mut NoNoise), None);
}

#[test]
fn the_wire_posts_the_days_queue() {
    let mut w = NewsWire::default();
    let later = Date::ymd(2021, 4, 10);
    w.queue(news::bankruptcy(D, IND, CO, "A"));
    w.queue(news::removal(later, IND, CO, "B"));
    w.queue(news::bankruptcy(D, IND, CompanyId(7), "C"));
    let posted = w.post_day(D);
    let texts: Vec<&str> = posted.iter().map(|h| h.text.as_str()).collect();
    assert_eq!(
        texts,
        vec![
            "A goes bankrupt; shareholders wiped out",
            "C goes bankrupt; shareholders wiped out"
        ]
    );
    assert_eq!(w.queued.len(), 1);
    assert_eq!(w.post_day(later).len(), 1);
    assert_eq!(w.since(later).count(), 1);
    assert_eq!(w.feed.len(), 3);
}

#[test]
fn recap_world_page() {
    let q = Quarter { year: 2021, q: 2 };
    let ind = [
        (IndustryId(2), PhaseLabel::Bust),
        (IndustryId(0), PhaseLabel::Normal),
        (IndustryId(1), PhaseLabel::Boom),
        (IndustryId(3), PhaseLabel::Normal),
    ];
    let ex: Vec<ExpectedResult> = [
        (110.0, 100.0),
        (80.0, 100.0),
        (100.0, 100.0),
        (130.0, 100.0),
    ]
    .iter()
    .enumerate()
    .map(|(i, (p, c))| ExpectedResult::new(CompanyId(i as u32), *p, *c))
    .collect();
    let r = world_recap(q, CyclePhase::Expansion, 0.01, &ind, &ex);
    assert_eq!(
        r.industries_by_label,
        vec![
            (PhaseLabel::Boom, vec![IndustryId(1)]),
            (PhaseLabel::Normal, vec![IndustryId(0), IndustryId(3)]),
            (PhaseLabel::Glut, vec![]),
            (PhaseLabel::Bust, vec![IndustryId(2)]),
        ]
    );
    // Expected beats by projection against consensus: +30%, then +10%; the miss −20%.
    let beats: Vec<u32> = r.expected_beats.iter().map(|e| e.company.0).collect();
    assert_eq!(beats, vec![3, 0]);
    assert_eq!(r.expected_misses.len(), 1);
    assert!((r.expected_misses[0].expected_surprise + 0.2).abs() < 1e-12);
}

#[test]
fn recap_company_page() {
    // At the recap (about 0.92 of the quarter elapsed) the observer's 5.16 range is
    // 0.30 × (1 − 0.6 × 0.92) × (1 − 24 ÷ 50) × 0.7 × 2 = 9.8% around the consensus.
    let e = ExpectedResult::new(CO, 12.0e6, 10.0e6);
    let outlook = Outlook {
        label: PhaseLabel::Normal,
        loss_quarters: 0,
        rating: Rating::Bbb,
        rating_watch: rating_watch(Rating::Bbb, Rating::A),
    };
    let r = company_recap(
        Quarter { year: 2021, q: 2 },
        e,
        0.92,
        1.04,
        Some(5.0),
        outlook,
    );
    let w = 0.30 * (1.0 - 0.6 * 0.92) * (1.0 - 24.0 / 50.0) * 0.7 * 2.0;
    assert!((r.range.0 - 10.0e6 * (1.0 - w)).abs() < 1e-3);
    assert!((r.range.1 - 10.0e6 * (1.0 + w)).abs() < 1e-3);
    // Expected s = +20%: reaction 1.5 × clamp(0.5 × 0.2, ±25%) = +15%.
    assert!((r.expected.expected_surprise - 0.2).abs() < 1e-12);
    assert!((r.expected_reaction - 0.15).abs() < 1e-12);
    assert_eq!(r.outlook.rating_watch, Some(RatingWatch::Upgrade));
    assert_eq!(
        rating_watch(Rating::A, Rating::Bbb),
        Some(RatingWatch::Downgrade)
    );
    assert_eq!(rating_watch(Rating::A, Rating::A), None);
}
