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

/// The World page's province table (the latest one built), from the starting data until the
/// map lands (M8; [`super::DemoTables`], deleted in M9 Phase C).
#[derive(Resource, Debug, Clone, Copy)]
pub struct DemoTableEntities {
    pub provinces: Entity,
}

pub struct ScreensPlugin;

impl Plugin for ScreensPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(DemoTableEntities {
            provinces: Entity::PLACEHOLDER,
        })
        .add_plugins((
            crate::pdoomberg::PdoombergPlugin,
            crate::pages::market::MarketPagesPlugin,
        ));
    }
}
