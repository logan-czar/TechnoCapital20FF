//! Live widgets and filters for the market and world pages (M9 B2; D510, D511).
//!
//! A page built once ([`super::Refresh::Manual`]) keeps its tables, charts and text lines up to
//! date with a [`Live`] component: it names the views it reads, and when one of their versions
//! moves (or its [`Filter`] changes, or the runner controls do) its model is made again from the
//! views and handed to the widget ([`Table::set_model`], [`Chart::set_model`], or the text). The
//! widget keeps its scroll, sort and hover, which a page rebuild would lose. A model is always
//! made from the views (spec 9): the closure reads [`LiveCtx`] and nothing else.
//!
//! A [`Filter`] holds a page's picks (an industry, a company, a watchlist). [`spawn_picker`]
//! draws one as a label with its current value; a click lists the options as chips, and a chip
//! sets the filter of the widget it serves.

use std::collections::BTreeMap;
use std::sync::Arc;

use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use sim::SimViews;
use sim::time::control::Controls;
use sim::views::Cadence;

use super::{ViewKey, view_meta};
use crate::bridge::{RunnerControls, Views};
use crate::chart::{Chart, ChartModel};
use crate::command::index::NameIndex;
use crate::table::{Table, TableModel};
use crate::ui::UiSystems;
use crate::ui::theme::{self, Tooltip, color, font};

/// A filter value: 0 is "all"; any other value is the pick's own code (an id plus one, D511).
pub type Pick = u64;

/// A page's picks, by key ("industry", "company", "list", ...). A key not set is 0, "all".
#[derive(Component, Debug, Clone, Default, PartialEq, Eq)]
pub struct Filter(pub BTreeMap<&'static str, Pick>);

impl Filter {
    pub fn get(&self, key: &str) -> Pick {
        self.0.get(key).copied().unwrap_or(0)
    }

    pub fn set(&mut self, key: &'static str, v: Pick) {
        if v == 0 {
            self.0.remove(key);
        } else {
            self.0.insert(key, v);
        }
    }

    pub fn with(mut self, key: &'static str, v: Pick) -> Filter {
        self.set(key, v);
        self
    }

    /// The pick of `key` as an id (`v - 1`), or `None` for "all".
    pub fn id(&self, key: &str) -> Option<u32> {
        self.get(key).checked_sub(1).map(|v| v as u32)
    }
}

/// What a live widget's closure reads: the views, the name index, the runner controls (the
/// watchlist and the Omniscient flag) and the widget's filter.
pub struct LiveCtx<'a> {
    pub views: &'a SimViews,
    pub index: &'a NameIndex,
    pub controls: &'a Controls,
    pub filter: &'a Filter,
}

/// A model a live widget shows.
pub enum LiveModel {
    Table(TableModel),
    Chart(ChartModel),
    Text(String),
}

pub type LiveFn = Box<dyn Fn(&LiveCtx) -> LiveModel + Send + Sync>;

/// Remakes its widget's model when its views, filter or (with `controls`) the runner controls
/// change.
#[derive(Component)]
pub struct Live {
    deps: Vec<ViewKey>,
    versions: Vec<u64>,
    /// Also remake when the runner controls change (the watchlist, Omniscient).
    controls: bool,
    /// The least real time between two remakes when only every-tick views (v_quotes) moved: at
    /// speed they move every frame (D510).
    min_secs: f64,
    last: f64,
    /// A remake is owed (it was held back by `min_secs`).
    owed: bool,
    /// Held: its page is hidden (full-screen Pdoomberg closed, D520), so it is not remade.
    held: bool,
    /// Just let go: remake at once, whatever moved while it was held.
    woke: bool,
    make: LiveFn,
}

impl Live {
    pub fn new(
        deps: &[ViewKey],
        make: impl Fn(&LiveCtx) -> LiveModel + Send + Sync + 'static,
    ) -> Live {
        Live {
            deps: deps.to_vec(),
            versions: Vec::new(),
            controls: false,
            min_secs: 0.0,
            last: f64::NEG_INFINITY,
            owed: false,
            held: false,
            woke: false,
            make: Box::new(make),
        }
    }

