//! The books (build-plan M4): the monthly ledger, quarterly and yearly statements, tax with loss
//! carryforward, the credit line, the implied rating, asset decay and sales, distress and
//! bankruptcy, and the dividend rule.
//!
//! Spec sections: 3.9, 5.10 (asset decay and sales), 5.11, 5.12, 5.17; scheduled in 4.3 steps 11
//! to 14, the 4.4 quarterly close (statements, tax, result tags) and the 4.5 yearly jobs.
//!
//! Formula modules (lane F, F4): pure functions of explicit inputs with their outputs returned;
//! no scheduler wiring. One file per spec section:
//!
//! - [`statements`]: 3.9 ledger lines and statements, 4.4 and 4.5 rollups, the 7.1 synthetic
//!   history, trailing four quarters, the archive.
//! - [`balance`]: the balance sheet and its identity (M4.9).
//! - [`tax`]: 5.11 tax with loss carryforward.
//! - [`credit`]: 5.12 credit line, home spread, rate, charges, auto-draw and repay, review.
//! - [`rating`]: 5.12 implied rating, adjustments, ceiling, review moves, starting rating.
//! - [`sales`]: 5.10 asset sales at the sale factor.
//! - [`distress`]: 5.12 step 13 settle, distress, bankruptcy and removal (C30).
//! - [`dividends`]: 5.17 dividend rule.
//!
//! The wiring (lane S, M4): [`state`] holds a company's books in the World and [`jobs`] moves
//! them through the load (7.1), the 4.3 steps 9 to 14, the 4.4 close, release and 01:00 review
//! and the 4.5 yearly statements.

pub mod balance;
pub mod credit;
pub mod distress;
pub mod dividends;
pub mod jobs;
pub mod rating;
pub mod sales;
pub mod state;
pub mod statements;
pub mod tax;

pub use jobs::{register, start};
