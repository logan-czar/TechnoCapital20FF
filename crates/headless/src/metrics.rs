//! One seed's metrics rows for `run` and `soak` (build-plan M1.8, M10.1, 4.4): a row per year
//! (`years.csv`) and a row per quarter (`quarters.csv`), read through the public `Sim` API and
//! `SimViews` only (spec 9). docs/build/soak.md defines every column.
//!
//! Everything written here is deterministic for a seed: views are read in id order and nothing
//! iterates a hash map. Wall time is kept out of both tables ([`SeedOutput::wall_ms`]).

use std::fmt::Write as _;
use std::time::Instant;

use sim::economy::supply::{M_MAX, M_MIN};
use sim::economy::{MONTHS_PER_QUARTER, MONTHS_PER_YEAR};
use sim::finance::distress::CompanyStatus;
use sim::finance::rating::Band;
use sim::time::calendar::EPOCH_YEAR;
use sim::time::{Date, DateTime, Quarter};
use sim::world::{Ordinal, Origin, PhaseLabel};
use sim::{Notice, Sim};
use sim_data::WorldData;

use crate::profile::Profiler;

/// `years.csv` header: one row per seed per year, written at the year's December close (the
/// 1 January 00:00 tick that closes it). Rows of a seed are in year order.
///
/// - M1 to M5 (built with those milestones): ticks in the year, the state hash at the close, the
///   cycle phase and g_t, the year's named and fringe revenue, S and M across the 42 industries,
///   mean productivity and management, data held, the profitable share, the M4 books counts and
///   rating bands, and the M5 market figures (quoted count, median gap, tracking share, mean
///   confidence, four headline index levels).
/// - M6 (D166) and M10 (D320 to D334): the startup, listing, character and balance columns the
///   spec 10 targets read; see docs/build/soak.md for each.
pub const YEARS_HEADER: &str = "seed,year,ticks,state_hash,phase,g_t,named_revenue_usd,\
    fringe_revenue_usd,mean_s,min_s,max_s,mean_m,mean_productivity,mean_management,data_tb,\
    profitable_share,distressed_in_year,distressed,bankrupt,removed,bankruptcies_in_year,\
    removals_in_year,active_share,line_drawn_usd,ratings,quoted,median_gap,tracking_share,\
    mean_confidence,index_atx,index_cbx,index_hse,index_ese,events_in_year,startups_in_year,\
    ai_lab_startups_in_year,listings_in_year,start_private_listed,named_companies,\
    start_active_share,start_alive_share,beat_share,miss_share,boom_share,bust_share,\
    m_clamp_over_8q,max_m_clamp_quarters,full_characters_made,full_characters,\
    median_productivity,demand_dev_max_pp,demand_dev_out,casts_in_year,cast_full_min,\
    cast_full_max,cast_simple_min,cast_simple_max,born_empty_seats_max";

/// `quarters.csv` header: one row per seed per calendar quarter, written at the close of the
/// quarter's last month (the 1st of the next quarter, 00:00). Rows of a seed are in quarter order.
pub const QUARTERS_HEADER: &str = "seed,year,quarter,released,reports,beats,misses,industries,\
    industry_months,boom_months,bust_months,rev_ratio_min,rev_ratio_max,rev_out_of_band,\
    m_clamp_industries,m_clamp_max_run,m_clamp_over_8q,rev_demand_min,rev_demand_max,\
    rev_demand_out_of_band,demand_trend_min,demand_trend_max,demand_trend_out_of_band,\
    m_clamp_max_run_counted,m_clamp_max_run_waived,rev_demand_min_counted,\
    rev_demand_max_counted,rev_demand_out_counted,rev_demand_min_waived,rev_demand_max_waived,\
    rev_demand_out_waived";

/// Spec 10: no industry "stuck at an M clamp (spec 5.2, `M_MIN` and `M_MAX`) for more than 8
/// quarters".
pub const M_CLAMP_QUARTERS: u32 = 8;
/// How close to a clamp edge counts as at it (M is clamped exactly; float slack only).
const M_CLAMP_EPSILON: f64 = 1e-12;

/// Spec 10: "industry revenue within ±30% of the trend path" (D322): a quarter's revenue over
/// its trend revenue outside `1 ± 0.30` is out of band. Kept as columns; the targets read D363's
/// two bands below instead.
pub const REVENUE_TREND_BAND: f64 = 0.30;

/// Spec 10 as restated by Logan (M10.7 sign-off, D363 (a), design fix 363): "industry revenue
/// within ±30% of the industry's own demand path": a quarter's revenue over a twelfth of its
/// effective demand at the same closes outside `1 ± 0.30` is out of band.
pub const REVENUE_DEMAND_BAND: f64 = 0.30;

/// D363 (b): each industry's effective demand within ±55% of its trend path (the review's
/// figure): a quarter's demand over its trend demand at the same closes outside `1 ± 0.55` is
/// out of band.
pub const DEMAND_TREND_BAND: f64 = 0.55;

/// Industries waived until the spec 11.2 per-industry rework of Cloud's 20% pre-boom growth,
/// from two targets: "no industry stuck at an M clamp for more than 8 quarters" (D366, design
/// fix 366) and "industry revenue within ±30% of the industry's own demand path" (D368, design
/// fix 363). Their figures are still recorded and reported on their own rows.
pub const SPEC_11_2_WAIVED: &[&str] = &["cloud"];

