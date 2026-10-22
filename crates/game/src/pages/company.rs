//! The Company page (M9.2 and M9.7; spec 8 Company and Startups and listings, 20-ui 20.7.2):
//! a header with the name, ticker, HQ, industry, owner of record and controller, and the
//! "Founded [date] ([event])" and "Listed [date] on [exchange] at $[price]" lines; then the six
//! spec 8 tabs as sections (Overview, Board, Cap table, Units, Financials, Tech) and a price
//! chart over the EFV band for a listed company. The header's tab strip shows one section at a
//! time, or all (D481).
//!
//! Everything comes from the views (spec 9). Every figure goes through [`Cell::figure`] (D461),
//! so a company that does not publish (private, or a new listing before its first release)
//! shows estimate bands and never its truth; Omniscient (debug builds) makes the views exact.
//! IPO ballots show each member's vote and never the odds (20-ui 20.1, D482).

use bevy::prelude::*;
use sim::SimViews;
use sim::births::ipo::VoterRole;
use sim::finance::distress::CompanyStatus;
use sim::finance::statements::{Period, Statement};
use sim::people::board::Skills;
use sim::people::traits::Trait;
use sim::views::cap_table::CapHolder;
use sim::views::characters::Role;
use sim::views::company_detail::{CompanyDetail, SeatCard, SeatPerson};
use sim::views::company_rows::{CompanyRow, Listing};
use sim::views::estimate::{Figure, StatementLine};
use sim::views::statements::{EstimatedStatement, OperatingFigures, StatementPeriod};
use sim::world::{CharacterId, CompanyId, Origin};

use super::doc::{
    Block, CardDoc, Field, Live, LiveChart, PageDoc, Progress, SectionDoc, Span, TableDoc,
    spawn_doc,
};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, Refresh, SectionSpec, ViewKey};
use crate::bridge::Views;
use crate::chart::ChartModel;
use crate::command::index::{NameIndex, event_name, seat_name};
use crate::config::UiConfig;
use crate::links::names;
use crate::table::format;
use crate::table::{Cell, Column, TableModel, Unit};
use crate::ui::theme::color;

/// The Company page's sections, in default order: the six spec 8 tabs and the price chart.
pub const SECTIONS: &[SectionSpec] = &[
    ("overview", "Overview"),
    ("chart", "Price chart"),
    ("board", "Board"),
    ("cap_table", "Cap table"),
    ("units", "Units"),
    ("financials", "Financials"),
    ("tech", "Tech"),
];

/// Quarters the quarterly statements table shows (newest first).
pub const STATEMENT_QUARTERS: usize = 8;
/// Years the yearly table shows (the archive keeps 5, D228).
pub const STATEMENT_YEARS: usize = 5;

/// The views the page reads. It rebuilds when the monthly, lock and quarterly ones move; the
/// every-tick and daily figures (price, projection, chart) follow by themselves ([`Live`]).
pub const VIEWS: &[ViewKey] = &[
    ViewKey::CompanyRows,
    ViewKey::CompanyDetail,
    ViewKey::Units,
    ViewKey::Tech,
    ViewKey::Statements,
    ViewKey::Ratings,
    ViewKey::CapTable,
    ViewKey::Characters,
    ViewKey::Births,
    ViewKey::Countries,
];

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::Company,
        PageSpec::new(VIEWS)
            .sections(SECTIONS)
            .refresh(Refresh::OnViewChange),
        company_page,
    );
}

fn company_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    cfg: Res<UiConfig>,
) {
    let PageRef::Company(id) = b.page else {
        return;
    };
    let doc = company_doc(id, &views, &index);
    spawn_doc(&mut commands, &b, &doc, &views, &cfg, Some(SECTIONS));
}

/// The price chart of a company with bars: daily bars over each day's EFV band, or the 10-year
/// weekly view once it has more than a year (M9.1, D465).
pub fn price_chart(id: CompanyId, v: &SimViews) -> Option<ChartModel> {
    super::placeholder::placeholder_chart(&PageRef::Company(id), v)
}

/// A character's name as a span: a link for a full character.
fn character_span(index: &NameIndex, id: CharacterId) -> Span {
    let p = PageRef::Character(id);
    Span::link(index.title(&p), p)
}

