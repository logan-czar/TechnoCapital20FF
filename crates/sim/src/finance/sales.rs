//! Asset sales at the sale factor (spec 5.10; 10.0.7): capacity sold at cost, the same share of
//! the book, cash received `book sold × sale factor`, and the gain or loss in pre-tax income.
//! Used by growth plan sales (4.3 step 11), forced sales in distress (5.12 step 1, 4.3 step 13)
//! and the removal sale at the Bust factor (5.12 step 3).

use serde::{Deserialize, Serialize};

/// An industry's phase label as the sale factor reads it (spec 5.1, 5.10). Lane S's
/// `world::PhaseLabel` carries the same four labels; [`sale_factor`] is the one table.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SalePhase {
    Boom,
    Normal,
    Glut,
    Bust,
}

/// Spec 5.10 sale factors (10.0.7): cash per $1 of book sold.
pub const SALE_FACTOR_BOOM: f64 = 1.00;
pub const SALE_FACTOR_NORMAL: f64 = 0.85;
pub const SALE_FACTOR_GLUT: f64 = 0.70;
pub const SALE_FACTOR_BUST: f64 = 0.60;
/// Spec 5.12 step 3: a removed company's assets sell at the Bust factor whatever the label.
pub const REMOVAL_SALE_FACTOR: f64 = SALE_FACTOR_BUST;

/// Cash per $1 of book sold for the industry's phase label (spec 5.10).
pub fn sale_factor(phase: SalePhase) -> f64 {
    match phase {
        SalePhase::Boom => SALE_FACTOR_BOOM,
        SalePhase::Normal => SALE_FACTOR_NORMAL,
        SalePhase::Glut => SALE_FACTOR_GLUT,
        SalePhase::Bust => SALE_FACTOR_BUST,
    }
}

/// One sale (spec 5.10). All amounts USD.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct AssetSale {
    /// Capacity sold, at cost (off gross_assets).
    pub capacity_sold: f64,
    /// The same share of asset_book.
    pub book_sold: f64,
    /// `book sold × sale factor`.
    pub proceeds: f64,
    /// `proceeds − book sold`: a gain above 0, a loss below (pre-tax income, 5.10).
    pub gain: f64,
    /// Share of the unit sold, 0 to 1; ramping tranches shrink by the same share (lane S).
    pub share: f64,
}

/// Sells `capacity` of a unit's gross assets (spec 5.10): the book sold is the same share of
/// asset_book; capacity is capped at what the unit has.
pub fn sell_capacity(gross_assets: f64, asset_book: f64, capacity: f64, factor: f64) -> AssetSale {
    if gross_assets <= 0.0 || capacity <= 0.0 {
        return AssetSale::default();
    }
    let sold = capacity.min(gross_assets);
    let share = sold / gross_assets;
    sale_of_share(gross_assets, asset_book, share, factor)
}

/// Sells just enough to raise `cash_needed` (spec 5.12 step 1: "sells assets at the sale factor
/// until cash reaches 0"), or everything if that is not enough. A unit with no book left raises
/// nothing and sells nothing (D225).
pub fn sell_for_cash(
    gross_assets: f64,
    asset_book: f64,
    cash_needed: f64,
    factor: f64,
) -> AssetSale {
    if gross_assets <= 0.0 || asset_book <= 0.0 || cash_needed <= 0.0 || factor <= 0.0 {
        return AssetSale::default();
    }
    let share = (cash_needed / factor / asset_book).min(1.0);
    sale_of_share(gross_assets, asset_book, share, factor)
}

/// Sells everything (spec 5.12 step 3, at [`REMOVAL_SALE_FACTOR`]).
pub fn sell_all(gross_assets: f64, asset_book: f64, factor: f64) -> AssetSale {
    if gross_assets <= 0.0 && asset_book <= 0.0 {
        return AssetSale::default();
    }
    sale_of_share(gross_assets, asset_book, 1.0, factor)
}

fn sale_of_share(gross_assets: f64, asset_book: f64, share: f64, factor: f64) -> AssetSale {
    // Selling the whole unit takes the exact balances, so nothing is left from float error.
    let (capacity_sold, book_sold) = if share >= 1.0 {
        (gross_assets.max(0.0), asset_book.max(0.0))
    } else {
        (gross_assets * share, asset_book * share)
    };
    let proceeds = book_sold * factor;
    AssetSale {
        capacity_sold,
        book_sold,
        proceeds,
        gain: proceeds - book_sold,
        share: share.min(1.0),
    }
}
