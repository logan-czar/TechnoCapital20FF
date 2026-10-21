//! Page documents (M9 B1; D480): an entity page is first built as a [`PageDoc`], plain data made
//! from the views (spec 9), and only then spawned as nodes. The data form is what the tests read
//! (every spec 8 field present, bands and never the truth, every link's target, no ballot
//! odds), so a test checks what the page shows without a window.
//!
//! - [`Span`]: a piece of a line: text, a link, a view [`Figure`] (through [`Cell::figure`],
//!   D461), or a [`Live`] value that follows the views every frame they change (prices, index
//!   levels, the projection range) without rebuilding the page.
//! - [`Block`]: a dense label and value grid ([`Field`]s that wrap to fill the pane), a line, a
//!   table (a [`TableModel`] with a stable id, D456), a chart, cards, a progress bar.
//! - [`SectionDoc`]: a registered section's blocks (D460). Collapsed sections are not filled
//!   (their page rebuilds when they open), so a page used as a tab strip only builds its tab.
//!
//! Pages with tabs (the Company page) put a tab strip in their header: a tab expands its section
//! and collapses the others in the page kind's section config, so the choice persists like any
//! section setting (D481).

use std::sync::Arc;

use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use sim::SimViews;
use sim::views::estimate::Figure;
use sim::world::{CompanyId, ZoneId};

use super::{PageBuild, PageKind, PageRef, SectionSpec, arrange_sections};
use crate::bridge::Views;
use crate::chart::{Chart, ChartModel, spawn_chart};
use crate::config::UiConfig;
use crate::links::link_sized;
use crate::table::format::{self, GainUnit};
use crate::table::{Cell, Table, TableModel, Unit, spawn_table_with_id};
use crate::ui::theme::{self, Tooltip, color, font, size};

/// A field's label column width in logical pixels.
pub const LABEL_WIDTH: f32 = 118.0;
/// The basis width of one field of a [`Block::Fields`] grid: fields grow to fill the row, and a
/// long value widens its field (onto its own line) rather than overlapping the next.
pub const FIELD_BASIS: f32 = 250.0;
/// A card's basis width ([`Block::Cards`]); a card widens to fit its text.
pub const CARD_WIDTH: f32 = 238.0;
/// A card field's label width.
pub const CARD_LABEL_WIDTH: f32 = 96.0;
/// The height a chart block takes.
pub const CHART_HEIGHT: f32 = 230.0;
/// The most rows a section table shows before it scrolls inside itself.
pub const TABLE_ROWS_SHOWN: usize = 40;
/// Room for a table's footer line under its rows.
pub const TABLE_FOOTER: f32 = 20.0;
/// A progress bar's width and height.
pub const BAR_WIDTH: f32 = 220.0;
pub const BAR_HEIGHT: f32 = 8.0;

/// A value that follows the views without a page rebuild (prices every tick, daily levels).
#[derive(Component, Debug, Clone, Copy, PartialEq)]
pub enum Live {
    /// The last price a share (v_quotes), "-" when not quoted.
    Price(CompanyId),
    /// The day's change in percent (v_quotes), colored.
    DayChange(CompanyId),
    /// The EFV a share and its band (v_quotes).
    Efv(CompanyId),
    /// Market cap at the last price (v_quotes).
    MarketCap(CompanyId),
    /// The headline index level now (v_quotes).
    IndexLevel(ZoneId),
    /// The index's change since the last daily close (v_quotes).
    IndexChange(ZoneId),
    /// Investor confidence (v_zones, daily).
    ZoneConfidence(ZoneId),
    /// The effective credit spread (v_zones, daily).
    ZoneSpread(ZoneId),
    /// The listed count (v_exchanges, daily).
    ListedCount(ZoneId),
    /// The projection range of this quarter's net income (v_projection, daily).
    ProjectionRange(CompanyId),
    /// The consensus (v_projection, daily).
    Consensus(CompanyId),
    /// The next release (v_clock).
    NextRelease,
}

