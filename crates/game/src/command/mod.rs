//! The command bar (M9 A2; D455; 20-ui 20.5.2 command line): Ctrl+K or ` opens it over the
//! workspace. Type to fuzzy-search every named thing ([`index::NameIndex`]) and the workspace
//! commands; Up and Down pick, Enter opens in the focused pane, Shift+Enter in a new pane, Esc
//! closes. While it is open it has the keyboard ([`crate::ui::KeyboardCapture`]).
//!
//! Commands besides names:
//! - `TICKER Fn` (`ARDR F3`): full-screen Pdoomberg on that company's function page; a bare
//!   `F3` opens the page with no company. `PDB` opens Pdoomberg.
//! - `layout save NAME`, `layout NAME`, `layout delete NAME`: saved layouts.
//! - Workspace actions by name: split right or down, close pane, back, forward, density, font.

pub mod fuzzy;
pub mod index;

use bevy::input::ButtonState;
use bevy::input::keyboard::{Key, KeyboardInput};
use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use sim::world::CompanyId;

use crate::bridge::SimSystems;
use crate::config::{Density, UiConfig};
use crate::pages::{OpenPdoomberg, PageRef, PdbFunction};
use crate::ui::rail::{Navigate, Router, Screen};
use crate::ui::theme::{self, color, font, size};
use crate::ui::{KeyboardCapture, ShellLayout, SpawnLayout, UiSystems};
use crate::workspace::{Axis, OpenPage, OpenTarget, PaneAction};
use fuzzy::score;
use index::{NameIndex, refresh_index};

/// Results shown at most.
pub const MAX_RESULTS: usize = 14;

/// A workspace action the bar can run.
#[derive(Debug, Clone, PartialEq)]
pub enum BarAction {
    Pane(PaneAction),
    Density(Density),
    FontStep(i32),
    FontReset,
}

/// One result line.
#[derive(Debug, Clone, PartialEq)]
pub enum CommandItem {
    /// Open a page.
    Open(PageRef),
    /// Full-screen Pdoomberg on a function page (and a company).
    Pdoomberg {
        function: PdbFunction,
        company: Option<CompanyId>,
    },
    Action(String, BarAction),
}

/// The actions offered by name.
fn actions() -> Vec<(String, BarAction)> {
    vec![
        (
            "Split pane right".into(),
            BarAction::Pane(PaneAction::Split(None, Axis::Row)),
        ),
        (
            "Split pane down".into(),
            BarAction::Pane(PaneAction::Split(None, Axis::Column)),
        ),
        (
            "Close pane".into(),
            BarAction::Pane(PaneAction::Close(None)),
        ),
        ("Back".into(), BarAction::Pane(PaneAction::Back(None))),
        ("Forward".into(), BarAction::Pane(PaneAction::Forward(None))),
        (
            "Density compact".into(),
            BarAction::Density(Density::Compact),
        ),
        ("Density normal".into(), BarAction::Density(Density::Normal)),
        ("Font larger".into(), BarAction::FontStep(1)),
        ("Font smaller".into(), BarAction::FontStep(-1)),
        ("Font reset".into(), BarAction::FontReset),
    ]
}