/// "Fin 7  Ops 5  Per 3  Int 4  Tec 6  Hus 2" (spec 3.7 skills).
pub fn skills_text(s: &Skills) -> String {
    format!(
        "Fin {} Ops {} Per {} Int {} Tec {} Hus {}",
        s.finance, s.operations, s.persuasion, s.intrigue, s.tech, s.hustle
    )
}

pub fn traits_text(t: &[Trait]) -> String {
    if t.is_empty() {
        "none".to_owned()
    } else {
        t.iter().map(|t| t.name()).collect::<Vec<_>>().join(", ")
    }
}

pub fn status_text(s: CompanyStatus) -> &'static str {
    match s {
        CompanyStatus::Active => "Active",
        CompanyStatus::Distressed => "Distressed",
        CompanyStatus::Bankrupt => "Bankrupt",
        CompanyStatus::Removed => "Removed",
    }
}

fn status_color(s: CompanyStatus) -> bevy::color::Color {
    match s {
        CompanyStatus::Active => color::GREEN,
        CompanyStatus::Distressed => color::AMBER,
        CompanyStatus::Bankrupt | CompanyStatus::Removed => color::MAGENTA,
    }
}

/// The whole Company page as data.
pub fn company_doc(id: CompanyId, v: &SimViews, index: &NameIndex) -> PageDoc {
    let page = PageRef::Company(id);
    let mut doc = PageDoc {
        page: page.clone(),
        title: index.title(&page),
        kind: PageKind::Company.name().to_owned(),
        chips: Vec::new(),
        head: Vec::new(),
        sections: Vec::new(),
    };
    let (Some(d), row) = (
        v.company_detail.get().get(id),
        v.company_rows.get().rows.iter().find(|r| r.id == id),
    ) else {
        doc.head.push(Block::Line(vec![Span::muted(
            "No such company in the views.",
        )]));
        return doc;
    };
    doc.chips.push(Span::Colored(
        status_text(d.status).to_owned(),
        status_color(d.status),
    ));
    if d.estimated {
        doc.chips.push(Span::Colored(
            "Figures: estimates (not published)".into(),
            format::BAND_TEXT,
        ));
    }
    doc.head = header(d, row, v, index);
    doc.sections = vec![
        SectionDoc {
            id: "overview",
            blocks: overview(d, row, v),
        },
        SectionDoc {
            id: "chart",
            blocks: chart(id, d, v),
        },
        SectionDoc {
            id: "board",
            blocks: board(d, v, index),
        },
        SectionDoc {
            id: "cap_table",
            blocks: cap_table(id, v),
        },
        SectionDoc {
            id: "units",
            blocks: units(id, v, index),
        },
        SectionDoc {
            id: "financials",
            blocks: financials(id, d, v),
        },
        SectionDoc {
            id: "tech",
            blocks: tech(id, v, index),
        },
    ];
    doc
}

/// The header: identity fields, then the Founded and Listed lines (spec 8; D428).
fn header(
    d: &CompanyDetail,
    row: Option<&CompanyRow>,
    v: &SimViews,
    index: &NameIndex,
) -> Vec<Block> {
    let t = |p: PageRef| Span::link(index.title(&p), p);
    let mut f = vec![Field::text(
        "Ticker",
        if d.ticker.is_empty() {
            "-".to_owned()
        } else {
            d.ticker.clone()
        },
    )];
    f.push(Field::new(
        "HQ",
        vec![match names::place(v, d.hq_province) {
            Some((name, p)) => Span::link(name, p),
            None => t(PageRef::Country(d.hq_country)),
        }],
    ));
    f.push(Field::new(
        "Industry",
        vec![t(PageRef::Industry(d.industry))],
    ));
    f.push(Field::new(
        "Owner of record",
        vec![
            match row.and_then(|r| r.owner_of_record.zip(r.owner_of_record_name.clone())) {
                Some((ch, name)) => Span::link(name, PageRef::Character(ch)),
                None => Span::muted("none named"),
            },
        ],
    ));
    f.push(Field::new(
        "Controller",
        vec![match row
            .and_then(|r| names::controller_page(r.controller).zip(r.controller_name.clone()))
        {
            Some((p, name)) => Span::link(name, p),
            None => Span::muted("widely held"),
        }],
    ));
    f.push(Field::text("Archetype", d.archetype.name()));
    f.push(Field::text(
        "Company id",
        if d.key.is_empty() {
            "born in play".to_owned()
        } else {
            d.key.clone()
        },
    ));
    let mut blocks = vec![Block::Fields(f)];
    // "Founded [date] ([event])" (spec 8 Startups and listings).
    blocks.push(Block::Line(match d.origin {
        Origin::Born { date, event } => {
            let name = v
                .births
                .get()
                .event(event)
                .map_or_else(|| index.title(&PageRef::Event(event)), event_name);
            vec![
                Span::text(format!("Founded {}", format::date(date))),
                Span::muted("("),
                Span::link(name, PageRef::Event(event)),
                Span::muted(")"),
            ]
        }
        Origin::Start => vec![Span::text("Founded before 2020 (a starting company)")],
    }));
    // "Listed [date] on [exchange] at $[price]", or "listed before 2020" (D428).
    let listing = row.map_or(Listing::Private, |r| r.listing);
    blocks.push(Block::Line(match listing {
        Listing::Private => vec![Span::text("Private: not listed")],
        Listing::BeforeStart { exchange } => vec![
            Span::text("Listed before 2020 on"),
            t(PageRef::Exchange(exchange)),
        ],
        Listing::InPlay {
            exchange,
            date,
            ipo_price,
        } => vec![
            Span::text(format!("Listed {} on", format::date(date))),
            t(PageRef::Exchange(exchange)),
            Span::text(format!("at {}", format::price(ipo_price))),
        ],
    }));
    blocks
}

