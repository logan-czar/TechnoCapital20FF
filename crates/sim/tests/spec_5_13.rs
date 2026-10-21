//! Spec 5.13 fair value (10.0.8, 3.3.1; C8) and the 7.1 engine value at load: build-plan M5.1
//! (profit and loss cases worked by hand from the spec) and M5.2 (company-start.csv
//! `engine_value_usd` for all 651, read from the CSVs so a regenerated file is checked as is).

mod finance_common;

use finance_common::{data, facts, finance_start};
use sim::finance::credit::home_spread;
use sim::market::engine_value::{
    EngineValueInputs, MIN_ENGINE_VALUE_USD, engine_value_at_load, load_net_income,
};
use sim::market::fair_value::{
    FairValueBasis, FairValueInputs, book_floor_share, clamp_growth, cycle_factor, e_norm,
    exchange_factor, fair_value, growth_factor, per_share, rate_factor, revenue_growth,
    shown_value, y10,
};
use sim::people::management::confidence_factor;
use sim::world::PhaseLabel;

#[track_caller]
fn near(a: f64, b: f64) {
    assert!(
        (a - b).abs() <= 1e-9 * a.abs().max(b.abs()).max(1.0),
        "{a} vs {b}"
    );
}

const M: f64 = 1e6;

/// A profitable company: book $100M, TTM NI $10M, g 10% against a sector lt of 5%, M_sector 17,
/// home spread 50 bps (y10 4%), Boom, management score 50, exchange confidence +50.
fn profit() -> FairValueInputs {
    FairValueInputs {
        basis: FairValueBasis::at_release(Some(10.0 * M), 0.10, 0.05),
        book_equity: 100.0 * M,
        sector_multiple: 17.0,
        home_spread: 0.005,
        label: PhaseLabel::Boom,
        company_confidence: confidence_factor(50.0),
        listing_confidence: Some(50.0),
        book_floor_share: book_floor_share("oil"),
        shares_out: 10_000_000,
    }
}

#[test]
fn the_factors_match_the_spec() {
    // Step 1: E_norm = 0.6 × 10 + 0.4 × 10 × 1.1 = 10.4.
    near(e_norm(10.0 * M, 0.10), 10.4 * M);
    // g clamps to −30% to +60%.
    near(clamp_growth(1.0), 0.60);
    near(clamp_growth(-0.9), -0.30);
    near(e_norm(10.0 * M, 2.0), 0.6 * 10.0 * M + 0.4 * 10.0 * M * 1.6);
    // Step 2: G = clamp(1 + 2.5 × (g − g_sector), 0.5, 2.5).
    near(growth_factor(0.10, 0.05), 1.125);
    near(growth_factor(0.0, 0.05), 0.875);
    near(growth_factor(5.0, 0.05), 1.0 + 2.5 * (0.60 - 0.05));
    near(growth_factor(-0.5, 0.25), 0.5);
    // R = clamp(9% ÷ (y10 + 5%), 0.4, 1.6), y10 = 3.5% + home spread (C24). 3.3.1: "At y10 =
    // 4% R is 1.0; at 12% (emerging market) R is 0.53".
    near(y10(0.005), 0.04);
    near(rate_factor(0.005), 1.0);
    assert!((rate_factor(0.085) - 0.53).abs() < 0.005);
    near(rate_factor(0.0), 0.09 / 0.085);
    near(rate_factor(0.30), 0.4);
    // X = 1 + 0.10 × confidence ÷ 100 (0.9 to 1.1); 1.0 for a private company.
    near(exchange_factor(Some(50.0)), 1.05);
    near(exchange_factor(Some(-100.0)), 0.9);
    near(exchange_factor(Some(100.0)), 1.1);
    near(exchange_factor(None), 1.0);
    // Cycle factor Boom 1.2, Normal 1.0, Glut 0.85, Bust 0.7; floor 0.9 for Real estate.
    near(cycle_factor(PhaseLabel::Boom), 1.2);
    near(cycle_factor(PhaseLabel::Normal), 1.0);
    near(cycle_factor(PhaseLabel::Glut), 0.85);
    near(cycle_factor(PhaseLabel::Bust), 0.7);
    near(book_floor_share("real_estate"), 0.9);
    near(book_floor_share("oil"), 0.6);
    // 5.7: confidence factor 0.8 + score ÷ 250.
    near(confidence_factor(50.0), 1.0);
}

#[test]
fn profit_case() {
    // (0.3 × 100 + 0.7 × 10.4 × (17 × 1.125 × 1.0) × 1.2 × 1.0) × 1.05
    //   = (30 + 167.076) × 1.05 = $206.9298M.
    let fv = fair_value(&profit());
    near(fv, 206.9298 * M);
    near(per_share(fv, 10_000_000), 20.69298);
    // A Normal cycle, a weaker board (score 25: 0.9) and no exchange confidence:
    // 30 + 0.7 × 10.4 × 19.125 × 1.0 × 0.9 = 30 + 125.3070 = $155.3070M.
    let fv = fair_value(&FairValueInputs {
        label: PhaseLabel::Normal,
        company_confidence: confidence_factor(25.0),
        listing_confidence: Some(0.0),
        ..profit()
    });
    near(fv, 155.307 * M);
    // Private: X 1.0, shown at 0.7 × fair value (10.5.4).
    let private = fair_value(&FairValueInputs {
        listing_confidence: None,
        ..profit()
    });
    near(private, 197.076 * M);
    near(shown_value(private, false), 0.7 * 197.076 * M);
    near(shown_value(private, true), 197.076 * M);
}

