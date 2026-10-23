//! M8.7: the province card (spec 8 Map row), the zone hover card, the Province page and the
//! province links throughout the pages and the command bar (D704, D707).

mod common;

use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, frames};
use game::bridge::{SimBridgePlugin, Views};
use game::command::index::NameIndex;
use game::links::cards::{self, Card};
use game::map::card::{MapCard, MapCardPanel};
use game::map::modes::MapModeInput;
use game::map::picking::MapBitmap;
use game::map::{MapInput, MapState};
use game::pages::PageRef;
use game::pages::character::character_doc;
use game::pages::company::company_doc;
use game::pages::country::country_doc;
use game::pages::exchange::exchange_doc;
use game::pages::province::province_doc;
use game::pages::zone::zone_doc;
use game::test_support::{Scratch, install_map_bitmap, with_world_map};
use game::ui::ShellPlugin;
use game::workspace::{OpenPage, OpenTarget, PaneFrame, Workspace};
use sim::Sim;
use sim::views::map_layers::MapMode;
use sim::world::{Ordinal, ProvinceId};

fn labels(c: &Card) -> Vec<&str> {
    c.lines.iter().map(|l| l.label.as_str()).collect()
}

/// Spec 8's province card fields: development, resource, terrain, Metro, key city, HQs and
/// units there.
const PROVINCE_FIELDS: [&str; 7] = [
    "Development",
    "Resource",
    "Terrain",
    "Metro",
    "Key city",
    "HQs",
    "Units",
];

/// Spec 8's zone hover fields: number, members, intensity, lag, contagion, listed company
/// count, base and effective credit spread, investor confidence.
const ZONE_FIELDS: [&str; 9] = [
    "Zone",
    "Members",
    "Intensity",
    "Lag",
    "Contagion",
    "Listed",
    "Base spread",
    "Credit spread",
    "Confidence",
];

#[test]
fn every_province_card_and_zone_card_has_the_spec_8_fields() {
    let sim = Sim::new(common::data(), 1).unwrap();
    let v = sim.views();
    let index = NameIndex::build(v);
    let units = v.units.get();
    for c in &v.province_cards.get().cards {
        let card = cards::card(&PageRef::Province(c.id), v, &index);
        assert_eq!(card.title, c.name);
        let l = labels(&card);
        for f in PROVINCE_FIELDS {
            assert!(l.contains(&f), "{}: {f}", c.key);
        }
        let hq_links: Vec<_> = card.lines.iter().filter_map(|l| l.link.clone()).collect();
        for co in c.hqs.iter().take(cards::CARD_HQS) {
            assert!(hq_links.contains(&PageRef::Company(*co)), "{}", c.key);
        }
        // The units' assets: their sum as v_units shows them, a band if any is.
        if let Some(line) = card.lines.iter().find(|l| l.label == "Unit assets") {
            let sum = sim::views::estimate::Figure::sum(
                c.units.iter().map(|&u| units.get(u).unwrap().gross_assets),
            );
            let want = game::table::Cell::figure(sum, game::table::Unit::Money).display();
            assert_eq!(line.value, want, "{}", c.key);
        } else {
            assert!(c.units.is_empty());
        }
    }
    for z in &v.zones.get().zones {
        let p = ProvinceId::from_index(0);
        let card = cards::zone_hover_card(z.id, Some(p), v, &index);
        let l = labels(&card);
        for f in ZONE_FIELDS {
            assert!(l.contains(&f), "{}: {f}", z.name);
        }
        assert_eq!(card.title, z.name);
    }
}

#[test]
fn the_province_page_lists_its_hqs_and_units_with_links() {
    let sim = Sim::new(common::data(), 1).unwrap();
    let v = sim.views();
    let index = NameIndex::build(v);
    let mut with_both = 0;
    for c in &v.province_cards.get().cards {
        let d = province_doc(c.id, v, &index);
        assert_eq!(d.title, c.name);
        assert_eq!(d.table("province.hqs").unwrap().model.len(), c.hqs.len());
        assert_eq!(
            d.table("province.units").unwrap().model.len(),
            c.units.len()
        );
        let links = d.links();
        assert!(links.contains(&PageRef::Country(c.country)), "{}", c.key);
        for co in &c.hqs {
            assert!(links.contains(&PageRef::Company(*co)));
        }
        for u in &c.units {
            let row = v.units.get().get(*u).unwrap();
            assert!(links.contains(&PageRef::Company(row.company)));
            assert!(links.contains(&PageRef::Industry(row.industry)));
        }
        if !c.hqs.is_empty() && !c.units.is_empty() {
            with_both += 1;
        }
    }
    assert!(with_both > 20, "{with_both}");
}

