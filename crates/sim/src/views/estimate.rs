//! Estimate bands: what the observer sees of a figure that is not published (spec 1 Information,
//! replaced by Logan's 2026-10-21 ruling, D420; design fix 420).
//!
//! Spec 1 has private companies' figures show "?". Logan ruled instead that every financial
//! figure of a private company, and of a new listing until its first release after listing
//! (spec 5.20.1 Listing step 4), is shown as a **band**: a range of about ±25% around a noisy
//! estimate. The views build the band, so the true value never reaches the UI for those
//! companies: a [`Figure`] holds either the exact published value or a [`Band`], never both.
//! Omniscient (debug builds only, spec 1) serves the exact value instead.
//!
//! **The noise draws from no sim RNG stream.** It is a hash of the seed, the subject (a company
//! or an industry), the figure's [`Kind`], and the period and true value (D421), so building the
//! views never moves a stream (`rng.rs`).
//!
//! **A persistent bias, so averaging does not converge (D429, Logan's ruling).** A banded
//! subject's error on a kind of figure is `e = s × m + j`: a sign `s` fixed for the subject and
//! kind for the whole game, a magnitude `m` between [`ESTIMATE_BIAS_MIN`] and
//! [`ESTIMATE_BIAS_MAX`] re-drawn each calendar year, and a small jitter `j` within
//! ±[`ESTIMATE_JITTER`] drawn per period and true value. Every estimate of a company's revenue
//! (monthly, quarterly, yearly, TTM, in any view) leans the same way by at least
//! `ESTIMATE_BIAS_MIN − ESTIMATE_JITTER`, so averaging them never finds the truth. Each underlying
//! figure has one estimate: the jitter is keyed by the true value (and the statement period), so
//! two views of the same figure show the same band, and a figure that has not changed keeps its
//! estimate from month to month, while two different values never share an error (a new value
//! gets a new jitter, so month-to-month ratios and differences stay noisy).
//!
//! **One error per true value; the rest is derived (D430).** A figure that is a function of
//! another banded figure is derived from that band, never banded on its own with a shared
//! error: a year's flows and the TTM are the sums of the quarters' bands, a value a share is the
//! total band over the shares, the range ends are `range()` of the consensus band, a share of an
//! industry is the revenue band over the industry total, data inflow is the revenue band times
//! the TB rate.
//!
//! The estimate is `truth + e × scale` with `scale = max(|truth|, floor)`; the band is the
//! estimate ± [`ESTIMATE_BAND_HALF_WIDTH`] × `max(|estimate|, floor)`. The half-width (at least
//! `0.25 × (1 − 0.155)` = 0.21 × scale) is always wider than the error (at most 0.155 × scale),
//! so the band holds the truth strictly inside it: neither endpoint and never the estimate
//! equals the true value (D422). Derived bands keep this, since they apply increasing functions
//! or sums. A band of a small figure (below the floor) can reach below 0.

use crate::finance::statements::{Period, Statement};
use crate::time::{DateTime, Quarter};
use crate::world::{CompanyId, IndustryId, Ordinal, World};

/// The smallest persistent bias of a banded figure, a share of the figure (T, D429): with the
/// jitter, every estimate is at least 5.5% off, the same way for a whole year.
pub const ESTIMATE_BIAS_MIN: f64 = 0.07;
/// The largest persistent bias (T, D429): with the jitter, at most 15.5% off, about the ±15%
/// of the listed companies' EFV error (D140).
pub const ESTIMATE_BIAS_MAX: f64 = 0.14;
/// The jitter on each period's and each value's estimate, either way (T, D429): small enough
/// that the bias's sign never flips, large enough that two values' ratio is not shown exactly.
pub const ESTIMATE_JITTER: f64 = 0.015;
/// The band's half-width around the estimate, a share of the estimate (T): Logan's "about
/// ±25%" (2026-10-21, D420).
pub const ESTIMATE_BAND_HALF_WIDTH: f64 = 0.25;
/// The scale under which a money figure's error and band stop shrinking, USD (T, D422): a
/// figure of 0 (a line never drawn) still gets a band about $0.5M wide.
pub const ESTIMATE_FLOOR_USD: f64 = 1.0e6;
/// The floor of a share of a whole (T, D422): 1 percentage point.
pub const ESTIMATE_FLOOR_SHARE: f64 = 0.01;
/// The floor of a data figure, TB (T, D431).
pub const ESTIMATE_FLOOR_TB: f64 = 1.0;
/// The floor of a productivity, points (T, D436).
pub const ESTIMATE_FLOOR_POINTS: f64 = 1.0;
/// The floor of a ratio such as M (T, D432).
pub const ESTIMATE_FLOOR_RATIO: f64 = 0.01;
/// The salt of the estimate hash (D421), so its numbers share nothing with any other use of
/// the seed. Changing it re-draws every estimate (views only: no save or hash moves).
pub const ESTIMATE_HASH_SALT: u64 = 0x7C20_FFE5_71A7_E000;

