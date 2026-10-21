//! Company births and listings (build-plan M6.6 to M6.9): random and fixed startup events,
//! startups carved from the fringe with their casts, IPO tests, board votes and listings.
//!
//! Spec sections: 5.19, 5.19.1 to 5.19.5, 5.20, 5.20.1; scheduled at the 4.4 plan lock (fixed
//! events, then random events, then IPO votes and listings).
//!
//! Formula modules (lane F, F6): pure functions of explicit inputs with their outputs returned;
//! draws only through a `&mut dyn DrawSource` (all on the gen stream, 5.19, 5.20.1); no
//! scheduler wiring. One file per spec section:
//!
//! - [`weights`]: 5.19.1 industry weight (heat and fringe factor) and the HQ province weight
//!   (2-map 2.3.1 province weight).
//! - [`random`]: 5.19.1 random events: Poisson count, industry pick, type table, HQ, sizes.
//! - [`fixed`]: 5.19.2 fixed events F1 to F9 from startup-events.csv.
//! - [`startup`]: 5.19.3 each startup: size cap, carve, stations, fixed cost rate, run rate,
//!   rating, engine value, shares, cap table, archetype.
//! - [`cast`]: 5.19.4 the cast and its seating.
//! - [`names`]: 5.19.3 company names and 5.20.1 tickers.
//! - [`ipo`]: 5.20 IPO tests, 5.20.1 the board vote, the cap of 3 and the listing.

pub mod cast;
pub mod fixed;
pub mod ipo;
pub mod names;
pub mod random;
pub mod startup;
pub mod weights;
