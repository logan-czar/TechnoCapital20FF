//! The UI config (M9 A2; D452, D458): density, font scale, per-table columns, page sections and
//! saved layouts, kept in one human-readable RON file in the user's config directory.
//!
//! - Loaded once at startup ([`ConfigPlugin`]); a missing file gives the defaults, a file that
//!   does not parse is moved aside to `ui.ron.corrupt` and the defaults are used.
//! - Written when it changes, at most every [`WRITE_DELAY_SECS`], and on exit; written to a
//!   temporary file and renamed, so a crash never leaves half a file.
//! - Owned by the game crate: the sim never sees it (it is no sim state and no control).
//!
//! Tests and benches run with no path ([`ConfigStore::in_memory`]), so they never touch the
//! player's file.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use bevy::prelude::*;
use serde::{Deserialize, Serialize};

use crate::workspace::model::SavedLayout;

/// The file's format version, written at its top.
pub const CONFIG_VERSION: u32 = 1;
/// The file name in the config directory.
pub const CONFIG_FILE: &str = "ui.ron";
/// The game's folder in the platform config directory.
pub const APP_DIR: &str = "TechnoCapital20FF";
/// An environment variable that overrides the config directory (for a second profile).
pub const CONFIG_DIR_ENV: &str = "TC20FF_CONFIG_DIR";
/// Font scale limits and step (D458).
pub const FONT_SCALE_MIN: f32 = 0.75;
pub const FONT_SCALE_MAX: f32 = 1.5;
pub const FONT_SCALE_STEP: f32 = 0.05;
/// Seconds a change waits before it is written, so a divider drag writes once.
pub const WRITE_DELAY_SECS: f64 = 0.5;
/// Column width limits in logical pixels.
pub const COLUMN_WIDTH_MIN: f32 = 24.0;
pub const COLUMN_WIDTH_MAX: f32 = 900.0;

/// Row density (D458): table rows and page lines.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub enum Density {
    /// 18 px rows.
    Compact,
    /// 22 px rows (M7's).
    #[default]
    Normal,
}

impl Density {
    /// A table row's height at font scale 1.
    pub fn row_height(self) -> f32 {
        match self {
            Density::Compact => 18.0,
            Density::Normal => 22.0,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Density::Compact => "compact",
            Density::Normal => "normal",
        }
    }
}

/// One table's columns and sort, saved by its table id.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct TableConfig {
    /// Columns in display order, by key; visible or not, with their width.
    pub columns: Vec<ColumnConfig>,
    pub sort: Option<SortConfig>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ColumnConfig {
    pub key: String,
    pub visible: bool,
    pub width: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SortConfig {
    pub key: String,
    pub ascending: bool,
}

/// One page kind's sections (D460): their order, and which are collapsed or hidden.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct SectionsConfig {
    pub order: Vec<String>,
    pub collapsed: BTreeSet<String>,
    pub hidden: BTreeSet<String>,
}

/// The whole UI config.
#[derive(Resource, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct UiConfig {
    pub version: u32,
    pub density: Density,
    /// Multiplies every font size (and row heights with it).
    pub font_scale: f32,
    /// By table id.
    pub tables: BTreeMap<String, TableConfig>,
    /// By page kind key.
    pub sections: BTreeMap<String, SectionsConfig>,
    /// Named layouts.
    pub layouts: BTreeMap<String, SavedLayout>,
    /// The workspace as it was last, restored at startup.
    pub last_layout: Option<SavedLayout>,
}

impl Default for UiConfig {
    fn default() -> Self {
        UiConfig {
            version: CONFIG_VERSION,
            density: Density::Normal,
            font_scale: 1.0,
            tables: BTreeMap::new(),
            sections: BTreeMap::new(),
            layouts: BTreeMap::new(),
            last_layout: None,
        }
    }
}

impl UiConfig {
    /// The config with every number brought into range (a hand-edited file may hold anything).
    pub fn sanitized(mut self) -> UiConfig {
        self.version = CONFIG_VERSION;
        self.font_scale = clamp_font_scale(self.font_scale);
        for t in self.tables.values_mut() {
            for c in &mut t.columns {
                c.width = if c.width.is_finite() {
                    c.width.clamp(COLUMN_WIDTH_MIN, COLUMN_WIDTH_MAX)
                } else {
                    COLUMN_WIDTH_MIN
                };
            }
        }
        let layouts = std::mem::take(&mut self.layouts);
        self.layouts = layouts
            .into_iter()
            .filter_map(|(k, l)| l.sanitized().map(|l| (k, l)))
            .collect();
        self.last_layout = self.last_layout.and_then(SavedLayout::sanitized);
        self
    }

