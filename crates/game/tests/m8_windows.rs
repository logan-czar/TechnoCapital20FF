//! M8 Phase A (lane MA, D635): the floating window layer over the map, through the whole shell
//! headless. Windows move by the title bar, resize from the grip, rise on a press, minimize to
//! the dock and come back from it, close, hide with H, and open with Ctrl+N; saved layouts keep
//! them.

mod common;

use bevy::input::ButtonState;
use bevy::input::keyboard::{Key, KeyboardInput, NativeKey};
use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, data, frames};
use game::bridge::SimBridgePlugin;
use game::config::UiConfig;
use game::pages::PageRef;
use game::test_support::{click, drag, press};
use game::ui::ShellPlugin;
use game::workspace::model::{MIN_WINDOW_H, MIN_WINDOW_W};
use game::workspace::{
    OpenPage, OpenTarget, PaneAction, PaneFrame, WindowAction, WindowFrame, WindowId, Workspace,
};
use sim::Sim;

fn shell_app() -> App {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, bevy::input::InputPlugin))
        .insert_resource(TimeUpdateStrategy::ManualDuration(FRAME))
        .add_plugins(SimBridgePlugin::new(Sim::new(data(), 42).unwrap()))
        .add_plugins(ShellPlugin);
    app.update();
    app
}

fn ws(app: &App) -> &Workspace {
    app.world().resource::<Workspace>()
}

fn chord(app: &mut App, mods: &[KeyCode], key: KeyCode) {
    let ev = |k, state| KeyboardInput {
        key_code: k,
        logical_key: Key::Unidentified(NativeKey::Unidentified),
        state,
        text: None,
        repeat: false,
        window: Entity::PLACEHOLDER,
    };
    for &m in mods {
        app.world_mut().write_message(ev(m, ButtonState::Pressed));
    }
    app.world_mut().write_message(ev(key, ButtonState::Pressed));
    app.update();
    app.world_mut()
        .write_message(ev(key, ButtonState::Released));
    for &m in mods {
        app.world_mut().write_message(ev(m, ButtonState::Released));
    }
    app.update();
    app.update();
}

fn frame_of(app: &mut App, id: WindowId) -> WindowFrame {
    *app.world_mut()
        .query::<&WindowFrame>()
        .iter(app.world())
        .find(|f| f.window == id)
        .unwrap_or_else(|| panic!("no frame for {id:?}"))
}

/// The entity of the text `label` 's parent (a button).
fn labelled(app: &mut App, label: &str) -> Vec<Entity> {
    let texts: Vec<Entity> = app
        .world_mut()
        .query::<(Entity, &Text)>()
        .iter(app.world())
        .filter(|(_, t)| t.0 == label)
        .map(|(e, _)| e)
        .collect();
    texts
        .into_iter()
        .map(|t| app.world().get::<ChildOf>(t).unwrap().parent())
        .collect()
}

#[test]
fn one_window_holds_the_m9_workspace_and_the_map_shows_beside_it() {
    let mut app = shell_app();
    let w = ws(&app);
    assert_eq!(w.windows().len(), 1);
    let id = w.active_window();
    let rect = w.window(id).unwrap().rect;
    let (aw, _) = w.area();
    assert!(
        rect.x > 0.0 && rect.x + rect.w <= aw + 0.01,
        "the map shows left of it"
    );
    let f = frame_of(&mut app, id);
    // The frame sits at the window's rectangle, and its title names the focused page.
    let fe = frame_entity(&mut app, id);
    let n = app.world().get::<Node>(fe).unwrap().clone();
    assert_eq!(
        (n.left, n.top, n.width, n.height),
        (px(rect.x), px(rect.y), px(rect.w), px(rect.h))
    );
    assert_eq!(app.world().get::<Text>(f.title).unwrap().0, "World");
    // Its pane frames live inside its body.
    let panes = app
        .world_mut()
        .query::<(Entity, &PaneFrame)>()
        .iter(app.world())
        .map(|(e, _)| e)
        .collect::<Vec<_>>();
    assert_eq!(panes.len(), 1);
    let mut up = panes[0];
    let mut inside = false;
    while let Some(p) = app.world().get::<ChildOf>(up) {
        up = p.parent();
        if up == f.body {
            inside = true;
        }
    }
    assert!(inside, "the pane is in the window's body");
    // The map node is under the window layer in the main area.
    let main = app.world().resource::<game::ui::ShellLayout>().main;
    let kids: Vec<Entity> = app.world().get::<Children>(main).unwrap().iter().collect();
    let map = kids
        .iter()
        .position(|&e| app.world().get::<game::map::MapView>(e).is_some())
        .expect("a map node");
    let layer = app.world().resource::<game::workspace::WorkspaceUi>().root;
    let layer_at = kids.iter().position(|&e| e == layer).unwrap();
    assert!(map < layer_at, "the map draws first, under the windows");
    assert_eq!(
        app.world().get::<Pickable>(layer),
        Some(&Pickable::IGNORE),
        "the layer lets the pointer through to the map"
    );
}

