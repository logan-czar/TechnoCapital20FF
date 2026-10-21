//! Spec 5.10 asset sales (10.0.7): capacity sold at cost, the same share of the book, cash
//! `book sold × sale factor` (Boom 1.00, Normal 0.85, Glut 0.70, Bust 0.60), the difference a
//! gain or loss in pre-tax income (build-plan M4.6: unit tests per phase label).

use sim::finance::sales::{
    AssetSale, REMOVAL_SALE_FACTOR, SalePhase, sale_factor, sell_all, sell_capacity, sell_for_cash,
};

#[track_caller]
fn near(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-6, "{a} vs {b}");
}

#[test]
fn sale_factor_per_phase_label() {
    assert_eq!(sale_factor(SalePhase::Boom), 1.00);
    assert_eq!(sale_factor(SalePhase::Normal), 0.85);
    assert_eq!(sale_factor(SalePhase::Glut), 0.70);
    assert_eq!(sale_factor(SalePhase::Bust), 0.60);
    // 5.12 step 3: the removal sale is at the Bust factor.
    assert_eq!(REMOVAL_SALE_FACTOR, 0.60);
}

#[test]
fn ten_percent_of_a_unit_in_each_phase() {
    // Gross $100M at cost, book $60M; sell $10M of capacity: the book sold is the same 10%,
    // $6M; cash is $6M × factor; the gain is cash − book.
    let cases = [
        (SalePhase::Boom, 6.0e6, 0.0),
        (SalePhase::Normal, 5.1e6, -0.9e6),
        (SalePhase::Glut, 4.2e6, -1.8e6),
        (SalePhase::Bust, 3.6e6, -2.4e6),
    ];
    for (phase, cash, gain) in cases {
        let s = sell_capacity(100.0e6, 60.0e6, 10.0e6, sale_factor(phase));
        near(s.capacity_sold, 10.0e6);
        near(s.book_sold, 6.0e6);
        near(s.proceeds, cash);
        near(s.gain, gain);
        near(s.share, 0.1);
        assert!(
            s.gain <= 0.0,
            "{phase:?}: a sale at or under book is never a gain"
        );
    }
}

#[test]
fn growth_plan_sale_of_a_shrinking_unit() {
    // 5.10: g below −d_eff sells gross × |d_eff + g| ÷ 12 a month. $50M of assets decays $400k
    // a year (d_eff 0.8%); at g −15% the month sells 50 × 0.142 ÷ 12 ≈ $0.5917M of capacity.
    let gross = 50.0e6;
    let d_eff = 0.4e6 / gross;
    let g: f64 = -0.15;
    let capacity = gross * (d_eff + g).abs() / 12.0;
    near(capacity, 591_666.666_666_7);
    let s = sell_capacity(gross, 25.0e6, capacity, sale_factor(SalePhase::Normal));
    near(s.book_sold, capacity / 2.0);
    near(s.proceeds, capacity / 2.0 * 0.85);
    near(s.gain, -capacity / 2.0 * 0.15);
}

#[test]
fn forced_sale_raises_just_the_cash_needed() {
    // 5.12 step 1: sell at the sale factor until cash reaches 0. $3M needed at Normal from a
    // $60M book: $3M ÷ 0.85 of book, the same share of capacity.
    let s = sell_for_cash(100.0e6, 60.0e6, 3.0e6, sale_factor(SalePhase::Normal));
    near(s.proceeds, 3.0e6);
    near(s.book_sold, 3.0e6 / 0.85);
    near(s.capacity_sold, 100.0e6 * (3.0e6 / 0.85) / 60.0e6);
    near(s.gain, 3.0e6 - 3.0e6 / 0.85);
    // Not enough: everything sells, at the Bust factor $36M.
    let s = sell_for_cash(100.0e6, 60.0e6, 100.0e6, sale_factor(SalePhase::Bust));
    assert_eq!(s.capacity_sold, 100.0e6);
    assert_eq!(s.book_sold, 60.0e6);
    near(s.proceeds, 36.0e6);
    assert_eq!(s.share, 1.0);
    // Nothing needed, or no book to sell (D225): nothing sells.
    assert_eq!(
        sell_for_cash(100.0e6, 60.0e6, 0.0, 0.85),
        AssetSale::default()
    );
    assert_eq!(
        sell_for_cash(100.0e6, 0.0, 5.0e6, 0.85),
        AssetSale::default()
    );
}

#[test]
fn caps_and_sell_all() {
    // Capacity is capped at what the unit has.
    let s = sell_capacity(10.0e6, 4.0e6, 25.0e6, 1.0);
    assert_eq!(
        (s.capacity_sold, s.book_sold, s.share),
        (10.0e6, 4.0e6, 1.0)
    );
    assert_eq!(sell_capacity(0.0, 0.0, 1.0e6, 1.0), AssetSale::default());
    // The removal sale (5.12 step 3) sells the whole unit at the Bust factor.
    let s = sell_all(80.0e6, 30.0e6, REMOVAL_SALE_FACTOR);
    assert_eq!((s.capacity_sold, s.book_sold), (80.0e6, 30.0e6));
    near(s.proceeds, 18.0e6);
    near(s.gain, -12.0e6);
}
