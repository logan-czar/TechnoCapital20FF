//! The map modes (build-plan M8.5; spec 8 Map row; D700, D702): the mode bar on the map, the
//! current layer from `get_map_layer` (v_map_layers, and v_cycle and v_exchanges for the
//! Financial zones mode), the legend, and the Metro outline overlay.
//!
//! Modes come from the bar on the map (m8-plan 2: the function keys stay Pdoomberg's): its
//! first row picks Political, Development, Industry, Company HQs or Financial zones and toggles
//! the Metro outlines; its second row holds the mode's parameter (the development track, the
//! picked industry, the HQ filters). The layer is fetched again only when the mode changes or a
//! view it reads moves its version ([`sim::SimViews::map_layer_versions`]), so the colour table
//! is rewritten only then (`render::sync_colors`).

use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use sim::views::map_layers::{
    DevTrack, HqFilter, LayerScale, LayerStyle, MapLayer, MapMode, ScaleUnit,
};
use sim::world::{CountryId, IndustryId, Ordinal};

use super::colors;
use super::{MapInput, MapView};
use crate::bridge::Views;
use crate::table::format;
use crate::ui::UiSystems;
use crate::ui::theme::{self, ButtonLook, color, font, size};

/// The mode and every mode's remembered parameter, so going back to a mode keeps its track,
/// industry or filters.
#[derive(Resource, Debug, Clone, Copy, PartialEq, Default)]
pub struct MapModeState {
    pub mode: MapMode,
    pub dev: DevTrack,
    pub industry: Option<IndustryId>,
    pub hq: HqFilter,
    /// The Metro outlines over any mode (spec 8).
    pub metros: bool,
}

impl MapModeState {
    /// The mode of `kind` with its remembered parameter.
    pub fn mode_of(&self, kind: ModeKind) -> MapMode {
        match kind {
            ModeKind::Political => MapMode::Political,
            ModeKind::Development => MapMode::Development(self.dev),
            ModeKind::Industry => MapMode::Industry(self.industry),
            ModeKind::CompanyHqs => MapMode::CompanyHqs(self.hq),
            ModeKind::FinancialZones => MapMode::FinancialZones,
        }
    }

    /// Switches to `mode`, remembering its parameter.
    pub fn set(&mut self, mode: MapMode) {
        match mode {
            MapMode::Development(t) => self.dev = t,
            MapMode::Industry(i) => self.industry = i,
            MapMode::CompanyHqs(f) => self.hq = f,
            MapMode::Political | MapMode::FinancialZones => {}
        }
        self.mode = mode;
    }
}

/// A mode without its parameter: the first row of the bar.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModeKind {
    Political,
    Development,
    Industry,
    CompanyHqs,
    FinancialZones,
}

impl ModeKind {
    pub const ALL: [ModeKind; 5] = [
        ModeKind::Political,
        ModeKind::Development,
        ModeKind::Industry,
        ModeKind::CompanyHqs,
        ModeKind::FinancialZones,
    ];

    pub fn of(m: MapMode) -> ModeKind {
        match m {
            MapMode::Political => ModeKind::Political,
            MapMode::Development(_) => ModeKind::Development,
            MapMode::Industry(_) => ModeKind::Industry,
            MapMode::CompanyHqs(_) => ModeKind::CompanyHqs,
            MapMode::FinancialZones => ModeKind::FinancialZones,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            ModeKind::Political => "Political",
            ModeKind::Development => "Development",
            ModeKind::Industry => "Industry",
            ModeKind::CompanyHqs => "Company HQs",
            ModeKind::FinancialZones => "Financial zones",
        }
    }
}

/// Changes the map mode (the bar's buttons, tests and the bench write it).
#[derive(Message, Debug, Clone, Copy, PartialEq)]
pub enum MapModeInput {
    Set(MapMode),
    Metros(bool),
}

/// The layer the map shows: `get_map_layer` of the current mode, fetched again when the mode
/// or a view it reads moves. `generation` counts the fetches, so the colour table, the pins
/// and the legend follow it.
#[derive(Resource, Debug, Clone)]
pub struct CurrentLayer {
    pub layer: MapLayer,
    pub generation: u64,
    from: Option<(MapMode, [u64; 3])>,
}

impl Default for CurrentLayer {
    fn default() -> Self {
        CurrentLayer {
            layer: MapLayer {
                mode: MapMode::Political,
                values: sim::views::map_layers::LayerValues::Categories(Vec::new()),
                style: LayerStyle::Political,
                scale: None,
                hatched: Vec::new(),
                legend: Vec::new(),
                pins: Vec::new(),
                notes: Vec::new(),
            },
            generation: 0,
            from: None,
        }
    }
}

