//! The top bar (build-plan M7.5; spec 8 main screen and time controls rows; 20-ui 20.2.1,
//! 20.2.6): the alert row in the centre, then the quarter clock (phase name and days to the next
//! phase, 21.8), date, hour and weekday, pause, speeds 1 to 5, the Skip menu (next release, next
//! plan lock, next recap, month end), the tick rate and the alert settings gear.
//!
//! Keys: Space pauses or resumes, 1 to 5 set the speed (and resume, D8), + and - step it, and
//! Ctrl+Space opens the Skip menu.

use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use sim::Control;
use sim::world::SkipKind;

use super::theme::{self, ButtonLook, Tooltip, color, font, size};
use super::{Menu, OpenMenu, ShellLayout, SpawnLayout, UiSystems};
use crate::bridge::{SimControl, SimRate, Views};

/// Month names for the date (20-ui 20.2.1: "Wed 1 Jan 2020 00:00").
const MONTHS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/// The Skip menu entries (spec 8, 9.1).
pub const SKIPS: [(SkipKind, &str); 4] = [
    (SkipKind::NextRelease, "Next release"),
    (SkipKind::NextLock, "Next plan lock"),
    (SkipKind::NextRecap, "Next recap"),
    (SkipKind::MonthEnd, "Month end"),
];

pub fn skip_name(kind: SkipKind) -> &'static str {
    SKIPS
        .iter()
        .find(|(k, _)| *k == kind)
        .map_or("?", |(_, n)| n)
}

/// Where the alert row's icons go.
#[derive(Component)]
pub struct AlertRowRoot;

#[derive(Component)]
struct DateText;
#[derive(Component)]
struct PhaseText;
#[derive(Component)]
struct SkipStatusText;
#[derive(Component)]
struct RateText;
#[derive(Component)]
struct PauseButton;
#[derive(Component)]
struct SpeedButton(u8);
#[derive(Component)]
struct SkipButton;
#[derive(Component)]
struct GearButton;
#[derive(Component)]
struct SkipMenuRoot;

pub struct TopBarPlugin;

impl Plugin for TopBarPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<crate::pace::UiPace>()
            .add_systems(Startup, spawn_top_bar.after(SpawnLayout))
            .add_systems(Update, time_keys.in_set(UiSystems::Input))
            .add_systems(
                Update,
                (
                    show_clock,
                    show_rate,
                    show_menus.run_if(resource_changed::<OpenMenu>),
                )
                    .in_set(UiSystems::Show),
            );
    }
}

fn send(w: &mut MessageWriter<SimControl>, c: Control) {
    w.write(SimControl(c));
}