/// The Overview tab (spec 8): value, price, confidence, management score, cash, line, rating,
/// next release; with the TTM figures and the shares.
fn overview(d: &CompanyDetail, row: Option<&CompanyRow>, v: &SimViews) -> Vec<Block> {
    let id = d.id;
    let quoted = d.exchange.is_some() && d.quoted;
    let mut f = Vec::new();
    if let Some(r) = row {
        f.push(Field::figure("Value", r.value, Unit::Money));
    }
    f.push(Field::figure(
        "Value a share",
        d.shown_value_per_share,
        Unit::Price,
    ));
    if quoted {
        f.push(Field::new(
            "Price",
            vec![Span::Live(Live::Price(id)), Span::Live(Live::DayChange(id))],
        ));
        f.push(Field::live("EFV", Live::Efv(id)));
        f.push(Field::live("Market cap", Live::MarketCap(id)));
    } else {
        f.push(Field::new(
            "Price",
            vec![Span::muted(if d.exchange.is_some() {
                "delisted"
            } else {
                "not listed"
            })],
        ));
    }
    let zone = v.countries.get().get(d.hq_country).map(|c| c.zone);
    let mut conf = vec![
        Span::Cell(Cell::Ratio(d.confidence_factor)),
        Span::muted("factor"),
    ];
    if let Some(z) = zone {
        conf.push(Span::muted("| zone"));
        conf.push(Span::Live(Live::ZoneConfidence(z)));
    }
    f.push(Field::new("Confidence", conf));
    f.push(Field::new(
        "Management score",
        vec![Span::text(format!("{:.1} / 100", d.management_score))],
    ));
    f.push(Field::figure("Cash", d.cash_usd, Unit::Money));
    f.push(Field::new(
        "Credit line",
        vec![
            Span::Figure(d.line_drawn_usd, Unit::Money),
            Span::muted("drawn of"),
            Span::Figure(d.line_limit_usd, Unit::Money),
        ],
    ));
    if let Some(r) = v.ratings.get().get(id) {
        f.push(Field::new(
            "Line rate",
            vec![
                Span::Cell(Cell::Percent(r.line_rate)),
                Span::muted(format!("(home spread {})", super::doc::bps(r.home_spread))),
            ],
        ));
    }
    f.push(Field::cell("Rating", Cell::Rating(d.rating)));
    f.push(Field::live("Next release", Live::NextRelease));
    if let Some(r) = row {
        f.push(Field::figure("Revenue TTM", r.revenue_ttm, Unit::Money));
        f.push(Field::figure(
            "Net income TTM",
            r.net_income_ttm,
            Unit::Money,
        ));
    }
    f.push(Field::cell("Shares out", Cell::Int(d.shares_out as i64)));
    f.push(Field::new(
        "Buzz",
        vec![Span::text(format!("{:+.0}", d.buzz))],
    ));
    vec![Block::Fields(f)]
}