/// What a bar button does.
#[derive(Component, Debug, Clone, Copy, PartialEq)]
pub enum ModeButton {
    Kind(ModeKind),
    Track(DevTrack),
    /// Steps the Industry mode's picked industry (none is the Industry track).
    Industry(i32),
    /// Steps the HQ filters.
    HqIndustry(i32),
    HqCountry(i32),
    HqListed,
    Metros,
}

/// The bar on the map.
#[derive(Component, Debug)]
pub struct ModeBar;

/// The legend panel on the map.
#[derive(Component, Debug)]
pub struct Legend;

/// The bar's and the legend's distance from the map's edges, logical pixels.
pub const MAP_UI_INSET: f32 = 8.0;
/// The legend's bottom inset, above the minimized-window dock (D635).
pub const LEGEND_BOTTOM: f32 = 44.0;
/// The legend's width.
pub const LEGEND_W: f32 = 270.0;
/// The bar's and legend's place among the map node's children (over the pins and labels).
pub const MAP_UI_Z: i32 = 10;
/// Legend swatches in a scale.
pub const SCALE_STOPS: usize = 5;

pub struct MapModesPlugin;

impl Plugin for MapModesPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<MapModeState>()
            .init_resource::<CurrentLayer>()
            .add_message::<MapModeInput>()
            .add_systems(Startup, spawn_bar_and_legend.after(super::MapLoad))
            .add_systems(
                Update,
                (apply_mode_input, refresh_layer)
                    .chain()
                    .in_set(UiSystems::Input)
                    .after(super::MapInputSet),
            )
            .add_systems(
                Update,
                (rebuild_bar, rebuild_legend).in_set(UiSystems::Show),
            );
    }
}

fn apply_mode_input(mut input: MessageReader<MapModeInput>, mut state: ResMut<MapModeState>) {
    for m in input.read() {
        let mut next = *state;
        match *m {
            MapModeInput::Set(mode) => next.set(mode),
            MapModeInput::Metros(on) => next.metros = on,
        }
        if next != *state {
            *state = next;
        }
    }
}

/// Fetches the layer again when the mode or a view it reads moved.
pub fn refresh_layer(views: Res<Views>, state: Res<MapModeState>, mut cur: ResMut<CurrentLayer>) {
    let key = (state.mode, views.map_layer_versions(state.mode));
    if cur.from == Some(key) {
        return;
    }
    cur.layer = views.get_map_layer(state.mode);
    cur.from = Some(key);
    cur.generation += 1;
}

/// Stops a pointer event on the bar or legend from reaching the map node behind (no pan, no
/// pick, no hover under the bar).
fn shield(entity: &mut EntityCommands) {
    entity
        .observe(|mut ev: On<PointerClick>| ev.propagate(false))
        .observe(|mut ev: On<PointerPress>| ev.propagate(false))
        .observe(|mut ev: On<PointerDrag>| ev.propagate(false))
        .observe(|mut ev: On<PointerScroll>| ev.propagate(false))
        .observe(|mut ev: On<PointerMove>, mut w: MessageWriter<MapInput>| {
            ev.propagate(false);
            w.write(MapInput::Hover(None));
        });
}

fn spawn_bar_and_legend(mut commands: Commands, view: Query<Entity, With<MapView>>) {
    let Ok(view) = view.single() else { return };
    let mut bar = commands.spawn((
        ModeBar,
        Node {
            position_type: PositionType::Absolute,
            left: px(MAP_UI_INSET),
            top: px(MAP_UI_INSET),
            flex_direction: FlexDirection::Row,
            align_items: AlignItems::FlexStart,
            column_gap: px(6.0),
            ..default()
        },
        Hovered::default(),
        ZIndex(MAP_UI_Z),
    ));
    shield(&mut bar);
    let bar = bar.id();
    let mut legend = commands.spawn((
        Legend,
        Node {
            position_type: PositionType::Absolute,
            left: px(MAP_UI_INSET),
            bottom: px(LEGEND_BOTTOM),
            width: px(LEGEND_W),
            flex_direction: FlexDirection::Column,
            padding: UiRect::all(px(8.0)),
            row_gap: px(3.0),
            border: UiRect::all(px(1.0)),
            border_radius: BorderRadius::all(px(size::RADIUS)),
            ..default()
        },
        BackgroundColor(color::PANEL),
        BorderColor::all(color::BORDER),
        ZIndex(MAP_UI_Z),
    ));
    shield(&mut legend);
    let legend = legend.id();
    commands.entity(view).add_children(&[bar, legend]);
}

