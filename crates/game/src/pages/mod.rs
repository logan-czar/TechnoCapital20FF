//! Pages: the typed page reference, the page registry and the page-section API (M9 A2; D451,
//! D460). Every info screen is a page shown in a workspace pane ([`crate::workspace`]); a page
//! is named by a [`PageRef`] and built by the builder its [`PageKind`] registered.
//!
//! **Writing a page (Phase B).** Register a builder system for its kind in a plugin:
//!
//! ```ignore
//! app.register_page(
//!     PageKind::Company,
//!     PageSpec::new(&[ViewKey::CompanyDetail, ViewKey::Quotes])
//!         .sections(&[("overview", "Overview"), ("board", "Board")])
//!         .refresh(Refresh::OnViewChange),
//!     company_page,
//! );
//!
//! fn company_page(In(build): In<PageBuild>, mut commands: Commands, views: Res<Views>) {
//!     // build.head: the page header; build.section("overview"): a section body, or None when
//!     // the player hid it.
//! }
//! ```
//!
//! A later registration for a kind replaces the earlier one, so Phase B plugins (added after
//! [`PagesPlugin`]) replace the placeholders. Pages read only [`crate::bridge::Views`] (spec 9).

pub mod character;
pub mod company;
pub mod country;
pub mod doc;
pub mod events;
pub mod exchange;
pub mod industries;
pub mod lists;
pub mod live;
pub mod market;
pub mod news;
pub mod placeholder;
pub mod recap;
pub mod settings;
pub mod world;
pub mod zone;

use std::collections::HashMap;
use std::fmt;

use bevy::ecs::system::SystemId;
use bevy::prelude::*;
use serde::{Deserialize, Serialize};
use sim::time::{Date, Quarter};
use sim::views::Cadence;
use sim::world::{CharacterId, CompanyId, CountryId, IndustryId, StartupEventId, ZoneId};

use crate::config::{SectionsConfig, UiConfig};
use crate::ui::theme::{self, color, font, size};

/// A page of the workspace: an entity page or a list page (D451). Its text form
/// ([`PageRef::key`]) is what the config file stores, so a saved layout reads like
/// `"company/12"` or `"recap/2020-Q1"`.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(into = "String", try_from = "String")]
pub enum PageRef {
    /// The map's place (M8); until then the province table.
    World,
    Company(CompanyId),
    Industry(IndustryId),
    Character(CharacterId),
    Country(CountryId),
    /// A financial zone (spec 3.2.1).
    Zone(ZoneId),
    /// A zone's exchange: one exchange per zone (spec 5.14), so it is keyed by the zone.
    Exchange(ZoneId),
    /// A startup event that fired (5.19).
    Event(StartupEventId),
    /// The quarterly recap of a quarter (M9.5).
    Recap(Quarter),
    /// A headline: the `n`th headline posted on `date` (the feed drops old headlines, so a
    /// position in it is not stable; D451).
    Headline {
        date: Date,
        n: u32,
    },
    Companies,
    Industries,
    News,
    Characters,
    Countries,
    Exchanges,
    Zones,
    Events,
    /// Density, font size, saved layouts and the keyboard shortcuts.
    Settings,
}

/// A page's kind: the [`PageRef`] variant without its id, the key of the page registry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum PageKind {
    World,
    Company,
    Industry,
    Character,
    Country,
    Zone,
    Exchange,
    Event,
    Recap,
    Headline,
    Companies,
    Industries,
    News,
    Characters,
    Countries,
    Exchanges,
    Zones,
    Events,
    Settings,
}

impl PageKind {
    pub const ALL: [PageKind; 19] = [
        PageKind::World,
        PageKind::Company,
        PageKind::Industry,
        PageKind::Character,
        PageKind::Country,
        PageKind::Zone,
        PageKind::Exchange,
        PageKind::Event,
        PageKind::Recap,
        PageKind::Headline,
        PageKind::Companies,
        PageKind::Industries,
        PageKind::News,
        PageKind::Characters,
        PageKind::Countries,
        PageKind::Exchanges,
        PageKind::Zones,
        PageKind::Events,
        PageKind::Settings,
    ];

