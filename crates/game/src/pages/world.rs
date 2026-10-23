//! The World page: the map's place (M8) and the workspace's home. Until the map lands it links
//! to every list page and holds the province table, read from v_places (D426) like every other
//! page (M9 plan 3: the starting-data demo is gone, D570).

use std::sync::Arc;

use bevy::prelude::*;
use sim::SimViews;

use super::placeholder::{chip_row, link_group, page_header};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, ViewKey};
use crate::bridge::Views;
use crate::command::index::NameIndex;
use crate::table::{Cell, Column, TableModel, spawn_table_with_id};
use crate::ui::theme;

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::World,
        PageSpec::new(&[
            ViewKey::MapStatic,
            ViewKey::MapLayers,
            ViewKey::ProvinceCards,
            ViewKey::Places,
        ]),
        world_page,
    );
}

/// The province table (D570): every province of v_places in id order, its CSV id, name and
/// country (a link to the country's page; provinces get pages in M8).
pub fn province_model(v: &SimViews) -> TableModel {
    let places = v.places.get();
    let rows = places
        .provinces
        .iter()
        .map(|p| {
            let country = match places.country(p.country) {
                Some(c) => Cell::Link(PageRef::Country(p.country), c.name.clone()),
                None => Cell::Unknown,
            };
            let iso3 = places
                .country(p.country)
                .map_or(Cell::Unknown, |c| Cell::Text(c.iso3.clone()));
            vec![
                Cell::Text(p.key.clone()),
                Cell::Link(PageRef::Province(p.id), p.name.clone()),
                iso3,
                country,
            ]
        })
        .collect();
    TableModel::new(
        vec![
            Column::text("Id", 90.0),
            Column::text("Name", 240.0),
            Column::text("ISO3", 60.0),
            Column::text("Country", 200.0),
        ],
        rows,
    )
}

fn world_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
) {
    page_header(
        &mut commands,
        b.head,
        "World",
        "Home",
        "Every province of the world: the map shows them behind the windows",
    );
    let pages = [
        PageRef::Companies,
        PageRef::Industries,
        PageRef::Exchanges,
        PageRef::Zones,
        PageRef::Countries,
        PageRef::Characters,
        PageRef::Events,
        PageRef::News,
        PageRef::Recap(views.clock().date.quarter()),
        PageRef::Settings,
    ];
    let links: Vec<(String, PageRef)> = pages.into_iter().map(|p| (index.title(&p), p)).collect();
    link_group(&mut commands, b.head, "Pages", &links);
    let row = chip_row(&mut commands, b.head);
    let hint = commands
        .spawn(theme::muted(
            "Ctrl+K or ` searches every name. Shift+click a link opens it in a new pane.",
        ))
        .id();
    commands.entity(row).add_child(hint);
    spawn_table_with_id(
        &mut commands,
        b.tail,
        Arc::new(province_model(&views)),
        "provinces",
    );
}
