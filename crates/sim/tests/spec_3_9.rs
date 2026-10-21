//! Spec 3.9 statements (light, 10.0.8), the 4.4 and 4.5 rollups, the 7.1 synthetic history and
//! the balance identity: build-plan M4.2 (golden statements for 5 sample companies) and the
//! helper M4.9 calls every month.

mod finance_common;

use finance_common::{
    BASE_RATE, CompanyFacts, FixtureRow, assert_close, data, facts, finance_start,
};
use sim::finance::balance::{BalanceSheet, Books, balance_sheet, check_identity, check_month};
use sim::finance::credit::{home_spread, line_limit, line_rate, monthly_charges};
use sim::finance::distress::CompanyStatus;
use sim::finance::rating::{Rating, StartRatingInputs, starting_rating};
use sim::finance::statements::{
    ARCHIVE_QUARTERS, KeyFigures, Ledger, Period, Statement, archive_push, quarter_statement,
    synthetic_history, trailing_four, year_statement,
};
use sim::finance::tax::{TaxBook, quarter_tax};
use sim::time::calendar::Quarter;

/// A tax book with `accrued` of tax payable.
fn payable(accrued: f64) -> TaxBook {
    TaxBook {
        accrued,
        ..TaxBook::default()
    }
}

fn key(rating: Rating) -> KeyFigures {
    KeyFigures {
        productivity: 100.0,
        pc_bonus: 2,
        labor_units: 392,
        held_tb: 8.6,
        free_rd_pct: 1,
        management_score: 34.0,
        rating,
        guidance: (0.0, 0.0),
    }
}

/// A month with every line set, as 4.3 steps 9 to 14 would post it.
fn sample_month() -> Ledger {
    Ledger {
        revenue: 10.0e6,
        variable: 5.0e6,
        fixed_cash: 3.5e6,
        rd: 0.3e6,
        shared: 0.05e6,
        depreciation: 0.1e6,
        line_interest: 0.2e6,
        line_fee: 0.01e6,
        interest_income: 0.04e6,
        asset_sale_gain: -0.15e6,
        tax: 0.2e6,
        tax_paid: 0.0,
        asset_purchases: 0.4e6,
        asset_sale_proceeds: 0.85e6,
        line_drawn_or_repaid: -0.5e6,
        shares_issued_net: 0.0,
        dividends: 0.3e6,
    }
}

#[test]
fn income_and_cash_flow_lines() {
    // 3.9 income: revenue; operating costs (variable, fixed cash); R&D; shared; depreciation;
    // EBIT; interest expense; interest income; (5.10 gain or loss on sales); pre-tax; tax; NI.
    let m = sample_month();
    let i = m.income();
    assert_close("operating costs", i.operating_costs, 8.5e6);
    assert_close("EBIT", i.ebit, 10.0e6 - 8.5e6 - 0.3e6 - 0.05e6 - 0.1e6);
    assert_close("EBITDA", m.ebitda(), 1.05e6 + 0.1e6);
    assert_close("interest expense", i.interest_expense, 0.21e6);
    assert_close(
        "pre-tax",
        i.pre_tax_income,
        1.05e6 - 0.21e6 + 0.04e6 - 0.15e6,
    );
    assert_close("net income", i.net_income, 0.73e6 - 0.2e6);
    // 3.9 cash flow: operating cash; purchases; sales; line; shares; dividends; net change.
    let c = m.cash_flow();
    // Operating cash = NI + depreciation − gain on sales + tax accrued − tax paid.
    assert_close(
        "operating cash",
        c.operating_cash,
        0.53e6 + 0.1e6 + 0.15e6 + 0.2e6 - 0.0,
    );
    assert_close(
        "net change",
        c.net_change,
        c.operating_cash - 0.4e6 + 0.85e6 - 0.5e6 + 0.0 - 0.3e6,
    );
    assert_close("book sold", m.book_sold(), 1.0e6);
    assert_close(
        "free cash flow",
        m.free_cash_flow(),
        c.operating_cash - 0.4e6,
    );
}