    /// The kind's key: the first part of a [`PageRef::key`], and the config key of its sections.
    pub fn key(self) -> &'static str {
        match self {
            PageKind::World => "world",
            PageKind::Company => "company",
            PageKind::Industry => "industry",
            PageKind::Character => "character",
            PageKind::Country => "country",
            PageKind::Zone => "zone",
            PageKind::Exchange => "exchange",
            PageKind::Event => "event",
            PageKind::Recap => "recap",
            PageKind::Headline => "headline",
            PageKind::Companies => "companies",
            PageKind::Industries => "industries",
            PageKind::News => "news",
            PageKind::Characters => "characters",
            PageKind::Countries => "countries",
            PageKind::Exchanges => "exchanges",
            PageKind::Zones => "zones",
            PageKind::Events => "events",
            PageKind::Settings => "settings",
        }
    }

    /// The kind's name on screen.
    pub fn name(self) -> &'static str {
        match self {
            PageKind::World => "World",
            PageKind::Company => "Company",
            PageKind::Industry => "Industry",
            PageKind::Character => "Character",
            PageKind::Country => "Country",
            PageKind::Zone => "Financial zone",
            PageKind::Exchange => "Exchange",
            PageKind::Event => "Startup event",
            PageKind::Recap => "Quarterly recap",
            PageKind::Headline => "Headline",
            PageKind::Companies => "Companies",
            PageKind::Industries => "Industries",
            PageKind::News => "News feed",
            PageKind::Characters => "Characters",
            PageKind::Countries => "Countries",
            PageKind::Exchanges => "Exchanges",
            PageKind::Zones => "Financial zones",
            PageKind::Events => "Startup events",
            PageKind::Settings => "Settings",
        }
    }

    /// A short ASCII tag for the command bar and breadcrumbs (D302: no icon font).
    pub fn tag(self) -> &'static str {
        match self {
            PageKind::World => "MAP",
            PageKind::Company | PageKind::Companies => "CO",
            PageKind::Industry | PageKind::Industries => "IND",
            PageKind::Character | PageKind::Characters => "CHR",
            PageKind::Country | PageKind::Countries => "CTY",
            PageKind::Zone | PageKind::Zones => "ZON",
            PageKind::Exchange | PageKind::Exchanges => "EXC",
            PageKind::Event | PageKind::Events => "EVT",
            PageKind::Recap => "RCP",
            PageKind::Headline | PageKind::News => "NEWS",
            PageKind::Settings => "SET",
        }
    }

    pub fn is_list(self) -> bool {
        matches!(
            self,
            PageKind::Companies
                | PageKind::Industries
                | PageKind::News
                | PageKind::Characters
                | PageKind::Countries
                | PageKind::Exchanges
                | PageKind::Zones
                | PageKind::Events
        )
    }

    fn from_key(s: &str) -> Option<PageKind> {
        PageKind::ALL.into_iter().find(|k| k.key() == s)
    }
}

impl PageRef {
    pub fn kind(&self) -> PageKind {
        match self {
            PageRef::World => PageKind::World,
            PageRef::Company(_) => PageKind::Company,
            PageRef::Industry(_) => PageKind::Industry,
            PageRef::Character(_) => PageKind::Character,
            PageRef::Country(_) => PageKind::Country,
            PageRef::Zone(_) => PageKind::Zone,
            PageRef::Exchange(_) => PageKind::Exchange,
            PageRef::Event(_) => PageKind::Event,
            PageRef::Recap(_) => PageKind::Recap,
            PageRef::Headline { .. } => PageKind::Headline,
            PageRef::Companies => PageKind::Companies,
            PageRef::Industries => PageKind::Industries,
            PageRef::News => PageKind::News,
            PageRef::Characters => PageKind::Characters,
            PageRef::Countries => PageKind::Countries,
            PageRef::Exchanges => PageKind::Exchanges,
            PageRef::Zones => PageKind::Zones,
            PageRef::Events => PageKind::Events,
            PageRef::Settings => PageKind::Settings,
        }
    }

