//! The per-province colour table the shader reads (M8.2; D638): one RGBA texel per bitmap
//! index in a [`TABLE_W`]-wide texture, RGB the fill, A the flags (bit 0: hatched). Built from
//! `get_map_layer` (v_map_layers) and the index table (v_map_static), so a mode change rewrites
//! only this small table, never the bitmap. A second table of the same shape holds each
//! index's Metro (for the Metro outlines, M8.5), written once from v_map_static.
//!
//! Palettes (D702), on the flat dark style: Political a muted hue per country; Company HQs the
//! same, dimmed under the pins; the Development and Industry heat maps a ramp from the dark
//! panel grey to the mode's accent (green for development, amber for an industry's assets, the
//! money figures by square root so small holdings show); the Financial zones a diverging ramp
//! through the panel grey, magenta below zero and cyan above (spec 11.4's loss and gain).

use bevy::color::{Color, ColorToComponents, Hsla, Srgba};
use sim::views::MapStaticView;
use sim::views::map_layers::{LayerScale, LayerStyle, LayerValues, MapLayer, MapMode, ScaleUnit};

/// Texels a row: the table is `TABLE_W` x `TABLE_W`, 4,096 entries, for up to 4,095 provinces
/// (index 0 is water): sim-data's `MAX_MAP_PROVINCES`, which the loader enforces (a game test
/// keeps the two equal).
pub const TABLE_W: u32 = 64;
pub const TABLE_LEN: usize = (TABLE_W * TABLE_W) as usize;
/// Flag bits in the alpha byte.
pub const FLAG_HATCHED: u8 = 1;
/// The legend's swatch for hatched (contested) provinces.
pub const HATCH_SWATCH: [u8; 3] = [120, 40, 104];
/// How much of the countries' colour the Company HQs mode keeps under its pins.
pub const MUTED_SHARE: f32 = 0.45;
/// A heat map's low end (the panel grey, a little lifted) and the zone ramp's neutral.
pub const RAMP_LOW: [u8; 3] = [24, 30, 42];
pub const RAMP_NEUTRAL: [u8; 3] = [40, 46, 58];
/// How far a heat map's top value goes towards the accent.
pub const RAMP_REACH: f32 = 0.85;

/// The Political palette (D638): a muted, dark hue per country (golden-ratio steps round the
/// wheel from the ordinal, so neighbours in id order differ), in three lightness steps, on the
/// M9 theme's near-black sea.
pub fn country_color(country: u32) -> [u8; 3] {
    const GOLDEN: f32 = 0.618_034;
    let hue = (country as f32 * GOLDEN).fract() * 360.0;
    let light = [0.27, 0.32, 0.37][(country as usize * 7) % 3];
    hsl(hue, 0.32, light)
}

/// An HQ pin's colour by its sector's index (D702): bright, evenly spaced hues, so seven
/// sectors read apart on the muted map.
pub fn sector_color(sector: u32) -> [u8; 3] {
    let hue = (sector as f32 * 360.0 / 7.0 + 18.0) % 360.0;
    hsl(hue, 0.85, 0.62)
}

fn hsl(hue: f32, s: f32, l: f32) -> [u8; 3] {
    let c = Srgba::from(Color::from(Hsla::new(hue, s, l, 1.0)));
    let [r, g, b, _] = c.to_f32_array();
    [to_u8(r), to_u8(g), to_u8(b)]
}

fn to_u8(v: f32) -> u8 {
    (v.clamp(0.0, 1.0) * 255.0).round() as u8
}

fn srgb(c: Color) -> [u8; 3] {
    let [r, g, b, _] = Srgba::from(c).to_f32_array();
    [to_u8(r), to_u8(g), to_u8(b)]
}

fn mix(a: [u8; 3], b: [u8; 3], t: f32) -> [u8; 3] {
    let t = t.clamp(0.0, 1.0);
    let m = |x: u8, y: u8| (f32::from(x) + (f32::from(y) - f32::from(x)) * t).round() as u8;
    [m(a[0], b[0]), m(a[1], b[1]), m(a[2], b[2])]
}

/// The accent of a heat map mode.
fn accent(mode: MapMode) -> [u8; 3] {
    use crate::ui::theme::color;
    match mode {
        MapMode::Industry(Some(_)) => srgb(color::AMBER),
        _ => srgb(color::GREEN),
    }
}

/// Where `v` sits on a scale: 0 to 1 (sequential; money by square root), or -1 to 1 (diverging).
pub fn unit_of(s: &LayerScale, v: f32) -> f32 {
    let (lo, hi) = (s.low as f32, s.high as f32);
    if lo < 0.0 && hi > 0.0 {
        return (v / hi).clamp(-1.0, 1.0);
    }
    if hi <= lo {
        return 0.0;
    }
    let t = ((v - lo) / (hi - lo)).clamp(0.0, 1.0);
    if s.unit == ScaleUnit::Money {
        t.sqrt()
    } else {
        t
    }
}