impl Live {
    /// The text and color the value shows now.
    pub fn text(self, v: &SimViews) -> (String, Color) {
        let dash = || ("-".to_owned(), color::TEXT_MUTED);
        let cell = |c: Cell| {
            let col = c.color().unwrap_or(color::TEXT);
            (c.display(), col)
        };
        match self {
            Live::Price(id) => v
                .quotes
                .get()
                .get(id)
                .map_or_else(dash, |q| cell(Cell::Price(q.last))),
            Live::DayChange(id) => v
                .quotes
                .get()
                .get(id)
                .map_or_else(dash, |q| cell(Cell::Gain(q.change_pct, GainUnit::Percent))),
            Live::Efv(id) => v.quotes.get().get(id).map_or_else(dash, |q| {
                (
                    format!(
                        "{} (band {})",
                        format::price(q.efv),
                        format::band_in(Unit::Price, q.efv_low, q.efv_high)
                    ),
                    color::TEXT,
                )
            }),
            Live::MarketCap(id) => v
                .quotes
                .get()
                .get(id)
                .map_or_else(dash, |q| cell(Cell::Money(q.market_cap))),
            Live::IndexLevel(z) => v
                .quotes
                .get()
                .index(z)
                .and_then(|i| i.level)
                .map_or_else(dash, |l| cell(Cell::Number(l))),
            Live::IndexChange(z) => v
                .quotes
                .get()
                .index(z)
                .and_then(|i| Some((i.level?, i.prev_close?)))
                .filter(|&(_, p)| p > 0.0)
                .map_or_else(dash, |(l, p)| {
                    cell(Cell::Gain(l / p - 1.0, GainUnit::Percent))
                }),
            Live::ZoneConfidence(z) => v
                .zones
                .get()
                .get(z)
                .map_or_else(dash, |r| (format!("{:+.1}", r.confidence), color::TEXT)),
            Live::ZoneSpread(z) => v
                .zones
                .get()
                .get(z)
                .map_or_else(dash, |r| (bps(r.credit_spread), color::TEXT)),
            Live::ListedCount(z) => v
                .exchanges
                .get()
                .exchanges
                .get(z.0 as usize)
                .map_or_else(dash, |x| cell(Cell::Int(x.listed_count as i64))),
            Live::ProjectionRange(id) => v.projection.get().get(id).map_or_else(dash, |p| {
                let (lo, hi) = p.range;
                let text = format!(
                    "{} to {} (+/-{:.0}%)",
                    format::figure(lo),
                    format::figure(hi),
                    p.width * 100.0
                );
                let c = if lo.is_band() || hi.is_band() {
                    format::BAND_TEXT
                } else {
                    color::TEXT
                };
                (text, c)
            }),
            Live::Consensus(id) => v
                .projection
                .get()
                .get(id)
                .map_or_else(dash, |p| cell(Cell::figure(p.consensus_ni, Unit::Money))),
            Live::NextRelease => {
                let c = v.clock();
                (
                    format!("{} ({} days)", format::date(c.next_release.date()), {
                        (c.next_release.date().days_since_epoch() - c.date.days_since_epoch())
                            .max(0)
                    }),
                    color::TEXT,
                )
            }
        }
    }
}

/// A spread (a fraction) in basis points: "245 bps".
pub fn bps(f: f64) -> String {
    format!("{:.0} bps", f * 1e4)
}

/// A piece of a line.
#[derive(Debug, Clone, PartialEq)]
pub enum Span {
    Text(String),
    Muted(String),
    Colored(String, Color),
    Link(String, PageRef),
    /// A view's figure: its exact value, or its band in the estimate color (D461).
    Figure(Figure, Unit),
    /// A plain cell (a price, a percent, a rating).
    Cell(Cell),
    Live(Live),
}

impl Span {
    pub fn text(s: impl Into<String>) -> Span {
        Span::Text(s.into())
    }

    pub fn muted(s: impl Into<String>) -> Span {
        Span::Muted(s.into())
    }