/// An estimate with its band (D420): `low < truth < high` always holds for the hidden truth,
/// and `estimate` is never the truth.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Band {
    /// The observer's noisy estimate: the band's centre for a banded figure, inside the band
    /// for a derived one.
    pub estimate: f64,
    pub low: f64,
    pub high: f64,
}

impl Band {
    /// The band of `f(x)` for an increasing `f` (D430): the truth stays strictly inside.
    pub fn map(self, f: impl Fn(f64) -> f64) -> Band {
        Band {
            estimate: f(self.estimate),
            low: f(self.low),
            high: f(self.high),
        }
    }
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

    /// `f` of this figure for an increasing `f` (D430).
    pub fn map(self, f: impl Fn(f64) -> f64) -> Figure {
        match self {
            Figure::Exact(x) => Figure::Exact(f(x)),
            Figure::Band(b) => Figure::Band(b.map(f)),
        }
    }

    /// The sum of figures (D430): exact if every part is, else a band from the parts' bands
    /// (an exact part counts as a band of zero width), so a banded part's truth stays hidden.
    pub fn sum(parts: impl IntoIterator<Item = Figure>) -> Figure {
        let (mut exact, mut est, mut low, mut high) = (true, 0.0, 0.0, 0.0);
        for p in parts {
            match p {
                Figure::Exact(x) => {
                    est += x;
                    low += x;
                    high += x;
                }
                Figure::Band(b) => {
                    exact = false;
                    est += b.estimate;
                    low += b.low;
                    high += b.high;
                }
            }
        }
        if exact {
            Figure::Exact(est)
        } else {
            Figure::Band(Band {
                estimate: est,
                low,
                high,
            })
        }
    }

    /// This figure over a positive exact `d` (a share of a known whole, a value a share).
    pub fn over(self, d: f64) -> Figure {
        self.map(|x| x / d)
    }

    /// `num ÷ den` for a positive whole (D430): interval division, so the true ratio stays
    /// strictly inside; 0 when the whole shown is not above 0.
    pub fn ratio(num: Figure, den: Figure) -> Figure {
        let band = |f: Figure| match f {
            Figure::Exact(x) => Band {
                estimate: x,
                low: x,
                high: x,
            },
            Figure::Band(b) => b,
        };
        match (num, den) {
            (Figure::Exact(n), Figure::Exact(d)) => {
                Figure::Exact(if d > 0.0 { n / d } else { 0.0 })
            }
            (_, Figure::Exact(d)) if d > 0.0 => num.over(d),
            _ => {
                let (n, d) = (band(num), band(den));
                if d.low <= 0.0 {
                    return if d.estimate > 0.0 {
                        num.over(d.estimate)
                    } else {
                        Figure::Exact(0.0)
                    };
                }
                Figure::Band(Band {
                    estimate: n.estimate / d.estimate,
                    low: n.low / if n.low >= 0.0 { d.high } else { d.low },
                    high: n.high / if n.high >= 0.0 { d.low } else { d.high },
                })
            }
        }
    }
}

/// Which kind of figure an estimate is of (D429): the bias is drawn per subject and kind, so
/// every estimate of one kind of figure leans the same way. Its number ([`Kind::code`]) is part
/// of the hash.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Kind {
    /// A statement line, and the same figure monthly in v_units, v_company_detail and v_ratings
    /// (revenue, costs, EBIT, capex, cash, line drawn, asset book).
    Line(StatementLine),
    /// The value shown for a private company (0.7 × fair value, spec 5.13 step 6).
    Value,
    LineLimit,
    /// The quarter's net income consensus (5.16).
    Consensus,
    /// The engine's projection the recap reads (D280).
    Projection,
    /// The revenue a startup was sized for (5.19.3).
    BirthSize,
    GrossAssets,
    AssetsEff,
    /// A unit's productivity (5.6), banded with its money figures (D436).
    Productivity,
    HeldTb,
    UnstructuredTb,
    DecayTb,
    /// An industry's supply, M, fringe revenue and fringe share (D432).
    Supply,
    MarketFactor,
    FringeRevenue,
    FringeShare,
}

impl Kind {
    pub fn code(self) -> u64 {
        match self {
            Kind::Line(l) => 100 + l as u64,
            Kind::Value => 1,
            Kind::LineLimit => 2,
            Kind::Consensus => 3,
            Kind::Projection => 4,
            Kind::BirthSize => 5,
            Kind::GrossAssets => 6,
            Kind::AssetsEff => 7,
            Kind::HeldTb => 8,
            Kind::UnstructuredTb => 9,
            Kind::DecayTb => 10,
            Kind::Supply => 11,
            Kind::MarketFactor => 12,
            Kind::FringeRevenue => 13,
            Kind::FringeShare => 14,
            Kind::Productivity => 15,
        }
    }
}

