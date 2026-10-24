//! The soak's read-only detail dump (`soak --detail`, D900): per-industry, per-zone and world
//! rows every year, and every company at the decade closes, for long-run economy reports. It
//! reads true figures from the world tables (`Sim::soak_world`, no estimate bands) and the
//! views, and never writes to the sim, so `years.csv`, `quarters.csv` and the state hashes are
//! the same with or without it. Everything is read in id order.

use std::fmt::Write as _;

use sim::Sim;
use sim::finance::distress::CompanyStatus;
use sim::time::Date;
use sim::time::calendar::EPOCH_YEAR;
use sim::world::{Ordinal, Origin};

/// `industries.csv`: one row per seed, year and industry (industry id order), at the December
/// close. Revenue columns are the year's twelve month closes; the share columns read last
/// month's unit revenue (spec 5.4).
pub const INDUSTRIES_HEADER: &str = "seed,year,industry,trend_growth,lt,q_growth,label,\
    trend_demand,demand,supply,s,m,fringe_assets,named_revenue_year,fringe_revenue_year,\
    named_share,companies,active,distressed,quoted,born_alive,births_in_year,\
    bankruptcies_in_year,top1_share,top4_share,top10_share,hhi,mean_productivity,\
    named_gross_assets,fair_value,market_cap";

/// `companies.csv`: every company not Removed, at the closes of 2020 and of every tenth year
/// (2029, 2039, ...). TTM figures sum the last four quarterly statements.
pub const COMPANIES_HEADER: &str = "seed,year,id,name,industry,origin,born_year,status,quoted,\
    exchange,country,archetype,revenue_ttm,ebit_ttm,net_income_ttm,dividends_ttm,cash,\
    line_drawn,line_limit,asset_book,equity,gross_assets,productivity,management,rating,\
    growth_plan,labor_units,price,shares,market_cap,fair_value";

/// `world.csv`: one row per seed and year with the world aggregates and the company
/// distribution (companies Active or Distressed with TTM revenue above 0).
pub const WORLD_HEADER: &str = "seed,year,ai_stage,pop_date,ai_labs_lt,base_rate,demand,\
    trend_demand,supply,companies_table,in_game,active,distressed,bankrupt,removed,start_alive,\
    born_alive,quoted,private_alive,births_total,bankruptcies_total,cash,line_drawn,equity,\
    gross_assets,fair_value_alive,market_cap,fair_value_quoted,rev_p10,rev_p50,rev_p90,rev_max,\
    margin_p10,margin_p50,margin_p90,ni_positive_share,top10_rev_share,hhi_mean,hhi_max,\
    top1_max,full_characters,characters_table,books_checked,books_failures";

/// `zones.csv`: one row per seed, year and zone exchange (zone id order).
pub const ZONES_HEADER: &str =
    "seed,year,exchange,level,quoted,market_cap,fair_value,confidence,credit_spread";

/// The detail tables of one seed (rows only, no headers).
#[derive(Default)]
pub struct Detail {
    pub industries: String,
    pub companies: String,
    pub world: String,
    pub zones: String,
}

/// The four detail files, in the order written: name, header, and the rows' field.
pub const FILES: [(&str, &str); 4] = [
    ("industries.csv", INDUSTRIES_HEADER),
    ("companies.csv", COMPANIES_HEADER),
    ("world.csv", WORLD_HEADER),
    ("zones.csv", ZONES_HEADER),
];

impl Detail {
    pub fn parts(&self) -> [&str; 4] {
        [&self.industries, &self.companies, &self.world, &self.zones]
    }
}

/// Builds the detail rows from month and year closes.
#[derive(Default)]
pub struct DetailRecorder {
    seed: u64,
    named_year: Vec<f64>,
    fringe_year: Vec<f64>,
    pub out: Detail,
}

/// Commas and quotes out of a free-text field (company names).
fn clean(s: &str) -> String {
    s.replace([',', '"'], " ")
}

/// The `q` quantile (nearest rank on sorted values); 0 when empty.
fn quantile(sorted: &[f64], q: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let i = ((sorted.len() - 1) as f64 * q).round() as usize;
    sorted[i.min(sorted.len() - 1)]
}

/// Top-k share and HHI of a list of revenues sorted biggest first.
fn concentration(sorted_desc: &[f64]) -> (f64, f64, f64, f64) {
    let total: f64 = sorted_desc.iter().sum();
    if total <= 0.0 {
        return (0.0, 0.0, 0.0, 0.0);
    }
    let top = |k: usize| sorted_desc.iter().take(k).sum::<f64>() / total;
    let hhi = sorted_desc.iter().map(|r| (r / total).powi(2)).sum::<f64>();
    (top(1), top(4), top(10), hhi)
}