fn chart(id: CompanyId, d: &CompanyDetail, v: &SimViews) -> Vec<Block> {
    let live = Some((LiveChart::Company(id), v.price_bars.version()));
    match price_chart(id, v) {
        Some(m) => vec![Block::Chart(m, live)],
        // An empty chart that follows v_price_bars, so the first close draws without a rebuild
        // (the page does not rebuild on the daily bars, D485).
        None if d.exchange.is_some() => vec![Block::Chart(
            ChartModel::candles(
                "No bars yet: the chart fills from the first daily close.",
                Vec::new(),
            ),
            live,
        )],
        None => vec![Block::Line(vec![Span::muted(
            "Not listed: a private company has no price history (spec 5.14).",
        )])],
    }
}

fn person_fields(p: &SeatPerson) -> Vec<Field> {
    vec![
        Field::text("Age", p.age.to_string()),
        Field::text("Skills", skills_text(&p.skills)),
        Field::text("Traits", traits_text(&p.traits)),
    ]
}

/// A seat's holder as spans: a link for a full character; a partial one marked and not linked
/// (spec 8, PR #27 notes).
fn holder_spans(p: &SeatPerson, index: &NameIndex) -> Vec<Span> {
    match p.character {
        Some(ch) if !p.partial => vec![character_span(index, ch)],
        _ => vec![
            Span::text(p.name.clone()),
            Span::Colored("(partial)".into(), color::TEXT_MUTED),
        ],
    }
}

fn seat_card(s: &SeatCard, index: &NameIndex) -> CardDoc {
    let unit = s.seat.labor_unit().unwrap_or(0);
    let mut head = vec![
        Span::Colored(seat_name(s.seat).into(), color::CYAN),
        Span::muted(format!("labor unit {unit}")),
    ];
    if !s.open {
        head.push(Span::muted("closed"));
        return CardDoc {
            head,
            fields: vec![
                Field::text("Seat", format!("opens with labor unit {unit}")),
                Field::text("Skill used", format!("{:.1}", s.skill_used)),
            ],
            bar: None,
            dim: true,
        };
    }
    let mut fields = vec![match &s.holder {
        Some(p) => Field::new("Holder", holder_spans(p, index)),
        None => Field::new("Holder", vec![Span::muted("vacant")]),
    }];
    if let Some(p) = &s.holder {
        fields.extend(person_fields(p));
    }
    fields.push(Field::text("Skill used", format!("{:.1}", s.skill_used)));
    CardDoc {
        head,
        fields,
        bar: None,
        dim: false,
    }
}

/// The voter a ballot names, with who sits there now (the vote keeps roles, not people).
fn voter_label(role: VoterRole) -> String {
    match role {
        VoterRole::Seat(seat) => seat_name(seat).to_owned(),
        VoterRole::Director(n) => format!("Director {}", n + 1),
        VoterRole::Controller => "Controller".to_owned(),
    }
}

/// The Board tab (spec 8): seat cards for labor units 1 to 5 with the skill used, founders'
/// cards (skills, traits, home province), directors, and the last IPO vote with each member's
/// vote and the next vote date (5.20.1). Never the ballot odds (D482).
pub fn board(d: &CompanyDetail, v: &SimViews, index: &NameIndex) -> Vec<Block> {
    let mut out = vec![Block::Heading("Seats".into())];
    out.push(Block::Cards(
        d.board
            .iter()
            .filter(|s| s.seat.labor_unit().is_some())
            .map(|s| seat_card(s, index))
            .collect(),
    ));
    out.push(Block::Heading("Founders".into()));
    if d.founders.is_empty() {
        out.push(Block::Line(vec![Span::muted(
            "A starting company: no founders (founders come with a birth, 5.19.3).",
        )]));
    } else {
        let chars = v.characters.get();
        out.push(Block::Cards(
            d.founders
                .iter()
                .enumerate()
                .map(|(i, &ch)| {
                    let mut head = vec![character_span(index, ch)];
                    if i == 0 {
                        head.push(Span::muted("lead founder"));
                    }
                    let fields = match chars.get(ch) {
                        Some(c) => {
                            let mut f = vec![
                                Field::text("Age", c.age.to_string()),
                                Field::text("Skills", skills_text(&c.skills)),
                                Field::text("Traits", traits_text(&c.traits)),
                            ];
                            if let Some(h) = &c.home {
                                f.push(Field::new(
                                    "Home",
                                    vec![match names::place(v, h.province) {
                                        Some((n, p)) => Span::link(n, p),
                                        None => Span::link(
                                            h.country_name.clone(),
                                            PageRef::Country(h.country),
                                        ),
                                    }],
                                ));
                            }
                            f
                        }
                        None => Vec::new(),
                    };
                    CardDoc {
                        head,
                        fields,
                        bar: None,
                        dim: false,
                    }
                })
                .collect(),
        ));
    }
    out.push(Block::Heading(format!("Directors ({})", d.directors)));
    let directors: Vec<Span> = v
        .characters
        .get()
        .list()
        .filter(|c| {
            c.roles
                .iter()
                .any(|r| matches!(r, Role::Director { company } if *company == d.id))
        })
        .flat_map(|c| match c.id {
            sim::views::characters::CharacterRef::Full(ch) => vec![character_span(index, ch)],
            sim::views::characters::CharacterRef::Partial(_) => vec![
                Span::text(c.name.clone()),
                Span::Colored("(partial)".into(), color::TEXT_MUTED),
            ],
        })
        .collect();
    out.push(Block::Line(if directors.is_empty() {
        vec![Span::muted("No directors without a labor seat.")]
    } else {
        directors
    }));
    out.push(Block::Heading("IPO vote".into()));
    out.extend(ipo_vote(d));
    out
}