/// Whose figure an estimate is of.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Subject {
    Company(CompanyId),
    Industry(IndustryId),
}

impl Subject {
    fn code(self) -> u64 {
        match self {
            Subject::Company(c) => c.index() as u64,
            Subject::Industry(i) => (1 << 32) | i.index() as u64,
        }
    }
}

/// Every money line of a statement (spec 3.9) in display order: income, cash flow, balance
/// sheet, then the guidance range (5.16). An estimated statement holds one figure per line.
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

    /// A flow of the period (income and cash flow lines): a year's is the sum of its quarters'.
    /// The balance sheet and guidance lines are the period end's.
    pub fn is_flow(self) -> bool {
        (self as usize) < (StatementLine::Cash as usize)
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
    !w.publishes(id)
}

/// The newest quarter published at `now` (its release has run, spec 4.4 row 1; D130): Q3 2019
/// on 1 January 2020, Q4 2019 from 2 January.
pub fn release_quarter(now: DateTime) -> Quarter {
    let q = now.date().quarter().prev();
    if now >= crate::time::quarter::release_tick(q.next()) {
        q
    } else {
        q.prev()
    }
}

/// The hash's period input (D421): a quarter or a year, never the same number; 0 is the
/// "current" figures' period.
pub fn period_code(p: Period) -> u64 {
    match p {
        Period::Quarter(q) => (u64::from(q.year.unsigned_abs()) * 4 + u64::from(q.q)) << 1,
        Period::Year(y) => (u64::from(y.unsigned_abs()) << 1) | 1,
    }
}

fn period_year(p: Period) -> i32 {
    match p {
        Period::Quarter(q) => q.year,
        Period::Year(y) => y,
    }
}