fn on_mode_button(
    ev: On<PointerClick>,
    buttons: Query<&ModeButton>,
    state: Res<MapModeState>,
    views: Res<Views>,
    mut w: MessageWriter<MapModeInput>,
) {
    let Ok(b) = buttons.get(ev.event_target()) else {
        return;
    };
    let s = *state;
    let industries = views.industry_rows.get().rows.len();
    let msg = match *b {
        ModeButton::Kind(k) => MapModeInput::Set(s.mode_of(k)),
        ModeButton::Track(t) => MapModeInput::Set(MapMode::Development(t)),
        ModeButton::Industry(d) => {
            MapModeInput::Set(MapMode::Industry(step_industry(s.industry, d, industries)))
        }
        ModeButton::HqIndustry(d) => MapModeInput::Set(MapMode::CompanyHqs(HqFilter {
            industry: step_industry(s.hq.industry, d, industries),
            ..s.hq
        })),
        ModeButton::HqCountry(d) => {
            let countries = hq_countries(&views);
            MapModeInput::Set(MapMode::CompanyHqs(HqFilter {
                country: step_in(s.hq.country, d, &countries),
                ..s.hq
            }))
        }
        ModeButton::HqListed => MapModeInput::Set(MapMode::CompanyHqs(HqFilter {
            listed: match s.hq.listed {
                None => Some(true),
                Some(true) => Some(false),
                Some(false) => None,
            },
            ..s.hq
        })),
        ModeButton::Metros => MapModeInput::Metros(!s.metros),
    };
    w.write(msg);
}

/// Steps an optional industry through none (all, or the track) and every industry.
pub fn step_industry(cur: Option<IndustryId>, d: i32, n: usize) -> Option<IndustryId> {
    let all: Vec<IndustryId> = (0..n).map(IndustryId::from_index).collect();
    step_in(cur, d, &all)
}

/// Steps through `None` then `options` in order, wrapping.
pub fn step_in<T: Copy + PartialEq>(cur: Option<T>, d: i32, options: &[T]) -> Option<T> {
    let n = options.len() as i32 + 1;
    let at = cur
        .and_then(|c| options.iter().position(|o| *o == c))
        .map_or(0, |i| i as i32 + 1);
    let next = (at + d).rem_euclid(n);
    (next > 0).then(|| options[next as usize - 1])
}

/// The countries with an HQ, in ordinal order (the HQ country filter's choices).
pub fn hq_countries(views: &Views) -> Vec<CountryId> {
    let mut c: Vec<CountryId> = views
        .map_layers
        .get()
        .hqs
        .iter()
        .map(|h| h.country)
        .collect();
    c.sort_unstable();
    c.dedup();
    c
}

/// A compact bar button in small text.
fn button(
    commands: &mut Commands,
    label: impl Into<String>,
    b: ModeButton,
    active: bool,
) -> Entity {
    let mut look = ButtonLook::new(color::CYAN);
    look.active = active;
    commands
        .spawn((
            Node {
                padding: UiRect::axes(px(6.0), px(2.0)),
                border: UiRect::all(px(1.0)),
                border_radius: BorderRadius::all(px(size::RADIUS)),
                justify_content: JustifyContent::FlexStart,
                align_items: AlignItems::Center,
                min_width: px(20.0),
                ..default()
            },
            BackgroundColor(color::PANEL_RAISED),
            BorderColor::all(color::BORDER),
            look,
            Hovered::default(),
            b,
            children![theme::text_line(label, font::SMALL, color::TEXT)],
        ))
        .observe(on_mode_button)
        .id()
}

fn column(commands: &mut Commands) -> Entity {
    commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            row_gap: px(3.0),
            ..default()
        })
        .id()
}

fn row(commands: &mut Commands) -> Entity {
    commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            column_gap: px(3.0),
            align_items: AlignItems::Center,
            ..default()
        })
        .id()
}

fn caption(commands: &mut Commands, s: impl Into<String>) -> Entity {
    commands
        .spawn((
            Node {
                padding: UiRect::axes(px(6.0), px(3.0)),
                ..default()
            },
            BackgroundColor(color::PANEL.with_alpha(0.92)),
            children![theme::text_line(s, font::SMALL, color::TEXT)],
        ))
        .id()
}