#[test]
fn a_quarter_sums_its_months_and_a_year_its_quarters() {
    let m = sample_month();
    let mut m2 = m;
    m2.revenue = 11.0e6;
    m2.tax_paid = 0.6e6;
    let m3 = Ledger {
        revenue: 9.0e6,
        ..m
    };
    let close = BalanceSheet::default();
    let q = quarter_statement(
        Quarter { year: 2020, q: 1 },
        &[m, m2, m3],
        close,
        key(Rating::A),
    );
    assert_eq!(q.period, Period::Quarter(Quarter { year: 2020, q: 1 }));
    assert!(!q.synthetic);
    assert_close("Q revenue", q.income().revenue, 30.0e6);
    assert_close("Q tax paid", q.lines.tax_paid, 0.6e6);
    assert_close(
        "Q net income",
        q.income().net_income,
        m.net_income() + m2.net_income() + m3.net_income(),
    );
    // A year is four quarters; balance and key figures are Q4's (4.5 step 1).
    let mut q4 = q;
    q4.period = Period::Quarter(Quarter { year: 2020, q: 4 });
    q4.key = key(Rating::Bbb);
    q4.balance.cash = 7.0;
    let y = year_statement(2020, &[q, q, q, q4]);
    assert_eq!(y.period, Period::Year(2020));
    assert_close("Y revenue", y.income().revenue, 120.0e6);
    assert_close("Y dividends", y.cash_flow().dividends, 3.6e6);
    assert_eq!(y.key.rating, Rating::Bbb);
    assert_eq!(y.balance.cash, 7.0);
}

#[test]
fn synthetic_history_is_a_quarter_of_the_run_rate() {
    // 4.4: the synthetic Q4 2019 is built from the starting run rate (revenue ÷ 4 and so on);
    // 7.1: four synthetic quarters at the run rate.
    let annual = sample_month().scaled(12.0);
    let start = balance_sheet(
        &Books {
            cash: 80.4e6,
            asset_book: 19.6e6,
            line_drawn: 0.0,
            tax: TaxBook::default(),
        },
        CompanyStatus::Active,
    );
    let h = synthetic_history(&annual, start, key(Rating::Aaa));
    for (i, s) in h.iter().enumerate() {
        assert_eq!(
            s.period,
            Period::Quarter(Quarter {
                year: 2019,
                q: i as u8 + 1
            })
        );
        assert!(s.synthetic);
        assert_eq!(s.balance, start);
        assert_close("quarter revenue", s.income().revenue, 30.0e6);
        assert_close("quarter EBIT", s.income().ebit, annual.ebit() / 4.0);
    }
    let y = year_statement(2019, &h);
    assert!(y.synthetic);
    assert_close("2019 revenue", y.income().revenue, annual.revenue);
    assert_close("2019 NI", y.income().net_income, annual.net_income());
    // TTM at load is the run rate.
    let ttm = trailing_four(&h).unwrap();
    assert_close("TTM EBITDA", ttm.ebitda(), annual.ebitda());
}

#[test]
fn trailing_four_and_the_archive() {
    let q = |rev: f64| Statement {
        period: Period::Quarter(Quarter { year: 2020, q: 1 }),
        lines: Ledger {
            revenue: rev,
            ..Ledger::default()
        },
        balance: BalanceSheet::default(),
        key: key(Rating::A),
        synthetic: false,
    };
    let six: Vec<Statement> = (1..=6).map(|i| q(f64::from(i))).collect();
    assert_eq!(trailing_four(&six).unwrap().revenue, 3.0 + 4.0 + 5.0 + 6.0);
    // Fewer than four (a company born in play) are annualized (D228).
    assert_eq!(trailing_four(&six[..2]).unwrap().revenue, (1.0 + 2.0) * 2.0);
    assert_eq!(trailing_four(&[]), None);
    // 4.5 step 2: keep 20 quarters, oldest dropped first.
    let mut archive = Vec::new();
    for i in 1..=25 {
        archive_push(&mut archive, q(f64::from(i)), ARCHIVE_QUARTERS);
    }
    assert_eq!(archive.len(), 20);
    assert_eq!(archive[0].lines.revenue, 6.0);
    assert_eq!(archive[19].lines.revenue, 25.0);
}