    /// The text form: `kind` for a list page, `kind/id` for an entity, `recap/2020-Q1`,
    /// `headline/2020-03-02/0`.
    pub fn key(&self) -> String {
        let k = self.kind().key();
        match self {
            PageRef::Company(id) => format!("{k}/{}", id.0),
            PageRef::Industry(id) => format!("{k}/{}", id.0),
            PageRef::Character(id) => format!("{k}/{}", id.0),
            PageRef::Country(id) => format!("{k}/{}", id.0),
            PageRef::Zone(id) | PageRef::Exchange(id) => format!("{k}/{}", id.0),
            PageRef::Event(id) => format!("{k}/{}", id.0),
            PageRef::Recap(q) => format!("{k}/{}-Q{}", q.year, q.q),
            PageRef::Headline { date, n } => format!("{k}/{date}/{n}"),
            _ => k.to_owned(),
        }
    }

    /// Parses [`PageRef::key`]'s form.
    pub fn from_key(s: &str) -> Option<PageRef> {
        let mut parts = s.trim().split('/');
        let kind = PageKind::from_key(parts.next()?)?;
        let id = parts.next();
        let num = |p: Option<&str>| p.and_then(|v| v.parse::<u32>().ok());
        let page = match kind {
            PageKind::Company => PageRef::Company(CompanyId(num(id)?)),
            PageKind::Industry => PageRef::Industry(IndustryId(num(id)?)),
            PageKind::Character => PageRef::Character(CharacterId(num(id)?)),
            PageKind::Country => PageRef::Country(CountryId(num(id)?)),
            PageKind::Zone => PageRef::Zone(ZoneId(num(id)?)),
            PageKind::Exchange => PageRef::Exchange(ZoneId(num(id)?)),
            PageKind::Event => PageRef::Event(StartupEventId(num(id)?)),
            PageKind::Recap => {
                let (y, q) = id?.split_once("-Q")?;
                let q: u8 = q.parse().ok()?;
                if !(1..=4).contains(&q) {
                    return None;
                }
                PageRef::Recap(Quarter {
                    year: y.parse().ok()?,
                    q,
                })
            }
            PageKind::Headline => {
                let mut d = id?.split('-').map(str::parse::<u32>);
                let (y, m, day) = (d.next()?.ok()?, d.next()?.ok()?, d.next()?.ok()?);
                let date = Date::new(
                    i32::try_from(y).ok()?,
                    u8::try_from(m).ok()?,
                    u8::try_from(day).ok()?,
                )?;
                PageRef::Headline {
                    date,
                    n: num(parts.next())?,
                }
            }
            PageKind::World => PageRef::World,
            PageKind::Companies => PageRef::Companies,
            PageKind::Industries => PageRef::Industries,
            PageKind::News => PageRef::News,
            PageKind::Characters => PageRef::Characters,
            PageKind::Countries => PageRef::Countries,
            PageKind::Exchanges => PageRef::Exchanges,
            PageKind::Zones => PageRef::Zones,
            PageKind::Events => PageRef::Events,
            PageKind::Settings => PageRef::Settings,
        };
        if parts.next().is_some() {
            return None;
        }
        Some(page)
    }
}

impl fmt::Display for PageRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.key())
    }
}

impl From<PageRef> for String {
    fn from(p: PageRef) -> String {
        p.key()
    }
}

impl TryFrom<String> for PageRef {
    type Error = String;

    fn try_from(s: String) -> Result<PageRef, String> {
        PageRef::from_key(&s).ok_or_else(|| format!("not a page: {s:?}"))
    }
}

/// The sim views a page reads (spec 9.4), for its view list and its rebuild on change.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ViewKey {
    Clock,
    Quotes,
    PriceBars,
    Exchanges,
    News,
    Births,
    Projection,
    CompanyRows,
    CompanyDetail,
    Units,
    Tech,
    IndustryRows,
    IndustryDetail,
    Cycle,
    MapLayers,
    ProvinceCards,
    Statements,
    Filings,
    Ratings,
    Recap,
    MapStatic,
    Places,
    Countries,
    Zones,
    Rates,
    Characters,
    CapTable,
}

