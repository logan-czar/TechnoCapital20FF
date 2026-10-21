//! `headless check DIR` (build-plan M10.2, M10.3, 4.4): every spec 10 balance, startup,
//! character and listing target, per seed, from a soak's `years.csv` and `quarters.csv`.
//!
//! Each target reads only the columns named in its `eval`; each bound is a named constant
//! citing its spec 10 line; choices where spec 10 is ambiguous are D320 to D334 (docs/build/
//! decisions.md). A seed is PASS, FAIL or NA (the run does not cover the target's window). A
//! target is MET when the share of evaluated seeds that pass reaches its required share: the
//! share spec 10 names ("in 90% of seeds"), else every seed (D330). docs/build/soak.md has the
//! full definitions.

use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::path::Path;

use crate::metrics::{M_CLAMP_QUARTERS, REVENUE_TREND_BAND};

/// Spec 10 "balance targets after 10 years": the 2020 to 2029 run, whose last year closes on
/// 1 January 2030 (the 2029 row).
pub const TEN_YEAR_FIRST: i32 = 2020;
pub const TEN_YEAR_LAST: i32 = 2029;
/// Spec 10: "at least 85% of the 651 companies neither bankrupt nor removed" (D320).
pub const START_ALIVE_MIN: f64 = 0.85;
/// Spec 10: "median productivity 90 to 110" (D321).
pub const MEDIAN_PRODUCTIVITY: (f64, f64) = (90.0, 110.0);
/// Spec 10: "industry revenue within ±30% of the trend path" (D322).
pub const REVENUE_RATIO: (f64, f64) = (1.0 - REVENUE_TREND_BAND, 1.0 + REVENUE_TREND_BAND);
/// Spec 10: "no industry stuck at an M clamp for more than 8 quarters".
pub const M_CLAMP_MAX_RUN: u32 = M_CLAMP_QUARTERS;
/// Spec 10: "30% to 60% of releases are beats" (D323).
pub const BEAT_SHARE: (f64, f64) = (0.30, 0.60);
/// Spec 10: "each industry's 10-year average demand growth within ±3 pp of its long-term rate in
/// 90% of seeds" (D324; the band is `metrics::DEMAND_GROWTH_BAND_PP`).
pub const DEMAND_GROWTH_SEED_SHARE: f64 = 0.90;
/// Spec 10: "10% to 25% of industry-quarters labeled Boom and 10% to 20% Bust" (D325).
pub const BOOM_SHARE: (f64, f64) = (0.10, 0.25);
pub const BUST_SHARE: (f64, f64) = (0.10, 0.20);
/// Spec 10: "6 to 15 startups a year on average in 2020 to 2029".
pub const STARTUPS_PER_YEAR: (f64, f64) = (6.0, 15.0);
/// Spec 10: "15 to 50 AI labs startups in 2030 to 2035 in 80% of seeds" (D331: both years
/// inclusive).
pub const AI_LABS_YEARS: (i32, i32) = (2030, 2035);
pub const AI_LABS_STARTUPS: (u32, u32) = (15, 50);
pub const AI_LABS_SEED_SHARE: f64 = 0.80;
/// Spec 10 "the 30-year run": the rows 2020 to 2049. The every-year targets need all 30 and are
/// NA on a shorter run (D329).
pub const RUN_YEARS: (i32, i32) = (2020, 2049);
/// Spec 10: "the named company count stays between 600 and 1,100 in every year of the 30-year
/// run".
pub const NAMED_COMPANIES: (u32, u32) = (600, 1100);
/// Spec 10: "60 to 250 listings in 30 years and no more than 12 in any year".
pub const LISTINGS_YEARS: (i32, i32) = RUN_YEARS;
pub const LISTINGS_TOTAL: (u32, u32) = (60, 250);
pub const LISTINGS_PER_YEAR_MAX: u32 = 12;
/// Spec 10: "10 to 30 starting private companies listed by the end of 2024 in 90% of seeds".
pub const START_PRIVATE_LISTED_BY: i32 = 2024;
pub const START_PRIVATE_LISTED: (u32, u32) = (10, 30);
pub const START_PRIVATE_LISTED_SEED_SHARE: f64 = 0.90;
/// Spec 10 world population check: "100 to 300 full characters made per decade" (D332).
pub const DECADES: [(i32, i32); 3] = [(2020, 2029), (2030, 2039), (2040, 2049)];
pub const FULL_PER_DECADE: (u32, u32) = (100, 300);
/// "Under 1,200 full characters in the world in 2050 (296 at start)": at the 1 January 2050
/// close (the 2049 row, D332).
pub const FULL_CHARACTERS_YEAR: i32 = 2049;
pub const FULL_CHARACTERS_BELOW: u32 = 1200;
/// "Every startup has 1 to 5 full and 1 to 5 partial characters" (D326).
pub const CAST_FULL: (u32, u32) = (1, 5);
pub const CAST_PARTIAL: (u32, u32) = (1, 5);
/// A target with no seed share in spec 10 must pass in every seed (D330).
pub const ALL_SEEDS: f64 = 1.0;

