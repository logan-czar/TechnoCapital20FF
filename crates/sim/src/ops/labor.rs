//! Labor units, board seats opening and closing, and the station drop order (spec 5.10, 3.7;
//! 10.0.11.3).

use crate::people::board::{LABOR_SEAT_COUNT, Seat};

use super::stations::Stations;

/// Spec 5.10: labor units never fall below 1 (the CEO).
pub const MIN_LABOR_UNITS: u64 = 1;

/// Labor units (spec 5.10): `floor(Σ units gross_assets ÷ labor_value)`, minimum 1. The caller
/// sums its units' gross assets in id order; `labor_value_usd` is the main industry's (one unit
/// per company in the MVP; D200).
pub fn labor_units(gross_assets_usd: f64, labor_value_usd: f64) -> u64 {
    assert!(labor_value_usd > 0.0, "labor_value must be positive");
    let units = (gross_assets_usd.max(0.0) / labor_value_usd).floor();
    // `as` saturates for huge values; f64 holds every count the MVP reaches exactly.
    (units as u64).max(MIN_LABOR_UNITS)
}

/// How many of the five labor seats are open with `labor` units (spec 3.7: a seat exists only
/// when the company has that many labor units).
pub fn open_seat_count(labor: u64) -> usize {
    (labor.min(LABOR_SEAT_COUNT as u64)) as usize
}

/// The open labor seats with `labor` units, in opening order (spec 3.7).
pub fn open_seats(labor: u64) -> &'static [Seat] {
    &Seat::LABOR[..open_seat_count(labor)]
}

/// Seats a labor recount opens and closes (spec 5.10 "Seats"), each in opening order.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SeatChanges {
    /// Seats that open: a simple character is generated for each (3.7.1, 4.3 step 11).
    pub opened: Vec<Seat>,
    /// Seats that close: their simple character is discarded (a full character stays in the
    /// world, unseated; C34).
    pub closed: Vec<Seat>,
}

/// The seats that open or close when labor units go from `old` to `new` (spec 5.10, 3.7).
pub fn seat_changes(old: u64, new: u64) -> SeatChanges {
    let (a, b) = (open_seat_count(old), open_seat_count(new));
    SeatChanges {
        opened: Seat::LABOR[a.min(b)..b].to_vec(),
        closed: Seat::LABOR[b..a.max(b)].to_vec(),
    }
}

/// Fits the assigned stations to `labor` units (spec 5.10; 10.0.11.3). When the count falls
/// below what is assigned, stations drop idle first, then research, enterprise, 50/50 and last
/// productivity (D201 places 50/50, which the spec does not list); when it rises, the new units
/// are idle until the next plan assigns them (D201).
pub fn fit_stations(stations: Stations, labor: u64) -> Stations {
    let mut s = stations;
    let total = s.total();
    if total < labor {
        s.idle += labor - total;
        return s;
    }
    let mut excess = total - labor;
    for slot in [
        &mut s.idle,
        &mut s.research,
        &mut s.enterprise,
        &mut s.fifty_fifty,
        &mut s.productivity,
    ] {
        let cut = excess.min(*slot);
        *slot -= cut;
        excess -= cut;
    }
    s
}
