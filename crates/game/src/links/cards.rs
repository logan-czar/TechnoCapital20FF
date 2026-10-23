//! Hover name cards' content (20-ui 20.3.3; D454, D463): a few compact facts and links for each
//! page kind, read from the views only (spec 9). Every money figure goes through
//! [`format::figure_in`] (D461): a company that does not publish (private, or a new listing
//! before its first release) shows estimate bands, as the views serve them (D420); Omniscient
//! (debug builds) turns them exact in the views, so the cards have no Omniscient branch.
//! Places, controllers and roles come from lane A1's places, countries, zones and characters
//! views, and each is a link.

use bevy::prelude::Color;
use sim::SimViews;
use sim::finance::distress::CompanyStatus;
use sim::views::estimate::Figure;

use super::names::{self, controller_page};
use crate::command::index::NameIndex;
use crate::pages::{PageKind, PageRef};
use crate::table::format::{self, BAND_TEXT, Cell, GainUnit, Unit};
use crate::ui::theme::color;
use sim::world::{ProvinceId, ZoneId};

/// Most roles a character card lists before it sums the rest.
pub const CARD_ROLES: usize = 4;

/// One fact: a label and a value, maybe colored or a link.
#[derive(Debug, Clone, PartialEq)]
pub struct CardLine {
    pub label: String,
    pub value: String,
    pub color: Option<Color>,
    pub link: Option<PageRef>,
}

impl CardLine {
    fn new(label: &str, value: impl Into<String>) -> CardLine {
        CardLine {
            label: label.to_owned(),
            value: value.into(),
            color: None,
            link: None,
        }
    }

    fn link(label: &str, value: impl Into<String>, page: PageRef) -> CardLine {
        CardLine {
            link: Some(page),
            ..CardLine::new(label, value)
        }
    }

    fn colored(label: &str, value: impl Into<String>, c: Color) -> CardLine {
        CardLine {
            color: Some(c),
            ..CardLine::new(label, value)
        }
    }

    /// A view's figure (D461): exact as is, a band as its range in the estimate color.
    fn figure(label: &str, f: Figure, unit: Unit) -> CardLine {
        let cell = Cell::figure(f, unit);
        CardLine {
            color: cell.color(),
            ..CardLine::new(label, cell.display())
        }
    }

    fn gain(label: &str, v: f64) -> CardLine {
        let cell = Cell::Gain(v, GainUnit::Percent);
        CardLine::colored(label, cell.display(), cell.color().unwrap_or(color::TEXT))
    }
}

/// A name card.
#[derive(Debug, Clone, PartialEq)]
pub struct Card {
    pub title: String,
    pub kind: &'static str,
    pub lines: Vec<CardLine>,
}

fn status_name(s: CompanyStatus) -> &'static str {
    match s {
        CompanyStatus::Active => "Active",
        CompanyStatus::Distressed => "Distressed",
        CompanyStatus::Bankrupt => "Bankrupt",
        CompanyStatus::Removed => "Removed",
    }
}

/// The line that says a card's figures are estimates.
fn estimate_note() -> CardLine {
    CardLine::colored("Figures", "estimates: not published", BAND_TEXT)
}