#[test]
fn a_thin_profit_falls_to_the_book_floor() {
    // NI $1M: 30 + 0.7 × 1.04 × 19.125 × 1.2 × 1.0 = 46.71, × 1.05 = 49.05: below 0.6 × 100.
    let i = FairValueInputs {
        basis: FairValueBasis::at_release(Some(1.0 * M), 0.10, 0.05),
        ..profit()
    };
    near(fair_value(&i), 60.0 * M);
    // Real estate floors at 0.9 × book.
    let re = FairValueInputs {
        book_floor_share: book_floor_share("real_estate"),
        ..i
    };
    near(fair_value(&re), 90.0 * M);
}

#[test]
fn loss_case() {
    // Step 4: E_norm ≤ 0 values at book × cycle × X: 50 × 0.7 × 0.9 = $31.5M, above 0.6 × 50.
    let loss = FairValueInputs {
        basis: FairValueBasis::at_release(Some(-5.0 * M), 0.10, 0.05),
        book_equity: 50.0 * M,
        label: PhaseLabel::Bust,
        listing_confidence: Some(-100.0),
        ..profit()
    };
    near(fair_value(&loss), 31.5 * M);
    // Glut: 50 × 0.85 × 0.9 = $38.25M; the company's own confidence is not in the loss path.
    near(
        fair_value(&FairValueInputs {
            label: PhaseLabel::Glut,
            company_confidence: 0.8,
            ..loss
        }),
        38.25 * M,
    );
    // Real estate: the 0.9 × 50 = $45M floor wins.
    near(
        fair_value(&FairValueInputs {
            book_floor_share: book_floor_share("real_estate"),
            ..loss
        }),
        45.0 * M,
    );
    // E_norm exactly 0 is a loss-maker: book × 1.2 × 1.05 = $63M.
    near(
        fair_value(&FairValueInputs {
            basis: FairValueBasis::at_release(Some(0.0), 0.10, 0.05),
            book_equity: 50.0 * M,
            ..profit()
        }),
        63.0 * M,
    );
}

#[test]
fn edge_cases_newborn_negative_book_and_penny_floor() {
    // D253: no statements yet (trailing_four is None) values at book × cycle × X.
    let newborn = FairValueInputs {
        basis: FairValueBasis::at_release(None, 0.0, 0.05),
        book_equity: 20.0 * M,
        ..profit()
    };
    near(fair_value(&newborn), 20.0 * M * 1.2 * 1.05);
    // D242: a negative book has no book floor; the loss path is negative, so $0.01 a share
    // ($0.01 × 10M shares = $100,000) holds.
    let broke = FairValueInputs {
        basis: FairValueBasis::at_release(Some(-3.0 * M), 0.0, 0.05),
        book_equity: -20.0 * M,
        ..profit()
    };
    near(fair_value(&broke), 100_000.0);
    near(per_share(fair_value(&broke), 10_000_000), 0.01);
    // A profitable company with a negative book: (0.3 × −20 + 0.7 × 10.4 × 19.125 × 1.2) × 1.05
    // = (−6 + 167.076) × 1.05 = $169.1298M.
    near(
        fair_value(&FairValueInputs {
            book_equity: -20.0 * M,
            ..profit()
        }),
        169.1298 * M,
    );
    assert_eq!(per_share(1.0, 0), 0.0);
}

#[test]
fn revenue_growth_over_four_quarters() {
    // D254: TTM over the prior TTM with 8+ quarters; matched quarters a year apart with 5 to 7;
    // 0 with 4 or fewer (no year-ago figure).
    near(
        revenue_growth(&[10.0, 10.0, 10.0, 10.0, 11.0, 11.0, 11.0, 11.0]),
        0.10,
    );
    near(
        revenue_growth(&[1.0, 10.0, 10.0, 10.0, 10.0, 11.0, 11.0, 11.0, 13.0]),
        46.0 / 40.0 - 1.0,
    );
    near(revenue_growth(&[10.0, 10.0, 10.0, 10.0, 12.0]), 0.20);
    near(
        revenue_growth(&[10.0, 20.0, 10.0, 10.0, 12.0, 18.0]),
        30.0 / 30.0 - 1.0,
    );
    near(revenue_growth(&[10.0; 4]), 0.0);
    near(revenue_growth(&[]), 0.0);
    // No revenue a year ago: +60% (the clamp top) if there is revenue now, else 0.
    near(revenue_growth(&[0.0, 0.0, 0.0, 0.0, 5.0]), 0.60);
    near(revenue_growth(&[0.0; 5]), 0.0);
}

