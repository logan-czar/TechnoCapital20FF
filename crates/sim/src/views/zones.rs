//! v_zones: the Zone page (M9 plan, spec 8 Financial zones hover, 9.2 `get_cycle`): each of the
//! 26 financial zones with its number, name, base and effective credit spread, investor
//! confidence (5.1.2), its exchange and headline index level at the last daily close (5.14),
//! its GDP share and its member countries. Rebuilt daily: confidence moves at 00:00 (5.1.2,
//! D146).

use super::{Cadence, ViewData, ViewInput};
use crate::world::{CountryId, Ordinal, ZoneId};

/// One financial zone (spec 3.2.1, 5.1.2).
#[derive(Debug, Clone, PartialEq)]
pub struct ZoneRow {
    pub id: ZoneId,
    /// Logan's zone number, 1 to 26.
    pub number: u32,
    pub key: String,
    pub name: String,
    pub exchange_code: String,
    pub exchange_name: String,
    pub index_name: String,
    /// The headline index at its last daily close; None with no listing (5.14).
    pub index_close: Option<f64>,
    /// Base and effective credit spread, fractions (spec 5.1.2).
    pub credit_spread_base: f64,
    pub credit_spread: f64,
    /// Investor confidence, −100 to +100 (spec 5.1.2).
    pub confidence: f64,
    /// The zone's share of world GDP (spec 5.1).
    pub gdp_share: f64,
    /// `intensity × g(t − lag)` plus any own shock, a yearly rate (spec 5.1).
    pub effect: f64,
    /// Member countries in country id order (spec 3.2.1).
    pub members: Vec<CountryId>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ZonesView {
    /// In zone id order.
    pub zones: Vec<ZoneRow>,
}

impl ZonesView {
    pub fn get(&self, id: ZoneId) -> Option<&ZoneRow> {
        self.zones.get(id.index())
    }
}

impl ViewData for ZonesView {
    const CADENCE: Cadence = Cadence::Daily;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let mut members: Vec<Vec<CountryId>> = vec![Vec::new(); w.zones.len()];
        for (id, c) in w.countries.iter() {
            members[c.zone.index()].push(id);
        }
        let zones = w
            .zones
            .iter()
            .zip(members)
            .map(|((id, z), members)| ZoneRow {
                id,
                number: z.number,
                key: z.key.clone(),
                name: z.name.clone(),
                exchange_code: z.exchange_code.clone(),
                exchange_name: z.exchange_name.clone(),
                index_name: z.headline_index.clone(),
                index_close: w.market.indices[id].prev_close,
                credit_spread_base: z.credit_spread_base,
                credit_spread: z.credit_spread,
                confidence: z.confidence,
                gdp_share: z.gdp_share,
                effect: z.effect,
                members,
            })
            .collect();
        ZonesView { zones }
    }
}
