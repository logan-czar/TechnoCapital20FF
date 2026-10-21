//! Spec 5.11 tax (10.5.5): each quarter `tax = max(0, pre-tax income − loss carryforward used) ×
//! corp_tax_rate` of the HQ country, losses carried forward without limit, accrued monthly and
//! paid at the quarter close (build-plan M4.3: unit tests for loss years and carryforward use).

mod finance_common;

use finance_common::data;
use sim::finance::tax::{QuarterTax, TaxBook, accrue_month, close_quarter, quarter_tax};

#[track_caller]
fn near(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-6, "{a} vs {b}");
}

fn rate(iso: &str) -> f64 {
    data()
        .country_economy
        .rows
        .iter()
        .find(|e| e.iso3 == iso)
        .unwrap()
        .corp_tax_rate
}

#[test]
fn profit_with_no_losses_pays_the_national_rate() {
    // Tax is national (5.1.2, C28): Chile 27%, Germany 29.9%, from country-economy.csv.
    let chl = rate("CHL");
    let deu = rate("DEU");
    assert_eq!((chl, deu), (0.27, 0.299));
    near(quarter_tax(100.0e6, 0.0, chl).tax, 27.0e6);
    near(quarter_tax(100.0e6, 0.0, deu).tax, 29.9e6);
    assert_eq!(quarter_tax(0.0, 0.0, chl).tax, 0.0);
}

#[test]
fn a_loss_year_then_carryforward_use() {
    // Rate 25%. A loss year (four quarters of −$10M) builds $40M of carryforward and pays no
    // tax; the next year's profits use it up before any tax is paid.
    let r = 0.25;
    let mut cf = 0.0;
    for _ in 0..4 {
        let q = quarter_tax(-10.0e6, cf, r);
        assert_eq!(q.tax, 0.0);
        assert_eq!(q.carryforward_used, 0.0);
        assert_eq!(q.carryforward_added, 10.0e6);
        cf = q.carryforward_after;
    }
    assert_eq!(cf, 40.0e6);
    // Q1 +$15M: all of it offset, no tax, $25M left.
    let q = quarter_tax(15.0e6, cf, r);
    assert_eq!(
        q,
        QuarterTax {
            pre_tax_income: 15.0e6,
            carryforward_used: 15.0e6,
            tax: 0.0,
            carryforward_added: 0.0,
            carryforward_after: 25.0e6,
        }
    );
    cf = q.carryforward_after;
    // Q2 +$35M: $25M used, tax on $10M = $2.5M, carryforward gone.
    let q = quarter_tax(35.0e6, cf, r);
    assert_eq!(q.carryforward_used, 25.0e6);
    assert_eq!(q.tax, 2.5e6);
    assert_eq!(q.carryforward_after, 0.0);
    // Q3 +$20M: full tax.
    assert_eq!(quarter_tax(20.0e6, 0.0, r).tax, 5.0e6);
}

#[test]
fn losses_carry_forward_without_limit() {
    // 5.11 (A): no expiry. Ten years of quarterly losses, then one big profit uses all of them.
    let r = 0.3;
    let mut cf = 0.0;
    for _ in 0..40 {
        cf = quarter_tax(-1.0e6, cf, r).carryforward_after;
    }
    assert_eq!(cf, 40.0e6);
    let q = quarter_tax(50.0e6, cf, r);
    assert_eq!(q.carryforward_used, 40.0e6);
    near(q.tax, 10.0e6 * r);
    // A loss adds to the carryforward and uses none of it.
    let q = quarter_tax(-5.0e6, 3.0e6, r);
    assert_eq!((q.carryforward_used, q.carryforward_after), (0.0, 8.0e6));
}

#[test]
fn accrued_monthly_paid_at_the_close() {
    // Three months of $10M at 30%: $3M accrued each month, $9M paid at the close.
    let r = 0.3;
    let mut book = TaxBook::default();
    let accruals: Vec<f64> = (0..3).map(|_| accrue_month(&mut book, 10.0e6, r)).collect();
    for a in &accruals {
        near(*a, 3.0e6);
    }
    near(book.accrued, 9.0e6);
    let q = close_quarter(&mut book, r);
    near(q.tax, 9.0e6);
    near(accruals.iter().sum::<f64>(), q.tax);
    assert_eq!(book, TaxBook::default(), "the quarter resets");
}

#[test]
fn accrual_reads_the_carryforward_and_reverses_on_a_loss_month() {
    let r = 0.3;
    // $15M of carryforward: months of $10M accrue 0, then $1.5M, then $3M (cumulative, D227).
    let mut book = TaxBook {
        carryforward: 15.0e6,
        ..TaxBook::default()
    };
    let a: Vec<f64> = (0..3).map(|_| accrue_month(&mut book, 10.0e6, r)).collect();
    near(a[0], 0.0);
    near(a[1], 1.5e6);
    near(a[2], 3.0e6);
    let q = close_quarter(&mut book, r);
    near(q.tax, 4.5e6);
    assert_eq!(book.carryforward, 0.0);
    // A loss month after a profit month reverses its accrual; the quarter's net profit is taxed
    // and creates no carryforward.
    let mut book = TaxBook::default();
    let a: Vec<f64> = [10.0e6, -10.0e6, 5.0e6]
        .iter()
        .map(|p| accrue_month(&mut book, *p, r))
        .collect();
    near(a[0], 3.0e6);
    near(a[1], -3.0e6);
    near(a[2], 1.5e6);
    let q = close_quarter(&mut book, r);
    near(q.tax, 1.5e6);
    assert_eq!(book.carryforward, 0.0);
    // A loss quarter adds its net loss at the close, not month by month.
    let mut book = TaxBook::default();
    for p in [-4.0e6, 1.0e6, -2.0e6] {
        assert_eq!(accrue_month(&mut book, p, r), 0.0);
    }
    let q = close_quarter(&mut book, r);
    assert_eq!((q.tax, q.carryforward_added), (0.0, 5.0e6));
    assert_eq!(book.carryforward, 5.0e6);
}