/// The last IPO vote, each member's vote and the next vote date (spec 8, 5.20.1). The ballots'
/// odds stay in the view and are never shown (20-ui 20.1, D482).
pub fn ipo_vote(d: &CompanyDetail) -> Vec<Block> {
    let mut out = Vec::new();
    match &d.ipo_last_vote {
        Some(rec) => {
            let r = &rec.result;
            let mut line = vec![Span::text(format!(
                "Last vote {}: {} {} to {}",
                format::date(rec.date),
                if r.passed { "passed" } else { "failed" },
                r.yes,
                r.no
            ))];
            if rec.capped {
                line.push(Span::Colored(
                    "(passed, but the world cap of 3 listings a quarter turned it back)".into(),
                    color::AMBER,
                ));
            }
            out.push(Block::Line(line));
            let fields: Vec<Field> = r
                .ballots
                .iter()
                .map(|b| {
                    let vote = if b.yes {
                        Span::Colored("yes".into(), color::GAIN)
                    } else {
                        Span::Colored("no".into(), color::LOSS)
                    };
                    let mut value = vec![vote];
                    if let VoterRole::Seat(seat) = b.role
                        && let Some(p) = d
                            .board
                            .iter()
                            .find(|s| s.seat == seat)
                            .and_then(|s| s.holder.as_ref())
                    {
                        value.push(Span::muted(format!("(seat held now by {})", p.name)));
                    }
                    Field::new(&voter_label(b.role), value)
                })
                .collect();
            out.push(Block::Fields(fields));
        }
        None => out.push(Block::Line(vec![Span::muted(if d.exchange.is_some() {
            "Listed: its board no longer votes on an IPO."
        } else {
            "No IPO vote yet."
        })])),
    }
    out.push(Block::Line(match d.ipo_next_vote {
        Some(q) => vec![Span::text(format!(
            "Next vote {} (the {q} plan lock)",
            format::date(sim::time::quarter::lock_tick(q).date())
        ))],
        None => vec![Span::muted("No vote scheduled.")],
    }));
    out
}

fn cap_kind(h: CapHolder) -> &'static str {
    match h {
        CapHolder::Controller(_) => "Controller",
        CapHolder::OtherHolders => "Other holders",
        CapHolder::Founder(_) => "Founder",
        CapHolder::SeedInvestors => "Seed investors",
        CapHolder::PublicFloat => "Public float",
        CapHolder::NewInvestors => "New investors",
    }
}

