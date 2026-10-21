//! Chart data (M9.1; D457): OHLC bars with an optional estimated-fair-value band, the weekly
//! aggregation for the 10-year view, and the scale and primitives a chart is drawn from. Pure
//! functions, so the drawing is tested without a window.

use bevy::prelude::Alpha;
use bevy::prelude::Color;
use sim::market::daily::DailyBar;
use sim::time::Date;
use sim::views::estimate::Figure;

use crate::table::format;
use crate::ui::theme::color;

/// One bar: a day's, or a week's when aggregated, with the EFV band at its close when known.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Ohlc {
    pub date: Date,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    /// The estimated fair value band (low, high), USD a share (3.14.2; spec 8 F3).
    pub band: Option<(f64, f64)>,
}

impl Ohlc {
    /// A view bar with its EFV band (D424, D465): the bar's `efv_low()` to `efv_high()`, the
    /// estimate in force through that day (a weekly or monthly bar from `get_price_history`
    /// carries its last day's EFV).
    pub fn from_bar(b: &DailyBar) -> Ohlc {
        Ohlc {
            date: b.date,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            band: (b.efv.is_finite() && b.efv > 0.0).then(|| (b.efv_low(), b.efv_high())),
        }
    }

    pub fn with_band(mut self, low: f64, high: f64) -> Ohlc {
        self.band = Some((low, high));
        self
    }
}

/// Years the long view covers (3-markets 3.13.1: weekly bars up to 10 years).
pub const LONG_VIEW_YEARS: i32 = 10;

/// Daily bars into Monday-to-Sunday weeks, each dated by its first bar (as v_price_bars'
/// weekly resolution): the first open, the last close, the highest high and lowest low, and the
/// band of the week's last bar (the band at the close, as the close is the last day's; D457),
/// as v_price_bars' weekly bars take the last day's EFV (D424).
pub fn weekly(daily: &[Ohlc]) -> Vec<Ohlc> {
    let key = |d: Date| d.days_since_epoch() - d.weekday().index() as i64;
    let mut out: Vec<Ohlc> = Vec::with_capacity(daily.len() / 5 + 1);
    let mut last_key = None;
    for b in daily {
        let k = key(b.date);
        match out.last_mut() {
            Some(w) if last_key == Some(k) => {
                w.high = w.high.max(b.high);
                w.low = w.low.min(b.low);
                w.close = b.close;
                w.band = b.band;
            }
            _ => {
                out.push(*b);
                last_key = Some(k);
            }
        }
    }
    out
}

/// The bars of the last `years` years up to the last bar (dates after the same day `years`
/// earlier).
pub fn last_years(daily: &[Ohlc], years: i32) -> &[Ohlc] {
    let Some(last) = daily.last() else {
        return daily;
    };
    let d = last.date;
    // 29 Feb falls back to 28 Feb in a non-leap year.
    let from = Date::new(d.year - years, d.month, d.day)
        .or_else(|| Date::new(d.year - years, d.month, d.day - 1))
        .unwrap_or(d);
    let start = daily.partition_point(|b| b.date <= from);
    &daily[start..]
}

/// The 10-year view: the last ten years in weekly bars.
pub fn ten_year_view(daily: &[Ohlc]) -> Vec<Ohlc> {
    weekly(last_years(daily, LONG_VIEW_YEARS))
}

/// How values read on the axis and in the readout.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ValueFormat {
    /// USD a share.
    #[default]
    Price,
    /// USD, scaled.
    Money,
    /// A fraction as a percent.
    Percent,
    Number,
}

impl ValueFormat {
    pub fn fmt(self, v: f64) -> String {
        match self {
            ValueFormat::Price => format::price(v),
            ValueFormat::Money => format::money(v),
            ValueFormat::Percent => format::percent(v),
            ValueFormat::Number => format!("{v:.2}"),
        }
    }

