//! The map's textures and material (M8.1, M8.2; D638), added by the app only (tests run the
//! shell without a renderer):
//!
//! - `province-index.png` as an R16Uint texture (nearest, no mipmaps), from the CPU copy the
//!   picking reads;
//! - `province-borders.png` as an RGBA8 texture, linearly filtered, wrapping east to west, so
//!   the distance field gives smooth lines at any zoom;
//! - the per-province colour table (64 x 64 RGBA8), rewritten when the current layer moves
//!   (the mode changed or a view it reads moved its version; M8.5);
//! - the per-province Metro table (64 x 64 R16Uint), for the Metro outlines;
//! - [`ProvinceMapMaterial`], the UI material running `assets/shaders/province_map.wgsl` on the
//!   map node. The WGSL is compiled into the binary ([`SHADER_SOURCE`]) and registered under a
//!   fixed handle, never read from an asset folder at run time, so the shader always matches
//!   the [`MapParams`] it was built with (D741); a test checks the two layouts field by field.
//!
//! The big textures keep no CPU copy once uploaded (render world only).

use bevy::asset::RenderAssetUsages;
use bevy::asset::uuid_handle;
use bevy::image::{ImageAddressMode, ImageFilterMode, ImageSampler, ImageSamplerDescriptor};
use bevy::prelude::*;
use bevy::render::render_resource::{
    AsBindGroup, Extent3d, ShaderType, TextureDimension, TextureFormat,
};
use bevy::shader::{Shader, ShaderRef};
use bevy::ui_render::prelude::{MaterialNode, UiMaterial, UiMaterialPlugin};
use bevy::window::PrimaryWindow;

use super::camera::ZoomLevel;
use super::colors::{TABLE_LEN, TABLE_W, metro_table, table};
use super::modes::{CurrentLayer, MapModeState};
use super::picking::MapBitmap;
use super::{MapLoad, MapSource, MapState, MapView, png_io, sim_data_names};
use crate::bridge::Views;
use crate::ui::UiSystems;
use crate::ui::theme::color;

/// The shader's file, under the repository's asset folder (its name in shader errors).
pub const SHADER: &str = "shaders/province_map.wgsl";

/// The shader's source, compiled in from `assets/shaders/province_map.wgsl` (D741). A shader
/// read from disk at run time could come from another build's tree than the binary's: a stale
/// `target/release/game` run against an updated checkout drew with a WGSL `MapParams` of 128
/// bytes (with `metro`) over a pipeline layout of 112 (the binary's struct without it).
pub const SHADER_SOURCE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../assets/shaders/province_map.wgsl"
));

/// The fixed handle the compiled-in shader is registered under.
pub const SHADER_HANDLE: Handle<Shader> = uuid_handle!("6b1f6a52-8c1e-4d0b-9a57-3c2e7d4f8a10");

/// The map shader's uniform (field order as in the WGSL `MapParams`).
#[derive(ShaderType, Debug, Clone, Copy, PartialEq, Default)]
pub struct MapParams {
    pub map_size: Vec2,
    pub view_size: Vec2,
    pub center: Vec2,
    pub scale: f32,
    pub px_ratio: f32,
    pub hover: u32,
    pub selected: u32,
    pub province_alpha: f32,
    pub region_alpha: f32,
    pub sea: Vec4,
    pub line: Vec4,
    pub accent: Vec4,
    pub hatch: Vec4,
    /// The Metro outlines' colour; alpha 0 hides them (M8.5).
    pub metro: Vec4,
}

/// The province map material (M8.2).
#[derive(Asset, TypePath, AsBindGroup, Debug, Clone)]
pub struct ProvinceMapMaterial {
    #[uniform(0)]
    pub params: MapParams,
    #[texture(1, sample_type = "u_int")]
    pub index: Handle<Image>,
    #[texture(2)]
    #[sampler(3)]
    pub borders: Handle<Image>,
    #[texture(4)]
    pub colors: Handle<Image>,
    #[texture(5, sample_type = "u_int")]
    pub metros: Handle<Image>,
}

impl UiMaterial for ProvinceMapMaterial {
    fn fragment_shader() -> ShaderRef {
        ShaderRef::Handle(SHADER_HANDLE)
    }
}

/// The map's GPU handles.
#[derive(Resource, Debug, Clone)]
pub struct MapGpu {
    pub material: Handle<ProvinceMapMaterial>,
    pub colors: Handle<Image>,
    pub metros: Handle<Image>,
    /// The current layer's generation and v_map_static's version the colour table was written
    /// from.
    colors_from: Option<(u64, u64)>,
    /// v_map_static's version the Metro table was written from.
    metros_from: Option<u64>,
}

