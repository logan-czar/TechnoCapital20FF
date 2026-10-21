//! Credit ratings (spec 5.12; detailed 3-markets-and-fx 3.6.2 to 3.6.4): the notch scale, the
//! implied rating from net debt ÷ EBITDA with its adjustments and the sovereign ceiling, the
//! starting rating at load (7.1) and the one or two notch move per review.
//!
//! Notches run from AAA (best) to CC (the worst rating 5.12 prices). AA to B carry plus and minus
//! notches (3.6.2); CCC and CC have none. The rating factor (credit line limit) and the corporate
//! spread are given per band; [`Rating::band`] maps a notch to its band (D220).

use serde::{Deserialize, Serialize};

use super::credit::line_rate;

/// A credit rating notch (spec 5.12, 3.6.2), best first: the derived order is "better is
/// smaller", so `Rating::Aaa < Rating::Cc`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Rating {
    Aaa,
    AaPlus,
    Aa,
    AaMinus,
    APlus,
    A,
    AMinus,
    BbbPlus,
    Bbb,
    BbbMinus,
    BbPlus,
    Bb,
    BbMinus,
    BPlus,
    B,
    BMinus,
    Ccc,
    Cc,
}

/// A rating band (spec 5.12, 3.6.2): the rows of the rating factor and spread tables.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Band {
    Aaa,
    Aa,
    A,
    Bbb,
    Bb,
    B,
    Ccc,
    Cc,
}

/// Where a notch sits in its band (spec 3.6.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Modifier {
    Plus,
    Flat,
    Minus,
}

impl Rating {
    /// Every notch, best first (spec 3.6.2 scale, AAA to CC).
    pub const ALL: [Rating; 18] = [
        Rating::Aaa,
        Rating::AaPlus,
        Rating::Aa,
        Rating::AaMinus,
        Rating::APlus,
        Rating::A,
        Rating::AMinus,
        Rating::BbbPlus,
        Rating::Bbb,
        Rating::BbbMinus,
        Rating::BbPlus,
        Rating::Bb,
        Rating::BbMinus,
        Rating::BPlus,
        Rating::B,
        Rating::BMinus,
        Rating::Ccc,
        Rating::Cc,
    ];
    /// The best notch.
    pub const BEST: Rating = Rating::Aaa;
    /// The worst notch the MVP uses: the implied table bottoms at CC and 5.12 prices no lower
    /// band (D220).
    pub const WORST: Rating = Rating::Cc;

    /// Position on the scale, 0 for AAA, one per notch worse.
    pub fn notch(self) -> i32 {
        self as i32
    }

    /// The rating at scale position `i`, clamped to AAA to CC.
    pub fn from_notch(i: i32) -> Rating {
        let last = Rating::ALL.len() as i32 - 1;
        Rating::ALL[i.clamp(0, last) as usize]
    }

    /// This rating moved `notches` better (positive) or worse (negative), clamped to the scale.
    pub fn shifted(self, notches: i32) -> Rating {
        Rating::from_notch(self.notch() - notches)
    }

    /// The band whose rating factor and spread this notch reads (D220): AA+, AA and AA- read AA,
    /// BB+ and BB- read BB, and so on.
    pub fn band(self) -> Band {
        use Rating::*;
        match self {
            Aaa => Band::Aaa,
            AaPlus | Aa | AaMinus => Band::Aa,
            APlus | A | AMinus => Band::A,
            BbbPlus | Bbb | BbbMinus => Band::Bbb,
            BbPlus | Bb | BbMinus => Band::Bb,
            BPlus | B | BMinus => Band::B,
            Ccc => Band::Ccc,
            Cc => Band::Cc,
        }
    }

    /// Plus, flat or minus within the band (spec 3.6.2).
    pub fn modifier(self) -> Modifier {
        use Rating::*;
        match self {
            AaPlus | APlus | BbbPlus | BbPlus | BPlus => Modifier::Plus,
            AaMinus | AMinus | BbbMinus | BbMinus | BMinus => Modifier::Minus,
            _ => Modifier::Flat,
        }
    }