#[test]
fn province_names_link_to_their_pages_everywhere() {
    let sim = Sim::new(common::data(), 1).unwrap();
    let v = sim.views();
    let index = NameIndex::build(v);
    // Company HQ and unit base provinces.
    for r in v.company_rows.get().rows.iter().take(60) {
        let links = company_doc(r.id, v, &index).links();
        let d = v.company_detail.get().get(r.id).unwrap();
        assert!(
            links.contains(&PageRef::Province(d.hq_province)),
            "{}",
            r.name
        );
        assert!(
            links.contains(&PageRef::Country(r.hq_country)),
            "{}",
            r.name
        );
        for u in v.units.get().of_company(r.id) {
            assert!(links.contains(&PageRef::Province(u.base_province)));
        }
    }
    // Characters' home province.
    for c in v.characters.get().full.iter().take(60) {
        let sim::views::characters::CharacterRef::Full(id) = c.id else {
            unreachable!()
        };
        if let Some(h) = &c.home {
            assert!(
                character_doc(id, v, &index)
                    .links()
                    .contains(&PageRef::Province(h.province))
            );
        }
    }
    // Countries' and zones' member provinces, and exchanges' hubs.
    let cards = &v.province_cards.get().cards;
    for c in v.countries.get().countries.iter().take(40) {
        let links = country_doc(c.id, v, &index).links();
        let mine: Vec<_> = cards.iter().filter(|p| p.country == c.id).collect();
        assert!(!mine.is_empty());
        for p in mine {
            assert!(links.contains(&PageRef::Province(p.id)), "{}", p.key);
        }
    }
    for z in &v.zones.get().zones {
        let links = zone_doc(z.id, v, &index).links();
        let n = cards
            .iter()
            .filter(|p| z.members.contains(&p.country))
            .inspect(|p| assert!(links.contains(&PageRef::Province(p.id))))
            .count();
        assert!(n > 0, "{}", z.name);
        let x = v.exchanges.get().of_zone(z.id).unwrap();
        assert!(
            exchange_doc(z.id, v, &index)
                .links()
                .contains(&PageRef::Province(x.hub_province))
        );
    }
}

#[test]
fn the_command_bar_finds_provinces() {
    let sim = Sim::new(common::data(), 1).unwrap();
    let v = sim.views();
    let index = NameIndex::build(v);
    for key in ["US-0001", "CA-0026", "MO-0001", "GB-0001"] {
        let p = v
            .places
            .get()
            .provinces
            .iter()
            .find(|p| p.key == key)
            .unwrap();
        let page = PageRef::Province(p.id);
        for q in [p.name.as_str(), key] {
            let hits = index.search(q, 14);
            assert!(
                hits.iter().any(|h| index.entries()[h.entry].page == page),
                "{q} finds {key}"
            );
        }
        assert!(!index.entries().iter().any(|e| e.page == page && e.hidden));
    }
}

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

/// Hovers province `p`'s label point (zoomed in on it) and returns the card shown.
fn hover(app: &mut App, p: ProvinceId) -> Card {
    let s = app
        .world()
        .resource::<Views>()
        .map_static
        .get()
        .shape(p)
        .copied()
        .unwrap();
    let size = app.world().resource::<MapBitmap>().size();
    let m = Vec2::new(s.label.0 as f32, s.label.1 as f32);
    let at = {
        let mut state = app.world_mut().resource_mut::<MapState>();
        let view = state.view;
        let cam = state.camera.as_mut().unwrap();
        cam.zoom(size, view, 8.0, view / 2.0);
        cam.scale = cam.target;
        cam.center = m;
        cam.pan(size, view, Vec2::ZERO);
        cam.to_view(size, view, m)
    };
    app.world_mut().write_message(MapInput::Hover(Some(at)));
    frames(app, 2);
    assert_eq!(app.world().resource::<MapState>().hover, Some(p));
    app.world()
        .resource::<MapCard>()
        .card
        .clone()
        .expect("a card shows")
}

#[test]
fn hovering_the_map_shows_the_province_or_zone_card() {
    let dir = Scratch::new("m8-province-hover");
    let mut app = map_app(&dir);
    let v = app.world().resource::<Views>().clone();
    let index = app.world().resource::<NameIndex>().clone();
    let p = v
        .province_cards
        .get()
        .cards
        .iter()
        .filter(|c| v.map_static.get().shape(c.id).is_some_and(|s| !s.tiny))
        .max_by_key(|c| (c.hqs.len(), std::cmp::Reverse(c.id.0)))
        .unwrap()
        .id;
    let card = hover(&mut app, p);
    assert_eq!(card, cards::card(&PageRef::Province(p), &v, &index));
    // The panel shows the card's lines.
    let panel = app
        .world_mut()
        .query_filtered::<Entity, With<MapCardPanel>>()
        .single(app.world())
        .unwrap();
    let node = app.world().get::<Node>(panel).unwrap();
    assert_eq!(node.display, Display::Flex);
    let mut texts = Vec::new();
    let mut stack = vec![panel];
    while let Some(e) = stack.pop() {
        if let Some(t) = app.world().get::<Text>(e) {
            texts.push(t.0.clone());
        }
        if let Some(c) = app.world().get::<Children>(e) {
            stack.extend(c.iter());
        }
    }
    for l in &card.lines {
        assert!(texts.contains(&l.value), "{} shows", l.value);
    }
    // In the Financial zones mode the card is the province's zone's.
    app.world_mut()
        .write_message(MapModeInput::Set(MapMode::FinancialZones));
    frames(&mut app, 2);
    let card = hover(&mut app, p);
    let z = v.map_layers.get().zone_of(p).unwrap();
    assert_eq!(card, cards::zone_hover_card(z, Some(p), &v, &index));
    // Off the map, no card.
    app.world_mut().write_message(MapInput::Hover(None));
    frames(&mut app, 2);
    assert!(app.world().resource::<MapCard>().card.is_none());
    let node = app.world().get::<Node>(panel).unwrap();
    assert_eq!(node.display, Display::None);
    // And the Province page opens in a pane.
    app.world_mut().write_message(OpenPage {
        page: PageRef::Province(p),
        target: OpenTarget::Focused,
    });
    frames(&mut app, 3);
    let pane = app.world().resource::<Workspace>().focused();
    let drawn = app
        .world_mut()
        .query::<&PaneFrame>()
        .iter(app.world())
        .find(|f| f.pane == pane)
        .and_then(|f| f.drawn_page().cloned());
    assert_eq!(drawn, Some(PageRef::Province(p)));
}
