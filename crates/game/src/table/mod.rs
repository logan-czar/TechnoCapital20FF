//! Table widget v1 (build-plan M7.7; risk R1; the M0.8 spike's open checks, D14).
//!
//! - **Virtualized:** only a pool of row entities exists, sized to the body's height
//!   ([`pool_size`]); scrolling or sorting rewrites their text, and only cells whose text changed
//!   are written.
//! - **Sortable columns** with a fixed header: click a header to sort, again to reverse. Ties go
//!   to the lower row (D2, D301), "?" cells sort last in both directions.
//! - **Formats:** money, percent, counts and "?" ([`format::Cell`]).
//! - **Scrolling:** the mouse wheel over the table, and Up, Down, PageUp, PageDown, Home and End
//!   for the focused table ([`TableFocus`]).
//! - Each sort is logged with its time (D14); the `--bench-table` run prints frame times.

pub mod format;

use std::sync::Arc;
use std::time::{Duration, Instant};

use bevy::input::mouse::MouseScrollUnit;
use bevy::picking::hover::Hovered;
use bevy::prelude::*;

pub use format::Cell;

use crate::ui::theme::{self, Tooltip, color, font, size};

/// Rows per wheel line (the M0.8 spike saw one notch arrive as two line events on X11, so one
/// line is two rows here, D307; Logan checks the feel by hand, D14).
pub const ROWS_PER_WHEEL_LINE: f32 = 2.0;
/// Most pooled rows a table keeps, whatever the window height (a 4K-tall window at 22 px is
/// about 100 rows; D307).
pub const MAX_POOL: usize = 160;

/// A column: title, width in logical pixels and whether it holds numbers (right-aligned).
#[derive(Debug, Clone, PartialEq)]
pub struct Column {
    pub title: String,
    pub width: f32,
    pub numeric: bool,
    /// Hover hint for the header.
    pub hint: Option<String>,
}

impl Column {
    pub fn text(title: &str, width: f32) -> Column {
        Column {
            title: title.to_owned(),
            width,
            numeric: false,
            hint: None,
        }
    }

    pub fn number(title: &str, width: f32) -> Column {
        Column {
            numeric: true,
            ..Column::text(title, width)
        }
    }

    pub fn with_hint(mut self, hint: &str) -> Column {
        self.hint = Some(hint.to_owned());
        self
    }
}

/// A table's data: columns, cells, and every cell's display string, formatted once.
#[derive(Debug, Clone, PartialEq)]
pub struct TableModel {
    pub columns: Vec<Column>,
    rows: Vec<Vec<Cell>>,
    display: Vec<Vec<String>>,
}

impl TableModel {
    pub fn new(columns: Vec<Column>, rows: Vec<Vec<Cell>>) -> TableModel {
        let display = rows
            .iter()
            .map(|r| r.iter().map(Cell::display).collect())
            .collect();
        TableModel {
            columns,
            rows,
            display,
        }
    }

    pub fn len(&self) -> usize {
        self.rows.len()
    }

    pub fn is_empty(&self) -> bool {
        self.rows.is_empty()
    }

    pub fn cell(&self, row: usize, col: usize) -> &Cell {
        &self.rows[row][col]
    }

    pub fn display(&self, row: usize, col: usize) -> &str {
        self.display[row].get(col).map_or("", String::as_str)
    }

    /// The rows repeated (cycling) to `n` rows, for scale benches.
    pub fn repeated_to(&self, n: usize) -> TableModel {
        if self.rows.is_empty() {
            return self.clone();
        }
        let pick = |i: usize| i % self.rows.len();
        TableModel {
            columns: self.columns.clone(),
            rows: (0..n).map(|i| self.rows[pick(i)].clone()).collect(),
            display: (0..n).map(|i| self.display[pick(i)].clone()).collect(),
        }
    }
}

