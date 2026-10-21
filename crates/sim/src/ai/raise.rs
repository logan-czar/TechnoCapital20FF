//! Raising money in cash-burning industries (spec 6.6; Logan, batch 146). **Parked for the MVP**
//! (batch 148): no industry is flagged `cash_burning` in industries.csv, so [`raise_plan`]
//! returns None for every company with the real data. It runs at the plan lock after 6.2 to 6.4
//! and before 6.5, for Active and Distressed companies, one try per lock.

use serde::{Deserialize, Serialize};

use crate::finance::credit::{CreditLine, own_cash};
use crate::finance::distress::CompanyStatus;
use crate::finance::rating::{Rating, rating_factor};
use crate::market::fair_value::PRIVATE_DISCOUNT;
use crate::rng::{DrawSource, Stream};
use crate::world::PhaseLabel;

/// Spec 6.6: a raise starts when runway falls under 4 quarters (T).
pub const RUNWAY_TRIGGER_QUARTERS: f64 = 4.0;
/// Spec 6.6: the target is enough for 8 quarters of runway (T).
pub const TARGET_RUNWAY_QUARTERS: f64 = 8.0;
/// Spec 6.6 (3.4.3): issue discount 4% for large caps (market value $10B and up, A) ...
pub const LARGE_CAP_USD: f64 = 10.0e9;
pub const LARGE_CAP_DISCOUNT: f64 = 0.04;
/// ... and 8% for small caps (T); private placements take 8% off the shown value too.
pub const SMALL_CAP_DISCOUNT: f64 = 0.08;
/// Spec 6.6 (3.4.3): fees 3% of the gross raise (T).
pub const ISSUE_FEE: f64 = 0.03;
/// Spec 6.6: new shares capped at 20% of shares_out per raise (A).
pub const MAX_NEW_SHARE_FRACTION: f64 = 0.20;
/// Spec 6.6 (3.4.3): announcement effect `P ×= 1 − (2% + 0.5 × dilution%)`.
pub const ANNOUNCEMENT_BASE: f64 = 0.02;
pub const ANNOUNCEMENT_DILUTION_WEIGHT: f64 = 0.5;
/// Spec 6.6 success roll (T): `50% + 100 × (confidence factor − 1) + news adj + method adj −
/// 10% × consecutive failed raises`, clamped 5% to 95%.
pub const BASE_CHANCE: f64 = 0.50;
pub const FAILED_RAISE_PENALTY: f64 = 0.10;
pub const MIN_CHANCE: f64 = 0.05;
pub const MAX_CHANCE: f64 = 0.95;
/// News adj by the industry's phase label (T).
pub const NEWS_ADJ_BOOM: f64 = 0.30;
pub const NEWS_ADJ_NORMAL: f64 = 0.0;
pub const NEWS_ADJ_GLUT: f64 = -0.15;
pub const NEWS_ADJ_BUST: f64 = -0.35;
/// Method adj (T): credit line +20 pp, share issue 0.
pub const METHOD_ADJ_LINE: f64 = 0.20;
pub const METHOD_ADJ_SHARES: f64 = 0.0;

/// How a raise is made (spec 6.6 Method).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RaiseMethod {
    /// Draw the target on the line now (rated B or better, the undrawn line covers it).
    CreditLine,
    /// A follow-on share issue (listed) or a private placement (private).
    ShareIssue,
}

/// What the raise rule reads at the lock (spec 6.6).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RaiseInputs {
    /// industries.csv `cash_burning` of the company's industry; false for all 42 today.
    pub cash_burning: bool,
    pub status: CompanyStatus,
    /// Last quarter's free cash flow: operating cash less asset purchases (3.9).
    pub last_quarter_fcf: f64,
    pub cash: f64,
    pub line: CreditLine,
    pub rating: Rating,
    pub listed: bool,
    /// Share price P (listed).
    pub price: f64,
    pub shares_out: u64,
    /// Fair value per share V (5.13); a private company places at `0.7 × V` less 8%.
    pub value_per_share: f64,
    /// The company's confidence factor (5.7), 0.8 to 1.2.
    pub confidence_factor: f64,
    pub label: PhaseLabel,
    /// Consecutive failed raises before this one.
    pub failed_raises: u32,
}

/// A raise attempt (spec 6.6), before its success roll.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct RaisePlan {
    /// Minus last quarter's free cash flow, USD.
    pub burn: f64,
    /// `own cash ÷ burn`, quarters.
    pub runway_quarters: f64,
    /// `8 × burn − own cash`, USD (the net amount wanted, D266).
    pub target: f64,
    pub method: RaiseMethod,
    /// New shares (share issue only).
    pub new_shares: u64,
    /// Price per new share (share issue only).
    pub issue_price: f64,
    /// Gross raise, USD (the target for a line draw).
    pub gross: f64,
    /// Fees, USD (0 for a line draw).
    pub fees: f64,
    /// Cash raised net of fees, USD.
    pub net: f64,
    /// Share price after the announcement (listed share issues); P otherwise.
    pub price_after: f64,
    /// Success chance, 5% to 95%.
    pub chance: f64,
}

