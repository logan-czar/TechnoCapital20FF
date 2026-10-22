//! Listings (spec 5.20; Logan, batches 163 Q6a, 165 and 166): the IPO tests, the board vote with
//! trait modifiers (5.20.1), the world-wide cap of 3 a quarter and the listing itself.
//!
//! Every IPO is a board vote. Each voter rolls once on the gen stream, in seat order (labor
//! seats 1 to 5, then directors, then an unseated named or state controller; D276), so a seed
//! always gives the same votes, member by member.

use serde::{Deserialize, Serialize};

use super::startup::{open_price, shares_for};
use crate::finance::distress::CompanyStatus;
use crate::finance::rating::{Rating, rating_factor};
use crate::people::board::Seat;
use crate::people::traits::Trait;
use crate::rng::{DrawSource, Stream};
use crate::time::Quarter;
use crate::world::{CharacterId, CompanyId, PhaseLabel};

/// Spec 5.20: at least 8 quarters since birth (starting companies pass at once) ...
pub const MIN_QUARTERS_SINCE_BIRTH: u32 = 8;
/// ... and TTM revenue at least $250M (T), lowered to $75M by the M10 tuning pass (M10.7, D362,
/// pending Logan): at $250M born companies, which start at $5M to $50M and mostly grow at the
/// 6.2 below-hurdle 2%, almost never qualify, and 30 years give 34 to 54 listings against spec
/// 10's 60 to 250.
pub const MIN_TTM_REVENUE_USD: f64 = 75.0e6;
/// Spec 5.20: TTM net income above 0, or 4-quarter revenue growth of at least 20%.
pub const MIN_REVENUE_GROWTH: f64 = 0.20;
/// Spec 5.20.1 step 1: a starting private company's first vote falls at one of the four 2020
/// plan locks (A).
pub const FIRST_VOTE_YEAR: i32 = 2020;
pub const QUARTERS_PER_YEAR: u8 = 4;
/// Spec 5.20.1 step 1: after a failed vote, the plan lock 4 quarters later (T).
pub const RETRY_QUARTERS: u32 = 4;
/// Spec 5.20.1 step 3: `15% + phase adj + confidence ÷ 10 + trait modifiers`, in points ...
pub const BASE_YES: f64 = 0.15;
/// ... phase adj Boom +15, Normal 0, Glut −10 (Bust is not eligible, 5.20) ...
pub const PHASE_ADJ_BOOM: f64 = 0.15;
pub const PHASE_ADJ_NORMAL: f64 = 0.0;
pub const PHASE_ADJ_GLUT: f64 = -0.10;
/// ... confidence (−100 to +100) ÷ 10 points, so ÷ 1,000 as a fraction ...
pub const CONFIDENCE_DIVISOR: f64 = 1000.0;
/// ... clamped 5% to 95%.
pub const MIN_YES: f64 = 0.05;
pub const MAX_YES: f64 = 0.95;
/// Spec 5.20.1 step 6: at most 3 listings world-wide a quarter (T).
pub const LISTINGS_PER_QUARTER: usize = 3;
/// Spec 5.20.1 Listing step 3: new shares equal to 20% of the re-split shares ...
pub const PUBLIC_FLOAT_SHARE: f64 = 0.20;
/// ... at `open_price × 0.92` (the 6.6 small-cap discount) ...
pub const IPO_DISCOUNT: f64 = 0.08;
/// ... less 3% fees.
pub const IPO_FEE: f64 = 0.03;

/// The 5.20.1 trait modifier (T), a fraction: Ambitious +15, Greedy +15, Brave +10, Visionary
/// +10, Narcissist +10, Paranoid −20, Cautious −15, Conservative −10, Content −10, Shy −10;
/// others 0.
pub fn trait_modifier(t: Trait) -> f64 {
    match t {
        Trait::Ambitious | Trait::Greedy => 0.15,
        Trait::Brave | Trait::Visionary | Trait::Narcissist => 0.10,
        Trait::Paranoid => -0.20,
        Trait::Cautious => -0.15,
        Trait::Conservative | Trait::Content | Trait::Shy => -0.10,
        _ => 0.0,
    }
}

/// What the IPO tests read at a plan lock (spec 5.20).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct IpoTestInputs {
    pub listed: bool,
    pub status: CompanyStatus,
    /// None for the 651 starting companies (they pass the age test at once).
    pub quarters_since_birth: Option<u32>,
    pub ttm_revenue: f64,
    pub ttm_net_income: f64,
    /// 4-quarter revenue growth (`market::fair_value::revenue_growth`).
    pub revenue_growth: f64,
    pub rating: Rating,
    pub label: PhaseLabel,
}

