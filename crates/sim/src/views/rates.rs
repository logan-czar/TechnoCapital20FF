//! v_rates: `get_rates()` (spec 9.2; 8 Pdoomberg F7 Bonds, batch 155): the world base rate,
//! every zone's base and effective credit spread, every country's sovereign rating and spread,
//! and the rating-to-corporate-spread table of the credit line (5.12). Rebuilt monthly (the zone
//! spreads move at the quarter's first monthly close, 4.3 step 1d) and on load.

use super::{Cadence, ViewData, ViewInput};
use crate::finance::rating::{Rating, corporate_spread};
use crate::world::{CountryId, ZoneId};

/// A zone's spreads (spec 5.1.2), fractions.
#[derive(Debug, Clone, PartialEq)]
pub struct ZoneRate {
    pub zone: ZoneId,
    pub number: u32,
    pub name: String,
    pub base: f64,
    pub effective: f64,
}

/// A country's sovereign rating and spread (spec 3.2, 5.1.2).
#[derive(Debug, Clone, PartialEq)]
pub struct SovereignRate {
    pub country: CountryId,
    pub iso3: String,
    pub name: String,
    pub zone: ZoneId,
    pub rating: Rating,
    /// A fraction.
    pub spread: f64,
}

/// One row of the rating-to-spread table (spec 5.12): the corporate spread a rating adds to
/// the line rate, a fraction.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RatingSpread {
    pub rating: Rating,
    pub spread: f64,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct RatesView {
    /// World base rate (spec 3.1).
    pub base_rate: f64,
    /// In zone id order.
    pub zones: Vec<ZoneRate>,
    /// In country id order.
    pub sovereigns: Vec<SovereignRate>,
    /// AAA to CC (spec 5.12).
    pub rating_spreads: Vec<RatingSpread>,
}

impl ViewData for RatesView {
    const CADENCE: Cadence = Cadence::Monthly;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        RatesView {
            base_rate: w.base_rate,
            zones: w
                .zones
                .iter()
                .map(|(id, z)| ZoneRate {
                    zone: id,
                    number: z.number,
                    name: z.name.clone(),
                    base: z.credit_spread_base,
                    effective: z.credit_spread,
                })
                .collect(),
            sovereigns: w
                .countries
                .iter()
                .map(|(id, c)| SovereignRate {
                    country: id,
                    iso3: c.key.clone(),
                    name: c.name.clone(),
                    zone: c.zone,
                    rating: c.sovereign_rating,
                    spread: c.sovereign_spread,
                })
                .collect(),
            rating_spreads: Rating::ALL
                .iter()
                .map(|&rating| RatingSpread {
                    rating,
                    spread: corporate_spread(rating),
                })
                .collect(),
        }
    }
}
