//! Spec 5.12 implied rating (3.6.3), adjustments, sovereign ceiling and review moves (3.6.4);
//! build-plan M4.5: starting ratings match the run rate for all 651 companies.

mod finance_common;

use finance_common::{BASE_RATE, data, facts, finance_start};
use sim::finance::credit::home_spread;
use sim::finance::rating::{
    ImpliedRating, Rating, RatingInputs, StartRatingInputs, corporate_spread, cover_notches,
    implied_rating, leverage_rating, notches_between, rating_factor, review_move, sector_notches,
    size_notches, sovereign_ceiling, starting_rating,
};

use Rating::*;

/// Net debt for a ratio `x` on EBITDA of $100M.
fn lev(x: f64) -> Rating {
    leverage_rating(x * 100.0e6, 100.0e6)
}

#[test]
fn leverage_table() {
    // 5.12: below 0.5 AAA, 0.5 to 1 AA, 1 to 2 A, 2 to 3 BBB, 3 to 4 BB+, 4 to 5 BB-, 5 to 6.5 B,
    // 6.5 to 8 CCC, above 8 CC. Lower edges inclusive, 8 itself CCC (D221).
    let cases = [
        (0.0, Aaa),
        (0.49, Aaa),
        (0.5, Aa),
        (0.99, Aa),
        (1.0, A),
        (1.99, A),
        (2.0, Bbb),
        (2.99, Bbb),
        (3.0, BbPlus),
        (3.99, BbPlus),
        (4.0, BbMinus),
        (4.99, BbMinus),
        (5.0, B),
        (6.49, B),
        (6.5, Ccc),
        (8.0, Ccc),
        (8.01, Cc),
        (40.0, Cc),
    ];
    for (x, r) in cases {
        assert_eq!(lev(x), r, "ratio {x}");
    }
}

#[test]
fn leverage_edge_cases() {
    // EBITDA negative is CC (5.12); 0 counts as negative (D221).
    assert_eq!(leverage_rating(50.0e6, -1.0e6), Cc);
    assert_eq!(leverage_rating(50.0e6, 0.0), Cc);
    // Net cash with positive EBITDA is AAA, on purpose (D221).
    assert_eq!(leverage_rating(-50.0e6, 10.0e6), Aaa);
    assert_eq!(leverage_rating(0.0, 10.0e6), Aaa);
    // Net cash with negative EBITDA divides to a positive ratio below 0.5 (-50 ÷ -1,000 = 0.05),
    // but must not read as AAA by accident: it is CC.
    assert_eq!(leverage_rating(-50.0e6, -1000.0e6), Cc);
    assert_eq!(leverage_rating(-50.0e6, 0.0), Cc);
}

#[test]
fn adjustment_notches() {
    // Interest cover (EBITDA ÷ interest, 3.6.3): above 10 +1, below 3 -1, below 1.5 -2.
    assert_eq!(cover_notches(110.0, 10.0), 1);
    assert_eq!(cover_notches(100.0, 10.0), 0, "10 is not above 10");
    assert_eq!(cover_notches(30.0, 10.0), 0);
    assert_eq!(cover_notches(29.0, 10.0), -1);
    assert_eq!(cover_notches(15.0, 10.0), -1, "1.5 is not below 1.5");
    assert_eq!(cover_notches(14.9, 10.0), -2);
    assert_eq!(cover_notches(-5.0, 10.0), -2);
    // No interest (D222): unbounded cover with positive EBITDA, nothing to cover otherwise.
    assert_eq!(cover_notches(1.0, 0.0), 1);
    assert_eq!(cover_notches(0.0, 0.0), 0);
    assert_eq!(cover_notches(-1.0, 0.0), 0);
    // Revenue: above $20B +1, below $500M -1.
    assert_eq!(size_notches(20.1e9), 1);
    assert_eq!(size_notches(20.0e9), 0);
    assert_eq!(size_notches(500.0e6), 0);
    assert_eq!(size_notches(499.9e6), -1);
    // Sector: utilities +1; mining and shipping -1; the ids exist in industries.csv.
    assert_eq!(sector_notches("power_utilities"), 1);
    assert_eq!(sector_notches("mining"), -1);
    assert_eq!(sector_notches("shipping"), -1);
    assert_eq!(sector_notches("oil"), 0);
    assert_eq!(sector_notches("renewables"), 0);
    let d = data();
    for key in ["power_utilities", "mining", "shipping"] {
        assert!(d.industries.rows.iter().any(|i| i.id == key), "{key}");
    }
}

