//! M3.3 and M3.7 against the live engine: the management score each month from the seated board
//! (spec 5.7) and productivity at 4.3 step 10 (5.6). Expected values are worked from the spec
//! formulas written out here, never from the engine's functions.
//!
//! Spec M3.7 done: score 50 gives −6 a year at the norm, +4 at double, −16 with none. The three
//! barebones companies (one labor unit, no idle, no research, no held data) are given a board
//! that scores exactly 50 and R&D plans of 2×, 1× and 0× the norm, and run a year.

mod common;

use common::data;
use common::ops::{company, run_to};
use sim::Sim;
use sim::ops::stations::Stations;
use sim::people::board::{Seat, SkillKind, Skills};
use sim::people::simple::{CompanySize, SimpleCharacter};
use sim::people::traits::Trait;
use sim::time::{Date, JobCtx, Slot};
use sim::world::{Company, SeatHolder, SimpleSeat, World};

/// Spec 5.7 weights: CEO 30%, COO 20%, CFO 20%, CIO 10%, Chair 10%, other seats (CMO) 10%.
fn spec_weight(seat: Seat) -> f64 {
    match seat {
        Seat::Ceo => 0.3,
        Seat::Coo | Seat::Cfo => 0.2,
        Seat::Cio | Seat::Chair | Seat::Cmo => 0.1,
    }
}

/// Spec 3.7: the seat's skill (the CEO averages Finance, Operations and Persuasion).
fn spec_seat_skill(s: &Skills, seat: Seat) -> f64 {
    let f = |k| f64::from(s.get(k));
    match seat {
        Seat::Ceo => {
            (f(SkillKind::Finance) + f(SkillKind::Operations) + f(SkillKind::Persuasion)) / 3.0
        }
        Seat::Cfo => f(SkillKind::Finance),
        Seat::Cio => f(SkillKind::Intrigue),
        Seat::Cmo | Seat::Chair => f(SkillKind::Persuasion),
        Seat::Coo => f(SkillKind::Operations),
    }
}

/// Spec 3.7.1 management shifts: Diligent +2, Lazy −2, Ambitious +1, Greedy −1 as CFO (D206).
fn spec_shift(t: Trait, seat: Seat) -> f64 {
    match t {
        Trait::Diligent => 2.0,
        Trait::Lazy => -2.0,
        Trait::Ambitious => 1.0,
        Trait::Greedy if seat == Seat::Cfo => -1.0,
        _ => 0.0,
    }
}

/// Spec 5.7: `min(100, Σ weight × skill ÷ 20 × 100)`, empty seats (and the Chair) at skill 3.
fn spec_score(w: &World, c: &Company) -> f64 {
    let mut sum = spec_weight(Seat::Chair) * 3.0;
    for (i, &seat) in Seat::LABOR.iter().enumerate() {
        let skill = match &c.board[i] {
            None => 3.0,
            Some(h) => {
                let (skills, traits) = match h {
                    SeatHolder::Simple(s) => (&s.character.skills, &s.character.traits[..]),
                    SeatHolder::Full(id) => {
                        (&w.characters[*id].skills, &w.characters[*id].traits[..])
                    }
                };
                let shift: f64 = traits.iter().map(|&t| spec_shift(t, seat)).sum();
                (spec_seat_skill(skills, seat) + shift).clamp(0.0, 30.0)
            }
        };
        sum += spec_weight(seat) * skill;
    }
    (sum / 20.0 * 100.0).min(100.0)
}

/// Spec 5.6, written out: research ×1.00 at 0 units, ×1.01 at 1 to 9, ×1.02 at 10 to 99, ...;
/// decay 0.5, 0.4 with 10%+ idle, 0.3 with 25%+.
fn spec_delta(rd_total: f64, rd_norm: f64, score: f64, s: &Stations) -> f64 {
    let digits = if s.research == 0 {
        0
    } else {
        s.research.to_string().len()
    };
    let research_mult = 1.0 + 0.01 * digits as f64;
    let l = s.total() as f64;
    let idle = s.idle as f64 / l;
    let decay = if idle >= 0.25 {
        0.3
    } else if idle >= 0.10 {
        0.4
    } else {
        0.5
    };
    10.0 * (rd_total / rd_norm - 1.0) * (0.5 + score / 100.0) * research_mult / 12.0 - decay
}

