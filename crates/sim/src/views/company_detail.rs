//! v_company_detail: `get_company` and `get_company_board` (spec 9.2), the Company screen's
//! header, its Overview tab (management score, confidence factor, cash, line, rating, status,
//! archetype; M5 adds value and price, M6 the next release's projection) and its Board tab (seat
//! cards for labor units 1 to 5 with the skill used, spec 8). Rebuilt monthly and on load (spec
//! 9.4), and when Omniscient is toggled (D423). Removed companies stay in the list (ids are row
//! indices) with status Removed; screens drop them (spec 5.12 step 3). A private company's or
//! new listing's cash, line and value are estimate bands (D420).

use super::company_rows::value_shown;
use super::estimate::{Figure, Kind, StatementLine};
use super::{Cadence, ViewData, ViewInput};
use crate::ai::archetype::Archetype;
use crate::finance::distress::CompanyStatus;
use crate::finance::rating::Rating;
use crate::people::board::{Seat, Skills};
use crate::people::management::{EMPTY_SEAT_SKILL, Member, confidence_factor, member_skill};
use crate::people::traits::Trait;
use crate::time::Quarter;
use crate::world::{
    CharacterId, CompanyId, CountryId, Director, IndustryId, IpoVoteRecord, Ordinal, Origin,
    ProvinceId, SeatHolder, SimpleSeat, World, ZoneId,
};

/// Who sits in a seat (spec 3.7, 3.7.1, 3.7.2).
#[derive(Debug, Clone, PartialEq)]
pub struct SeatPerson {
    pub name: String,
    pub age: u8,
    pub skills: Skills,
    pub traits: Vec<Trait>,
    /// A simple (partial) character (spec 8 Board tab: "partial characters are marked").
    pub partial: bool,
    /// The full character's id, for a full character.
    pub character: Option<CharacterId>,
    /// The partial character's 3.7.1 id, for a partial one (v_characters' `partial`).
    pub partial_id: Option<u32>,
}

/// One seat card (spec 8 Board tab).
#[derive(Debug, Clone, PartialEq)]
pub struct SeatCard {
    pub seat: Seat,
    /// The seat exists: the company has that many labor units (spec 3.7). The Chair is never
    /// open in the MVP.
    pub open: bool,
    /// The skill the management score reads for the seat (spec 5.7): the seat skill plus trait
    /// shifts, or 3 when empty.
    pub skill_used: f64,
    pub holder: Option<SeatPerson>,
}