/// The card of `page`.
pub fn card(page: &PageRef, v: &SimViews, index: &NameIndex) -> Card {
    let title = index.title(page);
    let kind = page.kind().name();
    let mut lines = Vec::new();
    let name = |p: PageRef| (index.title(&p), p);
    match page {
        PageRef::Company(id) => company(*id, v, index, &mut lines),
        PageRef::Industry(id) => {
            if let Some(r) = v.industry_rows.get().get(*id) {
                lines.push(CardLine::new("Sector", r.sector.clone()));
                lines.push(CardLine::new("Phase", r.phase_label.name()));
                lines.push(CardLine::gain("Growth", r.growth_annual));
                lines.push(CardLine::new("Long-term", format::percent(r.lt)));
                lines.push(CardLine::figure("Supply S", r.supply_ratio, Unit::Ratio));
                lines.push(CardLine::figure("Fringe", r.fringe_share, Unit::Percent));
                if let Some(&top) = r.top_companies.first() {
                    let (n, p) = name(PageRef::Company(top));
                    lines.push(CardLine::link("Largest", n, p));
                }
                if r.estimated {
                    lines.push(estimate_note());
                }
            }
        }
        PageRef::Zone(id) => {
            if let Some(z) = v.zones.get().get(*id) {
                lines.push(CardLine::new("Zone", format!("{}", z.number)));
                let (n, p) = name(PageRef::Exchange(z.id));
                lines.push(CardLine::link(
                    "Exchange",
                    format!("{} {n}", z.exchange_code),
                    p,
                ));
                lines.push(CardLine::new("Effect", format!("{:+.3}", z.effect)));
                lines.push(CardLine::new(
                    "Credit spread",
                    format::percent(z.credit_spread),
                ));
                lines.push(CardLine::new("Confidence", format!("{:+.0}", z.confidence)));
                if let Some(i) = z.index_close {
                    lines.push(CardLine::new("Index", format!("{} {i:.1}", z.index_name)));
                }
                lines.push(CardLine::new("GDP share", format::percent(z.gdp_share)));
                lines.push(CardLine::new(
                    "Countries",
                    format::int(z.members.len() as i64),
                ));
            }
        }
        PageRef::Exchange(zone) => {
            if let Some(x) = v.exchanges.get().exchanges.iter().find(|x| x.zone == *zone) {
                lines.push(CardLine::new("Code", x.code.clone()));
                match names::place(v, x.hub_province) {
                    Some((n, p)) => lines.push(CardLine::link("Hub", n, p)),
                    None => lines.push(CardLine::new("Hub", x.hub_city.clone())),
                }
                lines.push(CardLine::new(
                    "Index",
                    match x.level {
                        Some(l) => format!("{} {l:.1}", x.index_name),
                        None => format!("{} ?", x.index_name),
                    },
                ));
                lines.push(CardLine::new("Listed", format::int(x.listed_count as i64)));
                lines.push(CardLine::new("Confidence", format!("{:+.0}", x.confidence)));
                let (n, p) = name(PageRef::Zone(x.zone));
                lines.push(CardLine::link("Zone", n, p));
            }
        }
        PageRef::Province(id) => province(*id, v, index, &mut lines),
        PageRef::Country(id) => {
            if let Some(c) = v.countries.get().get(*id) {
                lines.push(CardLine::new("ISO3", c.iso3.clone()));
                lines.push(CardLine::new("Region", c.superregion.clone()));
                let (n, p) = name(PageRef::Zone(c.zone));
                lines.push(CardLine::link("Zone", n, p));
                lines.push(CardLine::new("GDP", format::money(c.gdp_usd)));
                lines.push(CardLine::new("Corp tax", format::percent(c.corp_tax_rate)));
                lines.push(CardLine::new(
                    "Sovereign",
                    format!(
                        "{} (+{})",
                        c.sovereign_rating.label(),
                        format::percent(c.sovereign_spread)
                    ),
                ));
                lines.push(CardLine::new(
                    "HQ companies",
                    format::int(c.hq_companies.len() as i64),
                ));
            }
        }
        PageRef::Character(id) => {
            if let Some(c) = v.characters.get().get(*id) {
                lines.push(CardLine::new("Age", format!("{}", c.age)));
                if let Some(h) = &c.home {
                    let (n, p) = names::place(v, h.province).unwrap_or_else(|| {
                        (
                            format!("{}, {}", h.province_name, h.country_name),
                            PageRef::Country(h.country),
                        )
                    });
                    lines.push(CardLine::link("Home", n, p));
                }
                if !c.tier.is_empty() {
                    lines.push(CardLine::new("Tier", c.tier.clone()));
                }
                for r in c.roles.iter().take(CARD_ROLES) {
                    let (label, co) = names::role(r);
                    let (n, p) = name(PageRef::Company(co));
                    lines.push(CardLine::link(label, n, p));
                }
                if c.roles.len() > CARD_ROLES {
                    lines.push(CardLine::new("Roles", format!("{} in all", c.roles.len())));
                }
                if !c.holdings.is_empty() {
                    lines.push(CardLine::new(
                        "Holdings",
                        format!("{} companies", c.holdings.len()),
                    ));
                }
            }
        }
        PageRef::Event(id) => {
            if let Some(e) = v.births.get().events.iter().find(|e| e.id == *id) {
                lines.push(CardLine::new("Event", e.name.clone()));
                lines.push(CardLine::new("Date", format::date(e.date)));
                for &i in e.industries.iter().take(3) {
                    let (n, p) = name(PageRef::Industry(i));
                    lines.push(CardLine::link("Industry", n, p));
                }
                lines.push(CardLine::new(
                    "Startups",
                    format::int(e.startups.len() as i64),
                ));
            }
        }
        PageRef::Recap(q) => {
            lines.push(CardLine::new("Quarter", q.to_string()));
            lines.push(CardLine::new(
                "Opens",
                "in the pre-quarter-end week (spec 8)",
            ));
        }
        PageRef::Headline(id) => {
            if let Some(h) = v.news.get().get(*id) {
                lines.push(CardLine::new("Date", format::date(h.date)));
                lines.push(CardLine::new("Headline", h.text.clone()));
                if let Some(c) = h.company {
                    let (n, p) = name(PageRef::Company(c));
                    lines.push(CardLine::link("Company", n, p));
                }
                if let Some(i) = h.industry {
                    let (n, p) = name(PageRef::Industry(i));
                    lines.push(CardLine::link("Industry", n, p));
                }
            }
        }
        p => {
            let n = list_len(p, v);
            if let Some(n) = n {
                lines.push(CardLine::new("Entries", format::int(n as i64)));
            }
        }
    }
    Card { title, kind, lines }
}

