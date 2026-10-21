//! The Pdoomberg Wire news feed (build-plan M6.5): headline types, the daily post and the
//! release-day result headlines.
//!
//! Spec sections: 5.18, 8 (News feed); scheduled in 4.2 step 5 and the 4.4 price move.
//!
//! Formula half (lane F, F6): one constructor per 5.18 headline type, the release-day picks
//! (the five largest beats and misses), the queue the daily job posts from, and the tipped lab
//! that names the chatbot headline (5.1.1). No scheduler wiring. Every headline carries the
//! neutral **Pdoomberg Wire** byline (5.18 A); texts follow 5.18's wording where it gives one
//! and D279 where it does not.

use serde::{Deserialize, Serialize};

use crate::ai::raise::RaiseMethod;
use crate::finance::rating::{Rating, notches_between};
use crate::market::confidence::{ConfidenceHeadline, RATING_CHANGE_MIN_NOTCHES};
use crate::market::earnings::SurpriseTag;
use crate::rng::{DrawSource, Stream};
use crate::time::Date;
use crate::world::{CompanyId, IndustryId, PhaseLabel};

/// Spec 5.18 (A): MVP headlines come from a neutral Pdoomberg Wire byline.
pub const BYLINE: &str = "Pdoomberg Wire";
/// Spec 5.18: each release posts the five largest beats and the five largest misses (D279).
pub const TOP_RESULTS: usize = 5;
/// Spec 5.18: a rating change posts at 2 or more notches.
pub const RATING_HEADLINE_MIN_NOTCHES: u32 = RATING_CHANGE_MIN_NOTCHES;
/// Spec 7-starting-world 7.6: the tip names one of five candidate labs (A).
pub const TIPPED_LAB_CANDIDATES: usize = 5;
/// Percent, for headline figures.
pub const PERCENT: f64 = 100.0;
/// USD per $M, for headline figures.
pub const USD_PER_MILLION: f64 = 1.0e6;

/// What a headline reports (spec 5.18): one variant per type.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum HeadlineKind {
    /// An industry's phase label changed (5.1).
    PhaseChange { from: PhaseLabel, to: PhaseLabel },
    /// A release-day beat or miss (5.15 tags), with the surprise s.
    Result { tag: SurpriseTag, surprise: f64 },
    /// Made Bankrupt (5.12 step 2).
    Bankruptcy,
    /// Removed after its frozen quarters (5.12 step 3).
    Removal,
    /// A rating change of 2+ notches at the review (5.12).
    RatingChange { from: Rating, to: Rating },
    /// A 6.6 raise that succeeded.
    Raise { method: RaiseMethod, net_usd: f64 },
    /// A 6.6 raise that failed.
    FailedRaise { method: RaiseMethod },
    /// A fixed startup event (5.19.2), with the startups it made.
    FixedStartupEvent { event: String, startups: u32 },
    /// A random event's one startup (5.19.1).
    StartupLaunch,
    /// A random hot cluster (5.19.1): several startups in one industry and place.
    HotCluster { startups: u32 },
    /// An IPO board vote (5.20.1).
    IpoVote {
        passed: bool,
        yes: u32,
        no: u32,
        exchange: String,
    },
    /// A listing (5.20.1).
    Listing {
        exchange: String,
        price: f64,
        net_usd: f64,
    },
    /// The boom event: the tipped lab launches its chatbot (5.1.1).
    Chatbot,
}

/// One Pdoomberg Wire headline (spec 5.18; 8 News feed: date and industry tag).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Headline {
    pub date: Date,
    /// The industry tag (8 News feed), when the story has one.
    pub industry: Option<IndustryId>,
    /// The company the story is about, when there is one (5.1.2 news on listed companies).
    pub company: Option<CompanyId>,
    pub kind: HeadlineKind,
    pub text: String,
}

