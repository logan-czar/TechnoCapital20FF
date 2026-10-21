//! v_quotes: `get_quotes(filter)` (spec 9.2; Pdoomberg F2 Quotes, spec 8): every quoted stock's
//! last price, day change, volume (0, nobody trades in the MVP), estimated fair value with its
//! ±15% band (3.14.2) and buzz; plus every exchange's headline index level now. Rebuilt every
//! tick (spec 9.4), and after a control (Omniscient shows the true V).
//!
//! The rows are plain numbers keyed by company id and read only the market table, so a rebuild
//! every tick allocates two `Vec`s and no strings; the ticker, name, industry and rating of an
//! id are in v_company_row (and v_company_detail, v_ratings), which change at most monthly or
//! quarterly (D144).

use super::{Cadence, ViewData, ViewInput};
use crate::market::jobs::{EFV_ERROR_WIDTH, exchange_caps};
use crate::world::{CompanyId, Ordinal, ZoneId};

/// One quote (spec 9.2 `get_quotes`: ticker, last, day change, volume 0, EFV, rating; the ticker
/// and rating by id from v_company_row).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct QuoteRow {
    pub id: CompanyId,
    /// The listing exchange (its HQ country's zone, 5.14).
    pub exchange: ZoneId,
    /// P now, USD a share (5.14).
    pub last: f64,
    /// The price at the last daily close (00:00).
    pub prev_close: f64,
    /// `last − prev_close`, and as a share of prev_close.
    pub change: f64,
    pub change_pct: f64,
    /// Always 0 in the MVP (spec 5.14 "no order flow").
    pub volume: u64,
    /// The estimated fair value a share, `V × (1 + e)` (3.14.2), and its band, EFV ± 15%.
    pub efv: f64,
    pub efv_low: f64,
    pub efv_high: f64,
    /// Buzz, −100 to +100 (3.10).
    pub buzz: f64,
    /// `last × shares`, the index weight (5.14).
    pub market_cap: f64,
    /// The true V a share: only in Omniscient (spec 8 "true V is never shown").
    pub value: Option<f64>,
}

/// One exchange's headline index now (spec 5.14).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct IndexQuote {
    pub zone: ZoneId,
    /// `None` while the exchange has no quoted company (spec 5.14 "shows no level").
    pub level: Option<f64>,
    /// The level at the last daily close.
    pub prev_close: Option<f64>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct QuotesView {
    /// Every quoted stock, in company id order.
    pub rows: Vec<QuoteRow>,
    /// Every zone exchange, in zone id order.
    pub indices: Vec<IndexQuote>,
}

impl QuotesView {
    /// The quote of company `id`, if it is quoted.
    pub fn get(&self, id: CompanyId) -> Option<&QuoteRow> {
        self.rows
            .binary_search_by_key(&id, |r| r.id)
            .ok()
            .map(|i| &self.rows[i])
    }

    /// The quotes on one exchange (spec 9.2 `get_quotes(filter)` by exchange).
    pub fn on_exchange(&self, zone: ZoneId) -> impl Iterator<Item = &QuoteRow> {
        self.rows.iter().filter(move |r| r.exchange == zone)
    }

    /// The index quote of one exchange.
    pub fn index(&self, zone: ZoneId) -> Option<&IndexQuote> {
        self.indices.get(zone.index())
    }
}

impl ViewData for QuotesView {
    const CADENCE: Cadence = Cadence::EveryTick;
    const ON_CONTROL: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let mut v = QuotesView::default();
        v.rebuild(input);
        v
    }

    /// Refills the two `Vec`s in place, so the rebuild every tick allocates nothing once they
    /// have grown (D402).
    fn rebuild(&mut self, input: &ViewInput<'_>) {
        let w = input.world;
        let omniscient = input.controls.omniscient;
        self.rows.clear();
        self.rows
            .extend(w.market.stocks.iter().filter_map(|(id, s)| {
                let exchange = s.exchange.filter(|_| s.quoted)?;
                let efv = s.value * (1.0 + s.efv_error);
                let change = s.price - s.prev_close;
                Some(QuoteRow {
                    id,
                    exchange,
                    last: s.price,
                    prev_close: s.prev_close,
                    change,
                    change_pct: if s.prev_close > 0.0 {
                        change / s.prev_close
                    } else {
                        0.0
                    },
                    volume: 0,
                    efv,
                    efv_low: efv * (1.0 - EFV_ERROR_WIDTH),
                    efv_high: efv * (1.0 + EFV_ERROR_WIDTH),
                    buzz: s.buzz,
                    market_cap: s.cap(),
                    value: omniscient.then_some(s.value),
                })
            }));
        let caps = exchange_caps(w);
        self.indices.clear();
        self.indices
            .extend(w.market.indices.iter().map(|(z, i)| IndexQuote {
                zone: z,
                level: i.level(caps[z.index()]),
                prev_close: i.prev_close,
            }));
    }
}
