//! The left rail and the screen router (build-plan M7.8; spec 8 main screen; 20-ui 20.2.2;
//! M9 A2, D451). The rail opens Company, Industries, Recap and News as pages in the focused
//! workspace pane (Shift: a new pane), and Pdoomberg as the full-screen terminal over the
//! workspace (B toggles it, Esc closes it). Pages never pause the game (20.2.4).

use bevy::prelude::*;

use super::theme::{self, ButtonLook, Tooltip, color, font};
use super::{KeyboardCapture, OpenMenu, ShellLayout, SpawnLayout, UiSystems, modifier_held};
use crate::bridge::Views;
use crate::pages::{OpenPdoomberg, PdoombergRoute};
use crate::workspace::{OpenPage, OpenTarget, Workspace, page_screen, screen_page};

/// The screens of spec 8 the shell routes between.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Screen {
    /// No panel open: the map (M8) and, until then, the province table demo.
    Map,
    Company,
    Industries,
    Pdoomberg,
    Recap,
    News,
}

impl Screen {
    /// The rail's screens, top to bottom (spec 8; D303 adds News).
    pub const RAIL: [Screen; 5] = [
        Screen::Company,
        Screen::Industries,
        Screen::Pdoomberg,
        Screen::Recap,
        Screen::News,
    ];

    pub fn name(self) -> &'static str {
        match self {
            Screen::Map => "Map",
            Screen::Company => "Company",
            Screen::Industries => "Industries",
            Screen::Pdoomberg => "Pdoomberg",
            Screen::Recap => "Quarterly recap",
            Screen::News => "News feed",
        }
    }

    /// The rail label (the font has no icons, so a short tag stands in, D302).
    pub fn tag(self) -> &'static str {
        match self {
            Screen::Map => "MAP",
            Screen::Company => "CO",
            Screen::Industries => "IND",
            Screen::Pdoomberg => "PDB",
            Screen::Recap => "RCP",
            Screen::News => "NEWS",
        }
    }

    /// The shortcut key (20-ui 20.2.2: O, U, B, N; D303: R for the recap).
    pub fn key(self) -> Option<KeyCode> {
        match self {
            Screen::Map => None,
            Screen::Company => Some(KeyCode::KeyO),
            Screen::Industries => Some(KeyCode::KeyU),
            Screen::Pdoomberg => Some(KeyCode::KeyB),
            Screen::Recap => Some(KeyCode::KeyR),
            Screen::News => Some(KeyCode::KeyN),
        }
    }

    pub fn key_name(self) -> &'static str {
        match self {
            Screen::Map => "Esc",
            Screen::Company => "O",
            Screen::Industries => "U",
            Screen::Pdoomberg => "B",
            Screen::Recap => "R",
            Screen::News => "N",
        }
    }

    /// Pdoomberg is a full-screen terminal, not a panel (20.2.2, 20.5.2).
    pub fn is_full_screen(self) -> bool {
        self == Screen::Pdoomberg
    }
}
/// What covers the main area: the workspace ([`Screen::Map`]) or full-screen Pdoomberg.
#[derive(Resource, Debug, Clone, Copy, PartialEq, Eq)]
pub struct Router {
    pub current: Screen,
}

impl Default for Router {
    fn default() -> Self {
        Router {
            current: Screen::Map,
        }
    }
}

/// Opens a rail screen (D451): Pdoomberg toggles full screen; `Map` closes it; the others open
/// their page in the focused pane (and leave Pdoomberg).
#[derive(Message, Debug, Clone, Copy, PartialEq, Eq)]
pub struct Navigate(pub Screen);

/// The root node of a full-screen screen (Pdoomberg); shown only while the router is on it.
#[derive(Component, Debug, Clone, Copy)]
pub struct ScreenRoot(pub Screen);

/// A rail button.
#[derive(Component, Debug, Clone, Copy)]
struct RailButton(Screen);

pub struct RouterPlugin;

impl Plugin for RouterPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<Router>()
            .init_resource::<OpenMenu>()
            .add_message::<Navigate>()
            .add_systems(Startup, spawn_rail.after(SpawnLayout))
            .add_systems(
                Update,
                (
                    route_keys,
                    apply_navigation,
                    open_pdoomberg,
                    show_screens.run_if(resource_changed::<Router>),
                    mark_rail
                        .run_if(resource_changed::<Router>.or_eager(resource_changed::<Workspace>)),
                )
                    .chain()
                    .before(crate::workspace::WorkspaceInput)
                    .in_set(UiSystems::Input),
            );
    }
}