/// A cycler: "<", the current choice, ">".
fn cycler(
    commands: &mut Commands,
    parent: Entity,
    label: &str,
    value: String,
    prev: ModeButton,
    next: ModeButton,
) {
    let r = row(commands);
    let l = caption(commands, label.to_owned());
    let p = button(commands, "<", prev, false);
    let v = caption(commands, value);
    let n = button(commands, ">", next, false);
    commands.entity(r).add_children(&[l, p, v, n]);
    commands.entity(parent).add_child(r);
}

fn industry_name(views: &Views, i: IndustryId) -> String {
    views
        .industry_rows
        .get()
        .get(i)
        .map_or_else(|| format!("Industry #{}", i.0), |r| r.name.clone())
}

fn country_name(views: &Views, c: CountryId) -> String {
    views
        .places
        .get()
        .country(c)
        .map_or_else(|| format!("Country #{}", c.0), |p| p.name.clone())
}

/// Rebuilds the bar when the mode or its parameter changes.
fn rebuild_bar(
    mut commands: Commands,
    state: Res<MapModeState>,
    views: Res<Views>,
    bar: Query<(Entity, Option<&Children>), With<ModeBar>>,
    mut built: Local<Option<MapModeState>>,
) {
    let Ok((bar, kids)) = bar.single() else {
        return;
    };
    if *built == Some(*state) {
        return;
    }
    *built = Some(*state);
    if let Some(k) = kids {
        for &e in k {
            commands.entity(e).despawn();
        }
    }
    let kind = ModeKind::of(state.mode);
    let first = column(&mut commands);
    for k in ModeKind::ALL {
        let b = button(&mut commands, k.label(), ModeButton::Kind(k), k == kind);
        commands.entity(first).add_child(b);
    }
    let m = button(&mut commands, "Metros", ModeButton::Metros, state.metros);
    commands.entity(first).add_child(m);
    commands.entity(bar).add_child(first);
    let second = column(&mut commands);
    match state.mode {
        MapMode::Development(t) => {
            for track in DevTrack::ALL {
                let b = button(
                    &mut commands,
                    track.name(),
                    ModeButton::Track(track),
                    track == t,
                );
                commands.entity(second).add_child(b);
            }
        }
        MapMode::Industry(i) => {
            let v = i.map_or_else(|| "Industry track".to_owned(), |i| industry_name(&views, i));
            cycler(
                &mut commands,
                second,
                "Show",
                v,
                ModeButton::Industry(-1),
                ModeButton::Industry(1),
            );
        }
        MapMode::CompanyHqs(f) => {
            let ind = f
                .industry
                .map_or_else(|| "All".to_owned(), |i| industry_name(&views, i));
            cycler(
                &mut commands,
                second,
                "Industry",
                ind,
                ModeButton::HqIndustry(-1),
                ModeButton::HqIndustry(1),
            );
            let c = f
                .country
                .map_or_else(|| "All".to_owned(), |c| country_name(&views, c));
            cycler(
                &mut commands,
                second,
                "Country",
                c,
                ModeButton::HqCountry(-1),
                ModeButton::HqCountry(1),
            );
            let listed = match f.listed {
                None => "Listed and private",
                Some(true) => "Listed only",
                Some(false) => "Private only",
            };
            let b = button(
                &mut commands,
                listed,
                ModeButton::HqListed,
                f.listed.is_some(),
            );
            commands.entity(second).add_child(b);
        }
        MapMode::Political | MapMode::FinancialZones => {}
    }
    commands.entity(bar).add_child(second);
}

/// A scale's value as the legend writes it.
pub fn scale_value(unit: ScaleUnit, v: f64) -> String {
    match unit {
        ScaleUnit::Points => format!("{v:.0}"),
        ScaleUnit::Money => format::money(v),
        ScaleUnit::Rate => format!("{v:+.3}"),
    }
}

/// The legend's lines for `layer`: a title, then swatches and labels (what the leak test
/// reads, D705).
#[derive(Debug, Clone, PartialEq)]
pub struct LegendDoc {
    pub title: String,
    /// A swatch colour (if any) and its text.
    pub rows: Vec<(Option<[u8; 3]>, String)>,
}

