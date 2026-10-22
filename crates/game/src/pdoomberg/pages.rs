//! Pdoomberg's function pages (M9.4; spec 8 Pdoomberg; 20-ui 20.5.2; 3-markets 3.13.1): each
//! is a model built from the views (spec 9) and a builder that draws it in the terminal's page
//! area. Figures go through [`Cell::figure`] (D461), so a company that does not publish shows
//! bands, never a hidden value; the true V a share (v_quotes `value`, Omniscient only) is never
//! read (spec 8 "true V is never shown").

use bevy::prelude::*;
use sim::SimViews;
use sim::ai::archetype::Archetype;
use sim::finance::distress::CompanyStatus;
use sim::views::company_rows::{CompanyRow, Listing};
use sim::views::estimate::{Band, Figure};
use sim::world::{CompanyId, Origin, ZoneId};

use crate::bridge::{RunnerControls, Views};
use crate::chart::{ChartModel, Ohlc, ten_year_view};
use crate::command::index::NameIndex;
use crate::pages::industries::industries_model;
use crate::pages::live::{
    Filter, Live, LiveCtx, LiveModel, Pick, PickerLook, spawn_live_chart, spawn_live_table,
    spawn_live_text, spawn_picker,
};
use crate::pages::news::industry_options;
use crate::pages::{PageRef, PdbFunction, PdoombergRoute, ViewKey};
use crate::table::format::{self, Unit};
use crate::table::{Cell, Column, GainUnit, TableLook, TableModel};
use crate::ui::theme::{self, color, font};

/// Real seconds between two remakes of a table over v_quotes (every tick; D510).
pub const QUOTES_REFRESH_SECS: f64 = 0.5;
/// Days of daily bars on F3 (3.13.1: daily bars up to a year).
pub const DAILY_DAYS: i64 = 365;

/// The terminal's text colors.
pub const TEXT: Color = color::TERMINAL_TEXT;
pub const DIM: Color = Color::srgb(0.60, 0.42, 0.0);

/// A terminal text line.
pub fn line(s: impl Into<String>, size: f32, c: Color) -> impl Bundle {
    theme::text_line(s, size, c)
}

fn link(index: &NameIndex, p: PageRef) -> Cell {
    Cell::Link(p.clone(), index.title(&p))
}

/// The exchange code of a zone ("NYSE"), from v_exchanges.
fn exchange_code(v: &SimViews, z: ZoneId) -> String {
    v.exchanges
        .get()
        .exchanges
        .iter()
        .find(|x| x.zone == z)
        .map_or_else(|| "-".into(), |x| x.code.clone())
}

fn ticker(r: &CompanyRow) -> String {
    if r.public && !r.ticker.is_empty() {
        r.ticker.clone()
    } else {
        "-".into()
    }
}

// ---------------------------------------------------------------- F2 Quotes

