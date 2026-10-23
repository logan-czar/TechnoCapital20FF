//! M8.5 map modes (spec 8 Map row, 9.2 `get_map_layer(mode, param)`, 9.4; D700, D701): every
//! mode's values come from the views, a private company's figures as the bands' estimates
//! (never their truth), and each mode names the views it reads so the map redraws only when
//! one of them moves.

mod common;

use sim::views::map_layers::{
    DevTrack, HqFilter, LayerStyle, LayerValues, MapMode, PinTarget, ScaleUnit,
};
use sim::world::{IndustryId, Ordinal};
use sim::{Control, Sim};

fn scalars(v: &LayerValues) -> &[f32] {
    match v {
        LayerValues::Scalars(s) => s,
        LayerValues::Categories(_) => panic!("a scalar layer"),
    }
}

#[test]
fn development_shows_each_track_and_the_total() {
    let sim = Sim::new(common::data(), 1).unwrap();
    let v = sim.views();
    let cards = v.province_cards.get();
    for t in DevTrack::ALL {
        let l = v.get_map_layer(MapMode::Development(t));
        assert_eq!(l.style, LayerStyle::Sequential);
        let s = l.scale.as_ref().unwrap();
        assert_eq!(s.unit, ScaleUnit::Points);
        assert!(s.low >= 0.0 && s.high <= t.max() && s.low < s.high);
        for (c, &x) in cards.cards.iter().zip(scalars(&l.values)) {
            let want = match t {
                DevTrack::Commerce => c.commerce,
                DevTrack::Industry => c.industry,
                DevTrack::Population => c.population,
                DevTrack::Total => c.total,
            };
            assert_eq!(x, want as f32, "{} {}", c.key, t.name());
            assert!(f64::from(x) >= s.low && f64::from(x) <= s.high);
        }
    }
    // The Industry mode with no industry picked is the Industry track.
    assert_eq!(
        v.get_map_layer(MapMode::Industry(None)).values,
        v.get_map_layer(MapMode::Development(DevTrack::Industry))
            .values
    );
}

#[test]
fn an_industry_s_assets_are_the_units_shown() {
    let sim = Sim::new(common::data(), 1).unwrap();
    let v = sim.views();
    let units = &v.units.get().units;
    let mut banded_seen = false;
    for i in 0..v.industry_rows.get().rows.len() {
        let id = IndustryId::from_index(i);
        let l = v.get_map_layer(MapMode::Industry(Some(id)));
        let vals = scalars(&l.values);
        let mut want = vec![0.0f64; vals.len()];
        for u in units.iter().filter(|u| u.industry == id) {
            want[u.base_province.index()] += u.gross_assets.shown().max(0.0);
            banded_seen |= u.gross_assets.is_band();
        }
        for (p, (&got, &w)) in vals.iter().zip(&want).enumerate() {
            assert_eq!(got, w as f32, "industry {i} province {p}");
        }
        let s = l.scale.unwrap();
        assert_eq!(s.unit, ScaleUnit::Money);
        assert_eq!(s.high, want.iter().copied().fold(0.0, f64::max));
    }
    assert!(banded_seen, "some units show bands");
}

#[test]
fn hq_pins_are_sized_by_the_revenue_shown_and_filter() {
    let sim = Sim::new(common::data(), 1).unwrap();
    let v = sim.views();
    let rows = &v.company_rows.get().rows;
    let detail = v.company_detail.get();
    let l = v.get_map_layer(MapMode::CompanyHqs(HqFilter::default()));
    assert_eq!(l.style, LayerStyle::Muted);
    assert_eq!(l.pins.len(), rows.len(), "one pin per company in the game");
    assert_eq!(l.legend.len(), 7, "the seven sectors");
    for (pin, r) in l.pins.iter().zip(rows) {
        assert_eq!(pin.target, PinTarget::Company(r.id));
        assert_eq!(pin.size, r.revenue_ttm.shown(), "{}", r.name);
        assert_eq!(pin.province, detail.get(r.id).unwrap().hq_province);
        let sector = &v.industry_rows.get().get(r.industry).unwrap().sector;
        assert_eq!(&l.legend[pin.category as usize].label, sector);
    }
    // Filters: industry, country, listed.
    let r0 = &rows[0];
    let f = HqFilter {
        industry: Some(r0.industry),
        country: Some(r0.hq_country),
        listed: Some(r0.public),
    };
    let l = v.get_map_layer(MapMode::CompanyHqs(f));
    let want: Vec<_> = rows
        .iter()
        .filter(|r| {
            r.industry == r0.industry && r.hq_country == r0.hq_country && r.public == r0.public
        })
        .map(|r| PinTarget::Company(r.id))
        .collect();
    assert_eq!(l.pins.iter().map(|p| p.target).collect::<Vec<_>>(), want);
    let private = v.get_map_layer(MapMode::CompanyHqs(HqFilter {
        listed: Some(false),
        ..HqFilter::default()
    }));
    assert_eq!(
        private.pins.len(),
        rows.iter().filter(|r| !r.public).count()
    );
}