/// A view's name, version and cadence.
pub fn view_meta(v: &sim::SimViews, key: ViewKey) -> (&'static str, u64, Cadence) {
    macro_rules! m {
        ($name:literal, $f:ident) => {
            ($name, v.$f.version(), v.$f.cadence())
        };
    }
    match key {
        ViewKey::Clock => m!("v_clock", clock),
        ViewKey::Quotes => m!("v_quotes", quotes),
        ViewKey::PriceBars => m!("v_price_bars", price_bars),
        ViewKey::Exchanges => m!("v_exchanges", exchanges),
        ViewKey::News => m!("v_news", news),
        ViewKey::Births => m!("v_births", births),
        ViewKey::Projection => m!("v_projection", projection),
        ViewKey::CompanyRows => m!("v_company_row", company_rows),
        ViewKey::CompanyDetail => m!("v_company_detail", company_detail),
        ViewKey::Units => m!("v_units", units),
        ViewKey::Tech => m!("v_tech", tech),
        ViewKey::IndustryRows => m!("v_industry_row", industry_rows),
        ViewKey::IndustryDetail => m!("v_industry_detail", industry_detail),
        ViewKey::Cycle => m!("v_cycle", cycle),
        ViewKey::MapLayers => m!("v_map_layers", map_layers),
        ViewKey::ProvinceCards => m!("v_province_card", province_cards),
        ViewKey::Statements => m!("v_statements", statements),
        ViewKey::Filings => m!("v_filings", filings),
        ViewKey::Ratings => m!("v_ratings", ratings),
        ViewKey::Recap => m!("v_recap", recap),
        ViewKey::MapStatic => m!("v_map_static", map_static),
        ViewKey::Places => m!("v_places", places),
        ViewKey::Countries => m!("v_countries", countries),
        ViewKey::Zones => m!("v_zones", zones),
        ViewKey::Rates => m!("v_rates", rates),
        ViewKey::Characters => m!("v_characters", characters),
        ViewKey::CapTable => m!("v_cap_table", cap_table),
    }
}

pub fn cadence_name(c: Cadence) -> &'static str {
    match c {
        Cadence::EveryTick => "every tick",
        Cadence::Daily => "daily",
        Cadence::Monthly => "monthly and on load",
        Cadence::MonthlyAndLock => "monthly, at plan locks and on load",
        Cadence::Quarterly => "quarterly",
        Cadence::OnceAtLoad => "once at load",
    }
}

/// When a pane rebuilds a page's body.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Refresh {
    /// Only when it opens (or its sections change): the page updates its own entities, as a
    /// table or a chart does (pages reading every-tick views like v_quotes want this).
    #[default]
    Manual,
    /// Also whenever one of its views' versions moves.
    OnViewChange,
    /// Also whenever the config's display settings or layout names change
    /// ([`UiConfig::display_signature`]; the Settings page). Focus moves and divider drags
    /// change only the last layout, so they rebuild nothing.
    OnConfigChange,
}

/// A page section: its config id and its title.
pub type SectionSpec = (&'static str, &'static str);

/// What a page kind registered.
#[derive(Debug, Clone)]
pub struct PageSpec {
    /// The views the page reads (shown on placeholders; watched by [`Refresh::OnViewChange`]).
    pub views: Vec<ViewKey>,
    /// Views the page will read that the sim does not have yet (lane A1's), by name.
    pub planned: Vec<&'static str>,
    /// Its sections in default order.
    pub sections: Vec<SectionSpec>,
    pub refresh: Refresh,
    builder: Option<SystemId<In<PageBuild>>>,
}

impl PageSpec {
    pub fn new(views: &[ViewKey]) -> PageSpec {
        PageSpec {
            views: views.to_vec(),
            planned: Vec::new(),
            sections: Vec::new(),
            refresh: Refresh::Manual,
            builder: None,
        }
    }

