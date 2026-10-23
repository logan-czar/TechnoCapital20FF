//! M8.5 map modes in the shell (D700 to D703): the mode bar switches the layer, which comes from
//! `get_map_layer` and is fetched again only when the mode or one of its views moves; the HQ pins
//! are sized by the revenue the views show; the hub pins carry their exchange code and index
//! level; the legend names what each mode shows. On a synthetic map of every province (D705).

mod common;

use bevy::picking::pointer::PointerButton;
use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, frames};
use game::bridge::{SimBridgePlugin, Views};
use game::links::Link;
use game::map::modes::{
    CurrentLayer, MapModeInput, MapModeState, ModeButton, ModeKind, legend_doc,
};
use game::map::pins::{PinNode, hub_label, pin_px};
use game::pages::PageRef;
use game::test_support::{Scratch, click, install_map_bitmap, with_world_map};
use game::ui::ShellPlugin;
use sim::Sim;
use sim::views::map_layers::{DevTrack, HqFilter, MapMode, PinTarget};

fn map_app(dir: &Scratch) -> App {
    let data = with_world_map(common::data(), dir.path(), 1024);
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, bevy::input::InputPlugin))
        .insert_resource(TimeUpdateStrategy::ManualDuration(FRAME))
        .add_plugins(SimBridgePlugin::new(Sim::new(data, 1).unwrap()))
        .add_plugins(ShellPlugin);
    app.update();
    install_map_bitmap(app.world_mut(), dir.path());
    frames(&mut app, 2);
    app
}

fn button(app: &mut App, b: ModeButton) -> Entity {
    app.world_mut()
        .query::<(Entity, &ModeButton)>()
        .iter(app.world())
        .find(|(_, x)| **x == b)
        .map(|(e, _)| e)
        .unwrap_or_else(|| panic!("no {b:?} button"))
}

fn press(app: &mut App, b: ModeButton) {
    let e = button(app, b);
    app.world_mut().trigger(click(e, PointerButton::Primary));
    frames(app, 2);
}

fn mode(app: &App) -> MapMode {
    app.world().resource::<MapModeState>().mode
}

#[test]
fn the_bar_switches_modes_and_keeps_their_parameters() {
    let dir = Scratch::new("m8-modes-bar");
    let mut app = map_app(&dir);
    assert_eq!(mode(&app), MapMode::Political);
    press(&mut app, ModeButton::Kind(ModeKind::Development));
    assert_eq!(mode(&app), MapMode::Development(DevTrack::Total));
    press(&mut app, ModeButton::Track(DevTrack::Population));
    assert_eq!(mode(&app), MapMode::Development(DevTrack::Population));
    press(&mut app, ModeButton::Kind(ModeKind::Industry));
    assert_eq!(mode(&app), MapMode::Industry(None));
    press(&mut app, ModeButton::Industry(1));
    let MapMode::Industry(Some(first)) = mode(&app) else {
        panic!("an industry is picked");
    };
    assert_eq!(first.0, 0);
    press(&mut app, ModeButton::Industry(-1));
    assert_eq!(mode(&app), MapMode::Industry(None), "back to the track");
    press(&mut app, ModeButton::Kind(ModeKind::CompanyHqs));
    press(&mut app, ModeButton::HqListed);
    assert_eq!(
        mode(&app),
        MapMode::CompanyHqs(HqFilter {
            listed: Some(true),
            ..HqFilter::default()
        })
    );
    press(&mut app, ModeButton::HqCountry(1));
    let MapMode::CompanyHqs(f) = mode(&app) else {
        panic!()
    };
    assert!(f.country.is_some() && f.listed == Some(true));
    // Back to Development: it kept its track.
    press(&mut app, ModeButton::Kind(ModeKind::Development));
    assert_eq!(mode(&app), MapMode::Development(DevTrack::Population));
    press(&mut app, ModeButton::Metros);
    assert!(app.world().resource::<MapModeState>().metros);
    // The layer the map shows is the views' layer of the mode.
    let views = app.world().resource::<Views>();
    let want = views.get_map_layer(mode(&app));
    assert_eq!(app.world().resource::<CurrentLayer>().layer, want);
}