/// One `years.csv` row: the columns the targets read.
#[derive(Debug, Clone, Default)]
pub struct YearRow {
    pub year: i32,
    pub start_alive_share: f64,
    pub median_productivity: f64,
    pub demand_dev_max_pp: f64,
    pub demand_dev_out: u32,
    pub startups: u32,
    pub ai_lab_startups: u32,
    pub named: u32,
    pub listings: u32,
    pub start_private_listed: u32,
    pub full_made: u32,
    pub full_characters: u32,
    pub casts: u32,
    pub cast_full: Option<(u32, u32)>,
    pub cast_simple: Option<(u32, u32)>,
    pub born_empty_seats_max: u32,
}

/// One `quarters.csv` row: the columns the targets read.
#[derive(Debug, Clone, Default)]
pub struct QuarterRow {
    pub year: i32,
    pub quarter: u8,
    /// The quarter whose results were released in this quarter (year, quarter).
    pub released: Option<(i32, u8)>,
    pub reports: u32,
    pub beats: u32,
    pub industry_months: u32,
    pub boom_months: u32,
    pub bust_months: u32,
    pub rev_ratio_min: f64,
    pub rev_ratio_max: f64,
    pub rev_out_of_band: u32,
    pub m_clamp_max_run: u32,
}

/// A seed's rows, years and quarters in order.
#[derive(Debug, Clone, Default)]
pub struct SeedData {
    pub years: Vec<YearRow>,
    pub quarters: Vec<QuarterRow>,
}

impl SeedData {
    fn year(&self, y: i32) -> Option<&YearRow> {
        self.years.iter().find(|r| r.year == y)
    }

    /// Every year row from `a` to `b`, or None if one is missing.
    fn years_in(&self, (a, b): (i32, i32)) -> Option<Vec<&YearRow>> {
        (a..=b).map(|y| self.year(y)).collect()
    }

    /// Every quarter row of the years `a` to `b`, or None if one is missing.
    fn quarters_in(&self, (a, b): (i32, i32)) -> Option<Vec<&QuarterRow>> {
        (a..=b)
            .flat_map(|y| (1..=4).map(move |q| (y, q)))
            .map(|(y, q)| self.quarters.iter().find(|r| r.year == y && r.quarter == q))
            .collect()
    }

    /// The quarter rows whose release reports a quarter of the years `a` to `b` (one each), or
    /// None if a reported quarter is missing (D323).
    fn releases_of(&self, (a, b): (i32, i32)) -> Option<Vec<&QuarterRow>> {
        (a..=b)
            .flat_map(|y| (1..=4).map(move |q| (y, q)))
            .map(|yq| self.quarters.iter().find(|r| r.released == Some(yq)))
            .collect()
    }
}

/// A seed's result on one target: whether it passes, the measured value (the number the summary
/// aggregates) and a readable note.
#[derive(Debug, Clone, PartialEq)]
pub struct Verdict {
    pub pass: bool,
    pub value: f64,
    pub measured: String,
}

fn verdict(pass: bool, value: f64, measured: String) -> Option<Verdict> {
    Some(Verdict {
        pass,
        value,
        measured,
    })
}

fn within(v: f64, (lo, hi): (f64, f64)) -> bool {
    (lo..=hi).contains(&v)
}

fn within_u(v: u32, (lo, hi): (u32, u32)) -> bool {
    (lo..=hi).contains(&v)
}

/// One spec 10 target.
pub struct Target {
    pub id: &'static str,
    /// The spec 10 wording it checks.
    pub spec: &'static str,
    pub bound: &'static str,
    /// The share of evaluated seeds that must pass (D330).
    pub required: f64,
    /// None when the run does not cover the target's window.
    pub eval: fn(&SeedData) -> Option<Verdict>,
}