    pub fn link(s: impl Into<String>, page: PageRef) -> Span {
        Span::Link(s.into(), page)
    }

    /// The text and color the span shows now.
    pub fn shown(&self, v: &SimViews) -> (String, Color) {
        match self {
            Span::Text(s) => (s.clone(), color::TEXT),
            Span::Muted(s) => (s.clone(), color::TEXT_MUTED),
            Span::Colored(s, c) => (s.clone(), *c),
            Span::Link(s, _) => (s.clone(), color::LINK),
            Span::Figure(f, unit) => {
                let c = Cell::figure(*f, *unit);
                (c.display(), c.color().unwrap_or(color::TEXT))
            }
            Span::Cell(c) => (c.display(), c.color().unwrap_or(color::TEXT)),
            Span::Live(l) => l.text(v),
        }
    }
}

/// A label and its value.
#[derive(Debug, Clone, PartialEq)]
pub struct Field {
    pub label: String,
    pub value: Vec<Span>,
}

impl Field {
    pub fn new(label: &str, value: Vec<Span>) -> Field {
        Field {
            label: label.to_owned(),
            value,
        }
    }

    pub fn text(label: &str, value: impl Into<String>) -> Field {
        Field::new(label, vec![Span::text(value)])
    }

    pub fn figure(label: &str, f: Figure, unit: Unit) -> Field {
        Field::new(label, vec![Span::Figure(f, unit)])
    }

    pub fn cell(label: &str, c: Cell) -> Field {
        Field::new(label, vec![Span::Cell(c)])
    }

    pub fn live(label: &str, l: Live) -> Field {
        Field::new(label, vec![Span::Live(l)])
    }

    pub fn link(label: &str, text: impl Into<String>, page: PageRef) -> Field {
        Field::new(label, vec![Span::link(text, page)])
    }
}

/// A small card (a board seat, a founder, a data quest).
#[derive(Debug, Clone, PartialEq)]
pub struct CardDoc {
    pub head: Vec<Span>,
    pub fields: Vec<Field>,
    pub bar: Option<Progress>,
    /// A dim card (an open seat).
    pub dim: bool,
}

/// A progress bar toward `max`: a fill for an exact value, a translucent strip over the band
/// for a banded one (never a fill at the band's hidden estimate, D466).
#[derive(Debug, Clone, PartialEq)]
pub struct Progress {
    pub value: Figure,
    pub max: f64,
}

impl Progress {
    /// The bar's filled share, or for a band the share range it covers, each in 0 to 1.
    pub fn shares(&self) -> (f64, f64) {
        let s = |x: f64| {
            if self.max > 0.0 {
                (x / self.max).clamp(0.0, 1.0)
            } else {
                0.0
            }
        };
        match self.value {
            Figure::Exact(x) => (0.0, s(x)),
            Figure::Band(b) => (s(b.low), s(b.high)),
        }
    }
}

/// A table with its stable id (per page kind, D456).
#[derive(Debug, Clone, PartialEq)]
pub struct TableDoc {
    pub id: String,
    pub model: TableModel,
    /// Keep the model following a view (v_exchanges for an exchange's constituents).
    pub live: Option<LiveTable>,
}

/// Which view a live table follows, and how its model is rebuilt.
#[derive(Component, Debug, Clone, Copy, PartialEq)]
pub enum LiveTable {
    ExchangeConstituents(ZoneId),
}

/// Which history a live chart follows.
#[derive(Component, Debug, Clone, Copy, PartialEq)]
pub enum LiveChart {
    /// A company's daily bars (v_price_bars).
    Company(CompanyId),
    /// An exchange's index closes, as the UI recorded them ([`super::zone::IndexHistory`]).
    Index(ZoneId),
}

/// One block of a section.
#[derive(Debug, Clone, PartialEq)]
pub enum Block {
    /// A dense label and value grid that wraps to fill the pane.
    Fields(Vec<Field>),
    Line(Vec<Span>),
    Table(TableDoc),
    Chart(ChartModel, Option<LiveChart>),
    Cards(Vec<CardDoc>),
    /// A titled sub-heading inside a section.
    Heading(String),
}

