//! Hover name cards' content (20-ui 20.3.3; D454): a few compact facts and links for each page
//! kind, read from the views only (spec 9). Private companies publish nothing (spec 1), so their
//! figures are "?" unless Omniscient is on (debug builds), as in the M7 demo tables; lane A1's
//! estimate bands replace the "?" in Phase B.

use bevy::prelude::Color;
use sim::SimViews;
use sim::finance::distress::CompanyStatus;

use crate::command::index::{NameIndex, event_name};
use crate::pages::PageRef;
use crate::table::format::{self, GainUnit};
use crate::ui::theme::color;

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

/// The card of `page`.
pub fn card(page: &PageRef, v: &SimViews, index: &NameIndex, omniscient: bool) -> Card {
    let title = index.title(page);
    let kind = page.kind().name();
    let mut lines = Vec::new();
    let name = |p: PageRef| (index.title(&p), p);
    match page {
        PageRef::Company(id) => {
            let row = v.company_rows.get().rows.iter().find(|r| r.id == *id);
            let detail = v.company_detail.get().get(*id);
            if let Some(r) = row {
                let listed = r.public && !r.ticker.is_empty();
                lines.push(CardLine::new(
                    "Ticker",
                    if listed { r.ticker.as_str() } else { "private" },
                ));
                let (n, p) = name(PageRef::Industry(r.industry));
                lines.push(CardLine::link("Industry", n, p));
                let (n, p) = name(PageRef::Country(r.hq_country));
                lines.push(CardLine::link("HQ", n, p));
                if r.status != CompanyStatus::Active {
                    lines.push(CardLine::colored(
                        "Status",
                        status_name(r.status),
                        color::MAGENTA,
                    ));
                }
                if let Some(q) = v.quotes.get().get(*id) {
                    lines.push(CardLine::new("Price", format::price(q.last)));
                    lines.push(CardLine::colored(
                        "Day",
                        format::gain(q.change_pct, GainUnit::Percent),
                        format::Cell::Gain(q.change_pct, GainUnit::Percent)
                            .color()
                            .unwrap_or(color::TEXT),
                    ));
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
                    lines.push(CardLine::new("Revenue TTM", format::money(r.revenue_ttm)));
                } else if omniscient {
                    lines.push(CardLine::colored(
                        "Revenue TTM",
                        format::money(r.revenue_ttm),
                        color::AMBER,
                    ));
                } else {
                    lines.push(CardLine::new("Revenue TTM", "? (private)"));
                }
            }
            if let Some(d) = detail
                && let (Some(c), Some(n)) = (d.controller, &d.controller_name)
            {
                lines.push(CardLine::link(
                    "Controller",
                    n.clone(),
                    PageRef::Character(c),
                ));
            }
        }
        PageRef::Industry(id) => {
            if let Some(r) = v.industry_rows.get().get(*id) {
                lines.push(CardLine::new("Sector", r.sector.clone()));
                lines.push(CardLine::new("Phase", r.phase_label.name()));
                lines.push(CardLine::colored(
                    "Growth",
                    format::gain(r.growth_annual, GainUnit::Percent),
                    format::Cell::Gain(r.growth_annual, GainUnit::Percent)
                        .color()
                        .unwrap_or(color::TEXT),
                ));
                lines.push(CardLine::new("Long-term", format::percent(r.lt)));
                lines.push(CardLine::new("Supply S", format!("{:.2}", r.supply_ratio)));
                lines.push(CardLine::new("Fringe", format::percent(r.fringe_share)));
                if let Some(&top) = r.top_companies.first() {
                    let (n, p) = name(PageRef::Company(top));
                    lines.push(CardLine::link("Largest", n, p));
                }
            }
        }
        PageRef::Zone(id) => {
            if let Some(z) = v.cycle.get().zones.iter().find(|z| z.id == *id) {
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
                    lines.push(CardLine::new("Index", format!("{i:.1}")));
                }
            }
        }
        PageRef::Exchange(zone) => {
            if let Some(x) = v.exchanges.get().exchanges.iter().find(|x| x.zone == *zone) {
                lines.push(CardLine::new("Code", x.code.clone()));
                lines.push(CardLine::new("Hub", x.hub_city.clone()));
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
        PageRef::Country(id) => {
            let hq = v
                .company_rows
                .get()
                .rows
                .iter()
                .filter(|r| r.hq_country == *id && r.status != CompanyStatus::Removed)
                .count();
            lines.push(CardLine::new("HQ companies", format::int(hq as i64)));
            lines.push(CardLine::new(
                "Details",
                "with the countries view (lane A1)",
            ));
        }
        PageRef::Character(id) => {
            if let Some(e) = index.entry(page) {
                lines.push(CardLine::new("Role", e.detail.clone()));
            }
            let mut seats = 0;
            for c in &v.company_detail.get().companies {
                if c.status == CompanyStatus::Removed {
                    continue;
                }
                let on_board = c
                    .board
                    .iter()
                    .any(|s| s.holder.as_ref().is_some_and(|h| h.character == Some(*id)));
                if on_board {
                    seats += 1;
                    if seats <= 3 {
                        lines.push(CardLine::link(
                            "Board",
                            c.name.clone(),
                            PageRef::Company(c.id),
                        ));
                    }
                }
                if c.controller == Some(*id) {
                    lines.push(CardLine::link(
                        "Controls",
                        c.name.clone(),
                        PageRef::Company(c.id),
                    ));
                }
            }
            if seats > 3 {
                lines.push(CardLine::new("Seats", format!("{seats} in all")));
            }
        }
        PageRef::Event(id) => {
            if let Some(e) = v.births.get().events.iter().find(|e| e.id == *id) {
                lines.push(CardLine::new("Event", event_name(&e.kind, e.date)));
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
        PageRef::Headline { date, n } => {
            if let Some(h) = v
                .news
                .get()
                .feed
                .iter()
                .filter(|h| h.date == *date)
                .nth(*n as usize)
            {
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
            let n = list_len(p, v, index);
            if let Some(n) = n {
                lines.push(CardLine::new("Entries", format::int(n as i64)));
            }
        }
    }
    Card { title, kind, lines }
}

/// How many entries a list page has, from the views.
pub fn list_len(page: &PageRef, v: &SimViews, index: &NameIndex) -> Option<usize> {
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
        PageRef::Zones => v.cycle.get().zones.len(),
        PageRef::Events => v.births.get().events.len(),
        PageRef::Characters => index
            .entries()
            .iter()
            .filter(|e| matches!(e.page, PageRef::Character(_)))
            .count(),
        _ => return None,
    })
}
