//! Table widget (build-plan M7.7; risk R1; the M0.8 spike's open checks, D14; M9 A2 upgrades,
//! D456).
//!
//! - **Virtualized:** only a pool of row entities exists, sized to the body's height
//!   ([`pool_size`]); scrolling or sorting rewrites their text, and only cells whose text or
//!   color changed are written.
//! - **Sortable columns** with a fixed header: click a header to sort, again to reverse. Ties go
//!   to the lower row (D2, D301), "?" cells sort last in both directions.
//! - **Configurable columns** (M9): the "cols" button opens a chooser (show or hide, move left
//!   or right, reset); drag a header onto another to move it there; drag a header's right edge
//!   to resize. A table spawned with an id ([`spawn_table_with_id`]) saves its columns and sort
//!   in the UI config under that id and reads them back when it is spawned again.
//! - **Formats:** money, percent, counts, per-share prices, dates, ratings, ratios, colored
//!   gains, links and estimate bands ([`format::Cell`]). A link cell opens its page on click
//!   (Shift or middle click: a new pane) and shows its hover card.
//! - **Scrolling:** the mouse wheel over the table, and Up, Down, PageUp, PageDown, Home and End
//!   for the focused table ([`TableFocus`]).
//! - Row height follows the config's density and font scale (D458).
//! - Each sort is logged with its time (D14); the `--bench-table` run prints frame times.

pub mod format;

use std::sync::Arc;
use std::time::{Duration, Instant};

use bevy::input::mouse::MouseScrollUnit;
use bevy::picking::hover::Hovered;
use bevy::prelude::*;

pub use format::{Cell, GainUnit};

use crate::config::{
    COLUMN_WIDTH_MAX, COLUMN_WIDTH_MIN, ColumnConfig, SortConfig, TableConfig, UiConfig,
};
use crate::links::LinkSlot;
use crate::ui::KeyboardCapture;
use crate::ui::theme::{self, Tooltip, color, font, size};

/// Rows per wheel line (the M0.8 spike saw one notch arrive as two line events on X11, so one
/// line is two rows here, D307; Logan checks the feel by hand, D14).
pub const ROWS_PER_WHEEL_LINE: f32 = 2.0;
/// Most pooled rows a table keeps, whatever the window height (a 4K-tall window at 22 px is
/// about 100 rows; D307).
pub const MAX_POOL: usize = 160;
/// Width of the drag handle on a header's right edge.
pub const GRIP_WIDTH: f32 = 6.0;

/// A column: a stable key (the config's), a title, a width in logical pixels and whether it
/// holds numbers (right-aligned).
#[derive(Debug, Clone, PartialEq)]
pub struct Column {
    /// The column's id in saved table configs; the title unless set.
    pub key: String,
    pub title: String,
    pub width: f32,
    pub numeric: bool,
    /// Hover hint for the header.
    pub hint: Option<String>,
}