/// Every target, in spec 10 order (balance targets after 10 years, then the startup, character
/// and listing targets).
pub const TARGETS: &[Target] = &[
    Target {
        id: "start_alive_10y",
        spec: "85%+ of the 651 neither bankrupt nor removed after 10 years",
        bound: ">= 0.85 at the 2029 close",
        required: ALL_SEEDS,
        eval: |s| {
            let r = s.year(TEN_YEAR_LAST)?;
            let v = r.start_alive_share;
            verdict(v >= START_ALIVE_MIN, v, format!("{v:.4}"))
        },
    },
    Target {
        id: "median_productivity_10y",
        spec: "median productivity 90 to 110 after 10 years",
        bound: "90 to 110 at the 2029 close",
        required: ALL_SEEDS,
        eval: |s| {
            let v = s.year(TEN_YEAR_LAST)?.median_productivity;
            verdict(within(v, MEDIAN_PRODUCTIVITY), v, format!("{v:.2}"))
        },
    },
    Target {
        id: "industry_revenue_trend",
        spec: "industry revenue within ±30% of the trend path",
        bound: "every industry-quarter 2020-2029 in 0.70 to 1.30 of trend",
        required: ALL_SEEDS,
        eval: |s| {
            let qs = s.quarters_in((TEN_YEAR_FIRST, TEN_YEAR_LAST))?;
            let lo = qs
                .iter()
                .map(|q| q.rev_ratio_min)
                .fold(f64::INFINITY, f64::min);
            let hi = qs
                .iter()
                .map(|q| q.rev_ratio_max)
                .fold(f64::NEG_INFINITY, f64::max);
            let out: u32 = qs.iter().map(|q| q.rev_out_of_band).sum();
            let worst = (lo - 1.0).abs().max((hi - 1.0).abs());
            verdict(
                out == 0 && within(lo, REVENUE_RATIO) && within(hi, REVENUE_RATIO),
                worst,
                format!("ratio {lo:.3} to {hi:.3}; {out} industry-quarters out"),
            )
        },
    },
    Target {
        id: "m_clamp_8q",
        spec: "no industry stuck at an M clamp for more than 8 quarters",
        bound: "longest run 2020-2029 <= 8 quarters",
        required: ALL_SEEDS,
        eval: |s| {
            let qs = s.quarters_in((TEN_YEAR_FIRST, TEN_YEAR_LAST))?;
            let run = qs.iter().map(|q| q.m_clamp_max_run).max().unwrap_or(0);
            verdict(
                run <= M_CLAMP_MAX_RUN,
                f64::from(run),
                format!("{run} quarters"),
            )
        },
    },
    Target {
        id: "beat_share",
        spec: "30% to 60% of releases are beats",
        bound: "0.30 to 0.60 of reports for Q1 2020 to Q4 2029",
        required: ALL_SEEDS,
        eval: |s| {
            let qs = s.releases_of((TEN_YEAR_FIRST, TEN_YEAR_LAST))?;
            let reports: u32 = qs.iter().map(|q| q.reports).sum();
            let beats: u32 = qs.iter().map(|q| q.beats).sum();
            let v = f64::from(beats) / f64::from(reports.max(1));
            verdict(
                within(v, BEAT_SHARE),
                v,
                format!("{v:.4} ({beats} of {reports})"),
            )
        },
    },
    Target {
        id: "demand_growth_lt",
        spec: "each industry's 10-year average demand growth within ±3 pp of its long-term rate in 90% of seeds",
        bound: "every industry within 3 pp at the 2029 close",
        required: DEMAND_GROWTH_SEED_SHARE,
        eval: |s| {
            let r = s.year(TEN_YEAR_LAST)?;
            let v = r.demand_dev_max_pp;
            verdict(
                r.demand_dev_out == 0,
                v,
                format!("worst {v:.2} pp; {} industries out", r.demand_dev_out),
            )
        },
    },
    Target {
        id: "boom_share",
        spec: "10% to 25% of industry-quarters labeled Boom (2020-2029)",
        bound: "0.10 to 0.25 of industry-months in force 2020-2029",
        required: ALL_SEEDS,
        eval: |s| {
            let qs = s.quarters_in((TEN_YEAR_FIRST, TEN_YEAR_LAST))?;
            let n: u32 = qs.iter().map(|q| q.industry_months).sum();
            let k: u32 = qs.iter().map(|q| q.boom_months).sum();
            let v = f64::from(k) / f64::from(n.max(1));
            verdict(within(v, BOOM_SHARE), v, format!("{v:.4}"))
        },
    },
    Target {
        id: "bust_share",
        spec: "10% to 20% of industry-quarters labeled Bust (2020-2029)",
        bound: "0.10 to 0.20 of industry-months in force 2020-2029",
        required: ALL_SEEDS,
        eval: |s| {
            let qs = s.quarters_in((TEN_YEAR_FIRST, TEN_YEAR_LAST))?;
            let n: u32 = qs.iter().map(|q| q.industry_months).sum();
            let k: u32 = qs.iter().map(|q| q.bust_months).sum();
            let v = f64::from(k) / f64::from(n.max(1));
            verdict(within(v, BUST_SHARE), v, format!("{v:.4}"))
        },
    },
    Target {
        id: "startups_per_year",
        spec: "6 to 15 startups a year on average in 2020 to 2029",
        bound: "mean 6 to 15 over 2020-2029",
        required: ALL_SEEDS,
        eval: |s| {
            let ys = s.years_in((TEN_YEAR_FIRST, TEN_YEAR_LAST))?;
            let total: u32 = ys.iter().map(|y| y.startups).sum();
            let v = f64::from(total) / ys.len() as f64;
            verdict(within(v, STARTUPS_PER_YEAR), v, format!("{v:.1} a year"))
        },
    },
    Target {
        id: "ai_lab_startups_2030_2035",
        spec: "15 to 50 AI labs startups in 2030 to 2035 in 80% of seeds",
        bound: "15 to 50 born 2030-2035",
        required: AI_LABS_SEED_SHARE,
        eval: |s| {
            let ys = s.years_in(AI_LABS_YEARS)?;
            let v: u32 = ys.iter().map(|y| y.ai_lab_startups).sum();
            verdict(within_u(v, AI_LABS_STARTUPS), f64::from(v), format!("{v}"))
        },
    },
    Target {
        id: "named_companies",
        spec: "named company count between 600 and 1100 in every year",
        bound: "600 to 1100 at every year close 2020-2049",
        required: ALL_SEEDS,
        eval: |s| {
            let ys = s.years_in(RUN_YEARS)?;
            let lo = ys.iter().map(|y| y.named).min()?;
            let hi = ys.iter().map(|y| y.named).max()?;
            let ok = ys.iter().all(|y| within_u(y.named, NAMED_COMPANIES));
            verdict(ok, f64::from(hi), format!("{lo} to {hi}"))
        },
    },
    Target {
        id: "listings_30y",
        spec: "60 to 250 listings in 30 years",
        bound: "60 to 250 listed 2020-2049",
        required: ALL_SEEDS,
        eval: |s| {
            let ys = s.years_in(LISTINGS_YEARS)?;
            let v: u32 = ys.iter().map(|y| y.listings).sum();
            verdict(within_u(v, LISTINGS_TOTAL), f64::from(v), format!("{v}"))
        },
    },
    Target {
        id: "listings_per_year",
        spec: "no more than 12 listings in any year",
        bound: "<= 12 in every year 2020-2049",
        required: ALL_SEEDS,
        eval: |s| {
            let v = s.years_in(RUN_YEARS)?.iter().map(|y| y.listings).max()?;
            verdict(v <= LISTINGS_PER_YEAR_MAX, f64::from(v), format!("max {v}"))
        },
    },
    Target {
        id: "start_private_listed_2024",
        spec: "10 to 30 starting private companies listed by the end of 2024 in 90% of seeds",
        bound: "10 to 30 at the 2024 close",
        required: START_PRIVATE_LISTED_SEED_SHARE,
        eval: |s| {
            let v = s.year(START_PRIVATE_LISTED_BY)?.start_private_listed;
            verdict(
                within_u(v, START_PRIVATE_LISTED),
                f64::from(v),
                format!("{v}"),
            )
        },
    },
    Target {
        id: "full_characters_per_decade",
        spec: "100 to 300 full characters made per decade",
        bound: "100 to 300 made in each of the 2020s 2030s and 2040s the run covers",
        required: ALL_SEEDS,
        eval: |s| {
            let made: Vec<(i32, u32)> = DECADES
                .iter()
                .filter_map(|&(a, b)| {
                    let before = if a == TEN_YEAR_FIRST {
                        0
                    } else {
                        s.year(a - 1)?.full_made
                    };
                    Some((a, s.year(b)?.full_made.checked_sub(before)?))
                })
                .collect();
            if made.is_empty() {
                return None;
            }
            let ok = made.iter().all(|&(_, n)| within_u(n, FULL_PER_DECADE));
            let worst = made
                .iter()
                .map(|&(_, n)| n)
                .min_by_key(|&n| {
                    let mid = (FULL_PER_DECADE.0 + FULL_PER_DECADE.1) / 2;
                    std::cmp::Reverse(n.abs_diff(mid))
                })
                .unwrap_or(0);
            let text: Vec<String> = made.iter().map(|(a, n)| format!("{a}s {n}")).collect();
            verdict(ok, f64::from(worst), text.join("; "))
        },
    },
    Target {
        id: "full_characters_2050",
        spec: "under 1200 full characters in the world in 2050",
        bound: "< 1200 at the 1 January 2050 close",
        required: ALL_SEEDS,
        eval: |s| {
            let v = s.year(FULL_CHARACTERS_YEAR)?.full_characters;
            verdict(v < FULL_CHARACTERS_BELOW, f64::from(v), format!("{v}"))
        },
    },
    Target {
        id: "cast_sizes",
        spec: "every startup has 1 to 5 full and 1 to 5 partial characters",
        bound: "founders 1 to 5 and simple cast 1 to 5 at every birth",
        required: ALL_SEEDS,
        eval: |s| {
            let casts: u32 = s.years.iter().map(|y| y.casts).sum();
            if casts == 0 {
                return None;
            }
            let span = |f: fn(&YearRow) -> Option<(u32, u32)>| {
                let r: Vec<(u32, u32)> = s.years.iter().filter_map(f).collect();
                (
                    r.iter().map(|x| x.0).min().unwrap_or(0),
                    r.iter().map(|x| x.1).max().unwrap_or(0),
                )
            };
            let full = span(|y| y.cast_full);
            let simple = span(|y| y.cast_simple);
            let ok = within_u(full.0, CAST_FULL)
                && within_u(full.1, CAST_FULL)
                && within_u(simple.0, CAST_PARTIAL)
                && within_u(simple.1, CAST_PARTIAL);
            verdict(
                ok,
                f64::from(casts),
                format!(
                    "{casts} casts; full {} to {}; simple {} to {}",
                    full.0, full.1, simple.0, simple.1
                ),
            )
        },
    },
    Target {
        id: "no_empty_labor_seat",
        spec: "no labor seat of a born company is empty",
        bound: "0 empty open seats at every birth and month close 2020-2049",
        required: ALL_SEEDS,
        eval: |s| {
            let v = s
                .years_in(RUN_YEARS)?
                .iter()
                .map(|y| y.born_empty_seats_max)
                .max()?;
            verdict(v == 0, f64::from(v), format!("max {v} empty"))
        },
    },
];

