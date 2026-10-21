//! The World page: the map's place (M8) and the workspace's home. Until the map lands it links
//! to every list page and holds the province table demo from the starting data ([`DemoTables`],
//! D307).

use std::sync::Arc;

use bevy::prelude::*;

use super::placeholder::{chip_row, link_group, page_header};
use super::{PageAppExt, PageBuild, PageKind, PageRef, PageSpec, ViewKey};
use crate::bridge::Views;
use crate::command::index::NameIndex;
use crate::table::spawn_table_with_id;
use crate::ui::DemoTables;
use crate::ui::screens::DemoTableEntities;
use crate::ui::theme;

pub fn register(app: &mut App) {
    app.register_page(
        PageKind::World,
        PageSpec::new(&[
            ViewKey::MapStatic,
            ViewKey::MapLayers,
            ViewKey::ProvinceCards,
        ]),
        world_page,
    );
}

fn world_page(
    In(b): In<PageBuild>,
    mut commands: Commands,
    views: Res<Views>,
    index: Res<NameIndex>,
    demo: Res<DemoTables>,
    entities: Option<ResMut<DemoTableEntities>>,
) {
    page_header(
        &mut commands,
        b.head,
        "World",
        "Home",
        "The map lands in M8; until then the provinces of the starting data",
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
    let t = spawn_table_with_id(
        &mut commands,
        b.tail,
        Arc::clone(&demo.provinces),
        "provinces",
    );
    if let Some(mut e) = entities {
        e.provinces = t;
    }
}