fn frame_entity(app: &mut App, id: WindowId) -> Entity {
    app.world_mut()
        .query::<(Entity, &WindowFrame)>()
        .iter(app.world())
        .find(|(_, f)| f.window == id)
        .map(|(e, _)| e)
        .unwrap()
}

#[test]
fn windows_move_resize_rise_and_keep_their_panes() {
    let mut app = shell_app();
    let first = ws(&app).active_window();
    // Ctrl+N: a second window on top, focused.
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::KeyN);
    assert_eq!(ws(&app).windows().len(), 2);
    let second = ws(&app).active_window();
    assert_ne!(first, second);
    assert_eq!(
        app.world_mut()
            .query::<&WindowFrame>()
            .iter(app.world())
            .count(),
        2
    );
    // Pages open in the focused window's focused pane.
    app.world_mut()
        .write_message(OpenPage::focused(PageRef::News));
    frames(&mut app, 2);
    let p2 = ws(&app).focused();
    assert_eq!(ws(&app).window_of(p2), Some(second));
    assert_eq!(ws(&app).page(p2), Some(&PageRef::News));
    // A split stays in the window.
    app.world_mut()
        .write_message(PaneAction::Split(None, game::workspace::Axis::Row));
    frames(&mut app, 2);
    assert_eq!(ws(&app).window(second).unwrap().pane_ids().len(), 2);
    assert_eq!(ws(&app).window(first).unwrap().pane_ids().len(), 1);
    // Drag the title bar: the window moves.
    let f = frame_of(&mut app, second);
    let before = ws(&app).window(second).unwrap().rect;
    app.world_mut().trigger(drag(f.bar, Vec2::new(-40.0, 25.0)));
    frames(&mut app, 2);
    let after = ws(&app).window(second).unwrap().rect;
    assert_eq!((after.x, after.y), (before.x - 40.0, before.y + 25.0));
    let fe = frame_entity(&mut app, second);
    let n = app.world().get::<Node>(fe).unwrap().clone();
    assert_eq!(
        (n.left, n.top),
        (px(after.x), px(after.y)),
        "the frame follows"
    );
    // Far off an edge: the window stays wholly inside the area.
    app.world_mut().trigger(drag(f.bar, Vec2::new(1e5, 1e5)));
    frames(&mut app, 2);
    let r = ws(&app).window(second).unwrap().rect;
    let (aw, ah) = ws(&app).area();
    assert!(
        (r.x + r.w - aw).abs() < 1e-3 && (r.y + r.h - ah).abs() < 1e-3,
        "{r:?}"
    );
    // The grip resizes, never under the panes' minimum (two panes side by side).
    let grip = labelled_grip(&mut app, second);
    app.world_mut().trigger(drag(grip, Vec2::new(-1e5, -1e5)));
    frames(&mut app, 2);
    let r = ws(&app).window(second).unwrap().rect;
    assert!(r.w >= 2.0 * game::workspace::model::MIN_PANE_W, "{r:?}");
    assert!(r.w >= MIN_WINDOW_W && r.h >= MIN_WINDOW_H);
    // A press on the first window raises and focuses it.
    let f1 = frame_entity(&mut app, first);
    app.world_mut().trigger(press(f1, PointerButton::Primary));
    frames(&mut app, 2);
    assert_eq!(ws(&app).active_window(), first);
    assert_eq!(ws(&app).windows().last().unwrap().id, first);
    let z1 = *app.world().get::<ZIndex>(f1).unwrap();
    let fe = frame_entity(&mut app, second);
    let z2 = *app.world().get::<ZIndex>(fe).unwrap();
    assert!(z1.0 > z2.0, "on top");
    // The layout keeps both windows.
    let saved = app
        .world()
        .resource::<UiConfig>()
        .last_layout
        .clone()
        .unwrap();
    assert_eq!(saved.windows.len(), 2);
    assert_eq!(saved, ws(&app).to_saved());
}