/// Spec 10: "each industry's 10-year average demand growth within ±3 pp of its long-term rate"
/// (D324), in percentage points a year.
pub const DEMAND_GROWTH_BAND_PP: f64 = 3.0;

/// Calendar month numbers: a quarter's last month is a multiple of this, and December is the
/// year's last (sim::economy's month counts, which are f64 rates there).
const QUARTER_MONTHS: u8 = MONTHS_PER_QUARTER as u8;
const DECEMBER: u8 = MONTHS_PER_YEAR as u8;

/// The `ai_labs` industry key (industries.csv), for the spec 10 AI labs startup target.
const AI_LABS_KEY: &str = "ai_labs";

/// The headline exchanges whose index levels the metrics show: North America, the EU, China and
/// Japan (financial-zones.csv `exchange_code`).
const INDEX_COLUMNS: [&str; 4] = ["ATX", "CBX", "HSE", "ESE"];

/// One seed's run: its two tables (rows only, no header) and its timing.
pub struct SeedOutput {
    pub seed: u64,
    pub years: String,
    pub quarters: String,
    pub ticks: u64,
    /// Wall time of the seed from `Sim::new` to its last tick (not part of either table).
    pub wall_ms: u128,
    pub state_hash: String,
    /// The clock at the end (`2050-01-01 00:00`).
    pub end: String,
}

/// Runs `seed` from the start state for `years` years (to 1 January of 2020 + years, 00:00)
/// through `Sim::step` only, recording both tables. With `hash_monthly` it prints the state hash
/// after each month close (`run --hash-monthly`, M1.9). With `profile` each step runs through
/// `Sim::step_observed` and its parts are timed there (`run --profile`, M10.6, D400); the rows and
/// hashes are the same either way.
pub fn run_seed(
    data: &WorldData,
    seed: u64,
    years: u32,
    hash_monthly: bool,
    mut profile: Option<&mut Profiler>,
) -> Result<SeedOutput, String> {
    let start = Instant::now();
    let mut sim = Sim::new(data.clone(), seed).map_err(|e| e.to_string())?;
    let end = DateTime::midnight(Date::ymd(EPOCH_YEAR + years as i32, 1, 1));
    let mut rec = Recorder::new(&sim, seed);
    let mut ticks = 0u64;
    while sim.now() < end {
        ticks += 1;
        rec.year_ticks += 1;
        let notices = match profile.as_deref_mut() {
            None => sim.step(),
            Some(p) => {
                let t = Instant::now();
                let notices = sim.step_observed(p);
                p.add_step(t.elapsed());
                notices
            }
        };
        for n in notices {
            rec.notice(&sim, &n, hash_monthly);
        }
    }
    Ok(SeedOutput {
        seed,
        years: rec.years,
        quarters: rec.quarters,
        ticks,
        wall_ms: start.elapsed().as_millis(),
        state_hash: sim.state_hash().to_string(),
        end: sim.now().to_string(),
    })
}

/// Consecutive quarters each industry has sat at an M clamp, counted at each quarter's last
/// month close (D166: M is 0.7 or 1.3 at that close).
#[derive(Default)]
struct ClampRuns {
    run: Vec<u32>,
    /// The industry's run has ever passed 8 quarters.
    over: Vec<bool>,
    /// The longest run seen so far, any industry.
    max_run: u32,
}

/// M at either clamp edge (spec 5.2).
fn at_clamp(m: f64) -> bool {
    m <= M_MIN + M_CLAMP_EPSILON || m >= M_MAX - M_CLAMP_EPSILON
}

impl ClampRuns {
    /// A quarter's last month close: each industry's M, in industry id order.
    fn add_quarter(&mut self, factors: &[f64]) {
        self.run.resize(factors.len(), 0);
        self.over.resize(factors.len(), false);
        for (i, &m) in factors.iter().enumerate() {
            self.run[i] = if at_clamp(m) { self.run[i] + 1 } else { 0 };
            self.over[i] |= self.run[i] > M_CLAMP_QUARTERS;
            self.max_run = self.max_run.max(self.run[i]);
        }
    }

    /// The longest run ending this quarter among the industries whose `waived` flag (D366,
    /// industry id order; missing means not waived) equals `want`.
    fn current_max(&self, waived: &[bool], want: bool) -> u32 {
        self.run
            .iter()
            .enumerate()
            .filter(|&(i, _)| is_waived(waived, i) == want)
            .map(|(_, &r)| r)
            .max()
            .unwrap_or(0)
    }
}

/// The quarter being recorded (`quarters.csv`).
#[derive(Default)]
struct QuarterAcc {
    /// The release made in this quarter (its first month's 2nd): the quarter it reports and its
    /// reports, beats and misses (v_market_stats, D249 tags).
    release: Option<(Quarter, usize, usize, usize)>,
    /// Industry-months in force in this quarter, and how many of them were labeled Boom or Bust
    /// (D325).
    industry_months: usize,
    boom_months: usize,
    bust_months: usize,
    /// Per industry: the quarter's revenue (named + fringe), trend revenue (D322) and demand
    /// revenue (a twelfth of effective demand at each close, D363).
    revenue: Vec<f64>,
    trend: Vec<f64>,
    demand: Vec<f64>,
}