/// One company's header, Overview figures and board.
#[derive(Debug, Clone, PartialEq)]
pub struct CompanyDetail {
    pub id: CompanyId,
    /// companies.csv id.
    pub key: String,
    pub name: String,
    pub ticker: String,
    pub public: bool,
    pub industry: IndustryId,
    pub hq_country: CountryId,
    pub hq_province: ProvinceId,
    /// The named controller when it is a full character.
    pub controller: Option<CharacterId>,
    pub controller_name: Option<String>,
    /// 0 to 100 (spec 5.7) and the investor confidence factor `0.8 + score ÷ 250`.
    pub management_score: f64,
    pub confidence_factor: f64,
    /// Bands for a private company or a new listing (D420).
    pub cash_usd: Figure,
    pub line_drawn_usd: Figure,
    /// The credit line limit (spec 5.12).
    pub line_limit_usd: Figure,
    /// The credit rating (spec 5.12).
    pub rating: Rating,
    /// Active, Distressed, Bankrupt or Removed (spec 3.5, 5.12).
    pub status: CompanyStatus,
    /// Spec 6.1.
    pub archetype: Archetype,
    /// Start or Born (spec 8 header "Founded [date] ([event])"), its founders and directors, and
    /// the last IPO vote with the next vote's quarter (spec 8 Board tab, 5.20.1).
    pub origin: Origin,
    pub founders: Vec<CharacterId>,
    /// The directors (5.19.4 step 4: board seats with no labor unit) in seat position order,
    /// Director 1 first, as the IPO ballots number them (`VoterRole::Director`, D541).
    pub directors: Vec<SeatPerson>,
    pub ipo_last_vote: Option<IpoVoteRecord>,
    pub ipo_next_vote: Option<Quarter>,
    /// Shares outstanding (spec 3.10).
    pub shares_out: u64,
    /// The listing exchange (spec 5.14), `None` while private; quoted unless delisted.
    pub exchange: Option<ZoneId>,
    pub quoted: bool,
    /// P at the rebuild, USD a share (5.14); 0 for a private or delisted company.
    pub price: f64,
    /// The estimated fair value a share shown for a listed company (3.14.2), exact (it is
    /// already an estimate, D140); a private company's 0.7 × V (spec 5.13 step 6) as a band
    /// (D420).
    pub shown_value_per_share: Figure,
    /// The figures are estimate bands (D420).
    pub estimated: bool,
    /// Buzz (3.10).
    pub buzz: f64,
    /// CEO, CFO, CIO, CMO, COO, then the Chair (spec 3.7).
    pub board: Vec<SeatCard>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct CompanyDetailView {
    /// Every company in company id order.
    pub companies: Vec<CompanyDetail>,
}

impl CompanyDetailView {
    /// `get_company(id)` and `get_company_board(id)`.
    pub fn get(&self, id: CompanyId) -> Option<&CompanyDetail> {
        self.companies.get(id.index())
    }
}

fn simple_person(s: &SimpleSeat) -> SeatPerson {
    SeatPerson {
        name: s.character.name.clone(),
        age: s.character.age,
        skills: s.character.skills,
        traits: s.character.traits.clone(),
        partial: true,
        character: None,
        partial_id: Some(s.id),
    }
}

fn full_person(w: &World, id: CharacterId) -> SeatPerson {
    let ch = &w.characters[id];
    SeatPerson {
        name: ch.name.clone(),
        age: ch.age,
        skills: ch.skills,
        traits: ch.traits.clone(),
        partial: false,
        character: Some(id),
        partial_id: None,
    }
}

fn person(w: &World, holder: &SeatHolder) -> SeatPerson {
    match holder {
        SeatHolder::Simple(s) => simple_person(s),
        SeatHolder::Full(id) => full_person(w, *id),
    }
}

/// A director as a seat person (5.19.4 step 4).
fn director(w: &World, d: &Director) -> SeatPerson {
    match d {
        Director::Simple(s) => simple_person(s),
        Director::Full(id) => full_person(w, *id),
    }
}

impl ViewData for CompanyDetailView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;
    const ON_OMNISCIENT: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
        let companies = w
            .companies
            .iter()
            .map(|(id, c)| {
                let mut board: Vec<SeatCard> = Seat::LABOR
                    .iter()
                    .enumerate()
                    .map(|(i, &seat)| {
                        let holder = c.board[i].as_ref().map(|h| person(w, h));
                        let skill_used = holder.as_ref().map_or(EMPTY_SEAT_SKILL, |p| {
                            member_skill(
                                Member {
                                    skills: &p.skills,
                                    traits: &p.traits,
                                },
                                seat,
                            )
                        });
                        SeatCard {
                            seat,
                            open: (i as u64) < c.labor_units,
                            skill_used,
                            holder,
                        }
                    })
                    .collect();
                board.push(SeatCard {
                    seat: Seat::Chair,
                    open: false,
                    skill_used: EMPTY_SEAT_SKILL,
                    holder: None,
                });
                let s = &w.market.stocks[id];
                let banded = est.banded(w, id);
                // A private company's value a share is its total band over the shares (D430).
                let shown = match s.exchange {
                    Some(_) => Figure::Exact(s.value * (1.0 + s.efv_error)),
                    None => value_shown(&est, w, id, banded).over(c.shares_out.max(1) as f64),
                };
                CompanyDetail {
                    id,
                    key: c.key.clone(),
                    name: c.name.clone(),
                    ticker: c.ticker.clone(),
                    public: c.public,
                    industry: c.industry,
                    hq_country: c.hq_country,
                    hq_province: c.hq_province,
                    controller: c.controller,
                    controller_name: c.controller.map(|ch| w.characters[ch].name.clone()),
                    management_score: c.management_score,
                    confidence_factor: confidence_factor(c.management_score),
                    cash_usd: est.company_now(
                        banded,
                        id,
                        Kind::Line(StatementLine::Cash),
                        c.cash_usd,
                    ),
                    line_drawn_usd: est.company_now(
                        banded,
                        id,
                        Kind::Line(StatementLine::BalanceLineDrawn),
                        c.finance.line.drawn,
                    ),
                    line_limit_usd: est.company_now(banded, id, Kind::LineLimit, c.finance.line.limit),
                    rating: c.finance.rating,
                    status: c.finance.status(),
                    archetype: c.archetype,
                    origin: c.origin,
                    founders: c.founders.clone(),
                    directors: c.directors.iter().map(|d| director(w, d)).collect(),
                    ipo_last_vote: c.ipo_last_vote.clone(),
                    ipo_next_vote: c.ipo_next_vote,
                    shares_out: c.shares_out,
                    exchange: s.exchange,
                    quoted: s.quoted,
                    price: s.price,
                    shown_value_per_share: shown,
                    estimated: banded,
                    buzz: s.buzz,
                    board,
                }
            })
            .collect();
        CompanyDetailView { companies }
    }
}
