//! Generic CSV table loading with serde and csv (build-plan 2.1). Every error names the file, the
//! line and, when it can, the column (spec 10 M0).

use std::path::Path;

use csv::{ErrorKind, Position, StringRecord};
use serde::de::DeserializeOwned;

use crate::DataError;

/// The rows of one CSV file, with the line each row starts on.
#[derive(Debug, Clone)]
pub struct Table<T> {
    /// Path relative to the data directory, as used in error messages.
    pub file: String,
    pub rows: Vec<T>,
    /// 1-based line of each row (the header is line 1).
    pub lines: Vec<u64>,
}

impl<T> Table<T> {
    pub fn len(&self) -> usize {
        self.rows.len()
    }

    pub fn is_empty(&self) -> bool {
        self.rows.is_empty()
    }

    /// Rows with their line numbers.
    pub fn iter(&self) -> impl Iterator<Item = (u64, &T)> {
        self.lines.iter().copied().zip(&self.rows)
    }

    /// An error in `field` of the row on `line`.
    pub fn err(&self, line: u64, field: &str, message: impl Into<String>) -> DataError {
        DataError::field(&self.file, line, field, message)
    }

    /// An error about the whole file.
    pub fn file_err(&self, message: impl Into<String>) -> DataError {
        DataError::file(&self.file, message)
    }
}

/// Loads `dir/file` into rows of `T`, using the header row to match columns to fields.
pub fn load_table<T: DeserializeOwned>(dir: &Path, file: &str) -> Result<Table<T>, DataError> {
    let bytes = std::fs::read(dir.join(file)).map_err(|e| DataError::file(file, e.to_string()))?;
    let lines = LineIndex::new(&bytes);
    let mut reader = csv::Reader::from_reader(bytes.as_slice());
    let headers = reader
        .headers()
        .map_err(|e| csv_error(file, &lines, &StringRecord::new(), e))?
        .clone();
    let mut table = Table {
        file: file.to_owned(),
        rows: Vec::new(),
        lines: Vec::new(),
    };
    let mut record = StringRecord::new();
    while reader
        .read_record(&mut record)
        .map_err(|e| csv_error(file, &lines, &headers, e))?
    {
        let row = record.deserialize(Some(&headers)).map_err(|e| {
            let mut err = csv_error(file, &lines, &headers, e);
            if err.field.is_none() {
                err.field = find_bad_column::<T>(&headers, &record, &err.message);
            }
            err
        })?;
        table.rows.push(row);
        table.lines.push(lines.line(record.position()));
    }
    Ok(table)
}

/// Line numbers from byte offsets. After a CRLF line (the province files use CRLF) csv reports the
/// next record as starting on the `\n` of the line before, with a line count one short, so lines
/// are counted from the bytes, and a `\n` at the start offset belongs to the previous line.
struct LineIndex(Vec<u64>);

impl LineIndex {
    fn new(bytes: &[u8]) -> Self {
        Self(
            (0u64..)
                .zip(bytes)
                .filter(|&(_, &b)| b == b'\n')
                .map(|(i, _)| i)
                .collect(),
        )
    }

    /// 1-based line on which the record at `pos` starts (0 when unknown).
    fn line(&self, pos: Option<&Position>) -> u64 {
        pos.map_or(0, |p| {
            self.0.partition_point(|&nl| nl <= p.byte()) as u64 + 1
        })
    }
}

fn csv_error(file: &str, lines: &LineIndex, headers: &StringRecord, e: csv::Error) -> DataError {
    let column = |i: Option<u64>| {
        i.and_then(|i| headers.get(usize::try_from(i).ok()?))
            .map(str::to_owned)
    };
    let (pos, field, message) = match e.kind() {
        ErrorKind::Deserialize { pos, err } => (
            pos.as_ref(),
            column(err.field()).or_else(|| missing_field(&err.kind().to_string())),
            err.kind().to_string(),
        ),
        ErrorKind::UnequalLengths {
            pos,
            expected_len,
            len,
        } => (
            pos.as_ref(),
            None,
            format!("row has {len} fields, the header has {expected_len}"),
        ),
        ErrorKind::Utf8 { pos, err } => (
            pos.as_ref(),
            column(Some(err.field() as u64)),
            "not valid UTF-8".to_owned(),
        ),
        _ => (e.position(), None, e.to_string()),
    };
    DataError {
        file: file.to_owned(),
        line: pos.map(|p| lines.line(Some(p))),
        field,
        message,
    }
}

/// Errors raised by a field's own deserializer (such as a bad `Y`/`N`) carry no column index in
/// csv. Find the column by loading ever longer prefixes of the row: until the bad column is
/// included the error is a "missing field" one, so the first prefix that fails with the original
/// message ends at the bad column.
fn find_bad_column<T: DeserializeOwned>(
    headers: &StringRecord,
    record: &StringRecord,
    message: &str,
) -> Option<String> {
    (1..=headers.len()).find_map(|k| {
        let head: StringRecord = headers.iter().take(k).collect();
        let row: StringRecord = record.iter().take(k).collect();
        match row.deserialize::<T>(Some(&head)) {
            Err(e) => match e.kind() {
                ErrorKind::Deserialize { err, .. } if err.kind().to_string() == message => {
                    headers.get(k - 1).map(str::to_owned)
                }
                _ => None,
            },
            Ok(_) => None,
        }
    })
}

/// serde reports a missing or unknown column without an index; take the name from its message.
fn missing_field(message: &str) -> Option<String> {
    if !(message.starts_with("missing field") || message.starts_with("unknown field")) {
        return None;
    }
    let start = message.find('`')? + 1;
    let len = message[start..].find('`')?;
    Some(message[start..start + len].to_owned())
}