/// One industry at a month close, as v_industry_row shows it.
struct MonthFigures {
    /// The label this close set, in force for the next month.
    label: PhaseLabel,
    /// The month's revenue, named units plus fringe.
    revenue: f64,
    trend_demand: f64,
    /// Effective demand at the close, USD a year (spec 5.1).
    demand: f64,
}

impl QuarterAcc {
    /// Adds the month just closed (D322, D325). It ran under `labels`, set at the previous close
    /// (or at load for January 2020); they then take the labels this close set, which are in
    /// force for the next month. Its revenue is set against a twelfth of the trend demand at the
    /// same close.
    fn add_month(&mut self, labels: &mut Vec<PhaseLabel>, rows: &[MonthFigures]) {
        self.revenue.resize(rows.len(), 0.0);
        self.trend.resize(rows.len(), 0.0);
        self.demand.resize(rows.len(), 0.0);
        labels.resize(rows.len(), PhaseLabel::Normal);
        for (i, r) in rows.iter().enumerate() {
            self.industry_months += 1;
            self.boom_months += usize::from(labels[i] == PhaseLabel::Boom);
            self.bust_months += usize::from(labels[i] == PhaseLabel::Bust);
            labels[i] = r.label;
            self.revenue[i] += r.revenue;
            self.trend[i] += r.trend_demand / MONTHS_PER_YEAR;
            self.demand[i] += r.demand / MONTHS_PER_YEAR;
        }
    }
}

/// A cast's full and simple character counts from its board at birth (D326): the founders, and
/// the simple characters cast, which are the simple seat holders plus the directors who are not
/// unseated founders. With partials placed before seat fillers (5.19.4 step 3), that is
/// `max(partials drawn, open seats left after the seated founders)`.
fn cast_sizes(
    founders: usize,
    seated_founders: usize,
    simple_seats: usize,
    directors: usize,
) -> (usize, usize) {
    let simple_directors = directors.saturating_sub(founders - seated_founders);
    (founders, simple_seats + simple_directors)
}

/// A born company's cast at birth (D326): the year's count and the min and max sizes.
#[derive(Default)]
struct CastStats {
    casts: usize,
    full: Option<(usize, usize)>,
    simple: Option<(usize, usize)>,
}

fn widen(range: &mut Option<(usize, usize)>, n: usize) {
    *range = Some(range.map_or((n, n), |(lo, hi)| (lo.min(n), hi.max(n))));
}

fn opt(v: Option<usize>) -> String {
    v.map_or(String::new(), |n| n.to_string())
}

/// Reads the views at the notices of each tick and writes the rows.
struct Recorder {
    seed: u64,
    year_ticks: u64,
    economy: YearEconomy,
    tracking: YearTracking,
    births: YearBirths,
    clamp: ClampRuns,
    /// Per industry in id order: in [`SPEC_11_2_WAIVED`] (D366, D368).
    waived: Vec<bool>,
    quarter: QuarterAcc,
    /// The labels in force for the month now running: set at load (D110) for January 2020, then
    /// by each month close for the next month (4.3 step 2).
    labels: Vec<PhaseLabel>,
    /// Each industry's effective and trend demand at load (2020-01-01 00:00).
    demand0: Vec<f64>,
    trend0: Vec<f64>,
    casts: CastStats,
    empty_seats_max: usize,
    distressed_seen: Vec<bool>,
    years: String,
    quarters: String,
}

impl Recorder {
    fn new(sim: &Sim, seed: u64) -> Recorder {
        let rows = &sim.views().industry_rows.get().rows;
        Recorder {
            seed,
            year_ticks: 0,
            economy: YearEconomy::default(),
            tracking: YearTracking::default(),
            births: YearBirths::default(),
            clamp: ClampRuns::default(),
            waived: rows
                .iter()
                .map(|r| SPEC_11_2_WAIVED.contains(&r.key.as_str()))
                .collect(),
            quarter: QuarterAcc::default(),
            labels: rows.iter().map(|r| r.phase_label).collect(),
            demand0: rows.iter().map(|r| r.demand).collect(),
            trend0: rows.iter().map(|r| r.trend_demand).collect(),
            casts: CastStats::default(),
            empty_seats_max: 0,
            distressed_seen: vec![false; sim.views().company_detail.get().companies.len()],
            years: String::new(),
            quarters: String::new(),
        }
    }

    fn notice(&mut self, sim: &Sim, n: &Notice, hash_monthly: bool) {
        match n {
            Notice::DayDone(_) => self.tracking.add_day(sim),
            Notice::EarningsReleased(q) => {
                let m = sim.views().market_stats.get();
                self.births.add_release(m.reports, m.beats, m.misses);
                self.quarter.release = Some((*q, m.reports, m.beats, m.misses));
            }
            Notice::CompanyBorn(id) => self.add_birth(sim, id.index()),
            Notice::MonthDone(month) => {
                self.month_close(sim, month.month);
                if hash_monthly {
                    println!("seed {} {month} {}", self.seed, sim.state_hash());
                }
                if month.month.is_multiple_of(QUARTER_MONTHS) {
                    self.quarter_close(month.year, month.month / QUARTER_MONTHS);
                }
                if month.month == DECEMBER {
                    self.year_close(sim, month.year);
                }
            }
            _ => {}
        }
    }