/// HQs a province card names before it sums the rest.
pub const CARD_HQS: usize = 3;

/// A province's development as one line: "C 9 / I 12 / P 16, total 37".
pub fn development_text(c: &sim::views::province_cards::ProvinceCard) -> String {
    format!(
        "C {} / I {} / P {}, total {}",
        c.commerce, c.industry, c.population, c.total
    )
}

/// The province card (spec 8 Map row; D704): its country, region, development and largest
/// track, resource, terrain, Metro, key city and contested tag, then its HQs (the first
/// [`CARD_HQS`] as links) and its units with their gross assets summed as v_units shows them
/// (a band when any unit there is banded, D420, D430).
fn province(id: ProvinceId, v: &SimViews, index: &NameIndex, lines: &mut Vec<CardLine>) {
    use sim::views::province_cards::LargestTrack;
    let Some(c) = v.province_cards.get().get(id) else {
        return;
    };
    let country = PageRef::Country(c.country);
    lines.push(CardLine::link("Country", index.title(&country), country));
    lines.push(CardLine::new(
        "Region",
        if c.area == c.region || c.area.is_empty() {
            c.region.clone()
        } else {
            format!("{} ({})", c.region, c.area)
        },
    ));
    lines.push(CardLine::new("Development", development_text(c)));
    lines.push(CardLine::new(
        "Largest",
        match c.largest_track {
            LargestTrack::Commerce => "Commerce",
            LargestTrack::Industry => "Industry",
            LargestTrack::Both => "Commerce and Industry (tie)",
        },
    ));
    lines.push(CardLine::new("Resource", c.resource.clone()));
    lines.push(CardLine::new(
        "Terrain",
        if c.coastal {
            format!("{}, coastal", c.terrain)
        } else {
            c.terrain.clone()
        },
    ));
    lines.push(CardLine::new(
        "Metro",
        c.metro.clone().unwrap_or_else(|| "none".into()),
    ));
    lines.push(CardLine::new(
        "Key city",
        c.key_city.clone().unwrap_or_else(|| "none".into()),
    ));
    if let Some(t) = &c.contested {
        lines.push(CardLine::colored("Contested", t.clone(), color::MAGENTA));
    }
    lines.push(CardLine::new("HQs", format::int(c.hqs.len() as i64)));
    for &co in c.hqs.iter().take(CARD_HQS) {
        let p = PageRef::Company(co);
        lines.push(CardLine::link("", index.title(&p), p));
    }
    if c.hqs.len() > CARD_HQS {
        lines.push(CardLine::new(
            "",
            format!("and {} more", c.hqs.len() - CARD_HQS),
        ));
    }
    let units = v.units.get();
    let here: Vec<_> = c.units.iter().filter_map(|&u| units.get(u)).collect();
    let mut companies: Vec<_> = here.iter().map(|u| u.company).collect();
    companies.sort_unstable();
    companies.dedup();
    lines.push(CardLine::new(
        "Units",
        format!(
            "{} of {} companies",
            format::int(here.len() as i64),
            format::int(companies.len() as i64)
        ),
    ));
    if !here.is_empty() {
        lines.push(CardLine::figure(
            "Unit assets",
            Figure::sum(here.iter().map(|u| u.gross_assets)),
            Unit::Money,
        ));
        if here.iter().any(|u| u.estimated) {
            lines.push(estimate_note());
        }
    }
}

