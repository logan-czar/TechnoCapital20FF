//! The market state on the World (spec 3.10, 3.5 valuation rows; build-plan M5): per company its
//! price, fair value, release basis, buzz, consensus, the bar being built and its daily bars;
//! per zone exchange its headline index (the zone's investor confidence sits on
//! [`crate::world::Zone`]). Every field derives serde, so saves and the state hash cover it.
//! The jobs in [`super::jobs`] move it.

use serde::{Deserialize, Serialize};

use super::daily::{BarBuilder, DailyBar};
use super::earnings::ResultTags;
use super::fair_value::FairValueBasis;
use super::index::{ExchangeIndex, IndexHistory};
use crate::time::Date;
use crate::world::log::ChunkLog;
use crate::world::{CompanyId, Table, ZoneId};

/// The market tables (spec 3.10, 5.14).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MarketState {
    /// One row per company, in company id order (private companies have a value, no price).
    pub stocks: Table<CompanyId, Stock>,
    /// One headline index per zone exchange, in zone id order (spec 5.14, batch 152).
    pub indices: Table<ZoneId, ExchangeIndex>,
    /// Each headline index's daily closes, 10 years kept, in zone id order (D540).
    pub index_history: Table<ZoneId, IndexHistory>,
}

/// One company's valuation and quote (spec 3.10, 3.5).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Stock {
    /// The listing exchange: its HQ country's zone (spec 5.14); `None` while private.
    pub exchange: Option<ZoneId>,
    /// Quoted on its exchange: listed and not delisted at a bankruptcy (spec 5.12 step 2,
    /// D126). Only quoted stocks move hourly, count in their index and get bars.
    pub quoted: bool,
    /// The day it listed in play (5.20), `None` for the starting listed companies and while
    /// private; with the price it listed at (spec 3.5 `listed_date`, `ipo_price`).
    pub listed_on: Option<Date>,
    pub ipo_price: f64,
    /// P, USD a share (spec 5.14); $0.00 once delisted and 0 for a private company.
    pub price: f64,
    /// The share count the index weights P by: the company's shares_out (3.10), kept here so
    /// the hourly caps read only this table, and synced at each daily close with the divisor
    /// rescaled (D147).
    pub shares: u64,
    /// Total fair value (spec 5.13), USD; 0 for a Bankrupt or Removed company (D138).
    pub fair_value: f64,
    /// V = fair value ÷ shares_out (spec 5.13 step 6).
    pub value: f64,
    /// What the last full recalculation fixed (D243): E_norm and G.
    pub basis: FairValueBasis,
    /// −100 to +100 (spec 3.10), earnings only, decays 25% a day.
    pub buzz: f64,
    /// Next quarter's net income consensus, set at the plan lock (spec 3.10, 5.16).
    pub consensus_ni: f64,
    /// The engine's no-rolls projection the consensus was drawn around (5.16, D141); the recap
    /// reads it for the expected results (D280).
    pub projection_ni: f64,
    /// The surprise of the quarter just closed, set at the close (4.4 result tags) and spent at
    /// the 01:00 price move (5.15); `None` otherwise.
    pub pending_surprise: Option<f64>,
    /// The last report's surprise and result tags (spec 5.15, 21.3.2), for headlines.
    pub last_surprise: f64,
    pub tags: ResultTags,
    /// The estimated fair value error e (spec 3.14.2, D140): EFV = V × (1 + e), drawn at each
    /// release; 0 until the first.
    pub efv_error: f64,
    /// The price at the last daily close (00:00), for the day's change (spec 9.2 `get_quotes`).
    pub prev_close: f64,
    /// The bar being built today (spec 4.2 step 1; D248).
    pub bar: BarBuilder,
    /// Daily bars, oldest first, 10 years kept (spec 3.10, 4.5 step 2).
    pub bars: BarHistory,
}

impl Stock {
    /// A company's row before the load values are set (spec 7.1): `price` is company-start.csv
    /// `open_price` for a listed company, 0 for a private one.
    pub fn at_load(exchange: Option<ZoneId>, price: f64, shares: u64) -> Stock {
        Stock {
            shares,
            exchange,
            quoted: exchange.is_some(),
            listed_on: None,
            ipo_price: if exchange.is_some() { price } else { 0.0 },
            price,
            fair_value: 0.0,
            value: 0.0,
            basis: FairValueBasis {
                e_norm: None,
                growth_factor: 1.0,
            },
            buzz: 0.0,
            consensus_ni: 0.0,
            projection_ni: 0.0,
            pending_surprise: None,
            last_surprise: 0.0,
            tags: ResultTags::default(),
            efv_error: 0.0,
            prev_close: price,
            bar: BarBuilder::start(Date::ymd(crate::time::calendar::EPOCH_YEAR, 1, 1), price),
            bars: BarHistory::default(),
        }
    }

    /// The listed company's market cap at P (spec 5.14); 0 unless quoted.
    pub fn cap(&self) -> f64 {
        if self.quoted {
            super::index::market_cap(self.price, self.shares)
        } else {
            0.0
        }
    }
}

/// A company's daily bars (spec 3.10 `bars`), oldest first, in one chunk per calendar month.
///
/// The price history view shares them: the closed months sit behind one `Arc` and the open
/// month behind another ([`ChunkLog`]), so the daily view rebuild copies two pointers per
/// company and a new bar copies at most the open month, never ten years of bars (D139, D148).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct BarHistory {
    log: ChunkLog<DailyBar>,
}

impl BarHistory {
    /// Appends a closed bar (bars arrive in date order); a bar in a new month opens a chunk.
    pub fn push(&mut self, bar: DailyBar) {
        self.log
            .push(bar, |last, b| last.date.month_of() == b.date.month_of());
    }

    /// Every bar, oldest first.
    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &DailyBar> {
        self.log.iter()
    }

    /// The number of bars kept.
    pub fn len(&self) -> usize {
        self.log.len()
    }

    pub fn is_empty(&self) -> bool {
        self.log.is_empty()
    }

    /// The newest bar.
    pub fn last(&self) -> Option<&DailyBar> {
        self.log.last()
    }

    /// The bars dated `from` to `to` inclusive, oldest first (spec 9.2 `get_price_history`).
    pub fn range(&self, from: Date, to: Date) -> impl Iterator<Item = &DailyBar> {
        self.iter().filter(move |b| b.date >= from && b.date <= to)
    }

    /// Drops every bar dated before `first_kept` (spec 4.5 step 2: 10 years kept). Month chunks
    /// wholly before it go; a chunk that straddles it is trimmed.
    pub fn drop_before(&mut self, first_kept: Date) {
        self.log.drop_while(|b| b.date < first_kept);
    }

    /// True if `other` shares these bars' chunks (a view's copy, D148).
    pub fn shares_with(&self, other: &BarHistory) -> bool {
        self.log.shares_with(&other.log)
    }
}