/// A CSV table: its header and rows (no field holds a comma).
struct Table {
    name: String,
    cols: Vec<String>,
    rows: Vec<Vec<String>>,
}

impl Table {
    fn parse(name: &str, text: &str) -> Result<Table, String> {
        let mut lines = text.lines().filter(|l| !l.is_empty());
        let header = lines.next().ok_or(format!("{name}: empty"))?;
        let cols: Vec<String> = header.split(',').map(str::to_string).collect();
        let rows: Vec<Vec<String>> = lines
            .map(|l| l.split(',').map(str::to_string).collect())
            .collect();
        for (i, r) in rows.iter().enumerate() {
            if r.len() != cols.len() {
                return Err(format!(
                    "{name}:{}: {} fields, header has {}",
                    i + 2,
                    r.len(),
                    cols.len()
                ));
            }
        }
        Ok(Table {
            name: name.to_string(),
            cols,
            rows,
        })
    }

    fn col(&self, c: &str) -> Result<usize, String> {
        self.cols
            .iter()
            .position(|x| x == c)
            .ok_or(format!("{}: no column `{c}`", self.name))
    }
}

/// Reads typed fields of one row by column name.
struct Fields<'a> {
    table: &'a Table,
    row: usize,
}

impl Fields<'_> {
    fn raw(&self, c: &str) -> Result<&str, String> {
        Ok(&self.table.rows[self.row][self.table.col(c)?])
    }

    fn get<T: std::str::FromStr>(&self, c: &str) -> Result<T, String> {
        let s = self.raw(c)?;
        s.parse().map_err(|_| {
            format!(
                "{}:{}: column `{c}`: cannot read `{s}`",
                self.table.name,
                self.row + 2
            )
        })
    }

    fn opt<T: std::str::FromStr>(&self, c: &str) -> Result<Option<T>, String> {
        if self.raw(c)?.is_empty() {
            Ok(None)
        } else {
            self.get(c).map(Some)
        }
    }

    fn pair(&self, lo: &str, hi: &str) -> Result<Option<(u32, u32)>, String> {
        Ok(self.opt(lo)?.zip(self.opt(hi)?))
    }
}