    /// A band's range, as the table writes one (D456): `low-high`, or `low to high` when it
    /// reaches below zero.
    pub fn band(self, low: f64, high: f64) -> String {
        let (l, h) = (self.fmt(low), self.fmt(high));
        if low < 0.0 || high < 0.0 {
            format!("{l} to {h}")
        } else {
            format!("{l}-{h}")
        }
    }
}

/// One series of a chart. Every series of a chart has one value per x slot.
#[derive(Debug, Clone, PartialEq)]
pub enum Series {
    Line {
        name: String,
        values: Vec<f64>,
        color: Color,
    },
    /// Bars from zero; `None` colors them by sign (gains cyan, losses magenta).
    Bars {
        name: String,
        values: Vec<f64>,
        color: Option<Color>,
    },
    /// Candles, drawn over their EFV band.
    Candles(Vec<Ohlc>),
    /// An estimate band per slot (D420, D466): a translucent strip from low to high, `None`
    /// where the figure is exact. Put it before the series it belongs to, so it draws under it.
    Band {
        name: String,
        bands: Vec<Option<(f64, f64)>>,
        color: Color,
    },
}

impl Series {
    pub fn len(&self) -> usize {
        match self {
            Series::Line { values, .. } | Series::Bars { values, .. } => values.len(),
            Series::Candles(c) => c.len(),
            Series::Band { bands, .. } => bands.len(),
        }
    }

    /// A line of view figures (D466): the exact ones as a line, the bands as a band strip under
    /// it (the line breaks there), so a chart never draws a band's estimate as if it were known
    /// and its readout shows a band's range.
    pub fn figures(name: &str, figures: &[Figure], color: Color) -> Vec<Series> {
        let values = figures
            .iter()
            .map(|f| f.exact().unwrap_or(f64::NAN))
            .collect();
        let line = Series::Line {
            name: name.to_owned(),
            values,
            color,
        };
        if !figures.iter().any(|f| f.is_band()) {
            return vec![line];
        }
        let bands = figures
            .iter()
            .map(|f| f.band().map(|b| (b.low, b.high)))
            .collect();
        vec![
            Series::Band {
                name: name.to_owned(),
                bands,
                color: color.with_alpha(BAND_ALPHA),
            },
            line,
        ]
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// What a chart shows.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ChartModel {
    pub title: String,
    /// The x slots' labels (dates, quarters), for the readout.
    pub labels: Vec<String>,
    pub series: Vec<Series>,
    pub format: ValueFormat,
    /// A horizontal reference line (an industry's long-term growth).
    pub reference: Option<(f64, Color)>,
}

impl ChartModel {
    /// Slots on the x axis: the longest series.
    pub fn slots(&self) -> usize {
        self.series.iter().map(Series::len).max().unwrap_or(0)
    }

    /// Daily candles (with their bands), labelled by date.
    pub fn candles(title: &str, bars: Vec<Ohlc>) -> ChartModel {
        ChartModel {
            title: title.to_owned(),
            labels: bars.iter().map(|b| format::date(b.date)).collect(),
            series: vec![Series::Candles(bars)],
            format: ValueFormat::Price,
            reference: None,
        }
    }