/// The 7.1 inputs of one starting company, from the CSVs: book equity (company-start.csv,
/// D238), the run-rate EBIT (validate.py's starting margin × companies.csv revenue:
/// finance-start.csv's margin, independent of the engine), the HQ tax, M_sector, the industry's
/// trend_growth as lt (D1), the D223 home spread from the zone's base spread (D235), X from
/// confidence_start for listed companies, and the industry's 5.13 book floor.
fn load_inputs(f: &finance_common::CompanyFacts<'_>, ebit: f64) -> EngineValueInputs {
    EngineValueInputs {
        book_equity: f.start.book_equity_usd,
        run_rate_ebit: ebit,
        tax_rate: f.economy.corp_tax_rate,
        sector_multiple: f.industry.earnings_multiple,
        g_sector: f.industry.trend_growth,
        home_spread: home_spread(f.zone_spread(), f.sovereign_spread()),
        listing_confidence: f.company.public.then_some(f.zone.confidence_start),
        book_floor_share: book_floor_share(&f.industry.id),
    }
}

#[test]
fn engine_value_reproduces_company_start_for_all_651() {
    // Spec 7.1 (batch 161): the 5.13 fair value at load (D244).
    let d = data();
    let fixture = finance_start();
    assert_eq!(fixture.len(), 651);
    assert_eq!(d.company_start.rows.len(), 651);
    for row in &fixture {
        let f = facts(&d, row.id());
        let margin = row.num("ebit") / row.num("revenue");
        let ebit = margin * f.company.revenue_usd_m * 1e6;
        let ev = engine_value_at_load(&load_inputs(&f, ebit));
        let want = f.start.engine_value_usd;
        // company-start.csv rounds to whole dollars.
        assert!(
            (ev - want).abs() <= 1.0,
            "{}: engine value {ev} vs company-start.csv {want}",
            row.id()
        );
        assert!(ev >= MIN_ENGINE_VALUE_USD);
        // shares = engine value ÷ open_price, so P = V = open_price at load (7.1).
        assert!(
            (f.start.shares - want / f.start.open_price).abs() <= 0.6,
            "{}",
            row.id()
        );
    }
}

#[test]
fn engine_value_worked_cases() {
    // Spec 7.1: "Arrowhead (ARDR) $9 × about 6.67M shares = $60M (its 0.6 × book floor)".
    let d = data();
    let f = facts(&d, "CO-0001");
    assert_eq!(f.start.engine_value_usd, 60.0 * M);
    assert_eq!(f.start.open_price, 9.0);
    let row = finance_start()
        .into_iter()
        .find(|r| r.id() == "CO-0001")
        .unwrap();
    near(
        engine_value_at_load(&load_inputs(&f, row.num("ebit"))),
        0.6 * f.start.book_equity_usd,
    );
    let base = EngineValueInputs {
        book_equity: 100.0 * M,
        run_rate_ebit: 20.0 * M,
        tax_rate: 0.25,
        sector_multiple: 17.0,
        g_sector: 0.10,
        home_spread: 0.005,
        listing_confidence: Some(0.0),
        book_floor_share: book_floor_share("oil"),
    };
    // NI = 20 × 0.75 = 15; G at g 0 = 1 − 2.5 × 0.10 = 0.75; R 1.0 (y10 4%):
    // 0.3 × 100 + 0.7 × 15 × 17 × 0.75 = 30 + 133.875 = $163.875M.
    near(load_net_income(20.0 * M, 0.25), 15.0 * M);
    near(engine_value_at_load(&base), 163.875 * M);
    // lt 0.25 hits the G floor 0.5: 30 + 0.7 × 15 × 17 × 0.5 = $119.25M.
    near(
        engine_value_at_load(&EngineValueInputs {
            g_sector: 0.25,
            ..base
        }),
        119.25 * M,
    );
    // A thin earner in Real estate sits on the 0.9 floor: NI $0.75M gives 30 + 6.69 < 90.
    near(
        engine_value_at_load(&EngineValueInputs {
            run_rate_ebit: 1.0 * M,
            book_floor_share: book_floor_share("real_estate"),
            ..base
        }),
        90.0 * M,
    );
    // The loss path and the barebones three (revenue 0, so NI 0): book × X.
    near(load_net_income(-2.0 * M, 0.25), -2.0 * M);
    near(
        engine_value_at_load(&EngineValueInputs {
            book_equity: 1.0 * M,
            run_rate_ebit: 0.0,
            listing_confidence: None,
            ..base
        }),
        1.0 * M,
    );
    // The $100,000 floor.
    near(
        engine_value_at_load(&EngineValueInputs {
            book_equity: 10_000.0,
            run_rate_ebit: -1.0,
            listing_confidence: None,
            ..base
        }),
        MIN_ENGINE_VALUE_USD,
    );
}
