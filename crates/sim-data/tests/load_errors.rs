//! A bad row is rejected with its file, line and field (spec 10 M0, build-plan M0.3).

use std::path::{Path, PathBuf};

use sim_data::{Country, DataError, load_table};

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn load_err(file: &str) -> DataError {
    load_table::<Country>(&fixtures(), file).expect_err("fixture should fail to load")
}

fn assert_at(e: &DataError, file: &str, line: u64, field: Option<&str>) {
    assert_eq!(e.file, file, "{e}");
    assert_eq!(e.line, Some(line), "{e}");
    assert_eq!(e.field.as_deref(), field, "{e}");
}

#[test]
fn bad_number_names_line_and_field() {
    let e = load_err("bad-number.csv");
    assert_at(&e, "bad-number.csv", 3, Some("gdp_usd_bn"));
    assert!(
        e.to_string()
            .starts_with("bad-number.csv:3: field `gdp_usd_bn`:")
    );
}

#[test]
fn bad_yes_no_names_line_and_field() {
    let e = load_err("bad-yes-no.csv");
    assert_at(&e, "bad-yes-no.csv", 3, Some("major"));
    assert!(e.message.contains("expected Y or N"), "{e}");
}

#[test]
fn short_row_names_line() {
    let e = load_err("short-row.csv");
    assert_at(&e, "short-row.csv", 4, None);
    assert!(e.message.contains("3 fields"), "{e}");
}

#[test]
fn missing_column_is_named() {
    let e = load_err("missing-column.csv");
    assert_at(&e, "missing-column.csv", 2, Some("population_m"));
}

#[test]
fn unknown_column_is_rejected() {
    let e = load_err("unknown-column.csv");
    assert_at(&e, "unknown-column.csv", 2, Some("wage_level"));
}

#[test]
fn line_counts_quoted_newlines() {
    // The first row spans lines 2 and 3, so the bad row starts on line 4.
    let e = load_err("multiline-negative.csv");
    assert_at(&e, "multiline-negative.csv", 4, Some("wealth_index"));
}

#[test]
fn missing_file_is_named() {
    let e = load_err("no-such-file.csv");
    assert_eq!(e.file, "no-such-file.csv");
    assert_eq!(e.line, None);
}

#[test]
fn good_rows_load() {
    let t = load_table::<Country>(&sim_data::default_data_dir(), "countries.csv").unwrap();
    assert_eq!(t.lines[0], 2);
    assert_eq!(t.rows[0].iso3, "USA");
}

#[test]
fn crlf_first_row_is_line_2() {
    // csv's own line counter says 1 here; lines are counted from the bytes.
    let e = load_err("crlf-first-row.csv");
    assert_at(&e, "crlf-first-row.csv", 2, Some("gdp_usd_bn"));
}