    /// Spec 5.19.4 and 10 ("every startup has 1 to 5 full and 1 to 5 partial characters, and no
    /// labor seat of a born company is empty"), read from v_company_detail the tick it is born
    /// (D159, D326).
    fn add_birth(&mut self, sim: &Sim, index: usize) {
        let c = &sim.views().company_detail.get().companies[index];
        let seated_founders = c
            .board
            .iter()
            .filter_map(|s| s.holder.as_ref()?.character)
            .filter(|ch| c.founders.contains(ch))
            .count();
        let simple_seats = c
            .board
            .iter()
            .filter(|s| s.holder.as_ref().is_some_and(|h| h.partial))
            .count();
        let (full, simple) =
            cast_sizes(c.founders.len(), seated_founders, simple_seats, c.directors);
        self.casts.casts += 1;
        widen(&mut self.casts.full, full);
        widen(&mut self.casts.simple, simple);
        let empty = c
            .board
            .iter()
            .filter(|s| s.open && s.holder.is_none())
            .count();
        self.empty_seats_max = self.empty_seats_max.max(empty);
    }

    fn month_close(&mut self, sim: &Sim, month: u8) {
        let v = sim.views();
        self.economy.add_month(sim);
        self.births.add_month(sim);
        let rows = &v.industry_rows.get().rows;
        let figures: Vec<MonthFigures> = rows
            .iter()
            .map(|r| MonthFigures {
                label: r.phase_label,
                revenue: r.named_revenue_m + r.fringe_revenue_m,
                trend_demand: r.trend_demand,
                demand: r.demand,
            })
            .collect();
        self.quarter.add_month(&mut self.labels, &figures);
        if month.is_multiple_of(QUARTER_MONTHS) {
            let factors: Vec<f64> = rows.iter().map(|r| r.market_factor).collect();
            self.clamp.add_quarter(&factors);
        }
        let companies = &v.company_detail.get().companies;
        if companies.len() > self.distressed_seen.len() {
            self.distressed_seen.resize(companies.len(), false);
        }
        // No empty labor seat of a born company still in the game (D326).
        let mut empty = 0;
        for c in companies {
            if c.status == CompanyStatus::Distressed {
                self.distressed_seen[c.id.index()] = true;
            }
            if matches!(c.origin, Origin::Born { .. }) && !c.status.is_frozen() {
                empty += c
                    .board
                    .iter()
                    .filter(|s| s.open && s.holder.is_none())
                    .count();
            }
        }
        self.empty_seats_max = self.empty_seats_max.max(empty);
    }

    fn quarter_close(&mut self, year: i32, quarter: u8) {
        let q = std::mem::take(&mut self.quarter);
        let ratios: Vec<f64> = q
            .revenue
            .iter()
            .zip(&q.trend)
            .map(|(&r, &t)| revenue_ratio(r, t))
            .collect();
        // D363: revenue against the industry's own demand path, and demand against its trend.
        let rev_demand: Vec<f64> = q
            .revenue
            .iter()
            .zip(&q.demand)
            .map(|(&r, &d)| revenue_ratio(r, d))
            .collect();
        let demand_trend: Vec<f64> = q
            .demand
            .iter()
            .zip(&q.trend)
            .map(|(&d, &t)| revenue_ratio(d, t))
            .collect();
        let (rd_min, rd_max, rd_out) = band_stats(&rev_demand, REVENUE_DEMAND_BAND);
        let (dt_min, dt_max, dt_out) = band_stats(&demand_trend, DEMAND_TREND_BAND);
        // D368: the same revenue ratios split into the industries judged and those waived.
        let [(rc_min, rc_max, rc_out), (rw_min, rw_max, rw_out)] = [false, true]
            .map(|want| band_stats_where(&rev_demand, REVENUE_DEMAND_BAND, &self.waived, want));
        let counted = self.clamp.current_max(&self.waived, false);
        let waived = self.clamp.current_max(&self.waived, true);
        let min = ratios.iter().copied().fold(f64::INFINITY, f64::min);
        let max = ratios.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        let out = ratios
            .iter()
            .filter(|&&r| (r - 1.0).abs() > REVENUE_TREND_BAND)
            .count();
        let (released, reports, beats, misses) = match q.release {
            Some((rq, r, b, m)) => (quarter_label(rq), r, b, m),
            None => (String::new(), 0, 0, 0),
        };
        let at_clamp = self.clamp.run.iter().filter(|&&r| r > 0).count();
        let max_run = self.clamp.run.iter().copied().max().unwrap_or(0);
        let over = self
            .clamp
            .run
            .iter()
            .filter(|&&r| r > M_CLAMP_QUARTERS)
            .count();
        writeln!(
            self.quarters,
            "{},{year},{quarter},{released},{reports},{beats},{misses},{},{},{},{},{min:.4},\
             {max:.4},{out},{at_clamp},{max_run},{over},{rd_min:.4},{rd_max:.4},{rd_out},\
             {dt_min:.4},{dt_max:.4},{dt_out},{counted},{waived},{rc_min:.4},{rc_max:.4},\
             {rc_out},{rw_min:.4},{rw_max:.4},{rw_out}",
            self.seed,
            ratios.len(),
            q.industry_months,
            q.boom_months,
            q.bust_months,
        )
        .unwrap();
    }