    pub fn on_controls(mut self) -> Live {
        self.controls = true;
        self
    }

    pub fn throttle(mut self, secs: f64) -> Live {
        self.min_secs = secs;
        self
    }

    pub fn is_held(&self) -> bool {
        self.held
    }

    /// Holds the widget (its page is hidden) or lets it go; let go, it remakes its model at once.
    pub fn hold(&mut self, held: bool) {
        self.woke = self.held && !held;
        self.held = held;
    }

    /// Makes the model now (the page's first build), and remembers the views it was made from.
    pub fn first(&mut self, ctx: &LiveCtx) -> LiveModel {
        self.versions = self
            .deps
            .iter()
            .map(|&k| view_meta(ctx.views, k).1)
            .collect();
        (self.make)(ctx)
    }
}

/// The context of the resources a page builder has.
pub fn ctx<'a>(
    views: &'a Views,
    index: &'a NameIndex,
    controls: &'a RunnerControls,
    filter: &'a Filter,
) -> LiveCtx<'a> {
    LiveCtx {
        views,
        index,
        controls,
        filter,
    }
}

/// Spawns a live table under `parent` (with its saved setup under `id`) and its filter.
#[allow(clippy::too_many_arguments)]
pub fn spawn_live_table(
    commands: &mut Commands,
    parent: Entity,
    id: &str,
    mut live: Live,
    filter: Filter,
    views: &Views,
    index: &NameIndex,
    controls: &RunnerControls,
) -> Entity {
    let model = match live.first(&ctx(views, index, controls, &filter)) {
        LiveModel::Table(m) => m,
        _ => TableModel::new(Vec::new(), Vec::new()),
    };
    let t = crate::table::spawn_table_with_id(commands, parent, Arc::new(model), id);
    commands.entity(t).insert((live, filter));
    t
}

/// Spawns a live chart under `parent`.
pub fn spawn_live_chart(
    commands: &mut Commands,
    parent: Entity,
    mut live: Live,
    views: &Views,
    index: &NameIndex,
    controls: &RunnerControls,
) -> Entity {
    let filter = Filter::default();
    let model = match live.first(&ctx(views, index, controls, &filter)) {
        LiveModel::Chart(m) => m,
        _ => ChartModel::default(),
    };
    let c = crate::chart::spawn_chart(commands, parent, Arc::new(model));
    commands.entity(c).insert((live, filter));
    c
}

/// Spawns a live text line under `parent`.
#[allow(clippy::too_many_arguments)]
pub fn spawn_live_text(
    commands: &mut Commands,
    parent: Entity,
    size: f32,
    c: Color,
    mut live: Live,
    views: &Views,
    index: &NameIndex,
    controls: &RunnerControls,
) -> Entity {
    let filter = Filter::default();
    let s = match live.first(&ctx(views, index, controls, &filter)) {
        LiveModel::Text(s) => s,
        _ => String::new(),
    };
    let e = commands.spawn((theme::text(s, size, c), live, filter)).id();
    commands.entity(parent).add_child(e);
    e
}