impl Headline {
    /// Always [`BYLINE`] (spec 5.18 A).
    pub fn byline(&self) -> &'static str {
        BYLINE
    }

    /// The 5.1.2 confidence points this headline carries for its company's exchange, if any:
    /// beats and misses, bankruptcies and rating changes of 2+ notches.
    pub fn confidence(&self) -> Option<ConfidenceHeadline> {
        match &self.kind {
            HeadlineKind::Result { tag, .. } => Some(match tag {
                SurpriseTag::BigBeat => ConfidenceHeadline::BigBeat,
                SurpriseTag::Beat => ConfidenceHeadline::Beat,
                SurpriseTag::Miss => ConfidenceHeadline::Miss,
                SurpriseTag::BigMiss => ConfidenceHeadline::BigMiss,
            }),
            HeadlineKind::Bankruptcy => Some(ConfidenceHeadline::Bankruptcy),
            HeadlineKind::RatingChange { from, to } => Some(ConfidenceHeadline::RatingChange {
                notches: notches_between(*from, *to),
            }),
            _ => None,
        }
    }
}

fn headline(
    date: Date,
    industry: Option<IndustryId>,
    company: Option<CompanyId>,
    kind: HeadlineKind,
    text: String,
) -> Headline {
    Headline {
        date,
        industry,
        company,
        kind,
        text,
    }
}

/// A whole percent for a headline (|s| × 100, rounded).
fn pct(x: f64) -> String {
    format!("{:.0}", (x.abs() * PERCENT).round())
}

/// Spec 5.18: each phase change posts one headline for the industry (D279: "[Industry] moves
/// from [old] to [new]").
pub fn phase_change(
    date: Date,
    industry: IndustryId,
    industry_name: &str,
    from: PhaseLabel,
    to: PhaseLabel,
) -> Headline {
    headline(
        date,
        Some(industry),
        None,
        HeadlineKind::PhaseChange { from, to },
        format!(
            "{industry_name} moves from {} to {}",
            from.name(),
            to.name()
        ),
    )
}

/// A release-day beat or miss (spec 5.18, 5.15 tags; D279), or None inside ±5%.
pub fn result(
    date: Date,
    industry: IndustryId,
    company: CompanyId,
    name: &str,
    surprise: f64,
) -> Option<Headline> {
    let tag = SurpriseTag::from_surprise(surprise)?;
    let p = pct(surprise);
    let text = match tag {
        SurpriseTag::BigBeat => format!("{name} posts a big beat, {p}% over consensus"),
        SurpriseTag::Beat => format!("{name} beats consensus by {p}%"),
        SurpriseTag::Miss => format!("{name} misses consensus by {p}%"),
        SurpriseTag::BigMiss => format!("{name} posts a big miss, {p}% under consensus"),
    };
    Some(headline(
        date,
        Some(industry),
        Some(company),
        HeadlineKind::Result { tag, surprise },
        text,
    ))
}

/// Release picks: (company, surprise s), in post order.
pub type Picks = Vec<(CompanyId, f64)>;

/// The release's picks (spec 5.18 "the five largest beats and misses"; D279): the five largest
/// beats (s above +5%, largest first) and the five largest misses (s below −5%, worst first),
/// ties to the lower id. Input is (company, s) for every company that reported.
pub fn top_results(results: &[(CompanyId, f64)]) -> (Picks, Picks) {
    let mut beats: Vec<(CompanyId, f64)> = results
        .iter()
        .copied()
        .filter(|(_, s)| {
            matches!(
                SurpriseTag::from_surprise(*s),
                Some(SurpriseTag::Beat | SurpriseTag::BigBeat)
            )
        })
        .collect();
    beats.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
    beats.truncate(TOP_RESULTS);
    let mut misses: Vec<(CompanyId, f64)> = results
        .iter()
        .copied()
        .filter(|(_, s)| {
            matches!(
                SurpriseTag::from_surprise(*s),
                Some(SurpriseTag::Miss | SurpriseTag::BigMiss)
            )
        })
        .collect();
    misses.sort_by(|a, b| a.1.total_cmp(&b.1).then(a.0.cmp(&b.0)));
    misses.truncate(TOP_RESULTS);
    (beats, misses)
}

/// Spec 5.18: a bankruptcy (5.12 step 2).
pub fn bankruptcy(date: Date, industry: IndustryId, company: CompanyId, name: &str) -> Headline {
    headline(
        date,
        Some(industry),
        Some(company),
        HeadlineKind::Bankruptcy,
        format!("{name} goes bankrupt; shareholders wiped out"),
    )
}

