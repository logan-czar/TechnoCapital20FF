//! Load-time checks on the starting world (build-plan M0.2; the validate.py ports come in M0.4).

use crate::{DataError, WorldData};

/// Expected row counts (spec 10 M0, build-plan M0.2).
pub const EXPECTED_COUNTS: [(&str, usize); 10] = [
    ("countries", 211),
    ("provinces", 3255),
    ("companies", 651),
    ("characters", 296),
    ("industries", 42),
    ("country-economy", 211),
    ("financial-zones", 26),
    ("ai-boom", 15),
    ("key-cities", 88),
    ("company-start", 651),
];

/// Runs every check and returns all problems found (empty when the data is good).
pub fn check(w: &WorldData) -> Vec<DataError> {
    let mut errors = Vec::new();
    counts(w, &mut errors);
    errors
}

fn counts(w: &WorldData, errors: &mut Vec<DataError>) {
    let have = w.counts();
    for (name, expected) in EXPECTED_COUNTS {
        let n = have.iter().find(|(k, _)| *k == name).map_or(0, |(_, n)| *n);
        if n != expected {
            errors.push(DataError::file(
                format!("{name}.csv"),
                format!("{n} rows, expected {expected}"),
            ));
        }
    }
}
