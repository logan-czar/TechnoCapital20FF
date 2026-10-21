//! Load and check errors that name the file, line and field (spec 10 M0, build-plan M0.3).

use std::fmt;

/// One problem in the data: where it is and what is wrong.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub struct DataError {
    /// File path relative to the data directory, such as `provinces-europe.csv`.
    pub file: String,
    /// 1-based line in the file (the header is line 1), when the problem is in one row.
    pub line: Option<u64>,
    /// Column name, when the problem is in one field.
    pub field: Option<String>,
    pub message: String,
}

impl DataError {
    /// A problem with a whole file (missing, unreadable, wrong row count).
    pub fn file(file: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            file: file.into(),
            line: None,
            field: None,
            message: message.into(),
        }
    }

    /// A problem in one field of one row.
    pub fn field(
        file: impl Into<String>,
        line: u64,
        field: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            file: file.into(),
            line: Some(line),
            field: Some(field.into()),
            message: message.into(),
        }
    }
}

impl fmt::Display for DataError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.file)?;
        if let Some(line) = self.line {
            write!(f, ":{line}")?;
        }
        if let Some(field) = &self.field {
            write!(f, ": field `{field}`")?;
        }
        write!(f, ": {}", self.message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_names_file_line_and_field() {
        let e = DataError::field("countries.csv", 7, "gdp_usd_bn", "invalid float literal");
        assert_eq!(
            e.to_string(),
            "countries.csv:7: field `gdp_usd_bn`: invalid float literal"
        );
        assert_eq!(
            DataError::file("ai-boom.csv", "missing").to_string(),
            "ai-boom.csv: missing"
        );
    }
}
