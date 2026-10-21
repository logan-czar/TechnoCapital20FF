//! v_characters: `list_characters(filter)` and `get_character(id)` (spec 9.2; 3.7.1, 3.7.2; 8
//! Board tab founders' cards): the full characters (the 296 of characters.csv and those made in
//! play) and the partial (simple) characters seated on boards, with name, age, skills, traits,
//! home province and country (full characters only: 3.7.1 gives a simple character none), their
//! roles (seats, directorships, control, owner of record, founder) and holdings (cap table
//! lines, D425). Rebuilt monthly and at the plan lock (spec 9.4: seats fill at 4.3 step 11,
//! casts at the lock, D159). Removed companies are left out of roles and holdings (5.12 step 3).
//! A character's cash is private and not shown.

use super::cap_table::controller_shares;
use super::{Cadence, ViewData, ViewInput};
use crate::people::board::{Seat, Skills};
use crate::people::traits::Trait;
use crate::world::{
    CharacterId, CompanyId, ControllerRef, CountryId, Director, Holder, Ordinal, ProvinceId,
    SeatHolder, SimpleSeat,
};
use crate::finance::distress::CompanyStatus;

/// Which character a row is: a full one by id, or a partial one by its 3.7.1 `id`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum CharacterRef {
    Full(CharacterId),
    Partial(u32),
}

/// A full character's home (spec 3.7.2 home province).
#[derive(Debug, Clone, PartialEq)]
pub struct Home {
    pub province: ProvinceId,
    pub province_name: String,
    pub country: CountryId,
    pub country_name: String,
}

/// One thing a character does at a company.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    /// A labor seat (spec 3.7).
    Seat { company: CompanyId, seat: Seat },
    /// A board seat with no labor unit (5.19.4 step 4).
    Director { company: CompanyId },
    /// The company's named controller (companies.csv, or a startup's lead founder, 5.19.3).
    Controller { company: CompanyId },
    /// companies.csv `owner_of_record` (D425).
    OwnerOfRecord { company: CompanyId },
    /// A founder of a born company (spec 3.5 `founders`), the lead first.
    Founder { company: CompanyId, lead: bool },
}

/// Shares a character holds in one company (spec 3.5 `holders`; D425).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CharacterHolding {
    pub company: CompanyId,
    pub shares: u64,
    /// Share of the company's shares outstanding.
    pub share: f64,
}

/// One character.
#[derive(Debug, Clone, PartialEq)]
pub struct CharacterRow {
    pub id: CharacterRef,
    /// characters.csv `id` for a full character from the data, empty otherwise.
    pub key: String,
    pub name: String,
    pub age: u8,
    pub skills: Skills,
    pub traits: Vec<Trait>,
    /// A full character (3.7.2); false for a partial one (3.7.1; spec 8 "partial characters
    /// are marked").
    pub full: bool,
    /// player, rival, holder or generated (full characters); empty for partial ones.
    pub tier: String,
    pub home: Option<Home>,
    /// In company id order, then seat order.
    pub roles: Vec<Role>,
    /// In company id order.
    pub holdings: Vec<CharacterHolding>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct CharactersView {
    /// Every full character, in character id order.
    pub full: Vec<CharacterRow>,
    /// Every partial character seated now, in 3.7.1 id order.
    pub partial: Vec<CharacterRow>,
}

impl CharactersView {
    /// `get_character(id)`.
    pub fn get(&self, id: CharacterId) -> Option<&CharacterRow> {
        self.full.get(id.index())
    }

    /// A partial character by its 3.7.1 id.
    pub fn partial(&self, id: u32) -> Option<&CharacterRow> {
        self.partial
            .binary_search_by_key(&CharacterRef::Partial(id), |r| r.id)
            .ok()
            .map(|i| &self.partial[i])
    }

    /// `list_characters(filter)`: full characters, then partial ones.
    pub fn list(&self) -> impl Iterator<Item = &CharacterRow> {
        self.full.iter().chain(&self.partial)
    }
}

fn partial_row(s: &SimpleSeat, role: Role) -> CharacterRow {
    let ch = &s.character;
    CharacterRow {
        id: CharacterRef::Partial(s.id),
        key: String::new(),
        name: ch.name.clone(),
        age: ch.age,
        skills: ch.skills,
        traits: ch.traits.clone(),
        full: false,
        tier: String::new(),
        home: None,
        roles: vec![role],
        holdings: Vec::new(),
    }
}

impl ViewData for CharactersView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let mut full: Vec<CharacterRow> = w
            .characters
            .iter()
            .map(|(id, ch)| {
                let province = &w.provinces[ch.home_province];
                CharacterRow {
                    id: CharacterRef::Full(id),
                    key: ch.key.clone(),
                    name: ch.name.clone(),
                    age: ch.age,
                    skills: ch.skills,
                    traits: ch.traits.clone(),
                    full: true,
                    tier: ch.tier.clone(),
                    home: Some(Home {
                        province: ch.home_province,
                        province_name: province.name.clone(),
                        country: province.country,
                        country_name: w.countries[province.country].name.clone(),
                    }),
                    roles: Vec::new(),
                    holdings: Vec::new(),
                }
            })
            .collect();
        let mut partial = Vec::new();
        for (company, c) in w.companies.iter() {
            if c.finance.status() == CompanyStatus::Removed {
                continue;
            }
            for (i, holder) in c.board.iter().enumerate() {
                let role = Role::Seat {
                    company,
                    seat: Seat::LABOR[i],
                };
                match holder {
                    Some(SeatHolder::Full(ch)) => full[ch.index()].roles.push(role),
                    Some(SeatHolder::Simple(s)) => partial.push(partial_row(s, role)),
                    None => {}
                }
            }
            for d in &c.directors {
                let role = Role::Director { company };
                match d {
                    Director::Full(ch) => full[ch.index()].roles.push(role),
                    Director::Simple(s) => partial.push(partial_row(s, role)),
                }
            }
            if let Some(ch) = c.controller {
                full[ch.index()].roles.push(Role::Controller { company });
            }
            if let Some(owner) = c.start_control.as_ref().and_then(|s| s.owner_of_record) {
                full[owner.index()]
                    .roles
                    .push(Role::OwnerOfRecord { company });
            }
            for (i, &ch) in c.founders.iter().enumerate() {
                full[ch.index()].roles.push(Role::Founder {
                    company,
                    lead: i == 0,
                });
            }
            let total = c.shares_out.max(1) as f64;
            for h in &c.holders {
                let held = match h.holder {
                    Holder::Founder(ch) => Some((ch, h.shares)),
                    Holder::Existing => match c.start_control.as_ref().map(|s| s.controller) {
                        Some(ControllerRef::Character(ch)) => {
                            Some((ch, controller_shares(c, h.shares)))
                        }
                        _ => None,
                    },
                    _ => None,
                };
                if let Some((ch, shares)) = held.filter(|&(_, s)| s > 0) {
                    full[ch.index()].holdings.push(CharacterHolding {
                        company,
                        shares,
                        share: shares as f64 / total,
                    });
                }
            }
        }
        partial.sort_by_key(|r| r.id);
        CharactersView { full, partial }
    }
}
