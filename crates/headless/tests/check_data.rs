//! `headless --check-data` passes on today's data and fails with file, line and field on a bad
//! row (spec 10 M0, build-plan M0.9).

use std::path::Path;
use std::process::Command;

fn run(args: &[&str]) -> (bool, String, String) {
    let out = Command::new(env!("CARGO_BIN_EXE_headless"))
        .args(args)
        .output()
        .expect("run headless");
    (
        out.status.success(),
        String::from_utf8_lossy(&out.stdout).into_owned(),
        String::from_utf8_lossy(&out.stderr).into_owned(),
    )
}

#[test]
fn passes_on_todays_data() {
    let (ok, stdout, stderr) = run(&["--check-data"]);
    assert!(ok, "{stdout}\n{stderr}");
    assert!(stdout.contains("provinces"), "{stdout}");
    assert!(stdout.trim_end().ends_with("OK"), "{stdout}");
}

#[test]
fn bad_row_fails_with_file_line_and_field() {
    // Copy the data, then break one province row.
    let src = sim_data::default_data_dir();
    let dir = Path::new(env!("CARGO_TARGET_TMPDIR")).join("bad-data");
    copy_dir(&src, &dir);
    let file = dir.join("provinces-europe.csv");
    let text = std::fs::read_to_string(&file).unwrap();
    let broken = text.replacen(",Metropolis,30,", ",Metropolis,thirty,", 1);
    assert_ne!(text, broken);
    std::fs::write(&file, broken).unwrap();

    let (ok, _, stderr) = run(&["--check-data", "--data-dir", dir.to_str().unwrap()]);
    assert!(!ok);
    assert!(
        stderr.contains("provinces-europe.csv:2: field `commerce`"),
        "{stderr}"
    );
}

#[test]
fn no_arguments_prints_usage() {
    let (ok, _, stderr) = run(&[]);
    assert!(!ok);
    assert!(stderr.contains("usage"), "{stderr}");
}

fn copy_dir(src: &Path, dst: &Path) {
    std::fs::create_dir_all(dst).unwrap();
    for entry in std::fs::read_dir(src).unwrap() {
        let entry = entry.unwrap();
        let to = dst.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_dir(&entry.path(), &to);
        } else {
            std::fs::copy(entry.path(), to).unwrap();
        }
    }
}
