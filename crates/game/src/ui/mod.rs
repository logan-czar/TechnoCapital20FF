//! The UI shell (build-plan M7.4 to M7.8; spec 8 main screen; 20-ui 20.2): the top bar with the
//! alert row, the left rail, the main area (the map's place, with panel slot 1 over it and the
//! full-screen Pdoomberg terminal), the outliner, toasts, and the screen router.
//!
//! Every screen reads [`Views`](crate::bridge::Views) (and the runner controls mirror) and sends
//! [`SimControl`](crate::bridge::SimControl) messages; none can reach the sim (spec 9).

pub mod alerts;
pub mod outliner;
pub mod rail;
pub mod screens;
pub mod theme;
pub mod top_bar;

use std::sync::Arc;

use bevy::prelude::*;

use crate::bridge::SimSystems;
use crate::table::{TableModel, TablePlugin, TableSystems};
use theme::{color, size};

/// The shell's areas, spawned once at startup; each module fills its own.
#[derive(Resource, Debug, Clone, Copy)]
pub struct ShellLayout {
    pub root: Entity,
    pub top_bar: Entity,
    pub rail: Entity,
    /// The map's place: the home screen fills it, panels and Pdoomberg cover it.
    pub main: Entity,
    pub outliner: Entity,
    /// Toasts stack upward at the bottom right of the main area (20.2.1).
    pub toasts: Entity,
}

/// Demo rows from the starting data for the table widget, until the real views land (M2, M9):
/// the 3,255 provinces and the 651 companies.
#[derive(Resource, Clone)]
pub struct DemoTables {
    pub provinces: Arc<TableModel>,
    pub companies: Arc<TableModel>,
    /// Company names by ordinal (ascending CSV id, D4), for the watchlist and alert payloads.
    pub company_names: Vec<String>,
}

impl Default for DemoTables {
    fn default() -> Self {
        DemoTables {
            provinces: Arc::new(TableModel::new(Vec::new(), Vec::new())),
            companies: Arc::new(TableModel::new(Vec::new(), Vec::new())),
            company_names: Vec::new(),
        }
    }
}

impl DemoTables {
    /// A company's display name, or its ordinal when the name is not known.
    pub fn company_name(&self, id: sim::world::CompanyId) -> String {
        self.company_names
            .get(id.0 as usize)
            .cloned()
            .unwrap_or_else(|| format!("Company #{}", id.0))
    }
}

/// The drop-down menu open over the top bar, if any; Esc closes it before any screen.
#[derive(Resource, Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct OpenMenu(pub Option<Menu>);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Menu {
    Skip,
    AlertSettings,
}

impl OpenMenu {
    /// Opens `m`, or closes it if it is open.
    pub fn toggle(&mut self, m: Menu) {
        self.0 = if self.0 == Some(m) { None } else { Some(m) };
    }
}

/// System sets of the shell, all in `Update` after the views are synced.
#[derive(SystemSet, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UiSystems {
    /// Keyboard and routing.
    Input,
    /// Reading views and notices into the widgets.
    Show,
}

/// Startup set: the layout first, then each module's content.
#[derive(SystemSet, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SpawnLayout;

/// The whole UI shell. Needs [`crate::bridge::SimBridgePlugin`].
pub struct ShellPlugin;

impl Plugin for ShellPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<DemoTables>()
            .add_plugins((theme::ThemePlugin, TablePlugin))
            .configure_sets(
                Update,
                (UiSystems::Input, UiSystems::Show, TableSystems)
                    .chain()
                    .after(SimSystems::SyncViews),
            )
            .add_systems(Startup, spawn_layout.in_set(SpawnLayout))
            .add_plugins((
                rail::RouterPlugin,
                top_bar::TopBarPlugin,
                alerts::AlertsPlugin,
                outliner::OutlinerPlugin,
                screens::ScreensPlugin,
            ));
    }
}

fn spawn_layout(mut commands: Commands) {
    let top_bar = commands
        .spawn((
            Node {
                height: px(size::TOP_BAR),
                min_height: px(size::TOP_BAR),
                flex_direction: FlexDirection::Row,
                align_items: AlignItems::Center,
                column_gap: px(size::GAP),
                padding: UiRect::horizontal(px(size::PAD)),
                border: UiRect::bottom(px(1.0)),
                ..default()
            },
            BackgroundColor(color::PANEL),
            BorderColor::all(color::BORDER),
        ))
        .id();
    let rail = commands
        .spawn((
            Node {
                width: px(size::RAIL),
                min_width: px(size::RAIL),
                flex_direction: FlexDirection::Column,
                align_items: AlignItems::Stretch,
                row_gap: px(size::GAP),
                padding: UiRect::all(px(size::GAP)),
                border: UiRect::right(px(1.0)),
                ..default()
            },
            BackgroundColor(color::PANEL),
            BorderColor::all(color::BORDER),
        ))
        .id();
    let toasts = commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                right: px(size::PAD),
                bottom: px(size::PAD),
                flex_direction: FlexDirection::ColumnReverse,
                row_gap: px(size::GAP),
                width: px(320.0),
                ..default()
            },
            GlobalZIndex(50),
            Pickable::IGNORE,
        ))
        .id();
    let main = commands
        .spawn((
            Node {
                flex_grow: 1.0,
                min_width: px(0.0),
                min_height: px(0.0),
                flex_direction: FlexDirection::Column,
                ..default()
            },
            BackgroundColor(color::BG),
        ))
        .add_child(toasts)
        .id();
    let outliner = commands
        .spawn((
            Node {
                width: percent(size::OUTLINER_PCT),
                min_width: px(size::OUTLINER_MIN),
                flex_direction: FlexDirection::Column,
                row_gap: px(size::GAP),
                padding: UiRect::all(px(size::PAD)),
                border: UiRect::left(px(1.0)),
                overflow: Overflow::clip(),
                ..default()
            },
            BackgroundColor(color::PANEL),
            BorderColor::all(color::BORDER),
        ))
        .id();
    let middle = commands
        .spawn(Node {
            flex_grow: 1.0,
            min_height: px(0.0),
            flex_direction: FlexDirection::Row,
            ..default()
        })
        .add_children(&[rail, main, outliner])
        .id();
    let root = commands
        .spawn((
            Node {
                width: percent(100.0),
                height: percent(100.0),
                flex_direction: FlexDirection::Column,
                ..default()
            },
            BackgroundColor(color::BG),
        ))
        .add_children(&[top_bar, middle])
        .id();
    commands.insert_resource(ShellLayout {
        root,
        top_bar,
        rail,
        main,
        outliner,
        toasts,
    });
}