/// Row indices of `model` sorted by column `col` (build-plan M7.7). Ties go to the lower row
/// index whatever the earlier sorts were (D2, D301); "?" cells go last in both directions.
pub fn sort_order(model: &TableModel, col: usize, ascending: bool) -> Vec<u32> {
    let mut order: Vec<u32> = (0..model.len() as u32).collect();
    order.sort_unstable_by(|&a, &b| {
        let (x, y) = (model.cell(a as usize, col), model.cell(b as usize, col));
        let o = match (x, y) {
            (Cell::Unknown, Cell::Unknown) => std::cmp::Ordering::Equal,
            (Cell::Unknown, _) => std::cmp::Ordering::Greater,
            (_, Cell::Unknown) => std::cmp::Ordering::Less,
            _ if ascending => x.cmp_value(y),
            _ => y.cmp_value(x),
        };
        o.then(a.cmp(&b))
    });
    order
}

/// Rows the pool needs to fill a body `height` logical pixels tall: enough to cover a partial
/// last row, capped at [`MAX_POOL`].
pub fn pool_size(height: f32, row_height: f32) -> usize {
    if height <= 0.0 || row_height <= 0.0 {
        return 0;
    }
    ((height / row_height).ceil() as usize).min(MAX_POOL)
}

/// One pooled row: its node and the text entity of each cell.
#[derive(Debug, Clone)]
struct PoolRow {
    node: Entity,
    texts: Vec<Entity>,
}

/// A table widget's state, on its root node.
#[derive(Component, Debug)]
pub struct Table {
    model: Arc<TableModel>,
    /// Row indices in display order.
    order: Vec<u32>,
    /// First shown position in `order`.
    top: usize,
    /// Sorted column and direction.
    sort: Option<(usize, bool)>,
    /// The body's height in logical pixels.
    viewport: f32,
    pool: Vec<PoolRow>,
    body: Entity,
    header: Vec<Entity>,
    footer: Entity,
    last_sort: Duration,
}

impl Table {
    pub fn model(&self) -> &TableModel {
        &self.model
    }

    /// Rows that fit whole in the body.
    pub fn visible_rows(&self) -> usize {
        ((self.viewport / size::ROW).floor() as usize).max(1)
    }

    pub fn pool_len(&self) -> usize {
        self.pool.len()
    }

    pub fn top(&self) -> usize {
        self.top
    }

    pub fn max_top(&self) -> usize {
        self.model.len().saturating_sub(self.visible_rows())
    }

    /// The model row shown at display position `pos`.
    pub fn row_at(&self, pos: usize) -> Option<usize> {
        self.order.get(pos).map(|&i| i as usize)
    }

    pub fn sorted_by(&self) -> Option<(usize, bool)> {
        self.sort
    }

    /// The last sort's time.
    pub fn last_sort(&self) -> Duration {
        self.last_sort
    }

    /// Scrolls by `rows` (negative is up), clamped.
    pub fn scroll(&mut self, rows: isize) {
        self.top = self.top.saturating_add_signed(rows).min(self.max_top());
    }

    pub fn scroll_to(&mut self, top: usize) {
        self.top = top.min(self.max_top());
    }

    /// Sorts by `col`: ascending, or reversed if it was already sorted ascending by it.
    pub fn sort_by(&mut self, col: usize) {
        let ascending = self.sort != Some((col, true));
        self.sort_with(col, ascending);
    }

    pub fn sort_with(&mut self, col: usize, ascending: bool) {
        if col >= self.model.columns.len() {
            return;
        }
        let start = Instant::now();
        self.order = sort_order(&self.model, col, ascending);
        self.last_sort = start.elapsed();
        self.sort = Some((col, ascending));
        self.top = 0;
        info!(
            "table sort: {} rows by {} {} in {:.3} ms",
            self.model.len(),
            self.model.columns[col].title,
            if ascending { "asc" } else { "desc" },
            self.last_sort.as_secs_f64() * 1e3
        );
    }

