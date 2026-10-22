//! The per-province colour table the shader reads (M8.2; D638): one RGBA texel per bitmap
//! index in a [`TABLE_W`]-wide texture, RGB the fill, A the flags (bit 0: hatched). Built from
//! `get_map_layer` (v_map_layers) and the index table (v_map_static), so a mode change rewrites
//! only this small table, never the bitmap.

use bevy::color::{Color, ColorToComponents, Hsla, Srgba};
use sim::views::MapStaticView;
use sim::views::map_layers::{LayerValues, MapLayer};

/// Texels a row: the table is `TABLE_W` x `TABLE_W`, 4,096 entries, for up to 4,095 provinces
/// (index 0 is water).
pub const TABLE_W: u32 = 64;
pub const TABLE_LEN: usize = (TABLE_W * TABLE_W) as usize;
/// Flag bits in the alpha byte.
pub const FLAG_HATCHED: u8 = 1;

/// The Political palette (D638): a muted, dark hue per country (golden-ratio steps round the
/// wheel from the ordinal, so neighbours in id order differ), in three lightness steps, on the
/// M9 theme's near-black sea.
pub fn country_color(country: u32) -> [u8; 3] {
    const GOLDEN: f32 = 0.618_034;
    let hue = (country as f32 * GOLDEN).fract() * 360.0;
    let light = [0.27, 0.32, 0.37][(country as usize * 7) % 3];
    let c = Srgba::from(Color::from(Hsla::new(hue, 0.32, light, 1.0)));
    let [r, g, b, _] = c.to_f32_array();
    [to_u8(r), to_u8(g), to_u8(b)]
}

fn to_u8(v: f32) -> u8 {
    (v.clamp(0.0, 1.0) * 255.0).round() as u8
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
            LayerValues::Categories(v) => v.get(o).map_or([0, 0, 0], |&c| country_color(c)),
            LayerValues::Scalars(v) => {
                let t = v.get(o).copied().unwrap_or(0.0).clamp(0.0, 1.0);
                let g = to_u8(0.15 + 0.6 * t);
                [g, g, g]
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
}