/// Spec 5.18: a removal (5.12 step 3).
pub fn removal(date: Date, industry: IndustryId, company: CompanyId, name: &str) -> Headline {
    headline(
        date,
        Some(industry),
        Some(company),
        HeadlineKind::Removal,
        format!("{name} is wound up and removed after its bankruptcy"),
    )
}

/// Spec 5.18: a rating change of 2+ notches, or None for a smaller move.
pub fn rating_change(
    date: Date,
    industry: IndustryId,
    company: CompanyId,
    name: &str,
    from: Rating,
    to: Rating,
) -> Option<Headline> {
    let n = notches_between(from, to);
    if n.unsigned_abs() < RATING_HEADLINE_MIN_NOTCHES {
        return None;
    }
    let verb = if n > 0 { "upgraded" } else { "downgraded" };
    Some(headline(
        date,
        Some(industry),
        Some(company),
        HeadlineKind::RatingChange { from, to },
        format!(
            "{name} {verb} {} notches to {}, from {}",
            n.unsigned_abs(),
            to.label(),
            from.label()
        ),
    ))
}

/// Spec 5.18, 6.6: a raise that succeeded.
pub fn raise(
    date: Date,
    industry: IndustryId,
    company: CompanyId,
    name: &str,
    method: RaiseMethod,
    net_usd: f64,
) -> Headline {
    let how = match method {
        RaiseMethod::CreditLine => "on its credit line",
        RaiseMethod::ShareIssue => "in a share issue",
    };
    headline(
        date,
        Some(industry),
        Some(company),
        HeadlineKind::Raise { method, net_usd },
        format!("{name} raises ${:.1}M {how}", net_usd / USD_PER_MILLION),
    )
}

/// Spec 5.18, 6.6: a raise that failed.
pub fn failed_raise(
    date: Date,
    industry: IndustryId,
    company: CompanyId,
    name: &str,
    method: RaiseMethod,
) -> Headline {
    let how = match method {
        RaiseMethod::CreditLine => "draw on its credit line",
        RaiseMethod::ShareIssue => "sell new shares",
    };
    headline(
        date,
        Some(industry),
        Some(company),
        HeadlineKind::FailedRaise { method },
        format!("{name} fails to {how}"),
    )
}

/// Spec 5.18: a fixed startup event posts its own line (D279: "[event name]: [n] new
/// startups").
pub fn fixed_event(date: Date, event_id: &str, event_name: &str, startups: u32) -> Headline {
    headline(
        date,
        None,
        None,
        HeadlineKind::FixedStartupEvent {
            event: event_id.to_string(),
            startups,
        },
        format!("{event_name}: {startups} new startups"),
    )
}

/// Spec 5.18 F4: "[tipped lab]'s chatbot sets off a startup rush: [n] new AI labs".
pub fn chatbot_rush(
    date: Date,
    event_id: &str,
    ai_labs: IndustryId,
    tipped_lab: &str,
    n: u32,
) -> Headline {
    headline(
        date,
        Some(ai_labs),
        None,
        HeadlineKind::FixedStartupEvent {
            event: event_id.to_string(),
            startups: n,
        },
        format!("{tipped_lab}'s chatbot sets off a startup rush: {n} new AI labs"),
    )
}

/// Spec 5.18: a random event's startup, "[Name] launches in [industry] in [city or province]".
pub fn startup_launch(
    date: Date,
    industry: IndustryId,
    company: CompanyId,
    name: &str,
    industry_name: &str,
    place: &str,
) -> Headline {
    headline(
        date,
        Some(industry),
        Some(company),
        HeadlineKind::StartupLaunch,
        format!("{name} launches in {industry_name} in {place}"),
    )
}

/// Spec 5.18: a hot cluster, "[n] startups launch in [industry] in [city]".
pub fn hot_cluster(
    date: Date,
    industry: IndustryId,
    industry_name: &str,
    place: &str,
    n: u32,
) -> Headline {
    headline(
        date,
        Some(industry),
        None,
        HeadlineKind::HotCluster { startups: n },
        format!("{n} startups launch in {industry_name} in {place}"),
    )
}