/// `2019Q4` to (2019, 4).
fn parse_quarter(s: &str) -> Option<(i32, u8)> {
    let (y, q) = s.split_once('Q')?;
    Some((y.parse().ok()?, q.parse().ok()?))
}

/// Every seed's rows from the two tables' text, by seed (BTreeMap: seed order).
pub fn parse(years: &str, quarters: &str) -> Result<BTreeMap<u64, SeedData>, String> {
    let mut out: BTreeMap<u64, SeedData> = BTreeMap::new();
    let y = Table::parse("years.csv", years)?;
    for row in 0..y.rows.len() {
        let f = Fields { table: &y, row };
        let r = YearRow {
            year: f.get("year")?,
            start_alive_share: f.get("start_alive_share")?,
            median_productivity: f.get("median_productivity")?,
            demand_dev_max_pp: f.get("demand_dev_max_pp")?,
            demand_dev_out: f.get("demand_dev_out")?,
            startups: f.get("startups_in_year")?,
            ai_lab_startups: f.get("ai_lab_startups_in_year")?,
            named: f.get("named_companies")?,
            listings: f.get("listings_in_year")?,
            start_private_listed: f.get("start_private_listed")?,
            full_made: f.get("full_characters_made")?,
            full_characters: f.get("full_characters")?,
            casts: f.get("casts_in_year")?,
            cast_full: f.pair("cast_full_min", "cast_full_max")?,
            cast_simple: f.pair("cast_simple_min", "cast_simple_max")?,
            born_empty_seats_max: f.get("born_empty_seats_max")?,
        };
        out.entry(f.get("seed")?).or_default().years.push(r);
    }
    let q = Table::parse("quarters.csv", quarters)?;
    for row in 0..q.rows.len() {
        let f = Fields { table: &q, row };
        let released = f.raw("released")?;
        let r = QuarterRow {
            year: f.get("year")?,
            quarter: f.get("quarter")?,
            released: if released.is_empty() {
                None
            } else {
                Some(parse_quarter(released).ok_or(format!(
                    "quarters.csv:{}: column `released`: cannot read `{released}`",
                    row + 2
                ))?)
            },
            reports: f.get("reports")?,
            beats: f.get("beats")?,
            industry_months: f.get("industry_months")?,
            boom_months: f.get("boom_months")?,
            bust_months: f.get("bust_months")?,
            rev_ratio_min: f.get("rev_ratio_min")?,
            rev_ratio_max: f.get("rev_ratio_max")?,
            rev_out_of_band: f.get("rev_out_of_band")?,
            m_clamp_max_run: f.get("m_clamp_max_run")?,
        };
        out.entry(f.get("seed")?).or_default().quarters.push(r);
    }
    for s in out.values_mut() {
        s.years.sort_by_key(|r| r.year);
        s.quarters.sort_by_key(|r| (r.year, r.quarter));
    }
    Ok(out)
}

/// One target's results across the seeds.
#[derive(Debug, Clone, PartialEq)]
pub struct Summary {
    pub id: &'static str,
    pub spec: &'static str,
    pub evaluated: usize,
    pub passed: usize,
    pub required: f64,
    /// min, median and max of the measured values over the evaluated seeds.
    pub values: Option<(f64, f64, f64)>,
}

