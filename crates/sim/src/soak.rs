//! The engine's own true totals for the headless soak (build-plan M10.1; D427). Never a view:
//! once a private company's figures are estimate bands in every view (D420), and the totals of
//! an industry with one or two of them too (D432), the soak's spec 10 columns that read true
//! figures get them here, computed exactly as the soak computed them from the views before
//! (same order, same sums), so its CSVs stay byte for byte the same. `Sim::soak_stats` serves
//! it behind the `soak-stats` feature, which only the headless runner enables; the game reads
//! only `SimViews` (spec 9).

use crate::views::industry_rows::companies_by_revenue;
use crate::world::{Ordinal, World};

/// One industry's true figures the soak reads.
#[derive(Debug, Clone, PartialEq)]
pub struct SoakIndustry {
    /// Last month's revenue of the named units, summed biggest first (as v_industry_row did).
    pub named_revenue_m: f64,
    pub fringe_revenue_m: f64,
    pub supply_ratio: f64,
    pub market_factor: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SoakStats {
    /// Credit lines drawn, USD, summed over every company in id order (spec 5.12).
    pub line_drawn_usd: f64,
    /// Companies whose units' last-month EBIT (after R&D, spec 5.5) sums above 0.
    pub profitable_companies: usize,
    /// The mean productivity over every unit (spec 5.6).
    pub mean_productivity: f64,
    /// The median productivity of the units with gross assets above 0 of companies not frozen,
    /// the mean of the middle two for an even count; 0 with none (spec 10, D321).
    pub median_productivity: f64,
    /// Data held plus unstructured over all companies, TB (spec 5.9).
    pub data_tb: f64,
    /// In industry id order.
    pub industries: Vec<SoakIndustry>,
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

/// The soak's totals at the world's clock.
pub fn soak_stats(w: &World) -> SoakStats {
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
    let units = w.units.rows();
    let mean_productivity =
        units.iter().map(|u| u.productivity).sum::<f64>() / units.len().max(1) as f64;
    // Per company, held plus unstructured over its industries, then summed (as TechRow did).
    let data_tb: f64 = companies
        .iter()
        .map(|c| {
            c.data
                .iter()
                .map(|d| d.book.held + d.book.unstructured_tb())
                .sum::<f64>()
        })
        .sum();
    let ranked = companies_by_revenue(w);
    let industries = w
        .industries
        .iter()
        .map(|(id, ind)| SoakIndustry {
            named_revenue_m: ranked[id.index()].iter().map(|(_, r)| r).sum(),
            fringe_revenue_m: ind.fringe_revenue_m,
            supply_ratio: ind.supply_ratio,
            market_factor: ind.market_factor,
        })
        .collect();
    SoakStats {
        line_drawn_usd,
        profitable_companies: ebit.iter().filter(|&&e| e > 0.0).count(),
        mean_productivity,
        median_productivity: median(&prod),
        data_tb,
        industries,
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
