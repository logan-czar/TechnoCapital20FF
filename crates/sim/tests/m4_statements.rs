//! Build-plan M4.2 against the live engine: quarterly and yearly statements, the synthetic Q4
//! 2019 and four history quarters at load (spec 3.9, 4.4, 4.5, 7.1) and the 20-quarter archive.
//!
//! Done line: golden statements for 5 sample companies. The expected Q4 2019 and 2019 lines are
//! finance-start.csv (the independent Python export of 3.9, 5.11, 5.12 and 7.1 on validate.py's
//! run rate and company-start.csv), with revenue, EBIT and EBITDA also derived here from the CSVs.
//! Arrowhead's R&D is spec 7.1's ($0.72M a year, the 2.8% Cash cow target less the engine's 1%
//! free R&D); the fixture's validate.py model gives it 2% free (design fix 208), so its R&D,
//! pre-tax and tax lines are worked from the spec instead.

mod common;
mod finance_common;

use common::data;
use common::ops::{company, run_to};
use finance_common::{FixtureRow, finance_start};
use sim::Sim;
use sim::finance::statements::{Ledger, Period, Statement};
use sim::time::{Date, Quarter};
use sim::world::World;

fn close(what: &str, actual: f64, expected: f64, rel: f64) {
    assert!(
        (actual - expected).abs() <= (rel * expected.abs().max(actual.abs())).max(1.0),
        "{what}: engine {actual} vs expected {expected}"
    );
}

/// Engine revenue sits within 1e-6 of companies.csv revenue (M2.6), so lines derived from it
/// agree to this relative tolerance.
const REL: f64 = 1.0e-5;
/// A barebones company's revenue a year: $100,000 of assets at turnover 1, productivity 100
/// and PC bonus +1 (7.1, 10.0.11.1; D107).
const BAREBONES_REVENUE_USD: f64 = 101_000.0;

fn quarter(year: i32, q: u8) -> Period {
    Period::Quarter(Quarter { year, q })
}

#[test]
fn synthetic_history_at_load_for_all_651() {
    let d = data();
    let sim = Sim::new(d.clone(), 1).unwrap();
    let w = sim.world();
    let rows = finance_start();
    for row in &rows {
        let c = &w.companies[company(w, row.id())];
        let qs = c.finance.quarters();
        // 7.1 History: four synthetic quarters; 4.4: Q4 2019 released on 2 January 2020.
        assert_eq!(qs.len(), 4, "{}", row.id());
        for (i, s) in qs.iter().enumerate() {
            assert_eq!(s.period, quarter(2019, i as u8 + 1));
            assert!(s.synthetic);
            assert_eq!(s.lines, qs[0].lines, "a flat history");
        }
        let y = c.finance.years();
        assert_eq!(y.len(), 1);
        assert_eq!(y[0].period, Period::Year(2019));
        let q4 = &qs[3];
        // Revenue ÷ 4 (4.4), from companies.csv; the barebones loadout (7.1, R below $0.1M) has
        // $100,000 of assets at the PC bonus +1, so $101,000 a year (D107).
        let csv_m = d
            .companies
            .rows
            .iter()
            .find(|x| x.id == row.id())
            .unwrap()
            .revenue_usd_m;
        let r = if csv_m < 0.1 {
            BAREBONES_REVENUE_USD
        } else {
            csv_m * 1.0e6
        };
        close(
            &format!("{} Q4 revenue", row.id()),
            q4.lines.revenue,
            r / 4.0,
            REL,
        );
        assert_eq!(y[0].lines.revenue, 4.0 * q4.lines.revenue);
        // A flat history buys back its depreciation (D228) and pays its tax in the quarter.
        assert_eq!(q4.lines.asset_purchases, q4.lines.depreciation);
        assert_eq!(q4.lines.tax_paid, q4.lines.tax);
        // The starting balance sheet: company-start.csv cash + book − line (3.5, 7.1).
        close(
            &format!("{} total assets", row.id()),
            q4.balance.total_assets,
            row.num("bs_total_assets"),
            1e-12,
        );
        close(
            &format!("{} equity", row.id()),
            q4.balance.equity,
            row.num("bs_equity"),
            1e-12,
        );
        // Interest and fees at the starting rating (the fixture's rating matches, M4.5).
        close(
            &format!("{} Q4 line interest", row.id()),
            q4.lines.line_interest,
            row.num("line_interest") / 4.0,
            1e-9,
        );
        close(
            &format!("{} Q4 interest income", row.id()),
            q4.lines.interest_income,
            row.num("interest_income") / 4.0,
            1e-9,
        );
    }
}

