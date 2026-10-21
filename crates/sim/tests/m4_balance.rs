//! Build-plan M4.9, the spec M4 done line: the balance sheet balances every month for every
//! company still in the game, over a multi-year run of the live engine, Bankrupt companies
//! included (their residual on the estate line, D230).
//!
//! The test keeps its own opening sheet per company and, at every monthly close, reads the
//! closing balances straight from the World (cash, Σ asset book, line drawn, tax payable) and
//! the month the engine posted. It checks spec 3.9's identity, `total assets = total
//! liabilities + estate + equity` with equity 0 for a Bankrupt company, and rolls every balance
//! forward through the posted lines, so a balance that moved outside the ledger fails. The
//! engine's own run of the same check (`World::books_check`) must also report no failure.

mod common;

use common::data;
use sim::Sim;
use sim::finance::distress::CompanyStatus;
use sim::finance::statements::Ledger;
use sim::time::{Date, DateTime};
use sim::world::World;

/// The run: 10 years (120 monthly closes) for each seed.
const YEARS: i32 = 10;
const SEEDS: [u64; 3] = [1, 2, 3];
/// Absolute tolerance, USD, and relative to the company's largest balance (f64 sums of $1T books).
const TOL_USD: f64 = 0.01;
const TOL_REL: f64 = 1.0e-11;

/// One company's balance sheet lines, read from the World (spec 3.9; D227 tax payable, D230
/// estate).
#[derive(Debug, Clone, Copy)]
struct Sheet {
    cash: f64,
    book: f64,
    line: f64,
    tax_payable: f64,
    /// Equity plus estate: what the owners' roll-forward tracks across the wipe (D230).
    residual: f64,
    bankrupt: bool,
}

fn sheet(w: &World, i: usize) -> Sheet {
    let c = &w.companies.rows()[i];
    let book: f64 = c.units.iter().map(|&u| w.units[u].asset_book).sum();
    let line = c.finance.line.drawn;
    let tax_payable = c.finance.tax.accrued;
    let assets = c.cash_usd + book;
    let liabilities = line + tax_payable;
    Sheet {
        cash: c.cash_usd,
        book,
        line,
        tax_payable,
        residual: assets - liabilities,
        bankrupt: c.finance.status() == CompanyStatus::Bankrupt,
    }
}

fn tol(a: &Sheet, b: &Sheet) -> f64 {
    let scale = [a.cash, a.book, a.line, b.cash, b.book, b.line]
        .iter()
        .fold(0.0_f64, |m, x| m.max(x.abs()));
    TOL_USD.max(TOL_REL * scale)
}

/// The month check, written from spec 3.9 and the ledger's cash flow lines.
fn check(key: &str, open: &Sheet, m: &Ledger, close: &Sheet, sheet_view: (f64, f64)) {
    let t = tol(open, close);
    let ok = |what: &str, want: f64, got: f64| {
        assert!(
            (want - got).abs() <= t,
            "{key} {what}: expected {want}, found {got}"
        );
    };
    // Cash: + revenue − variable − fixed cash − R&D − shared − interest − fee + interest income
    // − tax paid − purchases + sale proceeds + line drawn (− repaid) + shares issued − dividends.
    let cash_change =
        m.revenue - m.variable - m.fixed_cash - m.rd - m.shared - m.line_interest - m.line_fee
            + m.interest_income
            - m.tax_paid
            - m.asset_purchases
            + m.asset_sale_proceeds
            + m.line_drawn_or_repaid
            + m.shares_issued_net
            - m.dividends;
    ok("cash", open.cash + cash_change, close.cash);
    // Book: + purchases − depreciation − book sold (proceeds − gain, 5.10).
    let book_sold = m.asset_sale_proceeds - m.asset_sale_gain;
    ok(
        "asset book",
        open.book + m.asset_purchases - m.depreciation - book_sold,
        close.book,
    );
    ok("line", open.line + m.line_drawn_or_repaid, close.line);
    ok(
        "tax payable",
        open.tax_payable + m.tax - m.tax_paid,
        close.tax_payable,
    );
    // Equity + estate: + net income + shares issued − dividends. Net income is revenue less
    // every cost line, interest, plus interest income and the sale gain, less tax (3.9, D229).
    let ni = m.revenue
        - m.variable
        - m.fixed_cash
        - m.rd
        - m.shared
        - m.depreciation
        - m.line_interest
        - m.line_fee
        + m.interest_income
        + m.asset_sale_gain
        - m.tax;
    ok(
        "equity + estate",
        open.residual + ni + m.shares_issued_net - m.dividends,
        close.residual,
    );
    // The engine's sheet (equity, estate) agrees: equity 0 when Bankrupt, no estate otherwise.
    let (equity, estate) = sheet_view;
    if close.bankrupt {
        assert_eq!(equity, 0.0, "{key} Bankrupt equity");
        ok("estate", close.residual, estate);
    } else {
        assert_eq!(estate, 0.0, "{key} estate");
        ok("equity", close.residual, equity);
    }
}

fn run(seed: u64) -> (u64, [usize; 3]) {
    let mut sim = Sim::new(data(), seed).unwrap();
    let n = sim.world().companies.len();
    let mut open: Vec<Sheet> = (0..n).map(|i| sheet(sim.world(), i)).collect();
    let end = DateTime::midnight(Date::ymd(2020 + YEARS, 1, 1));
    let (mut checked, mut bankrupt_months) = (0u64, 0usize);
    let mut ever_bankrupt = vec![false; n];
    while sim.now() < end {
        sim.step();
        let now = sim.now();
        if !(now.hour() == 0 && now.date().day == 1) {
            continue;
        }
        let w = sim.world();
        for i in 0..n {
            let c = &w.companies.rows()[i];
            if !c.finance.in_game() {
                continue;
            }
            let posted = c.finance.last_month.expect("a posted month");
            assert_eq!(posted.month, now.date().month_of().prev(), "{}", c.key);
            let close = sheet(w, i);
            let bs = sim::finance::jobs::sheet(w, c);
            check(
                &format!("{} {} seed {seed}", c.key, posted.month),
                &open[i],
                &posted.lines,
                &close,
                (bs.equity, bs.estate),
            );
            if close.bankrupt {
                bankrupt_months += 1;
                ever_bankrupt[i] = true;
            }
            open[i] = close;
            checked += 1;
        }
        // Removal at a release (the 2nd) takes a company out between two closes; its last
        // checked month stands.
    }
    let w = sim.world();
    assert_eq!(
        w.books_check.failures, 0,
        "engine check: {:?}",
        w.books_check.first_failure
    );
    let removed = w
        .companies
        .iter()
        .filter(|(_, c)| !c.finance.in_game())
        .count();
    (
        checked,
        [
            ever_bankrupt.iter().filter(|&&b| b).count(),
            bankrupt_months,
            removed,
        ],
    )
}

#[test]
fn every_company_balances_every_month_for_ten_years() {
    for seed in SEEDS {
        let (checked, [bankrupt, bankrupt_months, removed]) = run(seed);
        println!(
            "seed {seed}: {checked} company-months checked over {YEARS} years; {bankrupt} \
             companies went Bankrupt ({bankrupt_months} Bankrupt company-months checked on the \
             estate line), {removed} removed"
        );
        // The run is long enough to cover the whole walk: some companies are checked while
        // Bankrupt and some are removed (the M4.7 path on the starting data).
        assert!(bankrupt_months > 0 && removed > 0, "seed {seed}");
        assert!(checked >= 120 * 500, "seed {seed}: {checked}");
    }
}