    /// The agency label, as country-economy.csv writes it ("BB+").
    pub fn label(self) -> &'static str {
        use Rating::*;
        match self {
            Aaa => "AAA",
            AaPlus => "AA+",
            Aa => "AA",
            AaMinus => "AA-",
            APlus => "A+",
            A => "A",
            AMinus => "A-",
            BbbPlus => "BBB+",
            Bbb => "BBB",
            BbbMinus => "BBB-",
            BbPlus => "BB+",
            Bb => "BB",
            BbMinus => "BB-",
            BPlus => "B+",
            B => "B",
            BMinus => "B-",
            Ccc => "CCC",
            Cc => "CC",
        }
    }

    /// Parses a label ("A+", "CCC"); `None` for anything off the AAA to CC scale.
    pub fn parse(label: &str) -> Option<Rating> {
        Rating::ALL.iter().copied().find(|r| r.label() == label)
    }
}

impl std::fmt::Display for Rating {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.label())
    }
}

impl Band {
    /// The next better band, if any.
    fn better(self) -> Option<Band> {
        use Band::*;
        match self {
            Aaa => None,
            Aa => Some(Aaa),
            A => Some(Aa),
            Bbb => Some(A),
            Bb => Some(Bbb),
            B => Some(Bb),
            Ccc => Some(B),
            Cc => Some(Ccc),
        }
    }

    /// The next worse band, if any (CC is the last the MVP prices).
    fn worse(self) -> Option<Band> {
        use Band::*;
        match self {
            Aaa => Some(Aa),
            Aa => Some(A),
            A => Some(Bbb),
            Bbb => Some(Bb),
            Bb => Some(B),
            B => Some(Ccc),
            Ccc => Some(Cc),
            Cc => None,
        }
    }

    /// Credit line rating factor (spec 5.12, T): AAA 1.0, AA 0.9, A 0.8, BBB 0.65, BB 0.5,
    /// B 0.3, CCC and below 0.
    pub fn rating_factor(self) -> f64 {
        match self {
            Band::Aaa => RATING_FACTOR_AAA,
            Band::Aa => RATING_FACTOR_AA,
            Band::A => RATING_FACTOR_A,
            Band::Bbb => RATING_FACTOR_BBB,
            Band::Bb => RATING_FACTOR_BB,
            Band::B => RATING_FACTOR_B,
            Band::Ccc | Band::Cc => RATING_FACTOR_CCC_AND_BELOW,
        }
    }

    /// Corporate 5-year spread of the band, a fraction (spec 5.12, 3.6.2): AAA 0.40%, AA 0.60%,
    /// A 0.90%, BBB 1.50%, BB 2.80%, B 4.50%, CCC 9.00%, CC 16.00%.
    pub fn corporate_spread(self) -> f64 {
        match self {
            Band::Aaa => SPREAD_AAA,
            Band::Aa => SPREAD_AA,
            Band::A => SPREAD_A,
            Band::Bbb => SPREAD_BBB,
            Band::Bb => SPREAD_BB,
            Band::B => SPREAD_B,
            Band::Ccc => SPREAD_CCC,
            Band::Cc => SPREAD_CC,
        }
    }
}

/// Spec 5.12 rating factors (T).
pub const RATING_FACTOR_AAA: f64 = 1.0;
pub const RATING_FACTOR_AA: f64 = 0.9;
pub const RATING_FACTOR_A: f64 = 0.8;
pub const RATING_FACTOR_BBB: f64 = 0.65;
pub const RATING_FACTOR_BB: f64 = 0.5;
pub const RATING_FACTOR_B: f64 = 0.3;
pub const RATING_FACTOR_CCC_AND_BELOW: f64 = 0.0;

