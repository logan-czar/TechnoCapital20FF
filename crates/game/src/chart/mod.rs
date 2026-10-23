//! The chart widget (build-plan M9.1; D457): lines, bars and daily candles with an estimated
//! fair value band, a 10-year view in weekly bars, gridlines with value labels and a hover
//! readout. Drawn with plain bevy_ui nodes: each primitive ([`data::Prim`]) is an absolutely
//! placed node from a pool (a line segment is a thin node turned with `UiTransform`), so the
//! chart needs no Bevy feature beyond `ui_api` and `ui_bevy_render`, renders with the rest of
//! the UI, and is tested headless. 10 years of weekly candles is about 1,600 nodes.
//!
//! **Using it (Phase B):** build a [`ChartModel`] from a view (never compute in the page; the
//! series come ready), spawn it with [`spawn_chart`] into a page section, and give it a new model
//! with [`Chart::set_model`] when the view moves. The chart fills its parent's width and grows
//! to the height it is given (at least [`MIN_PLOT_HEIGHT`]).

pub mod data;

use std::sync::Arc;

use bevy::prelude::*;

pub use data::{ChartModel, Ohlc, Series, ValueFormat, primitives, ten_year_view, weekly};
use data::{Prim, Scale, readout, slot_at};

use crate::ui::UiSystems;
use crate::ui::theme::{self, color, font};

/// The plot's least height in logical pixels.
pub const MIN_PLOT_HEIGHT: f32 = 140.0;
/// Gridlines aimed for.
pub const GRIDLINES: usize = 4;
/// Room on the plot's right for the gridline labels.
pub const AXIS_LABEL_WIDTH: f32 = 64.0;

/// A chart widget, on its root node.
#[derive(Component, Debug)]
pub struct Chart {
    model: Arc<ChartModel>,
    rev: u64,
    drawn_rev: u64,
    plot: Entity,
    title: Entity,
    readout: Entity,
    cross: Entity,
    /// The plot's size in logical pixels (from layout, or a test).
    size: Vec2,
    drawn_size: Vec2,
    pool: Vec<Entity>,
    /// Primitives in use at the last draw.
    used: usize,
    grid: Vec<(Entity, Entity)>,
    scale: Option<Scale>,
    hover: Option<usize>,
    drawn_hover: Option<Option<usize>>,
}

impl Chart {
    pub fn model(&self) -> &ChartModel {
        &self.model
    }

    /// Replaces what the chart shows.
    pub fn set_model(&mut self, model: Arc<ChartModel>) {
        self.model = model;
        self.rev += 1;
    }

    /// Sets the plot's size in logical pixels (tests; layout does it in the app).
    pub fn set_size(&mut self, size: Vec2) {
        self.size = size;
    }

    /// Primitives drawn at the last draw.
    pub fn drawn_primitives(&self) -> usize {
        self.used
    }

    pub fn hover(&self) -> Option<usize> {
        self.hover
    }

    /// Hovers slot `i` (tests; the pointer does it in the app).
    pub fn set_hover(&mut self, i: Option<usize>) {
        self.hover = i;
    }
}

/// Marks a chart's plot node.
#[derive(Component)]
struct ChartPlot(Entity);

