//! Names and link targets for what the views name (D462): places ("Edmonton, Canada", linked to
//! the province's page since M8.7, D707), controllers (a character, a state or a
//! parent company), and a character's roles. Read from lane A1's places, countries and
//! characters views only (spec 9), so no page names a thing by its id.

use sim::SimViews;
use sim::views::characters::Role;
use sim::world::{ControllerRef, ProvinceId};

use crate::command::index::seat_name;
use crate::pages::PageRef;

/// A province's place name ("Edmonton, Canada") and the page its link opens: the province's
/// (M8.7, D707).
pub fn place(v: &SimViews, province: ProvinceId) -> Option<(String, PageRef)> {
    Some((
        v.places.get().place_name(province)?,
        PageRef::Province(province),
    ))
}

/// A place as two links where a page has room (a header field): the province ("Edmonton,")
/// and its country ("Canada"), D707.
pub fn place_spans(v: &SimViews, province: ProvinceId) -> Option<Vec<crate::pages::doc::Span>> {
    use crate::pages::doc::Span;
    let places = v.places.get();
    let p = places.province(province)?;
    let c = places.country(p.country)?;
    Some(vec![
        Span::link(format!("{},", p.name), PageRef::Province(province)),
        Span::link(c.name.clone(), PageRef::Country(p.country)),
    ])
}

/// The page a controller links to: a character's, a state's (its country) or a parent
/// company's; none when widely held.
pub fn controller_page(c: ControllerRef) -> Option<PageRef> {
    match c {
        ControllerRef::None => None,
        ControllerRef::Character(ch) => Some(PageRef::Character(ch)),
        ControllerRef::State(country) => Some(PageRef::Country(country)),
        ControllerRef::Company(co) => Some(PageRef::Company(co)),
    }
}

/// What a role is called, and the company it is at.
pub fn role(r: &Role) -> (&'static str, sim::world::CompanyId) {
    match *r {
        Role::Seat { company, seat } => (seat_name(seat), company),
        Role::Director { company } => ("Director", company),
        Role::Controller { company } => ("Controls", company),
        Role::OwnerOfRecord { company } => ("Owner of record", company),
        Role::Founder {
            company,
            lead: true,
        } => ("Lead founder", company),
        Role::Founder { company, .. } => ("Founder", company),
    }
}

/// A role as a line: "CEO of Arrowhead", "Controls Arrowhead".
pub fn role_text(r: &Role, company: &str) -> String {
    let (label, _) = role(r);
    match r {
        Role::Controller { .. } => format!("{label} {company}"),
        _ => format!("{label} of {company}"),
    }
}