    /// Replaces the data, keeping the sort and the scroll position where they still fit.
    pub fn set_model(&mut self, model: Arc<TableModel>) {
        self.model = model;
        match self.sort {
            Some((col, asc)) if col < self.model.columns.len() => {
                let top = self.top;
                self.sort_with(col, asc);
                self.scroll_to(top);
            }
            _ => {
                self.sort = None;
                self.order = (0..self.model.len() as u32).collect();
                self.scroll_to(self.top);
            }
        }
    }

    /// Sets the body height in logical pixels (from layout, or a test); the pool follows.
    pub fn set_viewport_height(&mut self, height: f32) {
        self.viewport = height;
        self.scroll_to(self.top);
    }
}

/// The table under the keyboard.
#[derive(Resource, Debug, Default, Clone, Copy, PartialEq)]
pub struct TableFocus(pub Option<Entity>);

/// A row was clicked: the table, the model row and whether it was the secondary button.
#[derive(Message, Debug, Clone, Copy, PartialEq)]
pub struct TableRowClicked {
    pub table: Entity,
    pub row: usize,
    pub secondary: bool,
}

/// Marks a table's body node.
#[derive(Component)]
struct TableBody(Entity);

/// Spawns a table under `parent` and returns its root entity.
pub fn spawn_table(commands: &mut Commands, parent: Entity, model: Arc<TableModel>) -> Entity {
    let root = commands
        .spawn((
            Node {
                flex_direction: FlexDirection::Column,
                flex_grow: 1.0,
                min_height: px(0.0),
                overflow: Overflow::clip(),
                ..default()
            },
            BackgroundColor(color::PANEL),
        ))
        .id();
    commands.entity(parent).add_child(root);
    let header_row = commands
        .spawn((row_node(), BackgroundColor(color::PANEL_RAISED)))
        .id();
    let mut header = Vec::new();
    for (col, c) in model.columns.iter().enumerate() {
        let text = commands
            .spawn(theme::text(c.title.clone(), font::BODY, color::CYAN))
            .id();
        let mut cell = commands.spawn((
            cell_node(c),
            Hovered::default(),
            Tooltip(c.hint.clone().unwrap_or_default()),
        ));
        cell.add_child(text)
            .observe(move |_: On<PointerClick>, mut tables: Query<&mut Table>| {
                if let Ok(mut t) = tables.get_mut(root) {
                    t.sort_by(col);
                }
            });
        header.push(text);
        let cell = cell.id();
        commands.entity(header_row).add_child(cell);
    }
    let body = commands
        .spawn((
            TableBody(root),
            Node {
                flex_direction: FlexDirection::Column,
                flex_grow: 1.0,
                min_height: px(0.0),
                overflow: Overflow::clip(),
                ..default()
            },
        ))
        .observe(
            move |ev: On<PointerScroll>, mut tables: Query<&mut Table>| {
                let rows = match ev.unit {
                    MouseScrollUnit::Line => -ev.y * ROWS_PER_WHEEL_LINE,
                    MouseScrollUnit::Pixel => -ev.y / size::ROW,
                };
                if let Ok(mut t) = tables.get_mut(root)
                    && rows.round() != 0.0
                {
                    t.scroll(rows.round() as isize);
                }
            },
        )
        .id();
    let footer = commands
        .spawn((
            Node {
                padding: UiRect::axes(px(6.0), px(3.0)),
                ..default()
            },
            BackgroundColor(color::BG),
            children![theme::muted("")],
        ))
        .id();
    commands
        .entity(root)
        .add_children(&[header_row, body, footer])
        .insert(Table {
            order: (0..model.len() as u32).collect(),
            model,
            top: 0,
            sort: None,
            viewport: 0.0,
            pool: Vec::new(),
            body,
            header,
            footer,
            last_sort: Duration::ZERO,
        });
    root
}

fn row_node() -> Node {
    Node {
        height: px(size::ROW),
        min_height: px(size::ROW),
        flex_direction: FlexDirection::Row,
        align_items: AlignItems::Center,
        column_gap: px(8.0),
        padding: UiRect::horizontal(px(6.0)),
        ..default()
    }
}