/// The results for `query` (D455), best first: a Pdoomberg or layout command it spells, then
/// names and actions by fuzzy score.
pub fn resolve(query: &str, index: &NameIndex, cfg: &UiConfig) -> Vec<CommandItem> {
    let q = query.trim();
    if q.is_empty() {
        return Vec::new();
    }
    let mut out: Vec<CommandItem> = Vec::new();
    let words: Vec<&str> = q.split_whitespace().collect();
    // Pdoomberg: `TICKER Fn`, `Fn`, `PDB`.
    if let Some(f) = words.last().and_then(|w| PdbFunction::parse(w)) {
        match words.len() {
            1 => out.push(CommandItem::Pdoomberg {
                function: f,
                company: None,
            }),
            2 => {
                if let Some(id) = index.company_by_ticker(words[0]) {
                    out.push(CommandItem::Pdoomberg {
                        function: f,
                        company: Some(id),
                    });
                } else {
                    // Not a ticker: the companies whose name or ticker matches best.
                    for h in index.search(words[0], MAX_RESULTS) {
                        if let PageRef::Company(id) = index.entries()[h.entry].page {
                            out.push(CommandItem::Pdoomberg {
                                function: f,
                                company: Some(id),
                            });
                        }
                    }
                }
            }
            _ => {}
        }
    }
    if q.eq_ignore_ascii_case("pdb") || q.eq_ignore_ascii_case("pdoomberg") {
        out.push(CommandItem::Pdoomberg {
            function: PdbFunction::F2,
            company: None,
        });
    }
    // Layouts.
    if words
        .first()
        .is_some_and(|w| w.eq_ignore_ascii_case("layout"))
    {
        let rest: Vec<&str> = words[1..].to_vec();
        match rest.first().map(|w| w.to_ascii_lowercase()) {
            Some(w) if w == "save" && rest.len() > 1 => {
                let name = rest[1..].join(" ");
                out.push(CommandItem::Action(
                    format!("Save layout \"{name}\""),
                    BarAction::Pane(PaneAction::SaveLayout(name)),
                ));
            }
            Some(w) if w == "delete" && rest.len() > 1 => {
                let name = rest[1..].join(" ");
                if cfg.layouts.contains_key(&name) {
                    out.push(CommandItem::Action(
                        format!("Delete layout \"{name}\""),
                        BarAction::Pane(PaneAction::DeleteLayout(name)),
                    ));
                }
            }
            _ => {
                let name = rest.join(" ");
                for k in cfg.layouts.keys() {
                    if name.is_empty() || score(&name, k).is_some() {
                        out.push(CommandItem::Action(
                            format!("Load layout \"{k}\""),
                            BarAction::Pane(PaneAction::LoadLayout(k.clone())),
                        ));
                    }
                }
            }
        }
    }
    // Names and actions, merged by score (names first on a tie, then the index order, D2).
    let mut scored: Vec<(i32, usize, CommandItem)> = index
        .search(q, MAX_RESULTS)
        .into_iter()
        .map(|h| {
            (
                h.score,
                0,
                CommandItem::Open(index.entries()[h.entry].page.clone()),
            )
        })
        .collect();
    for (i, (label, a)) in actions().into_iter().enumerate() {
        if let Some(s) = score(q, &label) {
            scored.push((s, 1 + i, CommandItem::Action(label, a)));
        }
    }
    scored.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    out.extend(scored.into_iter().map(|(_, _, c)| c));
    out.truncate(MAX_RESULTS);
    out
}

/// The bar's state.
#[derive(Resource, Debug, Default)]
pub struct CommandBar {
    pub open: bool,
    pub query: String,
    pub selected: usize,
    pub items: Vec<CommandItem>,
    /// The query and index the items were resolved for.
    resolved_for: Option<String>,
    panel: Option<Entity>,
    backdrop: Option<Entity>,
    input: Option<Entity>,
    list: Option<Entity>,
    /// Redraw the result rows.
    dirty: bool,
}

impl CommandBar {
    /// Opens the bar, empty.
    pub fn open(&mut self) {
        self.open = true;
        self.query.clear();
        self.selected = 0;
        self.items.clear();
        self.resolved_for = None;
        self.dirty = true;
    }

    pub fn close(&mut self) {
        self.open = false;
        self.dirty = true;
    }

    /// Types `s` into the query.
    pub fn type_text(&mut self, s: &str) {
        for c in s.chars() {
            if c.is_ascii() && !c.is_ascii_control() {
                self.query.push(c);
            }
        }
        self.selected = 0;
    }
}

fn spawn_bar(mut commands: Commands, layout: Res<ShellLayout>, mut bar: ResMut<CommandBar>) {
    let backdrop = commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                left: px(0.0),
                right: px(0.0),
                top: px(0.0),
                bottom: px(0.0),
                display: Display::None,
                ..default()
            },
            BackgroundColor(Color::BLACK.with_alpha(0.35)),
            GlobalZIndex(118),
        ))
        .observe(|_: On<PointerClick>, mut bar: ResMut<CommandBar>| bar.close())
        .id();
    let input = commands
        .spawn(theme::text_line("> _", font::TITLE, color::TEXT))
        .id();
    let hint = commands
        .spawn(theme::text_line(
            "Names, tickers, `TICKER F3`, `layout save NAME`. Enter opens, Shift+Enter in a new \
             pane, Esc closes.",
            font::SMALL,
            color::TEXT_MUTED,
        ))
        .id();
    let list = commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            row_gap: px(1.0),
            ..default()
        })
        .id();
    let panel = commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                left: percent(22.0),
                right: percent(22.0),
                top: px(size::TOP_BAR + 24.0),
                flex_direction: FlexDirection::Column,
                row_gap: px(4.0),
                padding: UiRect::all(px(10.0)),
                border: UiRect::all(px(1.0)),
                display: Display::None,
                ..default()
            },
            BackgroundColor(color::PANEL_RAISED),
            BorderColor::all(color::CYAN),
            GlobalZIndex(120),
        ))
        .add_children(&[input, hint, list])
        .id();
    commands
        .entity(layout.root)
        .add_children(&[backdrop, panel]);
    bar.panel = Some(panel);
    bar.backdrop = Some(backdrop);
    bar.input = Some(input);
    bar.list = Some(list);
}

