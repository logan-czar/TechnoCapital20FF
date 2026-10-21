//! M2.9: asset decay and growth plan purchases and sales (spec 5.10). Done when $50M of assets
//! decays $400k a year.

mod common;

use common::data;
use common::economy::world_at_load;
use sim::economy::assets::{RAMP_MONTHS, apply_asset_month, d_eff, decay_usd, sale_factor};
use sim::rng::NoNoise;
use sim::world::{BusinessUnit, IndustryParams, PhaseLabel};

fn unit_and_params(gross: f64, growth: f64) -> (BusinessUnit, IndustryParams) {
    let w = world_at_load(&data(), &mut NoNoise);
    let mut u = w.units.iter().next().unwrap().1.clone();
    u.gross_assets = gross;
    u.asset_book = 0.5 * gross;
    u.ramping.clear();
    u.growth_plan = growth;
    let p = w.industries[u.industry].params.clone();
    (u, p)
}

#[test]
fn fifty_million_decays_400k_a_year() {
    let (_, p) = unit_and_params(50e6, 0.0);
    assert_eq!(decay_usd(50e6, &p), 400_000.0);
    assert!((d_eff(50e6, &p) - 0.008).abs() < 1e-15);
    assert_eq!(decay_usd(10e6, &p), 0.0, "nothing at $10M or less");
    assert_eq!(decay_usd(1e5, &p), 0.0);

    // g = 0 holds the base flat and buys back the decay: $400k a year at $50M.
    let (mut u, p) = unit_and_params(50e6, 0.0);
    let mut bought = 0.0;
    for _ in 0..12 {
        let m = apply_asset_month(&mut u, &p, PhaseLabel::Normal);
        assert!((m.purchases - m.decay).abs() < 1e-9);
        assert_eq!(m.ramping_added, 0.0, "replacement does not ramp");
        bought += m.purchases;
    }
    assert!((u.gross_assets - 50e6).abs() < 1e-6);
    assert!((bought - 400_000.0).abs() < 1e-6);
    assert!(u.ramping.is_empty());

    // g = −d_eff buys and sells nothing: the base shrinks by decay alone (1% a year above $10M).
    let (mut u, p) = unit_and_params(50e6, 0.0);
    let mut lost = 0.0;
    for _ in 0..12 {
        u.growth_plan = -d_eff(u.gross_assets, &p);
        let m = apply_asset_month(&mut u, &p, PhaseLabel::Normal);
        assert!(m.purchases.abs() < 1e-6 && m.sold.abs() < 1e-6);
        lost += m.decay;
    }
    assert!((lost - 400_000.0).abs() < 2_000.0, "{lost}");
    assert!((50e6 - u.gross_assets - lost).abs() < 1e-6);
    // Book falls by the depreciation, which equals the decay.
    assert!((25e6 - u.asset_book - lost).abs() < 1e-6);
}

#[test]
fn growth_ramps_for_six_months() {
    let (mut u, p) = unit_and_params(50e6, 0.12);
    let m = apply_asset_month(&mut u, &p, PhaseLabel::Normal);
    // Purchases = gross × (d_eff + g) ÷ 12; only the growth part ramps.
    assert!((m.purchases - 50e6 * (0.008 + 0.12) / 12.0).abs() < 1e-6);
    assert!((m.ramping_added - 50e6 * 0.12 / 12.0).abs() < 1e-6);
    assert_eq!(u.ramping.len(), 1);
    assert_eq!(u.ramping[0].months_left, RAMP_MONTHS);
    assert!((u.assets_eff() - (u.gross_assets - 0.2 * u.ramping[0].amount)).abs() < 1e-6);
    u.growth_plan = 0.0;
    for k in 1..=RAMP_MONTHS {
        apply_asset_month(&mut u, &p, PhaseLabel::Normal);
        assert_eq!(
            u.ramping.len(),
            usize::from(k < RAMP_MONTHS),
            "after {k} more months"
        );
    }
    assert_eq!(u.assets_eff(), u.gross_assets);
}

#[test]
fn sales_at_the_sale_factor() {
    for (label, factor) in [
        (PhaseLabel::Boom, 1.00),
        (PhaseLabel::Normal, 0.85),
        (PhaseLabel::Glut, 0.70),
        (PhaseLabel::Bust, 0.60),
    ] {
        assert_eq!(sale_factor(label), factor);
        let (mut u, p) = unit_and_params(50e6, -0.15);
        let m = apply_asset_month(&mut u, &p, label);
        // Sell gross × |d_eff + g| ÷ 12 of capacity; the same share of the book; cash = book sold
        // × sale factor; the difference is the gain or loss.
        let sold = 50e6 * (0.15 - 0.008) / 12.0;
        assert!((m.sold - sold).abs() < 1e-6);
        let after_decay = 50e6 - m.decay;
        let book_after_decay = 25e6 - m.depreciation;
        assert!((m.book_sold - book_after_decay * sold / after_decay).abs() < 1e-6);
        assert!((m.proceeds - m.book_sold * factor).abs() < 1e-6);
        assert!((m.gain - (factor - 1.0) * m.book_sold).abs() < 1e-6);
        assert!((u.gross_assets - (after_decay - sold)).abs() < 1e-6);
        assert_eq!(
            (u.sale_proceeds_m, u.sale_gain_m, u.capex_m),
            (m.proceeds, m.gain, 0.0)
        );
    }
}
