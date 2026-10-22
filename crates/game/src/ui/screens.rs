//! The screens that are not workspace placeholders (build-plan M7.8, M9.4; spec 8): full-screen
//! Pdoomberg ([`crate::pdoomberg`], its F-key pages drawn from the views) and lane B2's market
//! and world pages ([`crate::pages::market`]: Industries, News, Recap and startup events),
//! registered here after the placeholders so they replace them.
//!
//! Every other screen is a page in the tiling workspace ([`crate::pages`],
//! [`crate::workspace`]).

use bevy::prelude::*;

pub use crate::pages::placeholder::ViewLine;
pub use crate::pages::{ViewKey, view_meta};

pub struct ScreensPlugin;

impl Plugin for ScreensPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins((
            crate::pdoomberg::PdoombergPlugin,
            crate::pages::market::MarketPagesPlugin,
        ));
    }
}