/// A registered section's content.
#[derive(Debug, Clone, PartialEq)]
pub struct SectionDoc {
    pub id: &'static str,
    pub blocks: Vec<Block>,
}

/// A whole page.
#[derive(Debug, Clone, PartialEq)]
pub struct PageDoc {
    pub page: PageRef,
    pub title: String,
    /// The kind's name, shown after the title.
    pub kind: String,
    /// Chips after the title (status, "estimates").
    pub chips: Vec<Span>,
    /// The header's blocks (identity fields and the Founded and Listed lines).
    pub head: Vec<Block>,
    pub sections: Vec<SectionDoc>,
}

impl PageDoc {
    pub fn section(&self, id: &str) -> Option<&SectionDoc> {
        self.sections.iter().find(|s| s.id == id)
    }

    /// Every block, header first.
    pub fn blocks(&self) -> impl Iterator<Item = &Block> {
        self.head
            .iter()
            .chain(self.sections.iter().flat_map(|s| s.blocks.iter()))
    }

    /// Every field, header first, cards included.
    pub fn fields(&self) -> Vec<&Field> {
        let mut out = Vec::new();
        for b in self.blocks() {
            match b {
                Block::Fields(f) => out.extend(f.iter()),
                Block::Cards(cards) => {
                    for c in cards {
                        out.extend(c.fields.iter());
                    }
                }
                _ => {}
            }
        }
        out
    }

    /// The first field labelled `label`.
    pub fn field(&self, label: &str) -> Option<&Field> {
        self.fields().into_iter().find(|f| f.label == label)
    }

    /// Every span, header first (fields, lines, cards).
    pub fn spans(&self) -> Vec<&Span> {
        let mut out: Vec<&Span> = self.chips.iter().collect();
        for b in self.blocks() {
            match b {
                Block::Fields(f) => out.extend(f.iter().flat_map(|f| f.value.iter())),
                Block::Line(s) => out.extend(s.iter()),
                Block::Cards(cards) => {
                    for c in cards {
                        out.extend(c.head.iter());
                        out.extend(c.fields.iter().flat_map(|f| f.value.iter()));
                    }
                }
                _ => {}
            }
        }
        out
    }

    /// Every text the page shows now: the title, labels, spans, table cells and headers, chart
    /// titles and labels (for the leak and odds scans).
    pub fn texts(&self, v: &SimViews) -> Vec<String> {
        let mut out = vec![self.title.clone(), self.kind.clone()];
        for f in self.fields() {
            out.push(f.label.clone());
        }
        for s in self.spans() {
            out.push(s.shown(v).0);
        }
        for b in self.blocks() {
            match b {
                Block::Table(t) => {
                    out.extend(t.model.columns.iter().map(|c| c.title.clone()));
                    for r in 0..t.model.len() {
                        for c in 0..t.model.columns.len() {
                            out.push(t.model.display(r, c).to_owned());
                        }
                    }
                }
                Block::Chart(m, _) => {
                    out.push(m.title.clone());
                    out.extend(m.labels.iter().cloned());
                }
                Block::Heading(h) => out.push(h.clone()),
                _ => {}
            }
        }
        out
    }

    /// Every page the page links to: spans and table link cells.
    pub fn links(&self) -> Vec<PageRef> {
        let mut out: Vec<PageRef> = self
            .spans()
            .into_iter()
            .filter_map(|s| match s {
                Span::Link(_, p) => Some(p.clone()),
                Span::Cell(c) => c.link().cloned(),
                _ => None,
            })
            .collect();
        for b in self.blocks() {
            if let Block::Table(t) = b {
                for r in 0..t.model.len() {
                    for c in 0..t.model.columns.len() {
                        if let Some(p) = t.model.cell(r, c).link() {
                            out.push(p.clone());
                        }
                    }
                }
            }
        }
        out
    }