/// Members a zone hover card names before it sums the rest.
pub const CARD_MEMBERS: usize = 4;

/// The Financial zones mode's hover card (spec 8 Map row, batches 152, 155 and 157): the zone
/// under the pointer with its number, members, intensity, lag, contagion, listed company count,
/// base and effective credit spread and investor confidence, and its current effect; the
/// hovered province names the card's first line. From v_cycle, v_zones and v_exchanges.
pub fn zone_hover_card(
    zone: ZoneId,
    province: Option<ProvinceId>,
    v: &SimViews,
    index: &NameIndex,
) -> Card {
    let page = PageRef::Zone(zone);
    let mut lines = Vec::new();
    if let Some(p) = province {
        let pr = PageRef::Province(p);
        lines.push(CardLine::link("Province", index.title(&pr), pr));
    }
    let cycle = v.cycle.get().zones.iter().find(|z| z.id == zone);
    let row = v.zones.get().get(zone);
    if let Some(z) = cycle {
        lines.push(CardLine::new("Zone", format!("{} ({})", z.number, z.key)));
    }
    if let Some(r) = row {
        let names: Vec<String> = r
            .members
            .iter()
            .take(CARD_MEMBERS)
            .map(|&c| index.title(&PageRef::Country(c)))
            .collect();
        let more = r.members.len().saturating_sub(CARD_MEMBERS);
        lines.push(CardLine::new(
            "Members",
            if more > 0 {
                format!("{}: {} and {more} more", r.members.len(), names.join(", "))
            } else {
                format!("{}: {}", r.members.len(), names.join(", "))
            },
        ));
    }
    if let Some(z) = cycle {
        lines.push(CardLine::new("Intensity", format!("{:.2}", z.intensity)));
        lines.push(CardLine::new("Lag", format!("{} quarters", z.lag_quarters)));
        lines.push(CardLine::new("Contagion", format!("{:.2}", z.contagion)));
        lines.push(CardLine::new("Effect", format!("{:+.3} a year", z.effect)));
    }
    if let Some(x) = v.exchanges.get().of_zone(zone) {
        let ex = PageRef::Exchange(zone);
        lines.push(CardLine::link("Exchange", x.code.clone(), ex));
        lines.push(CardLine::new("Listed", format::int(x.listed_count as i64)));
    }
    if let Some(z) = cycle {
        lines.push(CardLine::new(
            "Base spread",
            crate::pages::doc::bps(z.credit_spread_base),
        ));
        lines.push(CardLine::new(
            "Credit spread",
            crate::pages::doc::bps(z.credit_spread),
        ));
        lines.push(CardLine::new("Confidence", format!("{:+.0}", z.confidence)));
    }
    Card {
        title: index.title(&page),
        kind: PageKind::Zone.name(),
        lines,
    }
}