/// Opens, closes and types into the bar; runs before every other key handler and sets the
/// keyboard capture (D453). The frame that closes the bar still holds the capture, so its Esc or
/// Enter reaches nothing else.
#[allow(clippy::too_many_arguments)]
fn bar_keys(
    keys: Res<ButtonInput<KeyCode>>,
    mut typed: MessageReader<KeyboardInput>,
    mut bar: ResMut<CommandBar>,
    mut capture: ResMut<KeyboardCapture>,
    index: Res<NameIndex>,
    cfg: Res<UiConfig>,
    mut run: MessageWriter<RunCommand>,
) {
    capture.0 = bar.open;
    // Windows reports AltGr as Ctrl+Alt: with both held a key is text (@, {, ...), not a Ctrl
    // chord (D455).
    let alt = keys.any_pressed([KeyCode::AltLeft, KeyCode::AltRight]);
    let ctrl = keys.any_pressed([KeyCode::ControlLeft, KeyCode::ControlRight]) && !alt;
    let shift = keys.any_pressed([KeyCode::ShiftLeft, KeyCode::ShiftRight]);
    let toggle =
        (ctrl && keys.just_pressed(KeyCode::KeyK)) || keys.just_pressed(KeyCode::Backquote);
    if !bar.open {
        typed.clear();
        if toggle {
            bar.open();
            capture.0 = true;
        }
        return;
    }
    if toggle || keys.just_pressed(KeyCode::Escape) {
        typed.clear();
        bar.close();
        return;
    }
    let before = (bar.query.clone(), bar.selected);
    for ev in typed.read() {
        if ev.state != ButtonState::Pressed {
            continue;
        }
        // Keys that edit or move are matched by their physical code too (the text field is
        // ASCII, D302), so a layout without a Backspace logical key still edits.
        let backspace =
            ev.key_code == KeyCode::Backspace || matches!(ev.logical_key, Key::Backspace);
        let control = matches!(
            ev.key_code,
            KeyCode::Enter
                | KeyCode::NumpadEnter
                | KeyCode::Escape
                | KeyCode::Tab
                | KeyCode::ArrowUp
                | KeyCode::ArrowDown
                | KeyCode::Backquote
        );
        match &ev.logical_key {
            _ if backspace => {
                if ctrl {
                    bar.query.clear();
                } else {
                    bar.query.pop();
                }
                bar.selected = 0;
            }
            Key::Enter | Key::Escape | Key::Tab | Key::ArrowUp | Key::ArrowDown => {}
            _ if ctrl || control => {}
            _ => {
                if let Some(t) = &ev.text {
                    let t = t.to_string();
                    bar.type_text(&t);
                }
            }
        }
    }
    let n = bar.items.len();
    if keys.just_pressed(KeyCode::ArrowDown) && n > 0 {
        bar.selected = (bar.selected + 1) % n;
    }
    if keys.just_pressed(KeyCode::ArrowUp) && n > 0 {
        bar.selected = (bar.selected + n - 1) % n;
    }
    if bar.resolved_for.as_deref() != Some(bar.query.as_str()) || index.is_changed() {
        bar.items = resolve(&bar.query, &index, &cfg);
        bar.resolved_for = Some(bar.query.clone());
        bar.selected = bar.selected.min(bar.items.len().saturating_sub(1));
        bar.dirty = true;
    }
    if (bar.query.clone(), bar.selected) != before {
        bar.dirty = true;
    }
    if keys.any_just_pressed([KeyCode::Enter, KeyCode::NumpadEnter])
        && let Some(item) = bar.items.get(bar.selected).cloned()
    {
        run.write(RunCommand {
            item,
            new_pane: shift,
        });
        bar.close();
    }
}

/// Runs a chosen result.
#[derive(Message, Debug, Clone, PartialEq)]
pub struct RunCommand {
    pub item: CommandItem,
    pub new_pane: bool,
}

