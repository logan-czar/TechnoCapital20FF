//! The assets/map loader (M8; docs/build/m8-map-assets.md): a fixture folder in the contract's
//! format loads; no folder is no map; a broken file names its file, line and field; the world
//! checks flag a province id the world does not have.

use std::path::{Path, PathBuf};

use sim_data::map::fixture::{self, Rect};
use sim_data::{check, default_data_dir, load_map, load_world};

struct Scratch(PathBuf);

impl Scratch {
    fn new(name: &str) -> Scratch {
        let dir =
            std::env::temp_dir().join(format!("tc20ff-simdata-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Scratch(dir)
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Three NA provinces side by side and a tiny one below them.
fn write_fixture(dir: &Path) {
    fixture::write(
        dir,
        64,
        32,
        20,
        &[
            Rect("US-0001", [0, 0, 10, 10]),
            Rect("US-0002", [10, 0, 20, 10]),
            Rect("US-0003", [20, 0, 30, 10]),
            Rect("US-0004", [10, 10, 14, 14]),
        ],
    )
    .unwrap();
}

#[test]
fn a_contract_folder_loads() {
    let s = Scratch::new("loads");
    write_fixture(&s.0);
    let m = load_map(&s.0).unwrap().expect("a map");
    assert_eq!((m.meta.width, m.meta.height), (64, 32));
    assert_eq!(m.meta.projection, "miller");
    assert_eq!(m.meta.tiny_px, Some(20));
    assert_eq!(m.meta.coverage, ["provinces-north-america.csv"]);
    assert_eq!(m.meta.sources, [("fixture".to_owned(), "1".to_owned())]);
    assert_eq!(m.colors.len(), 4);
    assert_eq!(m.index_of("US-0001"), Some(1));
    assert_eq!(m.index_of("US-0004"), Some(4));
    assert_eq!(m.index_of("US-0099"), None);
    let tiny: Vec<_> = m.centroids.rows.iter().filter(|c| c.tiny).collect();
    assert_eq!(tiny.len(), 1);
    assert_eq!(tiny[0].province_id, "US-0004");
    assert_eq!((tiny[0].label_x, tiny[0].label_y), (12.0, 12.0));
    // 1|2, 2|3 and 2 over 4 touch.
    let pairs: Vec<(&str, &str)> = m
        .adjacency
        .rows
        .iter()
        .map(|a| (a.a.as_str(), a.b.as_str()))
        .collect();
    assert_eq!(
        pairs,
        [
            ("US-0001", "US-0002"),
            ("US-0002", "US-0003"),
            ("US-0002", "US-0004")
        ]
    );
    // The world's checks pass with it.
    let mut w = load_world(&default_data_dir()).unwrap();
    w.map = Some(m);
    assert!(check(&w).is_empty(), "{:#?}", check(&w));
}

#[test]
fn no_folder_is_no_map() {
    let s = Scratch::new("none");
    assert!(load_map(&s.0.join("missing")).unwrap().is_none());
    assert!(
        load_map(&s.0).unwrap().is_none(),
        "a folder without map-meta.toml"
    );
    // The adjacency file is optional (Phase A).
    write_fixture(&s.0);
    std::fs::remove_file(s.0.join("province-adjacency.csv")).unwrap();
    assert!(load_map(&s.0).unwrap().unwrap().adjacency.is_empty());
}

#[test]
fn broken_files_name_their_place() {
    let s = Scratch::new("broken");
    write_fixture(&s.0);
    let path = s.0.join("province-centroids.csv");
    let text = std::fs::read_to_string(&path).unwrap();
    std::fs::write(&path, text.replacen(",N\n", ",maybe\n", 1)).unwrap();
    let e = load_map(&s.0).unwrap_err();
    assert_eq!(e.file, "province-centroids.csv");
    assert_eq!(e.line, Some(2));
    assert_eq!(e.field.as_deref(), Some("tiny"));

    // Unsorted colour rows.
    write_fixture(&s.0);
    let path = s.0.join("province-colors.csv");
    let text = std::fs::read_to_string(&path).unwrap();
    std::fs::write(&path, text.replace("US-0002,", "US-0009,")).unwrap();
    let e = load_map(&s.0).unwrap_err();
    assert_eq!((e.file.as_str(), e.line), ("province-colors.csv", Some(4)));

    // A centroid of a province the colour table lacks.
    write_fixture(&s.0);
    let path = s.0.join("province-centroids.csv");
    let text = std::fs::read_to_string(&path).unwrap();
    std::fs::write(&path, text.replace("US-0003,", "US-0007,")).unwrap();
    let e = load_map(&s.0).unwrap_err();
    assert_eq!(e.field.as_deref(), Some("province_id"));

    // A meta file that is not TOML names its line.
    write_fixture(&s.0);
    std::fs::write(s.0.join("map-meta.toml"), "width = 64\nheight = = 3\n").unwrap();
    let e = load_map(&s.0).unwrap_err();
    assert_eq!((e.file.as_str(), e.line), ("map-meta.toml", Some(2)));
}

#[test]
fn the_world_checks_flag_unknown_map_provinces() {
    let s = Scratch::new("unknown");
    fixture::write(
        &s.0,
        64,
        32,
        0,
        &[Rect("US-0001", [0, 0, 4, 4]), Rect("ZZ-0001", [4, 0, 8, 4])],
    )
    .unwrap();
    let mut w = load_world(&default_data_dir()).unwrap();
    w.map = load_map(&s.0).unwrap();
    w.map
        .as_mut()
        .unwrap()
        .meta
        .coverage
        .push("provinces-atlantis.csv".into());
    let errors = check(&w);
    assert!(
        errors.iter().any(|e| e.file == "province-colors.csv"
            && e.line == Some(3)
            && e.field.as_deref() == Some("province_id")),
        "{errors:#?}"
    );
    assert!(
        errors
            .iter()
            .any(|e| e.file == "map-meta.toml" && e.message.contains("atlantis")),
        "{errors:#?}"
    );
}