/// Spawns a chart under `parent`.
pub fn spawn_chart(commands: &mut Commands, parent: Entity, model: Arc<ChartModel>) -> Entity {
    let title = commands
        .spawn(theme::text_line(
            model.title.clone(),
            font::BODY,
            color::CYAN,
        ))
        .id();
    let readout_e = commands
        .spawn(theme::text_line("", font::SMALL, color::TEXT_MUTED))
        .id();
    let head = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            column_gap: px(10.0),
            align_items: AlignItems::Baseline,
            overflow: Overflow::clip(),
            ..default()
        })
        .add_children(&[title, readout_e])
        .id();
    let root = commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            flex_grow: 1.0,
            min_height: px(MIN_PLOT_HEIGHT + 20.0),
            row_gap: px(2.0),
            ..default()
        })
        .id();
    let cross = commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                width: px(1.0),
                top: px(0.0),
                bottom: px(0.0),
                display: Display::None,
                ..default()
            },
            BackgroundColor(color::TEXT_MUTED.with_alpha(0.6)),
            Pickable::IGNORE,
            ZIndex(5),
        ))
        .id();
    let plot = commands
        .spawn((
            ChartPlot(root),
            Node {
                flex_grow: 1.0,
                min_height: px(MIN_PLOT_HEIGHT),
                margin: UiRect::right(px(AXIS_LABEL_WIDTH)),
                border: UiRect::all(px(1.0)),
                overflow: Overflow::visible(),
                ..default()
            },
            BorderColor::all(color::BORDER),
            BackgroundColor(color::BG),
        ))
        .add_child(cross)
        .id();
    commands.entity(root).add_children(&[head, plot]);
    commands.entity(parent).add_child(root);
    commands.entity(root).insert(Chart {
        model,
        rev: 1,
        drawn_rev: 0,
        plot,
        title,
        readout: readout_e,
        cross,
        size: Vec2::ZERO,
        drawn_size: Vec2::ZERO,
        pool: Vec::new(),
        used: 0,
        grid: Vec::new(),
        scale: None,
        hover: None,
        drawn_hover: None,
    });
    root
}

fn measure_plots(
    plots: Query<(&ChartPlot, &ComputedNode), Changed<ComputedNode>>,
    mut charts: Query<&mut Chart>,
) {
    for (p, n) in &plots {
        if n.size.x <= 0.0 {
            // Not laid out (headless, or hidden): keep the last size.
            continue;
        }
        // Inside the 1 px border.
        let s = (n.size * n.inverse_scale_factor - Vec2::splat(2.0)).max(Vec2::ZERO);
        if let Ok(mut c) = charts.get_mut(p.0)
            && (c.size - s).length() > 0.5
        {
            c.size = s;
        }
    }
}

fn prim_node(p: &Prim) -> (Node, UiTransform, Color) {
    match *p {
        Prim::Rect { x, y, w, h, color } => (
            Node {
                position_type: PositionType::Absolute,
                left: px(x),
                top: px(y),
                width: px(w),
                height: px(h),
                display: Display::Flex,
                ..default()
            },
            UiTransform::IDENTITY,
            color,
        ),
        Prim::Segment {
            x1,
            y1,
            x2,
            y2,
            width,
            color,
        } => {
            let (dx, dy) = (x2 - x1, y2 - y1);
            let len = (dx * dx + dy * dy).sqrt().max(1.0);
            let (mx, my) = ((x1 + x2) / 2.0, (y1 + y2) / 2.0);
            (
                Node {
                    position_type: PositionType::Absolute,
                    left: px(mx - len / 2.0),
                    top: px(my - width / 2.0),
                    width: px(len),
                    height: px(width),
                    display: Display::Flex,
                    ..default()
                },
                // Screen y grows downward, so atan2(dy, dx) is the clockwise turn.
                UiTransform::from_rotation(Rot2::radians(dy.atan2(dx))),
                color,
            )
        }
    }
}

/// Adds `nodes` to the chart's `plot` if the plot still exists when the commands apply, and
/// despawns them otherwise (D804): a page rebuilt in this frame despawns its charts with their
/// plots, but the despawn is a command not yet applied, so [`draw_charts`] may still see the
/// chart and draw into it.
fn adopt<const N: usize>(commands: &mut Commands, plot: Entity, nodes: [Entity; N]) {
    commands.queue(move |world: &mut World| {
        if let Ok(mut p) = world.get_entity_mut(plot) {
            p.add_children(&nodes);
        } else {
            for e in nodes {
                if let Ok(n) = world.get_entity_mut(e) {
                    n.despawn();
                }
            }
        }
    });
}