    pub fn planned(mut self, names: &[&'static str]) -> PageSpec {
        self.planned = names.to_vec();
        self
    }

    pub fn sections(mut self, sections: &[SectionSpec]) -> PageSpec {
        self.sections = sections.to_vec();
        self
    }

    pub fn refresh(mut self, refresh: Refresh) -> PageSpec {
        self.refresh = refresh;
        self
    }

    pub fn builder(&self) -> Option<SystemId<In<PageBuild>>> {
        self.builder
    }
}

/// Every page kind's spec and builder.
#[derive(Resource, Debug, Default)]
pub struct PageRegistry {
    specs: HashMap<PageKind, PageSpec>,
}

impl PageRegistry {
    pub fn get(&self, kind: PageKind) -> Option<&PageSpec> {
        self.specs.get(&kind)
    }
}

/// What a page builder gets: the page, the pane it is in, and the entities to fill.
#[derive(Debug, Clone)]
pub struct PageBuild {
    pub page: PageRef,
    /// The pane's id (`workspace::PaneId.0`).
    pub pane: u32,
    /// The page's scrolling body (holds `head` and the sections).
    pub body: Entity,
    /// The page header slot, above the sections.
    pub head: Entity,
    /// Shown sections in the player's order: id and body entity. Hidden ones are absent;
    /// collapsed ones have a body that is not displayed (a builder fills it anyway).
    pub sections: Vec<(&'static str, Entity)>,
    /// A slot after the sections for content that is not a section (a page's main table).
    pub tail: Entity,
}

impl PageBuild {
    /// A section's body, or `None` when the player hid it.
    pub fn section(&self, id: &str) -> Option<Entity> {
        self.sections
            .iter()
            .find(|(s, _)| *s == id)
            .map(|&(_, e)| e)
    }
}

/// Registering page builders on the [`App`].
pub trait PageAppExt {
    /// Registers (or replaces) the builder of `kind`.
    fn register_page<M>(
        &mut self,
        kind: PageKind,
        spec: PageSpec,
        builder: impl IntoSystem<In<PageBuild>, (), M> + 'static,
    ) -> &mut Self;
}

impl PageAppExt for App {
    fn register_page<M>(
        &mut self,
        kind: PageKind,
        mut spec: PageSpec,
        builder: impl IntoSystem<In<PageBuild>, (), M> + 'static,
    ) -> &mut Self {
        let id = self.world_mut().register_system(builder);
        spec.builder = Some(id);
        self.world_mut()
            .get_resource_or_init::<PageRegistry>()
            .specs
            .insert(kind, spec);
        self
    }
}

/// The sections of a page kind in the player's order, each with its collapsed flag; hidden ones
/// are left out (D460). Sections the config does not name keep their default place after the
/// named ones; config ids the page no longer has are ignored.
pub fn arrange_sections(
    defaults: &[SectionSpec],
    cfg: Option<&SectionsConfig>,
) -> Vec<(SectionSpec, bool)> {
    let Some(cfg) = cfg else {
        return defaults.iter().map(|&s| (s, false)).collect();
    };
    let mut out: Vec<SectionSpec> = cfg
        .order
        .iter()
        .filter_map(|id| defaults.iter().find(|(d, _)| d == id).copied())
        .collect();
    for &s in defaults {
        if !out.iter().any(|(d, _)| *d == s.0) {
            out.push(s);
        }
    }
    out.into_iter()
        .filter(|(id, _)| !cfg.hidden.contains(*id))
        .map(|s| (s, cfg.collapsed.contains(s.0)))
        .collect()
}

/// Moves section `id` of a page kind up (`delta` -1) or down (+1) in the config, starting from
/// the default order when the player has not ordered them yet.
pub fn move_section(
    cfg: &mut UiConfig,
    kind: PageKind,
    defaults: &[SectionSpec],
    id: &str,
    delta: i32,
) {
    let entry = cfg.sections.entry(kind.key().to_owned()).or_default();
    let mut order: Vec<String> = arrange_sections(defaults, Some(entry))
        .into_iter()
        .map(|((s, _), _)| s.to_owned())
        .collect();
    // Hidden sections keep their place at the end of the order.
    for (d, _) in defaults {
        if !order.iter().any(|o| o == d) {
            order.push((*d).to_owned());
        }
    }
    if let Some(i) = order.iter().position(|o| o == id) {
        let j = (i as i32 + delta).clamp(0, order.len() as i32 - 1) as usize;
        let s = order.remove(i);
        order.insert(j, s);
    }
    entry.order = order;
}

/// What a section header button does.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SectionOp {
    ToggleCollapse,
    Up,
    Down,
    Hide,
    Show,
}

/// Applies a section header button to the config.
pub fn apply_section_op(
    cfg: &mut UiConfig,
    kind: PageKind,
    defaults: &[SectionSpec],
    id: &str,
    op: SectionOp,
) {
    match op {
        SectionOp::Up => move_section(cfg, kind, defaults, id, -1),
        SectionOp::Down => move_section(cfg, kind, defaults, id, 1),
        SectionOp::ToggleCollapse => {
            let e = cfg.sections.entry(kind.key().to_owned()).or_default();
            if !e.collapsed.remove(id) {
                e.collapsed.insert(id.to_owned());
            }
        }
        SectionOp::Hide => {
            let e = cfg.sections.entry(kind.key().to_owned()).or_default();
            e.hidden.insert(id.to_owned());
        }
        SectionOp::Show => {
            let e = cfg.sections.entry(kind.key().to_owned()).or_default();
            e.hidden.remove(id);
        }
    }
}

/// Where full-screen Pdoomberg is (20.5.2): its function key page and the company it is on.
/// The command bar sets it (`ARDR F3`); lane B2 draws the F-key pages from it.
#[derive(Resource, Debug, Clone, Copy, PartialEq, Eq)]
pub struct PdoombergRoute {
    pub function: PdbFunction,
    pub company: Option<CompanyId>,
}

impl Default for PdoombergRoute {
    fn default() -> Self {
        PdoombergRoute {
            function: PdbFunction::F2,
            company: None,
        }
    }
}

/// Pdoomberg's function pages (spec 8, 20.5.2). F1 and F8 are not in the MVP.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PdbFunction {
    F2,
    F3,
    F4,
    F5,
    F6,
    F7,
    F9,
    F10,
}