/// F2's watchlists (spec 8: All, by industry, by country; the Disclosure radar is hidden, D515),
/// plus the player's own watchlist: `list` 0 is All, 1 the watchlist; `industry` and `country`
/// narrow either.
pub fn quotes_model(c: &LiveCtx) -> TableModel {
    let v = c.views;
    let quotes = v.quotes.get();
    let f = c.filter;
    let watch = &c.controls.watchlist;
    let rows = v
        .company_rows
        .get()
        .rows
        .iter()
        .filter(|r| r.status != CompanyStatus::Removed)
        .filter(|r| f.get("list") != 1 || watch.contains(&r.id))
        .filter(|r| f.id("industry").is_none_or(|i| r.industry.0 == i))
        .filter(|r| f.id("country").is_none_or(|i| r.hq_country.0 == i))
        .map(|r| {
            let q = quotes.get(r.id);
            let unknown = || Cell::Unknown;
            vec![
                Cell::Text(ticker(r)),
                link(c.index, PageRef::Company(r.id)),
                link(c.index, PageRef::Industry(r.industry)),
                link(c.index, PageRef::Country(r.hq_country)),
                r.exchange
                    .map_or(Cell::Text("-".into()), |z| Cell::Text(exchange_code(v, z))),
                q.map_or_else(unknown, |q| Cell::Price(q.last)),
                q.map_or_else(unknown, |q| Cell::Gain(q.change, GainUnit::Price)),
                q.map_or_else(unknown, |q| Cell::Gain(q.change_pct, GainUnit::Percent)),
                // The published estimate and its ±15% band (3.14.2; D140).
                q.map_or_else(unknown, |q| {
                    Cell::figure(
                        Figure::Band(Band {
                            estimate: q.efv,
                            low: q.efv_low,
                            high: q.efv_high,
                        }),
                        Unit::Price,
                    )
                }),
                q.filter(|q| q.efv > 0.0).map_or_else(unknown, |q| {
                    Cell::Gain(q.last / q.efv - 1.0, GainUnit::Percent)
                }),
                q.map_or_else(unknown, |q| Cell::Number(q.buzz)),
                Cell::figure(r.value, Unit::Money),
                Cell::Rating(r.rating),
                Cell::Text(if watch.contains(&r.id) { "*" } else { "" }.into()),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Ticker", 60.0),
            Column::text("Name", 210.0),
            Column::text("Industry", 150.0),
            Column::text("HQ", 110.0),
            Column::text("Exch", 56.0),
            Column::number("Last", 76.0).with_hint("USD a share; ? while not quoted"),
            Column::number("Chg", 66.0).with_hint("Since the last close"),
            Column::number("Chg%", 64.0),
            Column::number("EFV band", 130.0)
                .with_hint("The estimated fair value band, +-15% (3.14.2)"),
            Column::number("Gap", 64.0).with_hint("Last over the EFV (3.14.2)"),
            Column::number("Buzz", 56.0).with_hint("-100 to +100 (3.10)"),
            Column::number("Value", 120.0)
                .with_hint("Market cap at EFV when listed; a band while not published (D420)"),
            Column::text("Rating", 50.0),
            Column::text("W", 24.0).with_hint("* on the watchlist (click a row to toggle)"),
        ],
        rows,
    )
}

/// The country options: every country with an HQ, by name.
fn country_options(v: &SimViews) -> Vec<(String, Pick)> {
    let mut o: Vec<(String, Pick)> = v
        .countries
        .get()
        .countries
        .iter()
        .filter(|c| !c.hq_companies.is_empty())
        .map(|c| (c.name.clone(), u64::from(c.id.0) + 1))
        .collect();
    o.sort();
    o.insert(0, ("All".into(), 0));
    o
}

fn terminal_table(commands: &mut Commands, t: Entity) {
    commands.entity(t).insert(TableLook::TERMINAL);
}

fn filter_row(commands: &mut Commands, area: Entity) -> Entity {
    let row = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            flex_wrap: FlexWrap::Wrap,
            column_gap: px(10.0),
            row_gap: px(2.0),
            align_items: AlignItems::FlexStart,
            flex_shrink: 0.0,
            ..default()
        })
        .id();
    commands.entity(area).add_child(row);
    row
}

/// The page context: the views, the name index and the runner controls.
pub struct Env<'a> {
    pub views: &'a Views,
    pub index: &'a NameIndex,
    pub controls: &'a RunnerControls,
}