fn spawn_rail(mut commands: Commands, layout: Res<ShellLayout>) {
    for screen in Screen::RAIL {
        let label = commands
            .spawn((
                theme::button(screen.tag(), color::CYAN),
                RailButton(screen),
                Tooltip(format!(
                    "{} ({}{})",
                    screen.name(),
                    screen.key_name(),
                    if screen.is_full_screen() {
                        ""
                    } else {
                        "; Shift+click or Shift+key: new pane"
                    }
                )),
            ))
            .observe(
                move |ev: On<PointerClick>,
                      keys: Res<ButtonInput<KeyCode>>,
                      views: Res<Views>,
                      mut nav: MessageWriter<Navigate>,
                      mut open: MessageWriter<OpenPage>| {
                    let shift = keys.any_pressed([KeyCode::ShiftLeft, KeyCode::ShiftRight]);
                    let new_pane = shift || ev.button == PointerButton::Middle;
                    match screen_page(screen, &views) {
                        Some(page) if new_pane => {
                            nav.write(Navigate(Screen::Map));
                            open.write(OpenPage {
                                page,
                                target: OpenTarget::NewPane,
                            });
                        }
                        _ => {
                            nav.write(Navigate(screen));
                        }
                    }
                },
            )
            .id();
        commands.entity(layout.rail).add_child(label);
    }
    let hint = commands
        .spawn((
            Node {
                margin: UiRect::top(Val::Auto),
                ..default()
            },
            children![theme::text(
                "Ctrl+K\nsearch",
                font::SMALL,
                color::TEXT_MUTED
            )],
        ))
        .id();
    commands.entity(layout.rail).add_child(hint);
}

/// Screen keys (O, U, B, R, N; with Shift a new pane) and Esc: Esc closes an open menu first,
/// then Pdoomberg (20-ui 20.2.6). Not while the command bar has the keyboard or Ctrl or Alt is
/// held (D453).
fn route_keys(
    keys: Res<ButtonInput<KeyCode>>,
    capture: Res<KeyboardCapture>,
    router: Res<Router>,
    views: Res<Views>,
    mut menu: ResMut<OpenMenu>,
    mut nav: MessageWriter<Navigate>,
    mut open: MessageWriter<OpenPage>,
) {
    if capture.0 || modifier_held(&keys) {
        return;
    }
    let shift = keys.any_pressed([KeyCode::ShiftLeft, KeyCode::ShiftRight]);
    for screen in Screen::RAIL {
        if screen.key().is_some_and(|k| keys.just_pressed(k)) {
            match screen_page(screen, &views) {
                Some(page) if shift => {
                    nav.write(Navigate(Screen::Map));
                    open.write(OpenPage {
                        page,
                        target: OpenTarget::NewPane,
                    });
                }
                _ => {
                    nav.write(Navigate(screen));
                }
            }
        }
    }
    if keys.just_pressed(KeyCode::Escape) {
        if menu.0.is_some() {
            menu.0 = None;
        } else if router.current != Screen::Map {
            nav.write(Navigate(Screen::Map));
        }
    }
}

fn apply_navigation(
    mut msgs: MessageReader<Navigate>,
    mut router: ResMut<Router>,
    views: Res<Views>,
    mut open: MessageWriter<OpenPage>,
) {
    for Navigate(screen) in msgs.read() {
        let next = match screen {
            Screen::Pdoomberg if router.current == Screen::Pdoomberg => Screen::Map,
            Screen::Pdoomberg => Screen::Pdoomberg,
            s => {
                if let Some(page) = screen_page(*s, &views).filter(|_| *s != Screen::Map) {
                    open.write(OpenPage::focused(page));
                }
                Screen::Map
            }
        };
        if router.current != next {
            router.current = next;
        }
    }
}

/// Full-screen Pdoomberg on a function page and company (the command bar's `ARDR F3`). Lane B2
/// draws the F-key pages from [`PdoombergRoute`].
fn open_pdoomberg(
    mut msgs: MessageReader<OpenPdoomberg>,
    mut router: ResMut<Router>,
    mut route: ResMut<PdoombergRoute>,
) {
    for m in msgs.read() {
        let want = PdoombergRoute {
            function: m.function,
            company: m.company,
        };
        if *route != want {
            *route = want;
        }
        if router.current != Screen::Pdoomberg {
            router.current = Screen::Pdoomberg;
        }
    }
}

/// Shows the open full-screen screen.
fn show_screens(router: Res<Router>, mut roots: Query<(&ScreenRoot, &mut Node)>) {
    for (root, mut node) in &mut roots {
        let want = if root.0 == router.current {
            Display::Flex
        } else {
            Display::None
        };
        if node.display != want {
            node.display = want;
        }
    }
}

/// Marks Pdoomberg while it is open, else the rail screen of the focused pane's page.
fn mark_rail(
    router: Res<Router>,
    ws: Res<Workspace>,
    mut buttons: Query<(&RailButton, &mut ButtonLook)>,
) {
    let on = if router.current == Screen::Pdoomberg {
        Some(Screen::Pdoomberg)
    } else {
        ws.page(ws.focused()).and_then(|p| page_screen(p.kind()))
    };
    for (b, mut look) in &mut buttons {
        let active = Some(b.0) == on;
        if look.active != active {
            look.active = active;
        }
    }
}