/// Spec 5.12 corporate spreads by band (3.6.2 5-year spreads), fractions.
pub const SPREAD_AAA: f64 = 0.0040;
pub const SPREAD_AA: f64 = 0.0060;
pub const SPREAD_A: f64 = 0.0090;
pub const SPREAD_BBB: f64 = 0.0150;
pub const SPREAD_BB: f64 = 0.0280;
pub const SPREAD_B: f64 = 0.0450;
pub const SPREAD_CCC: f64 = 0.0900;
pub const SPREAD_CC: f64 = 0.1600;
/// Spec 3.6.2: a plus notch is a third of the way toward the better band's spread, a minus a
/// third toward the worse one's (D220).
pub const NOTCH_SPREAD_SHARE: f64 = 1.0 / 3.0;

/// Rating factor of a notch: its band's (spec 5.12; D220).
pub fn rating_factor(rating: Rating) -> f64 {
    rating.band().rating_factor()
}

/// Corporate spread of a notch (spec 5.12, 3.6.2): the band's spread, a plus notch a third of
/// the way to the better band's and a minus a third to the worse band's (D220). BB+ is 2.80% −
/// (2.80% − 1.50%) ÷ 3 ≈ 2.37%; BB- is 2.80% + (4.50% − 2.80%) ÷ 3 ≈ 3.37%.
pub fn corporate_spread(rating: Rating) -> f64 {
    let band = rating.band();
    let s = band.corporate_spread();
    match rating.modifier() {
        Modifier::Flat => s,
        Modifier::Plus => match band.better() {
            Some(b) => s - (s - b.corporate_spread()) * NOTCH_SPREAD_SHARE,
            None => s,
        },
        Modifier::Minus => match band.worse() {
            Some(b) => s + (b.corporate_spread() - s) * NOTCH_SPREAD_SHARE,
            None => s,
        },
    }
}

/// Spec 5.12 implied rating from net debt ÷ EBITDA: the upper edge of each leverage band and its
/// starting rating. A ratio below the edge takes that rating (lower edges inclusive: 0.5 is AA,
/// 1.0 is A); the last band is closed (8.0 is CCC, "above 8" is CC) (D221).
pub const LEVERAGE_BANDS: [(f64, Rating); 8] = [
    (0.5, Rating::Aaa),
    (1.0, Rating::Aa),
    (2.0, Rating::A),
    (3.0, Rating::Bbb),
    (4.0, Rating::BbPlus),
    (5.0, Rating::BbMinus),
    (6.5, Rating::B),
    (8.0, Rating::Ccc),
];
/// Spec 5.12: above 8 or EBITDA negative.
pub const LEVERAGE_WORST: Rating = Rating::Cc;

/// Spec 5.12 adjustments (T), in notches (positive is better).
pub const COVER_HIGH_ABOVE: f64 = 10.0;
pub const COVER_HIGH_NOTCHES: i32 = 1;
pub const COVER_LOW_BELOW: f64 = 3.0;
pub const COVER_LOW_NOTCHES: i32 = -1;
pub const COVER_VERY_LOW_BELOW: f64 = 1.5;
pub const COVER_VERY_LOW_NOTCHES: i32 = -2;
pub const REVENUE_LARGE_ABOVE_USD: f64 = 20.0e9;
pub const REVENUE_LARGE_NOTCHES: i32 = 1;
pub const REVENUE_SMALL_BELOW_USD: f64 = 500.0e6;
pub const REVENUE_SMALL_NOTCHES: i32 = -1;
/// Spec 5.12 "utilities +1": the industries.csv ids it covers.
pub const UTILITY_INDUSTRIES: [&str; 1] = ["power_utilities"];
pub const UTILITY_NOTCHES: i32 = 1;
/// Spec 5.12 "mining and shipping -1": the industries.csv ids it covers.
pub const MINING_SHIPPING_INDUSTRIES: [&str; 2] = ["mining", "shipping"];
pub const MINING_SHIPPING_NOTCHES: i32 = -1;
/// Spec 5.12 ceiling: the home sovereign + 1 notch.
pub const CEILING_NOTCHES_ABOVE_SOVEREIGN: i32 = 1;
/// Spec 5.12 (3.6.4): the rating moves 1 notch per review toward implied, 2 if 3 or more away.
pub const REVIEW_STEP: i32 = 1;
pub const REVIEW_BIG_STEP: i32 = 2;
pub const REVIEW_BIG_GAP: i32 = 3;