fn run_commands(
    mut msgs: MessageReader<RunCommand>,
    router: Res<Router>,
    mut open: MessageWriter<OpenPage>,
    mut pdb: MessageWriter<OpenPdoomberg>,
    mut nav: MessageWriter<Navigate>,
    mut actions: MessageWriter<PaneAction>,
    mut cfg: ResMut<UiConfig>,
) {
    for RunCommand { item, new_pane } in msgs.read() {
        match item {
            CommandItem::Open(page) => {
                if router.current == Screen::Pdoomberg {
                    nav.write(Navigate(Screen::Map));
                }
                open.write(OpenPage {
                    page: page.clone(),
                    target: if *new_pane {
                        OpenTarget::NewPane
                    } else {
                        OpenTarget::Focused
                    },
                });
            }
            CommandItem::Pdoomberg { function, company } => {
                pdb.write(OpenPdoomberg {
                    function: *function,
                    company: *company,
                });
            }
            CommandItem::Action(_, a) => match a {
                BarAction::Pane(p) => {
                    actions.write(p.clone());
                }
                BarAction::Density(d) => cfg.density = *d,
                BarAction::FontStep(s) => cfg.step_font(*s),
                BarAction::FontReset => cfg.font_scale = 1.0,
            },
        }
    }
}

/// A result row.
#[derive(Component, Debug, Clone, Copy)]
pub struct ResultRow(pub usize);

/// The label, kind tag and detail of an item.
pub fn item_text(item: &CommandItem, index: &NameIndex) -> (String, String, String) {
    match item {
        CommandItem::Open(p) => {
            let detail = index.entry(p).map_or(String::new(), |e| {
                let alias = e
                    .alias
                    .as_deref()
                    .map_or(String::new(), |a| format!("{a}  "));
                format!("{alias}{}", e.detail)
            });
            (index.title(p), p.kind().tag().to_owned(), detail)
        }
        CommandItem::Pdoomberg { function, company } => {
            let who = company.map_or(String::new(), |c| {
                let p = PageRef::Company(c);
                let t = index.entry(&p).and_then(|e| e.alias.clone());
                format!("{} ", t.unwrap_or_else(|| index.title(&p)))
            });
            (
                format!("{who}{} {}", function.code(), function.name()),
                "PDB".to_owned(),
                "Pdoomberg, full screen".to_owned(),
            )
        }
        CommandItem::Action(label, _) => (label.clone(), ">".to_owned(), "Command".to_owned()),
    }
}

fn draw_bar(
    mut commands: Commands,
    mut bar: ResMut<CommandBar>,
    index: Res<NameIndex>,
    mut nodes: Query<&mut Node>,
    mut texts: Query<&mut Text>,
) {
    if !bar.dirty {
        return;
    }
    bar.dirty = false;
    let shown = if bar.open {
        Display::Flex
    } else {
        Display::None
    };
    for e in [bar.panel, bar.backdrop].into_iter().flatten() {
        if let Ok(mut n) = nodes.get_mut(e) {
            n.display = shown;
        }
    }
    if let Some(mut t) = bar.input.and_then(|e| texts.get_mut(e).ok()) {
        t.0 = format!("> {}_", bar.query);
    }
    let Some(list) = bar.list else {
        return;
    };
    commands.entity(list).despawn_children();
    if !bar.open {
        return;
    }
    if bar.items.is_empty() && !bar.query.trim().is_empty() {
        let e = commands.spawn(theme::muted("No match.")).id();
        commands.entity(list).add_child(e);
    }
    for (i, item) in bar.items.iter().enumerate() {
        let (label, tag, detail) = item_text(item, &index);
        let selected = i == bar.selected;
        let row = commands
            .spawn((
                ResultRow(i),
                Node {
                    flex_direction: FlexDirection::Row,
                    column_gap: px(8.0),
                    padding: UiRect::axes(px(4.0), px(1.0)),
                    ..default()
                },
                BackgroundColor(if selected {
                    color::CYAN.with_alpha(0.18)
                } else {
                    Color::NONE
                }),
                Hovered::default(),
            ))
            .observe(
                move |ev: On<PointerClick>,
                      mut bar: ResMut<CommandBar>,
                      keys: Res<ButtonInput<KeyCode>>,
                      mut run: MessageWriter<RunCommand>| {
                    let shift = keys.any_pressed([KeyCode::ShiftLeft, KeyCode::ShiftRight]);
                    if let Some(item) = bar.items.get(i).cloned() {
                        run.write(RunCommand {
                            item,
                            new_pane: shift || ev.button == PointerButton::Middle,
                        });
                    }
                    bar.close();
                },
            )
            .id();
        let tag = commands
            .spawn((
                Node {
                    width: px(44.0),
                    min_width: px(44.0),
                    ..default()
                },
                children![theme::text_line(
                    format!("[{tag}]"),
                    font::SMALL,
                    color::TEXT_MUTED
                )],
            ))
            .id();
        let name = commands
            .spawn(theme::text_line(
                label,
                font::BODY,
                if selected { color::CYAN } else { color::TEXT },
            ))
            .id();
        let det = commands
            .spawn(theme::text_line(detail, font::SMALL, color::TEXT_MUTED))
            .id();
        commands.entity(row).add_children(&[tag, name, det]);
        commands.entity(list).add_child(row);
    }
}

