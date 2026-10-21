//! Cell values and their display formats (build-plan M7.7; M9 A2, D456): money, percent,
//! counts, per-share prices, dates, ratings, ratios, colored gains and losses, links to pages,
//! estimate bands, text and "?" for values the player does not know (20-ui 20.1).

use std::cmp::Ordering;

use bevy::prelude::Color;
use sim::finance::rating::Rating;
use sim::time::Date;

use crate::pages::PageRef;
use crate::ui::theme::color;

/// What a [`Cell::Gain`] counts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GainUnit {
    /// A fraction shown as a percent: +1.2%.
    Percent,
    /// USD, scaled: +$1.20M.
    Money,
    /// USD a share: +$0.45.
    Price,
}

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
    /// USD a share with cents: $45.23 (spec 3.10 prices).
    Price(f64),
    /// A calendar day: 03 Jan 2020.
    Date(Date),
    /// A credit rating (spec 5.12); sorts best first ascending.
    Rating(Rating),
    /// A multiple: 1.23x.
    Ratio(f64),
    /// A signed change, colored by its sign: gains cyan, losses magenta (11.4).
    Gain(f64, GainUnit),
    /// A named thing that opens its page when clicked (D454); sorts by its text.
    Link(PageRef, String),
    /// An estimate band in USD (M9 estimate bands): "$12M-$18M". Sorts by its midpoint, which
    /// is all the player knows: never by a hidden value (D456).
    Band {
        low: f64,
        high: f64,
    },
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
            Cell::Price(v) => price(*v),
            Cell::Date(d) => date(*d),
            Cell::Rating(r) => r.label().to_owned(),
            Cell::Ratio(v) => ratio(*v),
            Cell::Gain(v, unit) => gain(*v, *unit),
            Cell::Link(_, text) => text.clone(),
            Cell::Band { low, high } => band(*low, *high),
            Cell::Unknown => "?".to_owned(),
        }
    }

    /// True for the numeric kinds, which align right.
    pub fn is_numeric(&self) -> bool {
        matches!(
            self,
            Cell::Int(_)
                | Cell::Money(_)
                | Cell::Percent(_)
                | Cell::Price(_)
                | Cell::Ratio(_)
                | Cell::Gain(..)
                | Cell::Band { .. }
        )
    }

    /// The text color, when the cell has its own: gains, losses and links.
    pub fn color(&self) -> Option<Color> {
        match self {
            Cell::Gain(v, _) if *v > 0.0 => Some(color::GAIN),
            Cell::Gain(v, _) if *v < 0.0 => Some(color::LOSS),
            Cell::Gain(..) => Some(color::TEXT_MUTED),
            Cell::Link(..) => Some(color::LINK),
            _ => None,
        }
    }

    /// The page a link cell opens.
    pub fn link(&self) -> Option<&PageRef> {
        match self {
            Cell::Link(p, _) => Some(p),
            _ => None,
        }
    }

    /// Ascending order between two cells of one column: numbers by value, text and links by
    /// bytes, dates by day, ratings best first, bands by midpoint. Unknown cells are not
    /// ordered here; [`super::sort_order`] puts them last in both directions.
    pub fn cmp_value(&self, other: &Cell) -> Ordering {
        match (self, other) {
            (Cell::Unknown, Cell::Unknown) => Ordering::Equal,
            (Cell::Unknown, _) => Ordering::Greater,
            (_, Cell::Unknown) => Ordering::Less,
            (a, b) => match (a.number(), b.number()) {
                (Some(x), Some(y)) => x.total_cmp(&y),
                // Mixed text and numbers in one column: numbers first.
                (Some(_), None) => Ordering::Less,
                (None, Some(_)) => Ordering::Greater,
                (None, None) => a.text().cmp(b.text()),
            },
        }
    }

    fn text(&self) -> &str {
        match self {
            Cell::Text(s) | Cell::Link(_, s) => s,
            _ => "",
        }
    }

    /// The value a cell sorts by, for the numeric kinds.
    pub fn number(&self) -> Option<f64> {
        match self {
            Cell::Int(n) => Some(*n as f64),
            Cell::Money(v) | Cell::Percent(v) | Cell::Price(v) | Cell::Ratio(v) => Some(*v),
            Cell::Gain(v, _) => Some(*v),
            Cell::Date(d) => Some(d.days_since_epoch() as f64),
            Cell::Rating(r) => Some(*r as u8 as f64),
            Cell::Band { low, high } => Some((low + high) / 2.0),
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

/// USD a share with cents and thousands separators: $45.23, $1,234.50.
pub fn price(v: f64) -> String {
    if !v.is_finite() {
        return "?".to_owned();
    }
    let cents = (v.abs() * 100.0).round() as i64;
    let sign = if v < 0.0 && cents > 0 { "-" } else { "" };
    format!("{sign}${}.{:02}", int(cents / 100), cents % 100)
}

/// Month names (20-ui 20.2.1 dates).
pub const MONTHS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/// A day as `03 Jan 2020` (fixed width, so a date column aligns).
pub fn date(d: Date) -> String {
    let m = MONTHS
        .get(usize::from(d.month.saturating_sub(1)))
        .copied()
        .unwrap_or("?");
    format!("{:02} {m} {}", d.day, d.year)
}

/// A multiple with two decimals: 1.23x.
pub fn ratio(v: f64) -> String {
    if !v.is_finite() {
        return "?".to_owned();
    }
    format!("{v:.2}x")
}

/// A signed change: +1.2%, -$0.45, +$1.20M; zero has no sign.
pub fn gain(v: f64, unit: GainUnit) -> String {
    if !v.is_finite() {
        return "?".to_owned();
    }
    let body = match unit {
        GainUnit::Percent => percent(v.abs()),
        GainUnit::Money => money(v.abs()),
        GainUnit::Price => price(v.abs()),
    };
    let zero = body.trim_start_matches(['$', '0', '.', ',']).is_empty()
        || matches!(body.as_str(), "0.0%" | "$0" | "$0.00");
    if zero {
        return body;
    }
    format!("{}{body}", if v < 0.0 { "-" } else { "+" })
}

/// A money figure from a view (M9 estimate bands, D420): exact as [`money`], a band as
/// [`band`].
pub fn figure(f: sim::views::estimate::Figure) -> String {
    match f {
        sim::views::estimate::Figure::Exact(x) => money(x),
        sim::views::estimate::Figure::Band(b) => band(b.low, b.high),
    }
}

/// An estimate band: `$12.0M-$18.0M`. The font is ASCII (D302), so the separator is a hyphen;
/// a band reaching below zero reads `-$5.00M to $3.00M` instead, so no hyphen is a minus.
pub fn band(low: f64, high: f64) -> String {
    if !(low.is_finite() && high.is_finite()) {
        return "?".to_owned();
    }
    if low < 0.0 || high < 0.0 {
        format!("{} to {}", money(low), money(high))
    } else {
        format!("{}-{}", money(low), money(high))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sim::world::CompanyId;

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
    fn new_cell_formats() {
        assert_eq!(Cell::Price(45.234).display(), "$45.23");
        assert_eq!(Cell::Price(1234.5).display(), "$1,234.50");
        assert_eq!(Cell::Price(0.005).display(), "$0.01");
        assert_eq!(Cell::Price(-0.001).display(), "$0.00");
        assert_eq!(Cell::Date(Date::ymd(2020, 1, 3)).display(), "03 Jan 2020");
        assert_eq!(Cell::Date(Date::ymd(2031, 12, 25)).display(), "25 Dec 2031");
        assert_eq!(
            Cell::Rating(Rating::BbbMinus).display(),
            Rating::BbbMinus.label()
        );
        assert_eq!(Cell::Ratio(1.234).display(), "1.23x");
        assert_eq!(Cell::Gain(0.012, GainUnit::Percent).display(), "+1.2%");
        assert_eq!(Cell::Gain(-0.45, GainUnit::Price).display(), "-$0.45");
        assert_eq!(Cell::Gain(1.2e6, GainUnit::Money).display(), "+$1.20M");
        assert_eq!(Cell::Gain(0.0, GainUnit::Percent).display(), "0.0%");
        assert_eq!(Cell::Gain(0.0001, GainUnit::Price).display(), "$0.00");
        assert_eq!(
            Cell::Band {
                low: 12e6,
                high: 18e6
            }
            .display(),
            "$12.0M-$18.0M"
        );
        assert_eq!(
            Cell::Band {
                low: -5e6,
                high: 3e6
            }
            .display(),
            "-$5.00M to $3.00M"
        );
        let link = Cell::Link(PageRef::Company(CompanyId(4)), "Arrowhead".into());
        assert_eq!(link.display(), "Arrowhead");
        assert_eq!(link.link(), Some(&PageRef::Company(CompanyId(4))));
    }

    #[test]
    fn gains_and_links_have_colors() {
        assert_eq!(
            Cell::Gain(1.0, GainUnit::Percent).color(),
            Some(color::GAIN)
        );
        assert_eq!(
            Cell::Gain(-1.0, GainUnit::Percent).color(),
            Some(color::LOSS)
        );
        assert_eq!(
            Cell::Gain(0.0, GainUnit::Percent).color(),
            Some(color::TEXT_MUTED)
        );
        assert_eq!(
            Cell::Link(PageRef::News, "x".into()).color(),
            Some(color::LINK)
        );
        assert_eq!(Cell::Money(1.0).color(), None);
    }

    #[test]
    fn new_cells_sort_by_what_they_show() {
        let b = |low: f64, high: f64| Cell::Band { low, high };
        // Bands by midpoint: 10-30 (20) after 12-18 (15), before 5-40 (22.5).
        assert_eq!(b(10.0, 30.0).cmp_value(&b(12.0, 18.0)), Ordering::Greater);
        assert_eq!(b(10.0, 30.0).cmp_value(&b(5.0, 40.0)), Ordering::Less);
        assert_eq!(
            Cell::Date(Date::ymd(2020, 2, 1)).cmp_value(&Cell::Date(Date::ymd(2020, 1, 31))),
            Ordering::Greater
        );
        assert_eq!(
            Cell::Rating(Rating::Aaa).cmp_value(&Cell::Rating(Rating::Bb)),
            Ordering::Less,
            "best first ascending"
        );
        let l = |s: &str| Cell::Link(PageRef::News, s.into());
        assert_eq!(l("b").cmp_value(&l("a")), Ordering::Greater);
        assert_eq!(l("b").cmp_value(&Cell::Text("c".into())), Ordering::Less);
        assert_eq!(
            Cell::Gain(-1.0, GainUnit::Price).cmp_value(&Cell::Gain(0.5, GainUnit::Price)),
            Ordering::Less
        );
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
