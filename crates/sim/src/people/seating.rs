//! Board seating on the World (build-plan M3.2, M3.3): simple characters for the open labor seats
//! at load (spec 7.1 "Board", 3.7.1) and for the seats a recount opens (5.10, 4.3 step 11), and
//! the monthly management score (5.7).
//!
//! The formulas are lane F's ([`generate_simple`], [`management_score`]); this file reads the
//! World, calls them in id order and writes the results back. Every draw is a gen-stream draw
//! through the job's [`DrawSource`], companies in id order and seats in opening order, so the
//! seating is part of the seeded run.

use super::board::Seat;
use super::management::{Board, Member, management_score};
use super::simple::{CompanySize, generate_simple};
use crate::economy::MONTHS_PER_YEAR;
use crate::ops::labor::open_seats;
use crate::rng::DrawSource;
use crate::time::JobCtx;
use crate::world::{Company, CompanyId, SeatHolder, SimpleSeat, World};

/// Seats every company's open labor seats at load (spec 7.1 "Board": seats 1 to min(5, L), each
/// with a generated simple character; 3.7.1 size from the starting revenue), then sets every
/// management score. No full character sits at load: the named controllers own and do not hold
/// seats (design fix 200), so all 3,207 open seats get simple characters. Call once, after
/// [`crate::economy::start`] (whose pop roll is the first gen-stream draw, D111).
pub fn start(world: &mut World, draws: &mut dyn DrawSource) {
    for id in world.companies.ids() {
        let c = &world.companies[id];
        let seats = open_seats(c.labor_units).to_vec();
        let size = CompanySize::from_revenue(c.revenue_usd);
        for seat in seats {
            seat_simple(world, id, seat, size, draws);
        }
    }
    set_management_scores(world);
}

/// Generates the simple character for `seat` of company `id` and seats it (spec 3.7.1).
fn seat_simple(
    world: &mut World,
    id: CompanyId,
    seat: Seat,
    size: CompanySize,
    draws: &mut dyn DrawSource,
) {
    let country = world.companies[id].hq_country;
    let names = world
        .name_books
        .get(country)
        .expect("every country has a name book (checked at load)");
    let character = generate_simple(draws, names, size, seat);
    let sid = world.simple_characters_made;
    world.simple_characters_made += 1;
    let slot = seat_index(seat);
    world.companies[id].board[slot] = Some(SeatHolder::Simple(SimpleSeat { id: sid, character }));
}

/// The board index of a labor seat.
pub fn seat_index(seat: Seat) -> usize {
    Seat::LABOR
        .iter()
        .position(|&s| s == seat)
        .expect("a labor seat")
}

/// Trailing annual revenue for the 3.7.1 size of a seat opened in play: the run rate of the
/// month just closed, 12 × its units' revenue (D116; M4's statements bring the trailing
/// four quarters).
pub fn trailing_revenue(world: &World, company: &Company) -> f64 {
    MONTHS_PER_YEAR
        * company
            .units
            .iter()
            .map(|&u| world.units[u].revenue_m)
            .sum::<f64>()
}

/// 4.3 step 11 (people part, after the economy's asset step): a simple character for each seat
/// this month's recount opened (spec 3.7.1, 5.10), companies in id order, seats in opening order.
pub fn new_seats_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    for id in world.companies.ids() {
        if world.companies[id].seats_to_fill.is_empty() {
            continue;
        }
        let seats = std::mem::take(&mut world.companies[id].seats_to_fill);
        let size = CompanySize::from_revenue(trailing_revenue(world, &world.companies[id]));
        for seat in seats {
            seat_simple(world, id, seat, size, ctx.draws);
        }
    }
}

/// The 5.7 board of a company: each filled labor seat with its holder's drawn skills and traits
/// (simple or full); closed and waiting seats and the Chair count skill 3 (D205).
pub fn board_of<'a>(world: &'a World, company: &'a Company) -> Board<'a> {
    let mut board = Board::default();
    for (i, holder) in company.board.iter().enumerate() {
        let Some(holder) = holder else { continue };
        let member = match holder {
            SeatHolder::Simple(s) => Member {
                skills: &s.character.skills,
                traits: &s.character.traits,
            },
            SeatHolder::Full(ch) => {
                let ch = &world.characters[*ch];
                Member {
                    skills: &ch.skills,
                    traits: &ch.traits,
                }
            }
        };
        board.set(Seat::LABOR[i], member);
    }
    board
}

/// Sets every company's management score from its seated board (spec 5.7).
pub fn set_management_scores(world: &mut World) {
    let scores: Vec<f64> = world
        .companies
        .iter()
        .map(|(_, c)| management_score(&board_of(world, c)))
        .collect();
    for ((_, c), s) in world.companies.iter_mut().zip(scores) {
        c.management_score = s;
    }
}
