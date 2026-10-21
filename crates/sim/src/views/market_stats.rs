//! v_market_stats: the engine's own market diagnostics for the headless soak (build-plan M5.8,
//! M10.1), never a screen: how far prices sit from fair value across the quoted stocks (true V
//! is never shown per company, spec 8, so only these aggregates leave the sim), the listed
//! count and the mean zone confidence. Rebuilt daily (D144).

use super::{Cadence, ViewData, ViewInput};
use crate::market::earnings::SurpriseTag;

/// The M5.8 tracking band: a quoted company-day tracks V when `|P ÷ V − 1| ≤ 30%` (D143).
pub const TRACKING_BAND: f64 = 0.30;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct MarketStatsView {
    /// Listed companies (on an exchange, quoted or delisted at a bankruptcy).
    pub listed: usize,
    /// Quoted companies (listed and not delisted).
    pub quoted: usize,
    /// The median of `|P ÷ V − 1|` over the quoted companies (0 with none).
    pub median_gap: f64,
    /// Quoted companies with `|P ÷ V − 1| ≤ 30%`.
    pub within_band: usize,
    /// The mean investor confidence over the 26 zones (spec 5.1.2).
    pub mean_confidence: f64,
    /// The last release's reports: companies not frozen with a quarter compared against its
    /// consensus (5.15), and how many were tagged Beat or Big beat, Miss or Big miss (the spec 10
    /// "30% to 60% of releases are beats" target, read by the headless soak).
    pub reports: usize,
    pub beats: usize,
    pub misses: usize,
}

/// `|P ÷ V − 1|` (D143); a V at or below 0 counts as an infinite gap.
pub fn gap(price: f64, value: f64) -> f64 {
    if value > 0.0 {
        (price / value - 1.0).abs()
    } else {
        f64::INFINITY
    }
}

impl ViewData for MarketStatsView {
    const CADENCE: Cadence = Cadence::Daily;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let mut gaps: Vec<f64> = w
            .market
            .stocks
            .rows()
            .iter()
            .filter(|s| s.quoted)
            .map(|s| gap(s.price, s.value))
            .collect();
        gaps.sort_by(f64::total_cmp);
        let n = gaps.len();
        let median_gap = match n {
            0 => 0.0,
            _ if n % 2 == 1 => gaps[n / 2],
            _ => 0.5 * (gaps[n / 2 - 1] + gaps[n / 2]),
        };
        let zones = w.zones.len().max(1) as f64;
        let (mut reports, mut beats, mut misses) = (0, 0, 0);
        for (id, c) in w.companies.iter() {
            if c.finance.status().is_frozen() || c.finance.quarters().is_empty() {
                continue;
            }
            reports += 1;
            match w.market.stocks[id].tags.surprise {
                Some(SurpriseTag::Beat | SurpriseTag::BigBeat) => beats += 1,
                Some(SurpriseTag::Miss | SurpriseTag::BigMiss) => misses += 1,
                None => {}
            }
        }
        MarketStatsView {
            listed: w
                .market
                .stocks
                .rows()
                .iter()
                .filter(|s| s.exchange.is_some())
                .count(),
            quoted: n,
            median_gap,
            within_band: gaps.iter().filter(|&&g| g <= TRACKING_BAND).count(),
            mean_confidence: w.zones.iter().map(|(_, z)| z.confidence).sum::<f64>() / zones,
            reports,
            beats,
            misses,
        }
    }
}
