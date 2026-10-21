//! The one style file every screen uses (build-plan M7.4; spec 8; 11-ui 11.4, 20-ui 20.1):
//! neon-on-dark color tokens, font sizes, spacing, and the bundles for text, panels, buttons,
//! tooltips and the "Read-only MVP" lock.
//!
//! Font: the default font compiled into Bevy (Fira Mono), a monospace face that suits the
//! terminal look and keeps number columns aligned (D302). It covers ASCII, so labels stay ASCII.

use bevy::picking::hover::Hovered;
use bevy::prelude::*;

/// Color tokens. The four neon accents carry meaning (11.4): cyan money and gains, magenta alerts
/// and losses, amber warnings, green health and growth.
pub mod color {
    use bevy::prelude::Color;

    /// Near-black background (11.4).
    pub const BG: Color = Color::srgb(0.043, 0.051, 0.071); // #0B0D12
    /// Panel grey (11.4).
    pub const PANEL: Color = Color::srgb(0.086, 0.102, 0.133); // #161A22
    /// Raised panel: headers, hovered rows, buttons.
    pub const PANEL_RAISED: Color = Color::srgb(0.118, 0.141, 0.188); // #1E2430
    /// Hovered button.
    pub const HOVER: Color = Color::srgb(0.165, 0.196, 0.251); // #2A3240
    /// Hairlines between areas.
    pub const BORDER: Color = Color::srgb(0.165, 0.196, 0.251); // #2A3240
    /// Off-white text (11.4).
    pub const TEXT: Color = Color::srgb(0.902, 0.910, 0.933); // #E6E8EE
    /// Secondary text; still WCAG AA on BG and PANEL.
    pub const TEXT_MUTED: Color = Color::srgb(0.553, 0.596, 0.682); // #8D98AE
    /// Money and gains.
    pub const CYAN: Color = Color::srgb(0.0, 0.898, 1.0); // #00E5FF
    /// Alerts and losses.
    pub const MAGENTA: Color = Color::srgb(1.0, 0.169, 0.839); // #FF2BD6
    /// Warnings.
    pub const AMBER: Color = Color::srgb(1.0, 0.690, 0.0); // #FFB000
    /// Health and growth.
    pub const GREEN: Color = Color::srgb(0.224, 1.0, 0.533); // #39FF88
    /// Pdoomberg, the one exception to the look: a retro terminal (20.1, 20.5.2).
    pub const TERMINAL_BG: Color = Color::srgb(0.0, 0.0, 0.0);
    pub const TERMINAL_TEXT: Color = AMBER;
    /// Table rows, alternating.
    pub const ROW: [Color; 2] = [PANEL, Color::srgb(0.106, 0.125, 0.161)]; // #161A22, #1B2029
}

/// Font sizes in logical pixels.
pub mod font {
    pub const SMALL: f32 = 12.0;
    pub const BODY: f32 = 14.0;
    pub const TITLE: f32 = 18.0;
    pub const HERO: f32 = 26.0;
}

/// Layout sizes in logical pixels.
pub mod size {
    pub const TOP_BAR: f32 = 44.0;
    pub const RAIL: f32 = 64.0;
    /// The outliner, about 15% of the width (20.2.3 (T)).
    pub const OUTLINER_PCT: f32 = 15.0;
    pub const OUTLINER_MIN: f32 = 220.0;
    /// Panel slot 1, about 40% of the width (20.2.1).
    pub const PANEL_PCT: f32 = 42.0;
    pub const GAP: f32 = 6.0;
    pub const PAD: f32 = 10.0;
    pub const RADIUS: f32 = 3.0;
    /// One table row.
    pub const ROW: f32 = 22.0;
}

/// A text node.
pub fn text(s: impl Into<String>, size: f32, color: Color) -> impl Bundle {
    (
        Text::new(s),
        TextFont::from_font_size(FontSize::Px(size)),
        TextColor(color),
        Pickable::IGNORE,
    )
}

/// Body text in the default color.
pub fn body(s: impl Into<String>) -> impl Bundle {
    text(s, font::BODY, color::TEXT)
}

/// Small secondary text.
pub fn muted(s: impl Into<String>) -> impl Bundle {
    text(s, font::SMALL, color::TEXT_MUTED)
}

/// A panel title.
pub fn title(s: impl Into<String>) -> impl Bundle {
    text(s, font::TITLE, color::CYAN)
}

/// A panel: grey box with a hairline border, laid out as a column.
pub fn panel(node: Node) -> impl Bundle {
    (
        Node {
            flex_direction: FlexDirection::Column,
            padding: UiRect::all(px(size::PAD)),
            row_gap: px(size::GAP),
            border: UiRect::all(px(1.0)),
            ..node
        },
        BackgroundColor(color::PANEL),
        BorderColor::all(color::BORDER),
    )
}

/// How a button is drawn; [`ButtonLook::active`] marks the selected one of a group (the speed
/// picked, the open screen). Colors follow hover through [`Hovered`].
#[derive(Component, Debug, Clone, Copy, PartialEq)]
pub struct ButtonLook {
    pub active: bool,
    /// The accent used when active.
    pub accent: Color,
}

impl ButtonLook {
    pub fn new(accent: Color) -> ButtonLook {
        ButtonLook {
            active: false,
            accent,
        }
    }
}