/// The Cap table tab (spec 8 "static holders"; D153, D425).
fn cap_table(id: CompanyId, v: &SimViews) -> Vec<Block> {
    let Some(ct) = v.cap_table.get().get(id) else {
        return vec![Block::Line(vec![Span::muted("No cap table.")])];
    };
    let rows = ct
        .lines
        .iter()
        .map(|l| {
            let page = match l.holder {
                CapHolder::Controller(c) => names::controller_page(c),
                CapHolder::Founder(ch) => Some(PageRef::Character(ch)),
                _ => None,
            };
            vec![
                match page {
                    Some(p) => Cell::Link(p.clone(), l.name.clone()),
                    None => Cell::Text(l.name.clone()),
                },
                Cell::Text(cap_kind(l.holder).into()),
                Cell::Int(l.shares as i64),
                Cell::Percent(l.share),
            ]
        })
        .collect();
    let model = TableModel::new(
        vec![
            Column::text("Holder", 220.0),
            Column::text("Kind", 110.0),
            Column::number("Shares", 120.0),
            Column::number("Share", 70.0).with_hint("Share of shares outstanding"),
        ],
        rows,
    );
    vec![
        Block::Fields(vec![Field::cell(
            "Shares out",
            Cell::Int(ct.shares_out as i64),
        )]),
        Block::Table(TableDoc {
            id: "company.cap_table".into(),
            model,
            live: None,
        }),
    ]
}

/// The Units tab (spec 8): industry, base province, assets, productivity, growth, R&D, revenue
/// and expenses of every unit, last month's, as figures (D420, D436).
fn units(id: CompanyId, v: &SimViews, index: &NameIndex) -> Vec<Block> {
    let rows: Vec<Vec<Cell>> = v
        .units
        .get()
        .of_company(id)
        .map(|u| {
            let ind = PageRef::Industry(u.industry);
            let expenses = Figure::sum([u.variable_m, u.fixed_m, u.rd_m, u.dep_m, u.shared_m]);
            vec![
                Cell::Link(ind.clone(), index.title(&ind)),
                match names::place(v, u.base_province) {
                    Some((n, p)) => Cell::Link(p, n),
                    None => Cell::Unknown,
                },
                Cell::figure(u.gross_assets, Unit::Money),
                Cell::figure(u.asset_book, Unit::Money),
                Cell::figure(u.assets_eff, Unit::Money),
                Cell::figure(u.productivity, Unit::Number),
                Cell::figure(u.p_pre, Unit::Number),
                Cell::Percent(u.growth_plan),
                Cell::Percent(u.rd_plan),
                Cell::figure(u.revenue_m, Unit::Money),
                Cell::figure(expenses, Unit::Money),
                Cell::figure(u.variable_m, Unit::Money),
                Cell::figure(u.fixed_m, Unit::Money),
                Cell::figure(u.rd_m, Unit::Money),
                Cell::figure(u.dep_m, Unit::Money),
                Cell::figure(u.shared_m, Unit::Money),
                Cell::figure(u.ebit_m, Unit::Money),
                Cell::figure(u.capex_m, Unit::Money),
            ]
        })
        .collect();
    let model = TableModel::new(
        vec![
            Column::text("Industry", 170.0),
            Column::text("Base province", 190.0),
            Column::number("Assets", 120.0).with_hint("Business assets at cost"),
            Column::number("Book", 120.0),
            Column::number("Effective", 120.0)
                .with_hint("Assets less the 20% shortfall of ramping tranches (5.2)"),
            Column::number("Productivity", 100.0),
            Column::number("P pre", 100.0).with_hint("Productivity + PC bonus + location"),
            Column::number("Growth", 70.0).with_hint("The locked plan's annual growth"),
            Column::number("R&D", 60.0).with_hint("R&D plan, share of revenue"),
            Column::number("Revenue", 120.0).with_hint("Last month"),
            Column::number("Expenses", 120.0).with_hint("Last month: every 5.5 line"),
            Column::number("Variable", 110.0),
            Column::number("Fixed", 110.0),
            Column::number("R&D cost", 110.0).with_key("R&D spend"),
            Column::number("Depreciation", 110.0),
            Column::number("Compute", 100.0).with_hint("Compute and licences (3.8)"),
            Column::number("EBIT", 110.0),
            Column::number("Capex", 110.0),
        ],
        rows,
    );
    vec![Block::Table(TableDoc {
        id: "company.units".into(),
        model,
        live: None,
    })]
}

/// One statement column: its period label, its line figures and its key figures.
struct StatementCol {
    label: String,
    lines: Vec<Figure>,
    op: OperatingFigures,
}

fn period_label(p: Period, synthetic: bool) -> String {
    let base = match p {
        Period::Quarter(q) => q.to_string(),
        Period::Year(y) => format!("FY {y}"),
    };
    if synthetic { format!("{base}*") } else { base }
}