pub struct CommandPlugin;

impl Plugin for CommandPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<CommandBar>()
            .init_resource::<NameIndex>()
            .init_resource::<KeyboardCapture>()
            .add_message::<RunCommand>()
            .add_systems(Startup, spawn_bar.after(SpawnLayout))
            .add_systems(
                Update,
                (refresh_index, bar_keys, run_commands)
                    .chain()
                    .after(SimSystems::SyncViews)
                    .in_set(UiSystems::Capture),
            )
            .add_systems(Update, draw_bar.in_set(UiSystems::Show));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::model::{SavedLayout, SavedNode};

    fn index() -> NameIndex {
        let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
        let sim = sim::Sim::new(data, 1).unwrap();
        NameIndex::build(sim.views())
    }

    #[test]
    fn pdoomberg_commands_resolve() {
        let idx = index();
        let cfg = UiConfig::default();
        // A real ticker from the starting data.
        let (ticker, id) = idx
            .entries()
            .iter()
            .find_map(|e| match (&e.page, &e.alias) {
                (PageRef::Company(id), Some(t)) if !t.is_empty() => Some((t.clone(), *id)),
                _ => None,
            })
            .expect("a listed company");
        let items = resolve(&format!("{} f3", ticker.to_lowercase()), &idx, &cfg);
        assert_eq!(
            items[0],
            CommandItem::Pdoomberg {
                function: PdbFunction::F3,
                company: Some(id)
            }
        );
        let items = resolve("F10", &idx, &cfg);
        assert_eq!(
            items[0],
            CommandItem::Pdoomberg {
                function: PdbFunction::F10,
                company: None
            }
        );
        assert!(matches!(
            resolve("pdb", &idx, &cfg)[0],
            CommandItem::Pdoomberg { company: None, .. }
        ));
        // The ticker alone opens the company page first.
        let items = resolve(&ticker, &idx, &cfg);
        assert_eq!(items[0], CommandItem::Open(PageRef::Company(id)));
    }

    #[test]
    fn names_and_actions_resolve() {
        let idx = index();
        let cfg = UiConfig::default();
        assert!(resolve("", &idx, &cfg).is_empty());
        assert!(resolve("   ", &idx, &cfg).is_empty());
        let items = resolve("split right", &idx, &cfg);
        assert_eq!(
            items[0],
            CommandItem::Action(
                "Split pane right".into(),
                BarAction::Pane(PaneAction::Split(None, Axis::Row))
            )
        );
        assert_eq!(
            resolve("industries", &idx, &cfg)[0],
            CommandItem::Open(PageRef::Industries)
        );
        assert_eq!(
            resolve("settings", &idx, &cfg)[0],
            CommandItem::Open(PageRef::Settings)
        );
        let n = resolve("a", &idx, &cfg).len();
        assert_eq!(n, MAX_RESULTS, "capped");
    }

    #[test]
    fn layout_commands_resolve() {
        let idx = index();
        let mut cfg = UiConfig::default();
        let items = resolve("layout save Trading desk", &idx, &cfg);
        assert_eq!(
            items[0],
            CommandItem::Action(
                "Save layout \"Trading desk\"".into(),
                BarAction::Pane(PaneAction::SaveLayout("Trading desk".into()))
            )
        );
        cfg.layouts.insert(
            "Trading desk".into(),
            SavedLayout {
                root: SavedNode::Pane {
                    page: PageRef::World,
                },
                focused: 0,
            },
        );
        let items = resolve("layout trad", &idx, &cfg);
        assert_eq!(
            items[0],
            CommandItem::Action(
                "Load layout \"Trading desk\"".into(),
                BarAction::Pane(PaneAction::LoadLayout("Trading desk".into()))
            )
        );
        assert!(matches!(
            &resolve("layout delete Trading desk", &idx, &cfg)[0],
            CommandItem::Action(_, BarAction::Pane(PaneAction::DeleteLayout(_)))
        ));
    }
}