fn spec_size(revenue_usd: f64) -> CompanySize {
    if revenue_usd >= 10.0e9 {
        CompanySize::Large
    } else if revenue_usd >= 100.0e6 {
        CompanySize::Mid
    } else {
        CompanySize::Small
    }
}

#[test]
fn management_scores_at_load_by_size() {
    let sim = Sim::new(data(), 21).unwrap();
    let w = sim.world();
    let mut sums = [(0.0, 0u32); 3];
    for (_, c) in w.companies.iter() {
        let want = spec_score(w, c);
        assert!((c.management_score - want).abs() < 1e-9, "{}", c.key);
        // Only full boards count toward the spec's size means (every labor seat filled).
        if c.labor_units >= 5 {
            let i = spec_size(c.revenue_usd) as usize;
            sums[i].0 += c.management_score;
            sums[i].1 += 1;
        }
    }
    let means: Vec<f64> = sums.iter().map(|(s, n)| s / f64::from(*n)).collect();
    println!(
        "management score at load, full boards: small {:.1}, mid {:.1}, large {:.1} \
         (spec 3.7.1 about 33, 47, 60; D206)",
        means[0], means[1], means[2]
    );
    for (got, spec) in means.iter().zip([33.0, 47.0, 60.0]) {
        assert!((got - spec).abs() < 2.5, "{got} vs about {spec}");
    }
}

/// A CEO whose seat skill is 79 ÷ 3 with no shifting trait: with the four other labor seats
/// closed and the Chair empty (skill 3) the board scores (0.3 × 79/3 + 0.7 × 3) ÷ 20 × 100 = 50.
fn score_fifty_ceo() -> SeatHolder {
    SeatHolder::Simple(SimpleSeat {
        id: u32::MAX,
        character: SimpleCharacter {
            name: "Test Fifty".into(),
            age: 40,
            skills: Skills {
                finance: 27,
                operations: 26,
                persuasion: 26,
                intrigue: 3,
                tech: 3,
                hustle: 3,
            },
            traits: vec![Trait::Brave],
            seat: Seat::Ceo,
            size: CompanySize::Small,
        },
    })
}

/// Barebones companies and their R&D plan as a multiple of the norm.
const BAREBONES_PLANS: [(&str, f64); 3] = [("CO-0003", 2.0), ("CO-0026", 1.0), ("CO-0027", 0.0)];

/// Stands in for the M6 plan each month (4.3 step 3): the score-50 CEO and the R&D plans.
fn plans_and_board(w: &mut World, _: &mut JobCtx<'_>) {
    for (key, mult) in BAREBONES_PLANS {
        let id = company(w, key);
        w.companies[id].board[0] = Some(score_fifty_ceo());
        let unit = w.companies[id].units[0];
        let norm = w.industries[w.units[unit].industry].params.rd_norm;
        w.units[unit].rd_plan = mult * norm;
        // Keep the test companies solvent, so the M4 books (5.12 distress) never freeze them
        // before the year is out: CO-0026 and CO-0027 start with $0 cash and no line, so the
        // barebones loadout is in forced sales from the first month (design fix 226).
        let c = &mut w.companies[id];
        c.cash_usd = SOLVENT_CASH_USD;
        c.finance.line.drawn = 0.0;
    }
}

/// Cash the test companies hold each month (far above any year of their costs).
const SOLVENT_CASH_USD: f64 = 1.0e9;

#[test]
fn score_fifty_a_year_at_the_norm_double_and_none() {
    let mut sim = Sim::new(data(), 4).unwrap();
    sim.register_test_job(Slot::MonthlyFringe, "test.plans", plans_and_board);
    // Twelve monthly jobs: 1 Feb 2020 to 1 Jan 2021.
    run_to(&mut sim, Date::ymd(2021, 1, 1));
    let w = sim.world();
    // Spec 5.6 check (score 50): +4 a year at double the norm, −6 at the norm, −16 with none.
    for ((key, _), want) in BAREBONES_PLANS.iter().zip([104.0, 94.0, 84.0]) {
        let c = &w.companies[company(w, key)];
        assert!((c.management_score - 50.0).abs() < 1e-9, "{key}");
        assert_eq!(
            c.stations,
            Stations {
                productivity: 1,
                ..Stations::default()
            }
        );
        assert_eq!(c.data[0].book.free_rd_pct, 0);
        let p = w.units[c.units[0]].productivity;
        println!("{key}: productivity after 12 months {p:.6}");
        assert!((p - want).abs() < 1e-9, "{key}: {p} vs {want}");
    }
}

