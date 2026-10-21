//! v_world_totals: the engine's own world-wide book and operations totals for the headless soak
//! (build-plan M10.1), never a screen (D427). Like v_market_stats (D144), it holds aggregates
//! only: once private companies' figures are estimate bands in every company view (D420), the
//! soak's spec 10 columns that summed true figures (the line drawn, the profitable share, the
//! median productivity) read them here, computed exactly as the soak did from v_company_detail
//! and v_units, so its CSVs stay byte for byte the same. Rebuilt monthly and at the plan lock
//! (spec 9.4), the cadence of the views it replaces.

use super::{Cadence, ViewData, ViewInput};
use crate::world::Ordinal;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct WorldTotalsView {
    /// Every company in the table, Removed ones included.
    pub companies: usize,
    /// Credit lines drawn, USD, summed over every company in id order (spec 5.12).
    pub line_drawn_usd: f64,
    /// Companies whose units' last-month EBIT (after R&D, spec 5.5) sums above 0.
    pub profitable_companies: usize,
    /// The median productivity of the units with gross assets above 0 of companies not frozen,
    /// the mean of the middle two for an even count; 0 with none (spec 10, D321).
    pub median_productivity: f64,
}

/// The median of sorted values (0 when empty).
fn median(sorted: &[f64]) -> f64 {
    let n = sorted.len();
    match n {
        0 => 0.0,
        _ if n % 2 == 1 => sorted[n / 2],
        _ => 0.5 * (sorted[n / 2 - 1] + sorted[n / 2]),
    }
}

impl ViewData for WorldTotalsView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let companies = w.companies.rows();
        let line_drawn_usd: f64 = companies.iter().map(|c| c.finance.line.drawn).sum();
        let mut ebit = vec![0.0; companies.len()];
        for u in w.units.rows() {
            ebit[u.company.index()] += u.ebit_m();
        }
        let mut prod: Vec<f64> = w
            .units
            .rows()
            .iter()
            .filter(|u| {
                u.gross_assets > 0.0 && !companies[u.company.index()].finance.status().is_frozen()
            })
            .map(|u| u.productivity)
            .collect();
        prod.sort_by(f64::total_cmp);
        WorldTotalsView {
            companies: companies.len(),
            line_drawn_usd,
            profitable_companies: ebit.iter().filter(|&&e| e > 0.0).count(),
            median_productivity: median(&prod),
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn median_of_odd_and_even_counts() {
        assert_eq!(median(&[]), 0.0);
        assert_eq!(median(&[3.0]), 3.0);
        assert_eq!(median(&[1.0, 2.0, 9.0]), 2.0);
        assert_eq!(median(&[1.0, 2.0, 4.0, 9.0]), 3.0);
    }
}