    /// The tables, by id.
    pub fn table(&self, id: &str) -> Option<&TableDoc> {
        self.blocks().find_map(|b| match b {
            Block::Table(t) if t.id == id => Some(t),
            _ => None,
        })
    }
}

/// The ids of the sections the player collapsed on a page kind: the page leaves them empty
/// (they fill when opened, which rebuilds the page).
pub fn collapsed(cfg: &UiConfig, kind: PageKind) -> Vec<String> {
    cfg.sections
        .get(kind.key())
        .map(|s| s.collapsed.iter().cloned().collect())
        .unwrap_or_default()
}

/// Shows one tab (D481): the section `id` expanded and shown, every other section of the kind
/// collapsed; `None` expands them all. Kept in the section config, so it persists.
pub fn select_tab(cfg: &mut UiConfig, kind: PageKind, defaults: &[SectionSpec], id: Option<&str>) {
    let e = cfg.sections.entry(kind.key().to_owned()).or_default();
    e.collapsed.clear();
    if let Some(id) = id {
        e.hidden.remove(id);
        for (s, _) in defaults {
            if *s != id {
                e.collapsed.insert((*s).to_owned());
            }
        }
    }
}

/// The tab shown: the one section of the kind not collapsed, when all others are.
pub fn current_tab(
    cfg: &UiConfig,
    kind: PageKind,
    defaults: &[SectionSpec],
) -> Option<&'static str> {
    let open: Vec<_> = arrange_sections(defaults, cfg.sections.get(kind.key()))
        .into_iter()
        .filter(|(_, c)| !c)
        .map(|((id, _), _)| id)
        .collect();
    (open.len() == 1 && defaults.len() > 1).then(|| open[0])
}

/// Spawns `doc` into a page build: the header (title, chips, tab strip when `tabs` is given,
/// the head blocks) and each shown section that is not collapsed.
pub fn spawn_doc(
    commands: &mut Commands,
    b: &PageBuild,
    doc: &PageDoc,
    v: &SimViews,
    cfg: &UiConfig,
    tabs: Option<&[SectionSpec]>,
) {
    let kind = b.page.kind();
    let row = super::placeholder::chip_row(commands, b.head);
    let t = commands.spawn(theme::title(doc.title.clone())).id();
    let k = commands
        .spawn(theme::text_line(
            doc.kind.clone(),
            font::SMALL,
            color::TEXT_MUTED,
        ))
        .id();
    commands.entity(row).add_children(&[t, k]);
    for s in &doc.chips {
        let e = spawn_span(commands, s, v, font::SMALL);
        commands.entity(row).add_child(e);
    }
    if let Some(defaults) = tabs {
        tab_strip(commands, b.head, kind, defaults, cfg);
    }
    for block in &doc.head {
        spawn_block(commands, b.head, block, v, cfg);
    }
    let shut = collapsed(cfg, kind);
    for s in &doc.sections {
        if shut.iter().any(|c| c == s.id) {
            continue;
        }
        if let Some(body) = b.section(s.id) {
            for block in &s.blocks {
                spawn_block(commands, body, block, v, cfg);
            }
        }
    }
}

/// The tab strip: "All" and one tab per section; the shown tab in cyan.
fn tab_strip(
    commands: &mut Commands,
    parent: Entity,
    kind: PageKind,
    defaults: &[SectionSpec],
    cfg: &UiConfig,
) {
    let row = super::placeholder::chip_row(commands, parent);
    let current = current_tab(cfg, kind, defaults);
    let label = commands
        .spawn(theme::text_line("Tabs:", font::SMALL, color::TEXT_MUTED))
        .id();
    commands.entity(row).add_child(label);
    let mut tabs: Vec<(Option<&'static str>, &'static str)> = vec![(None, "All")];
    tabs.extend(defaults.iter().map(|&(id, title)| (Some(id), title)));
    for (id, title) in tabs {
        let on = current == id;
        let defaults = defaults.to_vec();
        let e = commands
            .spawn((
                TabButton { kind, id },
                theme::text_line(
                    if on {
                        format!("[{title}]")
                    } else {
                        title.to_owned()
                    },
                    font::SMALL,
                    if on { color::CYAN } else { color::LINK },
                ),
                Hovered::default(),
                Tooltip(match id {
                    Some(_) => format!("Show only {title} (the other sections fold)"),
                    None => "Show every section".to_owned(),
                }),
            ))
            .observe(move |mut ev: On<PointerClick>, mut cfg: ResMut<UiConfig>| {
                ev.propagate(false);
                if ev.button == PointerButton::Primary {
                    select_tab(&mut cfg, kind, &defaults, id);
                }
            })
            .id();
        commands.entity(row).add_child(e);
    }
}