fn spawn_top_bar(mut commands: Commands, layout: Res<ShellLayout>) {
    let bar = layout.top_bar;
    let brand = commands
        .spawn(theme::text("TECHNOCAPITAL 20FF", font::TITLE, color::CYAN))
        .id();
    let alert_row = commands
        .spawn((
            AlertRowRoot,
            Node {
                flex_grow: 1.0,
                flex_direction: FlexDirection::Row,
                align_items: AlignItems::Center,
                column_gap: px(size::GAP),
                margin: UiRect::horizontal(px(16.0)),
                ..default()
            },
        ))
        .id();
    // The clock block: date and hour on top, the quarter clock (and a running skip) below.
    let phase = commands
        .spawn((
            PhaseText,
            theme::text("", font::SMALL, color::GREEN),
            Hovered::default(),
            Tooltip("Quarter clock: the quarter phase and calendar days to the next (21.8)".into()),
        ))
        .id();
    let skip_status = commands
        .spawn((SkipStatusText, theme::text("", font::SMALL, color::AMBER)))
        .id();
    let date = commands
        .spawn((DateText, theme::text("", font::TITLE, color::TEXT)))
        .id();
    let lower = commands
        .spawn(Node {
            flex_direction: FlexDirection::Row,
            column_gap: px(size::GAP),
            ..default()
        })
        .add_children(&[skip_status, phase])
        .id();
    let clock = commands
        .spawn(Node {
            flex_direction: FlexDirection::Column,
            align_items: AlignItems::FlexEnd,
            margin: UiRect::right(px(size::PAD)),
            ..default()
        })
        .add_children(&[date, lower])
        .id();
    commands
        .entity(bar)
        .add_children(&[brand, alert_row, clock]);

    let pause = commands
        .spawn((
            theme::button("> Play", color::MAGENTA),
            PauseButton,
            Tooltip("Pause or resume (Space)".into()),
        ))
        .observe(
            |_: On<PointerClick>, views: Res<Views>, mut w: MessageWriter<SimControl>| {
                let c = if views.clock().paused {
                    Control::Resume
                } else {
                    Control::Pause
                };
                send(&mut w, c);
            },
        )
        .id();
    commands.entity(bar).add_child(pause);
    for n in 1..=sim::time::control::MAX_SPEED {
        let hint = match sim::time::control::SECONDS_PER_HOUR[usize::from(n - 1)] {
            Some(s) => format!("Speed {n}: {s} s per game hour (key {n})"),
            None => format!("Speed {n}: max (key {n})"),
        };
        let b = commands
            .spawn((
                theme::button(n.to_string(), color::CYAN),
                SpeedButton(n),
                Tooltip(hint),
            ))
            .observe(
                move |_: On<PointerClick>, mut w: MessageWriter<SimControl>| {
                    send(&mut w, Control::SetSpeed(n));
                },
            )
            .id();
        commands.entity(bar).add_child(b);
    }
    let skip = commands
        .spawn((
            theme::button("Skip v", color::AMBER),
            SkipButton,
            Tooltip("Run at max speed to a date, then pause (Ctrl+Space)".into()),
        ))
        .observe(|_: On<PointerClick>, mut menu: ResMut<OpenMenu>| {
            menu.toggle(Menu::Skip);
        })
        .id();
    let rate = commands
        .spawn((
            RateText,
            Node {
                width: px(78.0),
                justify_content: JustifyContent::FlexEnd,
                ..default()
            },
            children![theme::muted("")],
        ))
        .id();
    let gear = commands
        .spawn((
            theme::button("Alerts", color::MAGENTA),
            GearButton,
            Tooltip("Alert settings: Pause, Notify, Log or Off per alert (spec 8)".into()),
        ))
        .observe(|_: On<PointerClick>, mut menu: ResMut<OpenMenu>| {
            menu.toggle(Menu::AlertSettings);
        })
        .id();
    commands.entity(bar).add_children(&[skip, rate, gear]);

    // The Skip drop-down, under the Skip button.
    let menu = commands
        .spawn((
            SkipMenuRoot,
            theme::panel(Node {
                position_type: PositionType::Absolute,
                top: px(size::TOP_BAR),
                right: px(150.0),
                display: Display::None,
                min_width: px(180.0),
                ..default()
            }),
            GlobalZIndex(60),
        ))
        .id();
    commands.entity(layout.root).add_child(menu);
    for (kind, name) in SKIPS {
        let item = commands
            .spawn(theme::button(name, color::AMBER))
            .observe(
                move |_: On<PointerClick>,
                      mut w: MessageWriter<SimControl>,
                      mut open: ResMut<OpenMenu>| {
                    send(&mut w, Control::SkipTo(kind));
                    open.0 = None;
                },
            )
            .id();
        commands.entity(menu).add_child(item);
    }
}

/// Space, 1 to 5, + and -, Ctrl+Space (spec 8; 20-ui 20.2.6).
fn time_keys(
    keys: Res<ButtonInput<KeyCode>>,
    capture: Res<super::KeyboardCapture>,
    views: Res<Views>,
    mut w: MessageWriter<SimControl>,
    mut menu: ResMut<OpenMenu>,
) {
    if capture.0 {
        return;
    }
    let clock = views.clock();
    let ctrl = keys.any_pressed([KeyCode::ControlLeft, KeyCode::ControlRight]);
    if keys.just_pressed(KeyCode::Space) {
        if ctrl {
            menu.toggle(Menu::Skip);
        } else if clock.paused {
            send(&mut w, Control::Resume);
        } else {
            send(&mut w, Control::Pause);
        }
    }
    // Ctrl and Alt with digits, + and - are workspace shortcuts (D453).
    if super::modifier_held(&keys) {
        return;
    }
    const DIGITS: [(KeyCode, KeyCode); 5] = [
        (KeyCode::Digit1, KeyCode::Numpad1),
        (KeyCode::Digit2, KeyCode::Numpad2),
        (KeyCode::Digit3, KeyCode::Numpad3),
        (KeyCode::Digit4, KeyCode::Numpad4),
        (KeyCode::Digit5, KeyCode::Numpad5),
    ];
    for (n, (a, b)) in (1u8..).zip(DIGITS) {
        if keys.any_just_pressed([a, b]) {
            send(&mut w, Control::SetSpeed(n));
        }
    }
    let speed = clock.selected_speed;
    if keys.any_just_pressed([KeyCode::Equal, KeyCode::NumpadAdd]) {
        send(
            &mut w,
            Control::SetSpeed((speed + 1).min(sim::time::control::MAX_SPEED)),
        );
    }
    if keys.any_just_pressed([KeyCode::Minus, KeyCode::NumpadSubtract]) {
        send(&mut w, Control::SetSpeed(speed.saturating_sub(1).max(1)));
    }
}