/// On 1 Feb (step 3): Arrowhead gets 12 research stations out of its idle; two other units sit
/// at the clamp edges with R&D pushing them over.
fn research_and_clamp(w: &mut World, ctx: &mut JobCtx<'_>) {
    if (ctx.facts.date.month, ctx.facts.date.year) != (2, 2020) {
        return;
    }
    let a = company(w, "CO-0001");
    w.companies[a].stations.research = 12;
    w.companies[a].stations.idle -= 12;
    for (key, p, mult) in [("CO-0002", 199.9, 3.0), ("CO-0004", 30.1, 0.0)] {
        let unit = w.companies[company(w, key)].units[0];
        let norm = w.industries[w.units[unit].industry].params.rd_norm;
        w.units[unit].productivity = p;
        w.units[unit].rd_plan = mult * norm;
    }
}

#[test]
fn productivity_step_follows_5_6_on_the_live_engine() {
    let mut sim = Sim::new(data(), 6).unwrap();
    sim.register_test_job(Slot::MonthlyFringe, "test.research", research_and_clamp);
    // Every unit's month, worked by hand from the state before the tick.
    run_to(&mut sim, Date::ymd(2020, 1, 31));
    let before = sim.world().clone();
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w = sim.world();
    let mut checked = 0;
    for (uid, u) in w.units.iter() {
        let c = &w.companies[u.company];
        let key = c.key.as_str();
        if matches!(key, "CO-0002" | "CO-0004") {
            continue;
        }
        let b = &before.units[uid];
        let norm = w.industries[u.industry].params.rd_norm;
        // Free R&D this month is the step of held TB at the start of the month (5.9 step 1).
        let free = c.data[0].book.free_rd_pct as f64 / 100.0;
        let held0 = before.companies[u.company].data[0].book.held;
        let step = if held0 < 1.0 {
            0.0
        } else {
            1.0 + held0.log10().floor()
        };
        assert_eq!(free * 100.0, step, "{key}");
        let score = spec_score(w, c);
        let want = (b.productivity + spec_delta(b.rd_plan + free, norm, score, &c.stations))
            .clamp(30.0, 200.0);
        assert!(
            (u.productivity - want).abs() < 1e-9,
            "{key}: {} vs {want}",
            u.productivity
        );
        checked += 1;
    }
    assert_eq!(checked, 649);
    // Arrowhead with 12 research stations: ×1.02; 281 of 392 idle, decay 0.3.
    let a = &w.companies[company(w, "CO-0001")];
    assert_eq!((a.stations.research, a.stations.idle), (12, 281));
    let au = &w.units[a.units[0]];
    let want =
        100.0 + 10.0 * (0.06 / 0.05 - 1.0) * (0.5 + spec_score(w, a) / 100.0) * 1.02 / 12.0 - 0.3;
    assert!((au.productivity - want).abs() < 1e-9);
    // The clamp (5.6): 30 to 200.
    assert_eq!(
        w.units[w.companies[company(w, "CO-0002")].units[0]].productivity,
        200.0
    );
    assert_eq!(
        w.units[w.companies[company(w, "CO-0004")].units[0]].productivity,
        30.0
    );
}

/// On 1 Feb (step 3): Arrowhead's CEO is replaced; the score moves at step 10 of the same tick.
fn swap_ceo(w: &mut World, ctx: &mut JobCtx<'_>) {
    if (ctx.facts.date.month, ctx.facts.date.year) == (2, 2020) {
        let a = company(w, "CO-0001");
        w.companies[a].board[0] = Some(score_fifty_ceo());
    }
}

#[test]
fn management_score_is_recomputed_each_month() {
    let mut sim = Sim::new(data(), 6).unwrap();
    sim.register_test_job(Slot::MonthlyFringe, "test.swap_ceo", swap_ceo);
    let at_load = sim.world().companies[company(sim.world(), "CO-0001")].management_score;
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w = sim.world();
    let a = &w.companies[company(w, "CO-0001")];
    assert!((a.management_score - spec_score(w, a)).abs() < 1e-9);
    assert_ne!(a.management_score, at_load);
}