/// Remakes the models of live widgets whose views, filter or controls moved.
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
fn refresh_live(
    views: Res<Views>,
    index: Res<NameIndex>,
    controls: Res<RunnerControls>,
    time: Res<Time<Real>>,
    mut q: Query<(Entity, &mut Live, Ref<Filter>)>,
    mut tables: Query<&mut Table>,
    mut charts: Query<&mut Chart>,
    mut texts: Query<&mut Text>,
) {
    let now = time.elapsed_secs_f64();
    let moved = views.is_changed() || index.is_changed();
    for (e, mut live, filter) in &mut q {
        if live.held {
            continue;
        }
        let woke = std::mem::take(&mut live.woke);
        let filtered = filter.is_changed() && !filter.is_added();
        let versions: Vec<u64> = if moved || live.owed || woke {
            live.deps.iter().map(|&k| view_meta(&views, k).1).collect()
        } else {
            Vec::new()
        };
        let stale = (moved || live.owed || woke) && versions != live.versions;
        if live.owed && !stale && !moved {
            live.owed = false;
        }
        let ctl = live.controls && controls.is_changed() && !controls.is_added();
        if !(stale || filtered || ctl || woke) {
            continue;
        }
        // A filter or control change shows at once, and so does a move of a view slower than
        // every tick; a move of only every-tick views (v_quotes) waits out the throttle.
        let fast_only = stale
            && live
                .deps
                .iter()
                .zip(versions.iter().zip(&live.versions))
                .filter(|(_, (a, b))| a != b)
                .all(|(&k, _)| view_meta(&views, k).2 == Cadence::EveryTick);
        if !(filtered || ctl || woke) && fast_only && now - live.last < live.min_secs {
            live.owed = true;
            continue;
        }
        live.owed = false;
        live.last = now;
        if !versions.is_empty() {
            live.versions = versions;
        }
        let model = (live.make)(&ctx(&views, &index, &controls, &filter));
        match model {
            LiveModel::Table(m) => {
                if let Ok(mut t) = tables.get_mut(e)
                    && *t.model() != m
                {
                    t.set_model(Arc::new(m));
                }
            }
            LiveModel::Chart(m) => {
                if let Ok(mut c) = charts.get_mut(e)
                    && *c.model() != m
                {
                    c.set_model(Arc::new(m));
                }
            }
            LiveModel::Text(s) => {
                if let Ok(mut t) = texts.get_mut(e)
                    && t.0 != s
                {
                    t.0 = s;
                }
            }
        }
    }
}

/// How a picker is drawn: the workspace's colors or the terminal's.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PickerLook {
    pub label: Color,
    pub value: Color,
    pub option: Color,
    pub selected: Color,
    pub panel: Color,
}

impl PickerLook {
    pub const PAGE: PickerLook = PickerLook {
        label: color::TEXT_MUTED,
        value: color::CYAN,
        option: color::LINK,
        selected: color::CYAN,
        panel: color::PANEL_RAISED,
    };
    pub const TERMINAL: PickerLook = PickerLook {
        label: color::TERMINAL_TEXT,
        value: color::TEXT,
        option: color::TERMINAL_TEXT,
        selected: color::TEXT,
        panel: Color::srgb(0.10, 0.07, 0.0),
    };
}

/// A picker's state, on its root.
#[derive(Component, Debug, Clone)]
pub struct Picker {
    pub key: &'static str,
    /// The widget whose [`Filter`] it sets.
    pub target: Entity,
    pub options: Vec<(String, Pick)>,
    value_text: Entity,
    panel: Entity,
    look: PickerLook,
}

impl Picker {
    /// The options' panel (its children are the [`PickerOption`] chips).
    pub fn panel(&self) -> Entity {
        self.panel
    }
}

/// The text of a picker's chip: its option label.
#[derive(Component, Debug, Clone, Copy)]
pub struct PickerOption(pub Pick);

