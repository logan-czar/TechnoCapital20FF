//! M0.8 `bevy_ui` spike: a virtualized table of the 3,969 provinces (build-plan M0.8, risk R1).
//!
//! Only the visible rows exist as entities: a fixed pool of row nodes whose text is rewritten when
//! the view scrolls or the sort changes, so the entity count does not grow with the data. The
//! mouse wheel (or Up, Down, PageUp, PageDown, Home, End) scrolls; clicking a column header sorts by
//! it, and clicking it again reverses the order. The status line shows the last sort time and the
//! frame time.
//!
//! Run on a machine with a display: `cargo run -p game --example table_spike --release`

use std::time::Instant;

use bevy::input::mouse::{MouseScrollUnit, MouseWheel};
use bevy::prelude::*;
use sim_data::{default_data_dir, load_world};

const ROW_HEIGHT: f32 = 22.0;
const VISIBLE_ROWS: usize = 26;
const FONT_SIZE: f32 = 14.0;
/// Column title and width in pixels.
const COLUMNS: [(&str, f32); 6] = [
    ("Id", 90.0),
    ("Name", 280.0),
    ("Country", 80.0),
    ("Commerce", 90.0),
    ("Industry", 90.0),
    ("Population", 100.0),
];
const HEADER_BG: Color = Color::srgb(0.15, 0.17, 0.22);
const ROW_BG: [Color; 2] = [Color::srgb(0.08, 0.09, 0.11), Color::srgb(0.11, 0.12, 0.15)];

/// One table row: display text per column and a sort key per numeric column.
struct Row {
    cells: [String; 6],
    numbers: [u32; 3],
}

impl Row {
    fn cmp_by(&self, other: &Self, col: usize) -> std::cmp::Ordering {
        match col {
            0..=2 => self.cells[col].cmp(&other.cells[col]),
            _ => self.numbers[col - 3].cmp(&other.numbers[col - 3]),
        }
    }
}

#[derive(Resource)]
struct Table {
    rows: Vec<Row>,
    /// Row indices in display order.
    order: Vec<usize>,
    /// First visible position in `order`.
    top: usize,
    sort_col: usize,
    ascending: bool,
    last_sort_ms: f64,
}

impl Table {
    fn max_top(&self) -> usize {
        self.rows.len().saturating_sub(VISIBLE_ROWS)
    }

    fn scroll(&mut self, rows: isize) {
        self.top = self.top.saturating_add_signed(rows).min(self.max_top());
    }

    fn sort_by(&mut self, col: usize) {
        self.ascending = if col == self.sort_col {
            !self.ascending
        } else {
            true
        };
        self.sort_col = col;
        let start = Instant::now();
        let rows = &self.rows;
        // Stable sort, so equal keys keep the previous order.
        self.order.sort_by(|&a, &b| {
            let o = rows[a].cmp_by(&rows[b], col);
            if self.ascending { o } else { o.reverse() }
        });
        self.last_sort_ms = start.elapsed().as_secs_f64() * 1e3;
        self.top = 0;
    }
}

/// A text cell of the row pool: which visible slot and which column.
#[derive(Component)]
struct Cell {
    slot: usize,
    col: usize,
}

#[derive(Component)]
struct Status;

fn main() {
    let world = load_world(&default_data_dir()).unwrap_or_else(|e| panic!("{e}"));
    let rows: Vec<Row> = world
        .all_provinces()
        .map(|(_, _, p)| Row {
            cells: [
                p.id.clone(),
                p.name.clone(),
                p.country.clone(),
                p.commerce.to_string(),
                p.industry.to_string(),
                p.population.to_string(),
            ],
            numbers: [p.commerce, p.industry, p.population],
        })
        .collect();
    let order = (0..rows.len()).collect();
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Table spike (M0.8)".into(),
                ..default()
            }),
            ..default()
        }))
        .insert_resource(Table {
            rows,
            order,
            top: 0,
            sort_col: 0,
            ascending: true,
            last_sort_ms: 0.0,
        })
        .add_systems(Startup, setup)
        .add_systems(Update, (scroll, refresh_cells, refresh_status).chain())
        .run();
}

