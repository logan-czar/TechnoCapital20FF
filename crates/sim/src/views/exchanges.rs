//! v_exchanges: `list_exchanges()` and `get_exchange(code)` (spec 9.2; batches 152 and 154): the
//! 26 zone exchanges with their code, name, zone, hub city and hub province, headline index name
//! and level, listed company count and investor confidence (5.1.2), the constituents, and the
//! index's daily closes from 2020, 10 years kept (D540; design fix 462). Rebuilt daily (spec 9.4 has no row for it; the index closes and confidence move at 00:00,
//! D146); the live level each tick is in v_quotes.

use super::{Cadence, ViewData, ViewInput};
use crate::market::index::IndexHistory;
use crate::market::jobs::exchange_caps;
use crate::world::{CompanyId, Ordinal, ProvinceId, ZoneId};

/// One zone exchange (spec 9.2 `list_exchanges` row and `get_exchange` detail).
#[derive(Debug, Clone, PartialEq)]
pub struct ExchangeRow {
    pub zone: ZoneId,
    /// Logan's zone number, 1 to 26.
    pub zone_number: u32,
    pub zone_key: String,
    pub code: String,
    pub name: String,
    pub hub_city: String,
    pub hub_province: ProvinceId,
    pub index_name: String,
    /// The headline index level at this tick; `None` with no quoted company (spec 5.14).
    pub level: Option<f64>,
    /// The listed companies quoted now: those whose HQ country is in the zone (spec 5.14).
    pub listed_count: usize,
    /// Investor confidence, −100 to +100 (spec 5.1.2).
    pub confidence: f64,
    /// The index constituents (the quoted listed companies), in company id order.
    pub constituents: Vec<CompanyId>,
    /// The index's daily closes, oldest first: the load level on 1 January 2020, then each
    /// 00:00 close, 10 years kept (D540). Shares its chunks with the World (D148).
    pub closes: IndexHistory,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ExchangesView {
    /// In zone id order.
    pub exchanges: Vec<ExchangeRow>,
}

impl ExchangesView {
    /// `get_exchange(code)`.
    pub fn get(&self, code: &str) -> Option<&ExchangeRow> {
        self.exchanges.iter().find(|e| e.code == code)
    }

    /// The exchange of zone `zone` (one exchange a zone, spec 5.14).
    pub fn of_zone(&self, zone: ZoneId) -> Option<&ExchangeRow> {
        self.exchanges.get(zone.index())
    }
}

impl ViewData for ExchangesView {
    const CADENCE: Cadence = Cadence::Daily;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let caps = exchange_caps(w);
        let mut constituents: Vec<Vec<CompanyId>> = vec![Vec::new(); w.zones.len()];
        for (id, s) in w.market.stocks.iter() {
            if let (true, Some(z)) = (s.quoted, s.exchange) {
                constituents[z.index()].push(id);
            }
        }
        let exchanges = w
            .zones
            .iter()
            .zip(constituents)
            .map(|((z, zone), constituents)| ExchangeRow {
                zone: z,
                zone_number: zone.number,
                zone_key: zone.key.clone(),
                code: zone.exchange_code.clone(),
                name: zone.exchange_name.clone(),
                hub_city: zone.hub_city.clone(),
                hub_province: zone.hub_province,
                index_name: zone.headline_index.clone(),
                level: w.market.indices[z].level(caps[z.index()]),
                listed_count: constituents.len(),
                confidence: zone.confidence,
                constituents,
                closes: w.market.index_history[z].clone(),
            })
            .collect();
        ExchangesView { exchanges }
    }
}
