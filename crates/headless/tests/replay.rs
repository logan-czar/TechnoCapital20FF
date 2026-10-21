//! `headless record` and `headless replay` (build-plan M10.4, 4.3 "Replay test"; D403): a run's
//! seed, command log and monthly hashes replay to the same hashes on the same machine and build,
//! and a log that was changed in any way does not.

use std::path::{Path, PathBuf};
use std::process::Command;

/// One year of seed 3 sends every kind of control, Save and Load included (checked below).
const SEED: &str = "3";

fn headless(args: &[&str]) -> (bool, String) {
    let out = Command::new(env!("CARGO_BIN_EXE_headless"))
        .args(args)
        .output()
        .expect("run headless");
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    (out.status.success(), text)
}

fn tmp(name: &str) -> PathBuf {
    let dir = Path::new(env!("CARGO_TARGET_TMPDIR")).join("m10_replay");
    std::fs::create_dir_all(&dir).unwrap();
    dir.join(name)
}

fn record(name: &str) -> (PathBuf, String) {
    let path = tmp(name);
    let (ok, out) = headless(&[
        "record",
        "--years",
        "1",
        "--seed",
        SEED,
        "--out",
        path.to_str().unwrap(),
    ]);
    assert!(ok, "{out}");
    let text = std::fs::read_to_string(&path).unwrap();
    (path, text)
}

fn replay(path: &Path) -> (bool, String) {
    headless(&["replay", path.to_str().unwrap()])
}

/// Writes `text` as a new log and replays it.
fn replay_text(name: &str, text: &str) -> (bool, String) {
    let path = tmp(name);
    std::fs::write(&path, text).unwrap();
    replay(&path)
}

#[test]
fn a_recorded_run_replays_to_the_same_hashes() {
    let (path, text) = record("seed3.log");
    let lines: Vec<&str> = text.lines().collect();
    assert_eq!(lines[..3], ["version 1", "seed 3", "years 1"]);
    let hashes: Vec<&str> = lines
        .iter()
        .copied()
        .filter(|l| l.starts_with("hash "))
        .collect();
    // A month close a line (a Load replays some months twice), each with its frame, step,
    // month and full hash; then the end line.
    assert!(hashes.len() >= 12, "{text}");
    assert!(hashes[0].contains(" 2020-01 "), "{}", hashes[0]);
    assert_eq!(hashes[0].rsplit(' ').next().unwrap().len(), 64);
    assert!(lines.last().unwrap().starts_with("end "), "{text}");
    assert!(lines.last().unwrap().contains(" 2021-01-01 00:00 "));
    for kind in [
        "speed", "pause", "resume", "skip", "alert", "watch-", "save", "load",
    ] {
        assert!(
            lines.iter().any(
                |l| l.starts_with("control ") && l.split(' ').nth(2).unwrap().starts_with(kind)
            ),
            "no {kind} control in the log:\n{text}"
        );
    }
    // The run's saves were scratch files beside the log; they are gone.
    let mut save1 = path.as_os_str().to_owned();
    save1.push(".save1");
    assert!(!Path::new(&save1).exists());

    // The same seed records the same log.
    let (_, again) = record("seed3-again.log");
    assert_eq!(again, text);

    let (ok, out) = replay(&path);
    assert!(ok, "{out}");
    assert!(out.contains("matches"), "{out}");
}

#[test]
fn a_changed_log_does_not_replay() {
    let (_, text) = record("seed3-tamper.log");
    let lines: Vec<&str> = text.lines().collect();

    // One hash digit changed, in the fifth hash line.
    let (i, _) = lines
        .iter()
        .enumerate()
        .filter(|(_, l)| l.starts_with("hash "))
        .nth(4)
        .unwrap();
    let mut changed: Vec<String> = lines.iter().map(|l| (*l).to_owned()).collect();
    let last = changed[i].pop().unwrap();
    changed[i].push(if last == '0' { '1' } else { '0' });
    let (ok, out) = replay_text("bad-hash.log", &(changed.join("\n") + "\n"));
    assert!(!ok);
    assert!(out.contains("differs at hash line 5"), "{out}");

    // A control dropped: the first resume of the paused new game. The game then waits for the
    // next control, every later frame moves, and the first hash line no longer matches.
    let first = lines
        .iter()
        .position(|l| l.starts_with("control "))
        .unwrap();
    let dropped: Vec<&str> = lines
        .iter()
        .enumerate()
        .filter(|&(j, _)| j != first)
        .map(|(_, l)| *l)
        .collect();
    let (ok, out) = replay_text("bad-control.log", &(dropped.join("\n") + "\n"));
    assert!(!ok);
    assert!(out.contains("differs at hash line 1"), "{out}");

    // Another seed.
    let reseeded = text.replacen("seed 3\n", "seed 4\n", 1);
    let (ok, out) = replay_text("bad-seed.log", &reseeded);
    assert!(!ok, "{out}");

    // Not a log.
    let (ok, out) = replay_text("bad-format.log", "version 1\nseed 3\nyears 1\nnonsense\n");
    assert!(!ok);
    assert!(out.contains("log line 4"), "{out}");
}