fn text(s: impl Into<String>, width: f32) -> impl Bundle {
    (
        Text::new(s),
        TextFont::from_font_size(FONT_SIZE),
        TextColor(Color::srgb(0.85, 0.88, 0.92)),
        Node {
            width: Val::Px(width),
            overflow: Overflow::clip(),
            ..default()
        },
    )
}

fn row_node(bg: Color) -> impl Bundle {
    (
        Node {
            height: Val::Px(ROW_HEIGHT),
            flex_direction: FlexDirection::Row,
            align_items: AlignItems::Center,
            column_gap: Val::Px(8.0),
            padding: UiRect::horizontal(Val::Px(6.0)),
            ..default()
        },
        BackgroundColor(bg),
    )
}

fn setup(mut commands: Commands) {
    commands.spawn(Camera2d);
    commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            padding: UiRect::all(Val::Px(12.0)),
            row_gap: Val::Px(4.0),
            ..default()
        })
        .with_children(|root| {
            root.spawn((Status, text("", 1200.0)));
            root.spawn(row_node(HEADER_BG)).with_children(|header| {
                for (col, (title, width)) in COLUMNS.into_iter().enumerate() {
                    header.spawn(text(title, width)).observe(
                        move |_: On<PointerClick>, mut table: ResMut<Table>| table.sort_by(col),
                    );
                }
            });
            // The pool: VISIBLE_ROWS row nodes, reused for whatever rows are in view.
            root.spawn(Node {
                flex_direction: FlexDirection::Column,
                height: Val::Px(ROW_HEIGHT * VISIBLE_ROWS as f32),
                overflow: Overflow::clip(),
                ..default()
            })
            .with_children(|body| {
                for slot in 0..VISIBLE_ROWS {
                    body.spawn(row_node(ROW_BG[slot % 2])).with_children(|row| {
                        for (col, (_, width)) in COLUMNS.into_iter().enumerate() {
                            row.spawn((Cell { slot, col }, text("", width)));
                        }
                    });
                }
            });
        });
}

fn scroll(
    mut wheel: MessageReader<MouseWheel>,
    keys: Res<ButtonInput<KeyCode>>,
    mut table: ResMut<Table>,
) {
    let mut rows = 0.0;
    for ev in wheel.read() {
        rows -= match ev.unit {
            MouseScrollUnit::Line => ev.y * 3.0,
            MouseScrollUnit::Pixel => ev.y / ROW_HEIGHT,
        };
    }
    let page = VISIBLE_ROWS as f32;
    for (key, step) in [
        (KeyCode::ArrowDown, 1.0),
        (KeyCode::ArrowUp, -1.0),
        (KeyCode::PageDown, page),
        (KeyCode::PageUp, -page),
    ] {
        if keys.just_pressed(key) {
            rows += step;
        }
    }
    if keys.just_pressed(KeyCode::Home) {
        table.top = 0;
    } else if keys.just_pressed(KeyCode::End) {
        table.top = table.max_top();
    } else if rows != 0.0 {
        table.scroll(rows.round() as isize);
    }
}

/// Rewrites the pooled cells only when the view or the sort changed.
fn refresh_cells(table: Res<Table>, mut cells: Query<(&Cell, &mut Text)>) {
    if !table.is_changed() {
        return;
    }
    for (cell, mut text) in &mut cells {
        let value = table
            .order
            .get(table.top + cell.slot)
            .map_or("", |&i| table.rows[i].cells[cell.col].as_str());
        if text.0 != value {
            value.clone_into(&mut text.0);
        }
    }
}

fn refresh_status(
    table: Res<Table>,
    time: Res<Time>,
    mut status: Single<&mut Text, (With<Status>, Without<Cell>)>,
) {
    let end = (table.top + VISIBLE_ROWS).min(table.rows.len());
    status.0 = format!(
        "rows {}-{} of {} | sort {} {} ({:.2} ms) | frame {:.1} ms | wheel, arrows, PgUp/PgDn, Home/End; click a header to sort",
        table.top + 1,
        end,
        table.rows.len(),
        COLUMNS[table.sort_col].0,
        if table.ascending { "asc" } else { "desc" },
        table.last_sort_ms,
        time.delta_secs() * 1e3,
    );
}