/// The run-rate year of one company: the fixture's operating lines with the engine's credit
/// line, cash interest and tax on top (5.11, 5.12, 7.1). Returns the ledger, the starting
/// balance sheet and the starting rating.
fn run_rate(f: &CompanyFacts<'_>, row: &FixtureRow) -> (Ledger, BalanceSheet, Rating) {
    let (cash, book, line) = (
        f.start.cash_usd,
        f.start.asset_book_usd,
        f.start.credit_drawn_usd,
    );
    let home = home_spread(f.zone_spread(), f.sovereign_spread());
    let rating = starting_rating(&StartRatingInputs {
        cash,
        line_drawn: line,
        ebitda: row.num("ebit") + row.num("depreciation"),
        revenue: row.num("revenue"),
        industry_key: &f.industry.id,
        sovereign: f.sovereign(),
        base_rate: BASE_RATE,
        home_spread: home,
    })
    .implied;
    let rate = line_rate(BASE_RATE, home, rating);
    let limit = line_limit(book, cash, line, rating);
    let c = monthly_charges(line, limit, cash, rate, BASE_RATE);
    let mut l = Ledger {
        revenue: row.num("revenue"),
        variable: row.num("variable"),
        fixed_cash: row.num("fixed_cash"),
        rd: row.num("rd"),
        shared: row.num("shared"),
        depreciation: row.num("depreciation"),
        line_interest: 12.0 * c.interest,
        line_fee: 12.0 * c.undrawn_fee,
        interest_income: 12.0 * c.cash_interest,
        ..Ledger::default()
    };
    // Each run-rate quarter pays tax on a quarter of the pre-tax income, no carryforward.
    let tax = 4.0 * quarter_tax(l.pre_tax_income() / 4.0, 0.0, f.economy.corp_tax_rate).tax;
    l.tax = tax;
    l.tax_paid = tax;
    // A flat history buys back its depreciation (D228).
    l.asset_purchases = l.depreciation;
    let start = balance_sheet(
        &Books {
            cash,
            asset_book: book,
            line_drawn: line,
            tax: TaxBook::default(),
        },
        CompanyStatus::Active,
    );
    (l, start, rating)
}

fn check_against_fixture(id: &str, f: &CompanyFacts<'_>, row: &FixtureRow, full: bool) {
    let (annual, start, rating) = run_rate(f, row);
    let h = synthetic_history(&annual, start, key(rating));
    let q4 = h[3];
    assert_eq!(q4.period, Period::Quarter(Quarter { year: 2019, q: 4 }));
    let i = q4.income();
    let cf = q4.cash_flow();
    let what = |line: &str| format!("{id} {line}");
    // Revenue, EBIT and EBITDA are checked against values derived here from the CSVs, not
    // against the fixture that supplied the lines. Revenue: companies.csv revenue_usd_m (the
    // $0.1M barebones floor of 7.1), a quarter of it.
    let r = f.company.revenue_usd_m.max(0.1) * 1.0e6;
    assert_eq!(i.revenue, r / 4.0, "{id} Q4 revenue");
    // EBITDA − EBIT is depreciation, the 5.10 decay on company-start.csv's gross assets:
    // asset_decay × max(0, gross − threshold), capped at the asset book (5.5).
    let ind = f.industry;
    let gross = f.start.gross_assets_usd;
    let decay = (ind.asset_decay * (gross - ind.asset_decay_threshold_usd).max(0.0))
        .min(f.start.asset_book_usd);
    assert!(
        (q4.lines.ebitda() - i.ebit - decay / 4.0).abs() < 1.0,
        "{id} Q4 EBITDA − EBIT {} vs decay ÷ 4 {}",
        q4.lines.ebitda() - i.ebit,
        decay / 4.0
    );
    // EBIT (5.5 at load, M 1.0): revenue less variable `R × (1 − margin − f)`, less fixed cash
    // + depreciation + shared, which 7.1's fixed cost rate holds at `f × turnover × gross`,
    // less paid R&D. Barebones companies (R below $0.1M) carry the loadout's $100,000 and are
    // left out.
    if f.company.revenue_usd_m >= 0.1 {
        let ebit = r * (ind.margin_full_use + ind.fixed_cost_share)
            - ind.fixed_cost_share * ind.asset_turnover * gross
            - row.num("rd");
        assert!(
            (i.ebit - ebit / 4.0).abs() < 1.0,
            "{id} Q4 EBIT {} vs {}",
            i.ebit,
            ebit / 4.0
        );
    }
    assert_close(
        &what("Q4 pre-tax"),
        i.pre_tax_income,
        row.num("q4_pre_tax_income"),
    );
    assert_close(&what("Q4 tax"), i.tax, row.num("q4_tax"));
    assert_close(
        &what("Q4 net income"),
        i.net_income,
        row.num("q4_net_income"),
    );
    assert_close(
        &what("Q4 operating cash"),
        cf.operating_cash,
        row.num("q4_operating_cash"),
    );
    assert_close(
        &what("Q4 net change"),
        cf.net_change,
        row.num("q4_net_change"),
    );
    let bs = q4.balance;
    assert_close(
        &what("total assets"),
        bs.total_assets,
        row.num("bs_total_assets"),
    );
    assert_close(
        &what("total liabilities"),
        bs.total_liabilities,
        row.num("bs_total_liabilities"),
    );
    assert_close(&what("equity"), bs.equity, row.num("bs_equity"));
    // 3.5 book_equity = cash + asset book − line drawn: company-start.csv rounds each column
    // to the dollar.
    assert!(
        (bs.equity - f.start.book_equity_usd).abs() <= 1.5,
        "{id} book equity {} vs {}",
        bs.equity,
        f.start.book_equity_usd
    );
    check_identity(&bs, CompanyStatus::Active).unwrap();
    if full {
        assert_close(&what("Q4 interest expense"), i.interest_expense, {
            (row.num("line_interest") + row.num("line_fee")) / 4.0
        });
        assert_close(&what("Q4 interest income"), i.interest_income, {
            row.num("interest_income") / 4.0
        });
        let y = year_statement(2019, &h);
        assert_close(&what("2019 revenue"), y.income().revenue, r);
        assert_close(&what("2019 EBIT"), y.income().ebit, 4.0 * i.ebit);
        assert_close(
            &what("2019 pre-tax"),
            y.income().pre_tax_income,
            row.num("pre_tax_income"),
        );
        assert_close(&what("2019 tax"), y.income().tax, row.num("tax"));
        assert_close(
            &what("2019 net income"),
            y.income().net_income,
            row.num("net_income"),
        );
        assert_close(
            &what("2019 operating cash"),
            y.cash_flow().operating_cash,
            row.num("operating_cash"),
        );
    }
}