pub fn build_f2(commands: &mut Commands, area: Entity, env: &Env) -> Option<Entity> {
    let filters = filter_row(commands, area);
    let t = spawn_live_table(
        commands,
        area,
        "pdb.f2",
        Live::new(
            &[ViewKey::Quotes, ViewKey::CompanyRows, ViewKey::Exchanges],
            |c| LiveModel::Table(quotes_model(c)),
        )
        .on_controls()
        .throttle(QUOTES_REFRESH_SECS),
        Filter::default(),
        env.views,
        env.index,
        env.controls,
    );
    terminal_table(commands, t);
    let v: &SimViews = env.views;
    spawn_picker(
        commands,
        filters,
        "Watchlist",
        "list",
        vec![("All".into(), 0), ("My watchlist".into(), 1)],
        t,
        0,
        PickerLook::TERMINAL,
    );
    spawn_picker(
        commands,
        filters,
        "Industry",
        "industry",
        industry_options(v),
        t,
        0,
        PickerLook::TERMINAL,
    );
    spawn_picker(
        commands,
        filters,
        "Country",
        "country",
        country_options(v),
        t,
        0,
        PickerLook::TERMINAL,
    );
    let hint = commands
        .spawn(line(
            "Click a row: watch or unwatch. Right-click: load it (F3 chart).",
            font::SMALL,
            DIM,
        ))
        .id();
    commands.entity(filters).add_child(hint);
    Some(t)
}

// ---------------------------------------------------------------- F3 Chart

/// A company's daily bars over the last year with each day's EFV band (spec 8 F3; D424, D465).
pub fn daily_chart(v: &SimViews, id: CompanyId) -> Option<ChartModel> {
    let h = v.price_bars.get().companies.iter().find(|h| h.id == id)?;
    let last = h.bars.last()?.date;
    let from = last.add_days(-DAILY_DAYS);
    let bars: Vec<Ohlc> = h.bars.range(from, last).map(Ohlc::from_bar).collect();
    Some(ChartModel::candles(
        "Daily bars over the EFV band, 1 year",
        bars,
    ))
}

/// The 10-year view: weekly bars, each with its last day's band (3.13.1; D457, D465).
pub fn weekly_chart(v: &SimViews, id: CompanyId) -> Option<ChartModel> {
    let h = v.price_bars.get().companies.iter().find(|h| h.id == id)?;
    let daily: Vec<Ohlc> = h.bars.iter().map(Ohlc::from_bar).collect();
    if daily.is_empty() {
        return None;
    }
    Some(ChartModel::candles(
        "10 years, weekly bars over the EFV band",
        ten_year_view(&daily),
    ))
}

/// F3's line about the company: its published EFV band, or the value band of a private one.
pub fn chart_note(v: &SimViews, id: CompanyId) -> String {
    let row = v.company_rows.get().rows.iter().find(|r| r.id == id);
    match (v.quotes.get().get(id), row) {
        (Some(q), _) => format!(
            "EFV band {} (EFV +-15%, 3.14.2). The true value is never shown.",
            format::band_in(Unit::Price, q.efv_low, q.efv_high)
        ),
        (None, Some(r)) => format!(
            "Not quoted: no price bars. Value shown (5.13 step 6): {}.",
            format::figure_in(r.value, Unit::Money)
        ),
        (None, None) => "Not in the game.".into(),
    }
}

pub fn build_f3(
    commands: &mut Commands,
    area: Entity,
    env: &Env,
    route: PdoombergRoute,
) -> Option<Entity> {
    let Some(id) = route.company else {
        let e = commands
            .spawn(line(
                "No company loaded. Type TICKER F3 in the command bar (Ctrl+K), or right-click a \
                 row in F2, F5, F6 or F10.",
                font::BODY,
                TEXT,
            ))
            .id();
        commands.entity(area).add_child(e);
        return None;
    };
    spawn_live_text(
        commands,
        area,
        font::SMALL,
        DIM,
        Live::new(&[ViewKey::Quotes, ViewKey::CompanyRows], move |c| {
            LiveModel::Text(chart_note(c.views, id))
        })
        .throttle(QUOTES_REFRESH_SECS),
        env.views,
        env.index,
        env.controls,
    );
    if env.views.quotes.get().get(id).is_none() && daily_chart(env.views, id).is_none() {
        return None;
    }
    let charts = commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            flex_grow: 1.0,
            min_height: px(0.0),
            row_gap: px(6.0),
            ..default()
        })
        .id();
    commands.entity(area).add_child(charts);
    for weekly in [false, true] {
        spawn_live_chart(
            commands,
            charts,
            Live::new(&[ViewKey::PriceBars], move |c| {
                let m = if weekly {
                    weekly_chart(c.views, id)
                } else {
                    daily_chart(c.views, id)
                };
                LiveModel::Chart(m.unwrap_or_default())
            }),
            env.views,
            env.index,
            env.controls,
        );
    }
    None
}