    /// A table row's height in logical pixels.
    pub fn row_height(&self) -> f32 {
        (self.density.row_height() * self.font_scale).round()
    }

    /// A hash of what the Settings page shows: density, font scale and the saved layouts
    /// (names and shapes). It ignores the last layout, which moves with every focus change.
    pub fn display_signature(&self) -> u64 {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        self.density.hash(&mut h);
        self.font_scale.to_bits().hash(&mut h);
        for (name, l) in &self.layouts {
            name.hash(&mut h);
            format!("{l:?}").hash(&mut h);
        }
        h.finish()
    }

    /// Steps the font scale by `steps` of [`FONT_SCALE_STEP`].
    pub fn step_font(&mut self, steps: i32) {
        self.font_scale = clamp_font_scale(self.font_scale + steps as f32 * FONT_SCALE_STEP);
    }
}

pub fn clamp_font_scale(s: f32) -> f32 {
    if !s.is_finite() {
        return 1.0;
    }
    // Round to the step so repeated steps never drift.
    let s = (s / FONT_SCALE_STEP).round() * FONT_SCALE_STEP;
    s.clamp(FONT_SCALE_MIN, FONT_SCALE_MAX)
}

/// The platform config directory (no crate: the environment variables each OS documents).
/// Windows `%APPDATA%`, macOS `~/Library/Application Support`, others `$XDG_CONFIG_HOME` or
/// `~/.config`.
pub fn platform_config_dir() -> Option<PathBuf> {
    let env = |k: &str| {
        std::env::var_os(k)
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
    };
    if cfg!(target_os = "windows") {
        env("APPDATA")
    } else if cfg!(target_os = "macos") {
        env("HOME").map(|h| h.join("Library").join("Application Support"))
    } else {
        env("XDG_CONFIG_HOME").or_else(|| env("HOME").map(|h| h.join(".config")))
    }
}

/// The config file's path: `$TC20FF_CONFIG_DIR/ui.ron`, else the platform directory's
/// `TechnoCapital20FF/ui.ron`.
pub fn default_config_path() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os(CONFIG_DIR_ENV).filter(|v| !v.is_empty()) {
        return Some(PathBuf::from(dir).join(CONFIG_FILE));
    }
    platform_config_dir().map(|d| d.join(APP_DIR).join(CONFIG_FILE))
}

/// How the load went.
#[derive(Debug, Clone, PartialEq)]
pub enum LoadOutcome {
    Missing,
    Loaded,
    /// The file did not parse; it was moved to `backup` (when the move worked).
    Corrupt {
        error: String,
        backup: Option<PathBuf>,
    },
}

/// The file's text: a comment header and the config in pretty RON.
pub fn to_text(cfg: &UiConfig) -> String {
    let pretty = ron::ser::PrettyConfig::new()
        .depth_limit(8)
        .indentor("  ".to_owned());
    let body = ron::ser::to_string_pretty(cfg, pretty).unwrap_or_default();
    format!(
        "// TechnoCapital20FF UI config (density, font scale, table columns, page sections and\n\
         // layouts). Written by the game; edit it while the game is closed. Delete it to reset.\n\
         {body}\n"
    )
}

/// Parses a config file's text.
pub fn from_text(text: &str) -> Result<UiConfig, String> {
    ron::from_str::<UiConfig>(text)
        .map(UiConfig::sanitized)
        .map_err(|e| e.to_string())
}

/// Loads the config at `path`; never fails (D452).
pub fn load(path: &Path) -> (UiConfig, LoadOutcome) {
    let text = match std::fs::read_to_string(path) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return (UiConfig::default(), LoadOutcome::Missing);
        }
        Err(e) => {
            return (
                UiConfig::default(),
                LoadOutcome::Corrupt {
                    error: e.to_string(),
                    backup: None,
                },
            );
        }
    };
    match from_text(&text) {
        Ok(cfg) => (cfg, LoadOutcome::Loaded),
        Err(error) => {
            let backup = path.with_extension("ron.corrupt");
            let backup = std::fs::rename(path, &backup).ok().map(|()| backup);
            (UiConfig::default(), LoadOutcome::Corrupt { error, backup })
        }
    }
}

/// Writes the config to `path` through a temporary file and a rename.
pub fn save(path: &Path, text: &str) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("ron.tmp");
    std::fs::write(&tmp, text)?;
    std::fs::rename(&tmp, path)
}

