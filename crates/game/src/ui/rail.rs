//! The left rail and the screen router (build-plan M7.8; spec 8 main screen; 20-ui 20.2.2,
//! 20.2.4). The rail opens Company, Industries, Pdoomberg, Recap and News; each opens in panel
//! slot 1 over the map, except Pdoomberg, which covers the whole main area. Esc closes the open
//! screen. Panels never pause the game (20.2.4).

use bevy::prelude::*;

use super::theme::{self, ButtonLook, Tooltip, color, font};
use super::{OpenMenu, ShellLayout, SpawnLayout, UiSystems};

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

/// The open screen.
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

/// Opens a screen; opening the open one closes it (back to the map). `Map` closes any screen.
#[derive(Message, Debug, Clone, Copy, PartialEq, Eq)]
pub struct Navigate(pub Screen);

/// The root node of a screen; shown only while the router is on it.
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
                    (show_screens, mark_rail).run_if(resource_changed::<Router>),
                )
                    .chain()
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
                Tooltip(format!("{} ({})", screen.name(), screen.key_name())),
            ))
            .observe(
                move |_: On<PointerClick>, mut nav: MessageWriter<Navigate>| {
                    nav.write(Navigate(screen));
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
            children![theme::text("Esc\nmap", font::SMALL, color::TEXT_MUTED)],
        ))
        .id();
    commands.entity(layout.rail).add_child(hint);
}

/// Screen keys (O, U, B, R, N) and Esc: Esc closes an open menu first, then the open screen
/// (20-ui 20.2.6).
fn route_keys(
    keys: Res<ButtonInput<KeyCode>>,
    router: Res<Router>,
    mut menu: ResMut<OpenMenu>,
    mut nav: MessageWriter<Navigate>,
) {
    for screen in Screen::RAIL {
        if screen.key().is_some_and(|k| keys.just_pressed(k)) {
            nav.write(Navigate(screen));
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

fn apply_navigation(mut msgs: MessageReader<Navigate>, mut router: ResMut<Router>) {
    for Navigate(screen) in msgs.read() {
        let next = if *screen == router.current {
            Screen::Map
        } else {
            *screen
        };
        if router.current != next {
            router.current = next;
        }
    }
}

/// Shows the open screen. The map's screen stays under panels; Pdoomberg covers it.
fn show_screens(router: Res<Router>, mut roots: Query<(&ScreenRoot, &mut Node)>) {
    for (root, mut node) in &mut roots {
        let shown = match root.0 {
            Screen::Map => !router.current.is_full_screen(),
            s => s == router.current,
        };
        let want = if shown { Display::Flex } else { Display::None };
        if node.display != want {
            node.display = want;
        }
    }
}

fn mark_rail(router: Res<Router>, mut buttons: Query<(&RailButton, &mut ButtonLook)>) {
    for (b, mut look) in &mut buttons {
        let active = b.0 == router.current;
        if look.active != active {
            look.active = active;
        }
    }
}