/// The year's events: its own days, and the 1 January close that ends it (as books_columns).
fn in_year(d: Option<Date>, year: i32) -> bool {
    d.is_some_and(|d| d.year == year || d == Date::ymd(year + 1, 1, 1))
}

impl DetailRecorder {
    pub fn new(seed: u64) -> DetailRecorder {
        DetailRecorder {
            seed,
            ..DetailRecorder::default()
        }
    }

    /// A month close: adds the month's revenue per industry.
    pub fn month_close(&mut self, sim: &Sim) {
        let stats = sim.soak_stats().industries;
        self.named_year.resize(stats.len(), 0.0);
        self.fringe_year.resize(stats.len(), 0.0);
        for (i, t) in stats.iter().enumerate() {
            self.named_year[i] += t.named_revenue_m;
            self.fringe_year[i] += t.fringe_revenue_m;
        }
    }

    /// The December close of `year`.
    pub fn year_close(&mut self, sim: &Sim, year: i32) {
        let w = sim.soak_world();
        let seed = self.seed;
        let companies = w.companies.rows();
        let stocks = w.market.stocks.rows();
        let n_ind = w.industries.len();
        // Per company: gross assets, asset-weighted productivity, last month's revenue.
        let mut gross = vec![0.0; companies.len()];
        let mut prod_w = vec![0.0; companies.len()];
        for u in w.units.rows() {
            let i = u.company.index();
            gross[i] += u.gross_assets;
            prod_w[i] += u.gross_assets * u.productivity;
        }
        // TTM figures: (revenue, ebit, net income, dividends).
        let ttm: Vec<(f64, f64, f64, f64)> = companies
            .iter()
            .map(|c| {
                let q = c.finance.quarters();
                let last = &q[q.len().saturating_sub(4)..];
                last.iter().fold((0.0, 0.0, 0.0, 0.0), |a, s| {
                    let inc = s.income();
                    let cf = s.cash_flow();
                    (
                        a.0 + inc.revenue,
                        a.1 + inc.ebit,
                        a.2 + inc.net_income,
                        a.3 + cf.dividends,
                    )
                })
            })
            .collect();
        let equity = |c: &sim::world::Company| {
            c.finance
                .quarters()
                .last()
                .map_or(0.0, |s| s.balance.equity)
        };
        let status = |i: usize| companies[i].finance.status();
        let alive = |i: usize| !status(i).is_frozen();
        let cap = |i: usize| {
            let s = &stocks[i];
            if s.quoted {
                s.price * s.shares as f64
            } else {
                0.0
            }
        };
        let born_year = |c: &sim::world::Company| match c.origin {
            Origin::Start => None,
            Origin::Born { date, .. } => Some(date.year),
        };
        let views = sim.views();
        let births = views.births.get();
        let ranked = sim::views::industry_rows::companies_by_revenue(w);

        // Industries.
        let mut hhis = Vec::with_capacity(n_ind);
        let mut top1s = Vec::with_capacity(n_ind);
        for (id, ind) in w.industries.iter() {
            let k = id.index();
            let members: Vec<usize> = companies
                .iter()
                .enumerate()
                .filter(|(_, c)| c.industry == id && c.finance.in_game())
                .map(|(i, _)| i)
                .collect();
            let count = |s: CompanyStatus| members.iter().filter(|&&i| status(i) == s).count();
            let quoted = members.iter().filter(|&&i| stocks[i].quoted).count();
            let born_alive = members
                .iter()
                .filter(|&&i| alive(i) && born_year(&companies[i]).is_some())
                .count();
            let births_in_year = births
                .births
                .iter()
                .filter(|b| b.date.year == year && b.industry == id)
                .count();
            let bankruptcies = companies
                .iter()
                .filter(|c| c.industry == id && in_year(c.finance.bankrupt_on, year))
                .count();
            let revs: Vec<f64> = ranked[k].iter().map(|&(_, r)| r).collect();
            let (t1, t4, t10, hhi) = concentration(&revs);
            hhis.push(hhi);
            top1s.push(t1);
            let named_m: f64 = revs.iter().sum();
            let named_share = named_m / (named_m + ind.fringe_revenue_m).max(f64::MIN_POSITIVE);
            let live_units: Vec<_> = w
                .units
                .rows()
                .iter()
                .filter(|u| u.industry == id && u.gross_assets > 0.0 && alive(u.company.index()))
                .collect();
            let ga: f64 = live_units.iter().map(|u| u.gross_assets).sum();
            let mean_prod = live_units.iter().map(|u| u.productivity).sum::<f64>()
                / live_units.len().max(1) as f64;
            let fv: f64 = members.iter().map(|&i| stocks[i].fair_value).sum();
            let mc: f64 = members.iter().map(|&i| cap(i)).sum();
            writeln!(
                self.out.industries,
                "{seed},{year},{},{:.4},{:.4},{:.5},{},{:.6e},{:.6e},{:.6e},{:.4},{:.4},{:.6e},\
                 {:.6e},{:.6e},{named_share:.4},{},{},{},{quoted},{born_alive},{births_in_year},\
                 {bankruptcies},{t1:.4},{t4:.4},{t10:.4},{hhi:.4},{mean_prod:.2},{ga:.6e},\
                 {fv:.6e},{mc:.6e}",
                ind.key,
                ind.params.trend_growth,
                ind.lt,
                ind.q_growth,
                ind.phase_label.name(),
                ind.trend_demand,
                ind.demand,
                ind.supply,
                ind.supply_ratio,
                ind.market_factor,
                ind.fringe_assets,
                self.named_year.get(k).copied().unwrap_or(0.0),
                self.fringe_year.get(k).copied().unwrap_or(0.0),
                members.len(),
                count(CompanyStatus::Active),
                count(CompanyStatus::Distressed),
            )
            .unwrap();
        }

        // Companies, at the 2020 close and every tenth year.
        let years_run = year + 1 - EPOCH_YEAR;
        if year == EPOCH_YEAR || years_run % 10 == 0 {
            for (i, c) in companies.iter().enumerate() {
                if !c.finance.in_game() {
                    continue;
                }
                let s = &stocks[i];
                let exchange = s
                    .exchange
                    .and_then(|z| w.zones.get(z))
                    .map_or("", |z| z.exchange_code.as_str());
                let country = w.countries.get(c.hq_country).map_or("", |k| k.key.as_str());
                let (rev, ebit, ni, div) = ttm[i];
                let prod = if gross[i] > 0.0 {
                    prod_w[i] / gross[i]
                } else {
                    0.0
                };
                let growth = c
                    .units
                    .first()
                    .and_then(|&u| w.units.get(u))
                    .map_or(0.0, |u| u.growth_plan);
                writeln!(
                    self.out.companies,
                    "{seed},{year},{i},{},{},{},{},{:?},{},{exchange},{country},{:?},{rev:.6e},\
                     {ebit:.6e},{ni:.6e},{div:.6e},{:.6e},{:.6e},{:.6e},{:.6e},{:.6e},{:.6e},\
                     {prod:.2},{:.2},{},{growth:.4},{},{:.4},{},{:.6e},{:.6e}",
                    clean(&c.name),
                    w.industries.get(c.industry).map_or("", |d| d.key.as_str()),
                    if born_year(c).is_some() {
                        "born"
                    } else {
                        "start"
                    },
                    born_year(c).map_or(String::new(), |y| y.to_string()),
                    status(i),
                    u8::from(s.quoted),
                    c.archetype,
                    c.cash_usd,
                    c.finance.line.drawn,
                    c.finance.line.limit,
                    c.units
                        .iter()
                        .filter_map(|&u| w.units.get(u))
                        .map(|u| u.asset_book)
                        .sum::<f64>(),
                    equity(c),
                    gross[i],
                    c.management_score,
                    c.finance.rating.label(),
                    c.labor_units,
                    s.price,
                    s.shares,
                    cap(i),
                    s.fair_value,
                )
                .unwrap();
            }
        }

        // World.
        let alive_ids: Vec<usize> = (0..companies.len()).filter(|&i| alive(i)).collect();
        let count = |s: CompanyStatus| companies.iter().filter(|c| c.finance.status() == s).count();
        let start_alive = alive_ids
            .iter()
            .filter(|&&i| born_year(&companies[i]).is_none())
            .count();
        let quoted = stocks.iter().filter(|s| s.quoted).count();
        let sum = |f: &dyn Fn(usize) -> f64, ids: &[usize]| ids.iter().map(|&i| f(i)).sum::<f64>();
        let in_game: Vec<usize> = (0..companies.len())
            .filter(|&i| companies[i].finance.in_game())
            .collect();
        let mut revs: Vec<f64> = alive_ids
            .iter()
            .map(|&i| ttm[i].0)
            .filter(|&r| r > 0.0)
            .collect();
        revs.sort_by(f64::total_cmp);
        let mut margins: Vec<f64> = alive_ids
            .iter()
            .filter(|&&i| ttm[i].0 > 0.0)
            .map(|&i| ttm[i].1 / ttm[i].0)
            .collect();
        margins.sort_by(f64::total_cmp);
        let ni_pos = alive_ids.iter().filter(|&&i| ttm[i].2 > 0.0).count() as f64
            / alive_ids.len().max(1) as f64;
        let rev_total: f64 = revs.iter().sum();
        let top10: f64 = revs.iter().rev().take(10).sum::<f64>() / rev_total.max(f64::MIN_POSITIVE);
        let fv_quoted = sum(
            &|i| {
                if stocks[i].quoted {
                    stocks[i].fair_value
                } else {
                    0.0
                }
            },
            &alive_ids,
        );
        let hhi_mean = hhis.iter().sum::<f64>() / hhis.len().max(1) as f64;
        let hhi_max = hhis.iter().copied().fold(0.0, f64::max);
        let top1_max = top1s.iter().copied().fold(0.0, f64::max);
        let demand: f64 = w.industries.rows().iter().map(|d| d.demand).sum();
        let trend: f64 = w.industries.rows().iter().map(|d| d.trend_demand).sum();
        let supply: f64 = w.industries.rows().iter().map(|d| d.supply).sum();
        let bankruptcies_total = companies
            .iter()
            .filter(|c| c.finance.bankrupt_on.is_some())
            .count();
        writeln!(
            self.out.world,
            "{seed},{year},{},{},{:.4},{:.4},{demand:.6e},{trend:.6e},{supply:.6e},{},{},{},{},{},\
             {},{start_alive},{},{quoted},{},{},{bankruptcies_total},{:.6e},{:.6e},{:.6e},{:.6e},\
             {:.6e},{:.6e},{fv_quoted:.6e},{:.6e},{:.6e},{:.6e},{:.6e},{:.4},{:.4},{:.4},\
             {ni_pos:.4},{top10:.4},{hhi_mean:.4},{hhi_max:.4},{top1_max:.4},{},{},{},{}",
            w.ai.stage.name(),
            w.ai.pop_date,
            w.ai.ai_labs_lt,
            w.base_rate,
            companies.len(),
            in_game.len(),
            count(CompanyStatus::Active),
            count(CompanyStatus::Distressed),
            count(CompanyStatus::Bankrupt),
            count(CompanyStatus::Removed),
            alive_ids.len() - start_alive,
            alive_ids.iter().filter(|&&i| !stocks[i].quoted).count(),
            births.births.len(),
            sum(&|i| companies[i].cash_usd, &in_game),
            sum(&|i| companies[i].finance.line.drawn, &in_game),
            sum(&|i| equity(&companies[i]), &in_game),
            sum(&|i| gross[i], &in_game),
            sum(&|i| stocks[i].fair_value, &alive_ids),
            sum(&cap, &alive_ids),
            quantile(&revs, 0.1),
            quantile(&revs, 0.5),
            quantile(&revs, 0.9),
            revs.last().copied().unwrap_or(0.0),
            quantile(&margins, 0.1),
            quantile(&margins, 0.5),
            quantile(&margins, 0.9),
            births.full_characters,
            w.characters.len(),
            w.books_check.checked,
            w.books_check.failures,
        )
        .unwrap();

        // Zones.
        for (z, zone) in w.zones.iter() {
            let listed: Vec<usize> = (0..companies.len())
                .filter(|&i| stocks[i].quoted && stocks[i].exchange == Some(z))
                .collect();
            let mc = sum(&cap, &listed);
            let fv = sum(&|i| stocks[i].fair_value, &listed);
            let level = w
                .market
                .indices
                .get(z)
                .and_then(|x| x.level(mc))
                .map_or(String::new(), |l| format!("{l:.6e}"));
            writeln!(
                self.out.zones,
                "{seed},{year},{},{level},{},{mc:.6e},{fv:.6e},{:.3},{:.6}",
                zone.exchange_code,
                listed.len(),
                zone.confidence,
                zone.credit_spread,
            )
            .unwrap();
        }
        self.named_year.iter_mut().for_each(|v| *v = 0.0);
        self.fringe_year.iter_mut().for_each(|v| *v = 0.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn concentration_and_quantiles() {
        let (t1, t4, t10, hhi) = concentration(&[6.0, 3.0, 1.0]);
        assert!((t1 - 0.6).abs() < 1e-12 && (t4 - 1.0).abs() < 1e-12 && t10 == t4);
        assert!((hhi - 0.46).abs() < 1e-12);
        assert_eq!(concentration(&[]), (0.0, 0.0, 0.0, 0.0));
        assert_eq!(quantile(&[1.0, 2.0, 3.0], 0.5), 2.0);
        assert_eq!(quantile(&[], 0.5), 0.0);
        for h in [
            INDUSTRIES_HEADER,
            COMPANIES_HEADER,
            WORLD_HEADER,
            ZONES_HEADER,
        ] {
            assert!(
                h.split(',').all(|c| !c.is_empty() && !c.contains(' ')),
                "{h}"
            );
        }
    }
}