/// Where the config lives and what was last written.
#[derive(Resource, Debug, Default)]
pub struct ConfigStore {
    path: Option<PathBuf>,
    written: Option<String>,
    pending_since: Option<f64>,
    /// How the startup load went.
    pub outcome: Option<LoadOutcome>,
}

impl ConfigStore {
    /// A store backed by the file at `path`.
    pub fn at(path: PathBuf) -> ConfigStore {
        ConfigStore {
            path: Some(path),
            ..default()
        }
    }

    /// No file: changes stay in memory (tests and benches).
    pub fn in_memory() -> ConfigStore {
        ConfigStore::default()
    }

    pub fn path(&self) -> Option<&Path> {
        self.path.as_deref()
    }

    /// Writes `cfg` now if it differs from what was last written.
    pub fn flush(&mut self, cfg: &UiConfig) {
        self.pending_since = None;
        let Some(path) = &self.path else {
            return;
        };
        let text = to_text(cfg);
        if self.written.as_deref() == Some(text.as_str()) {
            return;
        }
        match save(path, &text) {
            Ok(()) => self.written = Some(text),
            Err(e) => warn!("cannot write the UI config {}: {e}", path.display()),
        }
    }
}

/// Loads the config at build (from the [`ConfigStore`] the app inserted, or none) and writes it
/// back when it changes.
pub struct ConfigPlugin;

impl Plugin for ConfigPlugin {
    fn build(&self, app: &mut App) {
        let mut store = app
            .world_mut()
            .remove_resource::<ConfigStore>()
            .unwrap_or_default();
        let cfg = match store.path.clone() {
            Some(path) => {
                let (cfg, outcome) = load(&path);
                match &outcome {
                    LoadOutcome::Corrupt { error, backup } => warn!(
                        "UI config {} is unreadable ({error}); using defaults{}",
                        path.display(),
                        backup.as_ref().map_or(String::new(), |b| format!(
                            ", old file kept as {}",
                            b.display()
                        ))
                    ),
                    LoadOutcome::Loaded => info!("UI config loaded from {}", path.display()),
                    LoadOutcome::Missing => {}
                }
                if outcome == LoadOutcome::Loaded {
                    store.written = Some(to_text(&cfg));
                }
                store.outcome = Some(outcome);
                cfg
            }
            None => UiConfig::default(),
        };
        app.insert_resource(cfg)
            .insert_resource(store)
            .add_systems(Last, write_config);
    }
}