/// Redraws charts whose model or size changed: primitives onto pooled nodes (extra nodes are
/// hidden, never despawned while the chart lives), gridlines and their labels.
fn draw_charts(
    mut commands: Commands,
    mut charts: Query<&mut Chart>,
    mut nodes: Query<(&mut Node, &mut UiTransform, &mut BackgroundColor)>,
    mut texts: Query<&mut Text>,
    mut stats: Option<ResMut<crate::pages::PageStats>>,
) {
    for mut c in &mut charts {
        if c.drawn_rev == c.rev && c.drawn_size == c.size {
            continue;
        }
        if let Some(st) = stats.as_mut() {
            st.chart_draws += 1;
        }
        c.drawn_rev = c.rev;
        c.drawn_size = c.size;
        c.drawn_hover = None;
        let (prims, scale) = primitives(&c.model, c.size.x, c.size.y);
        c.scale = scale;
        let plot = c.plot;
        while c.pool.len() < prims.len() {
            let e = commands
                .spawn((
                    Node {
                        position_type: PositionType::Absolute,
                        display: Display::None,
                        ..default()
                    },
                    UiTransform::IDENTITY,
                    BackgroundColor(Color::NONE),
                    Pickable::IGNORE,
                ))
                .id();
            adopt(&mut commands, plot, [e]);
            c.pool.push(e);
        }
        // Only what moved is written (D774): a redraw at a new close moves few primitives,
        // and an unchanged node is not laid out or extracted again.
        let mut wrote = 0u64;
        for (i, p) in prims.iter().enumerate() {
            let (n, t, col) = prim_node(p);
            let e = c.pool[i];
            if let Ok((mut node, mut tr, mut bg)) = nodes.get_mut(e) {
                let a = node.set_if_neq(n);
                let b = tr.set_if_neq(t);
                let d = bg.set_if_neq(BackgroundColor(col));
                wrote += u64::from(a || b || d);
            } else {
                wrote += 1;
                // Spawned this frame: its components arrive with the commands.
                commands.entity(e).try_insert((n, t, BackgroundColor(col)));
            }
        }
        for &e in &c.pool[prims.len()..] {
            if let Ok((mut node, _, _)) = nodes.get_mut(e)
                && node.display != Display::None
            {
                node.display = Display::None;
            }
        }
        c.used = prims.len();
        if let Some(st) = stats.as_mut() {
            st.chart_prim_writes += wrote;
        }
        // Gridlines and value labels.
        let ticks = scale.map_or_else(Vec::new, |s| s.ticks(GRIDLINES));
        while c.grid.len() < ticks.len() {
            let line = commands
                .spawn((
                    Node {
                        position_type: PositionType::Absolute,
                        left: px(0.0),
                        right: px(0.0),
                        height: px(1.0),
                        display: Display::None,
                        ..default()
                    },
                    UiTransform::IDENTITY,
                    BackgroundColor(color::BORDER.with_alpha(0.7)),
                    Pickable::IGNORE,
                ))
                .id();
            let label = commands
                .spawn((
                    theme::text_line("", font::SMALL, color::TEXT_MUTED),
                    Node {
                        position_type: PositionType::Absolute,
                        display: Display::None,
                        ..default()
                    },
                    UiTransform::IDENTITY,
                    BackgroundColor(Color::NONE),
                    Pickable::IGNORE,
                ))
                .id();
            adopt(&mut commands, plot, [line, label]);
            c.grid.push((line, label));
        }
        let fmt = c.model.format;
        let w = c.size.x;
        for (i, &(line, label)) in c.grid.iter().enumerate() {
            let tick = ticks.get(i).copied();
            let y = tick.zip(scale).map(|(v, s)| s.y(v));
            let display = if y.is_some() {
                Display::Flex
            } else {
                Display::None
            };
            if let Ok((mut n, _, _)) = nodes.get_mut(line) {
                let want = Node {
                    display,
                    top: px(y.unwrap_or(0.0)),
                    ..n.clone()
                };
                n.set_if_neq(want);
            }
            if let Ok((mut n, _, _)) = nodes.get_mut(label) {
                let want = Node {
                    display,
                    left: px(w + 6.0),
                    top: px(y.unwrap_or(0.0) - 7.0),
                    ..n.clone()
                };
                n.set_if_neq(want);
            }
            if let (Some(v), Ok(mut t)) = (tick, texts.get_mut(label)) {
                let s = fmt.fmt(v);
                if t.0 != s {
                    t.0 = s;
                }
            }
        }
        let title = c.model.title.clone();
        if let Ok(mut t) = texts.get_mut(c.title)
            && t.0 != title
        {
            t.0 = title;
        }
    }
}

