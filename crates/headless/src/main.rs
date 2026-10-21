//! Runs the simulation with no window (build-plan 2.1).
//!
//! - `--check-data` (M0.9) loads every data table, prints the row counts and runs the load-time
//!   checks; a bad row exits non-zero with its file, line and field (spec 10 M0).
//! - `run` (M1.8, M1.9, the start of the M10.1 soak harness) runs each seed for N years through the
//!   `Sim` API only, prints the state hash each month with `--hash-monthly`, and writes one metrics
//!   row per seed per year.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use sim::finance::distress::CompanyStatus;
use sim::finance::rating::Band;
use sim::time::{Date, DateTime};
use sim::world::{Ordinal, Origin, PhaseLabel};
use sim::{Notice, Sim};

const USAGE: &str = "usage:\n  \
    headless --check-data [--data-dir DIR]\n  \
    headless run --years N --seeds A..B [--out metrics.csv] [--hash-monthly] [--data-dir DIR]\n\
    DIR defaults to the repository's docs/design/data; seeds A..B are inclusive (a single seed A \
    also works)";

/// Metrics CSV header; later milestones add columns. M2: the cycle phase and g_t at the year's
/// close, the year's named and fringe revenue (sum of the twelve monthly closes) and S and M
/// across the 42 industries at the December close. M3, at the December close: mean unit
/// productivity, mean management score, total data held and unstructured (TB) and the share of
/// companies with EBIT after R&D above 0 that month. M4: companies seen Distressed at any month
/// close of the year, and at the December close Distressed, Bankrupt (frozen) and Removed (all
/// years); bankruptcies and removals in the year; the share of the 651 still Active; the total
/// line drawn; the rating bands of the companies not frozen (`AAA:n|AA:n|...|CC:n`). M5: at the
/// December close the quoted (listed, not delisted) count, the median `|P ÷ V − 1|` over them,
/// the mean zone confidence and the headline index levels of four exchanges ([`INDEX_COLUMNS`];
/// empty with no listing); and over the year's daily closes the share of quoted company-days
/// with `|P ÷ V − 1| ≤ 30%` (the M5.8 tracking share, D143). M6 (the spec 10 and build-plan 4.4
/// targets, for the M10 soak): startup events and startups born in the year (and AI labs
/// startups), listings in the year and starting private companies listed so far, named
/// companies (not Removed) at the close, the share of the 651 still Active, the share of the
/// year's reports tagged Beat or Big beat and Miss or Big miss (at each release, D249), the share
/// of industry-months labeled Boom and Bust, industries ever held at an M clamp (0.7 or 1.3) for
/// more than 8 quarters in a row and the longest such run so far, full characters made in play
/// so far, and the median unit productivity at the close.
const METRICS_HEADER: &str = "seed,year,ticks,final_hash,wall_ms,phase,g_t,named_revenue_usd,\
    fringe_revenue_usd,mean_s,min_s,max_s,mean_m,mean_productivity,mean_management,data_tb,\
    profitable_share,distressed_in_year,distressed,bankrupt,removed,bankruptcies_in_year,\
    removals_in_year,active_share,line_drawn_usd,ratings,quoted,median_gap,tracking_share,\
    mean_confidence,index_atx,index_cbx,index_hse,index_ese,events_in_year,startups_in_year,\
    ai_lab_startups_in_year,listings_in_year,start_private_listed,named_companies,\
    start_active_share,beat_share,miss_share,boom_share,bust_share,m_clamp_over_8q,\
    max_m_clamp_quarters,full_characters_made,median_productivity";

/// Spec 5.2: M's clamp; an industry at it for more than 8 quarters misses a spec 10 target.
const M_CLAMP: (f64, f64) = (0.7, 1.3);
const M_CLAMP_QUARTERS: u32 = 8;

/// The M6 columns' running counts (D166).
#[derive(Default)]
struct YearBirths {
    reports: usize,
    beats: usize,
    misses: usize,
    industry_months: usize,
    boom_months: usize,
    bust_months: usize,
    /// Consecutive quarters at an M clamp, by industry; and whether it ever passed 8.
    clamp_run: Vec<u32>,
    clamp_over: Vec<bool>,
    max_run: u32,
}

impl YearBirths {
    /// A release (the 2nd of a quarter's first month): its reports and their tags.
    fn add_release(&mut self, sim: &Sim) {
        let m = sim.views().market_stats.get();
        self.reports += m.reports;
        self.beats += m.beats;
        self.misses += m.misses;
    }