fn cell_node(c: &Column) -> Node {
    Node {
        width: px(c.width),
        min_width: px(c.width),
        overflow: Overflow::clip(),
        justify_content: if c.numeric {
            JustifyContent::FlexEnd
        } else {
            JustifyContent::FlexStart
        },
        ..default()
    }
}

/// Reads each body's laid-out height into its table.
fn measure_bodies(
    bodies: Query<(&TableBody, &ComputedNode), Changed<ComputedNode>>,
    mut tables: Query<&mut Table>,
) {
    for (body, node) in &bodies {
        let h = node.size.y * node.inverse_scale_factor;
        if let Ok(mut t) = tables.get_mut(body.0)
            && (t.viewport - h).abs() > 0.5
        {
            t.set_viewport_height(h);
        }
    }
}

/// Grows or shrinks each pool to its body's height (the M0.8 spike's open check 4).
fn resize_pools(mut commands: Commands, mut tables: Query<(Entity, &mut Table)>) {
    for (root, mut t) in &mut tables {
        let want = pool_size(t.viewport, size::ROW);
        if want == t.pool.len() {
            continue;
        }
        while t.pool.len() > want {
            if let Some(row) = t.pool.pop() {
                commands.entity(row.node).despawn();
            }
        }
        while t.pool.len() < want {
            let slot = t.pool.len();
            let mut texts = Vec::with_capacity(t.model.columns.len());
            let node = commands
                .spawn((row_node(), BackgroundColor(color::ROW[slot % 2])))
                .observe(
                    move |ev: On<PointerClick>,
                          tables: Query<&Table>,
                          mut out: MessageWriter<TableRowClicked>| {
                        if let Ok(t) = tables.get(root)
                            && let Some(row) = t.row_at(t.top + slot)
                        {
                            out.write(TableRowClicked {
                                table: root,
                                row,
                                secondary: ev.button == PointerButton::Secondary,
                            });
                        }
                    },
                )
                .id();
            for c in &t.model.columns {
                let text = commands
                    .spawn(theme::text("", font::BODY, color::TEXT))
                    .id();
                let cell = commands.spawn((cell_node(c), Pickable::IGNORE)).id();
                commands.entity(cell).add_child(text);
                commands.entity(node).add_child(cell);
                texts.push(text);
            }
            commands.entity(t.body).add_child(node);
            t.pool.push(PoolRow { node, texts });
        }
    }
}

/// Scrolls the focused table from the keyboard.
fn keyboard_scroll(
    keys: Res<ButtonInput<KeyCode>>,
    focus: Res<TableFocus>,
    mut tables: Query<&mut Table>,
) {
    let Some(mut t) = focus.0.and_then(|e| tables.get_mut(e).ok()) else {
        return;
    };
    let page = t.visible_rows() as isize;
    let mut rows = 0isize;
    for (key, step) in [
        (KeyCode::ArrowDown, 1),
        (KeyCode::ArrowUp, -1),
        (KeyCode::PageDown, page),
        (KeyCode::PageUp, -page),
    ] {
        if keys.just_pressed(key) {
            rows += step;
        }
    }
    if keys.just_pressed(KeyCode::Home) {
        t.scroll_to(0);
    } else if keys.just_pressed(KeyCode::End) {
        let end = t.max_top();
        t.scroll_to(end);
    } else if rows != 0 {
        t.scroll(rows);
    }
}