/// One fixture company's Q4 2019 against the fixture.
fn golden(w: &World, row: &FixtureRow, rd_year: f64) -> Statement {
    let id = row.id();
    let c = &w.companies[company(w, id)];
    let q4 = c.finance.quarters()[3];
    let l = &q4.lines;
    let what = |line: &str| format!("{id} Q4 2019 {line}");
    close(&what("revenue"), l.revenue, row.num("q4_revenue"), REL);
    close(
        &what("variable"),
        l.variable,
        row.num("variable") / 4.0,
        REL,
    );
    close(&what("R&D"), l.rd, rd_year / 4.0, REL);
    // EBIT + R&D: the operating lines before R&D (5.5), which the fixture and the engine both
    // hold at f × turnover × gross for fixed cash, depreciation and shared costs (7.1).
    close(
        &what("EBIT before R&D"),
        l.ebit() + l.rd,
        row.num("q4_ebit") + row.num("rd") / 4.0,
        REL,
    );
    close(
        &what("EBITDA − EBIT"),
        l.ebitda() - l.ebit(),
        row.num("depreciation") / 4.0,
        REL,
    );
    close(
        &what("interest expense"),
        l.interest_expense(),
        (row.num("line_interest") + row.num("line_fee")) / 4.0,
        1e-9,
    );
    close(
        &what("interest income"),
        l.interest_income,
        row.num("interest_income") / 4.0,
        1e-9,
    );
    q4
}

#[test]
fn golden_statements_for_five_sample_companies() {
    let d = data();
    let sim = Sim::new(d.clone(), 1).unwrap();
    let w = sim.world();
    let rows = finance_start();
    let row = |id: &str| rows.iter().find(|r| r.id() == id).unwrap();
    // CO-0002 (private, a drawn line), Andes Cobre (Mining, Chile, 312 bps home spread), Gulf
    // Coast Grid (Power utilities), Changcheng Grid (CC, a loss after interest): every line
    // against the fixture.
    for id in ["CO-0002", "CO-0179", "CO-0053", "CO-0044"] {
        let r = row(id);
        let q4 = golden(w, r, r.num("rd"));
        let what = |line: &str| format!("{id} Q4 2019 {line}");
        close(&what("EBIT"), q4.lines.ebit(), r.num("q4_ebit"), REL);
        close(&what("EBITDA"), q4.lines.ebitda(), r.num("q4_ebitda"), REL);
        close(
            &what("pre-tax"),
            q4.lines.pre_tax_income(),
            r.num("q4_pre_tax_income"),
            REL,
        );
        close(&what("tax"), q4.lines.tax, r.num("q4_tax"), REL);
        close(
            &what("net income"),
            q4.lines.net_income(),
            r.num("q4_net_income"),
            REL,
        );
        close(
            &what("operating cash"),
            q4.lines.operating_cash(),
            r.num("q4_operating_cash"),
            REL,
        );
        close(
            &what("net change"),
            q4.lines.net_cash_change(),
            r.num("q4_net_change"),
            REL,
        );
        // 2019 is the four quarters (4.5 step 1).
        let c = &w.companies[company(w, id)];
        let y = &c.finance.years()[0];
        close(&what("2019 tax"), y.lines.tax, r.num("tax"), REL);
        close(
            &what("2019 net income"),
            y.lines.net_income(),
            r.num("net_income"),
            REL,
        );
    }
    // Changcheng loses money after its CC-rate interest: no tax (5.11).
    let cc = &w.companies[company(w, "CO-0044")];
    assert!(cc.finance.quarters()[3].lines.pre_tax_income() < 0.0);
    assert_eq!(cc.finance.quarters()[3].lines.tax, 0.0);

    // Arrowhead (7.1): $40M revenue, paid R&D $0.72M a year (0.05 × 0.7 × 0.8 = 2.8% less 1%
    // free), no line, $80.4M of cash at base − 0.25% (5.12), Canada's 26.5% tax (country-economy).
    let r = row("CO-0001");
    let q4 = golden(w, r, 0.018 * 40.0e6);
    let canada = d
        .country_economy
        .rows
        .iter()
        .find(|e| e.iso3 == "CAN")
        .unwrap()
        .corp_tax_rate;
    let pti = q4.lines.ebit() + q4.lines.interest_income - q4.lines.interest_expense();
    close(
        "CO-0001 Q4 2019 pre-tax",
        q4.lines.pre_tax_income(),
        pti,
        1e-12,
    );
    close("CO-0001 Q4 2019 tax", q4.lines.tax, canada * pti, 1e-12);
    // EBIT after R&D about $1.6M a year (7.1), so $0.4M in the quarter.
    assert!(
        (4.0 * q4.lines.ebit() - 1.6e6).abs() < 0.05e6,
        "Arrowhead EBIT {}",
        4.0 * q4.lines.ebit()
    );
    assert!((q4.balance.cash - 80.4e6).abs() < 0.01e6);
    assert_eq!(q4.balance.line_drawn, 0.0);
}