    fn year_close(&mut self, sim: &Sim, year: i32) {
        let hash = sim.state_hash();
        let econ = self.economy.columns(sim);
        let ops = operations_columns(sim);
        let seen = self.distressed_seen.iter().filter(|&&d| d).count();
        let books = books_columns(sim, year, seen);
        let market = self.tracking.columns(sim);
        let m6 = self.births.columns(sim, year, &self.clamp);
        let m10 = self.m10_columns(sim, year);
        writeln!(
            self.years,
            "{},{year},{},{hash},{econ},{ops},{books},{market},{m6},{m10}",
            self.seed, self.year_ticks
        )
        .unwrap();
        self.distressed_seen.iter_mut().for_each(|d| *d = false);
        self.economy = YearEconomy::default();
        self.tracking = YearTracking::default();
        self.casts = CastStats::default();
        self.empty_seats_max = 0;
        self.year_ticks = 0;
    }

    /// The M10 columns of `year`'s row: demand growth against the trend since load (D324), the
    /// year's casts (D326) and the worst count of empty labor seats seen in the year.
    fn m10_columns(&self, sim: &Sim, year: i32) -> String {
        let rows = &sim.views().industry_rows.get().rows;
        let n = f64::from(year + 1 - EPOCH_YEAR);
        let devs: Vec<f64> = rows
            .iter()
            .enumerate()
            .map(|(i, r)| {
                let g = cagr(self.demand0[i], r.demand, n);
                let lt = cagr(self.trend0[i], r.trend_demand, n);
                100.0 * (g - lt).abs()
            })
            .collect();
        let max_dev = devs.iter().copied().fold(0.0, f64::max);
        let out = devs.iter().filter(|&&d| d > DEMAND_GROWTH_BAND_PP).count();
        let c = &self.casts;
        format!(
            "{max_dev:.3},{out},{},{},{},{},{},{}",
            c.casts,
            opt(c.full.map(|r| r.0)),
            opt(c.full.map(|r| r.1)),
            opt(c.simple.map(|r| r.0)),
            opt(c.simple.map(|r| r.1)),
            self.empty_seats_max,
        )
    }
}

/// Annual growth from `from` to `to` over `years` years; an infinite rate when `from` is not
/// positive (it never is in the data).
fn cagr(from: f64, to: f64, years: f64) -> f64 {
    if from > 0.0 && to >= 0.0 {
        (to / from).powf(1.0 / years) - 1.0
    } else {
        f64::INFINITY
    }
}

/// A quarter's revenue over its trend revenue (D322), and likewise revenue over demand revenue
/// and demand over trend (D363); with no denominator, 1 for a zero numerator, else infinite.
fn revenue_ratio(revenue: f64, trend: f64) -> f64 {
    if trend > 0.0 {
        revenue / trend
    } else if revenue > 0.0 {
        f64::INFINITY
    } else {
        1.0
    }
}

/// The lowest and highest ratio and how many are outside `1 ± band`.
fn band_stats(ratios: &[f64], band: f64) -> (f64, f64, usize) {
    let min = ratios.iter().copied().fold(f64::INFINITY, f64::min);
    let max = ratios.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let out = ratios.iter().filter(|&&r| (r - 1.0).abs() > band).count();
    (min, max, out)
}

/// [`band_stats`] over the industries whose waived flag equals `want` (D368). With none it gives
/// (1, 1, 0): an empty set is inside every band.
fn band_stats_where(ratios: &[f64], band: f64, waived: &[bool], want: bool) -> (f64, f64, usize) {
    let picked: Vec<f64> = ratios
        .iter()
        .enumerate()
        .filter(|&(i, _)| is_waived(waived, i) == want)
        .map(|(_, &r)| r)
        .collect();
    if picked.is_empty() {
        return (1.0, 1.0, 0);
    }
    band_stats(&picked, band)
}

/// Whether industry `i` is in [`SPEC_11_2_WAIVED`], from the flags in industry id order.
fn is_waived(waived: &[bool], i: usize) -> bool {
    waived.get(i).copied().unwrap_or(false)
}

/// `2019Q4`.
pub fn quarter_label(q: Quarter) -> String {
    format!("{}Q{}", q.year, q.q)
}

/// The M6 columns' running counts (D166), with the median productivity of D321.
#[derive(Default)]
struct YearBirths {
    reports: usize,
    beats: usize,
    misses: usize,
    industry_months: usize,
    boom_months: usize,
    bust_months: usize,
}

impl YearBirths {
    /// A release (the 2nd of a quarter's first month): its reports and their tags.
    fn add_release(&mut self, reports: usize, beats: usize, misses: usize) {
        self.reports += reports;
        self.beats += beats;
        self.misses += misses;
    }