/// splitmix64's finaliser (Steele, Lea and Flood 2014): a fixed bijection of u64 that spreads
/// every input bit over the output.
fn mix(z: u64) -> u64 {
    let z = z.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    let z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

/// The estimate hash of (seed, subject, kind, then any further inputs) (D421).
pub fn estimate_hash(seed: u64, subject: Subject, kind: Kind, rest: &[u64]) -> u64 {
    let mut h = mix(ESTIMATE_HASH_SALT ^ seed);
    h = mix(h ^ subject.code());
    h = mix(h ^ kind.code());
    for &x in rest {
        h = mix(h ^ x);
    }
    h
}

/// A uniform in [0, 1) from a hash's top 53 bits.
fn unit(h: u64) -> f64 {
    (h >> 11) as f64 / (1u64 << 53) as f64
}

/// Hash tags of the three parts of the error.
const TAG_SIGN: u64 = 1;
const TAG_BIAS: u64 = 2;
const TAG_JITTER: u64 = 3;

/// The error of one estimate (D429): the subject's persistent sign for the kind, times the
/// year's bias magnitude, plus the jitter of this period and true value.
pub fn error(seed: u64, subject: Subject, kind: Kind, year: i32, period: u64, truth: f64) -> f64 {
    // The (seed, subject, kind) prefix once, then each part's own tail.
    let prefix = estimate_hash(seed, subject, kind, &[]);
    let sign = if mix(prefix ^ TAG_SIGN) & 1 == 1 {
        1.0
    } else {
        -1.0
    };
    let year = u64::from(year.unsigned_abs());
    let bias = ESTIMATE_BIAS_MIN
        + unit(mix(mix(prefix ^ TAG_BIAS) ^ year)) * (ESTIMATE_BIAS_MAX - ESTIMATE_BIAS_MIN);
    let tail = [year, period, truth.to_bits()];
    let j = unit(
        tail.iter()
            .fold(mix(prefix ^ TAG_JITTER), |h, &x| mix(h ^ x)),
    );
    sign * bias + (2.0 * j - 1.0) * ESTIMATE_JITTER
}

/// The band around `truth` with error `e`, `floor` the scale below which the error and the
/// band stop shrinking (D422).
pub fn band_of(truth: f64, e: f64, floor: f64) -> Band {
    let scale = truth.abs().max(floor);
    let estimate = truth + e * scale;
    let half = ESTIMATE_BAND_HALF_WIDTH * estimate.abs().max(floor);
    Band {
        estimate,
        low: estimate - half,
        high: estimate + half,
    }
}

/// Makes the figures of the views: the seed, whether Omniscient is on, and the clock.
#[derive(Debug, Clone, Copy)]
pub struct Estimator {
    pub seed: u64,
    pub omniscient: bool,
    pub now: DateTime,
}

impl Estimator {
    pub fn new(seed: u64, omniscient: bool, now: DateTime) -> Estimator {
        Estimator {
            seed,
            omniscient,
            now,
        }
    }

    /// Whether company `id`'s figures are bands in this build (never in Omniscient).
    pub fn banded(&self, w: &World, id: CompanyId) -> bool {
        !self.omniscient && shows_estimates(w, id)
    }

    /// A figure as it stands now (cash, line, value, a unit's last month, TB held): its bias
    /// is this year's, its jitter keyed by the true value (D429).
    pub fn current(
        &self,
        banded: bool,
        subject: Subject,
        kind: Kind,
        truth: f64,
        floor: f64,
    ) -> Figure {
        self.figure(banded, subject, kind, self.now.date().year, 0, truth, floor)
    }

    /// A figure of one period (a statement line, a quarter's consensus): its bias is the
    /// period's year's, its jitter keyed by the period and the true value.
    #[allow(clippy::too_many_arguments)]
    pub fn of_period(
        &self,
        banded: bool,
        subject: Subject,
        kind: Kind,
        period: Period,
        truth: f64,
        floor: f64,
    ) -> Figure {
        self.figure(
            banded,
            subject,
            kind,
            period_year(period),
            period_code(period),
            truth,
            floor,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn figure(
        &self,
        banded: bool,
        subject: Subject,
        kind: Kind,
        year: i32,
        period: u64,
        truth: f64,
        floor: f64,
    ) -> Figure {
        if banded {
            let e = error(self.seed, subject, kind, year, period, truth);
            Figure::Band(band_of(truth, e, floor))
        } else {
            Figure::Exact(truth)
        }
    }

    /// A company's money figure as it stands now.
    pub fn company_now(&self, banded: bool, id: CompanyId, kind: Kind, truth: f64) -> Figure {
        self.current(
            banded,
            Subject::Company(id),
            kind,
            truth,
            ESTIMATE_FLOOR_USD,
        )
    }
}

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
                let s = Subject::Company(CompanyId::from_index(i + k as usize));
                let e = error(k, s, Kind::Value, 2020 + (k % 9) as i32, k, truth);
                let b = band_of(truth, e, ESTIMATE_FLOOR_USD);
                assert!(b.low < truth && truth < b.high, "{truth} {b:?}");
                assert_ne!(b.estimate, truth);
                let err = e.abs();
                let lo = ESTIMATE_BIAS_MIN - ESTIMATE_JITTER;
                let hi = ESTIMATE_BIAS_MAX + ESTIMATE_JITTER;
                assert!((lo..=hi).contains(&err), "{err}");
            }
        }
    }

    #[test]
    fn the_bias_keeps_its_sign_and_the_hash_differs_by_every_input() {
        let c = Subject::Company(CompanyId::from_index(3));
        let k = Kind::Line(StatementLine::Revenue);
        let first = error(1, c, k, 2020, 10, 5.0e8).signum();
        for year in 2020..2050 {
            for v in 0..20 {
                let e = error(1, c, k, year, v, 5.0e8 + v as f64);
                assert_eq!(e.signum(), first, "the sign is the subject's for the kind");
            }
        }
        let base = estimate_hash(1, c, k, &[10]);
        assert_ne!(base, estimate_hash(2, c, k, &[10]));
        assert_ne!(
            base,
            estimate_hash(1, Subject::Company(CompanyId::from_index(4)), k, &[10])
        );
        assert_ne!(base, estimate_hash(1, c, Kind::Value, &[10]));
        assert_ne!(base, estimate_hash(1, c, k, &[12]));
        assert_ne!(
            base,
            estimate_hash(1, Subject::Industry(IndustryId::from_index(3)), k, &[10])
        );
        assert_eq!(base, estimate_hash(1, c, k, &[10]));
        assert_ne!(
            period_code(Period::Year(2020)),
            period_code(Period::Quarter(Quarter { year: 2020, q: 1 }))
        );
    }

    #[test]
    fn derived_bands_keep_the_truth_inside() {
        let s = Subject::Company(CompanyId::from_index(0));
        let parts: Vec<(f64, Figure)> = [1.0e8, 2.5e8, -3.0e5, 7.0e7]
            .iter()
            .enumerate()
            .map(|(i, &t)| {
                let e = error(5, s, Kind::Line(StatementLine::Revenue), 2021, i as u64, t);
                (t, Figure::Band(band_of(t, e, ESTIMATE_FLOOR_USD)))
            })
            .collect();
        let truth: f64 = parts.iter().map(|p| p.0).sum();
        let b = Figure::sum(parts.iter().map(|p| p.1)).band().unwrap();
        assert!(b.low < truth && truth < b.high && b.estimate != truth);
        let per = Figure::Band(b).over(4.0).band().unwrap();
        assert!(per.low < truth / 4.0 && truth / 4.0 < per.high);
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
            release_quarter(DateTime::midnight(Date::ymd(2020, 4, 2))),
            q(2020, 1)
        );
    }
}
