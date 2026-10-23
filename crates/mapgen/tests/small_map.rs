//! A hand-made GeoJSON rasterized on a 64 x 32 frame gives the expected index, colours,
//! centroids, label points, adjacency, border distances and files (build-plan P7).

use std::fs;
use std::path::PathBuf;

use mapgen::build::{self, TINY_PX};
use mapgen::io::{self, Meta};
use mapgen::miller::Frame;

const W: u32 = 64;
const H: u32 = 32;

fn frame() -> Frame {
    Frame::new(W, H, 84.0)
}

/// lon/lat of a pixel-space point (x may be exactly W, which is lon 180).
fn ll(x: f64, y: f64) -> [f64; 2] {
    let lat = frame().unproject(0.0, y).1;
    [x / f64::from(W) * 360.0 - 180.0, lat]
}

fn rect(x0: f64, y0: f64, x1: f64, y1: f64) -> String {
    let pts = [ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)];
    let coords: Vec<String> = pts.iter().map(|p| format!("[{},{}]", p[0], p[1])).collect();
    format!("[[{}]]", coords.join(","))
}

fn feature(id: &str, region: &str, country: &str, polys: &[String]) -> String {
    format!(
        r#"{{"type":"Feature","properties":{{"province_id":"{id}","region":"{region}","country":"{country}"}},"geometry":{{"type":"MultiPolygon","coordinates":[{}]}}}}"#,
        polys.join(",")
    )
}

/// A temp directory of this test's own, removed when dropped.
struct TempDir(PathBuf);