/// Marks a change, and writes once it has waited [`WRITE_DELAY_SECS`] or the app is exiting.
fn write_config(
    cfg: Res<UiConfig>,
    mut store: ResMut<ConfigStore>,
    time: Res<Time<Real>>,
    exit: MessageReader<AppExit>,
) {
    let now = time.elapsed_secs_f64();
    if cfg.is_changed() && !cfg.is_added() && store.pending_since.is_none() {
        store.pending_since = Some(now);
    }
    let due = store
        .pending_since
        .is_some_and(|t| now - t >= WRITE_DELAY_SECS);
    if due || (!exit.is_empty() && store.pending_since.is_some()) {
        store.flush(&cfg);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pages::PageRef;
    use crate::workspace::model::{Axis, SavedNode};
    use sim::world::CompanyId;

    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("tc20ff-a2-config-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(CONFIG_FILE)
    }

    fn sample() -> UiConfig {
        let mut cfg = UiConfig {
            density: Density::Compact,
            font_scale: 1.25,
            ..default()
        };
        cfg.tables.insert(
            "companies".into(),
            TableConfig {
                columns: vec![
                    ColumnConfig {
                        key: "Name".into(),
                        visible: true,
                        width: 200.0,
                    },
                    ColumnConfig {
                        key: "Ticker".into(),
                        visible: false,
                        width: 60.0,
                    },
                ],
                sort: Some(SortConfig {
                    key: "Name".into(),
                    ascending: false,
                }),
            },
        );
        cfg.sections.insert(
            "company".into(),
            SectionsConfig {
                order: vec!["board".into(), "overview".into()],
                collapsed: ["board".to_owned()].into(),
                hidden: ["tech".to_owned()].into(),
            },
        );
        let layout = SavedLayout {
            root: SavedNode::Split {
                axis: Axis::Row,
                ratio: 0.4,
                first: Box::new(SavedNode::Pane {
                    page: PageRef::Company(CompanyId(3)),
                }),
                second: Box::new(SavedNode::Pane {
                    page: PageRef::Industries,
                }),
            },
            focused: 1,
        };
        cfg.layouts.insert("trading".into(), layout.clone());
        cfg.last_layout = Some(layout);
        cfg
    }

    #[test]
    fn round_trips_through_the_file() {
        let path = scratch("roundtrip");
        let cfg = sample();
        let mut store = ConfigStore::at(path.clone());
        store.flush(&cfg);
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.starts_with("// TechnoCapital20FF UI config"));
        assert!(
            text.contains("\"company/3\""),
            "pages read as keys:\n{text}"
        );
        let (back, outcome) = load(&path);
        assert_eq!(outcome, LoadOutcome::Loaded);
        assert_eq!(back, cfg);
        // Unchanged: no rewrite needed.
        std::fs::remove_file(&path).unwrap();
        store.flush(&cfg);
        assert!(!path.exists(), "same text is not written twice");
    }

    #[test]
    fn missing_and_corrupt_files_give_defaults() {
        let path = scratch("corrupt");
        let (cfg, outcome) = load(&path);
        assert_eq!((cfg, outcome), (UiConfig::default(), LoadOutcome::Missing));
        std::fs::write(&path, "(density: Sideways, font_scale: \"big\"").unwrap();
        let (cfg, outcome) = load(&path);
        assert_eq!(cfg, UiConfig::default());
        match outcome {
            LoadOutcome::Corrupt { backup, .. } => {
                let b = backup.expect("moved aside");
                assert!(b.exists());
                assert!(!path.exists());
            }
            o => panic!("{o:?}"),
        }
        // Garbage bytes too.
        std::fs::write(&path, [0xff, 0xfe, 0x00, 0x12]).unwrap();
        assert!(matches!(load(&path).1, LoadOutcome::Corrupt { .. }));
    }

    #[test]
    fn partial_and_out_of_range_files_are_repaired() {
        let cfg = from_text("(font_scale: 9.0)").unwrap();
        assert_eq!(cfg.font_scale, FONT_SCALE_MAX);
        assert_eq!(cfg.density, Density::Normal);
        let cfg = from_text(
            "(font_scale: 0.81, tables: {\"t\": (columns: [(key: \"A\", visible: true, \
             width: -5.0)])}, last_layout: Some((root: Split(axis: Row, ratio: 7.0, first: \
             Pane(page: \"world\"), second: Pane(page: \"news\")), focused: 9)))",
        )
        .unwrap();
        assert!((cfg.font_scale - 0.8).abs() < 1e-6, "{}", cfg.font_scale);
        assert_eq!(cfg.tables["t"].columns[0].width, COLUMN_WIDTH_MIN);
        let l = cfg.last_layout.unwrap();
        match l.root {
            SavedNode::Split { ratio, .. } => assert!(ratio <= 0.9),
            n => panic!("{n:?}"),
        }
        assert_eq!(l.focused, 0, "focus index out of range resets");
        // An unknown page key makes the file unreadable, so it is moved aside (D452).
        let cfg = from_text("(layouts: {\"x\": (root: Pane(page: \"company/zz\"), focused: 0)})");
        assert!(cfg.is_err(), "an unparseable page key fails the parse");
    }

    #[test]
    fn writes_wait_for_the_delay_and_exit() {
        let path = scratch("delay");
        let mut app = App::new();
        app.add_plugins(MinimalPlugins)
            .insert_resource(ConfigStore::at(path.clone()))
            .add_plugins(ConfigPlugin);
        app.update();
        assert!(!path.exists(), "nothing written for an unchanged config");
        app.world_mut().resource_mut::<UiConfig>().density = Density::Compact;
        app.update();
        assert!(!path.exists(), "waits for the delay");
        std::thread::sleep(std::time::Duration::from_secs_f64(WRITE_DELAY_SECS + 0.1));
        app.update();
        assert!(path.exists());
        assert_eq!(load(&path).0.density, Density::Compact);
        app.world_mut().resource_mut::<UiConfig>().font_scale = 1.1;
        app.world_mut().write_message(AppExit::Success);
        app.update();
        assert!(
            (load(&path).0.font_scale - 1.1).abs() < 1e-6,
            "flushed on exit"
        );
    }

    #[test]
    fn font_steps_stay_on_the_grid() {
        let mut c = UiConfig::default();
        for _ in 0..3 {
            c.step_font(1);
        }
        assert!((c.font_scale - 1.15).abs() < 1e-6);
        for _ in 0..40 {
            c.step_font(-1);
        }
        assert_eq!(c.font_scale, FONT_SCALE_MIN);
        c.density = Density::Compact;
        assert_eq!(c.row_height(), 14.0);
    }
}