/// The leverage rating of spec 5.12, before adjustments: from `net_debt ÷ ebitda` (EBITDA =
/// EBIT + depreciation, trailing 4 quarters). Edge cases (D221): EBITDA at or below 0 is CC
/// whatever the net debt (5.12 "EBITDA negative", with 0 counted as negative, since nothing
/// covers the debt); net debt at or below 0 with positive EBITDA (net cash) is AAA on purpose,
/// as the ratio is below 0.5, and is decided here explicitly rather than by the sign of the
/// division.
pub fn leverage_rating(net_debt: f64, ebitda: f64) -> Rating {
    if ebitda <= 0.0 || !ebitda.is_finite() {
        return LEVERAGE_WORST;
    }
    if net_debt <= 0.0 {
        return Rating::Aaa;
    }
    let ratio = net_debt / ebitda;
    let last = LEVERAGE_BANDS.len() - 1;
    for (i, &(edge, rating)) in LEVERAGE_BANDS.iter().enumerate() {
        if ratio < edge || (i == last && ratio <= edge) {
            return rating;
        }
    }
    LEVERAGE_WORST
}

/// Interest cover notches (spec 5.12; cover is EBITDA ÷ interest, 3.6.3): above 10 +1, below 3
/// -1, below 1.5 -2. With no interest (D222) the cover is unbounded: +1 when EBITDA is above 0,
/// and 0 when it is not (nothing to cover, and the CC leverage rating already applies).
pub fn cover_notches(ebitda: f64, interest: f64) -> i32 {
    if interest <= 0.0 {
        return if ebitda > 0.0 { COVER_HIGH_NOTCHES } else { 0 };
    }
    let cover = ebitda / interest;
    if cover > COVER_HIGH_ABOVE {
        COVER_HIGH_NOTCHES
    } else if cover < COVER_VERY_LOW_BELOW {
        COVER_VERY_LOW_NOTCHES
    } else if cover < COVER_LOW_BELOW {
        COVER_LOW_NOTCHES
    } else {
        0
    }
}

/// Revenue notches (spec 5.12): trailing revenue above $20B +1, below $500M -1.
pub fn size_notches(revenue: f64) -> i32 {
    if revenue > REVENUE_LARGE_ABOVE_USD {
        REVENUE_LARGE_NOTCHES
    } else if revenue < REVENUE_SMALL_BELOW_USD {
        REVENUE_SMALL_NOTCHES
    } else {
        0
    }
}

/// Sector notches (spec 5.12): utilities +1; mining and shipping -1. `industry_key` is the
/// industries.csv id.
pub fn sector_notches(industry_key: &str) -> i32 {
    if UTILITY_INDUSTRIES.contains(&industry_key) {
        UTILITY_NOTCHES
    } else if MINING_SHIPPING_INDUSTRIES.contains(&industry_key) {
        MINING_SHIPPING_NOTCHES
    } else {
        0
    }
}

/// The ceiling (spec 5.12): the HQ country's sovereign rating + 1 notch.
pub fn sovereign_ceiling(sovereign: Rating) -> Rating {
    sovereign.shifted(CEILING_NOTCHES_ABOVE_SOVEREIGN)
}

/// What the implied rating reads (spec 5.12). Trailing figures are the last 4 quarters.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RatingInputs<'a> {
    /// Credit line drawn less cash.
    pub net_debt: f64,
    /// EBIT + depreciation, trailing 4 quarters.
    pub ebitda: f64,
    /// Interest on the drawn line, trailing 4 quarters (not the undrawn fee, D222).
    pub interest: f64,
    /// Revenue, trailing 4 quarters.
    pub revenue: f64,
    /// industries.csv id of the company's industry.
    pub industry_key: &'a str,
    /// The HQ country's sovereign rating (country-economy.csv).
    pub sovereign: Rating,
}

