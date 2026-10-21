//! v_price_bars: `get_price_history(id, resolution, range)` (spec 9.2; Pdoomberg F3 Chart, spec
//! 8): the daily bars of every company that has any (listed now, or delisted with its history
//! kept), 10 years at most (4.5 step 2). Rebuilt daily (spec 9.4).
//!
//! Each history shares its month chunks with the World (D139), so a daily rebuild copies a few
//! pointers per company, not ten years of bars.

use super::{Cadence, ViewData, ViewInput};
use crate::market::daily::DailyBar;
use crate::market::state::BarHistory;
use crate::time::Date;
use crate::world::CompanyId;

/// The bar resolution of a price history query (spec 9.2; 3-markets 3.13.1 Chart: daily bars
/// up to a year, weekly bars up to 10 years).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Resolution {
    Daily,
    /// Monday-to-Sunday weeks, dated by their first bar.
    Weekly,
    /// Calendar months, dated by their first bar.
    Monthly,
}

/// One company's bars.
#[derive(Debug, Clone, PartialEq)]
pub struct PriceHistory {
    pub id: CompanyId,
    pub bars: BarHistory,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct PriceBarsView {
    /// Every company with bars, in company id order.
    pub companies: Vec<PriceHistory>,
}

impl PriceBarsView {
    /// The bars of company `id` from `from` to `to` inclusive at `resolution` (spec 9.2
    /// `get_price_history`); empty for a company with none. A weekly or monthly bar opens at its
    /// first daily bar's open, closes at its last's close and spans their high and low.
    pub fn get_price_history(
        &self,
        id: CompanyId,
        resolution: Resolution,
        from: Date,
        to: Date,
    ) -> Vec<DailyBar> {
        let Ok(i) = self.companies.binary_search_by_key(&id, |h| h.id) else {
            return Vec::new();
        };
        let bars = self.companies[i].bars.range(from, to);
        let key = |d: Date| -> i64 {
            match resolution {
                Resolution::Daily => d.days_since_epoch(),
                Resolution::Weekly => d.days_since_epoch() - d.weekday().index() as i64,
                Resolution::Monthly => i64::from(d.year) * 12 + i64::from(d.month),
            }
        };
        let mut out: Vec<DailyBar> = Vec::new();
        let mut last_key = None;
        for b in bars {
            let k = key(b.date);
            match out.last_mut() {
                Some(agg) if last_key == Some(k) => {
                    agg.high = agg.high.max(b.high);
                    agg.low = agg.low.min(b.low);
                    agg.close = b.close;
                }
                _ => {
                    out.push(*b);
                    last_key = Some(k);
                }
            }
        }
        out
    }
}

impl ViewData for PriceBarsView {
    const CADENCE: Cadence = Cadence::Daily;

    fn build(input: &ViewInput<'_>) -> Self {
        let companies = input
            .world
            .market
            .stocks
            .iter()
            .filter(|(_, s)| !s.bars.is_empty())
            .map(|(id, s)| PriceHistory {
                id,
                bars: s.bars.clone(),
            })
            .collect();
        PriceBarsView { companies }
    }
}
