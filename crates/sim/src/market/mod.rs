//! Valuation and price (build-plan M5): fair value, the hourly share price, daily bars and buzz,
//! the earnings jump and reaction week, the 26 exchanges and headline indices, and zone exchange
//! confidence.
//!
//! Spec sections: 3.10, 5.1.2 (confidence), 5.13, 5.14, 5.15, 21.3.1; scheduled in 4.1 steps 2
//! and 3, 4.2 steps 1 to 3 and 6, and the 4.4 price move at 01:00 on release days.
//!
//! Formula modules (lane F, F5): pure functions of explicit inputs with their outputs returned;
//! draws only through a `&mut dyn DrawSource`; no scheduler wiring. One file per spec section:
//!
//! - [`fair_value`]: 5.13 fair value, E_norm, G, R, X, cycle and confidence factors, floors, the
//!   private discount, and the release basis the daily refresh reuses.
//! - [`engine_value`]: 7.1 engine value at load (company-start.csv `engine_value_usd`).
//! - [`price`]: 5.14 hourly price step, noise, fat tails, the buzz target, the market calendar
//!   and the 21.3.1 reaction-week volatility.
//! - [`daily`]: 4.2 daily bars, buzz decay and the reaction-week reversion.
//! - [`earnings`]: 5.15 surprise, earnings jump, buzz and result tags (21.3.2).
//! - [`index`]: 5.14 headline indices at 1,000 with a divisor.
//! - [`confidence`]: 5.1.2 zone exchange confidence.
//! - [`projection`]: 5.16 consensus and projection ranges.

pub mod daily;
pub mod earnings;
pub mod engine_value;
pub mod fair_value;
pub mod index;
pub mod price;
