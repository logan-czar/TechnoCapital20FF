//! Headless app helpers for the shell tests (build-plan M7.9): MinimalPlugins, no window, a fixed
//! 1/60 s frame so speeds can be measured in game hours per (virtual) second.

#![allow(dead_code)]

use std::sync::OnceLock;
use std::time::Duration;

use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use game::bridge::{SimBridgePlugin, SimControl, SimNotice};
use sim::world::{AlertKind, AlertLevel};
use sim::{Control, Notice, Sim};

pub const FRAME: Duration = Duration::from_nanos(16_666_667);

pub fn data() -> sim_data::WorldData {
    static DATA: OnceLock<sim_data::WorldData> = OnceLock::new();
    DATA.get_or_init(|| sim_data::load_world(&sim_data::default_data_dir()).unwrap())
        .clone()
}

pub fn sim() -> Sim {
    Sim::new(data(), 42).unwrap()
}

/// Every notice the app posted, in order.
#[derive(Resource, Default)]
pub struct Seen(pub Vec<Notice>);

fn collect(mut r: MessageReader<SimNotice>, mut seen: ResMut<Seen>) {
    seen.0.extend(r.read().map(|n| n.0.clone()));
}

/// A headless app running the bridge; a test system collects every notice into [`Seen`].
pub fn bridge_app() -> App {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, bevy::input::InputPlugin))
        .insert_resource(TimeUpdateStrategy::ManualDuration(FRAME))
        .add_plugins(SimBridgePlugin::new(sim()))
        .init_resource::<Seen>()
        .add_systems(Update, collect);
    app.update();
    app
}

pub fn send(app: &mut App, c: Control) {
    app.world_mut().write_message(SimControl(c));
}

pub fn alerts_off(app: &mut App) {
    for kind in AlertKind::ALL {
        send(
            app,
            Control::SetAlert {
                kind,
                level: AlertLevel::Off,
            },
        );
    }
}

pub fn frames(app: &mut App, n: usize) {
    for _ in 0..n {
        app.update();
    }
}

/// Ticks finished so far (TickDone notices).
pub fn ticks(app: &App) -> usize {
    app.world()
        .resource::<Seen>()
        .0
        .iter()
        .filter(|n| matches!(n, Notice::TickDone(_)))
        .count()
}
