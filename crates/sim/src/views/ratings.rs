//! v_ratings: credit ratings (spec 9.2, Pdoomberg F6 Ratings, spec 8): every company's rating,
//! the implied rating with its breakdown (5.12, 3.6.3), the last review's move, the credit line
//! (drawn, limit, rate, home spread) and the distress state. Rebuilt quarterly (spec 9.4), so it
//! shows the 01:00 release-day review once it has run.

use super::{Cadence, ViewData, ViewInput};
use crate::finance::credit::line_rate;
use crate::finance::distress::CompanyStatus;
use crate::finance::jobs::company_home_spread;
use crate::finance::rating::{Band, ImpliedRating, Rating};
use crate::time::Date;
use crate::world::{CompanyId, Ordinal};

/// One company's rating row.
#[derive(Debug, Clone, PartialEq)]
pub struct CompanyRating {
    pub id: CompanyId,
    pub key: String,
    pub rating: Rating,
    /// The implied rating at the last review (or at load) and how it was reached.
    pub implied: ImpliedRating,
    /// Notches the last review moved, better above 0.
    pub last_review_notches: i32,
    pub line_drawn: f64,
    pub line_limit: f64,
    /// The line rate now: base rate + home spread (effective zone spread) + corporate spread
    /// (spec 5.12).
    pub line_rate: f64,
    pub home_spread: f64,
    /// Months left to repay an excess over the limit (spec 5.12 review); 0 with none open.
    pub excess_months_left: u32,
    pub status: CompanyStatus,
    pub distress_months: u32,
    pub frozen_quarters: u32,
    pub bankrupt_on: Option<Date>,
    pub removed_on: Option<Date>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct RatingsView {
    /// Every company in company id order.
    pub companies: Vec<CompanyRating>,
    /// World base rate (spec 3.1).
    pub base_rate: f64,
}

/// The rating bands, best first (spec 5.12).
pub const BANDS: [Band; 8] = [
    Band::Aaa,
    Band::Aa,
    Band::A,
    Band::Bbb,
    Band::Bb,
    Band::B,
    Band::Ccc,
    Band::Cc,
];

impl RatingsView {
    pub fn get(&self, id: CompanyId) -> Option<&CompanyRating> {
        self.companies.get(id.index())
    }

    /// Companies by rating band, best first, counting those not frozen (Active and Distressed).
    pub fn band_counts(&self) -> [(Band, usize); 8] {
        BANDS.map(|b| {
            let n = self
                .companies
                .iter()
                .filter(|c| !c.status.is_frozen() && c.rating.band() == b)
                .count();
            (b, n)
        })
    }
}

impl ViewData for RatingsView {
    const CADENCE: Cadence = Cadence::Quarterly;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let companies = w
            .companies
            .iter()
            .map(|(id, c)| {
                let f = &c.finance;
                let home = company_home_spread(w, c, false);
                CompanyRating {
                    id,
                    key: c.key.clone(),
                    rating: f.rating,
                    implied: f.implied,
                    last_review_notches: f.last_review_notches,
                    line_drawn: f.line.drawn,
                    line_limit: f.line.limit,
                    line_rate: line_rate(w.base_rate, home, f.rating),
                    home_spread: home,
                    excess_months_left: f.line.excess_months_left,
                    status: f.status(),
                    distress_months: f.distress.distress_months,
                    frozen_quarters: f.distress.frozen_quarters,
                    bankrupt_on: f.bankrupt_on,
                    removed_on: f.removed_on,
                }
            })
            .collect();
        RatingsView {
            companies,
            base_rate: w.base_rate,
        }
    }
}
