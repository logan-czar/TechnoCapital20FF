//! The cast of a startup and where it sits (spec 5.19.4; Logan, batch 165): the event's full
//! characters (founders, 3.7.2) and partial characters (simple, 3.7.1), seated on the open
//! labor seats, the rest as directors, and any labor seat still empty filled by 3.7.1.
//!
//! Draw order, frozen (D274; gen stream): the lead founder (CEO); each other founder in turn
//! (its seat pick, `pick_cast_seat`, then the character); each partial in turn; then a simple
//! character for each labor seat still empty, in seat order.

use serde::{Deserialize, Serialize};

use crate::ops::labor::open_seats;
use crate::people::board::{LABOR_SEAT_COUNT, Seat};
use crate::people::full::{FullCharacter, HomeChoice, generate_full, pick_cast_seat};
use crate::people::names::NameBook;
use crate::people::simple::{CompanySize, SimpleCharacter, generate_simple};
use crate::rng::DrawSource;

/// Spec 5.19.4 step 3: partial characters are generated as for a small company (3.7.1).
pub const CAST_SIZE: CompanySize = CompanySize::Small;
/// The role list a partial director is drawn from (D274): 3.7.1's row for the seats beyond the
/// five (Chair, General Counsel, Chief Strategy Officer).
pub const DIRECTOR_ROLE_SEAT: Seat = Seat::Chair;

/// Who holds a startup's seat (spec 5.19.4).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CastSeat {
    /// A founder: index into [`Cast::founders`] (0 is the lead).
    Founder(usize),
    /// One of the event's partial characters (5.19.4 step 3).
    Partial(SimpleCharacter),
    /// A simple character for a labor seat the cast left empty (5.19.4 step 4, "filled by
    /// 3.7.1 as usual").
    Filler(SimpleCharacter),
}

/// A startup's cast, seated (spec 5.19.4).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Cast {
    /// The full characters, lead founder first (3.5 `founders`).
    pub founders: Vec<FullCharacter>,
    /// The five labor seats in [`Seat::LABOR`] order; None only for a seat that is closed
    /// (fewer than 5 labor units, D200).
    pub seats: [Option<CastSeat>; LABOR_SEAT_COUNT],
    /// Directors: board seats with no labor unit and no effect in the MVP (5.19.4 step 4), in
    /// cast order (founders, then partials).
    pub directors: Vec<CastSeat>,
}

impl Cast {
    /// True if every open labor seat is held (build-plan M6.8 "no empty labor seat").
    pub fn labor_seats_full(&self, labor: u64) -> bool {
        open_seats(labor)
            .iter()
            .all(|s| self.seats[seat_index(*s)].is_some())
    }
}

fn seat_index(seat: Seat) -> usize {
    Seat::LABOR
        .iter()
        .position(|&s| s == seat)
        .expect("a labor seat")
}

/// Seats a startup's cast (spec 5.19.4):
///
/// 1. The lead founder (the first full character) is CEO.
/// 2. Each other full character is cast for an open labor seat, picked uniformly among those
///    still open other than the CEO's (D204), and made with that seat's skill as best; with
///    none open it is a director.
/// 3. Partial characters fill the labor seats still open, in seat order, each generated for
///    its seat as for a small company; the rest are directors (drawn from the Chair's role
///    list, D274).
/// 4. A labor seat still empty is filled by 3.7.1 as usual.
///
/// `labor` opens min(5, L) seats (D200: a startup has 10 or more labor units, so all five);
/// `taken` says whether a full name is already used in the world; names made in this cast are
/// checked too.
pub fn seat_cast(
    draws: &mut dyn DrawSource,
    names: &NameBook,
    taken: &dyn Fn(&str) -> bool,
    labor: u64,
    full: u8,
    partial: u8,
    home: HomeChoice<'_>,
) -> Cast {
    let open: Vec<Seat> = open_seats(labor).to_vec();
    let mut seats: [Option<CastSeat>; LABOR_SEAT_COUNT] = Default::default();
    let mut directors = Vec::new();
    let mut founders: Vec<FullCharacter> = Vec::new();

    for n in 0..usize::from(full) {
        let made: Vec<String> = founders.iter().map(|f| f.name.clone()).collect();
        let is_taken = |name: &str| taken(name) || made.iter().any(|m| m == name);
        let still_open: Vec<Seat> = open
            .iter()
            .copied()
            .filter(|s| seats[seat_index(*s)].is_none())
            .collect();
        let seat = if n == 0 {
            still_open.contains(&Seat::Ceo).then_some(Seat::Ceo)
        } else {
            pick_cast_seat(draws, &still_open)
        };
        let character = generate_full(draws, names, &is_taken, n == 0, seat, home);
        founders.push(character);
        match seat {
            Some(s) => seats[seat_index(s)] = Some(CastSeat::Founder(n)),
            None => directors.push(CastSeat::Founder(n)),
        }
    }

    for _ in 0..partial {
        let next = open
            .iter()
            .copied()
            .find(|s| seats[seat_index(*s)].is_none());
        match next {
            Some(s) => {
                let c = generate_simple(draws, names, CAST_SIZE, s);
                seats[seat_index(s)] = Some(CastSeat::Partial(c));
            }
            None => {
                let c = generate_simple(draws, names, CAST_SIZE, DIRECTOR_ROLE_SEAT);
                directors.push(CastSeat::Partial(c));
            }
        }
    }

    for s in &open {
        if seats[seat_index(*s)].is_none() {
            let c = generate_simple(draws, names, CAST_SIZE, *s);
            seats[seat_index(*s)] = Some(CastSeat::Filler(c));
        }
    }

    Cast {
        founders,
        seats,
        directors,
    }
}