impl PdbFunction {
    pub const ALL: [PdbFunction; 8] = [
        PdbFunction::F2,
        PdbFunction::F3,
        PdbFunction::F4,
        PdbFunction::F5,
        PdbFunction::F6,
        PdbFunction::F7,
        PdbFunction::F9,
        PdbFunction::F10,
    ];

    pub fn code(self) -> &'static str {
        match self {
            PdbFunction::F2 => "F2",
            PdbFunction::F3 => "F3",
            PdbFunction::F4 => "F4",
            PdbFunction::F5 => "F5",
            PdbFunction::F6 => "F6",
            PdbFunction::F7 => "F7",
            PdbFunction::F9 => "F9",
            PdbFunction::F10 => "F10",
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            PdbFunction::F2 => "Quotes",
            PdbFunction::F3 => "Chart",
            PdbFunction::F4 => "Order",
            PdbFunction::F5 => "Filings",
            PdbFunction::F6 => "Ratings",
            PdbFunction::F7 => "Bonds",
            PdbFunction::F9 => "Industries",
            PdbFunction::F10 => "Screener",
        }
    }

    /// Parses "F3", "f10" (and the 20.5.2 mnemonic "SCRN" for F10).
    pub fn parse(s: &str) -> Option<PdbFunction> {
        let s = s.trim().to_ascii_uppercase();
        if s == "SCRN" {
            return Some(PdbFunction::F10);
        }
        PdbFunction::ALL.into_iter().find(|f| f.code() == s)
    }
}

/// Opens full-screen Pdoomberg on a function page, and a company when given.
#[derive(Message, Debug, Clone, Copy, PartialEq, Eq)]
pub struct OpenPdoomberg {
    pub function: PdbFunction,
    pub company: Option<CompanyId>,
}

/// A section's header: marks it for the section buttons.
#[derive(Component, Debug, Clone)]
pub struct SectionHeader {
    pub kind: PageKind,
    pub id: &'static str,
}