    /// A month close: the labels; at a quarter's last month the M clamp runs.
    fn add_month(&mut self, sim: &Sim, month: u8) {
        let rows = &sim.views().industry_rows.get().rows;
        self.clamp_run.resize(rows.len(), 0);
        self.clamp_over.resize(rows.len(), false);
        for (i, r) in rows.iter().enumerate() {
            self.industry_months += 1;
            self.boom_months += usize::from(r.phase_label == PhaseLabel::Boom);
            self.bust_months += usize::from(r.phase_label == PhaseLabel::Bust);
            if month % 3 == 0 {
                let at_clamp =
                    r.market_factor <= M_CLAMP.0 + 1e-12 || r.market_factor >= M_CLAMP.1 - 1e-12;
                self.clamp_run[i] = if at_clamp { self.clamp_run[i] + 1 } else { 0 };
                self.clamp_over[i] |= self.clamp_run[i] > M_CLAMP_QUARTERS;
                self.max_run = self.max_run.max(self.clamp_run[i]);
            }
        }
    }

    /// The M6 columns of `year`'s row; the year's counts restart, the runs carry on.
    fn columns(&mut self, sim: &Sim, year: i32) -> String {
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
                    .iter()
                    .any(|r| r.id == b.industry && r.key == "ai_labs")
            })
            .count();
        let listings = births.listings.iter().filter(|l| in_year(l.date)).count();
        let companies = &v.company_detail.get().companies;
        let start_listed = births
            .listings
            .iter()
            .filter(|l| {
                companies
                    .iter()
                    .any(|c| c.id == l.id && c.origin == Origin::Start)
            })
            .count();
        let named = companies
            .iter()
            .filter(|c| c.status != CompanyStatus::Removed)
            .count();
        let starts: Vec<_> = companies
            .iter()
            .filter(|c| c.origin == Origin::Start)
            .collect();
        let start_active = starts
            .iter()
            .filter(|c| c.status == CompanyStatus::Active)
            .count() as f64
            / starts.len().max(1) as f64;
        let mut prod: Vec<f64> = v.units.get().units.iter().map(|u| u.productivity).collect();
        prod.sort_by(f64::total_cmp);
        let median_prod = prod.get(prod.len() / 2).copied().unwrap_or(0.0);
        let share = |a: usize, b: usize| a as f64 / b.max(1) as f64;
        let out = format!(
            "{events},{startups},{ai_labs},{listings},{start_listed},{named},{start_active:.4},\
             {:.4},{:.4},{:.4},{:.4},{},{},{},{median_prod:.3}",
            share(self.beats, self.reports),
            share(self.misses, self.reports),
            share(self.boom_months, self.industry_months),
            share(self.bust_months, self.industry_months),
            self.clamp_over.iter().filter(|&&o| o).count(),
            self.max_run,
            births.full_characters_made,
        );
        *self = YearBirths {
            clamp_run: std::mem::take(&mut self.clamp_run),
            clamp_over: std::mem::take(&mut self.clamp_over),
            max_run: self.max_run,
            ..YearBirths::default()
        };
        out
    }
}

/// The headline exchanges whose index levels the metrics show: North America, the EU, China and
/// Japan (financial-zones.csv `exchange_code`).
const INDEX_COLUMNS: [&str; 4] = ["ATX", "CBX", "HSE", "ESE"];

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
    let profitable = companies
        .iter()
        .filter(|c| {
            v.units
                .get()
                .of_company(c.id)
                .map(|u| u.ebit_m)
                .sum::<f64>()
                > 0.0
        })
        .count();
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

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("run") {
        return match RunArgs::parse(&args[1..]) {
            Some(a) => run(&a),
            None => usage(),
        };
    }
    let mut check_data = false;
    let mut dir = sim_data::default_data_dir();
    let mut it = args.into_iter();
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--check-data" => check_data = true,
            "--data-dir" => match it.next() {
                Some(d) => dir = PathBuf::from(d),
                None => return usage(),
            },
            _ => return usage(),
        }
    }
    if !check_data {
        return usage();
    }
    check(&dir)
}

fn usage() -> ExitCode {
    eprintln!("{USAGE}");
    ExitCode::from(2)
}

fn check(dir: &Path) -> ExitCode {
    let world = match sim_data::load_world(dir) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("error: {e}");
            return ExitCode::FAILURE;
        }
    };
    println!("Loaded {}", dir.display());
    for (name, n) in world.counts() {
        println!("  {name:18} {n:>6}");
    }
    let errors = sim_data::check(&world);
    for e in &errors {
        eprintln!("error: {e}");
    }
    if errors.is_empty() {
        if let Err(e) = Sim::new(world, 0) {
            eprintln!("error: {e}");
            return ExitCode::FAILURE;
        }
        println!("OK");
        ExitCode::SUCCESS
    } else {
        eprintln!("{} errors", errors.len());
        ExitCode::FAILURE
    }
}

/// Arguments of `run`.
struct RunArgs {
    years: u32,
    seeds: (u64, u64),
    out: Option<PathBuf>,
    hash_monthly: bool,
    dir: PathBuf,
}