fn exact_col(s: &Statement) -> StatementCol {
    let k = &s.key;
    StatementCol {
        label: period_label(s.period, s.synthetic),
        lines: StatementLine::ALL
            .iter()
            .map(|l| Figure::Exact(l.of(s)))
            .collect(),
        op: OperatingFigures {
            productivity: k.productivity,
            pc_bonus: k.pc_bonus,
            labor_units: k.labor_units,
            held_tb: Figure::Exact(k.held_tb),
            free_rd_pct: k.free_rd_pct,
            management_score: k.management_score,
            rating: k.rating,
        },
    }
}

fn estimated_col(s: &EstimatedStatement) -> StatementCol {
    StatementCol {
        label: period_label(s.period, s.synthetic),
        lines: s.lines.clone(),
        op: s.operating,
    }
}

/// A company's statements of `period`, newest first: exact when it publishes, else the views'
/// estimates (D420).
fn statement_cols(
    id: CompanyId,
    v: &SimViews,
    period: StatementPeriod,
    n: usize,
) -> Vec<StatementCol> {
    let st = v.statements.get();
    let mut cols: Vec<StatementCol> = if st.get(id).is_some_and(|c| c.estimated) {
        st.estimated(id, period, n)
            .iter()
            .map(estimated_col)
            .collect()
    } else {
        st.statements(id, period, n).iter().map(exact_col).collect()
    };
    cols.reverse();
    cols
}