#[test]
fn golden_statements_for_five_sample_companies() {
    // Arrowhead (Oil, Canada, cash, no line), CO-0002 (private, a drawn line sized to its 5.12
    // limit, D15), Andes Cobre (Mining, Chile, 312 bps home spread), Gulf Coast Grid (Power
    // utilities), Casa de Cambio La Frontera (B-, a loss after its line interest, no tax). Expected
    // values: the independent Python export (export_finance_fixtures.py).
    let d = data();
    let rows = finance_start();
    for id in ["CO-0001", "CO-0002", "CO-0179", "CO-0053", "CO-0016"] {
        let row = rows.iter().find(|r| r.id() == id).unwrap();
        check_against_fixture(id, &facts(&d, id), row, true);
    }
    // Arrowhead by hand from 7.1: $19.6M asset book, $80.4M cash, no line, $100M equity;
    // Q4 2019 revenue is $40M ÷ 4.
    let f = facts(&d, "CO-0001");
    let row = rows.iter().find(|r| r.id() == "CO-0001").unwrap();
    let (annual, start, _) = run_rate(&f, row);
    assert!((start.asset_book - 19.6e6).abs() < 0.01e6);
    assert!((start.cash - 80.4e6).abs() < 0.01e6);
    assert_eq!(start.line_drawn, 0.0);
    assert!((start.equity - 100.0e6).abs() < 1.0);
    assert_eq!(annual.revenue / 4.0, 10.0e6);
    // La Frontera earns an EBIT but loses money after its B- line interest: no tax in the quarter
    // (5.11). Since D16 no company starts rated CCC or CC with a drawn line.
    let f = facts(&d, "CO-0016");
    let row = rows.iter().find(|r| r.id() == "CO-0016").unwrap();
    let (annual, _, rating) = run_rate(&f, row);
    assert_eq!(rating, Rating::BMinus);
    assert!(annual.ebit() > 0.0);
    assert!(annual.pre_tax_income() < 0.0);
    assert_eq!(annual.tax, 0.0);
}

#[test]
fn synthetic_q4_2019_for_all_651() {
    let d = data();
    for row in finance_start() {
        let id = row.id().to_string();
        check_against_fixture(&id, &facts(&d, &id), &row, false);
    }
}