    /// The value range over every series, bands and the reference included (bars include 0).
    pub fn range(&self) -> Option<(f64, f64)> {
        let mut lo = f64::INFINITY;
        let mut hi = f64::NEG_INFINITY;
        let mut take = |v: f64| {
            if v.is_finite() {
                lo = lo.min(v);
                hi = hi.max(v);
            }
        };
        for s in &self.series {
            match s {
                Series::Line { values, .. } => values.iter().copied().for_each(&mut take),
                Series::Bars { values, .. } => {
                    take(0.0);
                    values.iter().copied().for_each(&mut take);
                }
                Series::Candles(c) => {
                    for b in c {
                        take(b.low);
                        take(b.high);
                        if let Some((l, h)) = b.band {
                            take(l);
                            take(h);
                        }
                    }
                }
                Series::Band { bands, .. } => {
                    for &(l, h) in bands.iter().flatten() {
                        take(l);
                        take(h);
                    }
                }
            }
        }
        if let Some((r, _)) = self.reference {
            take(r);
        }
        (lo <= hi).then_some((lo, hi))
    }
}

/// A drawing primitive in plot pixels (origin top left).
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Prim {
    Rect {
        x: f32,
        y: f32,
        w: f32,
        h: f32,
        color: Color,
    },
    /// A line segment drawn as a thin rotated rectangle.
    Segment {
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        width: f32,
        color: Color,
    },
}

/// The y scale: value to plot pixels.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Scale {
    pub lo: f64,
    pub hi: f64,
    pub h: f32,
}

impl Scale {
    /// The range padded by 4% each way (a flat range opens to ±1 or ±1% of its value).
    pub fn new(range: (f64, f64), h: f32) -> Scale {
        let (mut lo, mut hi) = range;
        if hi - lo <= f64::EPSILON * hi.abs().max(1.0) {
            let pad = (hi.abs() * 0.01).max(1.0);
            lo -= pad;
            hi += pad;
        }
        let pad = (hi - lo) * 0.04;
        Scale {
            lo: lo - pad,
            hi: hi + pad,
            h,
        }
    }

    pub fn y(&self, v: f64) -> f32 {
        let t = (v - self.lo) / (self.hi - self.lo);
        (f64::from(self.h) * (1.0 - t)) as f32
    }

    /// The value at plot height `y`.
    pub fn value(&self, y: f32) -> f64 {
        self.lo + (1.0 - f64::from(y) / f64::from(self.h)) * (self.hi - self.lo)
    }

    /// About `n` round gridline values inside the range.
    pub fn ticks(&self, n: usize) -> Vec<f64> {
        let span = self.hi - self.lo;
        if span <= 0.0 || n == 0 {
            return Vec::new();
        }
        let raw = span / n as f64;
        let mag = 10f64.powf(raw.log10().floor());
        let step = [1.0, 2.0, 2.5, 5.0, 10.0]
            .into_iter()
            .map(|m| m * mag)
            .find(|s| *s >= raw)
            .unwrap_or(10.0 * mag);
        let mut v = (self.lo / step).ceil() * step;
        let mut out = Vec::new();
        while v <= self.hi && out.len() < 2 * n + 2 {
            out.push(v);
            v += step;
        }
        out
    }
}

/// The EFV band's color (amber, translucent: an estimate, 11.4 warnings).
pub const BAND_COLOR: Color = Color::srgba(1.0, 0.690, 0.0, 0.16);
/// The alpha of a figure's estimate band, in its line's color (D466).
pub const BAND_ALPHA: f32 = 0.22;
/// A candle body's share of its slot.
pub const BODY_SHARE: f32 = 0.7;