#[test]
fn ceiling_is_sovereign_plus_one_notch() {
    assert_eq!(sovereign_ceiling(Aaa), Aaa);
    assert_eq!(sovereign_ceiling(APlus), AaMinus, "Chile A+");
    assert_eq!(sovereign_ceiling(BbbMinus), Bbb, "India BBB-");
    assert_eq!(sovereign_ceiling(Ccc), BMinus, "Greece CCC");
    assert_eq!(sovereign_ceiling(Cc), Ccc, "North Korea CC");
    // Every sovereign rating in country-economy.csv is on the AAA to CC scale.
    for e in &data().country_economy.rows {
        assert!(Rating::parse(&e.sovereign_rating).is_some(), "{}", e.iso3);
    }
}

#[test]
fn implied_rating_sums_adjustments_then_caps() {
    // A utility with leverage 1.5 (A), cover 20 (+1), revenue $25B (+1), utility (+1): A + 3
    // notches (A+, AA-, AA) = AA, then capped at a BBB sovereign + 1 = BBB+.
    let i = RatingInputs {
        net_debt: 1.5e9,
        ebitda: 1.0e9,
        interest: 50.0e6,
        revenue: 25.0e9,
        industry_key: "power_utilities",
        sovereign: Bbb,
    };
    assert_eq!(
        implied_rating(&i),
        ImpliedRating {
            leverage: A,
            cover_notches: 1,
            size_notches: 1,
            sector_notches: 1,
            adjusted: Aa,
            ceiling: BbbPlus,
            implied: BbbPlus,
        }
    );
    // Under an AAA sovereign it keeps AA.
    assert_eq!(
        implied_rating(&RatingInputs {
            sovereign: Aaa,
            ..i
        })
        .implied,
        Aa
    );
    // A small miner at leverage 7 (CCC), cover 1 (-2), revenue $100M (-1), mining (-1): the
    // sum of -4 clamps at CC, the bottom of the scale.
    let miner = implied_rating(&RatingInputs {
        net_debt: 7.0e6,
        ebitda: 1.0e6,
        interest: 1.0e6,
        revenue: 100.0e6,
        industry_key: "mining",
        sovereign: Aaa,
    });
    assert_eq!((miner.leverage, miner.implied), (Ccc, Cc));
    // Notches add before clamping: AAA leverage with +1 and -1 stays AAA.
    let r = implied_rating(&RatingInputs {
        net_debt: 0.0,
        ebitda: 1.0e9,
        interest: 0.0,
        revenue: 100.0e6,
        industry_key: "oil",
        sovereign: Aaa,
    });
    assert_eq!((r.cover_notches, r.size_notches, r.implied), (1, -1, Aaa));
}

#[test]
fn review_moves_one_or_two_notches() {
    // 5.12 (3.6.4): 1 notch per review toward implied, 2 if 3 or more away.
    assert_eq!(review_move(Bbb, Bbb), Bbb);
    assert_eq!(review_move(Bbb, BbbMinus), BbbMinus, "1 away");
    assert_eq!(review_move(Bbb, BbPlus), BbbMinus, "2 away: 1 notch");
    assert_eq!(review_move(Bbb, Bb), BbPlus, "3 away: 2 notches");
    assert_eq!(review_move(Bbb, APlus), AMinus, "3 up: 2 notches");
    assert_eq!(review_move(Aaa, Cc), Aa);
    assert_eq!(review_move(Cc, Aaa), BMinus);
    assert_eq!(review_move(A, AMinus), AMinus);
    assert_eq!(notches_between(Bbb, BbPlus), -2);
    assert_eq!(notches_between(Bbb, A), 3);
    // Walks to the implied rating and stops there.
    let mut r = Aaa;
    let mut steps = 0;
    while r != BMinus {
        r = review_move(r, BMinus);
        steps += 1;
    }
    // AAA to B- is 15 notches: seven moves of 2 (gaps 15 to 3) and one of 1.
    assert_eq!(steps, 8);
}

