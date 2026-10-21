//! People (build-plan M3.2, M3.3, M6.8): simple (partial) characters generated for board seats,
//! full characters made in play, and the management score and confidence factor.
//!
//! Spec sections: 3.7, 3.7.1, 3.7.2, 5.7; simple characters are generated at load (7.1) and in
//! 4.3 step 11 ([`seating`]).

pub mod board;
pub mod full;
pub mod management;
pub mod names;
pub mod seating;
pub mod simple;
pub mod traits;

use crate::time::{Scheduler, Slot};

/// Registers the people jobs. Called from `lib.rs`'s `register_jobs` after the economy, so in
/// 4.3 step 11 the simple characters for new seats come after the asset step (spec 4.3).
pub fn register(s: &mut Scheduler) {
    s.register(
        Slot::MonthlyAssets,
        "people.new_seats",
        seating::new_seats_job,
    );
}
