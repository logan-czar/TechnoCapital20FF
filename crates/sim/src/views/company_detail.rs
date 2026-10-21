//! v_company_detail: `get_company` and `get_company_board` (spec 9.2), the Company screen's
//! header, its Overview tab (management score, confidence factor, cash, line, rating, status,
//! archetype; M5 adds value and price, M6 the next release's projection) and its Board tab (seat
//! cards for labor units 1 to 5 with the skill used, spec 8). Rebuilt monthly and on load (spec
//! 9.4). Removed companies stay in the list (ids are row indices) with status Removed; screens
//! drop them (spec 5.12 step 3).

use super::{Cadence, ViewData, ViewInput};
use crate::ai::archetype::Archetype;
use crate::finance::distress::CompanyStatus;
use crate::finance::rating::Rating;
use crate::people::board::{Seat, Skills};
use crate::people::management::{EMPTY_SEAT_SKILL, Member, confidence_factor, member_skill};
use crate::people::traits::Trait;
use crate::market::fair_value::shown_value;
use crate::world::{
    CharacterId, CompanyId, CountryId, IndustryId, Ordinal, ProvinceId, SeatHolder, World, ZoneId,
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
    pub cash_usd: f64,
    pub line_drawn_usd: f64,
    /// The credit line limit (spec 5.12).
    pub line_limit_usd: f64,
    /// The credit rating (spec 5.12).
    pub rating: Rating,
    /// Active, Distressed, Bankrupt or Removed (spec 3.5, 5.12).
    pub status: CompanyStatus,
    /// Spec 6.1.
    pub archetype: Archetype,
    /// Shares outstanding (spec 3.10).
    pub shares_out: u64,
    /// The listing exchange (spec 5.14), `None` while private; quoted unless delisted.
    pub exchange: Option<ZoneId>,
    pub quoted: bool,
    /// P at the rebuild, USD a share (5.14); 0 for a private or delisted company.
    pub price: f64,
    /// The estimated fair value a share shown for a listed company (3.14.2), or a private
    /// company's 0.7 × V (spec 5.13 step 6).
    pub shown_value_per_share: f64,
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

fn person(w: &World, holder: &SeatHolder) -> SeatPerson {
    match holder {
        SeatHolder::Simple(s) => SeatPerson {
            name: s.character.name.clone(),
            age: s.character.age,
            skills: s.character.skills,
            traits: s.character.traits.clone(),
            partial: true,
            character: None,
        },
        SeatHolder::Full(id) => {
            let ch = &w.characters[*id];
            SeatPerson {
                name: ch.name.clone(),
                age: ch.age,
                skills: ch.skills,
                traits: ch.traits.clone(),
                partial: false,
                character: Some(*id),
            }
        }
    }
}

impl ViewData for CompanyDetailView {
    const CADENCE: Cadence = Cadence::Monthly;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
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
                let shown = match s.exchange {
                    Some(_) => s.value * (1.0 + s.efv_error),
                    None => shown_value(s.value, false),
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
                    cash_usd: c.cash_usd,
                    line_drawn_usd: c.finance.line.drawn,
                    line_limit_usd: c.finance.line.limit,
                    rating: c.finance.rating,
                    status: c.finance.status(),
                    archetype: c.archetype,
                    shares_out: c.shares_out,
                    exchange: s.exchange,
                    quoted: s.quoted,
                    price: s.price,
                    shown_value_per_share: shown,
                    buzz: s.buzz,
                    board,
                }
            })
            .collect();
        CompanyDetailView { companies }
    }
}