#[test]
fn rating_factor_and_spread_by_band() {
    // 5.12 rating factors (T).
    for (r, f) in [
        (Aaa, 1.0),
        (Aa, 0.9),
        (AaPlus, 0.9),
        (AaMinus, 0.9),
        (A, 0.8),
        (Bbb, 0.65),
        (Bb, 0.5),
        (BbPlus, 0.5),
        (BbMinus, 0.5),
        (B, 0.3),
        (Ccc, 0.0),
        (Cc, 0.0),
    ] {
        assert_eq!(rating_factor(r), f, "{r}");
    }
    // 5.12 (3.6.2 5-year spreads) at the flat notches.
    for (r, s) in [
        (Aaa, 0.0040),
        (Aa, 0.0060),
        (A, 0.0090),
        (Bbb, 0.0150),
        (Bb, 0.0280),
        (B, 0.0450),
        (Ccc, 0.0900),
        (Cc, 0.1600),
    ] {
        assert_eq!(corporate_spread(r), s, "{r}");
    }
    // 3.6.2: a plus notch a third of the way to the better band, a minus a third to the worse
    // (D220).
    let third = |a: f64, b: f64| a + (b - a) / 3.0;
    let near = |a: f64, b: f64| (a - b).abs() < 1e-15;
    assert!(near(corporate_spread(BbPlus), third(0.0280, 0.0150)));
    assert!(near(corporate_spread(BbMinus), third(0.0280, 0.0450)));
    assert!(near(corporate_spread(AaPlus), third(0.0060, 0.0040)));
    assert!(near(corporate_spread(BMinus), third(0.0450, 0.0900)));
    // Spreads never get better going down the scale.
    for w in Rating::ALL.windows(2) {
        assert!(corporate_spread(w[0]) < corporate_spread(w[1]), "{:?}", w);
    }
}

#[test]
fn starting_ratings_match_the_run_rate_for_all_651() {
    // 7.1: implied rating from the starting run rate, no smoothing. Cash, line, revenue, industry
    // and sovereign come from the CSVs; run-rate EBIT and depreciation from the independent
    // Python export (export_finance_fixtures.py), which also computed the expected rating.
    let d = data();
    let rows = finance_start();
    assert_eq!(rows.len(), 651);
    assert_eq!(d.companies.rows.len(), 651);
    let mut by_rating = std::collections::BTreeMap::<Rating, u32>::new();
    for row in &rows {
        let f = facts(&d, row.id());
        let ebitda = row.num("ebit") + row.num("depreciation");
        let home = home_spread(f.zone_spread(), f.sovereign_spread());
        assert_eq!(
            (home * 10_000.0).round(),
            row.num("home_spread_bps"),
            "{} home spread",
            row.id()
        );
        let r = starting_rating(&StartRatingInputs {
            cash: f.start.cash_usd,
            line_drawn: f.start.credit_drawn_usd,
            ebitda,
            revenue: row.num("revenue"),
            industry_key: &f.industry.id,
            sovereign: f.sovereign(),
            base_rate: BASE_RATE,
            home_spread: home,
        });
        assert_eq!(
            r.leverage,
            row.rating("leverage_rating"),
            "{} leverage",
            row.id()
        );
        assert_eq!(r.implied, row.rating("start_rating"), "{} start", row.id());
        assert!(
            r.implied >= sovereign_ceiling(f.sovereign()),
            "{}",
            row.id()
        );
        *by_rating.entry(r.implied).or_default() += 1;
    }
    assert_eq!(by_rating.values().sum::<u32>(), 651);
}

#[test]
fn a_chilean_miner_is_capped_at_aa_minus() {
    // Andes Cobre (CO-0179, Mining, Chile A+): net cash, so AAA leverage; the ceiling is A+ + 1
    // = AA-.
    let d = data();
    let f = facts(&d, "CO-0179");
    assert_eq!(f.company.hq_country, "CHL");
    assert_eq!(f.sovereign(), APlus);
    assert!(f.start.cash_usd > f.start.credit_drawn_usd);
    let r = starting_rating(&StartRatingInputs {
        cash: f.start.cash_usd,
        line_drawn: f.start.credit_drawn_usd,
        ebitda: 0.07 * 4390.0e6,
        revenue: 4390.0e6,
        industry_key: &f.industry.id,
        sovereign: f.sovereign(),
        base_rate: BASE_RATE,
        home_spread: 0.0312,
    });
    assert_eq!(
        (r.leverage, r.sector_notches, r.implied),
        (Aaa, -1, AaMinus)
    );
}