/// The date, the quarter clock and the controls' state, from the clock view. While the sim
/// fast-forwards (the date moves days a frame) it is written at most every
/// [`crate::pace::LIVE_TEXT_SECS`] (D773); a pause or a speed change shows at once.
#[allow(clippy::type_complexity, clippy::too_many_arguments)]
fn show_clock(
    views: Res<Views>,
    mut pace: ResMut<crate::pace::UiPace>,
    mut paced: Local<crate::pace::Paced>,
    mut texts: ParamSet<(
        Query<&mut Text, With<DateText>>,
        Query<&mut Text, With<PhaseText>>,
        Query<&mut Text, With<SkipStatusText>>,
        Query<&mut Text>,
    )>,
    mut pause: Query<(&mut ButtonLook, &Children), (With<PauseButton>, Without<SpeedButton>)>,
    mut speeds: Query<(&SpeedButton, &mut ButtonLook), Without<PauseButton>>,
) {
    if !paced.due(views.is_changed(), &mut pace, crate::pace::LIVE_TEXT_SECS, false) {
        return;
    }
    let c = views.clock();
    let date = format!(
        "{} {} {} {}  {:02}:00",
        c.weekday.short_name(),
        c.date.day,
        MONTHS[usize::from(c.date.month - 1)],
        c.date.year,
        c.hour
    );
    let phase = format!(
        "{} | {}d to {}",
        c.quarter_phase.name(),
        c.days_to_next_phase,
        c.next_phase.name()
    );
    let skip = c
        .skipping
        .map_or(String::new(), |k| format!("SKIP > {}", skip_name(k)));
    set(&mut texts.p0(), date);
    set(&mut texts.p1(), phase);
    set(&mut texts.p2(), skip);
    for (mut look, children) in &mut pause {
        if look.active != c.paused {
            look.active = c.paused;
        }
        let label = if c.paused { "> Play" } else { "|| Pause" };
        if let Some(&e) = children.first()
            && let Ok(mut t) = texts.p3().get_mut(e)
            && t.0 != label
        {
            label.clone_into(&mut t.0);
        }
    }
    for (b, mut look) in &mut speeds {
        let active = b.0 == c.selected_speed;
        if look.active != active {
            look.active = active;
        }
    }
}

fn set<F: bevy::ecs::query::QueryFilter>(q: &mut Query<&mut Text, F>, s: String) {
    for mut t in q.iter_mut() {
        if t.0 != s {
            t.0.clone_from(&s);
        }
    }
}

/// Game hours per real second, measured.
fn show_rate(
    rate: Res<SimRate>,
    views: Res<Views>,
    q: Query<&Children, With<RateText>>,
    mut texts: Query<&mut Text>,
) {
    let s = if views.clock().paused {
        "paused".to_owned()
    } else {
        format!("{:.1} h/s", rate.hours_per_second)
    };
    for children in &q {
        if let Some(mut t) = children.first().and_then(|&e| texts.get_mut(e).ok())
            && t.0 != s
        {
            t.0 = s.clone();
        }
    }
}

fn show_menus(
    menu: Res<OpenMenu>,
    mut root: Query<&mut Node, With<SkipMenuRoot>>,
    mut skip: Query<&mut ButtonLook, (With<SkipButton>, Without<GearButton>)>,
    mut gear: Query<&mut ButtonLook, (With<GearButton>, Without<SkipButton>)>,
) {
    let open = menu.0 == Some(Menu::Skip);
    for mut n in &mut root {
        n.display = if open { Display::Flex } else { Display::None };
    }
    for mut l in &mut skip {
        l.active = open;
    }
    for mut l in &mut gear {
        l.active = menu.0 == Some(Menu::AlertSettings);
    }
}