impl Summary {
    pub fn share(&self) -> Option<f64> {
        (self.evaluated > 0).then(|| self.passed as f64 / self.evaluated as f64)
    }

    /// "MET", "NOT MET" or "n/a" (no seed covers the window).
    pub fn verdict(&self) -> &'static str {
        match self.share() {
            None => "n/a",
            // A tiny slack so 9 of 10 seeds meets 90% despite float division.
            Some(s) if s + 1e-9 >= self.required => "MET",
            Some(_) => "NOT MET",
        }
    }
}

/// `targets.csv` (one row per target per seed, targets in [`TARGETS`] order, seeds ascending)
/// and the summaries.
pub fn evaluate(seeds: &BTreeMap<u64, SeedData>) -> (String, Vec<Summary>) {
    let mut csv = String::from("target,seed,result,measured,bound\n");
    let mut summaries = Vec::new();
    for t in TARGETS {
        let (mut evaluated, mut passed, mut values) = (0, 0, Vec::new());
        for (seed, data) in seeds {
            let (result, measured) = match (t.eval)(data) {
                Some(v) => {
                    evaluated += 1;
                    passed += usize::from(v.pass);
                    values.push(v.value);
                    (if v.pass { "PASS" } else { "FAIL" }, v.measured)
                }
                None => ("NA", String::new()),
            };
            writeln!(csv, "{},{seed},{result},{measured},{}", t.id, t.bound).unwrap();
        }
        values.sort_by(f64::total_cmp);
        summaries.push(Summary {
            id: t.id,
            spec: t.spec,
            evaluated,
            passed,
            required: t.required,
            values: (!values.is_empty()).then(|| {
                (
                    values[0],
                    values[values.len() / 2],
                    values[values.len() - 1],
                )
            }),
        });
    }
    (csv, summaries)
}

/// The summary as CSV (`summary.csv`) and as a printed table.
pub fn summary_csv(summaries: &[Summary]) -> String {
    let mut out = String::from(
        "target,evaluated,passed,pass_share,required_share,verdict,value_min,value_median,\
         value_max\n",
    );
    for s in summaries {
        let (lo, mid, hi) = s.values.map_or(
            (String::new(), String::new(), String::new()),
            |(a, b, c)| (format!("{a:.4}"), format!("{b:.4}"), format!("{c:.4}")),
        );
        writeln!(
            out,
            "{},{},{},{},{:.2},{},{lo},{mid},{hi},{}",
            s.id,
            s.evaluated,
            s.passed,
            s.share().map_or(String::new(), |x| format!("{x:.2}")),
            s.required,
            s.verdict(),
            s.spec,
        )
        .unwrap();
    }
    out
}

fn print_summary(summaries: &[Summary], seeds: usize) {
    println!("{seeds} seeds");
    println!(
        "{:28} {:>6} {:>6} {:>8} {:>8}  {:>10} {:>10} {:>10}",
        "target", "passed", "of", "share", "needed", "min", "median", "max"
    );
    for s in summaries {
        let (lo, mid, hi) = s.values.unwrap_or((f64::NAN, f64::NAN, f64::NAN));
        println!(
            "{:28} {:>6} {:>6} {:>8} {:>8.2}  {lo:>10.4} {mid:>10.4} {hi:>10.4}  {}",
            s.id,
            s.passed,
            s.evaluated,
            s.share().map_or("-".to_string(), |x| format!("{x:.2}")),
            s.required,
            s.verdict()
        );
    }
}

/// `check DIR`: reads the two tables, writes `targets.csv` and `summary.csv`, prints the summary.
pub fn check_dir(dir: &Path) -> Result<(), String> {
    let read = |name: &str| {
        let p = dir.join(name);
        std::fs::read_to_string(&p).map_err(|e| format!("{}: {e}", p.display()))
    };
    let seeds = parse(&read("years.csv")?, &read("quarters.csv")?)?;
    let (csv, summaries) = evaluate(&seeds);
    for (name, text) in [
        ("targets.csv", csv),
        ("summary.csv", summary_csv(&summaries)),
    ] {
        let p = dir.join(name);
        std::fs::write(&p, text).map_err(|e| format!("{}: {e}", p.display()))?;
    }
    print_summary(&summaries, seeds.len());
    println!("wrote {}", dir.join("targets.csv").display());
    Ok(())
}

#[cfg(test)]
mod tests {
    //! Hand-made rows: a seed inside every bound passes every target, and pushing one column
    //! past a bound fails exactly that target.

    use super::*;

    /// The columns the checker reads, in a smaller hand-made table.
    const Y_HEADER: &str = "seed,year,start_alive_share,median_productivity,demand_dev_max_pp,\
        demand_dev_out,startups_in_year,ai_lab_startups_in_year,named_companies,\
        listings_in_year,start_private_listed,full_characters_made,full_characters,\
        casts_in_year,cast_full_min,cast_full_max,cast_simple_min,cast_simple_max,\
        born_empty_seats_max";
    const Q_HEADER: &str = "seed,year,quarter,released,reports,beats,industry_months,\
        boom_months,bust_months,rev_ratio_min,rev_ratio_max,rev_out_of_band,m_clamp_max_run";

