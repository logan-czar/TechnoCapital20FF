//! Spec 5.7 management score and confidence factor (build-plan M3.3): a skill-11 board with an
//! empty Chair scores about 51; generated boards average about 33, 47 and 60 by size (3.7.1).

use sim::people::board::{Seat, Skills};
use sim::people::management::{
    Board, Member, confidence_factor, management_score, member_skill, mgmt_factor,
};
use sim::people::names::NameBook;
use sim::people::simple::{CompanySize, generate_simple};
use sim::people::traits::Trait;
use sim::rng::RngStreams;

fn flat(v: u8) -> Skills {
    Skills {
        finance: v,
        operations: v,
        persuasion: v,
        intrigue: v,
        tech: v,
        hustle: v,
    }
}

fn close(a: f64, b: f64, tol: f64) -> bool {
    (a - b).abs() <= tol
}

#[test]
fn board_of_eleven_with_empty_chair_scores_about_51() {
    let s = flat(11);
    let mut board = Board::default();
    for seat in Seat::LABOR {
        board.set(
            seat,
            Member {
                skills: &s,
                traits: &[],
            },
        );
    }
    // 0.9 × 11 + 0.1 × 3 = 10.2, ÷ 20 × 100 = 51.
    assert!(close(management_score(&board), 51.0, 1e-9));
}

#[test]
fn empty_seats_count_three_and_score_caps_at_100() {
    // No board at all: every seat counts 3, so 15.
    assert!(close(management_score(&Board::default()), 15.0, 1e-9));
    // One labor unit: the CEO alone (skill 10) and five empty seats.
    let s = flat(10);
    let mut ceo_only = Board::default();
    ceo_only.set(
        Seat::Ceo,
        Member {
            skills: &s,
            traits: &[],
        },
    );
    assert!(close(
        management_score(&ceo_only),
        (3.0 + 0.7 * 3.0) / 20.0 * 100.0,
        1e-9
    ));
    // A board of 25s (Chair included) caps at 100.
    let top = flat(25);
    let mut full = Board::default();
    for seat in [
        Seat::Ceo,
        Seat::Cfo,
        Seat::Cio,
        Seat::Cmo,
        Seat::Coo,
        Seat::Chair,
    ] {
        full.set(
            seat,
            Member {
                skills: &top,
                traits: &[],
            },
        );
    }
    assert_eq!(management_score(&full), 100.0);
}

#[test]
fn ceo_reads_the_average_of_finance_operations_and_persuasion() {
    let s = Skills {
        finance: 9,
        operations: 12,
        persuasion: 15,
        intrigue: 0,
        tech: 30,
        hustle: 30,
    };
    let m = Member {
        skills: &s,
        traits: &[],
    };
    assert!(close(member_skill(m, Seat::Ceo), 12.0, 1e-12));
    assert_eq!(member_skill(m, Seat::Cfo), 9.0);
    assert_eq!(member_skill(m, Seat::Coo), 12.0);
    assert_eq!(member_skill(m, Seat::Cmo), 15.0);
    assert_eq!(member_skill(m, Seat::Cio), 0.0);
}

#[test]
fn trait_shifts_apply_in_their_seats() {
    let s = flat(10);
    let m = |traits| Member { skills: &s, traits };
    // Diligent +2, Lazy -2, Ambitious +1 in any seat (3.7.1; D206).
    for seat in Seat::LABOR {
        assert_eq!(member_skill(m(&[Trait::Diligent]), seat), 12.0);
        assert_eq!(member_skill(m(&[Trait::Lazy]), seat), 8.0);
        assert_eq!(member_skill(m(&[Trait::Ambitious]), seat), 11.0);
    }
    assert_eq!(
        member_skill(m(&[Trait::Diligent, Trait::Ambitious]), Seat::Coo),
        13.0
    );
    // Greedy -1 as CFO only.
    assert_eq!(member_skill(m(&[Trait::Greedy]), Seat::Cfo), 9.0);
    assert_eq!(member_skill(m(&[Trait::Greedy]), Seat::Ceo), 10.0);
    // Other traits shift nothing, and their skill effects are not counted here (D206).
    for t in [
        Trait::Gregarious,
        Trait::Deceitful,
        Trait::Honest,
        Trait::Ruthless,
    ] {
        let one = [t];
        let member = Member {
            skills: &s,
            traits: &one,
        };
        assert_eq!(member_skill(member, Seat::Cmo), 10.0, "{t:?}");
    }
    // A shift never takes the skill below 0.
    let low = flat(1);
    let lazy = Member {
        skills: &low,
        traits: &[Trait::Lazy],
    };
    assert_eq!(member_skill(lazy, Seat::Coo), 0.0);
}

#[test]
fn generated_boards_average_about_33_47_60_by_size() {
    let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
    let names = NameBook::for_country(&data, "USA").unwrap();
    let mut rng = RngStreams::new(51);
    let n = 20_000;
    for (size, want) in [
        (CompanySize::Small, 33.0),
        (CompanySize::Mid, 47.0),
        (CompanySize::Large, 60.0),
    ] {
        let mut sum = 0.0;
        for _ in 0..n {
            let chars: Vec<_> = Seat::LABOR
                .iter()
                .map(|&seat| generate_simple(&mut rng, &names, size, seat))
                .collect();
            let mut board = Board::default();
            for c in &chars {
                board.set(
                    c.seat,
                    Member {
                        skills: &c.skills,
                        traits: &c.traits,
                    },
                );
            }
            sum += management_score(&board);
        }
        let mean = sum / f64::from(n);
        // Without traits the means are 33.0, 46.5 and 60.0; the 3.7.1 trait shifts add about
        // 1.4 (D206).
        assert!(close(mean, want, 2.0), "{size:?} mean {mean}");
    }
}

#[test]
fn confidence_and_management_factors() {
    // 10.5.2 table: score 30, 50, 80.
    assert!(close(confidence_factor(30.0), 0.92, 1e-12));
    assert!(close(confidence_factor(50.0), 1.00, 1e-12));
    assert!(close(confidence_factor(80.0), 1.12, 1e-12));
    assert!(close(confidence_factor(0.0), 0.8, 1e-12));
    assert!(close(confidence_factor(100.0), 1.2, 1e-12));
    assert!(close(mgmt_factor(30.0), 0.8, 1e-12));
    assert!(close(mgmt_factor(50.0), 1.0, 1e-12));
    assert!(close(mgmt_factor(80.0), 1.3, 1e-12));
}
