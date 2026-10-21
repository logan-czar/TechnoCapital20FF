//! The Lite AI (build-plan M6.1 to M6.4): AI inputs and archetypes, the growth plan with trait
//! nudges and funding cap, the R&D plan, the station split, financing and dividends, the plan
//! lock batch, consensus and projection ranges.
//!
//! Spec sections: 6, 6.1 to 6.6, 5.16, 5.17 (called at the lock); scheduled at the 4.4 plan lock
//! and in 4.2 step 4 (projection ranges).
//!
//! Formula modules (lane F, F6): pure functions of explicit inputs with their outputs returned;
//! draws only through a `&mut dyn DrawSource`; no scheduler wiring. One file per spec section:
//!
//! - [`inputs`]: section 6 inputs (g_dem, ROA, loss_q, liquidity, min_cash, the traits read).
//! - [`archetype`]: 6.1 archetype and its table values.
//! - [`growth`]: 6.2 growth plan, trait nudges, clamp and funding cap.
//! - [`rd`]: 6.3 R&D plan.
//! - [`split`]: 6.4 station split (reads `ops::stations::station_split`).
//! - [`financing`]: 6.5 financing rows and the 5.17 dividend (`finance::dividends`).
//! - [`raise`]: 6.6 raising money in cash-burning industries (parked behind `cash_burning`).
//! - [`plan`]: the 4.4 plan-lock order and one company's locked plan (6.1 to 6.5 composed).
//!
//! Consensus and projection ranges (5.16) are `market::projection`.

pub mod archetype;
pub mod financing;
pub mod growth;
pub mod inputs;
pub mod plan;
pub mod raise;
pub mod rd;
pub mod split;