    /// A month close: the labels it set.
    fn add_month(&mut self, sim: &Sim) {
        for r in &sim.views().industry_rows.get().rows {
            self.industry_months += 1;
            self.boom_months += usize::from(r.phase_label == PhaseLabel::Boom);
            self.bust_months += usize::from(r.phase_label == PhaseLabel::Bust);
        }
    }

    /// The M6 columns of `year`'s row; the year's counts restart.
    fn columns(&mut self, sim: &Sim, year: i32, clamp: &ClampRuns) -> String {
        let v = sim.views();
        let births = v.births.get();
        let in_year = |d: Date| d.year == year;
        let events = births.events.iter().filter(|e| in_year(e.date)).count();
        let startups = births.births.iter().filter(|b| in_year(b.date)).count();
        let industries = &v.industry_rows.get().rows;
        let ai_labs = births
            .births
            .iter()
            .filter(|b| in_year(b.date))
            .filter(|b| {
                industries
                    .get(b.industry.index())
                    .is_some_and(|r| r.key == AI_LABS_KEY)
            })
            .count();
        let listings = births.listings.iter().filter(|l| in_year(l.date)).count();
        let companies = &v.company_detail.get().companies;
        let start_listed = births
            .listings
            .iter()
            .filter(|l| companies[l.id.index()].origin == Origin::Start)
            .count();
        let named = companies
            .iter()
            .filter(|c| c.status != CompanyStatus::Removed)
            .count();
        let starts: Vec<_> = companies
            .iter()
            .filter(|c| c.origin == Origin::Start)
            .collect();
        let share_of_starts = |n: usize| n as f64 / starts.len().max(1) as f64;
        let start_active = share_of_starts(
            starts
                .iter()
                .filter(|c| c.status == CompanyStatus::Active)
                .count(),
        );
        // Spec 10 "neither bankrupt nor removed" (D320): Active or Distressed.
        let start_alive = share_of_starts(starts.iter().filter(|c| !c.status.is_frozen()).count());
        let share = |a: usize, b: usize| a as f64 / b.max(1) as f64;
        let out = format!(
            "{events},{startups},{ai_labs},{listings},{start_listed},{named},{start_active:.4},\
             {start_alive:.4},{:.4},{:.4},{:.4},{:.4},{},{},{},{},{:.3}",
            share(self.beats, self.reports),
            share(self.misses, self.reports),
            share(self.boom_months, self.industry_months),
            share(self.bust_months, self.industry_months),
            clamp.over.iter().filter(|&&o| o).count(),
            clamp.max_run,
            births.full_characters_made,
            births.full_characters,
            median_productivity(sim),
        );
        *self = YearBirths::default();
        out
    }
}

/// Spec 10 "median productivity 90 to 110" (D321): the median productivity of the units with
/// gross assets above 0 of companies not frozen (Active or Distressed), the mean of the middle
/// two for an even count; 0 with no unit.
fn median_productivity(sim: &Sim) -> f64 {
    let v = sim.views();
    let companies = &v.company_detail.get().companies;
    let mut prod: Vec<f64> = v
        .units
        .get()
        .units
        .iter()
        .filter(|u| u.gross_assets > 0.0 && !companies[u.company.index()].status.is_frozen())
        .map(|u| u.productivity)
        .collect();
    prod.sort_by(f64::total_cmp);
    median(&prod)
}

/// The median of sorted values (0 when empty).
fn median(sorted: &[f64]) -> f64 {
    let n = sorted.len();
    match n {
        0 => 0.0,
        _ if n % 2 == 1 => sorted[n / 2],
        _ => 0.5 * (sorted[n / 2 - 1] + sorted[n / 2]),
    }
}

/// The year's M5.8 tracking count, added at each daily close from v_market_stats.
#[derive(Default)]
struct YearTracking {
    within: u64,
    days: u64,
}

impl YearTracking {
    fn add_day(&mut self, sim: &Sim) {
        let m = sim.views().market_stats.get();
        self.within += m.within_band as u64;
        self.days += m.quoted as u64;
    }

    /// The M5 market columns at the December close.
    fn columns(&self, sim: &Sim) -> String {
        let v = sim.views();
        let m = v.market_stats.get();
        let quotes = v.quotes.get();
        let levels: Vec<String> = INDEX_COLUMNS
            .iter()
            .map(|code| {
                v.exchanges
                    .get()
                    .get(code)
                    .and_then(|e| quotes.indices.iter().find(|i| i.zone == e.zone))
                    .and_then(|i| i.level)
                    .map_or(String::new(), |l| format!("{l:.2}"))
            })
            .collect();
        format!(
            "{},{:.4},{:.4},{:.3},{}",
            m.quoted,
            m.median_gap,
            self.within as f64 / self.days.max(1) as f64,
            m.mean_confidence,
            levels.join(",")
        )
    }
}