/// The resize grip of a window: the frame's last child.
fn labelled_grip(app: &mut App, id: WindowId) -> Entity {
    let e = frame_entity(app, id);
    *app.world()
        .get::<Children>(e)
        .unwrap()
        .iter()
        .collect::<Vec<_>>()
        .last()
        .unwrap()
}

#[test]
fn minimize_to_the_dock_hide_and_close() {
    let mut app = shell_app();
    let first = ws(&app).active_window();
    app.world_mut()
        .write_message(WindowAction::New(Some(PageRef::Settings)));
    frames(&mut app, 2);
    let second = ws(&app).active_window();
    // The minimize button sends it to the dock; the focus goes back to the first.
    let min = labelled(&mut app, "_");
    assert_eq!(min.len(), 2);
    let f2 = frame_entity(&mut app, second);
    let min2 = min
        .into_iter()
        .find(|&b| {
            let mut up = b;
            while let Some(p) = app.world().get::<ChildOf>(up) {
                up = p.parent();
                if up == f2 {
                    return true;
                }
            }
            false
        })
        .unwrap();
    app.world_mut().trigger(click(min2, PointerButton::Primary));
    frames(&mut app, 2);
    assert!(ws(&app).window(second).unwrap().minimized);
    assert_eq!(ws(&app).active_window(), first);
    assert_eq!(
        app.world().get::<Node>(f2).unwrap().display,
        Display::None,
        "a minimized window is not drawn"
    );
    let chip = labelled(&mut app, "[Settings]");
    assert_eq!(chip.len(), 1, "the dock shows it");
    app.world_mut()
        .trigger(click(chip[0], PointerButton::Primary));
    frames(&mut app, 2);
    assert!(!ws(&app).window(second).unwrap().minimized);
    assert_eq!(ws(&app).active_window(), second);
    assert!(labelled(&mut app, "[Settings]").is_empty());
    // H hides every window; a page opening shows them again.
    chord(&mut app, &[], KeyCode::KeyH);
    assert!(ws(&app).hidden());
    let layer = app.world().resource::<game::workspace::WorkspaceUi>().root;
    assert_eq!(
        app.world().get::<Visibility>(layer),
        Some(&Visibility::Hidden)
    );
    assert_eq!(labelled(&mut app, "Windows hidden: H shows them").len(), 1);
    app.world_mut().write_message(OpenPage {
        page: PageRef::News,
        target: OpenTarget::Focused,
    });
    frames(&mut app, 2);
    assert!(!ws(&app).hidden());
    // Ctrl+Shift+W closes the focused window; the last one stays.
    chord(
        &mut app,
        &[KeyCode::ControlLeft, KeyCode::ShiftLeft],
        KeyCode::KeyW,
    );
    assert_eq!(ws(&app).windows().len(), 1);
    assert_eq!(ws(&app).active_window(), first);
    chord(
        &mut app,
        &[KeyCode::ControlLeft, KeyCode::ShiftLeft],
        KeyCode::KeyW,
    );
    assert_eq!(ws(&app).windows().len(), 1, "the last window stays");
    // Ctrl+W still closes panes, not windows.
    chord(&mut app, &[KeyCode::ControlLeft], KeyCode::KeyW);
    assert_eq!(ws(&app).windows().len(), 1);
}

/// The dock never shows over full-screen Pdoomberg (review of PR #35).
#[test]
fn the_dock_hides_under_pdoomberg() {
    let mut app = shell_app();
    let dock = app.world().resource::<game::workspace::WorkspaceUi>().dock;
    let vis = |app: &App| *app.world().get::<Visibility>(dock).unwrap();
    assert_eq!(vis(&app), Visibility::Inherited);
    chord(&mut app, &[], KeyCode::KeyB);
    assert_eq!(
        app.world().resource::<game::ui::rail::Router>().current,
        game::ui::rail::Screen::Pdoomberg
    );
    assert_eq!(vis(&app), Visibility::Hidden);
    chord(&mut app, &[], KeyCode::Escape);
    assert_eq!(vis(&app), Visibility::Inherited);
}