/// Spec 5.18: an IPO vote, "[Name] board votes to list on [exchange code], [yes] to [no]" or
/// "[Name] board votes against listing, [no] to [yes]". `votes` is (yes, no).
pub fn ipo_vote(
    date: Date,
    industry: IndustryId,
    company: CompanyId,
    name: &str,
    exchange: &str,
    passed: bool,
    (yes, no): (u32, u32),
) -> Headline {
    let text = if passed {
        format!("{name} board votes to list on {exchange}, {yes} to {no}")
    } else {
        format!("{name} board votes against listing, {no} to {yes}")
    };
    headline(
        date,
        Some(industry),
        Some(company),
        HeadlineKind::IpoVote {
            passed,
            yes,
            no,
            exchange: exchange.to_string(),
        },
        text,
    )
}

/// Spec 5.18: a listing, "[Name] lists on [exchange code] at $[price], raising $[net]M".
pub fn listing(
    date: Date,
    industry: IndustryId,
    company: CompanyId,
    name: &str,
    exchange: &str,
    price: f64,
    net_usd: f64,
) -> Headline {
    headline(
        date,
        Some(industry),
        Some(company),
        HeadlineKind::Listing {
            exchange: exchange.to_string(),
            price,
            net_usd,
        },
        format!(
            "{name} lists on {exchange} at ${price:.0}, raising ${:.1}M",
            net_usd / USD_PER_MILLION
        ),
    )
}

/// Spec 5.1.1, 5.18: the boom event, "[tipped lab] launches its chatbot".
pub fn chatbot(
    date: Date,
    ai_labs: IndustryId,
    company: Option<CompanyId>,
    tipped_lab: &str,
) -> Headline {
    headline(
        date,
        Some(ai_labs),
        company,
        HeadlineKind::Chatbot,
        format!("{tipped_lab} launches its chatbot"),
    )
}

/// The five candidate labs for the tip (7-starting-world 7.6: "rows in AI labs", A; D281): the
/// five largest AI labs companies by starting revenue, ties to the lower id. Input is (company,
/// starting revenue) of every AI labs company.
pub fn tipped_lab_candidates(labs: &[(CompanyId, f64)]) -> Vec<CompanyId> {
    let mut v = labs.to_vec();
    v.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
    v.into_iter()
        .take(TIPPED_LAB_CANDIDATES)
        .map(|(id, _)| id)
        .collect()
}

/// The tipped lab (spec 5.1.1 A, D111, D281): one candidate, uniform on the gen stream, drawn
/// at load right after the pop roll. None with no candidate.
pub fn draw_tipped_lab(candidates: &[CompanyId], draws: &mut dyn DrawSource) -> Option<CompanyId> {
    if candidates.is_empty() {
        return None;
    }
    let i = draws.int_inclusive(Stream::Gen, 0, candidates.len() as i64 - 1);
    Some(candidates[i as usize])
}

/// The wire (spec 4.2 step 5, 8 News feed): headlines queue as their jobs make them and post
/// with the next daily job; the feed keeps them in post order.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct NewsWire {
    pub queued: Vec<Headline>,
    pub feed: Vec<Headline>,
}

impl NewsWire {
    pub fn queue(&mut self, h: Headline) {
        self.queued.push(h);
    }

    /// 4.2 step 5: posts every queued headline dated on or before `today`, in queue order, and
    /// returns them (the day's headlines, for 4.2 step 6's confidence news).
    pub fn post_day(&mut self, today: Date) -> Vec<Headline> {
        let (post, keep): (Vec<Headline>, Vec<Headline>) = std::mem::take(&mut self.queued)
            .into_iter()
            .partition(|h| h.date <= today);
        self.queued = keep;
        self.feed.extend(post.iter().cloned());
        post
    }

    /// Headlines posted since `since` (9.2 `get_news(since, filter)`), oldest first.
    pub fn since(&self, since: Date) -> impl Iterator<Item = &Headline> {
        self.feed.iter().filter(move |h| h.date >= since)
    }
}