/// Rewrites the pooled cells, header and footer of tables that changed; only cells whose text
/// differs are written.
fn redraw(
    tables: Query<&Table, Changed<Table>>,
    mut texts: Query<&mut Text>,
    mut backgrounds: Query<&mut BackgroundColor>,
) {
    for t in &tables {
        for (slot, row) in t.pool.iter().enumerate() {
            let pos = t.top + slot;
            let data = t.row_at(pos);
            for (col, &e) in row.texts.iter().enumerate() {
                let value = data.map_or("", |r| t.model.display(r, col));
                if let Ok(mut text) = texts.get_mut(e)
                    && text.0 != value
                {
                    value.clone_into(&mut text.0);
                }
            }
            // Stripes follow the data, so they scroll with it.
            let stripe = color::ROW[pos % 2];
            if let Ok(mut bg) = backgrounds.get_mut(row.node)
                && bg.0 != stripe
            {
                bg.0 = stripe;
            }
        }
        for (col, &e) in t.header.iter().enumerate() {
            let c = &t.model.columns[col];
            let title = match t.sort {
                Some((s, true)) if s == col => format!("{} ^", c.title),
                Some((s, false)) if s == col => format!("{} v", c.title),
                _ => c.title.clone(),
            };
            if let Ok(mut text) = texts.get_mut(e)
                && text.0 != title
            {
                text.0 = title;
            }
        }
    }
}

/// Writes each table's footer status line (a child text of the footer node).
fn redraw_footers(
    tables: Query<&Table, Changed<Table>>,
    children: Query<&Children>,
    mut texts: Query<&mut Text>,
) {
    for t in &tables {
        let shown = t.visible_rows().min(t.model.len().saturating_sub(t.top));
        let sort = t.sort.map_or(String::new(), |(c, asc)| {
            format!(
                " | sorted by {} {} | sort {:.2} ms",
                t.model.columns[c].title,
                if asc { "asc" } else { "desc" },
                t.last_sort.as_secs_f64() * 1e3
            )
        });
        let status = format!(
            "rows {}-{} of {}{} | wheel, arrows, PgUp/PgDn, Home/End; click a header to sort",
            format::int((t.top + usize::from(shown > 0)) as i64),
            format::int((t.top + shown) as i64),
            format::int(t.model.len() as i64),
            sort
        );
        let Some(&text) = children.get(t.footer).ok().and_then(|c| c.first()) else {
            continue;
        };
        if let Ok(mut text) = texts.get_mut(text)
            && text.0 != status
        {
            text.0 = status;
        }
    }
}

/// System sets of the table widget, in order.
#[derive(SystemSet, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TableSystems;

/// The table widget's systems and messages.
pub struct TablePlugin;