/// The implied rating and how it was reached (for the ratings view, 9.2 F6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ImpliedRating {
    /// From net debt ÷ EBITDA alone.
    pub leverage: Rating,
    pub cover_notches: i32,
    pub size_notches: i32,
    pub sector_notches: i32,
    /// Leverage plus the adjustments, clamped to AAA to CC.
    pub adjusted: Rating,
    /// Sovereign + 1 notch.
    pub ceiling: Rating,
    /// The worse of `adjusted` and `ceiling`.
    pub implied: Rating,
}

/// The implied rating (spec 5.12, 3.6.3): the leverage rating, plus the adjustments summed and
/// then clamped to the scale (D221), capped at the sovereign ceiling.
pub fn implied_rating(i: &RatingInputs<'_>) -> ImpliedRating {
    let leverage = leverage_rating(i.net_debt, i.ebitda);
    let cover = cover_notches(i.ebitda, i.interest);
    let size = size_notches(i.revenue);
    let sector = sector_notches(i.industry_key);
    let adjusted = leverage.shifted(cover + size + sector);
    let ceiling = sovereign_ceiling(i.sovereign);
    ImpliedRating {
        leverage,
        cover_notches: cover,
        size_notches: size,
        sector_notches: sector,
        adjusted,
        ceiling,
        implied: adjusted.max(ceiling),
    }
}

/// What the starting rating reads (spec 7.1: implied from the starting run rate, no smoothing).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StartRatingInputs<'a> {
    pub cash: f64,
    pub line_drawn: f64,
    /// Run-rate EBIT + depreciation, a year.
    pub ebitda: f64,
    /// Run-rate revenue, a year.
    pub revenue: f64,
    pub industry_key: &'a str,
    pub sovereign: Rating,
    /// World base rate (3.1).
    pub base_rate: f64,
    /// The company's home spread (5.12, [`super::credit::home_spread`]).
    pub home_spread: f64,
}

/// The starting rating (spec 7.1, 5.12). The interest cover needs a year of interest, whose rate
/// needs the rating; at load the interest is the drawn line at the rate of the leverage rating
/// (before adjustments), one pass, no iteration (D222).
pub fn starting_rating(i: &StartRatingInputs<'_>) -> ImpliedRating {
    let net_debt = i.line_drawn - i.cash;
    let leverage = leverage_rating(net_debt, i.ebitda);
    let interest = i.line_drawn * line_rate(i.base_rate, i.home_spread, leverage);
    implied_rating(&RatingInputs {
        net_debt,
        ebitda: i.ebitda,
        interest,
        revenue: i.revenue,
        industry_key: i.industry_key,
        sovereign: i.sovereign,
    })
}

/// One review's move toward the implied rating (spec 5.12, 3.6.4): 1 notch, or 2 when 3 or more
/// notches away; never past the implied rating.
pub fn review_move(current: Rating, implied: Rating) -> Rating {
    let gap = implied.notch() - current.notch();
    if gap == 0 {
        return current;
    }
    let step = if gap.abs() >= REVIEW_BIG_GAP {
        REVIEW_BIG_STEP
    } else {
        REVIEW_STEP
    };
    Rating::from_notch(current.notch() + gap.signum() * step.min(gap.abs()))
}

/// Notches between two ratings, positive when `to` is better than `from` (for the 2+ notch
/// headline and confidence rules, 5.1.2, 5.18).
pub fn notches_between(from: Rating, to: Rating) -> i32 {
    from.notch() - to.notch()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_round_trip() {
        for r in Rating::ALL {
            assert_eq!(Rating::parse(r.label()), Some(r));
        }
        assert_eq!(Rating::parse("C"), None);
    }

    #[test]
    fn shifting_clamps() {
        assert_eq!(Rating::Aaa.shifted(1), Rating::Aaa);
        assert_eq!(Rating::Cc.shifted(-1), Rating::Cc);
        assert_eq!(Rating::Bbb.shifted(1), Rating::BbbPlus);
    }
}