/// A tab of a page's tab strip.
#[derive(Component, Debug, Clone, Copy, PartialEq)]
pub struct TabButton {
    pub kind: PageKind,
    pub id: Option<&'static str>,
}

/// A live text span's value source.
#[derive(Component, Debug, Clone, Copy)]
pub struct LiveSpan(pub Live);

fn spawn_span(commands: &mut Commands, s: &Span, v: &SimViews, size: f32) -> Entity {
    match s {
        Span::Link(text, page) => commands
            .spawn(link_sized(text.clone(), page.clone(), size))
            .id(),
        Span::Cell(Cell::Link(page, text)) => commands
            .spawn(link_sized(text.clone(), page.clone(), size))
            .id(),
        Span::Live(l) => {
            let (text, c) = l.text(v);
            commands
                .spawn((theme::text_line(text, size, c), LiveSpan(*l)))
                .id()
        }
        other => {
            let (text, c) = other.shown(v);
            commands.spawn(theme::text_line(text, size, c)).id()
        }
    }
}

/// A row of spans; a line wraps, a field's value keeps to one line (its field widens instead).
fn spawn_spans(
    commands: &mut Commands,
    parent: Entity,
    spans: &[Span],
    v: &SimViews,
    size: f32,
    wrap: bool,
) {
    let row = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            flex_wrap: if wrap {
                FlexWrap::Wrap
            } else {
                FlexWrap::NoWrap
            },
            column_gap: px(5.0),
            min_width: if wrap { px(0.0) } else { Val::Auto },
            align_items: AlignItems::Baseline,
            ..default()
        })
        .id();
    for s in spans {
        let e = spawn_span(commands, s, v, size);
        commands.entity(row).add_child(e);
    }
    commands.entity(parent).add_child(row);
}

fn spawn_fields(commands: &mut Commands, parent: Entity, fields: &[Field], v: &SimViews) {
    let grid = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            flex_wrap: FlexWrap::Wrap,
            // Wrap inside the pane rather than widen it to the fields' total.
            min_width: px(0.0),
            column_gap: px(14.0),
            row_gap: px(1.0),
            ..default()
        })
        .id();
    for f in fields {
        let cell = commands
            .spawn(Node {
                flex_direction: FlexDirection::Row,
                flex_grow: 1.0,
                flex_basis: px(FIELD_BASIS),
                column_gap: px(6.0),
                align_items: AlignItems::Baseline,
                ..default()
            })
            .id();
        let label = commands
            .spawn((
                Node {
                    width: px(LABEL_WIDTH),
                    min_width: px(LABEL_WIDTH),
                    flex_shrink: 0.0,
                    overflow: Overflow::clip(),
                    ..default()
                },
                children![theme::text_line(
                    f.label.clone(),
                    font::SMALL,
                    color::TEXT_MUTED
                )],
            ))
            .id();
        commands.entity(cell).add_child(label);
        spawn_spans(commands, cell, &f.value, v, font::BODY, false);
        commands.entity(grid).add_child(cell);
    }
    commands.entity(parent).add_child(grid);
}