impl MapGpu {
    /// The current layer's generation the colour table shows (the bench waits for it).
    pub fn colors_generation(&self) -> Option<u64> {
        self.colors_from.map(|(g, _)| g)
    }
}

pub struct MapRenderPlugin;

impl Plugin for MapRenderPlugin {
    fn build(&self, app: &mut App) {
        // The shader the binary was built with, before the material's pipeline can ask for it.
        app.world_mut()
            .resource_mut::<Assets<Shader>>()
            .insert(&SHADER_HANDLE, Shader::from_wgsl(SHADER_SOURCE, SHADER))
            .expect("a uuid handle is always valid");
        app.add_plugins(UiMaterialPlugin::<ProvinceMapMaterial>::default())
            .add_systems(Startup, setup_render.after(MapLoad))
            .add_systems(
                Update,
                (sync_colors, sync_metros, sync_params)
                    .chain()
                    .in_set(UiSystems::Show),
            );
    }
}

/// The line colour, the sea and the accents of the flat dark style (D638): the M9 theme's
/// background for the sea, its hairline grey brightened for borders, cyan for the selection and
/// magenta stripes for contested provinces.
fn style() -> (Vec4, Vec4, Vec4, Vec4) {
    // The shader writes linear colour to an sRGB target.
    let v = |c: Color| Vec4::from_array(c.to_linear().to_f32_array());
    let sea = Color::srgb(0.031, 0.039, 0.055);
    let line = Color::srgb(0.62, 0.66, 0.74);
    let mut hatch = v(color::MAGENTA);
    hatch.w = 0.35;
    (v(sea), v(line), v(color::CYAN), hatch)
}

#[allow(clippy::too_many_arguments)]
fn setup_render(
    mut commands: Commands,
    source: Res<MapSource>,
    bitmap: Option<Res<MapBitmap>>,
    mut images: ResMut<Assets<Image>>,
    mut materials: ResMut<Assets<ProvinceMapMaterial>>,
    view: Query<Entity, With<MapView>>,
) {
    let (Some(dir), Some(bitmap), Ok(view)) = (&source.0, bitmap, view.single()) else {
        return;
    };
    let size = Extent3d {
        width: bitmap.width,
        height: bitmap.height,
        depth_or_array_layers: 1,
    };
    let bytes: Vec<u8> = bitmap.data.iter().flat_map(|v| v.to_ne_bytes()).collect();
    let mut index = Image::new(
        size,
        TextureDimension::D2,
        bytes,
        TextureFormat::R16Uint,
        RenderAssetUsages::RENDER_WORLD,
    );
    index.sampler = ImageSampler::nearest();
    // The border field, RGB to RGBA; a missing or mismatched file draws no lines.
    let path = dir.join(sim_data_names::PROVINCE_BORDERS_PNG);
    let border_rgba: Vec<u8> = match png_io::read_rgb8(&path) {
        Ok(r) if r.width == bitmap.width && r.height == bitmap.height => r
            .data
            .iter()
            .flat_map(|&[a, b, c]| [a, b, c, 255])
            .collect(),
        Ok(r) => {
            error!(
                "map: {} is {} x {}, the index {} x {}",
                path.display(),
                r.width,
                r.height,
                bitmap.width,
                bitmap.height
            );
            vec![255; size.width as usize * size.height as usize * 4]
        }
        Err(e) => {
            error!("map: {e}");
            vec![255; size.width as usize * size.height as usize * 4]
        }
    };
    let mut borders = Image::new(
        size,
        TextureDimension::D2,
        border_rgba,
        TextureFormat::Rgba8Unorm,
        RenderAssetUsages::RENDER_WORLD,
    );
    borders.sampler = ImageSampler::Descriptor(ImageSamplerDescriptor {
        address_mode_u: ImageAddressMode::Repeat,
        address_mode_v: ImageAddressMode::ClampToEdge,
        mag_filter: ImageFilterMode::Linear,
        min_filter: ImageFilterMode::Linear,
        ..ImageSamplerDescriptor::linear()
    });
    let mut colors = Image::new(
        Extent3d {
            width: TABLE_W,
            height: TABLE_W,
            depth_or_array_layers: 1,
        },
        TextureDimension::D2,
        vec![0; TABLE_LEN * 4],
        // sRGB, so the fills sample as the palette's colours (the alpha flags stay linear).
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::RENDER_WORLD | RenderAssetUsages::MAIN_WORLD,
    );
    colors.sampler = ImageSampler::nearest();
    let colors = images.add(colors);
    let mut metros = Image::new(
        Extent3d {
            width: TABLE_W,
            height: TABLE_W,
            depth_or_array_layers: 1,
        },
        TextureDimension::D2,
        vec![0; TABLE_LEN * 2],
        TextureFormat::R16Uint,
        RenderAssetUsages::RENDER_WORLD | RenderAssetUsages::MAIN_WORLD,
    );
    metros.sampler = ImageSampler::nearest();
    let metros = images.add(metros);
    let (sea, line, accent, hatch) = style();
    let material = materials.add(ProvinceMapMaterial {
        params: MapParams {
            map_size: bitmap.size(),
            sea,
            line,
            accent,
            hatch,
            px_ratio: 1.0,
            scale: 1.0,
            view_size: Vec2::ONE,
            metro: metro_color(false),
            ..default()
        },
        index: images.add(index),
        borders: images.add(borders),
        colors: colors.clone(),
        metros: metros.clone(),
    });
    commands
        .entity(view)
        .insert(MaterialNode(material.clone()))
        .remove::<BackgroundColor>();
    commands.insert_resource(MapGpu {
        material,
        colors,
        metros,
        colors_from: None,
        metros_from: None,
    });
}

