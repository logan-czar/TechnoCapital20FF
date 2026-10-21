//! v_company_detail: `get_company` and `get_company_board` (spec 9.2), the Company screen's
//! header, the M3 part of its Overview tab (management score, confidence factor, cash and line)
//! and its Board tab (seat cards for labor units 1 to 5 with the skill used, spec 8). M4 adds the
//! rest of the Overview (value, price, rating, next release) and `get_company_cap_table`.
//! Rebuilt monthly and on load (spec 9.4).

use super::{Cadence, ViewData, ViewInput};
use crate::people::board::{Seat, Skills};
use crate::people::management::{EMPTY_SEAT_SKILL, Member, confidence_factor, member_skill};
use crate::people::traits::Trait;
use crate::world::{
    CharacterId, CompanyId, CountryId, IndustryId, Ordinal, ProvinceId, SeatHolder, World,
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
                    line_drawn_usd: c.line_drawn_usd,
                    board,
                }
            })
            .collect();
        CompanyDetailView { companies }
    }
}