#[test]
fn balance_identity_active_and_bankrupt() {
    let books = Books {
        cash: 12.0e6,
        asset_book: 40.0e6,
        line_drawn: 30.0e6,
        tax: payable(0.5e6),
    };
    // Active: equity is the residual, no estate.
    let a = balance_sheet(&books, CompanyStatus::Active);
    assert_eq!(a.total_assets, 52.0e6);
    assert_eq!(a.total_liabilities, 30.5e6);
    assert_eq!((a.equity, a.estate), (21.5e6, 0.0));
    check_identity(&a, CompanyStatus::Active).unwrap();
    // Bankrupt (5.12 step 2): shareholders wiped, equity exactly 0; the residual sits on the
    // estate line, here a deficit, and the sheet still balances (D230).
    let deficit = Books {
        cash: -2.0e6,
        asset_book: 10.0e6,
        line_drawn: 30.0e6,
        tax: TaxBook::default(),
    };
    let b = balance_sheet(&deficit, CompanyStatus::Bankrupt);
    assert_eq!(b.equity, 0.0);
    assert_eq!(b.estate, -22.0e6);
    assert_eq!(b.total_assets, b.total_liabilities + b.estate + b.equity);
    check_identity(&b, CompanyStatus::Bankrupt).unwrap();
    // A Bankrupt sheet that still shows equity, or an Active one with an estate, fails.
    assert!(check_identity(&a, CompanyStatus::Bankrupt).is_err());
    assert!(check_identity(&b, CompanyStatus::Active).is_err());
    let mut broken = a;
    broken.total_assets += 1.0;
    assert!(check_identity(&broken, CompanyStatus::Active).is_err());
}

#[test]
fn month_check_rolls_every_balance_through_the_ledger() {
    let opening_books = Books {
        cash: 20.0e6,
        asset_book: 50.0e6,
        line_drawn: 10.0e6,
        tax: payable(0.3e6),
    };
    let m = sample_month();
    // Apply the month to the books the way steps 9 to 14 do.
    let closing_books = Books {
        cash: opening_books.cash + m.net_cash_change(),
        asset_book: opening_books.asset_book + m.asset_purchases - m.depreciation - m.book_sold(),
        line_drawn: opening_books.line_drawn + m.line_drawn_or_repaid,
        tax: payable(opening_books.tax_payable() + m.tax - m.tax_paid),
    };
    let open = balance_sheet(&opening_books, CompanyStatus::Active);
    let close = balance_sheet(&closing_books, CompanyStatus::Active);
    check_month(&open, &m, &close, CompanyStatus::Active).unwrap();
    // Equity moved by NI + shares − dividends.
    assert_close(
        "equity",
        close.equity - open.equity,
        m.net_income() - m.dividends,
    );
    // A cash movement that skipped the ledger is caught.
    let mut leaked = closing_books;
    leaked.cash += 1.0e6;
    let err = check_month(
        &open,
        &m,
        &balance_sheet(&leaked, CompanyStatus::Active),
        CompanyStatus::Active,
    )
    .unwrap_err();
    assert_eq!(err.line, "cash roll-forward");
    // So is a book change that skipped it.
    let mut leaked = closing_books;
    leaked.asset_book -= 1.0e6;
    let err = check_month(
        &open,
        &m,
        &balance_sheet(&leaked, CompanyStatus::Active),
        CompanyStatus::Active,
    )
    .unwrap_err();
    assert_eq!(err.line, "asset book roll-forward");
}

#[test]
fn month_check_through_the_wipe_and_a_frozen_month() {
    // The month a Distressed company goes Bankrupt: its residual moves from equity to the
    // estate, so equity + estate rolls forward through the month's NI (D230).
    let opening = Books {
        cash: 0.0,
        asset_book: 8.0e6,
        line_drawn: 10.0e6,
        tax: TaxBook::default(),
    };
    let m = Ledger {
        revenue: 1.0e6,
        variable: 0.8e6,
        fixed_cash: 0.6e6,
        line_interest: 0.1e6,
        asset_sale_gain: -0.3e6,
        asset_sale_proceeds: 1.7e6,
        line_drawn_or_repaid: 0.0,
        ..Ledger::default()
    };
    let closing = Books {
        cash: opening.cash + m.net_cash_change(),
        asset_book: opening.asset_book - m.book_sold(),
        line_drawn: opening.line_drawn,
        tax: TaxBook::default(),
    };
    let open = balance_sheet(&opening, CompanyStatus::Distressed);
    let close = balance_sheet(&closing, CompanyStatus::Bankrupt);
    assert_eq!(close.equity, 0.0);
    check_month(&open, &m, &close, CompanyStatus::Bankrupt).unwrap();
    // Frozen months post nothing and move nothing; the books still balance.
    check_month(&close, &Ledger::default(), &close, CompanyStatus::Bankrupt).unwrap();
}
