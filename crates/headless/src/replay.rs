//! `record` and `replay` (build-plan M10.4, 4.3 "Replay test", D403): a run records its seed and
//! command log (every player control, with the frame it was sent in) and the state hash at each
//! month close; a replay of the log on the same machine and build must give the same hashes.
//!
//! Both drive the sim through the same headless frame loop ([`run_frames`]): each frame first
//! applies that frame's controls, then runs as many ticks as the effective speed allows
//! ([`TICKS_PER_FRAME`]), stopping early when the sim pauses itself (an alert, a finished
//! SkipTo). So the log holds only what the player did; the sim's own pauses, skips and alerts
//! happen again in the replay, and a frame or step that moved would show as a changed hash
//! line. `record` plays a scripted player whose choices come from its own splitmix64 stream
//! (never the sim's RNG streams, D9), seeded by the game seed.
//!
//! The controls the log can hold are every `Control` the MVP's player can send except NewGame
//! (a log is one game) and SetOmniscient (debug builds only): speed 0 to 5, pause, resume, the
//! four SkipTos, alert levels, the watchlist, and Save and Load. Saves go to numbered files
//! beside the log (`LOG.save<n>` when recording, `LOG.replay.save<n>` when replaying, removed
//! at the end), and a Load loads the latest one, which rewinds the game to it.
//!
//! The log is plain text, one record per line:
//!
//! ```text
//! version 2
//! seed 7
//! years 2
//! control <frame> <control>      e.g. "control 120 speed 4", "control 300 skip next-lock"
//! hash <frame> <step> <month> <state hash>
//! end <frame> <step> <clock> <state hash> controls <digest>
//! ```
//!
//! The state hash does not cover the controls (D13), so the end line adds a digest of the final
//! `Controls` (speed, pause, skip, alert levels, watchlist): a dropped or changed control that
//! moves no frame, step or hash (a watchlist change, say) still fails the replay (D403).

use std::fmt::Write as _;
use std::path::{Path, PathBuf};

use sim::time::calendar::EPOCH_YEAR;
use sim::time::control::MAX_SPEED;
use sim::time::{Control, Controls, Date, DateTime};
use sim::world::{AlertKind, AlertLevel, CompanyId, SkipKind};
use sim::{Notice, Sim};
use sim_data::WorldData;

/// The log format version written on the first line (2: the end line carries the controls
/// digest).
pub const LOG_VERSION: u32 = 2;

/// FNV-1a 64 (offset basis and prime) for the controls digest on the end line.
const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

/// Ticks the headless frame loop runs in one frame at each effective speed, 0 (paused) to 5
/// (max, and while skipping). The game's own frame budget is wall-clock based (spec 8, 9.1);
/// the replay needs only a fixed one, so these stand in for it (D403).
pub const TICKS_PER_FRAME: [u32; MAX_SPEED as usize + 1] = [0, 1, 2, 4, 8, 24];

/// The scripted player sends a control in a frame with this chance while the game runs...
const PLAYER_ACT_CHANCE: f64 = 0.004;
/// ...and resumes (or sets a speed) with this chance in a paused frame.
const PLAYER_RESUME_CHANCE: f64 = 0.25;
/// The player's control mix, in parts per hundred: speed, pause, skip, alert, watchlist, save;
/// the rest is load (only once a save exists).
const PLAYER_MIX: [u32; 6] = [30, 10, 20, 15, 12, 9];
/// Salt mixed into the game seed for the player's own stream (not a sim stream, D9).
const PLAYER_SALT: u64 = 0x5245_504c_4159_4c4f;

/// One recorded control and the frame it was sent in.
#[derive(Debug, Clone, PartialEq)]
pub struct LoggedControl {
    pub frame: u64,
    pub control: LogControl,
}

/// The controls a log holds. Save and Load name a save by its number in the run.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LogControl {
    Speed(u8),
    Pause,
    Resume,
    Skip(SkipKind),
    Alert(AlertKind, AlertLevel),
    WatchAdd(u32),
    WatchRemove(u32),
    Save(u32),
    Load(u32),
}

const SKIPS: [(SkipKind, &str); 4] = [
    (SkipKind::NextRelease, "next-release"),
    (SkipKind::NextLock, "next-lock"),
    (SkipKind::NextRecap, "next-recap"),
    (SkipKind::MonthEnd, "month-end"),
];

const ALERTS: [(AlertKind, &str); 5] = [
    (AlertKind::EarningsDay, "earnings-day"),
    (AlertKind::QuarterlyRecap, "quarterly-recap"),
    (AlertKind::PlanLock, "plan-lock"),
    (AlertKind::BankruptcyInWatchlist, "bankruptcy-in-watchlist"),
    (AlertKind::WorldEvent, "world-event"),
];