impl RunArgs {
    fn parse(args: &[String]) -> Option<RunArgs> {
        let (mut years, mut seeds, mut out, mut hash_monthly) = (None, None, None, false);
        let mut dir = sim_data::default_data_dir();
        let mut it = args.iter();
        while let Some(arg) = it.next() {
            match arg.as_str() {
                "--years" => years = Some(it.next()?.parse().ok()?),
                "--seeds" => seeds = Some(parse_seeds(it.next()?)?),
                "--out" => out = Some(PathBuf::from(it.next()?)),
                "--hash-monthly" => hash_monthly = true,
                "--data-dir" => dir = PathBuf::from(it.next()?),
                _ => return None,
            }
        }
        Some(RunArgs {
            years: years.filter(|&y| y > 0)?,
            seeds: seeds?,
            out,
            hash_monthly,
            dir,
        })
    }
}

/// `A..B` (inclusive) or `A`.
fn parse_seeds(s: &str) -> Option<(u64, u64)> {
    let (a, b) = match s.split_once("..") {
        Some((a, b)) => (a.parse().ok()?, b.parse().ok()?),
        None => {
            let a = s.parse().ok()?;
            (a, a)
        }
    };
    (a <= b).then_some((a, b))
}

fn run(args: &RunArgs) -> ExitCode {
    let data = match sim_data::load_world(&args.dir) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("error: {e}");
            return ExitCode::FAILURE;
        }
    };
    let end_year = sim::time::calendar::EPOCH_YEAR + args.years as i32;
    let end = DateTime::midnight(Date::ymd(end_year, 1, 1));
    let mut csv = format!("{METRICS_HEADER}\n");
    let (mut all_ticks, all_start) = (0u64, Instant::now());
    for seed in args.seeds.0..=args.seeds.1 {
        let mut sim = match Sim::new(data.clone(), seed) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("error: {e}");
                return ExitCode::FAILURE;
            }
        };
        let (seed_start, mut year_start) = (Instant::now(), Instant::now());
        let mut year_ticks = 0u64;
        let mut economy = YearEconomy::default();
        let mut tracking = YearTracking::default();
        let mut births = YearBirths::default();
        let mut distressed_seen = vec![false; sim.views().company_detail.get().companies.len()];
        while sim.now() < end {
            year_ticks += 1;
            for n in sim.step() {
                if let Notice::DayDone(_) = n {
                    tracking.add_day(&sim);
                }
                if let Notice::EarningsReleased(_) = n {
                    births.add_release(&sim);
                }
                let Notice::MonthDone(month) = n else {
                    continue;
                };
                economy.add_month(&sim);
                births.add_month(&sim, month.month);
                for c in &sim.views().company_detail.get().companies {
                    if c.id.index() >= distressed_seen.len() {
                        distressed_seen.resize(c.id.index() + 1, false);
                    }
                    if c.status == CompanyStatus::Distressed {
                        distressed_seen[c.id.index()] = true;
                    }
                }
                // The hash serializes the whole world (with M4's statement archives, about 4 MB),
                // so it is taken only when printed or written.
                if args.hash_monthly {
                    println!("seed {seed} {month} {}", sim.state_hash());
                }
                if month.month == 12 {
                    let hash = sim.state_hash();
                    let ms = year_start.elapsed().as_millis();
                    let cols = economy.columns(&sim);
                    let ops = operations_columns(&sim);
                    let seen = distressed_seen.iter().filter(|&&d| d).count();
                    let books = books_columns(&sim, month.year, seen);
                    let market = tracking.columns(&sim);
                    let m6 = births.columns(&sim, month.year);
                    distressed_seen.iter_mut().for_each(|d| *d = false);
                    writeln!(
                        csv,
                        "{seed},{},{year_ticks},{hash},{ms},{cols},{ops},{books},{market},{m6}",
                        month.year
                    )
                    .unwrap();
                    economy = YearEconomy::default();
                    tracking = YearTracking::default();
                    all_ticks += year_ticks;
                    year_ticks = 0;
                    year_start = Instant::now();
                }
            }
        }
        let secs = seed_start.elapsed().as_secs_f64();
        println!(
            "seed {seed}: {} years to {}, hash {}, {:.0} ms",
            args.years,
            sim.now(),
            sim.state_hash(),
            secs * 1000.0
        );
    }
    let secs = all_start.elapsed().as_secs_f64();
    println!(
        "{all_ticks} ticks in {:.0} ms: {:.0} ticks/s",
        secs * 1000.0,
        all_ticks as f64 / secs.max(f64::MIN_POSITIVE)
    );
    if let Some(path) = &args.out
        && let Err(e) = std::fs::write(path, csv)
    {
        eprintln!("error: {}: {e}", path.display());
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}
