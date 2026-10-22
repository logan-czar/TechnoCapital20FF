//! Lane B2's market and world pages (M9.3, M9.5, M9.6, M9.7): Industries and an industry,
//! the News feed and a headline, the Quarterly recap, and startup events. Each page is in its
//! own file; this one registers them (after [`super::PagesPlugin`], so they replace the
//! placeholders) and holds the small layout helpers they share.

use bevy::prelude::*;

use super::live::LivePlugin;
use crate::table::format;
use crate::ui::theme::{self, color, font, size};

/// A labelled figure for a page's fact row: "Demand $1.20T".
pub fn fact(commands: &mut Commands, parent: Entity, label: &str, value: String, c: Color) {
    let l = commands
        .spawn(theme::text_line(
            label.to_owned(),
            font::SMALL,
            color::TEXT_MUTED,
        ))
        .id();
    let v = commands.spawn(theme::text_line(value, font::BODY, c)).id();
    let chip = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            column_gap: px(4.0),
            align_items: AlignItems::Baseline,
            ..default()
        })
        .add_children(&[l, v])
        .id();
    commands.entity(parent).add_child(chip);
}

/// The color a figure's text takes: amber for a band (D461), else `exact`.
pub fn figure_color(f: sim::views::estimate::Figure, exact: Color) -> Color {
    if f.is_band() {
        format::BAND_TEXT
    } else {
        exact
    }
}

/// Most table rows a section box shows before the table scrolls.
pub const BOX_ROWS_MAX: usize = 14;

/// A box of fixed height for a table inside a page section (a section does not grow, so a table
/// there needs a height): room for `rows` rows (at most [`BOX_ROWS_MAX`]), the header and the
/// footer, at the normal row height.
pub fn table_box(commands: &mut Commands, parent: Entity, rows: usize) -> Entity {
    let e = commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            height: px(box_height(rows)),
            min_height: px(box_height(1)),
            flex_shrink: 0.0,
            ..default()
        })
        .id();
    commands.entity(parent).add_child(e);
    e
}

/// The height of a [`table_box`] for `rows` rows.
pub fn box_height(rows: usize) -> f32 {
    (rows.clamp(1, BOX_ROWS_MAX) as f32 + 2.4) * size::ROW
}

/// A [`table_box`] whose height follows the row count of the live table inside it (D572), so
/// a table whose rows come and go after the page is built (the recap's watchlist companies)
/// grows and shrinks with them, up to [`BOX_ROWS_MAX`], rather than scrolling in a box sized
/// at build time.
#[derive(Component, Debug, Clone, Copy)]
pub struct FitsTable;

/// A [`table_box`] that follows its table's rows ([`FitsTable`]).
pub fn fitted_table_box(commands: &mut Commands, parent: Entity, rows: usize) -> Entity {
    let e = table_box(commands, parent, rows);
    commands.entity(e).insert(FitsTable);
    e
}

/// Sets each [`FitsTable`] box's height from the rows of the table inside it.
fn fit_boxes(
    mut boxes: Query<(&mut Node, &Children), With<FitsTable>>,
    tables: Query<&crate::table::Table>,
) {
    for (mut node, children) in &mut boxes {
        let Some(t) = children.iter().find_map(|c| tables.get(c).ok()) else {
            continue;
        };
        let h = px(box_height(t.model().len()));
        if node.height != h {
            node.height = h;
        }
    }
}

/// A plain note line.
pub fn note(commands: &mut Commands, parent: Entity, s: impl Into<String>) -> Entity {
    let e = commands.spawn(theme::muted(s)).id();
    commands.entity(parent).add_child(e);
    e
}

pub struct MarketPagesPlugin;

impl Plugin for MarketPagesPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(LivePlugin)
            .add_systems(Update, fit_boxes.in_set(crate::ui::UiSystems::Show));
        super::industries::register(app);
        super::news::register(app);
        super::recap::register(app);
        super::events::register(app);
    }
}