// ---------------------------------------------------------------- F4 Order

/// F4 Order: only the lock (spec 8 "F4 Order shows Read-only MVP"; D516).
pub fn build_f4(commands: &mut Commands, area: Entity) -> Option<Entity> {
    let lock = commands.spawn(theme::read_only_lock()).id();
    commands.entity(area).add_child(lock);
    None
}

// ---------------------------------------------------------------- F5 Filings

/// F5 Filings (spec 8: quarterly statements): every company's newest published quarter
/// (v_filings, D130); a company that does not publish shows its lines as bands (D420).
pub fn filings_model(v: &SimViews, index: &NameIndex) -> TableModel {
    let rows_all = &v.company_rows.get().rows;
    let rows = v
        .filings
        .get()
        .filings
        .iter()
        .map(|f| {
            let row = rows_all
                .binary_search_by_key(&f.company, |r| r.id)
                .ok()
                .map(|i| &rows_all[i]);
            let m = |x: Figure| Cell::figure(x, Unit::Money);
            vec![
                row.map_or(Cell::Text("-".into()), |r| Cell::Text(ticker(r))),
                link(index, PageRef::Company(f.company)),
                Cell::Text(f.quarter.to_string()),
                m(f.revenue),
                m(f.ebit),
                m(f.ebitda),
                m(f.net_income),
                m(f.operating_cash),
                m(f.cash),
                m(f.line_drawn),
                m(f.equity),
                Cell::Rating(f.rating),
                Cell::Text(
                    match (f.estimated, f.synthetic) {
                        (true, _) => "estimates",
                        (false, true) => "synthetic 2019",
                        _ => "published",
                    }
                    .into(),
                ),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Ticker", 60.0),
            Column::text("Company", 210.0),
            Column::text("Quarter", 70.0),
            Column::number("Revenue", 110.0),
            Column::number("EBIT", 110.0),
            Column::number("EBITDA", 110.0),
            Column::number("Net income", 110.0),
            Column::number("Op. cash", 110.0),
            Column::number("Cash", 110.0),
            Column::number("Line drawn", 110.0),
            Column::number("Equity", 110.0),
            Column::text("Rating", 50.0),
            Column::text("Figures", 100.0)
                .with_hint("Bands for a company that does not publish (D420)"),
        ],
        rows,
    )
}

pub fn build_f5(commands: &mut Commands, area: Entity, env: &Env) -> Option<Entity> {
    spawn_live_text(
        commands,
        area,
        font::SMALL,
        DIM,
        Live::new(&[ViewKey::Filings], |c| {
            LiveModel::Text(match c.views.filings.get().quarter {
                Some(q) => format!(
                    "Filings: {q}, the newest published quarter. Older quarters are on each \
                     company's Financials tab."
                ),
                None => "No quarter published yet.".into(),
            })
        }),
        env.views,
        env.index,
        env.controls,
    );
    let t = spawn_live_table(
        commands,
        area,
        "pdb.f5",
        Live::new(&[ViewKey::Filings, ViewKey::CompanyRows], |c| {
            LiveModel::Table(filings_model(c.views, c.index))
        }),
        Filter::default(),
        env.views,
        env.index,
        env.controls,
    );
    terminal_table(commands, t);
    Some(t)
}

// ---------------------------------------------------------------- F6 Ratings

/// F6 Ratings: credit ratings only (spec 8; no analyst ratings in the MVP), for every company
/// still in the game (D157: F6 shows all ratings).
pub fn ratings_model(v: &SimViews, index: &NameIndex) -> TableModel {
    let rows_all = &v.company_rows.get().rows;
    let rows = v
        .ratings
        .get()
        .companies
        .iter()
        .filter(|c| c.status != CompanyStatus::Removed)
        .map(|c| {
            let row = rows_all
                .binary_search_by_key(&c.id, |r| r.id)
                .ok()
                .map(|i| &rows_all[i]);
            let n = c.last_review_notches;
            vec![
                row.map_or(Cell::Text("-".into()), |r| Cell::Text(ticker(r))),
                link(index, PageRef::Company(c.id)),
                Cell::Rating(c.rating),
                Cell::Text(format!("{:?}", c.rating.band()).to_uppercase()),
                Cell::Text(match n.cmp(&0) {
                    std::cmp::Ordering::Greater => format!("+{n}"),
                    _ => n.to_string(),
                }),
                Cell::Percent(c.line_rate),
                Cell::Percent(c.home_spread),
                Cell::figure(c.line_drawn, Unit::Money),
                Cell::figure(c.line_limit, Unit::Money),
                Cell::Text(format!("{:?}", c.status)),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Ticker", 60.0),
            Column::text("Company", 210.0),
            Column::text("Rating", 56.0).with_hint("Credit rating (spec 5.12)"),
            Column::text("Band", 50.0),
            Column::text("Last review", 80.0).with_hint("Notches at the last review"),
            Column::number("Line rate", 76.0)
                .with_hint("Base + home spread + rating spread (5.12)"),
            Column::number("Home spread", 86.0),
            Column::number("Line drawn", 120.0),
            Column::number("Line limit", 120.0),
            Column::text("Status", 80.0),
        ],
        rows,
    )
}

/// The ratings strip: the base rate and the companies in each band.
pub fn ratings_strip(v: &SimViews) -> String {
    let r = v.ratings.get();
    let bands: Vec<String> = r
        .band_counts()
        .iter()
        .map(|(b, n)| format!("{} {n}", format!("{b:?}").to_uppercase()))
        .collect();
    format!(
        "Base rate {} | by band: {}",
        format::percent(r.base_rate),
        bands.join("  ")
    )
}

pub fn build_f6(commands: &mut Commands, area: Entity, env: &Env) -> Option<Entity> {
    spawn_live_text(
        commands,
        area,
        font::SMALL,
        DIM,
        Live::new(&[ViewKey::Ratings], |c| {
            LiveModel::Text(ratings_strip(c.views))
        }),
        env.views,
        env.index,
        env.controls,
    );
    let t = spawn_live_table(
        commands,
        area,
        "pdb.f6",
        Live::new(&[ViewKey::Ratings, ViewKey::CompanyRows], |c| {
            LiveModel::Table(ratings_model(c.views, c.index))
        }),
        Filter::default(),
        env.views,
        env.index,
        env.controls,
    );
    terminal_table(commands, t);
    Some(t)
}

// ---------------------------------------------------------------- F7 Bonds

/// F7's zone credit spreads (batch 155): base and effective.
pub fn zone_spreads_model(v: &SimViews, index: &NameIndex) -> TableModel {
    let rows = v
        .rates
        .get()
        .zones
        .iter()
        .map(|z| {
            vec![
                Cell::Int(i64::from(z.number)),
                link(index, PageRef::Zone(z.zone)),
                Cell::Percent(z.base),
                Cell::Percent(z.effective),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::number("No.", 36.0),
            Column::text("Zone", 180.0),
            Column::number("Base", 64.0).with_hint("Base credit spread (5.1.2)"),
            Column::number("Effective", 70.0).with_hint("After the cycle's effect (5.1.2)"),
        ],
        rows,
    )
}

/// F7's sovereign spreads (batch 155): each country's rating and spread.
pub fn sovereigns_model(v: &SimViews, index: &NameIndex) -> TableModel {
    let rows = v
        .rates
        .get()
        .sovereigns
        .iter()
        .map(|s| {
            vec![
                link(index, PageRef::Country(s.country)),
                Cell::Text(s.iso3.clone()),
                link(index, PageRef::Zone(s.zone)),
                Cell::Rating(s.rating),
                Cell::Percent(s.spread),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Country", 170.0),
            Column::text("ISO3", 44.0),
            Column::text("Zone", 160.0),
            Column::text("Rating", 50.0),
            Column::number("Spread", 64.0),
        ],
        rows,
    )
}

/// F7's corporate spread by rating (5.12).
pub fn rating_spreads_model(v: &SimViews) -> TableModel {
    let rows = v
        .rates
        .get()
        .rating_spreads
        .iter()
        .map(|r| vec![Cell::Rating(r.rating), Cell::Percent(r.spread)])
        .collect();
    TableModel::new(
        vec![
            Column::text("Rating", 56.0),
            Column::number("Spread", 64.0).with_hint("Corporate spread over base (5.12)"),
        ],
        rows,
    )
}

pub fn build_f7(commands: &mut Commands, area: Entity, env: &Env) -> Option<Entity> {
    spawn_live_text(
        commands,
        area,
        font::BODY,
        TEXT,
        Live::new(&[ViewKey::Rates], |c| {
            LiveModel::Text(format!(
                "World base rate {}",
                format::percent(c.views.rates.get().base_rate)
            ))
        }),
        env.views,
        env.index,
        env.controls,
    );
    let row = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            flex_grow: 1.0,
            min_height: px(0.0),
            column_gap: px(8.0),
            ..default()
        })
        .id();
    commands.entity(area).add_child(row);
    let mut first = None;
    for (id, title, which) in [
        ("pdb.f7.zones", "Zone credit spreads", 0u8),
        ("pdb.f7.sovereigns", "Sovereign spreads", 1),
        ("pdb.f7.ratings", "Corporate spread by rating", 2),
    ] {
        let col = commands
            .spawn(Node {
                flex_direction: FlexDirection::Column,
                flex_grow: if which == 2 { 0.6 } else { 1.0 },
                flex_basis: px(0.0),
                min_width: px(0.0),
                min_height: px(0.0),
                row_gap: px(2.0),
                ..default()
            })
            .id();
        commands.entity(row).add_child(col);
        let t = commands.spawn(line(title, font::BODY, TEXT)).id();
        commands.entity(col).add_child(t);
        let table = spawn_live_table(
            commands,
            col,
            id,
            Live::new(&[ViewKey::Rates], move |c| {
                LiveModel::Table(match which {
                    0 => zone_spreads_model(c.views, c.index),
                    1 => sovereigns_model(c.views, c.index),
                    _ => rating_spreads_model(c.views),
                })
            }),
            Filter::default(),
            env.views,
            env.index,
            env.controls,
        );
        terminal_table(commands, table);
        first.get_or_insert(table);
    }
    first
}

// ---------------------------------------------------------------- F9 Industries

pub fn build_f9(commands: &mut Commands, area: Entity, env: &Env) -> Option<Entity> {
    let t = spawn_live_table(
        commands,
        area,
        "pdb.f9",
        Live::new(&[ViewKey::IndustryRows, ViewKey::Births], |c| {
            LiveModel::Table(industries_model(c.views, c.index))
        }),
        Filter::default(),
        env.views,
        env.index,
        env.controls,
    );
    terminal_table(commands, t);
    Some(t)
}

// ---------------------------------------------------------------- F10 Screener

/// The archetypes (spec 6.1), for the screener's filter.
pub const ARCHETYPES: [Archetype; 5] = [
    Archetype::StateChampion,
    Archetype::Startup,
    Archetype::AggressiveGrower,
    Archetype::CashCow,
    Archetype::Incumbent,
];

/// The listing filter's year picks start here: `LISTED_YEAR + year` (D511).
pub const LISTED_YEAR: u64 = 10_000;

/// The listing filter: 1 private, 2 listed before 2020, 3 listed in play, `LISTED_YEAR + y`
/// listed in play in year `y` (spec 8 Startups and listings: "F10 Screener filter by origin and
/// listing date").
fn listing_passes(l: Listing, pick: Pick) -> bool {
    match pick {
        0 => true,
        1 => matches!(l, Listing::Private),
        2 => matches!(l, Listing::BeforeStart { .. }),
        3 => matches!(l, Listing::InPlay { .. }),
        p if p > LISTED_YEAR => l
            .date()
            .is_some_and(|d| u64::try_from(d.year).ok() == Some(p - LISTED_YEAR)),
        _ => true,
    }
}

/// F10 Screener (spec 8 read-only filters; 9.2 `list_companies` filters: industry, country,
/// zone, exchange, public, archetype, origin and listing date).
pub fn screener_model(c: &LiveCtx) -> TableModel {
    let v = c.views;
    let f = c.filter;
    let countries = v.countries.get();
    let zone_of = |r: &CompanyRow| countries.get(r.hq_country).map(|x| x.zone);
    let rows = v
        .company_rows
        .get()
        .rows
        .iter()
        .filter(|r| r.status != CompanyStatus::Removed)
        .filter(|r| f.id("industry").is_none_or(|i| r.industry.0 == i))
        .filter(|r| f.id("country").is_none_or(|i| r.hq_country.0 == i))
        .filter(|r| {
            f.id("zone")
                .is_none_or(|z| zone_of(r).map(|x| x.0) == Some(z))
        })
        .filter(|r| {
            f.id("exchange")
                .is_none_or(|z| r.exchange.map(|x| x.0) == Some(z))
        })
        .filter(|r| match f.get("public") {
            1 => r.public,
            2 => !r.public,
            _ => true,
        })
        .filter(|r| {
            f.id("archetype")
                .is_none_or(|a| ARCHETYPES.get(a as usize) == Some(&r.archetype))
        })
        .filter(|r| match f.get("origin") {
            1 => r.origin == Origin::Start,
            2 => matches!(r.origin, Origin::Born { .. }),
            _ => true,
        })
        .filter(|r| listing_passes(r.listing, f.get("listing")))
        .map(|r| {
            vec![
                Cell::Text(ticker(r)),
                link(c.index, PageRef::Company(r.id)),
                link(c.index, PageRef::Industry(r.industry)),
                link(c.index, PageRef::Country(r.hq_country)),
                zone_of(r).map_or(Cell::Text("-".into()), |z| link(c.index, PageRef::Zone(z))),
                r.exchange
                    .map_or(Cell::Text("-".into()), |z| Cell::Text(exchange_code(v, z))),
                Cell::Text(if r.public { "listed" } else { "private" }.into()),
                Cell::Text(r.archetype.name().into()),
                Cell::Text(match r.origin {
                    Origin::Start => "start".into(),
                    Origin::Born { date, .. } => format!("born {}", format::date(date)),
                }),
                match r.listing {
                    Listing::InPlay { date, .. } => Cell::Date(date),
                    Listing::BeforeStart { .. } => Cell::Text("before 2020".into()),
                    Listing::Private => Cell::Text("-".into()),
                },
                Cell::figure(r.revenue_ttm, Unit::Money),
                Cell::figure(r.net_income_ttm, Unit::Money),
                Cell::figure(r.value, Unit::Money),
                Cell::Rating(r.rating),
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Ticker", 60.0),
            Column::text("Name", 200.0),
            Column::text("Industry", 150.0),
            Column::text("HQ", 110.0),
            Column::text("Zone", 140.0),
            Column::text("Exch", 56.0),
            Column::text("Public", 60.0),
            Column::text("Archetype", 120.0).with_hint("Spec 6.1"),
            Column::text("Origin", 120.0).with_hint("A starting company, or born in play (5.19)"),
            Column::text("Listed", 96.0).with_hint("The listing date (5.20.1)"),
            Column::number("Revenue TTM", 120.0).with_hint("A band while not published"),
            Column::number("NI TTM", 120.0),
            Column::number("Value", 120.0),
            Column::text("Rating", 50.0),
        ],
        rows,
    )
}

pub fn build_f10(commands: &mut Commands, area: Entity, env: &Env) -> Option<Entity> {
    let v: &SimViews = env.views;
    let filters = filter_row(commands, area);
    let t = spawn_live_table(
        commands,
        area,
        "pdb.f10",
        Live::new(
            &[ViewKey::CompanyRows, ViewKey::Countries, ViewKey::Exchanges],
            |c| LiveModel::Table(screener_model(c)),
        ),
        Filter::default(),
        env.views,
        env.index,
        env.controls,
    );
    terminal_table(commands, t);
    let ids = |p: PageRef| env.index.title(&p);
    let mut zones: Vec<(String, Pick)> = v
        .zones
        .get()
        .zones
        .iter()
        .map(|z| (ids(PageRef::Zone(z.id)), u64::from(z.id.0) + 1))
        .collect();
    zones.sort();
    zones.insert(0, ("All".into(), 0));
    let mut exchanges: Vec<(String, Pick)> = v
        .exchanges
        .get()
        .exchanges
        .iter()
        .map(|x| (x.code.clone(), u64::from(x.zone.0) + 1))
        .collect();
    exchanges.sort();
    exchanges.insert(0, ("All".into(), 0));
    let mut archetypes: Vec<(String, Pick)> = ARCHETYPES
        .iter()
        .enumerate()
        .map(|(i, a)| (a.name().to_owned(), i as u64 + 1))
        .collect();
    archetypes.insert(0, ("All".into(), 0));
    let mut listing: Vec<(String, Pick)> = vec![
        ("All".into(), 0),
        ("Private".into(), 1),
        ("Listed before 2020".into(), 2),
        ("Listed in play".into(), 3),
    ];
    let mut years: Vec<i32> = v
        .births
        .get()
        .listings
        .iter()
        .map(|l| l.date.year)
        .collect();
    let now = v.clock().date.year;
    years.extend(2020..=now);
    years.sort_unstable();
    years.dedup();
    for y in years {
        listing.push((format!("Listed in {y}"), LISTED_YEAR + y.max(0) as u64));
    }
    for (label, key, options) in [
        ("Industry", "industry", industry_options(v)),
        ("Country", "country", country_options(v)),
        ("Zone", "zone", zones),
        ("Exchange", "exchange", exchanges),
        (
            "Public",
            "public",
            vec![
                ("All".into(), 0),
                ("Listed".into(), 1),
                ("Private".into(), 2),
            ],
        ),
        ("Archetype", "archetype", archetypes),
        (
            "Origin",
            "origin",
            vec![
                ("All".into(), 0),
                ("Starting company".into(), 1),
                ("Born in play".into(), 2),
            ],
        ),
        ("Listing", "listing", listing),
    ] {
        spawn_picker(
            commands,
            filters,
            label,
            key,
            options,
            t,
            0,
            PickerLook::TERMINAL,
        );
    }
    let hint = commands
        .spawn(line(
            "Read-only filters. Right-click a row: load it.",
            font::SMALL,
            DIM,
        ))
        .id();
    commands.entity(filters).add_child(hint);
    Some(t)
}

/// Builds `f`'s page into `area`; returns its main table, if it has one.
pub fn build(
    commands: &mut Commands,
    area: Entity,
    env: &Env,
    route: PdoombergRoute,
) -> Option<Entity> {
    match route.function {
        PdbFunction::F2 => build_f2(commands, area, env),
        PdbFunction::F3 => build_f3(commands, area, env, route),
        PdbFunction::F4 => build_f4(commands, area),
        PdbFunction::F5 => build_f5(commands, area, env),
        PdbFunction::F6 => build_f6(commands, area, env),
        PdbFunction::F7 => build_f7(commands, area, env),
        PdbFunction::F9 => build_f9(commands, area, env),
        PdbFunction::F10 => build_f10(commands, area, env),
    }
}