/// The M4 books columns at the close of `year` (the 1 January tick that closes it), with
/// `distressed_in_year` counted by the caller from the monthly closes.
fn books_columns(sim: &Sim, year: i32, distressed_in_year: usize) -> String {
    let v = sim.views();
    let companies = &v.company_detail.get().companies;
    let count = |s: CompanyStatus| companies.iter().filter(|c| c.status == s).count();
    let ratings = v.ratings.get();
    // The year's events: its own days, and the 1 January close that ends it.
    let close = Date::ymd(year + 1, 1, 1);
    let in_year = |d: Option<Date>| d.is_some_and(|d| d.year == year || d == close);
    let bankruptcies = ratings
        .companies
        .iter()
        .filter(|c| in_year(c.bankrupt_on))
        .count();
    let removals = ratings
        .companies
        .iter()
        .filter(|c| in_year(c.removed_on))
        .count();
    let line: f64 = companies.iter().map(|c| c.line_drawn_usd).sum();
    let bands: Vec<String> = ratings
        .band_counts()
        .iter()
        .map(|(b, n)| format!("{}:{n}", band_label(*b)))
        .collect();
    format!(
        "{distressed_in_year},{},{},{},{bankruptcies},{removals},{:.4},{line:.0},{}",
        count(CompanyStatus::Distressed),
        count(CompanyStatus::Bankrupt),
        count(CompanyStatus::Removed),
        count(CompanyStatus::Active) as f64 / companies.len().max(1) as f64,
        bands.join("|")
    )
}

fn band_label(b: Band) -> &'static str {
    match b {
        Band::Aaa => "AAA",
        Band::Aa => "AA",
        Band::A => "A",
        Band::Bbb => "BBB",
        Band::Bb => "BB",
        Band::B => "B",
        Band::Ccc => "CCC",
        Band::Cc => "CC",
    }
}

/// The M3 operations columns, read from the views at the December close.
fn operations_columns(sim: &Sim) -> String {
    let v = sim.views();
    let units = &v.units.get().units;
    let mean_productivity =
        units.iter().map(|u| u.productivity).sum::<f64>() / units.len().max(1) as f64;
    let companies = &v.company_detail.get().companies;
    let n = companies.len().max(1) as f64;
    let mean_management = companies.iter().map(|c| c.management_score).sum::<f64>() / n;
    let data_tb: f64 = v.tech.get().companies.iter().map(|t| t.stored_tb()).sum();
    let mut ebit = vec![0.0; companies.len()];
    for u in units {
        ebit[u.company.index()] += u.ebit_m;
    }
    let profitable = ebit.iter().filter(|&&e| e > 0.0).count();
    format!(
        "{mean_productivity:.3},{mean_management:.3},{data_tb:.1},{:.4}",
        profitable as f64 / n
    )
}

/// The M2 economy columns, read from the views after each month closes.
#[derive(Default)]
struct YearEconomy {
    named_revenue: f64,
    fringe_revenue: f64,
}

impl YearEconomy {
    /// Adds the month just closed.
    fn add_month(&mut self, sim: &Sim) {
        for r in &sim.views().industry_rows.get().rows {
            self.named_revenue += r.named_revenue_m;
            self.fringe_revenue += r.fringe_revenue_m;
        }
    }