fn statements_table(id: &str, cols: &[StatementCol]) -> TableDoc {
    let mut rows: Vec<Vec<Cell>> = StatementLine::ALL
        .iter()
        .enumerate()
        .map(|(i, l)| {
            let mut r = vec![Cell::Text(l.label().into())];
            r.extend(cols.iter().map(|c| Cell::figure(c.lines[i], Unit::Money)));
            r
        })
        .collect();
    type OpRow = (&'static str, fn(&OperatingFigures) -> Cell);
    let op_rows: [OpRow; 7] = [
        ("Productivity", |o| Cell::Number(o.productivity)),
        ("PC bonus", |o| Cell::Int(i64::from(o.pc_bonus))),
        ("Labor units", |o| Cell::Int(o.labor_units as i64)),
        ("Held TB", |o| Cell::figure(o.held_tb, Unit::Number)),
        ("Free R&D", |o| {
            Cell::Percent(f64::from(o.free_rd_pct) / 100.0)
        }),
        ("Management score", |o| Cell::Number(o.management_score)),
        ("Rating", |o| Cell::Rating(o.rating)),
    ];
    for (label, f) in op_rows {
        let mut r = vec![Cell::Text(label.into())];
        r.extend(cols.iter().map(|c| f(&c.op)));
        rows.push(r);
    }
    let mut columns = vec![Column::text("Line", 170.0)];
    columns.extend(
        cols.iter()
            .enumerate()
            .map(|(i, c)| Column::number(&c.label, 124.0).with_key(&format!("p{i}"))),
    );
    TableDoc {
        id: id.into(),
        model: TableModel::new(columns, rows),
        live: None,
    }
}

/// The Financials tab (spec 8; 21.5.3): the Quarter view (last results, this quarter's
/// consensus and projection range), the quarterly statements and the years; bands for a
/// company that does not publish (D420).
fn financials(id: CompanyId, d: &CompanyDetail, v: &SimViews) -> Vec<Block> {
    let mut out = Vec::new();
    if d.estimated {
        out.push(Block::Line(vec![Span::Colored(
            "Not published (private, or listed since the last release): every figure is an \
             estimate band."
                .into(),
            format::BAND_TEXT,
        )]));
    }
    let quarters = statement_cols(id, v, StatementPeriod::Quarter, STATEMENT_QUARTERS);
    out.push(Block::Heading("Quarter view".into()));
    let mut q = Vec::new();
    match quarters.first() {
        Some(last) => {
            let fig = |l: StatementLine| last.lines[l as usize];
            q.push(Field::new(
                "Last results",
                vec![
                    Span::text(last.label.clone()),
                    Span::muted("revenue"),
                    Span::Figure(fig(StatementLine::Revenue), Unit::Money),
                    Span::muted("net income"),
                    Span::Figure(fig(StatementLine::NetIncome), Unit::Money),
                ],
            ));
            q.push(Field::new(
                "Guidance",
                vec![
                    Span::Figure(fig(StatementLine::GuidanceLow), Unit::Money),
                    Span::muted("to"),
                    Span::Figure(fig(StatementLine::GuidanceHigh), Unit::Money),
                ],
            ));
        }
        None => q.push(Field::new(
            "Last results",
            vec![Span::muted("none published yet")],
        )),
    }
    q.push(Field::live("Consensus", Live::Consensus(id)));
    q.push(Field::live("Projection range", Live::ProjectionRange(id)));
    q.push(Field::live("Next release", Live::NextRelease));
    out.push(Block::Fields(q));
    out.push(Block::Heading(format!(
        "Quarterly statements (last {}, newest first; * from the 2019 run rate)",
        quarters.len()
    )));
    out.push(Block::Table(statements_table(
        "company.statements.quarters",
        &quarters,
    )));
    let years = statement_cols(id, v, StatementPeriod::Year, STATEMENT_YEARS);
    if !years.is_empty() {
        out.push(Block::Heading("Years".into()));
        out.push(Block::Table(statements_table(
            "company.statements.years",
            &years,
        )));
    }
    out
}

/// The Tech tab (spec 8; 10.0.11.7): labor split, stations, PC and the next step, compute,
/// and a data quests card per industry with a progress bar and inflow against decay.
fn tech(id: CompanyId, v: &SimViews, index: &NameIndex) -> Vec<Block> {
    let Some(t) = v.tech.get().get(id) else {
        return vec![Block::Line(vec![Span::muted("No tech data.")])];
    };
    let s = &t.stations;
    let f = vec![
        Field::cell("Labor units", Cell::Int(t.labor_units as i64)),
        Field::new(
            "Labor split",
            vec![Span::text(format!(
                "productivity {}  enterprise {}  50/50 {}  research {}  idle {}",
                s.productivity, s.enterprise, s.fifty_fifty, s.research, s.idle
            ))],
        ),
        Field::cell("Stations", Cell::Int(s.total() as i64)),
        Field::new(
            "PC",
            vec![
                Span::Cell(Cell::Number(t.pc)),
                Span::muted(format!("bonus +{:.0}", t.pc_bonus)),
            ],
        ),
        Field::new(
            "Next step",
            vec![Span::text(format!("at PC {:.1}", t.next_bonus_pc))],
        ),
        Field::text(
            "Compute",
            format!(
                "extra base {}  data {}  licences {}",
                t.compute.extra_base_compute, t.compute.data_compute, t.compute.licences
            ),
        ),
        Field::cell("Compute bill", Cell::Money(t.compute.monthly_usd)),
        Field::figure("Stored TB", t.stored_tb(), Unit::Number),
    ];
    let mut out = vec![Block::Fields(f), Block::Heading("Data quests".into())];
    if t.data.is_empty() {
        out.push(Block::Line(vec![Span::muted("No data held yet.")]));
        return out;
    }
    out.push(Block::Cards(
        t.data
            .iter()
            .map(|d| {
                let ind = PageRef::Industry(d.industry);
                let mut rd = format!("{}%", d.free_rd_pct);
                if d.grace {
                    rd.push_str(" (drop in grace)");
                }
                CardDoc {
                    head: vec![Span::link(index.title(&ind), ind)],
                    fields: vec![
                        Field::figure("Held TB", d.held_tb, Unit::Number),
                        Field::new(
                            "Unstructured",
                            vec![
                                Span::Figure(d.unstructured_tb, Unit::Number),
                                Span::muted(format!("TB in {} buckets", d.buckets)),
                            ],
                        ),
                        Field::text("Free R&D", rd),
                        Field::new(
                            "Next step",
                            vec![Span::text(format!(
                                "at {} TB",
                                format::number(d.next_step_tb)
                            ))],
                        ),
                        Field::new(
                            "Inflow",
                            vec![
                                Span::Figure(d.inflow_tb, Unit::Number),
                                Span::muted("TB a month vs decay"),
                                Span::Figure(d.decay_tb, Unit::Number),
                            ],
                        ),
                        Field::new(
                            "Conversion",
                            vec![Span::text(format!(
                                "{} TB a month",
                                format::number(d.conversion_tb)
                            ))],
                        ),
                    ],
                    bar: Some(Progress {
                        value: d.held_tb,
                        max: d.next_step_tb,
                    }),
                    dim: false,
                }
            })
            .collect(),
    ));
    out
}