    /// A good 30-year seed: 10 startups a year (4 AI labs in 2030 to 2035, 24 in all), 700
    /// named companies, 4 listings a year (120), 3 starting private companies listed a year to
    /// 2024 (15), 20 full characters made a year (200 a decade, 896 in 2050), casts of 1 to 4.
    fn good() -> (Vec<Vec<String>>, Vec<Vec<String>>) {
        let years = (2020..2050)
            .map(|y| {
                let n = (y - 2019) as u32;
                let ai = if (2030..=2035).contains(&y) { 4 } else { 0 };
                [
                    "1".to_string(),
                    y.to_string(),
                    "0.94".into(),
                    "98.5".into(),
                    "1.2".into(),
                    "0".into(),
                    "10".into(),
                    ai.to_string(),
                    "700".into(),
                    "4".into(),
                    (3 * n.min(5)).to_string(),
                    (20 * n).to_string(),
                    (296 + 20 * n).to_string(),
                    "10".into(),
                    "1".into(),
                    "4".into(),
                    "2".into(),
                    "5".into(),
                    "0".into(),
                ]
                .to_vec()
            })
            .collect();
        let quarters = (2020..2050)
            .flat_map(|y| (1..=4).map(move |q| (y, q)))
            .map(|(y, q)| {
                let released = if q == 1 {
                    format!("{}Q4", y - 1)
                } else {
                    format!("{y}Q{}", q - 1)
                };
                [
                    "1".to_string(),
                    y.to_string(),
                    q.to_string(),
                    released,
                    "600".into(),
                    "240".into(),
                    "126".into(),
                    "20".into(),
                    "18".into(),
                    "0.8".into(),
                    "1.2".into(),
                    "0".into(),
                    "3".into(),
                ]
                .to_vec()
            })
            .collect();
        (years, quarters)
    }

    fn text(header: &str, rows: &[Vec<String>]) -> String {
        let mut s = format!("{header}\n");
        for r in rows {
            s.push_str(&r.join(","));
            s.push('\n');
        }
        s
    }

    /// Each target's verdict for one seed, by id.
    fn results(years: &[Vec<String>], quarters: &[Vec<String>]) -> Vec<(&'static str, String)> {
        let seeds = parse(&text(Y_HEADER, years), &text(Q_HEADER, quarters)).unwrap();
        let (csv, _) = evaluate(&seeds);
        let ids: Vec<&'static str> = TARGETS.iter().map(|t| t.id).collect();
        csv.lines()
            .skip(1)
            .map(|l| {
                let f: Vec<&str> = l.split(',').collect();
                let id = ids.iter().find(|&&i| i == f[0]).copied().unwrap();
                (id, f[2].to_string())
            })
            .collect()
    }

    fn col(header: &str, c: &str) -> usize {
        header.split(',').position(|x| x == c).unwrap()
    }

    #[test]
    fn good_seed_passes_every_target() {
        let (y, q) = good();
        for (id, r) in results(&y, &q) {
            assert_eq!(r, "PASS", "{id}");
        }
    }

    /// Sets column `c` of the year rows `years` (or quarter rows of those years) to `v`, and
    /// checks that only `target` fails.
    fn fails_only(target: &str, table: char, c: &str, years: &[i32], v: &str) {
        let (mut y, mut q) = good();
        let (rows, header) = match table {
            'y' => (&mut y, Y_HEADER),
            _ => (&mut q, Q_HEADER),
        };
        let (i, yc) = (col(header, c), col(header, "year"));
        let mut hit = false;
        for r in rows.iter_mut() {
            if years.contains(&r[yc].parse::<i32>().unwrap()) {
                r[i] = v.to_string();
                hit = true;
            }
        }
        assert!(hit);
        for (id, r) in results(&y, &q) {
            let want = if id == target { "FAIL" } else { "PASS" };
            assert_eq!(r, want, "{id} with {c} = {v} in {years:?}");
        }
    }