/// Spawns a page's sections under `body` (header with collapse, move and hide buttons, then a
/// body) and returns the shown sections' bodies in order, and a line for the hidden ones.
pub fn spawn_sections(
    commands: &mut Commands,
    body: Entity,
    kind: PageKind,
    defaults: &[SectionSpec],
    cfg: &UiConfig,
) -> Vec<(&'static str, Entity)> {
    let arranged = arrange_sections(defaults, cfg.sections.get(kind.key()));
    let mut out = Vec::with_capacity(arranged.len());
    for ((id, title), collapsed) in arranged {
        let section = commands
            .spawn(Node {
                flex_direction: FlexDirection::Column,
                row_gap: px(2.0),
                ..default()
            })
            .id();
        commands.entity(body).add_child(section);
        let head = commands
            .spawn((
                Node {
                    flex_direction: FlexDirection::Row,
                    align_items: AlignItems::Center,
                    column_gap: px(size::GAP),
                    border: UiRect::bottom(px(1.0)),
                    ..default()
                },
                BorderColor::all(color::BORDER),
                SectionHeader { kind, id },
            ))
            .id();
        let fold = if collapsed { "[+]" } else { "[-]" };
        let toggle = section_button(commands, kind, defaults, id, SectionOp::ToggleCollapse);
        let fold_text = commands
            .spawn(theme::text(
                format!("{fold} {title}"),
                font::BODY,
                color::CYAN,
            ))
            .id();
        commands.entity(toggle).add_child(fold_text);
        let spacer = commands
            .spawn(Node {
                flex_grow: 1.0,
                ..default()
            })
            .id();
        commands.entity(head).add_children(&[toggle, spacer]);
        for (label, op, hint) in [
            ("^", SectionOp::Up, "Move the section up"),
            ("v", SectionOp::Down, "Move the section down"),
            (
                "x",
                SectionOp::Hide,
                "Hide the section (Settings or the line below shows it)",
            ),
        ] {
            let b = section_button(commands, kind, defaults, id, op);
            commands.entity(b).insert(theme::Tooltip(hint.into()));
            let t = commands
                .spawn(theme::text(label, font::SMALL, color::TEXT_MUTED))
                .id();
            commands.entity(b).add_child(t);
            commands.entity(head).add_child(b);
        }
        let sbody = commands
            .spawn(Node {
                flex_direction: FlexDirection::Column,
                row_gap: px(2.0),
                padding: UiRect::left(px(size::GAP)),
                display: if collapsed {
                    Display::None
                } else {
                    Display::Flex
                },
                ..default()
            })
            .id();
        commands.entity(section).add_children(&[head, sbody]);
        out.push((id, sbody));
    }
    let hidden: Vec<SectionSpec> = defaults
        .iter()
        .filter(|(id, _)| {
            cfg.sections
                .get(kind.key())
                .is_some_and(|c| c.hidden.contains(*id))
        })
        .copied()
        .collect();
    if !hidden.is_empty() {
        let line = commands
            .spawn(Node {
                flex_direction: FlexDirection::Row,
                column_gap: px(size::GAP),
                ..default()
            })
            .id();
        let label = commands.spawn(theme::muted("Hidden sections:")).id();
        commands.entity(line).add_child(label);
        for (id, title) in hidden {
            let b = section_button(commands, kind, defaults, id, SectionOp::Show);
            let t = commands
                .spawn(theme::text(
                    format!("[show {title}]"),
                    font::SMALL,
                    color::LINK,
                ))
                .id();
            commands.entity(b).add_child(t);
            commands.entity(line).add_child(b);
        }
        commands.entity(body).add_child(line);
    }
    out
}

fn section_button(
    commands: &mut Commands,
    kind: PageKind,
    defaults: &[SectionSpec],
    id: &'static str,
    op: SectionOp,
) -> Entity {
    let defaults = defaults.to_vec();
    commands
        .spawn((
            Node {
                padding: UiRect::horizontal(px(3.0)),
                ..default()
            },
            bevy::picking::hover::Hovered::default(),
        ))
        .observe(move |mut ev: On<PointerClick>, mut cfg: ResMut<UiConfig>| {
            ev.propagate(false);
            if ev.button == PointerButton::Primary {
                apply_section_op(&mut cfg, kind, &defaults, id, op);
            }
        })
        .id()
}

/// Registers the placeholder page of every kind, the list pages, the world page and the
/// settings page. Phase B plugins added after it replace kinds with real pages.
pub struct PagesPlugin;

