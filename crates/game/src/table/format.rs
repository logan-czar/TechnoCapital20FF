//! Cell values and their display formats (build-plan M7.7): money, percent, counts, text and
//! "?" for values the player does not know (20-ui 20.1: unknown values show "?").

use std::cmp::Ordering;

/// One table cell.
#[derive(Debug, Clone, PartialEq)]
pub enum Cell {
    Text(String),
    /// A count, shown with thousands separators.
    Int(i64),
    /// US dollars (spec 3: money is f64 USD), shown scaled: $1.35T, $38.0B, $12.3M, $45.6K.
    Money(f64),
    /// A fraction, shown as a percent: 0.123 is 12.3%.
    Percent(f64),
    /// A value the player does not know: "?".
    Unknown,
}

impl Cell {
    /// The display string.
    pub fn display(&self) -> String {
        match self {
            Cell::Text(s) => s.clone(),
            Cell::Int(n) => int(*n),
            Cell::Money(v) => money(*v),
            Cell::Percent(f) => percent(*f),
            Cell::Unknown => "?".to_owned(),
        }
    }

    /// True for the numeric kinds, which align right.
    pub fn is_numeric(&self) -> bool {
        matches!(self, Cell::Int(_) | Cell::Money(_) | Cell::Percent(_))
    }

    /// Ascending order between two cells of one column: numbers by value, text by bytes. Unknown
    /// cells are not ordered here; [`super::sort_order`] puts them last in both directions.
    pub fn cmp_value(&self, other: &Cell) -> Ordering {
        match (self, other) {
            (Cell::Text(a), Cell::Text(b)) => a.cmp(b),
            (Cell::Unknown, Cell::Unknown) => Ordering::Equal,
            (Cell::Unknown, _) => Ordering::Greater,
            (_, Cell::Unknown) => Ordering::Less,
            (a, b) => match (a.number(), b.number()) {
                (Some(x), Some(y)) => x.total_cmp(&y),
                // Mixed text and numbers in one column: numbers first.
                (Some(_), None) => Ordering::Less,
                (None, Some(_)) => Ordering::Greater,
                (None, None) => Ordering::Equal,
            },
        }
    }

    fn number(&self) -> Option<f64> {
        match self {
            Cell::Int(n) => Some(*n as f64),
            Cell::Money(v) | Cell::Percent(v) => Some(*v),
            _ => None,
        }
    }
}

/// `1234567` as `1,234,567`.
pub fn int(n: i64) -> String {
    let digits = n.unsigned_abs().to_string();
    let mut out = String::with_capacity(digits.len() + digits.len() / 3 + 1);
    if n < 0 {
        out.push('-');
    }
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i).is_multiple_of(3) {
            out.push(',');
        }
        out.push(c);
    }
    out
}

/// Money scaled to T, B, M or K with three significant digits; under $1,000 in whole dollars.
pub fn money(v: f64) -> String {
    if !v.is_finite() {
        return "?".to_owned();
    }
    let sign = if v < 0.0 { "-" } else { "" };
    let a = v.abs();
    const SCALES: [(f64, &str); 4] = [(1e12, "T"), (1e9, "B"), (1e6, "M"), (1e3, "K")];
    for (scale, suffix) in SCALES {
        if a >= scale {
            let x = a / scale;
            let decimals = if x >= 100.0 {
                0
            } else if x >= 10.0 {
                1
            } else {
                2
            };
            return format!("{sign}${x:.decimals$}{suffix}");
        }
    }
    format!("{sign}${a:.0}")
}

/// A fraction as a percent with one decimal; signed values keep their minus.
pub fn percent(f: f64) -> String {
    if !f.is_finite() {
        return "?".to_owned();
    }
    format!("{:.1}%", f * 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn money_scales() {
        assert_eq!(money(1.35e12), "$1.35T");
        assert_eq!(money(38e9), "$38.0B");
        assert_eq!(money(123.4e6), "$123M");
        assert_eq!(money(45_600.0), "$45.6K");
        assert_eq!(money(950.0), "$950");
        assert_eq!(money(-2.5e6), "-$2.50M");
        assert_eq!(money(0.0), "$0");
        assert_eq!(money(f64::NAN), "?");
    }

    #[test]
    fn percents_and_counts() {
        assert_eq!(percent(0.123), "12.3%");
        assert_eq!(percent(-0.05), "-5.0%");
        assert_eq!(int(1_234_567), "1,234,567");
        assert_eq!(int(-1000), "-1,000");
        assert_eq!(int(999), "999");
        assert_eq!(Cell::Unknown.display(), "?");
    }

    #[test]
    fn unknown_sorts_after_everything() {
        assert_eq!(
            Cell::Unknown.cmp_value(&Cell::Money(1e12)),
            Ordering::Greater
        );
        assert_eq!(Cell::Int(2).cmp_value(&Cell::Int(10)), Ordering::Less);
        assert_eq!(
            Cell::Text("b".into()).cmp_value(&Cell::Text("a".into())),
            Ordering::Greater
        );
    }
}