/// News adj (spec 6.6) by phase label.
pub fn news_adj(label: PhaseLabel) -> f64 {
    match label {
        PhaseLabel::Boom => NEWS_ADJ_BOOM,
        PhaseLabel::Normal => NEWS_ADJ_NORMAL,
        PhaseLabel::Glut => NEWS_ADJ_GLUT,
        PhaseLabel::Bust => NEWS_ADJ_BUST,
    }
}

/// The success chance (spec 6.6 success roll).
pub fn success_chance(
    confidence_factor: f64,
    label: PhaseLabel,
    method: RaiseMethod,
    failed_raises: u32,
) -> f64 {
    let method_adj = match method {
        RaiseMethod::CreditLine => METHOD_ADJ_LINE,
        RaiseMethod::ShareIssue => METHOD_ADJ_SHARES,
    };
    (BASE_CHANCE + (confidence_factor - 1.0) + news_adj(label) + method_adj
        - FAILED_RAISE_PENALTY * f64::from(failed_raises))
    .clamp(MIN_CHANCE, MAX_CHANCE)
}

/// The raise the company would try (spec 6.6), or None: not a cash-burning industry (every
/// industry with today's data), not Active or Distressed, no burn, or a runway of 4 quarters or
/// more. Method: a line draw of the target when rated B or better (rating factor above 0) and
/// the undrawn line covers it; else a share issue: listed at `P × (1 − 4% or 8%)` with the
/// announcement effect, private at `0.7 × V × (1 − 8%)` with none; new shares enough to net the
/// target after 3% fees, capped at 20% of shares_out (D266).
pub fn raise_plan(i: &RaiseInputs) -> Option<RaisePlan> {
    if !i.cash_burning
        || !matches!(i.status, CompanyStatus::Active | CompanyStatus::Distressed)
        || i.last_quarter_fcf >= 0.0
    {
        return None;
    }
    let burn = -i.last_quarter_fcf;
    let own = own_cash(i.cash, i.line.drawn);
    let runway = own / burn;
    if runway >= RUNWAY_TRIGGER_QUARTERS {
        return None;
    }
    let target = TARGET_RUNWAY_QUARTERS * burn - own;
    if rating_factor(i.rating) > 0.0 && i.line.available() >= target {
        return Some(RaisePlan {
            burn,
            runway_quarters: runway,
            target,
            method: RaiseMethod::CreditLine,
            new_shares: 0,
            issue_price: 0.0,
            gross: target,
            fees: 0.0,
            net: target,
            price_after: i.price,
            chance: success_chance(
                i.confidence_factor,
                i.label,
                RaiseMethod::CreditLine,
                i.failed_raises,
            ),
        });
    }
    let issue_price = if i.listed {
        let market_value = i.price * i.shares_out as f64;
        let discount = if market_value >= LARGE_CAP_USD {
            LARGE_CAP_DISCOUNT
        } else {
            SMALL_CAP_DISCOUNT
        };
        i.price * (1.0 - discount)
    } else {
        PRIVATE_DISCOUNT * i.value_per_share * (1.0 - SMALL_CAP_DISCOUNT)
    };
    let cap = (MAX_NEW_SHARE_FRACTION * i.shares_out as f64).floor() as u64;
    let want = if issue_price > 0.0 {
        (target / (issue_price * (1.0 - ISSUE_FEE))).ceil().max(0.0) as u64
    } else {
        cap
    };
    let new_shares = want.min(cap);
    let gross = new_shares as f64 * issue_price;
    let fees = ISSUE_FEE * gross;
    let price_after = if i.listed && new_shares > 0 {
        let dilution = new_shares as f64 / (i.shares_out + new_shares) as f64;
        i.price * (1.0 - (ANNOUNCEMENT_BASE + ANNOUNCEMENT_DILUTION_WEIGHT * dilution))
    } else {
        i.price
    };
    Some(RaisePlan {
        burn,
        runway_quarters: runway,
        target,
        method: RaiseMethod::ShareIssue,
        new_shares,
        issue_price,
        gross,
        fees,
        net: gross - fees,
        price_after,
        chance: success_chance(
            i.confidence_factor,
            i.label,
            RaiseMethod::ShareIssue,
            i.failed_raises,
        ),
    })
}

/// The success roll (spec 6.6): one AI-stream uniform below the chance succeeds (D266). On a
/// failure nothing is raised, the failed count rises and 6.2 holds g at −d_eff until a raise
/// succeeds.
pub fn roll_raise(plan: &RaisePlan, draws: &mut dyn DrawSource) -> bool {
    draws.chance(Stream::Ai, plan.chance)
}