impl Plugin for PagesPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<PageRegistry>()
            .init_resource::<PdoombergRoute>()
            .add_message::<OpenPdoomberg>();
        placeholder::register(app);
        // Lane B1's entity pages replace their placeholders (M9.2, M9.7).
        company::register(app);
        character::register(app);
        country::register(app);
        zone::register(app);
        exchange::register(app);
        doc::register(app);
        lists::register(app);
        world::register(app);
        settings::register(app);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_keys_round_trip() {
        let pages = [
            PageRef::World,
            PageRef::Company(CompanyId(12)),
            PageRef::Industry(IndustryId(3)),
            PageRef::Character(CharacterId(295)),
            PageRef::Country(CountryId(40)),
            PageRef::Zone(ZoneId(2)),
            PageRef::Exchange(ZoneId(25)),
            PageRef::Event(StartupEventId(0)),
            PageRef::Recap(Quarter { year: 2021, q: 4 }),
            PageRef::Headline {
                date: Date::ymd(2020, 3, 2),
                n: 7,
            },
            PageRef::Companies,
            PageRef::Industries,
            PageRef::News,
            PageRef::Characters,
            PageRef::Countries,
            PageRef::Exchanges,
            PageRef::Zones,
            PageRef::Events,
            PageRef::Settings,
        ];
        let kinds: std::collections::BTreeSet<_> = pages.iter().map(PageRef::kind).collect();
        assert_eq!(kinds.len(), PageKind::ALL.len(), "every kind covered");
        for p in pages {
            let k = p.key();
            assert_eq!(PageRef::from_key(&k), Some(p.clone()), "{k}");
        }
        assert_eq!(PageRef::Company(CompanyId(12)).key(), "company/12");
        assert_eq!(
            PageRef::Recap(Quarter { year: 2020, q: 1 }).key(),
            "recap/2020-Q1"
        );
        for bad in [
            "",
            "company",
            "company/x",
            "company/1/2",
            "recap/2020-Q5",
            "headline/2020-02-30/0",
            "nope/1",
        ] {
            assert_eq!(PageRef::from_key(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn sections_follow_the_config() {
        let defaults: &[SectionSpec] = &[("a", "A"), ("b", "B"), ("c", "C")];
        let ids = |cfg: &UiConfig| -> Vec<(&str, bool)> {
            arrange_sections(defaults, cfg.sections.get("company"))
                .into_iter()
                .map(|((id, _), c)| (id, c))
                .collect()
        };
        let mut cfg = UiConfig::default();
        assert_eq!(ids(&cfg), [("a", false), ("b", false), ("c", false)]);
        apply_section_op(&mut cfg, PageKind::Company, defaults, "c", SectionOp::Up);
        assert_eq!(ids(&cfg), [("a", false), ("c", false), ("b", false)]);
        apply_section_op(&mut cfg, PageKind::Company, defaults, "a", SectionOp::Up);
        assert_eq!(ids(&cfg)[0].0, "a", "the top stays the top");
        apply_section_op(&mut cfg, PageKind::Company, defaults, "b", SectionOp::Hide);
        apply_section_op(
            &mut cfg,
            PageKind::Company,
            defaults,
            "a",
            SectionOp::ToggleCollapse,
        );
        assert_eq!(ids(&cfg), [("a", true), ("c", false)]);
        apply_section_op(&mut cfg, PageKind::Company, defaults, "c", SectionOp::Down);
        assert_eq!(ids(&cfg), [("a", true), ("c", false)], "past a hidden one");
        apply_section_op(&mut cfg, PageKind::Company, defaults, "b", SectionOp::Show);
        apply_section_op(
            &mut cfg,
            PageKind::Company,
            defaults,
            "a",
            SectionOp::ToggleCollapse,
        );
        assert_eq!(ids(&cfg), [("a", false), ("b", false), ("c", false)]);
        // A config naming a section the page no longer has, and missing a new one.
        let mut cfg = UiConfig::default();
        cfg.sections.insert(
            "company".into(),
            SectionsConfig {
                order: vec!["gone".into(), "c".into()],
                ..default()
            },
        );
        assert_eq!(ids(&cfg), [("c", false), ("a", false), ("b", false)]);
    }

    #[test]
    fn pdoomberg_functions_parse() {
        assert_eq!(PdbFunction::parse("f3"), Some(PdbFunction::F3));
        assert_eq!(PdbFunction::parse("F10"), Some(PdbFunction::F10));
        assert_eq!(PdbFunction::parse("scrn"), Some(PdbFunction::F10));
        assert_eq!(PdbFunction::parse("F1"), None);
        assert_eq!(PdbFunction::parse("F8"), None);
    }
}