/// Rewrites the colour table when the current layer moves (M8.5: a mode change, or a view the
/// mode reads moving its version) or v_map_static does.
fn sync_colors(
    views: Res<Views>,
    layer: Res<CurrentLayer>,
    gpu: Option<ResMut<MapGpu>>,
    mut images: ResMut<Assets<Image>>,
) {
    let Some(mut gpu) = gpu else { return };
    let from = (layer.generation, views.map_static.version());
    if gpu.colors_from == Some(from) {
        return;
    }
    let t = table(&layer.layer, views.map_static.get());
    if let Some(mut img) = images.get_mut(&gpu.colors) {
        img.data = Some(t.into_iter().flatten().collect());
        gpu.colors_from = Some(from);
    }
}

/// Writes the Metro table when v_map_static moves (once a game).
fn sync_metros(views: Res<Views>, gpu: Option<ResMut<MapGpu>>, mut images: ResMut<Assets<Image>>) {
    let Some(mut gpu) = gpu else { return };
    let v = views.map_static.version();
    if gpu.metros_from == Some(v) {
        return;
    }
    let t = metro_table(views.map_static.get());
    if let Some(mut img) = images.get_mut(&gpu.metros) {
        img.data = Some(t.iter().flat_map(|m| m.to_ne_bytes()).collect());
        gpu.metros_from = Some(v);
    }
}

/// The Metro outlines' colour: amber, alpha 0 when off.
fn metro_color(on: bool) -> Vec4 {
    let mut c = Vec4::from_array(color::AMBER.to_linear().to_f32_array());
    c.w = if on { 0.9 } else { 0.0 };
    c
}

/// The line fade-ins by zoom (D636): province lines from Country towards Province zoom, region
/// lines from World towards Country zoom.
fn line_alphas(span_deg: f32) -> (f32, f32) {
    use super::camera::{PROVINCE_BELOW_DEG, WORLD_ABOVE_DEG};
    let fade = |far: f32, near: f32| ((far - span_deg) / (far - near)).clamp(0.0, 1.0);
    (
        fade(PROVINCE_BELOW_DEG * 2.0, PROVINCE_BELOW_DEG),
        fade(WORLD_ABOVE_DEG * 1.6, WORLD_ABOVE_DEG),
    )
}