/// With Omniscient off, no private company's pin is sized by its true revenue, and no heat map
/// holds a true unit figure (debug only: Omniscient is compiled out of release, spec 1).
#[cfg(debug_assertions)]
#[test]
fn no_pin_or_heat_value_is_a_private_truth() {
    let plain = Sim::new(common::data(), 1).unwrap();
    let mut truth = Sim::new(common::data(), 1).unwrap();
    truth.apply(Control::SetOmniscient(true)).unwrap();
    let (n, o) = (plain.views(), truth.views());
    let pins = |v: &sim::SimViews| {
        v.get_map_layer(MapMode::CompanyHqs(HqFilter::default()))
            .pins
    };
    let (np, op) = (pins(n), pins(o));
    let rows = &n.company_rows.get().rows;
    let mut checked = 0;
    for ((a, b), r) in np.iter().zip(&op).zip(rows) {
        if r.estimated {
            assert_ne!(a.size, b.size, "{}'s pin is sized by its truth", r.name);
            checked += 1;
        } else {
            assert_eq!(a.size, b.size);
        }
    }
    assert!(checked > 100, "{checked} private pins");
    // A province whose only units of an industry are banded never shows the true sum.
    let mut differ = 0;
    for i in 0..n.industry_rows.get().rows.len() {
        let id = IndustryId::from_index(i);
        let a = n.get_map_layer(MapMode::Industry(Some(id)));
        let b = o.get_map_layer(MapMode::Industry(Some(id)));
        for (p, (x, y)) in scalars(&a.values)
            .iter()
            .zip(scalars(&b.values))
            .enumerate()
        {
            let banded = n.units.get().units.iter().any(|u| {
                u.industry == id && u.base_province.index() == p && u.gross_assets.is_band()
            });
            if banded && *y > 0.0 {
                assert_ne!(x, y, "industry {i} province {p} shows its truth");
                differ += 1;
            }
        }
    }
    assert!(differ > 50, "{differ}");
}

#[test]
fn financial_zones_shade_by_the_zone_effect_with_hub_pins() {
    let sim = Sim::new(common::data(), 1).unwrap();
    let v = sim.views();
    let l = v.get_map_layer(MapMode::FinancialZones);
    assert_eq!(l.style, LayerStyle::Diverging);
    let cycle = v.cycle.get();
    let places = v.places.get();
    let countries = v.countries.get();
    for (p, &x) in places.provinces.iter().zip(scalars(&l.values)) {
        let zone = countries.get(p.country).unwrap().zone;
        let effect = cycle.zones.iter().find(|z| z.id == zone).unwrap().effect;
        assert_eq!(x, effect as f32, "{}", p.key);
        assert_eq!(v.map_layers.get().zone_of(p.id), Some(zone));
    }
    // Macau is its own zone, apart from China's (batch 153).
    let zone_of = |key: &str| {
        let p = places.provinces.iter().find(|p| p.key == key).unwrap();
        v.map_layers.get().zone_of(p.id).unwrap()
    };
    assert_ne!(zone_of("MO-0001"), zone_of("CN-0001"));
    assert_eq!(cycle.zones.len(), 26);
    // A pin on each hub with its exchange code and index level.
    assert_eq!(l.pins.len(), 26);
    for (pin, x) in l.pins.iter().zip(&v.exchanges.get().exchanges) {
        assert_eq!(pin.target, PinTarget::Exchange(x.zone));
        assert_eq!(pin.province, x.hub_province);
        assert_eq!(pin.code, x.code);
        assert_eq!(pin.level, x.level);
    }
    // The legend: the global phase, g_t and quarters left.
    let notes: Vec<&str> = l.notes.iter().map(|(k, _)| k.as_str()).collect();
    assert_eq!(notes, ["Global phase", "g_t", "Quarters left"]);
    assert_eq!(l.notes[0].1, cycle.phase.name());
    assert_eq!(l.notes[2].1, cycle.quarters_left.to_string());
    let s = l.scale.unwrap();
    assert_eq!(s.low, -s.high);
}

#[test]
fn each_mode_names_the_views_it_reads() {
    let mut sim = Sim::new(common::data(), 1).unwrap();
    let before = sim.views().map_layer_versions(MapMode::FinancialZones);
    let political = sim.views().map_layer_versions(MapMode::Political);
    assert_eq!(political[1..], [0, 0]);
    // A day: v_cycle and v_exchanges move (daily), v_map_layers does not (monthly).
    for _ in 0..24 {
        sim.step();
    }
    let after = sim.views().map_layer_versions(MapMode::FinancialZones);
    assert_eq!(after[0], before[0]);
    assert_ne!(after[1], before[1]);
    assert_eq!(
        sim.views().map_layer_versions(MapMode::Political),
        political
    );
}
