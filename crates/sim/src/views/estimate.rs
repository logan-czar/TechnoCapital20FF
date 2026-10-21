//! Estimate bands: what the observer sees of a figure that is not published (spec 1 Information,
//! replaced by Logan's 2026-10-21 ruling, D420; design fix 420).
//!
//! Spec 1 has private companies' figures show "?". Logan ruled instead that every financial
//! figure of a private company, and of a new listing until its first release after listing
//! (spec 5.20.1 Listing step 4), is shown as a **band**: a range of about ±25% around a noisy
//! estimate, re-drawn at each release. The views build the band, so the true value never
//! reaches the UI for those companies: a [`Figure`] holds either the exact published value or a
//! [`Band`], never both. Omniscient (debug builds only, spec 1) serves the exact value instead.
//!
//! **The noise draws from no sim RNG stream.** It is a hash of (seed, company, period, field)
//! (D421), so building the views never moves a stream (`rng.rs`) and every soak figure and
//! state hash is the same whether the views are built or not.
//!
//! The estimate is `truth + e × scale` with `scale = max(|truth|, floor)` and `|e|` between
//! [`ESTIMATE_ERROR_MIN`] and [`ESTIMATE_ERROR_MAX`] (either sign); the band is the estimate
//! ± [`ESTIMATE_BAND_HALF_WIDTH`] × `max(|estimate|, floor)`. Since the half-width (at least
//! 0.2125 × scale) is always wider than the error (at most 0.15 × scale), the band always holds
//! the truth strictly inside it: neither endpoint and never the estimate equals the true value
//! (D422). A band of a small figure (below the floor, a line never drawn say) can reach below 0.

use crate::finance::statements::{Period, Statement};
use crate::time::quarter::release_tick;
use crate::time::{DateTime, Quarter};
use crate::world::{CompanyId, Ordinal, World};

/// The smallest error of an estimate, a share of the figure (T, D422): never 0, so the
/// estimate is never the true value.
pub const ESTIMATE_ERROR_MIN: f64 = 0.02;
/// The largest error of an estimate, a share of the figure (T, D422): the ±15% of the listed
/// companies' EFV error (D140), so an observer's guess at a private figure is as good as the
/// market's guess at a listed company's value.
pub const ESTIMATE_ERROR_MAX: f64 = 0.15;
/// The band's half-width around the estimate, a share of the estimate (T): Logan's "about
/// ±25%" (2026-10-21, D420).
pub const ESTIMATE_BAND_HALF_WIDTH: f64 = 0.25;
/// The scale under which a money figure's error and band stop shrinking, USD (T, D422): a
/// figure of 0 (a line never drawn) still gets a band about $0.5M wide, not a band of zero
/// width that would show the truth.
pub const ESTIMATE_FLOOR_USD: f64 = 1.0e6;
/// The same floor for a per-share figure, USD a share (T, D422).
pub const ESTIMATE_FLOOR_PER_SHARE_USD: f64 = 0.01;
/// The salt of the estimate hash (D421), so its numbers share nothing with any other use of
/// the seed. Changing it re-draws every estimate (views only: no save or hash moves).
pub const ESTIMATE_HASH_SALT: u64 = 0x7C20_FFE5_71A7_E000;

/// An estimate with its band (D420): `low < truth < high` always holds for the hidden truth,
/// and `estimate` is never the truth.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Band {
    /// The observer's noisy estimate: the band's centre.
    pub estimate: f64,
    pub low: f64,
    pub high: f64,
}

/// A figure as a screen shows it: exact when published (or in Omniscient), else a band.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Figure {
    Exact(f64),
    Band(Band),
}

impl Figure {
    /// The exact value, if published.
    pub fn exact(self) -> Option<f64> {
        match self {
            Figure::Exact(x) => Some(x),
            Figure::Band(_) => None,
        }
    }

    /// The band, if not published.
    pub fn band(self) -> Option<Band> {
        match self {
            Figure::Exact(_) => None,
            Figure::Band(b) => Some(b),
        }
    }

