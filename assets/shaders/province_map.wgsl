// The province map (build-plan M8.2; D638): a UI material drawn behind the floating windows.
//
// Per pixel: the camera turns the node's uv into a bitmap point (wrapping east to west, Miller),
// the R16Uint index texture gives the province there (0 is water), the 64 x 64 colour table
// gives its fill and flags (bit 0: hatched, a contested province, decision C), and the border
// distance field (R province, G region, B country edges, in bitmap pixels) draws the lines at
// widths that follow the zoom. Hover and selection lighten the fill and outline the province
// from inside. Flat dark data style on the M9 theme (no terrain).
//
// Written for this game (ideas only from opengs-review.md: the two-texture lookup, texel-centre
// table reads, hatching, a precomputed distance field).

// The UI material vertex output (bevy_ui_render ui_vertex_output), declared here so the shader
// needs no import.
struct UiVertexOutput {
    @location(0) uv: vec2<f32>,
    @location(1) border_widths: vec4<f32>,
    @location(2) border_radius_x: vec4<f32>,
    @location(3) border_radius_y: vec4<f32>,
    @location(4) @interpolate(flat) size: vec2<f32>,
    @builtin(position) position: vec4<f32>,
};

struct MapParams {
    // Bitmap size in pixels.
    map_size: vec2<f32>,
    // The node's size in logical pixels.
    view_size: vec2<f32>,
    // The bitmap point at the node's centre.
    center: vec2<f32>,
    // Bitmap pixels per logical pixel.
    scale: f32,
    // Physical pixels per logical pixel.
    px_ratio: f32,
    // Bitmap indices of the hovered and selected provinces (0: none).
    hover: u32,
    selected: u32,
    // How much of the province and region lines shows at this zoom (0 to 1).
    province_alpha: f32,
    region_alpha: f32,
    sea: vec4<f32>,
    line: vec4<f32>,
    accent: vec4<f32>,
    hatch: vec4<f32>,
};

@group(1) @binding(0) var<uniform> params: MapParams;
@group(1) @binding(1) var index_tex: texture_2d<u32>;
@group(1) @binding(2) var border_tex: texture_2d<f32>;
@group(1) @binding(3) var border_samp: sampler;
@group(1) @binding(4) var color_tex: texture_2d<f32>;

const TABLE_W: u32 = 64u;
// Line widths in logical pixels: country, region, province, and the hover and selection
// outlines.
const COUNTRY_W: f32 = 1.4;
const REGION_W: f32 = 0.9;
const PROVINCE_W: f32 = 0.7;
const OUTLINE_W: f32 = 2.2;
// The hatch stripes' period in logical pixels.
const HATCH_PERIOD: f32 = 7.0;

// Coverage of a line `w` wide at distance `d` (both logical pixels), antialiased over a
// physical pixel.
fn line_cover(d: f32, w: f32) -> f32 {
    let aa = 0.75 / params.px_ratio;
    return 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, d);
}

@fragment
fn fragment(in: UiVertexOutput) -> @location(0) vec4<f32> {
    let p = params.center + (in.uv - vec2<f32>(0.5)) * params.view_size * params.scale;
    if (p.y < 0.0 || p.y >= params.map_size.y) {
        return params.sea * 0.8;
    }
    let x = p.x - floor(p.x / params.map_size.x) * params.map_size.x;
    let texel = vec2<i32>(clamp(vec2<f32>(x, p.y), vec2<f32>(0.0), params.map_size - 1.0));
    let id = textureLoad(index_tex, texel, 0).r;

    // Distances to the nearest edges, in logical pixels.
    let duv = vec2<f32>(x, p.y) / params.map_size;
    let d = textureSampleLevel(border_tex, border_samp, duv, 0.0).rgb * 255.0 / params.scale;

    var col: vec3<f32>;
    if (id == 0u) {
        col = params.sea.rgb;
    } else {
        let t = textureLoad(color_tex, vec2<i32>(i32(id % TABLE_W), i32(id / TABLE_W)), 0);
        col = t.rgb;
        let flags = u32(t.a * 255.0 + 0.5);
        if ((flags & 1u) != 0u) {
            let s = (in.position.x + in.position.y) / (HATCH_PERIOD * params.px_ratio);
            if (fract(s) < 0.45) {
                col = mix(col, params.hatch.rgb, params.hatch.a);
            }
        }
        if (id == params.selected) {
            col = mix(col, params.accent.rgb, 0.22);
        } else if (id == params.hover) {
            col = mix(col, vec3<f32>(1.0), 0.12);
        }
    }

    // Lines: province, then region, then country on top.
    col = mix(col, params.line.rgb, line_cover(d.r, PROVINCE_W) * params.province_alpha * 0.55);
    col = mix(col, params.line.rgb, line_cover(d.g, REGION_W) * params.region_alpha * 0.75);
    col = mix(col, params.line.rgb, line_cover(d.b, COUNTRY_W));

    // The hovered and selected provinces' outlines, inside their edge.
    if (id != 0u && id == params.selected) {
        col = mix(col, params.accent.rgb, line_cover(d.r, OUTLINE_W * 2.0));
    } else if (id != 0u && id == params.hover) {
        col = mix(col, vec3<f32>(0.92), line_cover(d.r, OUTLINE_W * 2.0) * 0.85);
    }
    return vec4<f32>(col, 1.0);
}
