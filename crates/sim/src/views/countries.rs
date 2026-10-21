//! v_countries: `list_countries(filter)` and `get_country(iso3)` (spec 9.2; 3.2): every country
//! with its iso3, name, superregion, financial zone, corporate tax rate, sovereign rating and
//! spread (the economy settings sit on the zone, batch 155), and the companies headquartered
//! there. Rebuilt monthly and at the plan lock (spec 9.4; startups are born at the lock, D159).
//! Removed companies are left out (5.12 step 3).

use super::{Cadence, ViewData, ViewInput};
use crate::finance::distress::CompanyStatus;
use crate::finance::rating::Rating;
use crate::world::{CompanyId, CountryId, Ordinal, ZoneId};

/// One country (spec 3.2, 9.2).
#[derive(Debug, Clone, PartialEq)]
pub struct CountryRow {
    pub id: CountryId,
    pub iso3: String,
    pub name: String,
    /// countries.csv `superregion`.
    pub superregion: String,
    pub zone: ZoneId,
    pub zone_name: String,
    pub gdp_usd: f64,
    /// National corporate tax rate (spec 3.2, 5.11).
    pub corp_tax_rate: f64,
    pub sovereign_rating: Rating,
    /// A fraction (spec 5.1.2).
    pub sovereign_spread: f64,
    /// Companies with their HQ here, in company id order (spec 9.2 "HQ count").
    pub hq_companies: Vec<CompanyId>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct CountriesView {
    /// In country id order (iso3 order, D4).
    pub countries: Vec<CountryRow>,
}

impl CountriesView {
    pub fn get(&self, id: CountryId) -> Option<&CountryRow> {
        self.countries.get(id.index())
    }

    /// `get_country(iso3)`.
    pub fn by_iso3(&self, iso3: &str) -> Option<&CountryRow> {
        self.countries
            .binary_search_by(|c| c.iso3.as_str().cmp(iso3))
            .ok()
            .map(|i| &self.countries[i])
    }
}

impl ViewData for CountriesView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let mut hq: Vec<Vec<CompanyId>> = vec![Vec::new(); w.countries.len()];
        for (id, c) in w.companies.iter() {
            if c.finance.status() != CompanyStatus::Removed {
                hq[c.hq_country.index()].push(id);
            }
        }
        let countries = w
            .countries
            .iter()
            .zip(hq)
            .map(|((id, c), hq_companies)| CountryRow {
                id,
                iso3: c.key.clone(),
                name: c.name.clone(),
                superregion: c.superregion.clone(),
                zone: c.zone,
                zone_name: w.zones[c.zone].name.clone(),
                gdp_usd: c.gdp_usd,
                corp_tax_rate: c.corp_tax_rate,
                sovereign_rating: c.sovereign_rating,
                sovereign_spread: c.sovereign_spread,
                hq_companies,
            })
            .collect();
        CountriesView { countries }
    }
}