    /// The value to sort, sum or chart by: the exact value or the estimate (never the hidden
    /// truth, so sorting a column cannot leak it).
    pub fn shown(self) -> f64 {
        match self {
            Figure::Exact(x) => x,
            Figure::Band(b) => b.estimate,
        }
    }

    pub fn is_band(self) -> bool {
        matches!(self, Figure::Band(_))
    }
}

/// Which figure an estimate is of: one hash input (D421). Its number ([`Field::code`]) is part of
/// the hash, so renumbering re-draws the estimates (views only).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Field {
    RevenueTtm,
    NetIncomeTtm,
    /// The value shown, total and a share (one error, so the two agree).
    Value,
    Cash,
    LineDrawn,
    LineLimit,
    /// The consensus and the ends of its range, which share one error so they keep their order.
    ConsensusNi,
    Projection,
    // Units (spec 8 Units tab), one unit per company in the MVP (spec 1).
    UnitGrossAssets,
    UnitAssetBook,
    UnitAssetsEff,
    UnitRevenue,
    UnitVariable,
    UnitFixed,
    UnitRd,
    UnitDepreciation,
    UnitShared,
    UnitEbit,
    UnitCapex,
    /// A company's share of its industry's revenue (the industry detail list).
    IndustryShare,
    /// A statement line: 100 + the line's place in [`StatementLine::ALL`].
    Line(StatementLine),
}

impl Field {
    fn code(self) -> u64 {
        match self {
            Field::Line(l) => 100 + l as u64,
            Field::RevenueTtm => 1,
            Field::NetIncomeTtm => 2,
            Field::Value => 3,
            Field::Cash => 5,
            Field::LineDrawn => 6,
            Field::LineLimit => 7,
            Field::ConsensusNi => 8,
            Field::Projection => 11,
            Field::UnitGrossAssets => 20,
            Field::UnitAssetBook => 21,
            Field::UnitAssetsEff => 22,
            Field::UnitRevenue => 23,
            Field::UnitVariable => 24,
            Field::UnitFixed => 25,
            Field::UnitRd => 26,
            Field::UnitDepreciation => 27,
            Field::UnitShared => 28,
            Field::UnitEbit => 29,
            Field::UnitCapex => 30,
            Field::IndustryShare => 31,
        }
    }
}

/// Every money line of a statement (spec 3.9) in display order: income, cash flow, balance
/// sheet, then the guidance range (5.16). An estimated statement holds one band per line.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum StatementLine {
    Revenue,
    Variable,
    FixedCash,
    OperatingCosts,
    Rd,
    Shared,
    Depreciation,
    Ebit,
    Ebitda,
    InterestExpense,
    InterestIncome,
    AssetSaleGain,
    PreTaxIncome,
    Tax,
    NetIncome,
    OperatingCash,
    AssetPurchases,
    AssetSales,
    LineDrawnOrRepaid,
    SharesIssuedNet,
    Dividends,
    NetCashChange,
    Cash,
    AssetBook,
    TotalAssets,
    BalanceLineDrawn,
    TaxPayable,
    TotalLiabilities,
    Estate,
    Equity,
    GuidanceLow,
    GuidanceHigh,
}

impl StatementLine {
    /// Every line, in display order.
    pub const ALL: [StatementLine; 32] = [
        StatementLine::Revenue,
        StatementLine::Variable,
        StatementLine::FixedCash,
        StatementLine::OperatingCosts,
        StatementLine::Rd,
        StatementLine::Shared,
        StatementLine::Depreciation,
        StatementLine::Ebit,
        StatementLine::Ebitda,
        StatementLine::InterestExpense,
        StatementLine::InterestIncome,
        StatementLine::AssetSaleGain,
        StatementLine::PreTaxIncome,
        StatementLine::Tax,
        StatementLine::NetIncome,
        StatementLine::OperatingCash,
        StatementLine::AssetPurchases,
        StatementLine::AssetSales,
        StatementLine::LineDrawnOrRepaid,
        StatementLine::SharesIssuedNet,
        StatementLine::Dividends,
        StatementLine::NetCashChange,
        StatementLine::Cash,
        StatementLine::AssetBook,
        StatementLine::TotalAssets,
        StatementLine::BalanceLineDrawn,
        StatementLine::TaxPayable,
        StatementLine::TotalLiabilities,
        StatementLine::Estate,
        StatementLine::Equity,
        StatementLine::GuidanceLow,
        StatementLine::GuidanceHigh,
    ];