fn spawn_bar(commands: &mut Commands, parent: Entity, p: &Progress) {
    let (from, to) = p.shares();
    let fill = if p.value.is_band() {
        format::BAND_TEXT.with_alpha(0.45)
    } else {
        color::CYAN
    };
    let inner = commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                left: percent((from * 100.0) as f32),
                width: percent(((to - from) * 100.0) as f32),
                top: px(0.0),
                bottom: px(0.0),
                ..default()
            },
            BackgroundColor(fill),
        ))
        .id();
    let bar = commands
        .spawn((
            Node {
                width: px(BAR_WIDTH),
                max_width: percent(100.0),
                height: px(BAR_HEIGHT),
                margin: UiRect::vertical(px(2.0)),
                ..default()
            },
            BackgroundColor(color::BORDER),
        ))
        .add_child(inner)
        .id();
    commands.entity(parent).add_child(bar);
}

fn spawn_block(
    commands: &mut Commands,
    parent: Entity,
    block: &Block,
    v: &SimViews,
    cfg: &UiConfig,
) {
    match block {
        Block::Fields(f) => spawn_fields(commands, parent, f, v),
        Block::Line(s) => spawn_spans(commands, parent, s, v, font::BODY, true),
        Block::Heading(h) => {
            let e = commands
                .spawn(theme::text_line(h.clone(), font::SMALL, color::CYAN))
                .id();
            commands.entity(parent).add_child(e);
        }
        Block::Table(t) => {
            let rows = t.model.len().clamp(1, TABLE_ROWS_SHOWN) as f32;
            let row_h = cfg.row_height();
            let holder = commands
                .spawn(Node {
                    flex_direction: FlexDirection::Column,
                    height: px((rows + 1.0) * row_h + TABLE_FOOTER),
                    flex_shrink: 0.0,
                    min_width: px(0.0),
                    overflow: Overflow::clip(),
                    ..default()
                })
                .id();
            // The table sits in an absolute frame filling the holder, so a wide table clips to
            // the pane (its column chooser hides columns) instead of widening the page: an
            // absolute node adds nothing to its parent's content size.
            let frame = commands
                .spawn(Node {
                    position_type: PositionType::Absolute,
                    left: px(0.0),
                    right: px(0.0),
                    top: px(0.0),
                    bottom: px(0.0),
                    flex_direction: FlexDirection::Column,
                    ..default()
                })
                .id();
            commands.entity(holder).add_child(frame);
            commands.entity(parent).add_child(holder);
            let table = spawn_table_with_id(commands, frame, Arc::new(t.model.clone()), &t.id);
            if let Some(l) = t.live {
                commands.entity(table).insert((l, LiveVersion(0)));
            }
        }
        Block::Chart(m, live) => {
            let holder = commands
                .spawn(Node {
                    flex_direction: FlexDirection::Column,
                    height: px(CHART_HEIGHT),
                    flex_shrink: 0.0,
                    ..default()
                })
                .id();
            commands.entity(parent).add_child(holder);
            let chart = spawn_chart(commands, holder, Arc::new(m.clone()));
            if let Some(l) = live {
                commands.entity(chart).insert((*l, LiveVersion(0)));
            }
        }
        Block::Cards(cards) => {
            let row = commands
                .spawn(Node {
                    flex_direction: FlexDirection::Row,
                    flex_wrap: FlexWrap::Wrap,
                    // Wrap inside the pane rather than widen it to the cards' total.
                    min_width: px(0.0),
                    column_gap: px(size::GAP),
                    row_gap: px(size::GAP),
                    ..default()
                })
                .id();
            for c in cards {
                let card = commands
                    .spawn((
                        Node {
                            flex_direction: FlexDirection::Column,
                            flex_basis: px(CARD_WIDTH),
                            flex_grow: 0.0,
                            padding: UiRect::all(px(5.0)),
                            row_gap: px(1.0),
                            border: UiRect::all(px(1.0)),
                            ..default()
                        },
                        BackgroundColor(if c.dim {
                            color::BG
                        } else {
                            color::PANEL_RAISED
                        }),
                        BorderColor::all(color::BORDER),
                    ))
                    .id();
                spawn_spans(commands, card, &c.head, v, font::BODY, true);
                for f in &c.fields {
                    let line = commands
                        .spawn(Node {
                            flex_direction: FlexDirection::Row,
                            column_gap: px(6.0),
                            align_items: AlignItems::Baseline,
                            ..default()
                        })
                        .id();
                    let label = commands
                        .spawn((
                            Node {
                                width: px(CARD_LABEL_WIDTH),
                                min_width: px(CARD_LABEL_WIDTH),
                                flex_shrink: 0.0,
                                ..default()
                            },
                            children![theme::text_line(
                                f.label.clone(),
                                font::SMALL,
                                color::TEXT_MUTED
                            )],
                        ))
                        .id();
                    commands.entity(line).add_child(label);
                    spawn_spans(commands, line, &f.value, v, font::SMALL, false);
                    commands.entity(card).add_child(line);
                }
                if let Some(p) = &c.bar {
                    spawn_bar(commands, card, p);
                }
                commands.entity(row).add_child(card);
            }
            commands.entity(parent).add_child(row);
        }
    }
}

