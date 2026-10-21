//! v_cap_table: `get_company_cap_table(id)` (spec 9.2; 8 Company Cap table tab, "static
//! holders"). Rebuilt monthly and at the plan lock (spec 9.4; listings and births re-split and
//! add holders there, D153, D159).
//!
//! A starting company holds one `Existing` block (D153). The view splits it with companies.csv's
//! controller stake (D425): the controller's line is `stake × block` (rounded to the nearest
//! share, half away from zero), and an "other holders" line holds the rest (the owner of record
//! and the other holders are not split out in the MVP). A widely held company (no controller)
//! shows the whole block as other holders. A born company shows its real blocks: founders, lead
//! first, the seed investors, then any public float and new investors (D153, D270). Shares are
//! not money, so a cap table is never banded (D420).

use super::{Cadence, ViewData, ViewInput};
use crate::world::{CharacterId, Company, CompanyId, ControllerRef, Holder, Ordinal, World};

/// Who a cap table line belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapHolder {
    /// A starting company's controller with its companies.csv stake of the starting block.
    Controller(ControllerRef),
    /// The rest of a starting company's starting block (D425).
    OtherHolders,
    Founder(CharacterId),
    SeedInvestors,
    PublicFloat,
    NewInvestors,
}

/// One cap table line.
#[derive(Debug, Clone, PartialEq)]
pub struct CapLine {
    pub holder: CapHolder,
    /// The holder's name as a page shows it (a character's, a state's, a company's) or the
    /// block's label.
    pub name: String,
    pub shares: u64,
    /// Share of shares outstanding.
    pub share: f64,
}

/// One company's cap table.
#[derive(Debug, Clone, PartialEq)]
pub struct CapTable {
    pub company: CompanyId,
    pub shares_out: u64,
    /// Lines in cap table order (D153); their shares sum to `shares_out`.
    pub lines: Vec<CapLine>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct CapTableView {
    /// Every company in company id order.
    pub companies: Vec<CapTable>,
}

impl CapTableView {
    /// `get_company_cap_table(id)`.
    pub fn get(&self, id: CompanyId) -> Option<&CapTable> {
        self.companies.get(id.index())
    }
}

/// The label of the rest of a starting company's block.
pub const OTHER_HOLDERS_LABEL: &str = "Other holders";
pub const SEED_INVESTORS_LABEL: &str = "Seed investors";
pub const PUBLIC_FLOAT_LABEL: &str = "Public float";
pub const NEW_INVESTORS_LABEL: &str = "New investors";

/// A company's controller (spec 3.5): companies.csv's for a starting company (D425), the lead
/// founder for a born one (5.19.3).
pub fn controller_of(c: &Company) -> ControllerRef {
    match &c.start_control {
        Some(sc) => sc.controller,
        None => c.controller.map_or(ControllerRef::None, ControllerRef::Character),
    }
}

/// A controller's name: a character's, a state's (its country) or a company's; None when
/// widely held.
pub fn controller_name(w: &World, r: ControllerRef) -> Option<String> {
    match r {
        ControllerRef::None => None,
        ControllerRef::Character(ch) => Some(w.characters[ch].name.clone()),
        ControllerRef::State(country) => Some(w.countries[country].name.clone()),
        ControllerRef::Company(co) => Some(w.companies[co].name.clone()),
    }
}

/// The controller's shares of a starting block of `block` shares (D425): `stake × block`
/// rounded half away from zero, at most the block; 0 with no controller or stake.
pub fn controller_shares(c: &Company, block: u64) -> u64 {
    let Some(sc) = &c.start_control else {
        return 0;
    };
    match (sc.controller, sc.stake) {
        (ControllerRef::None, _) | (_, None) => 0,
        (_, Some(stake)) => ((block as f64 * stake).round() as u64).min(block),
    }
}

/// Every line of company `c`'s cap table, in holder order.
pub fn cap_lines(w: &World, c: &Company) -> Vec<CapLine> {
    let total = c.shares_out.max(1) as f64;
    let mut lines = Vec::new();
    let mut push = |holder, name: String, shares: u64| {
        if shares > 0 {
            lines.push(CapLine {
                holder,
                name,
                shares,
                share: shares as f64 / total,
            });
        }
    };
    for h in &c.holders {
        match h.holder {
            Holder::Existing => {
                let controller = controller_of(c);
                let held = controller_shares(c, h.shares);
                if let Some(name) = controller_name(w, controller) {
                    push(CapHolder::Controller(controller), name, held);
                }
                push(
                    CapHolder::OtherHolders,
                    OTHER_HOLDERS_LABEL.into(),
                    h.shares - held,
                );
            }
            Holder::Founder(ch) => push(
                CapHolder::Founder(ch),
                w.characters[ch].name.clone(),
                h.shares,
            ),
            Holder::SeedInvestors => push(
                CapHolder::SeedInvestors,
                SEED_INVESTORS_LABEL.into(),
                h.shares,
            ),
            Holder::PublicFloat => push(
                CapHolder::PublicFloat,
                PUBLIC_FLOAT_LABEL.into(),
                h.shares,
            ),
            Holder::NewInvestors => push(
                CapHolder::NewInvestors,
                NEW_INVESTORS_LABEL.into(),
                h.shares,
            ),
        }
    }
    lines
}

impl ViewData for CapTableView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let companies = w
            .companies
            .iter()
            .map(|(id, c)| CapTable {
                company: id,
                shares_out: c.shares_out,
                lines: cap_lines(w, c),
            })
            .collect();
        CapTableView { companies }
    }
}