    /// The line's label (spec 3.9).
    pub fn label(self) -> &'static str {
        match self {
            StatementLine::Revenue => "Revenue",
            StatementLine::Variable => "Variable costs",
            StatementLine::FixedCash => "Fixed cash costs",
            StatementLine::OperatingCosts => "Operating costs",
            StatementLine::Rd => "R&D",
            StatementLine::Shared => "Compute and licences",
            StatementLine::Depreciation => "Depreciation",
            StatementLine::Ebit => "EBIT",
            StatementLine::Ebitda => "EBITDA",
            StatementLine::InterestExpense => "Interest expense",
            StatementLine::InterestIncome => "Interest income",
            StatementLine::AssetSaleGain => "Gain on asset sales",
            StatementLine::PreTaxIncome => "Pre-tax income",
            StatementLine::Tax => "Tax",
            StatementLine::NetIncome => "Net income",
            StatementLine::OperatingCash => "Operating cash",
            StatementLine::AssetPurchases => "Asset purchases",
            StatementLine::AssetSales => "Asset sales",
            StatementLine::LineDrawnOrRepaid => "Line drawn or repaid",
            StatementLine::SharesIssuedNet => "Shares issued, net",
            StatementLine::Dividends => "Dividends",
            StatementLine::NetCashChange => "Net change in cash",
            StatementLine::Cash => "Cash",
            StatementLine::AssetBook => "Business assets (book)",
            StatementLine::TotalAssets => "Total assets",
            StatementLine::BalanceLineDrawn => "Credit line drawn",
            StatementLine::TaxPayable => "Tax payable",
            StatementLine::TotalLiabilities => "Total liabilities",
            StatementLine::Estate => "Estate",
            StatementLine::Equity => "Equity",
            StatementLine::GuidanceLow => "Guidance, low",
            StatementLine::GuidanceHigh => "Guidance, high",
        }
    }

    /// The line whose error this line shares: the guidance ends share one, so they keep their
    /// order (the estimate is increasing in the truth, D422); every other line has its own.
    pub fn error_key(self) -> StatementLine {
        match self {
            StatementLine::GuidanceHigh => StatementLine::GuidanceLow,
            l => l,
        }
    }

    /// The line's exact value in a statement (spec 3.9).
    pub fn of(self, s: &Statement) -> f64 {
        let (l, b) = (&s.lines, &s.balance);
        match self {
            StatementLine::Revenue => l.revenue,
            StatementLine::Variable => l.variable,
            StatementLine::FixedCash => l.fixed_cash,
            StatementLine::OperatingCosts => l.operating_costs(),
            StatementLine::Rd => l.rd,
            StatementLine::Shared => l.shared,
            StatementLine::Depreciation => l.depreciation,
            StatementLine::Ebit => l.ebit(),
            StatementLine::Ebitda => l.ebitda(),
            StatementLine::InterestExpense => l.interest_expense(),
            StatementLine::InterestIncome => l.interest_income,
            StatementLine::AssetSaleGain => l.asset_sale_gain,
            StatementLine::PreTaxIncome => l.pre_tax_income(),
            StatementLine::Tax => l.tax,
            StatementLine::NetIncome => l.net_income(),
            StatementLine::OperatingCash => l.operating_cash(),
            StatementLine::AssetPurchases => l.asset_purchases,
            StatementLine::AssetSales => l.asset_sale_proceeds,
            StatementLine::LineDrawnOrRepaid => l.line_drawn_or_repaid,
            StatementLine::SharesIssuedNet => l.shares_issued_net,
            StatementLine::Dividends => l.dividends,
            StatementLine::NetCashChange => l.net_cash_change(),
            StatementLine::Cash => b.cash,
            StatementLine::AssetBook => b.asset_book,
            StatementLine::TotalAssets => b.total_assets,
            StatementLine::BalanceLineDrawn => b.line_drawn,
            StatementLine::TaxPayable => b.tax_payable,
            StatementLine::TotalLiabilities => b.total_liabilities,
            StatementLine::Estate => b.estate,
            StatementLine::Equity => b.equity,
            StatementLine::GuidanceLow => s.key.guidance.0,
            StatementLine::GuidanceHigh => s.key.guidance.1,
        }
    }
}