/// A scalar's colour at `t` from [`unit_of`].
pub fn scalar_color(style: LayerStyle, mode: MapMode, t: f32) -> [u8; 3] {
    use crate::ui::theme::color;
    match style {
        LayerStyle::Diverging => {
            let far = if t < 0.0 {
                srgb(color::MAGENTA)
            } else {
                srgb(color::CYAN)
            };
            mix(RAMP_NEUTRAL, far, t.abs() * RAMP_REACH)
        }
        _ => mix(RAMP_LOW, accent(mode), t * RAMP_REACH),
    }
}

/// The table for `layer`: each bitmap index's province's fill and flags; unused entries and
/// index 0 are transparent black (the shader draws water there).
pub fn table(layer: &MapLayer, statics: &MapStaticView) -> Vec<[u8; 4]> {
    let mut out = vec![[0u8; 4]; TABLE_LEN];
    let Some(geo) = &statics.geo else {
        return out;
    };
    for (i, &p) in geo.index.iter().enumerate().take(TABLE_LEN - 1) {
        let o = p.0 as usize;
        let [r, g, b] = match &layer.values {
            LayerValues::Categories(v) => {
                let c = v.get(o).map_or([0, 0, 0], |&c| country_color(c));
                if layer.style == LayerStyle::Muted {
                    mix(RAMP_LOW, c, MUTED_SHARE)
                } else {
                    c
                }
            }
            LayerValues::Scalars(v) => {
                let x = v.get(o).copied().unwrap_or(0.0);
                let t = layer.scale.as_ref().map_or(0.0, |s| unit_of(s, x));
                scalar_color(layer.style, layer.mode, t)
            }
        };
        let flags = if layer.hatched.get(o).copied().unwrap_or(false) {
            FLAG_HATCHED
        } else {
            0
        };
        out[i + 1] = [r, g, b, flags];
    }
    out
}

/// Each bitmap index's Metro, 1-based (0: none or water), for the Metro outlines.
pub fn metro_table(statics: &MapStaticView) -> Vec<u16> {
    let mut out = vec![0u16; TABLE_LEN];
    let Some(geo) = &statics.geo else {
        return out;
    };
    for (i, &p) in geo.index.iter().enumerate().take(TABLE_LEN - 1) {
        if let Some(m) = statics.provinces.get(p.0 as usize).and_then(|p| p.metro) {
            out[i + 1] = (m + 1).min(u32::from(u16::MAX)) as u16;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn countries_get_distinct_dark_colors() {
        let mut seen = Vec::new();
        for c in 0..211 {
            let [r, g, b] = country_color(c);
            let max = r.max(g).max(b);
            assert!(max < 160, "dark: {r} {g} {b}");
            assert!(max > 40, "not black");
            seen.push([r, g, b]);
        }
        // Consecutive countries (often neighbours) never share a colour.
        for w in seen.windows(2) {
            assert_ne!(w[0], w[1]);
        }
    }

    #[test]
    fn sectors_differ_and_stand_out() {
        let c: Vec<[u8; 3]> = (0..7).map(sector_color).collect();
        for (i, a) in c.iter().enumerate() {
            assert!(*a.iter().max().unwrap() > 150, "bright");
            for b in &c[i + 1..] {
                assert_ne!(a, b);
            }
        }
    }

    #[test]
    fn ramps_run_from_dark_to_the_accent() {
        let s = LayerScale {
            low: 0.0,
            high: 30.0,
            unit: ScaleUnit::Points,
            label: String::new(),
        };
        let mode = MapMode::Development(Default::default());
        assert_eq!(unit_of(&s, 0.0), 0.0);
        assert_eq!(unit_of(&s, 30.0), 1.0);
        assert_eq!(scalar_color(LayerStyle::Sequential, mode, 0.0), RAMP_LOW);
        let d = LayerScale {
            low: -0.2,
            high: 0.2,
            unit: ScaleUnit::Rate,
            label: String::new(),
        };
        assert_eq!(unit_of(&d, -0.2), -1.0);
        assert_eq!(unit_of(&d, 0.0), 0.0);
        let neg = scalar_color(LayerStyle::Diverging, MapMode::FinancialZones, -1.0);
        let pos = scalar_color(LayerStyle::Diverging, MapMode::FinancialZones, 1.0);
        assert!(neg[0] > neg[1], "magenta below zero");
        assert!(pos[2] > pos[0], "cyan above");
    }
}