impl Column {
    pub fn text(title: &str, width: f32) -> Column {
        Column {
            key: title.to_owned(),
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

    /// Sets the key (keep it when the title changes, so saved configs still find the column).
    pub fn with_key(mut self, key: &str) -> Column {
        key.clone_into(&mut self.key);
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

    /// A cell, or `None` past the row's end.
    pub fn get(&self, row: usize, col: usize) -> Option<&Cell> {
        self.rows.get(row).and_then(|r| r.get(col))
    }

    pub fn display(&self, row: usize, col: usize) -> &str {
        self.display[row].get(col).map_or("", String::as_str)
    }

    /// The model column with `key`.
    pub fn column_by_key(&self, key: &str) -> Option<usize> {
        self.columns.iter().position(|c| c.key == key)
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

/// One pooled row: its node, and each shown column's cell node and text entity.
#[derive(Debug, Clone)]
struct PoolRow {
    node: Entity,
    cells: Vec<Entity>,
    texts: Vec<Entity>,
}

/// A table widget's state, on its root node.
#[derive(Component, Debug)]
pub struct Table {
    model: Arc<TableModel>,
    /// The config id, when the table saves its columns.
    id: Option<String>,
    /// Row indices in display order.
    order: Vec<u32>,
    /// First shown position in `order`.
    top: usize,
    /// Sorted model column and direction.
    sort: Option<(usize, bool)>,
    /// The body's height in logical pixels.
    viewport: f32,
    row_h: f32,
    /// Every model column in display order, shown or not.
    col_order: Vec<usize>,
    /// Per model column.
    visible: Vec<bool>,
    widths: Vec<f32>,
    /// The shown columns in display order (derived).
    shown: Vec<usize>,
    pool: Vec<PoolRow>,
    body: Entity,
    header_row: Entity,
    /// Header text entities, per shown column.
    header: Vec<Entity>,
    /// Header cell nodes, per shown column.
    header_cells: Vec<Entity>,
    footer: Entity,
    chooser: Entity,
    chooser_open: bool,
    /// Bumped when columns are shown, hidden or moved: the header and pool are rebuilt.
    layout: u64,
    built_layout: u64,
    /// Bumped when a width changes: the nodes are resized in place.
    width_rev: u64,
    built_width_rev: u64,
    /// The columns or sort changed by the player since the config was last written.
    config_dirty: bool,
    /// The saved config was applied (on the first frame).
    config_applied: bool,
    last_sort: Duration,
}

impl Table {
    fn new(
        model: Arc<TableModel>,
        id: Option<String>,
        body: Entity,
        header_row: Entity,
        footer: Entity,
        chooser: Entity,
    ) -> Table {
        let n = model.columns.len();
        let mut t = Table {
            order: (0..model.len() as u32).collect(),
            id,
            top: 0,
            sort: None,
            viewport: 0.0,
            row_h: size::ROW,
            col_order: (0..n).collect(),
            visible: vec![true; n],
            widths: model.columns.iter().map(|c| c.width).collect(),
            shown: Vec::new(),
            pool: Vec::new(),
            body,
            header_row,
            header: Vec::new(),
            header_cells: Vec::new(),
            footer,
            chooser,
            chooser_open: false,
            layout: 1,
            built_layout: 0,
            width_rev: 0,
            built_width_rev: 0,
            config_dirty: false,
            config_applied: false,
            last_sort: Duration::ZERO,
            model,
        };
        t.derive_shown();
        t
    }

    pub fn model(&self) -> &TableModel {
        &self.model
    }

    /// The config id, if the table saves its columns.
    pub fn id(&self) -> Option<&str> {
        self.id.as_deref()
    }

    /// Rows that fit whole in the body.
    pub fn visible_rows(&self) -> usize {
        ((self.viewport / self.row_h).floor() as usize).max(1)
    }

    pub fn row_height(&self) -> f32 {
        self.row_h
    }

    pub fn pool_len(&self) -> usize {
        self.pool.len()
    }

    /// The text entity of the first pooled row's first shown cell, once the pool has rows and
    /// the redraw has filled them (the timing bench waits for its layout).
    pub fn first_cell_text(&self) -> Option<Entity> {
        (self.built_layout == self.layout)
            .then(|| self.pool.first().and_then(|r| r.texts.first().copied()))
            .flatten()
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

    /// The shown model columns in display order.
    pub fn shown_columns(&self) -> &[usize] {
        &self.shown
    }

    /// Every model column in display order, shown or not.
    pub fn column_order(&self) -> &[usize] {
        &self.col_order
    }

    pub fn is_visible(&self, col: usize) -> bool {
        self.visible.get(col).copied().unwrap_or(false)
    }

    pub fn width(&self, col: usize) -> f32 {
        self.widths.get(col).copied().unwrap_or(0.0)
    }

    pub fn chooser_open(&self) -> bool {
        self.chooser_open
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
        self.config_dirty = true;
        info!(
            "table sort: {} rows by {} {} in {:.3} ms",
            self.model.len(),
            self.model.columns[col].title,
            if ascending { "asc" } else { "desc" },
            self.last_sort.as_secs_f64() * 1e3
        );
    }

    /// Replaces the data, keeping the sort, the scroll position and the column setup where they
    /// still fit (same column keys); a model with other columns resets them.
    pub fn set_model(&mut self, model: Arc<TableModel>) {
        let same_columns = model.columns.len() == self.model.columns.len()
            && model
                .columns
                .iter()
                .zip(&self.model.columns)
                .all(|(a, b)| a.key == b.key);
        self.model = model;
        if !same_columns {
            let n = self.model.columns.len();
            self.col_order = (0..n).collect();
            self.visible = vec![true; n];
            self.widths = self.model.columns.iter().map(|c| c.width).collect();
            self.derive_shown();
            self.layout += 1;
        }
        let dirty = self.config_dirty;
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
        self.config_dirty = dirty;
    }

    /// Sets the body height in logical pixels (from layout, or a test); the pool follows.
    pub fn set_viewport_height(&mut self, height: f32) {
        self.viewport = height;
        self.scroll_to(self.top);
    }

    /// Sets the row height (the config's density and font scale); the pool is rebuilt.
    pub fn set_row_height(&mut self, h: f32) {
        if (self.row_h - h).abs() > 0.01 && h > 0.0 {
            self.row_h = h;
            self.layout += 1;
            self.scroll_to(self.top);
        }
    }

    fn derive_shown(&mut self) {
        self.shown = self
            .col_order
            .iter()
            .copied()
            .filter(|&c| self.visible[c])
            .collect();
    }

    fn columns_changed(&mut self) {
        self.derive_shown();
        self.layout += 1;
        self.config_dirty = true;
    }

    /// Shows or hides a column; the last shown column cannot be hidden.
    pub fn set_column_visible(&mut self, col: usize, on: bool) -> bool {
        if col >= self.visible.len() || self.visible[col] == on {
            return false;
        }
        if !on && self.shown.len() <= 1 {
            return false;
        }
        self.visible[col] = on;
        self.columns_changed();
        true
    }

    /// Moves a column `delta` places in the display order (shown or hidden).
    pub fn move_column(&mut self, col: usize, delta: i32) -> bool {
        let Some(i) = self.col_order.iter().position(|&c| c == col) else {
            return false;
        };
        let j = (i as i32 + delta).clamp(0, self.col_order.len() as i32 - 1) as usize;
        if i == j {
            return false;
        }
        let c = self.col_order.remove(i);
        self.col_order.insert(j, c);
        self.columns_changed();
        true
    }

    /// Moves `col` to `target`'s place (a header dropped on another).
    pub fn move_column_to(&mut self, col: usize, target: usize) -> bool {
        let (Some(i), Some(j)) = (
            self.col_order.iter().position(|&c| c == col),
            self.col_order.iter().position(|&c| c == target),
        ) else {
            return false;
        };
        if i == j {
            return false;
        }
        let c = self.col_order.remove(i);
        self.col_order.insert(j, c);
        self.columns_changed();
        true
    }

    /// Sets a column's width, clamped to the config limits.
    pub fn set_width(&mut self, col: usize, w: f32) -> bool {
        let w = w.clamp(COLUMN_WIDTH_MIN, COLUMN_WIDTH_MAX);
        match self.widths.get_mut(col) {
            Some(cur) if (*cur - w).abs() > 0.01 => {
                *cur = w;
                self.width_rev += 1;
                self.config_dirty = true;
                true
            }
            _ => false,
        }
    }

    /// Back to the model's columns, widths and no sort.
    pub fn reset_columns(&mut self) {
        let n = self.model.columns.len();
        self.col_order = (0..n).collect();
        self.visible = vec![true; n];
        self.widths = self.model.columns.iter().map(|c| c.width).collect();
        self.sort = None;
        self.order = (0..self.model.len() as u32).collect();
        self.top = 0;
        self.columns_changed();
        self.width_rev += 1;
    }

    /// The columns and sort as a config.
    pub fn config(&self) -> TableConfig {
        let m = &self.model;
        TableConfig {
            columns: self
                .col_order
                .iter()
                .map(|&c| ColumnConfig {
                    key: m.columns[c].key.clone(),
                    visible: self.visible[c],
                    width: self.widths[c],
                })
                .collect(),
            sort: self.sort.map(|(c, ascending)| SortConfig {
                key: m.columns[c].key.clone(),
                ascending,
            }),
        }
    }

    /// Applies a saved config: its columns in its order (unknown keys ignored, columns it does
    /// not name keep their model order after it), widths, visibility and sort.
    pub fn apply_config(&mut self, cfg: &TableConfig) {
        let m = Arc::clone(&self.model);
        let mut order = Vec::with_capacity(m.columns.len());
        let mut visible = vec![true; m.columns.len()];
        let mut widths: Vec<f32> = m.columns.iter().map(|c| c.width).collect();
        for c in &cfg.columns {
            if let Some(i) = m.column_by_key(&c.key)
                && !order.contains(&i)
            {
                order.push(i);
                visible[i] = c.visible;
                widths[i] = c.width.clamp(COLUMN_WIDTH_MIN, COLUMN_WIDTH_MAX);
            }
        }
        for i in 0..m.columns.len() {
            if !order.contains(&i) {
                order.push(i);
            }
        }
        if !visible.iter().any(|&v| v) {
            visible[order[0]] = true;
        }
        self.col_order = order;
        self.visible = visible;
        self.widths = widths;
        self.derive_shown();
        self.layout += 1;
        self.width_rev += 1;
        if let Some(s) = &cfg.sort
            && let Some(col) = m.column_by_key(&s.key)
        {
            self.sort_with(col, s.ascending);
        }
        self.config_dirty = false;
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

/// A header cell: its table and model column.
#[derive(Component, Debug, Clone, Copy)]
pub struct HeaderCell {
    pub table: Entity,
    pub col: usize,
}

/// A header's resize handle.
#[derive(Component, Debug, Clone, Copy)]
struct ResizeGrip {
    table: Entity,
    col: usize,
}

/// Spawns a table under `parent` and returns its root entity. It keeps no config.
pub fn spawn_table(commands: &mut Commands, parent: Entity, model: Arc<TableModel>) -> Entity {
    spawn_table_inner(commands, parent, model, None)
}

/// Spawns a table that saves its columns and sort in the UI config under `id`, and reads them
/// back if saved (D456). Use one id per table on a page kind (`"companies"`, `"industry.firms"`).
pub fn spawn_table_with_id(
    commands: &mut Commands,
    parent: Entity,
    model: Arc<TableModel>,
    id: &str,
) -> Entity {
    spawn_table_inner(commands, parent, model, Some(id.to_owned()))
}

fn spawn_table_inner(
    commands: &mut Commands,
    parent: Entity,
    model: Arc<TableModel>,
    id: Option<String>,
) -> Entity {
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
        .spawn((row_node(size::ROW), BackgroundColor(color::PANEL_RAISED)))
        .id();
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
            move |mut ev: On<PointerScroll>, mut tables: Query<&mut Table>| {
                // The table scrolls itself; the page under it must not scroll too.
                ev.propagate(false);
                let Ok(mut t) = tables.get_mut(root) else {
                    return;
                };
                let rows = match ev.unit {
                    MouseScrollUnit::Line => -ev.y * ROWS_PER_WHEEL_LINE,
                    MouseScrollUnit::Pixel => -ev.y / t.row_h,
                };
                if rows.round() != 0.0 {
                    t.scroll(rows.round() as isize);
                }
            },
        )
        .id();
    let footer = commands
        .spawn((
            Node {
                padding: UiRect::axes(px(6.0), px(2.0)),
                ..default()
            },
            BackgroundColor(color::BG),
            children![theme::muted("")],
        ))
        .id();
    let chooser = commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                right: px(4.0),
                top: px(size::ROW),
                flex_direction: FlexDirection::Column,
                padding: UiRect::all(px(6.0)),
                row_gap: px(2.0),
                border: UiRect::all(px(1.0)),
                display: Display::None,
                ..default()
            },
            BackgroundColor(color::PANEL_RAISED),
            BorderColor::all(color::CYAN),
            GlobalZIndex(60),
        ))
        .id();
    commands
        .entity(root)
        .add_children(&[header_row, body, footer, chooser])
        .insert(Table::new(model, id, body, header_row, footer, chooser));
    root
}

fn row_node(h: f32) -> Node {
    Node {
        height: px(h),
        min_height: px(h),
        flex_direction: FlexDirection::Row,
        align_items: AlignItems::Center,
        column_gap: px(8.0),
        padding: UiRect::horizontal(px(6.0)),
        ..default()
    }
}

fn cell_node(c: &Column, width: f32) -> Node {
    Node {
        width: px(width),
        min_width: px(width),
        flex_shrink: 0.0,
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

/// Applies saved configs to new tables, and the config's row height to all.
fn configure_tables(cfg: Option<Res<UiConfig>>, mut tables: Query<&mut Table>) {
    let Some(cfg) = cfg else {
        return;
    };
    let row_h = cfg.row_height();
    for mut t in &mut tables {
        if !t.config_applied {
            t.config_applied = true;
            if let Some(saved) = t.id.as_ref().and_then(|id| cfg.tables.get(id)).cloned() {
                t.apply_config(&saved);
            }
        }
        if (t.row_h - row_h).abs() > 0.01 {
            t.set_row_height(row_h);
        }
    }
}

/// Writes changed table configs into the UI config.
fn store_configs(cfg: Option<ResMut<UiConfig>>, mut tables: Query<&mut Table, Changed<Table>>) {
    let Some(mut cfg) = cfg else {
        return;
    };
    for mut t in &mut tables {
        if !t.config_dirty {
            continue;
        }
        t.config_dirty = false;
        if let Some(id) = t.id.clone() {
            let c = t.config();
            if cfg.tables.get(&id) != Some(&c) {
                cfg.tables.insert(id, c);
            }
        }
    }
}

/// Rebuilds the header, the chooser and an empty pool when the columns or row height changed.
fn build_layouts(
    mut commands: Commands,
    mut tables: Query<(Entity, &mut Table)>,
    children: Query<&Children>,
) {
    for (root, mut t) in &mut tables {
        if t.built_layout == t.layout {
            continue;
        }
        t.built_layout = t.layout;
        t.built_width_rev = t.width_rev;
        for row in std::mem::take(&mut t.pool) {
            commands.entity(row.node).despawn();
        }
        if let Ok(c) = children.get(t.header_row) {
            for &e in c {
                commands.entity(e).despawn();
            }
        }
        let rh = t.row_h;
        commands.entity(t.header_row).insert(row_node(rh));
        if let Ok(c) = children.get(t.chooser) {
            for &e in c {
                commands.entity(e).despawn();
            }
        }
        let model = Arc::clone(&t.model);
        let shown = t.shown.clone();
        let mut header = Vec::with_capacity(shown.len());
        let mut cells = Vec::with_capacity(shown.len());
        for &col in &shown {
            let c = &model.columns[col];
            // The title ignores the pointer, so a drag starts on (and drops) the header cell.
            let text = commands
                .spawn((
                    theme::text_line(c.title.clone(), font::BODY, color::CYAN),
                    Pickable::IGNORE,
                ))
                .id();
            let grip = commands
                .spawn((
                    ResizeGrip { table: root, col },
                    Node {
                        position_type: PositionType::Absolute,
                        right: px(-GRIP_WIDTH / 2.0 - 4.0),
                        top: px(0.0),
                        bottom: px(0.0),
                        width: px(GRIP_WIDTH),
                        ..default()
                    },
                    Hovered::default(),
                    BackgroundColor(Color::NONE),
                    Tooltip("Drag to resize".into()),
                ))
                .observe(grip_drag)
                .observe(|mut ev: On<PointerClick>| ev.propagate(false))
                .id();
            let mut node = cell_node(c, t.widths[col]);
            node.overflow = Overflow::visible();
            let cell = commands
                .spawn((
                    node,
                    HeaderCell { table: root, col },
                    Hovered::default(),
                    Tooltip(c.hint.clone().unwrap_or_default()),
                ))
                .add_children(&[text, grip])
                .observe(header_click)
                .observe(header_drop)
                .id();
            commands.entity(t.header_row).add_child(cell);
            header.push(text);
            cells.push(cell);
        }
        // The chooser button, at the header's right end.
        let spacer = commands
            .spawn(Node {
                flex_grow: 1.0,
                ..default()
            })
            .id();
        let cols_button = commands
            .spawn((
                Node {
                    padding: UiRect::horizontal(px(4.0)),
                    border: UiRect::all(px(1.0)),
                    ..default()
                },
                BorderColor::all(color::BORDER),
                Hovered::default(),
                Tooltip(
                    "Columns: show, hide, reorder; drag headers to move, edges to resize".into(),
                ),
                children![theme::text_line("cols", font::SMALL, color::TEXT_MUTED)],
            ))
            .observe(move |mut ev: On<PointerClick>, mut q: Query<&mut Table>| {
                ev.propagate(false);
                if let Ok(mut t) = q.get_mut(root) {
                    t.chooser_open = !t.chooser_open;
                }
            })
            .id();
        commands
            .entity(t.header_row)
            .add_children(&[spacer, cols_button]);
        spawn_chooser_rows(&mut commands, root, &t, &model);
        t.header = header;
        t.header_cells = cells;
    }
}

fn spawn_chooser_rows(commands: &mut Commands, root: Entity, t: &Table, model: &TableModel) {
    let title = commands
        .spawn(theme::text_line("Columns", font::BODY, color::CYAN))
        .id();
    commands.entity(t.chooser).add_child(title);
    for &col in &t.col_order {
        let c = &model.columns[col];
        let row = commands
            .spawn(Node {
                flex_direction: FlexDirection::Row,
                align_items: AlignItems::Center,
                column_gap: px(6.0),
                ..default()
            })
            .id();
        let mark = if t.visible[col] { "[x]" } else { "[ ]" };
        let toggle = chooser_button(commands, root, mark, ChooserOp::Toggle(col));
        let name = commands
            .spawn(theme::text_line(
                c.title.clone(),
                font::SMALL,
                if t.visible[col] {
                    color::TEXT
                } else {
                    color::TEXT_MUTED
                },
            ))
            .id();
        let spacer = commands
            .spawn(Node {
                flex_grow: 1.0,
                min_width: px(12.0),
                ..default()
            })
            .id();
        let left = chooser_button(commands, root, "<", ChooserOp::Move(col, -1));
        let right = chooser_button(commands, root, ">", ChooserOp::Move(col, 1));
        commands
            .entity(row)
            .add_children(&[toggle, name, spacer, left, right]);
        commands.entity(t.chooser).add_child(row);
    }
    let foot = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            column_gap: px(8.0),
            margin: UiRect::top(px(4.0)),
            ..default()
        })
        .id();
    let reset = chooser_button(commands, root, "reset", ChooserOp::Reset);
    let close = chooser_button(commands, root, "close", ChooserOp::Close);
    commands.entity(foot).add_children(&[reset, close]);
    commands.entity(t.chooser).add_child(foot);
}

#[derive(Debug, Clone, Copy)]
enum ChooserOp {
    Toggle(usize),
    Move(usize, i32),
    Reset,
    Close,
}

fn chooser_button(commands: &mut Commands, root: Entity, label: &str, op: ChooserOp) -> Entity {
    commands
        .spawn((
            Node {
                padding: UiRect::horizontal(px(3.0)),
                ..default()
            },
            Hovered::default(),
            children![theme::text_line(label, font::SMALL, color::LINK)],
        ))
        .observe(move |mut ev: On<PointerClick>, mut q: Query<&mut Table>| {
            ev.propagate(false);
            let Ok(mut t) = q.get_mut(root) else {
                return;
            };
            match op {
                ChooserOp::Toggle(c) => {
                    let on = !t.is_visible(c);
                    t.set_column_visible(c, on);
                }
                ChooserOp::Move(c, d) => {
                    t.move_column(c, d);
                }
                ChooserOp::Reset => t.reset_columns(),
                ChooserOp::Close => t.chooser_open = false,
            }
        })
        .id()
}

fn header_click(ev: On<PointerClick>, cells: Query<&HeaderCell>, mut tables: Query<&mut Table>) {
    if ev.button != PointerButton::Primary {
        return;
    }
    if let Ok(h) = cells.get(ev.event_target())
        && let Ok(mut t) = tables.get_mut(h.table)
    {
        t.sort_by(h.col);
    }
}

/// A header dropped on another header moves there.
fn header_drop(
    ev: On<PointerDragDrop>,
    cells: Query<&HeaderCell>,
    grips: Query<(), With<ResizeGrip>>,
    parents: Query<&ChildOf>,
    mut tables: Query<&mut Table>,
) {
    // A resize grip's drag is no column move.
    if grips.contains(ev.dropped) {
        return;
    }
    // The dragged entity is the header cell, or (if a child ever takes the pointer) inside it.
    let dropped = std::iter::once(ev.dropped)
        .chain(parents.iter_ancestors(ev.dropped))
        .take(3)
        .find_map(|a| cells.get(a).ok().copied());
    let (Ok(target), Some(dropped)) = (cells.get(ev.event_target()), dropped) else {
        return;
    };
    if target.table != dropped.table {
        return;
    }
    if let Ok(mut t) = tables.get_mut(target.table) {
        t.move_column_to(dropped.col, target.col);
    }
}

fn grip_drag(mut ev: On<PointerDrag>, grips: Query<&ResizeGrip>, mut tables: Query<&mut Table>) {
    ev.propagate(false);
    if let Ok(g) = grips.get(ev.event_target())
        && let Ok(mut t) = tables.get_mut(g.table)
    {
        let w = t.width(g.col) + ev.delta.x;
        t.set_width(g.col, w);
    }
}

/// Resizes the header and pool cells of tables whose widths changed, in place.
fn apply_widths(mut tables: Query<&mut Table>, mut nodes: Query<&mut Node>) {
    for mut t in &mut tables {
        if t.built_width_rev == t.width_rev || t.built_layout != t.layout {
            continue;
        }
        t.built_width_rev = t.width_rev;
        let widths: Vec<f32> = t.shown.iter().map(|&c| t.widths[c]).collect();
        let rows = t.pool.iter().map(|r| r.cells.as_slice());
        for cells in std::iter::once(t.header_cells.as_slice()).chain(rows) {
            for (&e, &w) in cells.iter().zip(&widths) {
                if let Ok(mut n) = nodes.get_mut(e) {
                    n.width = px(w);
                    n.min_width = px(w);
                }
            }
        }
    }
}

/// Grows or shrinks each pool to its body's height (the M0.8 spike's open check 4).
fn resize_pools(mut commands: Commands, mut tables: Query<(Entity, &mut Table)>) {
    for (root, mut t) in &mut tables {
        if t.built_layout != t.layout {
            continue;
        }
        let want = pool_size(t.viewport, t.row_h);
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
            let node = commands
                .spawn((row_node(t.row_h), BackgroundColor(color::ROW[slot % 2])))
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
            let mut cells = Vec::with_capacity(t.shown.len());
            let mut texts = Vec::with_capacity(t.shown.len());
            for &col in &t.shown {
                let c = &t.model.columns[col];
                let text = commands
                    .spawn((
                        theme::text_line("", font::BODY, color::TEXT),
                        Pickable::IGNORE,
                    ))
                    .id();
                let cell = commands
                    .spawn((cell_node(c, t.widths[col]), LinkSlot(None)))
                    .add_child(text)
                    .id();
                commands.entity(node).add_child(cell);
                cells.push(cell);
                texts.push(text);
            }
            commands.entity(t.body).add_child(node);
            t.pool.push(PoolRow { node, cells, texts });
        }
    }
}

/// Scrolls the focused table from the keyboard (not while Ctrl or Alt is held: those are
/// workspace shortcuts, D453; not while the command bar has the keyboard).
fn keyboard_scroll(
    keys: Res<ButtonInput<KeyCode>>,
    capture: Res<KeyboardCapture>,
    focus: Res<TableFocus>,
    mut tables: Query<&mut Table>,
) {
    if capture.0 || crate::ui::modifier_held(&keys) {
        return;
    }
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

/// Rewrites the pooled cells, header and footer of tables that changed; only cells whose text,
/// color or link differs are written.
#[allow(clippy::type_complexity)]
fn redraw(
    tables: Query<&Table, Changed<Table>>,
    mut texts: Query<(&mut Text, &mut TextColor)>,
    mut backgrounds: Query<&mut BackgroundColor>,
    mut slots: Query<&mut LinkSlot>,
) {
    for t in &tables {
        if t.built_layout != t.layout {
            continue;
        }
        for (slot, row) in t.pool.iter().enumerate() {
            let pos = t.top + slot;
            let data = t.row_at(pos);
            for (i, &col) in t.shown.iter().enumerate() {
                let value = data.map_or("", |r| t.model.display(r, col));
                let cell = data.and_then(|r| t.model.get(r, col));
                let want_color = cell.and_then(Cell::color).unwrap_or(color::TEXT);
                if let Ok((mut text, mut tc)) = texts.get_mut(row.texts[i]) {
                    if text.0 != value {
                        value.clone_into(&mut text.0);
                    }
                    if tc.0 != want_color {
                        tc.0 = want_color;
                    }
                }
                let link = cell.and_then(Cell::link);
                if let Ok(mut s) = slots.get_mut(row.cells[i])
                    && s.0.as_ref() != link
                {
                    s.0 = link.cloned();
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
        for (i, &e) in t.header.iter().enumerate() {
            let col = t.shown[i];
            let c = &t.model.columns[col];
            let title = match t.sort {
                Some((s, true)) if s == col => format!("{} ^", c.title),
                Some((s, false)) if s == col => format!("{} v", c.title),
                _ => c.title.clone(),
            };
            if let Ok((mut text, _)) = texts.get_mut(e)
                && text.0 != title
            {
                text.0 = title;
            }
        }
    }
}

/// Writes each table's footer status line (a child text of the footer node) and shows its
/// column chooser when open.
fn redraw_footers(
    tables: Query<&Table, Changed<Table>>,
    children: Query<&Children>,
    mut texts: Query<&mut Text>,
    mut nodes: Query<&mut Node>,
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
        if let Some(&text) = children.get(t.footer).ok().and_then(|c| c.first())
            && let Ok(mut text) = texts.get_mut(text)
            && text.0 != status
        {
            text.0 = status;
        }
        let want = if t.chooser_open {
            Display::Flex
        } else {
            Display::None
        };
        if let Ok(mut n) = nodes.get_mut(t.chooser)
            && n.display != want
        {
            n.display = want;
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
            .init_resource::<KeyboardCapture>()
            .add_message::<TableRowClicked>()
            .add_systems(
                Update,
                (
                    measure_bodies,
                    configure_tables,
                    keyboard_scroll,
                    build_layouts,
                    resize_pools,
                    apply_widths,
                    (redraw, redraw_footers),
                    store_configs,
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
        app_with(Arc::new(model(rows)), None, UiConfig::default())
    }

    fn app_with(model: Arc<TableModel>, id: Option<&str>, cfg: UiConfig) -> (App, Entity) {
        let mut app = App::new();
        app.add_plugins((MinimalPlugins, bevy::input::InputPlugin, TablePlugin))
            .insert_resource(cfg);
        let parent = app.world_mut().spawn(Node::default()).id();
        let mut commands = app.world_mut().commands();
        let table = match id {
            Some(id) => spawn_table_with_id(&mut commands, parent, model, id),
            None => spawn_table(&mut commands, parent, model),
        };
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

    fn shown_titles(app: &App, table: Entity) -> Vec<String> {
        let t = app.world().get::<Table>(table).unwrap();
        t.header
            .iter()
            .map(|&e| app.world().get::<Text>(e).unwrap().0.clone())
            .collect()
    }

    /// Dragging a header (by its title) onto another moves the column; dragging a grip resizes
    /// and never moves; the events go in by hand (no window, so picking sends none).
    #[test]
    fn header_drag_moves_and_grip_drag_resizes() {
        use crate::test_support::{click, drag, drop_on};
        let (mut app, table) = app_with(Arc::new(model(20)), Some("drag"), UiConfig::default());
        set_height(&mut app, table, 110.0);
        let (cells, titles) = {
            let t = app.world().get::<Table>(table).unwrap();
            (t.header_cells.clone(), t.header.clone())
        };
        // The title takes no pointer, so a real drag starts on the cell; a drop naming the
        // title still resolves to its cell.
        assert_eq!(
            app.world().get::<Pickable>(titles[2]),
            Some(&Pickable::IGNORE)
        );
        app.world_mut().trigger(drop_on(cells[0], titles[2]));
        app.update();
        assert_eq!(shown_titles(&app, table), ["Money", "Id", "N"]);
        let (cells, grips) = {
            let t = app.world().get::<Table>(table).unwrap();
            let grips: Vec<Entity> = t
                .header_cells
                .iter()
                .map(|&c| {
                    app.world()
                        .get::<Children>(c)
                        .unwrap()
                        .iter()
                        .find(|&e| app.world().get::<ResizeGrip>(e).is_some())
                })
                .map(Option::unwrap)
                .collect();
            (t.header_cells.clone(), grips)
        };
        // Dropping a grip on a header moves nothing.
        app.world_mut().trigger(drop_on(cells[2], grips[0]));
        app.update();
        assert_eq!(shown_titles(&app, table), ["Money", "Id", "N"]);
        // Dragging the first grip 30 px right widens that column (Money: 90 to 120).
        app.world_mut()
            .trigger(drag(grips[0], Vec2::new(30.0, 0.0)));
        app.update();
        let t = app.world().get::<Table>(table).unwrap();
        assert_eq!(t.width(2), 120.0);
        let w = app.world().get::<Node>(t.header_cells[0]).unwrap().width;
        assert_eq!(w, px(120.0), "resized in place");
        // A click on the grip does not sort.
        let g = grips[0];
        app.world_mut().trigger(click(g, PointerButton::Primary));
        app.update();
        assert_eq!(app.world().get::<Table>(table).unwrap().sorted_by(), None);
        // A click on the header cell does.
        app.world_mut()
            .trigger(click(cells[1], PointerButton::Primary));
        app.update();
        assert_eq!(
            app.world().get::<Table>(table).unwrap().sorted_by(),
            Some((0, true))
        );
        let saved = &app.world().resource::<UiConfig>().tables["drag"];
        assert_eq!(saved.columns[0].key, "Money");
        assert_eq!(saved.columns[0].width, 120.0);
    }

    #[test]
    fn columns_hide_move_and_resize() {
        let (mut app, table) = app_with(Arc::new(model(50)), Some("demo"), UiConfig::default());
        set_height(&mut app, table, 110.0);
        assert_eq!(shown_titles(&app, table), ["Id", "N", "Money"]);
        {
            let mut t = app.world_mut().get_mut::<Table>(table).unwrap();
            assert!(t.set_column_visible(1, false));
            assert!(t.move_column(2, -5), "clamped to the front");
            assert!(t.set_width(0, 5.0));
            assert_eq!(t.width(0), COLUMN_WIDTH_MIN);
        }
        app.update();
        assert_eq!(shown_titles(&app, table), ["Money", "Id"]);
        {
            let t = app.world().get::<Table>(table).unwrap();
            assert_eq!(
                t.pool[0].texts.len(),
                2,
                "the pool was rebuilt for two columns"
            );
            let row = t.row_at(0).unwrap();
            let want = t.model().display(row, 2).to_owned();
            assert_eq!(app.world().get::<Text>(t.pool[0].texts[0]).unwrap().0, want);
            let w = app.world().get::<Node>(t.header_cells[1]).unwrap().width;
            assert_eq!(w, px(COLUMN_WIDTH_MIN));
        }
        {
            let mut t = app.world_mut().get_mut::<Table>(table).unwrap();
            assert!(!t.set_column_visible(2, true) || t.shown_columns().len() == 2);
            assert!(t.set_column_visible(0, false));
            assert!(
                !t.set_column_visible(2, false),
                "the last shown column stays"
            );
            t.move_column_to(1, 2);
            t.sort_with(2, false);
        }
        app.update();
        // The UI config holds the table's setup under its id.
        let saved = app.world().resource::<UiConfig>().tables["demo"].clone();
        let keys: Vec<(&str, bool)> = saved
            .columns
            .iter()
            .map(|c| (c.key.as_str(), c.visible))
            .collect();
        assert_eq!(keys, [("N", false), ("Money", true), ("Id", false)]);
        assert_eq!(
            saved.sort,
            Some(SortConfig {
                key: "Money".into(),
                ascending: false
            })
        );
        // A table spawned again with that id comes back the same way.
        let mut cfg = UiConfig::default();
        cfg.tables.insert("demo".into(), saved);
        let (mut app2, t2) = app_with(Arc::new(model(50)), Some("demo"), cfg);
        set_height(&mut app2, t2, 110.0);
        assert_eq!(shown_titles(&app2, t2), ["Money v"]);
        let t = app2.world().get::<Table>(t2).unwrap();
        assert_eq!(t.sorted_by(), Some((2, false)));
        assert_eq!(t.width(0), COLUMN_WIDTH_MIN);
        // Reset.
        app2.world_mut()
            .get_mut::<Table>(t2)
            .unwrap()
            .reset_columns();
        app2.update();
        assert_eq!(shown_titles(&app2, t2), ["Id", "N", "Money"]);
    }

    #[test]
    fn saved_configs_survive_model_changes() {
        // A config naming a column the model lost, and missing one it gained.
        let mut cfg = UiConfig::default();
        cfg.tables.insert(
            "x".into(),
            TableConfig {
                columns: vec![
                    ColumnConfig {
                        key: "Gone".into(),
                        visible: true,
                        width: 50.0,
                    },
                    ColumnConfig {
                        key: "Money".into(),
                        visible: true,
                        width: 120.0,
                    },
                    ColumnConfig {
                        key: "Id".into(),
                        visible: false,
                        width: 60.0,
                    },
                ],
                sort: Some(SortConfig {
                    key: "Gone".into(),
                    ascending: true,
                }),
            },
        );
        let (mut app, table) = app_with(Arc::new(model(20)), Some("x"), cfg);
        set_height(&mut app, table, 110.0);
        assert_eq!(shown_titles(&app, table), ["Money", "N"]);
        let t = app.world().get::<Table>(table).unwrap();
        assert_eq!(t.sorted_by(), None);
        assert_eq!(t.width(2), 120.0);
    }

    #[test]
    fn row_height_follows_density() {
        let (mut app, table) = app_with_table(500);
        set_height(&mut app, table, 220.0);
        assert_eq!(app.world().get::<Table>(table).unwrap().pool_len(), 10);
        app.world_mut().resource_mut::<UiConfig>().density = crate::config::Density::Compact;
        app.update();
        app.update();
        let t = app.world().get::<Table>(table).unwrap();
        assert_eq!(t.row_height(), 18.0);
        assert_eq!(t.pool_len(), 13, "220 / 18 rounded up");
        let row = t.pool[0].node;
        assert_eq!(app.world().get::<Node>(row).unwrap().height, px(18.0));
    }

    #[test]
    fn link_and_gain_cells_draw_their_color_and_target() {
        use crate::pages::PageRef;
        use sim::world::CompanyId;
        let rows = (0..5)
            .map(|i| {
                vec![
                    Cell::Link(PageRef::Company(CompanyId(i)), format!("Co {i}")),
                    Cell::Gain(i as f64 - 2.0, GainUnit::Percent),
                ]
            })
            .collect();
        let m = TableModel::new(
            vec![Column::text("Name", 100.0), Column::number("Chg", 60.0)],
            rows,
        );
        let (mut app, table) = app_with(Arc::new(m), None, UiConfig::default());
        set_height(&mut app, table, 110.0);
        let t = app.world().get::<Table>(table).unwrap();
        let (cells, texts) = (t.pool[0].cells.clone(), t.pool[0].texts.clone());
        assert_eq!(
            app.world().get::<LinkSlot>(cells[0]).unwrap().0,
            Some(PageRef::Company(CompanyId(0)))
        );
        assert_eq!(app.world().get::<LinkSlot>(cells[1]).unwrap().0, None);
        assert_eq!(
            app.world().get::<TextColor>(texts[0]).unwrap().0,
            color::LINK
        );
        assert_eq!(
            app.world().get::<TextColor>(texts[1]).unwrap().0,
            color::LOSS
        );
        let t4 = t.pool[4].texts[1];
        assert_eq!(app.world().get::<TextColor>(t4).unwrap().0, color::GAIN);
        assert_eq!(app.world().get::<Text>(t4).unwrap().0, "+200.0%");
    }
}