/// True if a company may be put to an IPO vote (spec 5.20): private and Active; 8 quarters since
/// birth (starting companies at once); TTM revenue at least $75M (D362; the spec says $250M);
/// TTM net income above 0 or revenue growth of at least 20%; rated B or better (rating factor
/// above 0, as 6.6 reads it: B- counts); its industry not labeled Bust. ("Not Distressed" is in
/// "Active".)
pub fn passes_ipo_tests(i: &IpoTestInputs) -> bool {
    !i.listed
        && i.status == CompanyStatus::Active
        && i.quarters_since_birth
            .is_none_or(|q| q >= MIN_QUARTERS_SINCE_BIRTH)
        && i.ttm_revenue >= MIN_TTM_REVENUE_USD
        && (i.ttm_net_income > 0.0 || i.revenue_growth >= MIN_REVENUE_GROWTH)
        && rating_factor(i.rating) > 0.0
        && i.label != PhaseLabel::Bust
}

/// A starting private company's first vote (spec 5.20.1 step 1, A): one of the four 2020 plan
/// locks, uniform on the gen stream (D276: drawn at load for each starting private company in
/// id order, after the boards).
pub fn draw_first_vote(draws: &mut dyn DrawSource) -> Quarter {
    let q = draws.int_inclusive(Stream::Gen, 1, i64::from(QUARTERS_PER_YEAR)) as u8;
    Quarter {
        year: FIRST_VOTE_YEAR,
        q,
    }
}

/// The plan lock a failed (or capped) IPO comes back at (spec 5.20.1 steps 1 and 6): 4 quarters
/// later.
pub fn next_vote_after(failed_at: Quarter) -> Quarter {
    (0..RETRY_QUARTERS).fold(failed_at, |q, _| q.next())
}

/// Phase adj (spec 5.20.1 step 3) of the company's industry label.
pub fn phase_adj(label: PhaseLabel) -> f64 {
    match label {
        PhaseLabel::Boom => PHASE_ADJ_BOOM,
        PhaseLabel::Normal | PhaseLabel::Bust => PHASE_ADJ_NORMAL,
        PhaseLabel::Glut => PHASE_ADJ_GLUT,
    }
}

/// A voter's yes chance (spec 5.20.1 step 3): `15% + phase adj + confidence ÷ 10 + trait
/// modifiers`, clamped 5% to 95%; `confidence` is the listing exchange's (5.1.2).
pub fn yes_chance(label: PhaseLabel, confidence: f64, traits: &[Trait]) -> f64 {
    let mods: f64 = traits.iter().map(|&t| trait_modifier(t)).sum();
    (BASE_YES + phase_adj(label) + confidence / CONFIDENCE_DIVISOR + mods).clamp(MIN_YES, MAX_YES)
}

/// Where a vote comes from (spec 5.20.1 steps 2 and 4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VoterRole {
    /// A labor seat holder.
    Seat(Seat),
    /// A director (5.19.4 step 4), by position.
    Director(u32),
    /// A named or state controller who holds no seat: one extra vote.
    Controller,
}

/// One voter (spec 5.20.1 step 2).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Voter<'a> {
    pub role: VoterRole,
    /// The member's traits (a state controller has none).
    pub traits: &'a [Trait],
    /// This vote is the controller's (a seated lead founder, or the extra controller vote).
    pub is_controller: bool,
}

/// The voters of a board (spec 5.20.1 steps 2 and 4), in roll order: the seated labor seats in
/// seat order, then the directors, then the controller's own vote when the controller is a
/// named character or a state holding no seat. `seats` and `directors` hold each member's
/// traits and whether it is the controller; a trust or other unnamed controller casts none.
pub fn voters<'a>(
    seats: &[(Seat, &'a [Trait], bool)],
    directors: &[(&'a [Trait], bool)],
    unseated_controller: Option<&'a [Trait]>,
) -> Vec<Voter<'a>> {
    let mut out: Vec<Voter<'a>> = Vec::new();
    let mut ordered: Vec<&(Seat, &'a [Trait], bool)> = seats.iter().collect();
    ordered.sort_by_key(|(s, _, _)| *s);
    for (seat, traits, ctl) in ordered {
        out.push(Voter {
            role: VoterRole::Seat(*seat),
            traits,
            is_controller: *ctl,
        });
    }
    for (i, (traits, ctl)) in directors.iter().enumerate() {
        out.push(Voter {
            role: VoterRole::Director(i as u32),
            traits,
            is_controller: *ctl,
        });
    }
    if let Some(traits) = unseated_controller {
        out.push(Voter {
            role: VoterRole::Controller,
            traits,
            is_controller: true,
        });
    }
    out
}

/// Who cast a ballot, as the board stood at the vote (spec 5.20.1 step 2; D542): a full
/// character by id, a partial (simple) character by its 3.7.1 id with its name (a partial
/// character can leave its seat and the views then no longer list it), or the state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum BallotVoter {
    Full(CharacterId),
    Partial {
        id: u32,
        name: String,
    },
    /// A state controller holding no seat (5.20.1 step 4).
    State,
}

/// One cast vote.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Ballot {
    pub role: VoterRole,
    pub chance: f64,
    pub yes: bool,
    /// Who held the role at the vote (D542). [`hold_vote`] leaves it `None` (it sees traits,
    /// not people); the vote job sets it.
    pub voter: Option<BallotVoter>,
}

/// An IPO vote (spec 5.20.1; 3.5 `ipo_last_vote`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VoteResult {
    pub ballots: Vec<Ballot>,
    pub yes: u32,
    pub no: u32,
    pub passed: bool,
}

