//! Full-screen Pdoomberg (build-plan M7.8, M9.4; spec 8; 20-ui 20.5.2): the one screen that is
//! not a workspace page. M7 built it as a stub with a company table demo from the starting data
//! ([`super::demo`]) whose rows add to or drop from the watchlist; M9 A2 adds the route the
//! command bar sets (`ARDR F3`), shown as a stub line until lane B2 draws the F-key pages.
//!
//! Every other screen is a page in the tiling workspace ([`crate::pages`],
//! [`crate::workspace`]).

use std::sync::Arc;

use bevy::prelude::*;
use sim::Control;
use sim::world::CompanyId;

pub use crate::pages::placeholder::ViewLine;
pub use crate::pages::{ViewKey, view_meta};

use super::rail::{Screen, ScreenRoot};
use super::theme::{self, color, font, size};
use super::{DemoTables, ShellLayout, SpawnLayout, UiSystems};
use crate::bridge::{RunnerControls, SimControl};
use crate::command::index::NameIndex;
use crate::pages::{PdbFunction, PdoombergRoute};
use crate::table::{Table, TableRowClicked, spawn_table};

/// The demo tables' entities: the World page's province table (the latest one built) and
/// Pdoomberg's company table.
#[derive(Resource, Debug, Clone, Copy)]
pub struct DemoTableEntities {
    pub provinces: Entity,
    pub companies: Entity,
}

/// Pdoomberg's route line.
#[derive(Component)]
pub struct PdoombergRouteLine;

pub struct ScreensPlugin;

impl Plugin for ScreensPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, spawn_pdoomberg.after(SpawnLayout))
            .add_systems(
                Update,
                (
                    toggle_watch,
                    omniscient_quotes.run_if(resource_changed::<RunnerControls>),
                    show_route.run_if(
                        resource_changed::<PdoombergRoute>.or_eager(resource_changed::<NameIndex>),
                    ),
                )
                    .in_set(UiSystems::Show),
            );
    }
}

/// The function keys row (spec 8 Pdoomberg; F4 shows the lock).
const KEYS: [PdbFunction; 8] = PdbFunction::ALL;

fn spawn_pdoomberg(mut commands: Commands, layout: Res<ShellLayout>, demo: Res<DemoTables>) {
    // Pdoomberg: the full-screen terminal (20.5.2), the one exception to the look.
    let term = commands
        .spawn((
            ScreenRoot(Screen::Pdoomberg),
            Node {
                position_type: PositionType::Absolute,
                left: px(0.0),
                right: px(0.0),
                top: px(0.0),
                bottom: px(0.0),
                flex_direction: FlexDirection::Column,
                padding: UiRect::all(px(size::PAD)),
                row_gap: px(size::GAP),
                display: Display::None,
                ..default()
            },
            BackgroundColor(color::TERMINAL_BG),
            GlobalZIndex(20),
        ))
        .id();
    commands.entity(layout.main).add_child(term);
    let head = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            align_items: AlignItems::Center,
            column_gap: px(14.0),
            ..default()
        })
        .id();
    let name = commands
        .spawn(theme::text("PDOOMBERG", font::HERO, color::TERMINAL_TEXT))
        .id();
    let badge = commands
        .spawn(theme::text(
            "Accurate: published data",
            font::SMALL,
            color::GREEN,
        ))
        .id();
    commands.entity(head).add_children(&[name, badge]);
    commands.entity(term).add_child(head);
    let keys_row = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            align_items: AlignItems::Center,
            column_gap: px(12.0),
            ..default()
        })
        .id();
    for (i, f) in KEYS.into_iter().enumerate() {
        let c = if i == 0 {
            color::TERMINAL_TEXT
        } else {
            color::TEXT_MUTED
        };
        let e = commands
            .spawn(theme::text(
                format!("{} {}", f.code(), f.name()),
                font::BODY,
                c,
            ))
            .id();
        commands.entity(keys_row).add_child(e);
        if f == PdbFunction::F4 {
            let lock = commands.spawn(theme::read_only_lock()).id();
            commands.entity(keys_row).add_child(lock);
        }
    }
    commands.entity(term).add_child(keys_row);
    let route = commands
        .spawn((
            PdoombergRouteLine,
            theme::text("", font::BODY, color::TERMINAL_TEXT),
        ))
        .id();
    commands.entity(term).add_child(route);
    let note = commands
        .spawn(theme::text(
            "F2 Quotes (demo: starting data until lane B2's pages). Click a row to watch or \
             unwatch it. Esc returns to the workspace; Ctrl+K opens the command bar \
             (TICKER F3).",
            font::SMALL,
            color::TERMINAL_TEXT,
        ))
        .id();
    commands.entity(term).add_child(note);
    for k in [
        ViewKey::Quotes,
        ViewKey::PriceBars,
        ViewKey::Filings,
        ViewKey::Ratings,
    ] {
        let e = commands
            .spawn((ViewLine(k), theme::text("", font::SMALL, color::TEXT_MUTED)))
            .id();
        commands.entity(term).add_child(e);
    }
    let companies = spawn_table(&mut commands, term, Arc::clone(&demo.companies));
    commands.insert_resource(DemoTableEntities {
        provinces: Entity::PLACEHOLDER,
        companies,
    });
}

/// The route line: the function page and company the command bar asked for. A stub until lane
/// B2 draws each F-key page.
fn show_route(
    route: Res<PdoombergRoute>,
    index: Res<NameIndex>,
    mut q: Query<&mut Text, With<PdoombergRouteLine>>,
) {
    let who = route.company.map_or("no company".to_owned(), |c| {
        let p = crate::pages::PageRef::Company(c);
        let ticker = index.entry(&p).and_then(|e| e.alias.clone());
        format!(
            "{} ({})",
            index.title(&p),
            ticker.unwrap_or_else(|| "-".into())
        )
    });
    let s = format!(
        "> {} {}: {who}. The {} page is lane B2's (M9.4).",
        route.function.code(),
        route.function.name(),
        route.function.code()
    );
    for mut t in &mut q {
        if t.0 != s {
            t.0.clone_from(&s);
        }
    }
}

/// A click on a Pdoomberg quote row watches or unwatches that company (design fix 8).
fn toggle_watch(
    mut clicks: MessageReader<TableRowClicked>,
    tables: Option<Res<DemoTableEntities>>,
    controls: Res<RunnerControls>,
    mut w: MessageWriter<SimControl>,
) {
    let Some(t) = tables else {
        clicks.clear();
        return;
    };
    for c in clicks.read() {
        if c.table != t.companies {
            continue;
        }
        let id = CompanyId(c.row as u32);
        let control = if controls.watchlist.contains(&id) {
            Control::WatchlistRemove(id)
        } else {
            Control::WatchlistAdd(id)
        };
        w.write(SimControl(control));
    }
}

/// Pdoomberg shows published data; while Omniscient is on (debug builds) it shows the true values
/// of private companies too (spec 1, Information).
fn omniscient_quotes(
    controls: Res<RunnerControls>,
    demo: Res<DemoTables>,
    tables: Option<Res<DemoTableEntities>>,
    mut shown: Local<bool>,
    mut q: Query<&mut Table>,
) {
    if controls.omniscient == *shown {
        return;
    }
    *shown = controls.omniscient;
    if let Some(mut t) = tables.and_then(|t| q.get_mut(t.companies).ok()) {
        t.set_model(Arc::clone(demo.companies_for(*shown)));
    }
}