/// The primitives that draw `m` in a plot `w` by `h`, and its scale. Slots split the width
/// evenly; a body or bar is at least one pixel wide.
pub fn primitives(m: &ChartModel, w: f32, h: f32) -> (Vec<Prim>, Option<Scale>) {
    let n = m.slots();
    let Some(range) = m.range() else {
        return (Vec::new(), None);
    };
    if n == 0 || w <= 0.0 || h <= 0.0 {
        return (Vec::new(), None);
    }
    let sc = Scale::new(range, h);
    let slot = w / n as f32;
    let body_w = (slot * BODY_SHARE).max(1.0);
    let cx = |i: usize| slot * (i as f32 + 0.5);
    let mut out = Vec::new();
    if let Some((r, c)) = m.reference {
        out.push(Prim::Rect {
            x: 0.0,
            y: sc.y(r) - 0.5,
            w,
            h: 1.0,
            color: c,
        });
    }
    for s in &m.series {
        match s {
            Series::Candles(c) => {
                // Bands first, so the candles draw over them.
                for (i, b) in c.iter().enumerate() {
                    if let Some((l, hb)) = b.band {
                        let (y1, y2) = (sc.y(hb), sc.y(l));
                        out.push(Prim::Rect {
                            x: slot * i as f32,
                            y: y1,
                            w: slot.max(1.0),
                            h: (y2 - y1).max(1.0),
                            color: BAND_COLOR,
                        });
                    }
                }
                for (i, b) in c.iter().enumerate() {
                    let up = b.close >= b.open;
                    let col = if up { color::GAIN } else { color::LOSS };
                    let (yh, yl) = (sc.y(b.high), sc.y(b.low));
                    out.push(Prim::Rect {
                        x: cx(i) - 0.5,
                        y: yh,
                        w: 1.0,
                        h: (yl - yh).max(1.0),
                        color: col,
                    });
                    let (yo, yc) = (sc.y(b.open), sc.y(b.close));
                    out.push(Prim::Rect {
                        x: cx(i) - body_w / 2.0,
                        y: yo.min(yc),
                        w: body_w,
                        h: (yo - yc).abs().max(1.0),
                        color: col,
                    });
                }
            }
            Series::Bars {
                values, color: c, ..
            } => {
                let y0 = sc.y(0.0);
                for (i, &v) in values.iter().enumerate() {
                    if !v.is_finite() {
                        continue;
                    }
                    let y = sc.y(v);
                    let col = c.unwrap_or(if v >= 0.0 { color::GAIN } else { color::LOSS });
                    out.push(Prim::Rect {
                        x: cx(i) - body_w / 2.0,
                        y: y.min(y0),
                        w: body_w,
                        h: (y - y0).abs().max(1.0),
                        color: col,
                    });
                }
            }
            Series::Band {
                bands, color: c, ..
            } => {
                for (i, b) in bands.iter().enumerate() {
                    if let Some((l, hb)) = *b
                        && l.is_finite()
                        && hb.is_finite()
                    {
                        let (y1, y2) = (sc.y(hb), sc.y(l));
                        out.push(Prim::Rect {
                            x: slot * i as f32,
                            y: y1,
                            w: slot.max(1.0),
                            h: (y2 - y1).max(1.0),
                            color: *c,
                        });
                    }
                }
            }
            Series::Line {
                values, color: c, ..
            } => {
                // Runs of adjacent finite values; a missing value (a band, D466) breaks the line.
                let mut run: Vec<(f32, f32)> = Vec::new();
                let flush = |run: &mut Vec<(f32, f32)>, out: &mut Vec<Prim>| {
                    for p in run.windows(2) {
                        out.push(Prim::Segment {
                            x1: p[0].0,
                            y1: p[0].1,
                            x2: p[1].0,
                            y2: p[1].1,
                            width: 1.5,
                            color: *c,
                        });
                    }
                    if run.len() == 1 {
                        out.push(Prim::Rect {
                            x: run[0].0 - 1.5,
                            y: run[0].1 - 1.5,
                            w: 3.0,
                            h: 3.0,
                            color: *c,
                        });
                    }
                    run.clear();
                };
                for (i, &v) in values.iter().enumerate() {
                    if v.is_finite() {
                        run.push((cx(i), sc.y(v)));
                    } else {
                        flush(&mut run, &mut out);
                    }
                }
                flush(&mut run, &mut out);
            }
        }
    }
    (out, Some(sc))
}

/// The slot under plot x `x` in a plot `w` wide with `n` slots.
pub fn slot_at(x: f32, w: f32, n: usize) -> Option<usize> {
    if n == 0 || w <= 0.0 || x < 0.0 || x >= w {
        return None;
    }
    Some(((x / w * n as f32) as usize).min(n - 1))
}