/// Whether company `id` shows estimates rather than published figures at the world's clock
/// (D420, spec 5.20.1 Listing step 4): a private company always; a company listed in play until
/// the first release after its listing (its first statements publish then); never a company
/// listed at load.
pub fn shows_estimates(w: &World, id: CompanyId) -> bool {
    let s = &w.market.stocks[id];
    match (s.exchange, s.listed_on) {
        (None, _) => true,
        (Some(_), None) => false,
        (Some(_), Some(listed)) => w.clock < release_tick(listed.quarter().next()),
    }
}

/// The newest quarter published at `now` (its release has run, spec 4.4 row 1; D130): Q3 2019
/// on 1 January 2020, Q4 2019 from 2 January. Figures that move between releases (cash, line,
/// value, TTM) are re-drawn when it changes (D420).
pub fn release_quarter(now: DateTime) -> Quarter {
    let q = now.date().quarter().prev();
    if now >= release_tick(q.next()) {
        q
    } else {
        q.prev()
    }
}

/// The hash's period input (D421): a quarter or a year, never the same number.
pub fn period_code(p: Period) -> u64 {
    match p {
        Period::Quarter(q) => quarter_code(q),
        Period::Year(y) => (u64::from(y.unsigned_abs()) << 1) | 1,
    }
}

fn quarter_code(q: Quarter) -> u64 {
    (u64::from(q.year.unsigned_abs()) * 4 + u64::from(q.q)) << 1
}