impl TempDir {
    fn new(test: &str) -> TempDir {
        let d = std::env::temp_dir().join(format!("mapgen-test-{}-{test}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        TempDir(d)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn small_map() -> build::Map {
    let feats = [
        feature("AA-0002", "X:R1", "X", &[rect(16.0, 8.0, 24.0, 16.0)]),
        feature("AA-0001", "X:R1", "X", &[rect(8.0, 8.0, 16.0, 16.0)]),
        feature("BB-0001", "Y:R2", "Y", &[rect(24.0, 8.0, 28.0, 12.0)]),
        feature("BB-0002", "Y:R3", "Y", &[rect(40.0, 20.0, 42.0, 22.0)]),
        // straddles the east-west seam
        feature(
            "CC-0001",
            "Z:R4",
            "Z",
            &[rect(62.0, 4.0, 64.0, 6.0), rect(0.0, 4.0, 2.0, 6.0)],
        ),
        // smaller than a pixel: covers no pixel centre
        feature("DD-0001", "Z:R5", "Z", &[rect(50.1, 20.1, 50.4, 20.4)]),
    ];
    let text = format!(
        r#"{{"type":"FeatureCollection","features":[{}]}}"#,
        feats.join(",")
    );
    let provinces = io::parse_provinces(&text, "small map").unwrap();
    assert_eq!(provinces.len(), 6);
    let land_polys: Vec<_> = provinces.iter().map(|p| p.shape.clone()).collect();
    let land = build::land_mask(&frame(), &land_polys);
    build::build(frame(), provinces, Some(&land))
}

fn at(map: &build::Map, x: usize, y: usize) -> u16 {
    map.raster[y * W as usize + x]
}

#[test]
fn index_bitmap_and_ids() {
    let m = small_map();
    assert_eq!(
        m.ids,
        [
            "AA-0001", "AA-0002", "BB-0001", "BB-0002", "CC-0001", "DD-0001"
        ]
    );
    assert_eq!(at(&m, 10, 10), 1);
    assert_eq!(at(&m, 15, 15), 1);
    assert_eq!(at(&m, 16, 8), 2);
    assert_eq!(at(&m, 25, 9), 3);
    assert_eq!(at(&m, 41, 21), 4);
    assert_eq!(at(&m, 63, 4), 5);
    assert_eq!(at(&m, 0, 5), 5);
    assert_eq!(
        at(&m, 50, 20),
        6,
        "the sub-pixel province gets the pixel at its interior point"
    );
    assert_eq!(at(&m, 30, 30), 0);
    assert_eq!(at(&m, 7, 10), 0);
    let areas: Vec<u32> = m.stats.iter().map(|s| s.area_px).collect();
    assert_eq!(areas, [64, 64, 16, 4, 8, 1]);
    assert!(m.stats[5].forced && !m.stats[0].forced);
    assert!(
        m.stats.iter().all(|s| s.overwritten_px == 0),
        "the shapes tile cleanly"
    );
}

#[test]
fn colours_are_the_hashed_table() {
    let m = small_map();
    assert_eq!(m.colors, build::colors_for(&m.ids));
}

#[test]
fn centroids_and_label_points() {
    let m = small_map();
    assert_eq!(m.stats[0].centroid, (12.0, 12.0));
    // pole of inaccessibility of an 8 x 8 square: four pixels tie at 4, the top-left one wins
    assert_eq!(m.stats[0].label, (11.5, 11.5));
    // the seam province's centroid is on the seam, not in the middle of the map
    assert_eq!(m.stats[4].centroid, (0.0, 5.0));
    assert_eq!(
        m.stats[4].components, 1,
        "the two halves join across the seam"
    );
    assert_eq!(m.stats[5].label, (50.5, 20.5));
    assert!(m.stats[3].area_px < TINY_PX && m.stats[0].area_px >= TINY_PX);
}

#[test]
fn adjacency_counts_shared_pixel_edges() {
    let m = small_map();
    assert_eq!(m.adjacency, vec![(1, 2, 8), (2, 3, 4)]);
}

#[test]
fn border_distances_by_level() {
    let m = small_map();
    let b = |x: usize, y: usize| m.borders[y * W as usize + x];
    // (11, 11): 3 from A's west and north edges at every level
    assert_eq!(b(11, 11), [3, 3, 3]);
    // (14, 12): next to the A|B edge (a province edge only; A and B share region and country)
    assert_eq!(b(14, 12), [1, 3, 3]);
    // (22, 9): one pixel from B's north coast at every level
    assert_eq!(b(22, 9), [1, 1, 1]);
    // (23, 10): next to B|C, a region and country edge too
    assert_eq!(b(23, 10), [0, 0, 0]);
}

#[test]
fn coastal_edges_need_open_water() {
    let m = small_map();
    // A: west, north and south sides on water (8 pixel edges each); its east side is B
    assert_eq!(m.stats[0].coastal_px, 24);
}

#[test]
fn writes_every_contract_file() {
    let m = small_map();
    let dir = TempDir::new("assets");
    let out = dir.0.clone();
    let meta = Meta {
        pipeline_version: "test".into(),
        sources: vec![("natural_earth".into(), "v0".into())],
        coverage: vec!["provinces-test.csv".into()],
    };
    io::write_assets(&m, &meta, &out).unwrap();
    let colors = fs::read_to_string(out.join("province-colors.csv")).unwrap();
    assert!(colors.starts_with("province_id,r,g,b\nAA-0001,"));
    assert_eq!(colors.lines().count(), 7);
    let cents = fs::read_to_string(out.join("province-centroids.csv")).unwrap();
    assert!(
        cents
            .lines()
            .nth(1)
            .unwrap()
            .ends_with(",12.0,12.0,11.5,11.5,64,N"),
        "{cents}"
    );
    assert!(
        cents.contains("BB-0002,")
            && cents
                .lines()
                .find(|l| l.starts_with("BB-0002"))
                .unwrap()
                .ends_with(",4,Y")
    );
    let adj = fs::read_to_string(out.join("province-adjacency.csv")).unwrap();
    assert_eq!(
        adj,
        "a,b,border_px,kind\nAA-0001,AA-0002,8,land\nAA-0002,BB-0001,4,land\n"
    );
    let meta_txt = fs::read_to_string(out.join("map-meta.toml")).unwrap();
    assert!(
        meta_txt.contains("projection = \"miller\"")
            && meta_txt.contains("coverage = [\"provinces-test.csv\"]")
    );
    let idx = image::open(out.join("province-index.png"))
        .unwrap()
        .into_luma16();
    assert_eq!(idx.get_pixel(10, 10).0[0], 1);
    assert_eq!(idx.get_pixel(0, 5).0[0], 5);
    let ids = image::open(out.join("province-ids.png"))
        .unwrap()
        .into_rgb8();
    assert_eq!(ids.get_pixel(10, 10).0, m.colors[0]);
    assert_eq!(ids.get_pixel(30, 30).0, [0, 0, 0]);
    let borders = image::open(out.join("province-borders.png"))
        .unwrap()
        .into_rgb8();
    assert_eq!(borders.get_pixel(14, 12).0, [1, 3, 3]);
}

#[test]
fn overlapping_shapes_are_counted() {
    // EE-0002 is drawn after EE-0001 and covers 2 x 4 of its pixels
    let feats = [
        feature("EE-0001", "E:R", "E", &[rect(4.0, 4.0, 10.0, 8.0)]),
        feature("EE-0002", "E:R", "E", &[rect(8.0, 4.0, 12.0, 8.0)]),
    ];
    let text = format!(
        r#"{{"type":"FeatureCollection","features":[{}]}}"#,
        feats.join(",")
    );
    let m = build::build(
        frame(),
        io::parse_provinces(&text, "overlap").unwrap(),
        None,
    );
    assert_eq!(m.stats[0].area_px, 16);
    assert_eq!(m.stats[1].overwritten_px, 8);
    assert_eq!(m.stats[0].overwritten_px, 0);
}