const LEVELS: [(AlertLevel, &str); 4] = [
    (AlertLevel::Pause, "pause"),
    (AlertLevel::Notify, "notify"),
    (AlertLevel::Log, "log"),
    (AlertLevel::Off, "off"),
];

fn name_of<T: PartialEq + Copy>(table: &[(T, &'static str)], v: T) -> &'static str {
    table
        .iter()
        .find(|(t, _)| *t == v)
        .map(|(_, n)| *n)
        .expect("every value is in its table")
}

fn value_of<T: Copy>(table: &[(T, &'static str)], name: &str) -> Option<T> {
    table.iter().find(|(_, n)| *n == name).map(|(t, _)| *t)
}

impl LogControl {
    /// The log text.
    pub fn text(self) -> String {
        match self {
            LogControl::Speed(n) => format!("speed {n}"),
            LogControl::Pause => "pause".to_owned(),
            LogControl::Resume => "resume".to_owned(),
            LogControl::Skip(k) => format!("skip {}", name_of(&SKIPS, k)),
            LogControl::Alert(k, l) => {
                format!("alert {} {}", name_of(&ALERTS, k), name_of(&LEVELS, l))
            }
            LogControl::WatchAdd(id) => format!("watch-add {id}"),
            LogControl::WatchRemove(id) => format!("watch-remove {id}"),
            LogControl::Save(n) => format!("save {n}"),
            LogControl::Load(n) => format!("load {n}"),
        }
    }

    /// Reads the log text back.
    pub fn parse(words: &[&str]) -> Option<LogControl> {
        Some(match words {
            ["speed", n] => LogControl::Speed(n.parse().ok()?),
            ["pause"] => LogControl::Pause,
            ["resume"] => LogControl::Resume,
            ["skip", k] => LogControl::Skip(value_of(&SKIPS, k)?),
            ["alert", k, l] => LogControl::Alert(value_of(&ALERTS, k)?, value_of(&LEVELS, l)?),
            ["watch-add", id] => LogControl::WatchAdd(id.parse().ok()?),
            ["watch-remove", id] => LogControl::WatchRemove(id.parse().ok()?),
            ["save", n] => LogControl::Save(n.parse().ok()?),
            ["load", n] => LogControl::Load(n.parse().ok()?),
            _ => return None,
        })
    }

    /// The sim control, with saves at `save_path(n)`.
    fn control(self, save_path: &dyn Fn(u32) -> PathBuf) -> Control {
        match self {
            LogControl::Speed(n) => Control::SetSpeed(n),
            LogControl::Pause => Control::Pause,
            LogControl::Resume => Control::Resume,
            LogControl::Skip(k) => Control::SkipTo(k),
            LogControl::Alert(kind, level) => Control::SetAlert { kind, level },
            LogControl::WatchAdd(id) => Control::WatchlistAdd(CompanyId(id)),
            LogControl::WatchRemove(id) => Control::WatchlistRemove(CompanyId(id)),
            LogControl::Save(n) => Control::Save(save_path(n)),
            LogControl::Load(n) => Control::Load(save_path(n)),
        }
    }
}

/// splitmix64: the scripted player's own stream.
struct Player {
    state: u64,
    saves: u32,
}

impl Player {
    fn new(seed: u64) -> Player {
        Player {
            state: seed ^ PLAYER_SALT,
            saves: 0,
        }
    }

    fn next(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn unit(&mut self) -> f64 {
        (self.next() >> 11) as f64 / (1u64 << 53) as f64
    }

    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }

    /// This frame's controls (at most one).
    fn act(&mut self, sim: &Sim) -> Option<LogControl> {
        if sim.controls().paused {
            if self.unit() >= PLAYER_RESUME_CHANCE {
                return None;
            }
            return Some(if self.below(2) == 0 {
                LogControl::Resume
            } else {
                LogControl::Speed(1 + self.below(u64::from(MAX_SPEED)) as u8)
            });
        }
        if self.unit() >= PLAYER_ACT_CHANCE {
            return None;
        }
        let companies = sim.views().company_rows.get().rows.len().max(1) as u64;
        let mut roll = self.below(100) as u32;
        for (i, part) in PLAYER_MIX.iter().enumerate() {
            if roll >= *part {
                roll -= part;
                continue;
            }
            return Some(match i {
                0 => LogControl::Speed(self.below(u64::from(MAX_SPEED) + 1) as u8),
                1 => LogControl::Pause,
                2 => LogControl::Skip(SKIPS[self.below(SKIPS.len() as u64) as usize].0),
                3 => LogControl::Alert(
                    ALERTS[self.below(ALERTS.len() as u64) as usize].0,
                    LEVELS[self.below(LEVELS.len() as u64) as usize].0,
                ),
                4 => {
                    let id = self.below(companies) as u32;
                    if self.below(3) == 0 {
                        LogControl::WatchRemove(id)
                    } else {
                        LogControl::WatchAdd(id)
                    }
                }
                _ => {
                    self.saves += 1;
                    LogControl::Save(self.saves)
                }
            });
        }
        (self.saves > 0).then_some(LogControl::Load(self.saves))
    }
}

/// What a run of the frame loop saw: its controls and hash lines, in order.
#[derive(Debug, Default, PartialEq)]
pub struct RunLog {
    pub controls: Vec<LoggedControl>,
    /// `hash` and `end` lines, as written.
    pub hashes: Vec<String>,
    /// The save numbers the run applied or tried to apply, so their files are removed at the end
    /// even when a Save failed partway (not part of the log text).
    pub saves_tried: Vec<u32>,
}

/// Where the controls of a run come from: the scripted player, or a log (whose hash lines the
/// run is checked against as it goes).
enum Source<'a> {
    Player(Player),
    Log(&'a RunLog),
}

/// Adds a hash line; in a replay it must be the log's line at that place.
fn add_hash(out: &mut RunLog, line: String, source: &Source<'_>) -> Result<(), String> {
    if let Source::Log(log) = source {
        let i = out.hashes.len();
        if log.hashes.get(i) != Some(&line) {
            return Err(format!(
                "replay differs at hash line {}: log {:?}, replay {line:?}",
                i + 1,
                log.hashes.get(i)
            ));
        }
    }
    out.hashes.push(line);
    Ok(())
}

/// The headless frame loop (see the module docs) from a new game of `seed` to 1 January of
/// 2020 + `years`, 00:00. Returns what the run did even when it stopped on an error, so its
/// save files can be removed.
fn run_frames(
    data: &WorldData,
    seed: u64,
    years: u32,
    source: Source<'_>,
    save_path: &dyn Fn(u32) -> PathBuf,
) -> (RunLog, Result<(), String>) {
    let mut out = RunLog::default();
    let r = run_frames_into(&mut out, data, seed, years, source, save_path);
    (out, r)
}

fn run_frames_into(
    out: &mut RunLog,
    data: &WorldData,
    seed: u64,
    years: u32,
    mut source: Source<'_>,
    save_path: &dyn Fn(u32) -> PathBuf,
) -> Result<(), String> {
    let mut sim = Sim::new(data.clone(), seed).map_err(|e| e.to_string())?;
    let end = DateTime::midnight(Date::ymd(EPOCH_YEAR + years as i32, 1, 1));
    let (mut frame, mut step, mut next_logged) = (0u64, 0u64, 0usize);
    while sim.now() < end {
        let controls: Vec<LogControl> = match &mut source {
            Source::Player(p) => p.act(&sim).into_iter().collect(),
            Source::Log(log) => {
                let mut v = Vec::new();
                while let Some(c) = log.controls.get(next_logged).filter(|c| c.frame == frame) {
                    v.push(c.control);
                    next_logged += 1;
                }
                v
            }
        };
        for c in controls {
            if let LogControl::Save(n) = c {
                out.saves_tried.push(n);
            }
            sim.apply(c.control(save_path))
                .map_err(|e| format!("frame {frame}: {}: {e}", c.text()))?;
            out.controls.push(LoggedControl { frame, control: c });
        }
        let ticks = TICKS_PER_FRAME[usize::from(sim.controls().effective_speed())];
        // A paused replay with no control left would wait for ever: the log does not match.
        if ticks == 0
            && let Source::Log(log) = &source
            && next_logged == log.controls.len()
        {
            return Err(format!(
                "the game is paused at {} (frame {frame}) and the log has no control left",
                sim.now()
            ));
        }
        for _ in 0..ticks {
            if sim.now() >= end {
                break;
            }
            step += 1;
            let notices = sim.step();
            for n in &notices {
                if let Notice::MonthDone(m) = n {
                    let line = format!("hash {frame} {step} {m} {}", sim.state_hash());
                    add_hash(out, line, &source)?;
                }
            }
            if sim.controls().paused {
                break;
            }
        }
        frame += 1;
    }
    if let Source::Log(log) = &source
        && next_logged < log.controls.len()
    {
        return Err(format!(
            "the run ended at frame {frame} with {} logged controls unsent",
            log.controls.len() - next_logged
        ));
    }
    let line = format!(
        "end {frame} {step} {} {} controls {}",
        sim.now(),
        sim.state_hash(),
        controls_digest(sim.controls())
    );
    add_hash(out, line, &source)?;
    if let Source::Log(log) = &source
        && out.hashes.len() != log.hashes.len()
    {
        return Err(format!(
            "replay made {} hash lines, the log has {}",
            out.hashes.len(),
            log.hashes.len()
        ));
    }
    Ok(())
}

/// The save files of a run (`<log>.<tag><n>`), removed at the end.
fn save_paths(log: &Path, tag: &str) -> impl Fn(u32) -> PathBuf {
    let base = log.as_os_str().to_owned();
    let tag = tag.to_owned();
    move |n| {
        let mut p = base.clone();
        p.push(format!(".{tag}{n}"));
        PathBuf::from(p)
    }
}

/// A 16-hex-digit digest of the controls (FNV-1a 64 of their `Debug` text: fixed field order,
/// and the watchlist is a `BTreeSet`, so the same controls always give the same digest).
pub fn controls_digest(c: &Controls) -> String {
    let h = format!("{c:?}").bytes().fold(FNV_OFFSET, |h, b| {
        (h ^ u64::from(b)).wrapping_mul(FNV_PRIME)
    });
    format!("{h:016x}")
}

/// Removes every save file the run applied or tried to apply, a failed one included.
fn remove_saves(paths: &dyn Fn(u32) -> PathBuf, log: &RunLog) {
    for &n in &log.saves_tried {
        let _ = std::fs::remove_file(paths(n));
    }
}

/// The log text of a run.
pub fn log_text(seed: u64, years: u32, run: &RunLog) -> String {
    let mut s = format!("version {LOG_VERSION}\nseed {seed}\nyears {years}\n");
    // Controls and hashes in run order: a control sent in frame f comes before the hashes of
    // that frame's ticks.
    let frame_of = |line: &str| -> u64 {
        line.split(' ')
            .nth(1)
            .and_then(|f| f.parse().ok())
            .unwrap_or(u64::MAX)
    };
    let mut hashes = run.hashes.iter().peekable();
    for c in &run.controls {
        while let Some(h) = hashes.next_if(|h| frame_of(h) < c.frame) {
            let _ = writeln!(s, "{h}");
        }
        let _ = writeln!(s, "control {} {}", c.frame, c.control.text());
    }
    for h in hashes {
        let _ = writeln!(s, "{h}");
    }
    s
}

/// A parsed log.
#[derive(Debug, PartialEq)]
pub struct Log {
    pub seed: u64,
    pub years: u32,
    pub run: RunLog,
}

/// Reads a log's text.
pub fn parse_log(text: &str) -> Result<Log, String> {
    let (mut seed, mut years, mut version) = (None, None, None);
    let mut run = RunLog::default();
    for (i, line) in text.lines().enumerate() {
        let bad = || format!("log line {}: {line:?}", i + 1);
        let words: Vec<&str> = line.split_whitespace().collect();
        match words.as_slice() {
            [] => {}
            ["version", v] => version = Some(v.parse::<u32>().map_err(|_| bad())?),
            ["seed", s] => seed = Some(s.parse::<u64>().map_err(|_| bad())?),
            ["years", y] => years = Some(y.parse::<u32>().map_err(|_| bad())?),
            ["control", f, rest @ ..] => run.controls.push(LoggedControl {
                frame: f.parse().map_err(|_| bad())?,
                control: LogControl::parse(rest).ok_or_else(bad)?,
            }),
            ["hash" | "end", ..] => run.hashes.push(words.join(" ")),
            _ => return Err(bad()),
        }
    }
    if version != Some(LOG_VERSION) {
        return Err(format!(
            "log version {version:?}, this build reads {LOG_VERSION}"
        ));
    }
    Ok(Log {
        seed: seed.ok_or("the log has no seed")?,
        years: years.filter(|&y| y > 0).ok_or("the log has no years")?,
        run,
    })
}

/// `record --years N --seed S --out LOG`: plays the scripted player and writes the log.
pub fn record(data: &WorldData, seed: u64, years: u32, out: &Path) -> Result<String, String> {
    let paths = save_paths(out, "save");
    let (run, r) = run_frames(data, seed, years, Source::Player(Player::new(seed)), &paths);
    remove_saves(&paths, &run);
    r?;
    let text = log_text(seed, years, &run);
    std::fs::write(out, &text).map_err(|e| format!("{}: {e}", out.display()))?;
    Ok(summary(&run))
}

/// `replay LOG`: replays the log's controls and checks every hash line as it is made. The
/// error names the first line that differs.
pub fn replay(data: &WorldData, log_path: &Path) -> Result<String, String> {
    let text =
        std::fs::read_to_string(log_path).map_err(|e| format!("{}: {e}", log_path.display()))?;
    let log = parse_log(&text)?;
    let paths = save_paths(log_path, "replay.save");
    let (run, r) = run_frames(data, log.seed, log.years, Source::Log(&log.run), &paths);
    remove_saves(&paths, &run);
    r?;
    Ok(summary(&run))
}

fn summary(run: &RunLog) -> String {
    format!(
        "{} controls, {} hash lines, {}",
        run.controls.len(),
        run.hashes.len(),
        run.hashes.last().map(String::as_str).unwrap_or("")
    )
}