/// The live value systems, and the index record they chart.
pub fn register(app: &mut App) {
    app.add_systems(
        Update,
        (
            super::zone::record_index_history,
            update_live_spans,
            update_live_tables,
            update_live_charts,
        )
            .chain()
            .in_set(crate::ui::UiSystems::Show),
    );
}

/// The view version a live table or chart last drew from.
#[derive(Component, Debug, Clone, Copy, Default)]
pub struct LiveVersion(pub u64);

/// Rewrites live spans when the views change (or when they appear).
pub fn update_live_spans(
    views: Res<Views>,
    mut spans: Query<(Ref<LiveSpan>, &mut Text, &mut TextColor)>,
) {
    let all = views.is_changed();
    for (l, mut text, mut c) in &mut spans {
        if !all && !l.is_added() {
            continue;
        }
        let (s, col) = l.0.text(&views);
        if text.0 != s {
            text.0 = s;
        }
        if c.0 != col {
            c.0 = col;
        }
    }
}

/// Re-sets live tables' models when the view they follow moved.
pub fn update_live_tables(
    views: Res<Views>,
    index: Res<crate::command::index::NameIndex>,
    mut tables: Query<(&LiveTable, &mut LiveVersion, &mut Table)>,
) {
    if !views.is_changed() {
        return;
    }
    for (l, mut ver, mut t) in &mut tables {
        let now = match l {
            LiveTable::ExchangeConstituents(_) => views.exchanges.version(),
        };
        if ver.0 == 0 {
            ver.0 = now;
            continue;
        }
        if ver.0 != now {
            ver.0 = now;
            let model = match *l {
                LiveTable::ExchangeConstituents(z) => {
                    super::exchange::constituents_model(z, &views, &index)
                }
            };
            t.set_model(Arc::new(model));
        }
    }
}

/// Re-sets live charts' models when their history moved.
pub fn update_live_charts(
    views: Res<Views>,
    history: Res<super::zone::IndexHistory>,
    index: Res<crate::command::index::NameIndex>,
    mut charts: Query<(&LiveChart, &mut LiveVersion, &mut Chart)>,
) {
    if !(views.is_changed() || history.is_changed()) {
        return;
    }
    for (l, mut ver, mut c) in &mut charts {
        let now = match l {
            LiveChart::Company(_) => views.price_bars.version(),
            LiveChart::Index(_) => history.version(),
        };
        if ver.0 == 0 {
            ver.0 = now;
            continue;
        }
        if ver.0 == now {
            continue;
        }
        ver.0 = now;
        let model = match *l {
            LiveChart::Company(id) => super::company::price_chart(id, &views),
            LiveChart::Index(z) => Some(super::zone::index_chart(z, &views, &history, &index)),
        };
        if let Some(m) = model {
            c.set_model(Arc::new(m));
        }
    }
}