/// The uniform from the camera, hover and selection; written only when it changed.
#[allow(clippy::too_many_arguments)]
fn sync_params(
    state: Res<MapState>,
    modes: Res<MapModeState>,
    views: Res<Views>,
    gpu: Option<Res<MapGpu>>,
    bitmap: Option<Res<MapBitmap>>,
    window: Query<&Window, With<PrimaryWindow>>,
    mut materials: ResMut<Assets<ProvinceMapMaterial>>,
) {
    let (Some(gpu), Some(bitmap), Some(cam)) = (gpu, bitmap, state.camera) else {
        return;
    };
    let statics = views.map_static.get();
    let index_of = |p: Option<sim::world::ProvinceId>| {
        p.and_then(|p| statics.shape(p))
            .map_or(0, |s| u32::from(s.index))
    };
    let map = bitmap.size();
    let span = cam.span_deg(map, state.view);
    let (province_alpha, region_alpha) = line_alphas(span);
    let _level: ZoomLevel = cam.level(map, state.view);
    let px_ratio = window.single().map_or(1.0, |w| w.scale_factor());
    let Some(m) = materials.get(&gpu.material) else {
        return;
    };
    let want = MapParams {
        map_size: map,
        view_size: state.view,
        center: cam.center,
        scale: cam.scale,
        px_ratio,
        hover: index_of(state.hover),
        selected: index_of(state.selected),
        province_alpha,
        region_alpha,
        metro: metro_color(modes.metros),
        ..m.params
    };
    if m.params != want
        && let Some(mut m) = materials.get_mut(&gpu.material)
    {
        m.params = want;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bevy::render::render_resource::encase::UniformBuffer;

    /// The WGSL `MapParams` and the Rust one share one layout (D741): the same size (the
    /// pipeline layout's `min_binding_size` is the Rust struct's, the shader's is the WGSL
    /// struct's), the same members, and every Rust field lands at the offset the WGSL member
    /// reads it from.
    #[test]
    fn the_shader_and_the_rust_map_params_share_one_layout() {
        let module = naga::front::wgsl::parse_str(SHADER_SOURCE).expect("the map shader parses");
        let ty = module
            .types
            .iter()
            .map(|(_, t)| t)
            .find(|t| t.name.as_deref() == Some("MapParams"))
            .expect("struct MapParams");
        let naga::TypeInner::Struct { members, span } = &ty.inner else {
            panic!("MapParams is a struct")
        };
        assert_eq!(
            u64::from(*span),
            MapParams::min_size().get(),
            "WGSL MapParams and Rust MapParams differ in size"
        );
        // Distinct values in every field, written as the uniform buffer writes them.
        let p = MapParams {
            map_size: Vec2::new(1.0, 2.0),
            view_size: Vec2::new(3.0, 4.0),
            center: Vec2::new(5.0, 6.0),
            scale: 7.0,
            px_ratio: 8.0,
            hover: 9,
            selected: 10,
            province_alpha: 11.0,
            region_alpha: 12.0,
            sea: Vec4::new(13.0, 14.0, 15.0, 16.0),
            line: Vec4::new(17.0, 18.0, 19.0, 20.0),
            accent: Vec4::new(21.0, 22.0, 23.0, 24.0),
            hatch: Vec4::new(25.0, 26.0, 27.0, 28.0),
            metro: Vec4::new(29.0, 30.0, 31.0, 32.0),
        };
        let mut buf = UniformBuffer::new(Vec::<u8>::new());
        buf.write(&p).unwrap();
        let bytes = buf.into_inner();
        let f = |v: &[f32]| v.iter().flat_map(|x| x.to_le_bytes()).collect::<Vec<u8>>();
        let expect = |name: &str| -> Vec<u8> {
            match name {
                "map_size" => f(&p.map_size.to_array()),
                "view_size" => f(&p.view_size.to_array()),
                "center" => f(&p.center.to_array()),
                "scale" => f(&[p.scale]),
                "px_ratio" => f(&[p.px_ratio]),
                "hover" => p.hover.to_le_bytes().to_vec(),
                "selected" => p.selected.to_le_bytes().to_vec(),
                "province_alpha" => f(&[p.province_alpha]),
                "region_alpha" => f(&[p.region_alpha]),
                "sea" => f(&p.sea.to_array()),
                "line" => f(&p.line.to_array()),
                "accent" => f(&p.accent.to_array()),
                "hatch" => f(&p.hatch.to_array()),
                "metro" => f(&p.metro.to_array()),
                other => panic!("WGSL MapParams has {other}, which the Rust struct lacks"),
            }
        };
        // Every Rust field (14) is a WGSL member, in the same order.
        assert_eq!(members.len(), 14, "WGSL MapParams members");
        for m in members {
            let name = m.name.as_deref().unwrap();
            let want = expect(name);
            let at = m.offset as usize;
            assert_eq!(
                &bytes[at..at + want.len()],
                want.as_slice(),
                "MapParams.{name} at WGSL offset {at}"
            );
        }
        // The material's bindings are the shader's: group 1, bindings 0 to 5.
        let mut bindings: Vec<(u32, u32)> = module
            .global_variables
            .iter()
            .filter_map(|(_, g)| g.binding.as_ref().map(|b| (b.group, b.binding)))
            .collect();
        bindings.sort_unstable();
        assert_eq!(bindings, (0..6).map(|b| (1, b)).collect::<Vec<_>>());
    }

    /// The compiled-in source is the file in the repository (no stale copy).
    #[test]
    fn the_compiled_in_shader_is_the_assets_file() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../assets")
            .join(SHADER);
        assert_eq!(std::fs::read_to_string(path).unwrap(), SHADER_SOURCE);
    }

    #[test]
    fn lines_fade_in_with_the_zoom() {
        assert_eq!(line_alphas(360.0), (0.0, 0.0));
        let (p, r) = line_alphas(80.0);
        assert_eq!(p, 0.0);
        assert_eq!(r, 1.0);
        assert_eq!(line_alphas(10.0), (1.0, 1.0));
    }
}