#[test]
fn the_layer_is_fetched_only_when_the_mode_or_its_views_move() {
    let dir = Scratch::new("m8-modes-fetch");
    let mut app = map_app(&dir);
    let g = app.world().resource::<CurrentLayer>().generation;
    frames(&mut app, 5);
    assert_eq!(
        app.world().resource::<CurrentLayer>().generation,
        g,
        "paused: no refetch"
    );
    app.world_mut()
        .write_message(MapModeInput::Set(MapMode::FinancialZones));
    frames(&mut app, 1);
    let g2 = app.world().resource::<CurrentLayer>().generation;
    assert_eq!(g2, g + 1);
    // The same mode again changes nothing.
    app.world_mut()
        .write_message(MapModeInput::Set(MapMode::FinancialZones));
    frames(&mut app, 3);
    assert_eq!(app.world().resource::<CurrentLayer>().generation, g2);
}

#[test]
fn hq_pins_are_sized_by_the_shown_revenue_and_link_their_company() {
    let dir = Scratch::new("m8-modes-pins");
    let mut app = map_app(&dir);
    app.world_mut()
        .write_message(MapModeInput::Set(MapMode::CompanyHqs(HqFilter::default())));
    frames(&mut app, 3);
    let layer = app.world().resource::<CurrentLayer>().layer.clone();
    let pins: Vec<(PinNode, PageRef)> = app
        .world_mut()
        .query::<(&PinNode, &Link)>()
        .iter(app.world())
        .map(|(p, l)| (*p, l.0.clone()))
        .collect();
    assert_eq!(
        pins.len(),
        layer.pins.len(),
        "every HQ has a pin on the world map"
    );
    let rows = app
        .world()
        .resource::<Views>()
        .company_rows
        .get()
        .rows
        .clone();
    for (p, page) in &pins {
        let PinTarget::Company(c) = p.target else {
            panic!("HQ pins only")
        };
        assert_eq!(*page, PageRef::Company(c));
        let r = rows.iter().find(|r| r.id == c).unwrap();
        assert_eq!(p.diameter, pin_px(r.revenue_ttm.shown()), "{}", r.name);
    }
    // Shown on the map at World zoom: some pins are laid out.
    let shown = app
        .world_mut()
        .query::<(&PinNode, &Node)>()
        .iter(app.world())
        .filter(|(_, n)| n.display != Display::None)
        .count();
    assert!(shown > 100, "{shown} pins on screen");
    let legend = legend_doc(&layer, false);
    assert!(legend.rows.iter().any(|(_, t)| t.contains("HQs shown")));
    assert!(legend.rows.iter().any(|(_, t)| t.contains("Contested")));
    assert!(!legend.rows.iter().any(|(_, t)| t.contains("Metro")));
    assert!(
        legend_doc(&layer, true)
            .rows
            .iter()
            .any(|(_, t)| t == "Metro outline")
    );
    // A filter thins them.
    app.world_mut()
        .write_message(MapModeInput::Set(MapMode::CompanyHqs(HqFilter {
            listed: Some(false),
            ..HqFilter::default()
        })));
    frames(&mut app, 3);
    let n = app
        .world_mut()
        .query::<&PinNode>()
        .iter(app.world())
        .count();
    assert_eq!(n, rows.iter().filter(|r| !r.public).count());
}

#[test]
fn zone_mode_pins_each_hub_and_its_legend_gives_the_cycle() {
    let dir = Scratch::new("m8-modes-zones");
    let mut app = map_app(&dir);
    app.world_mut()
        .write_message(MapModeInput::Set(MapMode::FinancialZones));
    frames(&mut app, 3);
    let layer = app.world().resource::<CurrentLayer>().layer.clone();
    assert_eq!(layer.pins.len(), 26);
    let texts: Vec<String> = app
        .world_mut()
        .query::<&Text>()
        .iter(app.world())
        .map(|t| t.0.clone())
        .collect();
    for p in &layer.pins {
        assert!(texts.contains(&hub_label(p)), "{}", hub_label(p));
    }
    let legend = legend_doc(&layer, false);
    let cycle = app.world().resource::<Views>().cycle.get().clone();
    for want in [
        format!("Global phase: {}", cycle.phase.name()),
        format!("Quarters left: {}", cycle.quarters_left),
    ] {
        assert!(legend.rows.iter().any(|(_, t)| *t == want), "{want}");
        assert!(texts.contains(&want), "the legend shows {want}");
    }
}