#[test]
fn quarters_sum_their_months_and_years_their_quarters() {
    let mut sim = Sim::new(data(), 2).unwrap();
    // Collect each company's three posted months of Q1 2020 as the monthly closes post them.
    let n = sim.world().companies.len();
    let mut months: Vec<Vec<Ledger>> = vec![Vec::new(); n];
    for m in [2u8, 3, 4] {
        run_to(&mut sim, Date::ymd(2020, m, 1));
        let w = sim.world();
        for (i, (_, c)) in w.companies.iter().enumerate() {
            if let Some(p) = c.finance.last_month {
                assert_eq!(p.month.month, m - 1);
                months[i].push(p.lines);
            }
        }
    }
    let w = sim.world();
    for (i, (_, c)) in w.companies.iter().enumerate() {
        if !c.finance.in_game() {
            continue;
        }
        let q1 = c.finance.quarters().last().unwrap();
        assert_eq!(q1.period, quarter(2020, 1), "{}", c.key);
        assert!(!q1.synthetic);
        assert_eq!(months[i].len(), 3, "{}", c.key);
        let sum = Ledger::sum(&months[i]);
        assert_eq!(q1.lines, sum, "{} Q1 2020 is its three months", c.key);
        // The close paid the quarter's tax (5.11): three accruals, paid once in March.
        assert_eq!(months[i][0].tax_paid + months[i][1].tax_paid, 0.0);
        if !c.finance.status().is_frozen() {
            assert!((q1.lines.tax_paid - q1.lines.tax).abs() < 1e-6, "{}", c.key);
            assert_eq!(q1.balance.tax_payable, 0.0, "{}", c.key);
        }
        // The closing balance sheet is the company's after the close.
        let bs = sim::finance::jobs::sheet(w, c);
        assert_eq!(q1.balance, bs, "{}", c.key);
    }
    // Run to the end of 2020: 2020 is the sum of its four quarters (4.5 step 1).
    run_to(&mut sim, Date::ymd(2021, 1, 1));
    let w = sim.world();
    for (_, c) in w.companies.iter() {
        if !c.finance.in_game() {
            continue;
        }
        let y = c.finance.years().last().unwrap();
        assert_eq!(y.period, Period::Year(2020), "{}", c.key);
        let qs = &c.finance.quarters()[c.finance.quarters().len() - 4..];
        let sum = Ledger::sum(qs.iter().map(|s| &s.lines));
        assert_eq!(y.lines, sum, "{}", c.key);
        assert_eq!(y.balance, qs[3].balance);
    }
}

#[test]
fn the_archive_keeps_twenty_quarters_and_five_years() {
    let mut sim = Sim::new(data(), 3).unwrap();
    run_to(&mut sim, Date::ymd(2026, 1, 1));
    let w = sim.world();
    let a = &w.companies[company(w, "CO-0001")];
    let qs = a.finance.quarters();
    // 4 synthetic + 24 closed quarters, the oldest 8 dropped (4.5 step 2).
    assert_eq!(qs.len(), 20);
    assert_eq!(qs[0].period, quarter(2021, 1));
    assert_eq!(qs[19].period, quarter(2025, 4));
    let ys = a.finance.years();
    assert_eq!(ys.len(), 5);
    assert_eq!(ys[0].period, Period::Year(2021));
    assert_eq!(ys[4].period, Period::Year(2025));
}