/// The pointer's slot over each plot.
fn hover_charts(
    windows: Query<&Window>,
    plots: Query<(&ChartPlot, &ComputedNode, &UiGlobalTransform)>,
    mut charts: Query<&mut Chart>,
) {
    // With no window (headless tests) the hover is left to `Chart::set_hover`.
    let Some(window) = windows.iter().next() else {
        return;
    };
    let cursor = window.physical_cursor_position();
    for (p, node, tr) in &plots {
        let Ok(mut c) = charts.get_mut(p.0) else {
            continue;
        };
        let n = c.model.slots();
        let slot = cursor
            .and_then(|at| node.normalize_point(*tr, at))
            .filter(|v| v.x.abs() <= 0.5 && v.y.abs() <= 0.5)
            .and_then(|v| slot_at((v.x + 0.5) * c.size.x, c.size.x, n));
        if c.hover != slot {
            c.hover = slot;
        }
    }
}

/// The readout and crosshair: the hovered slot, else the last one.
fn show_readouts(
    mut charts: Query<&mut Chart>,
    mut texts: Query<&mut Text>,
    mut nodes: Query<&mut Node>,
) {
    for mut c in &mut charts {
        if c.drawn_hover == Some(c.hover) {
            continue;
        }
        c.drawn_hover = Some(c.hover);
        let n = c.model.slots();
        let shown = c.hover.or(n.checked_sub(1));
        let s = shown.map_or(String::new(), |i| readout(&c.model, i));
        if let Ok(mut t) = texts.get_mut(c.readout)
            && t.0 != s
        {
            t.0 = s;
        }
        if let Ok(mut node) = nodes.get_mut(c.cross) {
            match c.hover {
                Some(i) if n > 0 => {
                    node.display = Display::Flex;
                    node.left = px(c.size.x * (i as f32 + 0.5) / n as f32);
                }
                _ => node.display = Display::None,
            }
        }
    }
}

pub struct ChartPlugin;