/// The legend of a layer, from the layer alone (the views served it, D701).
pub fn legend_doc(layer: &MapLayer, metros: bool) -> LegendDoc {
    let mut rows = Vec::new();
    let mut title = layer.mode.name().to_owned();
    match layer.style {
        LayerStyle::Political => {
            title = format!("{title}: provinces by country");
            rows.push((
                None,
                format!(
                    "{} countries, a colour each",
                    format::int(layer.legend.len() as i64)
                ),
            ));
        }
        LayerStyle::Muted => {
            title = format!("{title}: pins sized by revenue TTM");
            for e in layer.legend.iter() {
                rows.push((Some(colors::sector_color(e.value)), e.label.clone()));
            }
            rows.push((
                None,
                format!("{} HQs shown", format::int(layer.pins.len() as i64)),
            ));
            rows.push((None, "Private: sized by the estimate".into()));
        }
        LayerStyle::Sequential | LayerStyle::Diverging => {
            if let Some(s) = &layer.scale {
                title = s.label.clone();
                rows.extend(scale_rows(layer.style, s, layer.mode));
            }
            for (k, v) in &layer.notes {
                rows.push((None, format!("{k}: {v}")));
            }
            if layer.mode == MapMode::FinancialZones {
                rows.push((
                    None,
                    format!("{} hubs: exchange and index level", layer.pins.len()),
                ));
            }
        }
    }
    // Every mode hatches the contested provinces and can show the Metro outlines (D702).
    rows.push((Some(colors::HATCH_SWATCH), "Contested (hatched)".into()));
    if metros {
        rows.push((Some(colors::METRO_SWATCH), "Metro outline".into()));
    }
    LegendDoc { title, rows }
}

fn scale_rows(style: LayerStyle, s: &LayerScale, mode: MapMode) -> Vec<(Option<[u8; 3]>, String)> {
    (0..SCALE_STOPS)
        .rev()
        .map(|i| {
            let t = i as f64 / (SCALE_STOPS - 1) as f64;
            let v = s.low + (s.high - s.low) * t;
            let c = colors::scalar_color(style, mode, colors::unit_of(s, v as f32));
            (Some(c), scale_value(s.unit, v))
        })
        .collect()
}

/// Rebuilds the legend when the layer changes.
fn rebuild_legend(
    mut commands: Commands,
    cur: Res<CurrentLayer>,
    state: Res<MapModeState>,
    legend: Query<(Entity, Option<&Children>), With<Legend>>,
    mut built: Local<Option<(u64, bool)>>,
) {
    let Ok((panel, kids)) = legend.single() else {
        return;
    };
    let key = (cur.generation, state.metros);
    if *built == Some(key) {
        return;
    }
    *built = Some(key);
    if let Some(k) = kids {
        for &e in k {
            commands.entity(e).despawn();
        }
    }
    let doc = legend_doc(&cur.layer, state.metros);
    let t = commands
        .spawn(theme::text(doc.title, font::SMALL, color::TEXT))
        .id();
    commands.entity(panel).add_child(t);
    for (swatch, text) in doc.rows {
        let r = row(&mut commands);
        // The row spans the panel and its text wraps inside it (review of PR #37).
        commands.entity(r).insert(Node {
            flex_direction: FlexDirection::Row,
            column_gap: px(3.0),
            align_items: AlignItems::Center,
            width: percent(100.0),
            ..default()
        });
        if let Some([r8, g8, b8]) = swatch {
            let s = commands
                .spawn((
                    Node {
                        width: px(12.0),
                        height: px(12.0),
                        border: UiRect::all(px(1.0)),
                        ..default()
                    },
                    BackgroundColor(Color::srgb_u8(r8, g8, b8)),
                    BorderColor::all(color::BORDER),
                ))
                .id();
            commands.entity(r).add_child(s);
        }
        let l = commands
            .spawn((
                theme::text(text, font::SMALL, color::TEXT_MUTED),
                Node {
                    flex_shrink: 1.0,
                    min_width: px(0.0),
                    ..default()
                },
            ))
            .id();
        commands.entity(r).add_child(l);
        commands.entity(panel).add_child(r);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn steps_wrap_through_none() {
        let opts = [3u32, 5, 9];
        assert_eq!(step_in(None, 1, &opts), Some(3));
        assert_eq!(step_in(Some(9), 1, &opts), None);
        assert_eq!(step_in(None, -1, &opts), Some(9));
        assert_eq!(step_in(Some(3), -1, &opts), None);
    }

    #[test]
    fn a_mode_keeps_its_parameter() {
        let mut s = MapModeState::default();
        s.set(MapMode::Development(DevTrack::Commerce));
        s.set(MapMode::Political);
        assert_eq!(
            s.mode_of(ModeKind::Development),
            MapMode::Development(DevTrack::Commerce)
        );
    }
}