/// A clickable button with a text label. Add behavior with `.observe(|_: On<PointerClick>| ..)`.
pub fn button(label: impl Into<String>, accent: Color) -> impl Bundle {
    (
        Node {
            padding: UiRect::axes(px(8.0), px(3.0)),
            border: UiRect::all(px(1.0)),
            border_radius: BorderRadius::all(px(size::RADIUS)),
            justify_content: JustifyContent::Center,
            align_items: AlignItems::Center,
            min_width: px(24.0),
            ..default()
        },
        BackgroundColor(color::PANEL_RAISED),
        BorderColor::all(color::BORDER),
        ButtonLook::new(accent),
        Hovered::default(),
        children![body(label)],
    )
}

/// Buttons whose hover or active flag changed.
type ChangedButtons<'w, 's> = Query<
    'w,
    's,
    (
        &'static ButtonLook,
        &'static Hovered,
        &'static mut BackgroundColor,
        &'static mut BorderColor,
    ),
    Or<(Changed<ButtonLook>, Changed<Hovered>)>,
>;

/// Recolors buttons when hover or the active flag changes.
pub fn restyle_buttons(mut q: ChangedButtons) {
    for (look, hovered, mut bg, mut border) in &mut q {
        let (b, e) = if look.active {
            (look.accent.with_alpha(0.25), look.accent)
        } else if hovered.get() {
            (color::HOVER, color::TEXT_MUTED)
        } else {
            (color::PANEL_RAISED, color::BORDER)
        };
        bg.0 = b;
        *border = BorderColor::all(e);
    }
}

/// A hover hint: shown in the floating tooltip while the pointer is over the entity.
#[derive(Component, Debug, Clone, PartialEq)]
pub struct Tooltip(pub String);

/// The floating tooltip panel.
#[derive(Component)]
pub struct TooltipPanel;

/// Spawns the one tooltip panel, hidden.
pub fn spawn_tooltip(mut commands: Commands) {
    commands.spawn((
        TooltipPanel,
        Node {
            position_type: PositionType::Absolute,
            display: Display::None,
            padding: UiRect::axes(px(8.0), px(5.0)),
            border: UiRect::all(px(1.0)),
            max_width: px(420.0),
            ..default()
        },
        BackgroundColor(color::PANEL_RAISED),
        BorderColor::all(color::CYAN),
        GlobalZIndex(100),
        Pickable::IGNORE,
        children![text("", font::SMALL, color::TEXT)],
    ));
}

/// Shows the tooltip of whatever is hovered, next to the cursor.
pub fn show_tooltip(
    hovered: Query<(&Tooltip, &Hovered)>,
    windows: Query<&Window>,
    mut panel: Query<(&mut Node, &Children), With<TooltipPanel>>,
    mut texts: Query<&mut Text>,
) {
    let Ok((mut node, children)) = panel.single_mut() else {
        return;
    };
    let cursor = windows.iter().find_map(Window::cursor_position);
    let tip = hovered.iter().find(|(_, h)| h.get()).map(|(t, _)| t);
    match (tip, cursor) {
        (Some(tip), Some(at)) if !tip.0.is_empty() => {
            node.display = Display::Flex;
            node.left = px(at.x + 14.0);
            node.top = px(at.y + 18.0);
            if let Some(mut t) = children.first().and_then(|&c| texts.get_mut(c).ok())
                && t.0 != tip.0
            {
                t.0.clone_from(&tip.0);
            }
        }
        _ => {
            if node.display != Display::None {
                node.display = Display::None;
            }
        }
    }
}

/// The lock shown in place of every action button (spec 8: "Every action button is hidden or
/// shows a lock icon with 'Read-only MVP'"). The icon is drawn from two nodes, a shackle and a
/// body, since the font has no lock glyph.
pub fn read_only_lock() -> impl Bundle {
    (
        Node {
            flex_direction: FlexDirection::Row,
            align_items: AlignItems::Center,
            column_gap: px(6.0),
            padding: UiRect::axes(px(8.0), px(3.0)),
            border: UiRect::all(px(1.0)),
            border_radius: BorderRadius::all(px(size::RADIUS)),
            align_self: AlignSelf::FlexStart,
            ..default()
        },
        BorderColor::all(color::AMBER.with_alpha(0.6)),
        Tooltip("Actions are locked: the MVP is read-only (spec 8).".into()),
        Hovered::default(),
        children![
            lock_icon(),
            text("Read-only MVP", font::SMALL, color::AMBER)
        ],
    )
}

fn lock_icon() -> impl Bundle {
    (
        Node {
            flex_direction: FlexDirection::Column,
            align_items: AlignItems::Center,
            ..default()
        },
        Pickable::IGNORE,
        children![
            (
                Node {
                    width: px(8.0),
                    height: px(6.0),
                    border: UiRect {
                        left: px(2.0),
                        right: px(2.0),
                        top: px(2.0),
                        bottom: px(0.0),
                    },
                    border_radius: BorderRadius::top(px(4.0)),
                    ..default()
                },
                BorderColor::all(color::AMBER),
                Pickable::IGNORE,
            ),
            (
                Node {
                    width: px(12.0),
                    height: px(9.0),
                    border_radius: BorderRadius::all(px(1.5)),
                    ..default()
                },
                BackgroundColor(color::AMBER),
                Pickable::IGNORE,
            ),
        ],
    )
}

/// A thin horizontal rule.
pub fn rule() -> impl Bundle {
    (
        Node {
            height: px(1.0),
            width: percent(100.0),
            ..default()
        },
        BackgroundColor(color::BORDER),
        Pickable::IGNORE,
    )
}

/// Registers the theme's systems.
pub struct ThemePlugin;

impl Plugin for ThemePlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, spawn_tooltip)
            .add_systems(PostUpdate, (restyle_buttons, show_tooltip));
    }
}