/// The readout line for slot `i`: its label, then each series' value there.
pub fn readout(m: &ChartModel, i: usize) -> String {
    let f = |v: f64| m.format.fmt(v);
    let mut parts = Vec::new();
    if let Some(l) = m.labels.get(i) {
        parts.push(l.clone());
    }
    for s in &m.series {
        match s {
            Series::Candles(c) => {
                if let Some(b) = c.get(i) {
                    parts.push(format!(
                        "O {} H {} L {} C {}",
                        f(b.open),
                        f(b.high),
                        f(b.low),
                        f(b.close)
                    ));
                    if let Some((l, h)) = b.band {
                        parts.push(format!("EFV {}-{}", f(l), f(h)));
                    }
                }
            }
            Series::Line { name, values, .. } | Series::Bars { name, values, .. } => {
                if let Some(&v) = values.get(i).filter(|v| v.is_finite()) {
                    parts.push(format!("{name} {}", f(v)));
                }
            }
            Series::Band { name, bands, .. } => {
                if let Some(&Some((l, h))) = bands.get(i) {
                    parts.push(format!("{name} {}", m.format.band(l, h)));
                }
            }
        }
    }
    parts.join("  ")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `days` daily bars from 2020-01-01, a slow drift with a weekly wave, banded ±15%.
    fn daily(days: i64) -> Vec<Ohlc> {
        let start = Date::ymd(2020, 1, 1);
        (0..days)
            .map(|i| {
                let p = 20.0 + i as f64 * 0.01 + ((i % 7) as f64 - 3.0) * 0.2;
                let efv = 20.0 + i as f64 * 0.01;
                Ohlc {
                    date: start.add_days(i),
                    open: p - 0.1,
                    high: p + 0.3,
                    low: p - 0.4,
                    close: p + 0.05,
                    band: None,
                }
                .with_band(efv * 0.85, efv * 1.15)
            })
            .collect()
    }

    #[test]
    fn weekly_bars_aggregate_their_days() {
        let d = daily(3_653);
        let w = weekly(&d);
        // 2020-01-01 is a Wednesday: a first part-week, then whole weeks.
        assert_eq!(w[0].date, Date::ymd(2020, 1, 1));
        assert_eq!(w[1].date, Date::ymd(2020, 1, 6), "weeks start on Monday");
        assert!((521..=524).contains(&w.len()), "{} weeks", w.len());
        let week: Vec<&Ohlc> = d
            .iter()
            .filter(|b| b.date >= w[1].date && b.date < w[2].date)
            .collect();
        assert_eq!(week.len(), 7);
        assert_eq!(w[1].open, week[0].open);
        assert_eq!(w[1].close, week[6].close);
        let hi = week.iter().map(|b| b.high).fold(f64::MIN, f64::max);
        let lo = week.iter().map(|b| b.low).fold(f64::MAX, f64::min);
        assert_eq!((w[1].high, w[1].low), (hi, lo));
        assert_eq!(w[1].band, week[6].band, "the band at the week's close");
        assert!(weekly(&[]).is_empty());
    }

    #[test]
    fn the_long_view_is_ten_years_of_weeks() {
        let d = daily(12 * 365);
        let last = d.last().unwrap().date;
        let v = ten_year_view(&d);
        let first = v[0].date;
        assert!(first > Date::new(last.year - 10, last.month, last.day).unwrap());
        assert!(first.days_since_epoch() - (last.days_since_epoch() - 3653) < 8);
        assert!((521..=524).contains(&v.len()), "{}", v.len());
        // Shorter histories keep every bar.
        assert_eq!(last_years(&d[..100], 10).len(), 100);
    }

    #[test]
    fn draws_20_quarters_of_bars_inside_the_plot() {
        let m = ChartModel {
            title: "Growth".into(),
            labels: (0..20).map(|q| format!("Q{}", q % 4 + 1)).collect(),
            series: vec![
                Series::Bars {
                    name: "growth".into(),
                    values: (0..20).map(|q| (q as f64 - 8.0) / 100.0).collect(),
                    color: None,
                },
                Series::Line {
                    name: "demand".into(),
                    values: (0..20).map(|q| 0.05 + q as f64 / 400.0).collect(),
                    color: color::CYAN,
                },
            ],
            format: ValueFormat::Percent,
            reference: Some((0.03, color::AMBER)),
        };
        let (w, h) = (400.0, 200.0);
        let (prims, scale) = primitives(&m, w, h);
        let scale = scale.unwrap();
        let bars: Vec<_> = prims
            .iter()
            .filter(|p| matches!(p, Prim::Rect { w: bw, .. } if *bw < w))
            .collect();
        assert_eq!(bars.len(), 20, "one bar a quarter");
        let segs = prims
            .iter()
            .filter(|p| matches!(p, Prim::Segment { .. }))
            .count();
        assert_eq!(segs, 19);
        for p in &prims {
            in_plot(p, w, h);
        }
        // Negative bars are losses, hanging below zero.
        if let Prim::Rect { y, color: c, .. } = bars[0] {
            assert_eq!(*c, color::LOSS);
            assert!(*y >= scale.y(0.0) - 0.01);
        }
        assert_eq!(readout(&m, 18), "Q3  growth 10.0%  demand 9.5%");
    }

    #[test]
    fn draws_ten_years_of_candles_with_the_band() {
        let v = ten_year_view(&daily(3_653));
        let m = ChartModel::candles("ARDR 10Y", v.clone());
        let (w, h) = (900.0, 300.0);
        let (prims, scale) = primitives(&m, w, h);
        let n = v.len();
        assert_eq!(prims.len(), 3 * n, "a band, a wick and a body per week");
        for p in &prims {
            in_plot(p, w, h);
        }
        let sc = scale.unwrap();
        let (lo, hi) = m.range().unwrap();
        assert!(sc.lo < lo && sc.hi > hi);
        // The last body sits over its close and open.
        if let Prim::Rect { y, h: bh, .. } = prims[3 * n - 1] {
            let b = v[n - 1];
            let top = sc.y(b.open.max(b.close));
            assert!((y - top).abs() < 0.01 && bh >= 1.0);
        }
        assert_eq!(slot_at(0.0, w, n), Some(0));
        assert_eq!(slot_at(w - 0.01, w, n), Some(n - 1));
        assert_eq!(slot_at(w, w, n), None);
        let r = readout(&m, 0);
        assert!(r.starts_with("01 Jan 2020  O $"), "{r}");
        assert!(r.contains("EFV $"));
    }

    fn in_plot(p: &Prim, w: f32, h: f32) {
        let e = 1.01;
        match *p {
            Prim::Rect {
                x, y, w: rw, h: rh, ..
            } => {
                assert!(
                    x >= -e && y >= -e && x + rw <= w + e && y + rh <= h + e,
                    "{p:?}"
                );
            }
            Prim::Segment { x1, y1, x2, y2, .. } => {
                for (x, y) in [(x1, y1), (x2, y2)] {
                    assert!(
                        (-e..=w + e).contains(&x) && (-e..=h + e).contains(&y),
                        "{p:?}"
                    );
                }
            }
        }
    }

    #[test]
    fn scales_and_ticks() {
        let s = Scale::new((10.0, 20.0), 100.0);
        assert!(s.y(10.0) > s.y(20.0));
        assert!((s.value(s.y(15.0)) - 15.0).abs() < 1e-6);
        let t = s.ticks(4);
        assert!(t.len() >= 3 && t.iter().all(|v| (s.lo..=s.hi).contains(v)));
        let flat = Scale::new((5.0, 5.0), 100.0);
        assert!(flat.hi > 5.0 && flat.lo < 5.0);
        assert_eq!(primitives(&ChartModel::default(), 100.0, 100.0).0.len(), 0);
    }
}