    /// The economy columns of the year's row.
    fn columns(&self, sim: &Sim) -> String {
        let cycle = sim.views().cycle.get();
        let rows = &sim.views().industry_rows.get().rows;
        let n = rows.len().max(1) as f64;
        let s: Vec<f64> = rows.iter().map(|r| r.supply_ratio).collect();
        let mean_s = s.iter().sum::<f64>() / n;
        let min_s = s.iter().copied().fold(f64::INFINITY, f64::min);
        let max_s = s.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        let mean_m = rows.iter().map(|r| r.market_factor).sum::<f64>() / n;
        format!(
            "{},{:.6},{:.0},{:.0},{mean_s:.4},{min_s:.4},{max_s:.4},{mean_m:.4}",
            cycle.phase.name(),
            cycle.g_t,
            self.named_revenue,
            self.fringe_revenue,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn median_of_odd_and_even_counts() {
        assert_eq!(median(&[]), 0.0);
        assert_eq!(median(&[3.0]), 3.0);
        assert_eq!(median(&[1.0, 2.0, 9.0]), 2.0);
        assert_eq!(median(&[1.0, 2.0, 4.0, 9.0]), 3.0);
    }

    #[test]
    fn cagr_and_revenue_ratio() {
        assert!((cagr(100.0, 121.0, 2.0) - 0.1).abs() < 1e-12);
        assert_eq!(cagr(0.0, 1.0, 1.0), f64::INFINITY);
        assert_eq!(revenue_ratio(3.0, 2.0), 1.5);
        assert_eq!(revenue_ratio(0.0, 0.0), 1.0);
        assert_eq!(revenue_ratio(1.0, 0.0), f64::INFINITY);
    }

    #[test]
    fn clamp_runs_count_consecutive_quarters_at_either_edge() {
        let mut c = ClampRuns::default();
        // Industry 0 sits at the floor, industry 1 at the cap then leaves it, industry 2 never.
        for q in 0..10 {
            let one = if q < 3 { M_MAX } else { 1.0 };
            c.add_quarter(&[M_MIN, one, 1.05]);
        }
        assert_eq!(c.run, [10, 0, 0]);
        assert_eq!(c.over, [true, false, false]);
        assert_eq!(c.max_run, 10);
        // A quarter off the clamp resets the run but not `over` or the longest run.
        c.add_quarter(&[0.9, M_MAX, 1.0]);
        assert_eq!(c.run, [0, 1, 0]);
        assert_eq!(c.over, [true, false, false]);
        assert_eq!(c.max_run, 10);
        // Exactly 8 quarters is not over; 9 is.
        let mut d = ClampRuns::default();
        for _ in 0..M_CLAMP_QUARTERS {
            d.add_quarter(&[M_MAX]);
        }
        assert_eq!(d.over, [false]);
        d.add_quarter(&[M_MAX]);
        assert_eq!(d.over, [true]);
        assert!(at_clamp(M_MIN) && at_clamp(M_MAX) && !at_clamp(M_MIN + 1e-6));
    }

    #[test]
    fn waived_industries_are_reported_apart() {
        // Industry 1 is waived (D366): its 12-quarter run is its own; the others' longest is 4.
        let waived = [false, true, false];
        let mut c = ClampRuns::default();
        for q in 0..12 {
            let zero = if q >= 8 { M_MIN } else { 1.0 };
            c.add_quarter(&[zero, M_MAX, 1.0]);
        }
        assert_eq!(c.current_max(&waived, true), 12);
        assert_eq!(c.current_max(&waived, false), 4);
        assert_eq!(c.max_run, 12);
        // With no waiver list nothing is waived.
        let mut d = ClampRuns::default();
        d.add_quarter(&[M_MAX]);
        assert_eq!(
            (d.current_max(&[], false), d.current_max(&[], true)),
            (1, 0)
        );
        assert_eq!(band_stats(&[0.6, 1.0, 1.4], 0.3), (0.6, 1.4, 2));
        // D368: the waived industry's revenue ratio (0.6) leaves the judged figures and is
        // reported on its own; all of them still count in the plain columns.
        let ratios = [0.9, 0.6, 1.2];
        assert_eq!(band_stats(&ratios, 0.3), (0.6, 1.2, 1));
        assert_eq!(
            band_stats_where(&ratios, 0.3, &waived, false),
            (0.9, 1.2, 0)
        );
        assert_eq!(band_stats_where(&ratios, 0.3, &waived, true), (0.6, 0.6, 1));
        assert_eq!(band_stats_where(&ratios, 0.3, &[], true), (1.0, 1.0, 0));
        assert_eq!(band_stats_where(&ratios, 0.3, &[], false), (0.6, 1.2, 1));
    }

    #[test]
    fn a_month_counts_the_labels_in_force_before_its_close() {
        let fig = |label| MonthFigures {
            label,
            revenue: 10.0,
            trend_demand: 120.0,
            demand: 96.0,
        };
        // Load labels Boom and Normal; the January close sets Bust and Boom for February.
        let mut labels = vec![PhaseLabel::Boom, PhaseLabel::Normal];
        let mut q = QuarterAcc::default();
        q.add_month(&mut labels, &[fig(PhaseLabel::Bust), fig(PhaseLabel::Boom)]);
        assert_eq!((q.industry_months, q.boom_months, q.bust_months), (2, 1, 0));
        assert_eq!(labels, [PhaseLabel::Bust, PhaseLabel::Boom]);
        // February ran under Bust and Boom, whatever its close sets.
        q.add_month(
            &mut labels,
            &[fig(PhaseLabel::Normal), fig(PhaseLabel::Normal)],
        );
        assert_eq!((q.industry_months, q.boom_months, q.bust_months), (4, 2, 1));
        // Revenue against a twelfth of trend demand: 20 over 2 × 10.
        assert_eq!(q.revenue, [20.0, 20.0]);
        assert_eq!(q.trend, [20.0, 20.0]);
        // And against a twelfth of effective demand (D363): 2 × 8.
        assert_eq!(q.demand, [16.0, 16.0]);
    }

    /// 5.19.4 placement with five open seats: the lead founder is CEO and the others take
    /// seats; partials fill the seats left in order, then sit as directors; fillers take the
    /// rest. A sixth founder (outside the spec's 1 to 5) would be an unseated director.
    #[test]
    fn cast_sizes_give_max_of_partials_and_open_seats() {
        const SEATS: usize = 5;
        for founders in 1..=6usize {
            for partials in 0..=7usize {
                let seated = founders.min(SEATS);
                let partial_seats = partials.min(SEATS - seated);
                let simple_seats = SEATS - seated;
                let directors = (founders - seated) + (partials - partial_seats);
                let (full, simple) = cast_sizes(founders, seated, simple_seats, directors);
                assert_eq!(full, founders);
                assert_eq!(
                    simple,
                    partials.max(SEATS - seated),
                    "{founders} {partials}"
                );
            }
        }
    }

    #[test]
    fn headers_have_no_spaces_or_duplicates() {
        for h in [YEARS_HEADER, QUARTERS_HEADER] {
            let cols: Vec<&str> = h.split(',').collect();
            assert!(
                cols.iter().all(|c| !c.is_empty() && !c.contains(' ')),
                "{h}"
            );
            let mut sorted = cols.clone();
            sorted.sort_unstable();
            sorted.dedup();
            assert_eq!(sorted.len(), cols.len(), "{h}");
        }
    }
}