/// splitmix64's finaliser (Steele, Lea and Flood 2014): a fixed bijection of u64 that spreads
/// every input bit over the output.
fn mix(z: u64) -> u64 {
    let z = z.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    let z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

/// The estimate hash of (seed, company, period, field) (D421).
pub fn estimate_hash(seed: u64, company: CompanyId, period: u64, field: Field) -> u64 {
    let h = mix(ESTIMATE_HASH_SALT ^ seed);
    let h = mix(h ^ company.index() as u64);
    let h = mix(h ^ period);
    mix(h ^ field.code())
}

/// The band around `truth` for hash `h`, with `floor` the scale below which the error and the
/// band stop shrinking (D422).
pub fn band_of(truth: f64, h: u64, floor: f64) -> Band {
    // 53 bits for the magnitude, the lowest bit for the sign.
    let u = (h >> 11) as f64 / (1u64 << 53) as f64;
    let magnitude = ESTIMATE_ERROR_MIN + u * (ESTIMATE_ERROR_MAX - ESTIMATE_ERROR_MIN);
    let e = if h & 1 == 1 { magnitude } else { -magnitude };
    let scale = truth.abs().max(floor);
    let estimate = truth + e * scale;
    let half = ESTIMATE_BAND_HALF_WIDTH * estimate.abs().max(floor);
    Band {
        estimate,
        low: estimate - half,
        high: estimate + half,
    }
}

/// Makes the figures of the views: the seed, whether Omniscient is on, and the release
/// quarter that keys the figures that move between releases.
#[derive(Debug, Clone, Copy)]
pub struct Estimator {
    pub seed: u64,
    pub omniscient: bool,
    /// [`release_quarter`] at the build.
    pub release: Quarter,
}

impl Estimator {
    pub fn new(seed: u64, omniscient: bool, now: DateTime) -> Estimator {
        Estimator {
            seed,
            omniscient,
            release: release_quarter(now),
        }
    }

    /// Whether company `id`'s figures are bands in this build (never in Omniscient).
    pub fn banded(&self, w: &World, id: CompanyId) -> bool {
        !self.omniscient && shows_estimates(w, id)
    }

    /// A money figure that moves between releases (cash, line, value, TTM), re-drawn at each
    /// release (D420).
    pub fn current(&self, banded: bool, id: CompanyId, field: Field, truth: f64) -> Figure {
        self.figure(
            banded,
            id,
            quarter_code(self.release),
            field,
            truth,
            ESTIMATE_FLOOR_USD,
        )
    }

    /// [`Estimator::current`] for a per-share figure.
    pub fn current_per_share(
        &self,
        banded: bool,
        id: CompanyId,
        field: Field,
        truth: f64,
    ) -> Figure {
        self.figure(
            banded,
            id,
            quarter_code(self.release),
            field,
            truth,
            ESTIMATE_FLOOR_PER_SHARE_USD,
        )
    }

    /// A money figure of one period's statement: keyed by that period, so a statement's
    /// estimate stays the same from release to release.
    pub fn of_period(
        &self,
        banded: bool,
        id: CompanyId,
        period: Period,
        field: Field,
        truth: f64,
    ) -> Figure {
        self.figure(
            banded,
            id,
            period_code(period),
            field,
            truth,
            ESTIMATE_FLOOR_USD,
        )
    }

    /// A share (0 to 1) re-drawn at each release, with a floor of 1% of the whole.
    pub fn current_share(&self, banded: bool, id: CompanyId, field: Field, truth: f64) -> Figure {
        self.figure(
            banded,
            id,
            quarter_code(self.release),
            field,
            truth,
            ESTIMATE_FLOOR_SHARE,
        )
    }

    fn figure(
        &self,
        banded: bool,
        id: CompanyId,
        period: u64,
        field: Field,
        truth: f64,
        floor: f64,
    ) -> Figure {
        if banded {
            Figure::Band(band_of(
                truth,
                estimate_hash(self.seed, id, period, field),
                floor,
            ))
        } else {
            Figure::Exact(truth)
        }
    }
}

/// The floor of a share figure (T, D422): 1 percentage point.
pub const ESTIMATE_FLOOR_SHARE: f64 = 0.01;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_band_holds_the_truth_strictly_inside() {
        for (i, &truth) in [0.0, 1.0, -3.5e5, 4.2e7, -9.9e8, 1.3e12, 0.004]
            .iter()
            .enumerate()
        {
            for k in 0..2000u64 {
                let h = estimate_hash(k, CompanyId::from_index(i), k, Field::Cash);
                let b = band_of(truth, h, ESTIMATE_FLOOR_USD);
                assert!(b.low < truth && truth < b.high, "{truth} {b:?}");
                assert_ne!(b.estimate, truth);
                let err = (b.estimate - truth).abs() / truth.abs().max(ESTIMATE_FLOOR_USD);
                assert!((ESTIMATE_ERROR_MIN - 1e-12..=ESTIMATE_ERROR_MAX + 1e-12).contains(&err));
            }
        }
    }

    #[test]
    fn the_hash_differs_by_every_input() {
        let c = CompanyId::from_index(3);
        let base = estimate_hash(1, c, 10, Field::Cash);
        assert_ne!(base, estimate_hash(2, c, 10, Field::Cash));
        assert_ne!(
            base,
            estimate_hash(1, CompanyId::from_index(4), 10, Field::Cash)
        );
        assert_ne!(base, estimate_hash(1, c, 12, Field::Cash));
        assert_ne!(base, estimate_hash(1, c, 10, Field::LineDrawn));
        assert_eq!(base, estimate_hash(1, c, 10, Field::Cash));
        assert_ne!(
            period_code(Period::Year(2020)),
            period_code(Period::Quarter(Quarter { year: 2020, q: 1 }))
        );
    }

    #[test]
    fn the_release_quarter_turns_at_the_release() {
        use crate::time::Date;
        let q = |y, n| Quarter { year: y, q: n };
        assert_eq!(release_quarter(DateTime::START), q(2019, 3));
        assert_eq!(
            release_quarter(DateTime::midnight(Date::ymd(2020, 1, 2))),
            q(2019, 4)
        );
        assert_eq!(
            release_quarter(DateTime::at(Date::ymd(2020, 4, 1), 23)),
            q(2019, 4)
        );
        assert_eq!(
            release_quarter(DateTime::midnight(Date::ymd(2020, 4, 2))),
            q(2020, 1)
        );
    }
}