impl Plugin for ChartPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (measure_plots, hover_charts, draw_charts, show_readouts)
                .chain()
                .in_set(UiSystems::Show),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::UiConfig;
    use crate::ui::KeyboardCapture;
    use sim::time::Date;

    fn app() -> App {
        let mut app = App::new();
        app.add_plugins(MinimalPlugins)
            .init_resource::<UiConfig>()
            .init_resource::<KeyboardCapture>()
            .add_plugins(ChartPlugin);
        app
    }

    fn candles(n: i64) -> Vec<Ohlc> {
        (0..n)
            .map(|i| {
                let p = 10.0 + (i % 13) as f64;
                Ohlc {
                    date: Date::ymd(2020, 1, 1).add_days(i),
                    open: p,
                    high: p + 1.0,
                    low: p - 1.0,
                    close: p + if i % 2 == 0 { 0.5 } else { -0.5 },
                    band: Some((p * 0.85, p * 1.15)),
                }
            })
            .collect()
    }

    /// D804: a chart whose page is despawned in the frame it draws (the despawn queued ahead of
    /// its redraw, with no sync point between) neither panics nor leaves its new nodes behind.
    #[test]
    fn a_chart_despawned_in_the_frame_it_draws_leaves_nothing() {
        #[derive(Resource)]
        struct Doomed(Entity);
        let mut app = app();
        app.edit_schedule(Update, |s| {
            s.set_build_settings(bevy::ecs::schedule::ScheduleBuildSettings {
                auto_insert_apply_deferred: false,
                ..default()
            });
        });
        app.add_systems(
            Update,
            (|mut commands: Commands, doomed: Res<Doomed>| {
                commands.entity(doomed.0).despawn();
            })
            .before(draw_charts),
        );
        let parent = app.world_mut().spawn(Node::default()).id();
        let model = Arc::new(ChartModel::candles("x", ten_year_view(&candles(400))));
        let chart = {
            let mut commands = app.world_mut().commands();
            spawn_chart(&mut commands, parent, model)
        };
        app.world_mut().flush();
        app.world_mut().insert_resource(Doomed(chart));
        app.world_mut()
            .get_mut::<Chart>(chart)
            .unwrap()
            .set_size(Vec2::new(800.0, 260.0));
        app.update();
        assert!(app.world().get_entity(chart).is_err());
        let nodes = app.world_mut().query::<&Node>().iter(app.world()).count();
        assert_eq!(
            nodes, 1,
            "only the parent is left: the new nodes went with the chart"
        );
    }

    #[test]
    fn pool_draws_and_shrinks() {
        let mut app = app();
        let parent = app.world_mut().spawn(Node::default()).id();
        let model = Arc::new(ChartModel::candles("x", ten_year_view(&candles(3_653))));
        let chart = {
            let mut commands = app.world_mut().commands();
            spawn_chart(&mut commands, parent, model)
        };
        app.world_mut().flush();
        app.world_mut()
            .get_mut::<Chart>(chart)
            .unwrap()
            .set_size(Vec2::new(800.0, 260.0));
        app.update();
        app.update();
        let c = app.world().get::<Chart>(chart).unwrap();
        let weeks = c.model().slots();
        assert_eq!(c.drawn_primitives(), 3 * weeks);
        let plot = c.plot;
        let shown = app
            .world()
            .get::<Children>(plot)
            .unwrap()
            .iter()
            .filter(|&e| {
                app.world()
                    .get::<Node>(e)
                    .is_some_and(|n| n.display != Display::None)
            })
            .count();
        assert!(shown >= 3 * weeks, "{shown} nodes shown for {weeks} weeks");
        // A 20-quarter bar chart reuses the pool and hides the rest.
        let bars = Arc::new(ChartModel {
            title: "20Q".into(),
            labels: (0..20).map(|i| format!("{i}")).collect(),
            series: vec![Series::Bars {
                name: "g".into(),
                values: (0..20).map(|i| i as f64).collect(),
                color: None,
            }],
            format: ValueFormat::Number,
            ..default()
        });
        let pool = c.pool.len();
        app.world_mut()
            .get_mut::<Chart>(chart)
            .unwrap()
            .set_model(bars);
        app.update();
        let c = app.world().get::<Chart>(chart).unwrap();
        assert_eq!(c.drawn_primitives(), 20);
        assert_eq!(c.pool.len(), pool, "the pool is kept");
        let hidden = c.pool[20..]
            .iter()
            .filter(|&&e| app.world().get::<Node>(e).unwrap().display == Display::None)
            .count();
        assert_eq!(hidden, pool - 20);
        let readout = c.readout;
        assert_eq!(app.world().get::<Text>(readout).unwrap().0, "19  g 19.00");
        // Hovering slot 3 moves the readout and the crosshair.
        app.world_mut()
            .get_mut::<Chart>(chart)
            .unwrap()
            .set_hover(Some(3));
        app.update();
        let c = app.world().get::<Chart>(chart).unwrap();
        assert_eq!(app.world().get::<Text>(c.readout).unwrap().0, "3  g 3.00");
        let cross = app.world().get::<Node>(c.cross).unwrap();
        assert_eq!(cross.display, Display::Flex);
        assert_eq!(cross.left, px(800.0 * 3.5 / 20.0));
    }
}