    #[test]
    fn each_target_fails_past_its_bound() {
        fails_only("start_alive_10y", 'y', "start_alive_share", &[2029], "0.84");
        fails_only(
            "median_productivity_10y",
            'y',
            "median_productivity",
            &[2029],
            "87.3",
        );
        fails_only(
            "median_productivity_10y",
            'y',
            "median_productivity",
            &[2029],
            "110.5",
        );
        fails_only(
            "industry_revenue_trend",
            'q',
            "rev_ratio_max",
            &[2027],
            "1.31",
        );
        fails_only(
            "industry_revenue_trend",
            'q',
            "rev_ratio_min",
            &[2021],
            "0.69",
        );
        fails_only("m_clamp_8q", 'q', "m_clamp_max_run", &[2028], "9");
        // 240 of 600 is 40%; 170 is 28%, 370 is 62%.
        fails_only(
            "beat_share",
            'q',
            "beats",
            &(2020..2031).collect::<Vec<_>>(),
            "170",
        );
        fails_only(
            "beat_share",
            'q',
            "beats",
            &(2020..2031).collect::<Vec<_>>(),
            "370",
        );
        fails_only("demand_growth_lt", 'y', "demand_dev_out", &[2029], "1");
        // 20 of 126 is 15.9%; 12 is 9.5%, 32 is 25.4%.
        let decade: Vec<i32> = (2020..2030).collect();
        fails_only("boom_share", 'q', "boom_months", &decade, "12");
        fails_only("boom_share", 'q', "boom_months", &decade, "32");
        fails_only("bust_share", 'q', "bust_months", &decade, "12");
        fails_only("bust_share", 'q', "bust_months", &decade, "26");
        fails_only("startups_per_year", 'y', "startups_in_year", &decade, "5");
        fails_only("startups_per_year", 'y', "startups_in_year", &decade, "16");
        let ai: Vec<i32> = (2030..2036).collect();
        fails_only(
            "ai_lab_startups_2030_2035",
            'y',
            "ai_lab_startups_in_year",
            &ai,
            "2",
        );
        fails_only(
            "ai_lab_startups_2030_2035",
            'y',
            "ai_lab_startups_in_year",
            &ai,
            "9",
        );
        fails_only("named_companies", 'y', "named_companies", &[2044], "599");
        fails_only("named_companies", 'y', "named_companies", &[2020], "1101");
        let all: Vec<i32> = (2020..2050).collect();
        fails_only("listings_30y", 'y', "listings_in_year", &all, "1");
        fails_only("listings_30y", 'y', "listings_in_year", &all, "9");
        fails_only("listings_per_year", 'y', "listings_in_year", &[2031], "13");
        fails_only(
            "start_private_listed_2024",
            'y',
            "start_private_listed",
            &[2024],
            "9",
        );
        fails_only(
            "start_private_listed_2024",
            'y',
            "start_private_listed",
            &[2024],
            "31",
        );
        // 20 a year, 200 a decade: a 2049 total of 490 leaves 90 made in the 2040s, 710 one of
        // 310; the 2020s and 2030s still pass.
        fails_only(
            "full_characters_per_decade",
            'y',
            "full_characters_made",
            &[2049],
            "490",
        );
        fails_only(
            "full_characters_per_decade",
            'y',
            "full_characters_made",
            &[2049],
            "710",
        );
        fails_only(
            "full_characters_2050",
            'y',
            "full_characters",
            &[2049],
            "1200",
        );
        fails_only("cast_sizes", 'y', "cast_full_max", &[2033], "6");
        fails_only("cast_sizes", 'y', "cast_simple_min", &[2021], "0");
        fails_only(
            "no_empty_labor_seat",
            'y',
            "born_empty_seats_max",
            &[2040],
            "1",
        );
    }

    #[test]
    fn short_runs_are_na_and_shares_follow_the_required_share() {
        // A 1-year run: only the per-birth cast check is evaluated; the every-year targets need
        // the 30 rows of the run.
        let (mut y, mut q) = good();
        y.truncate(1);
        q.truncate(4);
        let r = results(&y, &q);
        let evaluated: Vec<&str> = r
            .iter()
            .filter(|(_, v)| v != "NA")
            .map(|(id, _)| *id)
            .collect();
        assert_eq!(evaluated, ["cast_sizes"]);
        // 29 of the 30 rows: still NA.
        let (mut y, q) = good();
        y.pop();
        let na: Vec<&str> = results(&y, &q)
            .into_iter()
            .filter(|(_, v)| v == "NA")
            .map(|(id, _)| id)
            .collect();
        for id in [
            "named_companies",
            "listings_per_year",
            "no_empty_labor_seat",
        ] {
            assert!(na.contains(&id), "{id}");
        }
        // 9 of 10 seeds meets 90%; 8 of 10 does not; every-seed targets need all.
        let s = |passed, required| Summary {
            id: "x",
            spec: "x",
            evaluated: 10,
            passed,
            required,
            values: None,
        };
        assert_eq!(s(9, DEMAND_GROWTH_SEED_SHARE).verdict(), "MET");
        assert_eq!(s(8, DEMAND_GROWTH_SEED_SHARE).verdict(), "NOT MET");
        assert_eq!(s(8, AI_LABS_SEED_SHARE).verdict(), "MET");
        assert_eq!(s(9, ALL_SEEDS).verdict(), "NOT MET");
        assert_eq!(s(10, ALL_SEEDS).verdict(), "MET");
    }

    #[test]
    fn target_texts_hold_no_comma_and_ids_are_unique() {
        for t in TARGETS {
            assert!(!t.spec.contains(',') && !t.bound.contains(','), "{}", t.id);
            assert_eq!(
                TARGETS.iter().filter(|u| u.id == t.id).count(),
                1,
                "{}",
                t.id
            );
        }
    }

    #[test]
    fn bad_tables_name_the_file_line_and_column() {
        let (y, q) = good();
        let mut bad = y.clone();
        bad[3][col(Y_HEADER, "named_companies")] = "lots".into();
        let e = parse(&text(Y_HEADER, &bad), &text(Q_HEADER, &q)).unwrap_err();
        assert!(e.contains("years.csv:5: column `named_companies`"), "{e}");
        let e = parse("seed,year\n1,2020\n", &text(Q_HEADER, &q)).unwrap_err();
        assert!(e.contains("no column `start_alive_share`"), "{e}");
    }
}