/// A company's card lines: ticker, industry, HQ place, status, the quote (listed and quoted),
/// rating, the TTM figures and value (bands for a company that does not publish), controller.
fn company(id: sim::world::CompanyId, v: &SimViews, index: &NameIndex, lines: &mut Vec<CardLine>) {
    let name = |p: PageRef| (index.title(&p), p);
    let Some(r) = v.company_rows.get().rows.iter().find(|r| r.id == id) else {
        return;
    };
    let detail = v.company_detail.get().get(id);
    let listed = r.public && !r.ticker.is_empty();
    lines.push(CardLine::new(
        "Ticker",
        if listed { r.ticker.as_str() } else { "private" },
    ));
    let (n, p) = name(PageRef::Industry(r.industry));
    lines.push(CardLine::link("Industry", n, p));
    let hq = detail
        .and_then(|d| names::place(v, d.hq_province))
        .unwrap_or_else(|| name(PageRef::Country(r.hq_country)));
    lines.push(CardLine::link("HQ", hq.0, hq.1));
    if r.status != CompanyStatus::Active {
        lines.push(CardLine::colored(
            "Status",
            status_name(r.status),
            color::MAGENTA,
        ));
    }
    let quote = v.quotes.get().get(id);
    if let Some(q) = quote {
        lines.push(CardLine::new("Price", format::price(q.last)));
        lines.push(CardLine::gain("Day", q.change_pct));
        lines.push(CardLine::new("Mkt cap", format::money(q.market_cap)));
        lines.push(CardLine::new(
            "Est. value",
            format!(
                "{} ({}-{})",
                format::price(q.efv),
                format::price(q.efv_low),
                format::price(q.efv_high)
            ),
        ));
        let (n, p) = name(PageRef::Exchange(q.exchange));
        lines.push(CardLine::link("Exchange", n, p));
    }
    if listed {
        lines.push(CardLine::new("Rating", r.rating.label()));
    }
    lines.push(CardLine::figure("Revenue TTM", r.revenue_ttm, Unit::Money));
    lines.push(CardLine::figure(
        "Net income",
        r.net_income_ttm,
        Unit::Money,
    ));
    if quote.is_none() {
        // A quoted company's value is its market cap at EFV (above); the rest show 5.13
        // step 6's value, a band while the company does not publish.
        lines.push(CardLine::figure("Value", r.value, Unit::Money));
    }
    if r.estimated {
        lines.push(estimate_note());
    }
    if let (Some(p), Some(n)) = (controller_page(r.controller), &r.controller_name) {
        lines.push(CardLine::link("Controller", n.clone(), p));
    }
}

/// How many entries a list page has, from the views.
pub fn list_len(page: &PageRef, v: &SimViews) -> Option<usize> {
    Some(match page {
        PageRef::Companies => v
            .company_rows
            .get()
            .rows
            .iter()
            .filter(|r| r.status != CompanyStatus::Removed)
            .count(),
        PageRef::Industries => v.industry_rows.get().rows.len(),
        PageRef::News => v.news.get().feed.len(),
        PageRef::Exchanges => v.exchanges.get().exchanges.len(),
        PageRef::Zones => v.zones.get().zones.len(),
        PageRef::Events => v.births.get().events.len(),
        PageRef::Characters => v.characters.get().full.len(),
        PageRef::Countries => v.countries.get().countries.len(),
        _ => return None,
    })
}