/// Holds the vote (spec 5.20.1 steps 3 to 5): each voter rolls once on the gen stream in the
/// given order (one uniform below its yes chance is a yes). A majority of votes cast passes; a
/// tie goes the controller's way, and fails where the controller casts no vote.
pub fn hold_vote(
    voters: &[Voter<'_>],
    label: PhaseLabel,
    confidence: f64,
    draws: &mut dyn DrawSource,
) -> VoteResult {
    let ballots: Vec<Ballot> = voters
        .iter()
        .map(|v| {
            let chance = yes_chance(label, confidence, v.traits);
            Ballot {
                role: v.role,
                chance,
                yes: draws.chance(Stream::Gen, chance),
                voter: None,
            }
        })
        .collect();
    let yes = ballots.iter().filter(|b| b.yes).count() as u32;
    let no = ballots.len() as u32 - yes;
    let passed = if yes != no {
        yes > no
    } else {
        voters
            .iter()
            .zip(&ballots)
            .find(|(v, _)| v.is_controller)
            .is_some_and(|(_, b)| b.yes)
    };
    VoteResult {
        ballots,
        yes,
        no,
        passed,
    }
}

/// The world-wide cap (spec 5.20.1 step 6): of the votes that passed this quarter, the 3
/// largest by TTM revenue list; ties go to the lower id (D277). Returns (listing, capped) in
/// that order; the capped count as failed and come back in 4 quarters.
pub fn apply_cap(passed: &[(CompanyId, f64)]) -> (Vec<CompanyId>, Vec<CompanyId>) {
    let mut order: Vec<(CompanyId, f64)> = passed.to_vec();
    order.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
    let listing = order
        .iter()
        .take(LISTINGS_PER_QUARTER)
        .map(|(id, _)| *id)
        .collect();
    let capped = order
        .iter()
        .skip(LISTINGS_PER_QUARTER)
        .map(|(id, _)| *id)
        .collect();
    (listing, capped)
}

/// A listing (spec 5.20.1 Listing steps 2 and 3).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Listing {
    /// The 7.1 rule on the pre-money value; P = open_price, buzz 0 (step 4).
    pub open_price: f64,
    /// Existing shares after the re-split: `pre-money value ÷ open_price`.
    pub resplit_shares: u64,
    /// New shares to the public float: 20% of the re-split shares (rounded half to even, D278).
    pub new_shares: u64,
    pub shares_out: u64,
    /// `new shares × open_price × 0.92`.
    pub gross: f64,
    /// 3% of the gross.
    pub fees: f64,
    /// Cash raised: gross less fees.
    pub net: f64,
}

impl Listing {
    /// An existing holding after the re-split (holders keep their share of the company before
    /// the issue): `holding × re-split ÷ old shares`, rounded half to even (D278).
    pub fn resplit_holding(&self, holding: u64, old_shares_out: u64) -> u64 {
        if old_shares_out == 0 {
            return 0;
        }
        (holding as f64 * self.resplit_shares as f64 / old_shares_out as f64).round_ties_even()
            as u64
    }

    /// Market cap at the open (5.14), for the index reweight.
    pub fn market_cap(&self) -> f64 {
        self.open_price * self.shares_out as f64
    }
}

/// The listing (spec 5.20.1 Listing): the open price by the 7.1 rule on the pre-money value (the
/// 5.13 engine value with the exchange's X and no private discount), the re-split, 20% new
/// shares at `open_price × 0.92` less 3% fees. `key` seeds the 7.1 jitter.
pub fn list_company(pre_money_value: f64, key: &str) -> Listing {
    let price = open_price(pre_money_value, key);
    let resplit = shares_for(pre_money_value, price);
    let new_shares = (PUBLIC_FLOAT_SHARE * resplit as f64).round_ties_even() as u64;
    let gross = new_shares as f64 * price * (1.0 - IPO_DISCOUNT);
    let fees = IPO_FEE * gross;
    Listing {
        open_price: price,
        resplit_shares: resplit,
        new_shares,
        shares_out: resplit + new_shares,
        gross,
        fees,
        net: gross - fees,
    }
}