/// Spawns a picker under `parent` for `key` of `target`'s filter: "Industry: All v". A click
/// opens the options (the first is "All", value 0) as a wrapping row of chips below it; a chip
/// sets the filter and closes them.
#[allow(clippy::too_many_arguments)]
pub fn spawn_picker(
    commands: &mut Commands,
    parent: Entity,
    label: &str,
    key: &'static str,
    options: Vec<(String, Pick)>,
    target: Entity,
    current: Pick,
    look: PickerLook,
) -> Entity {
    let shown = options
        .iter()
        .find(|(_, v)| *v == current)
        .map_or("All".to_owned(), |(l, _)| l.clone());
    let value_text = commands
        .spawn(theme::text_line(
            format!("{shown} v"),
            font::SMALL,
            look.value,
        ))
        .id();
    let label_text = commands
        .spawn(theme::text_line(
            format!("{label}:"),
            font::SMALL,
            look.label,
        ))
        .id();
    let head = commands
        .spawn((
            Node {
                flex_direction: FlexDirection::Row,
                column_gap: px(4.0),
                padding: UiRect::horizontal(px(4.0)),
                border: UiRect::all(px(1.0)),
                ..default()
            },
            BorderColor::all(look.label.with_alpha(0.5)),
            Hovered::default(),
            Tooltip(format!("Filter by {}", label.to_lowercase())),
        ))
        .add_children(&[label_text, value_text])
        .id();
    let panel = commands
        .spawn((
            Node {
                flex_direction: FlexDirection::Row,
                flex_wrap: FlexWrap::Wrap,
                column_gap: px(8.0),
                row_gap: px(2.0),
                padding: UiRect::all(px(4.0)),
                display: Display::None,
                max_width: px(900.0),
                ..default()
            },
            BackgroundColor(look.panel),
        ))
        .id();
    let root = commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            row_gap: px(2.0),
            ..default()
        })
        .add_children(&[head, panel])
        .id();
    commands.entity(parent).add_child(root);
    for (text, v) in &options {
        let v = *v;
        let chip = commands
            .spawn((
                PickerOption(v),
                theme::text_line(
                    text.clone(),
                    font::SMALL,
                    if v == current {
                        look.selected
                    } else {
                        look.option
                    },
                ),
                Hovered::default(),
            ))
            .observe(
                move |mut ev: On<PointerClick>,
                      mut pickers: Query<&mut Picker>,
                      mut filters: Query<&mut Filter>,
                      mut texts: Query<&mut Text>,
                      mut nodes: Query<&mut Node>| {
                    ev.propagate(false);
                    if ev.button != PointerButton::Primary {
                        return;
                    }
                    let Ok(p) = pickers.get_mut(root) else {
                        return;
                    };
                    pick(&p, v, &mut filters, &mut texts, &mut nodes);
                },
            )
            .id();
        commands.entity(panel).add_child(chip);
    }
    commands.entity(head).observe(
        move |mut ev: On<PointerClick>, pickers: Query<&Picker>, mut nodes: Query<&mut Node>| {
            ev.propagate(false);
            if let Ok(p) = pickers.get(root)
                && let Ok(mut n) = nodes.get_mut(p.panel)
            {
                n.display = if n.display == Display::None {
                    Display::Flex
                } else {
                    Display::None
                };
            }
        },
    );
    commands.entity(root).insert(Picker {
        key,
        target,
        options,
        value_text,
        panel,
        look,
    });
    root
}

/// Applies a pick: sets the filter, writes the shown value and closes the options.
pub fn pick(
    p: &Picker,
    v: Pick,
    filters: &mut Query<&mut Filter>,
    texts: &mut Query<&mut Text>,
    nodes: &mut Query<&mut Node>,
) {
    if let Ok(mut f) = filters.get_mut(p.target)
        && f.get(p.key) != v
    {
        f.set(p.key, v);
    }
    let shown = p
        .options
        .iter()
        .find(|(_, o)| *o == v)
        .map_or("All".to_owned(), |(l, _)| l.clone());
    if let Ok(mut t) = texts.get_mut(p.value_text) {
        t.0 = format!("{shown} v");
    }
    if let Ok(mut n) = nodes.get_mut(p.panel) {
        n.display = Display::None;
    }
}

/// Recolors pickers' chips to show the current pick.
fn mark_picks(
    pickers: Query<&Picker>,
    filters: Query<&Filter, Changed<Filter>>,
    children: Query<&Children>,
    mut chips: Query<(&PickerOption, &mut TextColor)>,
) {
    for p in &pickers {
        let Ok(f) = filters.get(p.target) else {
            continue;
        };
        let cur = f.get(p.key);
        let Ok(kids) = children.get(p.panel) else {
            continue;
        };
        for &c in kids {
            if let Ok((o, mut tc)) = chips.get_mut(c) {
                let want = if o.0 == cur {
                    p.look.selected
                } else {
                    p.look.option
                };
                if tc.0 != want {
                    tc.0 = want;
                }
            }
        }
    }
}

pub struct LivePlugin;

impl Plugin for LivePlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (refresh_live, mark_picks).chain().in_set(UiSystems::Show),
        );
    }
}