impl Plugin for TablePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<TableFocus>()
            .add_message::<TableRowClicked>()
            .add_systems(
                Update,
                (
                    measure_bodies,
                    keyboard_scroll,
                    resize_pools,
                    (redraw, redraw_footers),
                )
                    .chain()
                    .in_set(TableSystems),
            );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn model(n: usize) -> TableModel {
        // A deterministic scramble so the sort has work to do.
        let rows = (0..n)
            .map(|i| {
                let v = (i as u64).wrapping_mul(2_654_435_761) % 1_000_003;
                vec![
                    Cell::Text(format!("R{i:05}")),
                    Cell::Int(v as i64),
                    if i % 7 == 0 {
                        Cell::Unknown
                    } else {
                        Cell::Money(v as f64 * 1e3)
                    },
                ]
            })
            .collect();
        TableModel::new(
            vec![
                Column::text("Id", 80.0),
                Column::number("N", 80.0),
                Column::number("Money", 90.0),
            ],
            rows,
        )
    }

    #[test]
    fn pool_covers_the_body() {
        assert_eq!(pool_size(0.0, 22.0), 0);
        assert_eq!(pool_size(22.0, 22.0), 1);
        assert_eq!(pool_size(23.0, 22.0), 2);
        assert_eq!(pool_size(572.0, 22.0), 26);
        assert_eq!(pool_size(1e6, 22.0), MAX_POOL);
    }

    #[test]
    fn sort_of_10000_rows_is_ordered_and_quick() {
        let m = model(10_000);
        let start = Instant::now();
        let asc = sort_order(&m, 1, true);
        let ms = start.elapsed().as_secs_f64() * 1e3;
        println!("10,000-row sort: {ms:.2} ms");
        assert_eq!(asc.len(), 10_000);
        for w in asc.windows(2) {
            let (a, b) = (w[0] as usize, w[1] as usize);
            let o = m.cell(a, 1).cmp_value(m.cell(b, 1));
            assert!(o.is_lt() || (o.is_eq() && a < b));
        }
        // Debug builds run the game crate unoptimized; release is far under a frame (bench).
        assert!(ms < 250.0, "10,000-row sort took {ms:.1} ms");
    }

    #[test]
    fn unknown_last_both_ways_and_ties_to_lower_row() {
        let m = model(100);
        for asc in [true, false] {
            let o = sort_order(&m, 2, asc);
            let first_unknown = o
                .iter()
                .position(|&r| m.cell(r as usize, 2) == &Cell::Unknown)
                .unwrap();
            assert!(
                o[first_unknown..]
                    .iter()
                    .all(|&r| m.cell(r as usize, 2) == &Cell::Unknown)
            );
            // Unknown rows keep ascending row order.
            assert!(o[first_unknown..].windows(2).all(|w| w[0] < w[1]));
        }
        let desc = sort_order(&m, 1, false);
        assert!(desc.windows(2).all(|w| {
            let o = m.cell(w[0] as usize, 1).cmp_value(m.cell(w[1] as usize, 1));
            o.is_gt() || (o.is_eq() && w[0] < w[1])
        }));
    }

    fn app_with_table(rows: usize) -> (App, Entity) {
        let mut app = App::new();
        app.add_plugins((MinimalPlugins, bevy::input::InputPlugin, TablePlugin));
        let parent = app.world_mut().spawn(Node::default()).id();
        let model = Arc::new(model(rows));
        let mut commands = app.world_mut().commands();
        let table = spawn_table(&mut commands, parent, model);
        app.world_mut().flush();
        app.update();
        (app, table)
    }

    fn set_height(app: &mut App, table: Entity, h: f32) {
        app.world_mut()
            .get_mut::<Table>(table)
            .unwrap()
            .set_viewport_height(h);
        app.update();
        app.update();
    }

    #[test]
    fn pool_follows_resizes() {
        let (mut app, table) = app_with_table(3_255);
        for (h, want) in [
            (220.0, 10),
            (572.0, 26),
            (100.0, 5),
            (1100.0, 50),
            (22.0, 1),
        ] {
            set_height(&mut app, table, h);
            let t = app.world().get::<Table>(table).unwrap();
            assert_eq!(t.pool_len(), want, "height {h}");
            // The pool's row nodes exist and no stale ones linger.
            let body = t.body;
            let rows = app.world().get::<Children>(body).map_or(0, |c| c.len());
            assert_eq!(rows, want, "row entities at height {h}");
        }
    }

    #[test]
    fn redraw_writes_the_visible_rows() {
        let (mut app, table) = app_with_table(3_255);
        set_height(&mut app, table, 220.0);
        {
            let mut t = app.world_mut().get_mut::<Table>(table).unwrap();
            t.sort_with(1, false);
            t.scroll(5);
        }
        app.update();
        let t = app.world().get::<Table>(table).unwrap();
        let want = t.model().display(t.row_at(5).unwrap(), 0).to_owned();
        let first = t.pool[0].texts[0];
        assert_eq!(app.world().get::<Text>(first).unwrap().0, want);
        let header = t.header[1];
        assert_eq!(app.world().get::<Text>(header).unwrap().0, "N v");
    }

    #[test]
    fn scrolling_clamps() {
        let (mut app, table) = app_with_table(30);
        set_height(&mut app, table, 220.0);
        let mut t = app.world_mut().get_mut::<Table>(table).unwrap();
        t.scroll(1000);
        assert_eq!(t.top(), 20);
        t.scroll(-1000);
        assert_eq!(t.top(), 0);
    }
}
