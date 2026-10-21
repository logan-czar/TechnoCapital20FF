//! Statements (spec 3.9, light 10.0.8): the monthly ledger lines, the income statement, balance
//! sheet, cash flow and key figures built from them, quarterly and yearly rollups (4.4 Close and
//! compile, 4.5 step 1), the 20-quarter archive (4.5 step 2), trailing four quarters, and the
//! synthetic history at the starting run rate (4.4, 7.1).
//!
//! Every statement is a pure aggregation of [`Ledger`] lines: a quarter is the sum of its three
//! monthly ledgers and a year the sum of its four quarters, line by line.

use serde::{Deserialize, Serialize};

use super::balance::BalanceSheet;
use super::rating::Rating;
use crate::time::calendar::Quarter;

/// Quarters in a year (spec 4.4: accounting quarters are calendar quarters).
pub const QUARTERS_PER_YEAR: usize = 4;
/// Months in a quarter.
pub const MONTHS_PER_QUARTER: usize = 3;
/// A synthetic quarter is a quarter of the yearly run rate (spec 4.4 "revenue ÷ 4 and so on").
pub const RUN_RATE_QUARTER_SHARE: f64 = 0.25;
/// Spec 4.5 step 2: keep 20 quarters of statements.
pub const ARCHIVE_QUARTERS: usize = 20;
/// Years of yearly statements kept with them (20 quarters, D228).
pub const ARCHIVE_YEARS: usize = ARCHIVE_QUARTERS / QUARTERS_PER_YEAR;
/// The year of the synthetic history: four quarters of 2019, the last released on 2 January
/// 2020 as Q4 2019 (spec 4.4, 7.1).
pub const SYNTHETIC_YEAR: i32 = 2019;

/// One period's posted lines (spec 3.9; 4.3 steps 9 to 14). A month's ledger is posted at step
/// 14; a quarter's or year's is the line-by-line sum. All amounts USD, costs and outflows as
/// positive numbers.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct Ledger {
    // Income (3.9).
    pub revenue: f64,
    /// Operating cost: variable (5.5).
    pub variable: f64,
    /// Operating cost: fixed cash (5.5).
    pub fixed_cash: f64,
    /// Paid R&D (5.5).
    pub rd: f64,
    /// Compute, data compute and licences (3.8, 5.5).
    pub shared: f64,
    /// Depreciation, equal to the month's asset decay (5.5, 5.10).
    pub depreciation: f64,
    /// Interest on the drawn line (5.12).
    pub line_interest: f64,
    /// Undrawn fee (5.12); shown inside interest expense (D229).
    pub line_fee: f64,
    /// Interest on own cash (5.12).
    pub interest_income: f64,
    /// Gain (above 0) or loss on asset sales: `proceeds − book sold` (5.10; D229).
    pub asset_sale_gain: f64,
    /// Tax accrued (5.11, D227); may be below 0 in a month.
    pub tax: f64,
    // Cash flow (3.9).
    /// Tax paid (at the quarter close, 5.11).
    pub tax_paid: f64,
    /// Asset purchases at cost (5.10).
    pub asset_purchases: f64,
    /// Cash from asset sales (5.10, 5.12).
    pub asset_sale_proceeds: f64,
    /// Line drawn (above 0) or repaid (below 0) (5.12).
    pub line_drawn_or_repaid: f64,
    /// Shares issued, net of fees (6.6).
    pub shares_issued_net: f64,
    /// Dividends paid (5.17).
    pub dividends: f64,
}

impl Ledger {
    /// Operating costs: variable plus fixed cash (3.9).
    pub fn operating_costs(&self) -> f64 {
        self.variable + self.fixed_cash
    }

    /// EBIT: revenue less operating costs, R&D, shared costs and depreciation (3.9).
    pub fn ebit(&self) -> f64 {
        self.revenue - self.operating_costs() - self.rd - self.shared - self.depreciation
    }

    /// EBITDA = EBIT + depreciation (spec 5.12).
    pub fn ebitda(&self) -> f64 {
        self.ebit() + self.depreciation
    }

    /// Interest expense: line interest plus the undrawn fee (3.9, D229).
    pub fn interest_expense(&self) -> f64 {
        self.line_interest + self.line_fee
    }

    /// Pre-tax income: EBIT − interest expense + interest income + gain on sales (3.9, 5.10).
    pub fn pre_tax_income(&self) -> f64 {
        self.ebit() - self.interest_expense() + self.interest_income + self.asset_sale_gain
    }

    /// Net income: pre-tax income less tax (3.9).
    pub fn net_income(&self) -> f64 {
        self.pre_tax_income() - self.tax
    }

    /// Book value of assets sold: `proceeds − gain` (5.10).
    pub fn book_sold(&self) -> f64 {
        self.asset_sale_proceeds - self.asset_sale_gain
    }

    /// Operating cash (3.9): the cash lines of income (revenue less cash costs, interest paid
    /// and received) less tax paid. Equals net income + depreciation − gain on sales + tax
    /// accrued − tax paid.
    pub fn operating_cash(&self) -> f64 {
        self.revenue - self.operating_costs() - self.rd - self.shared - self.interest_expense()
            + self.interest_income
            - self.tax_paid
    }

    /// Free cash flow: operating cash less asset purchases (6.6 burn).
    pub fn free_cash_flow(&self) -> f64 {
        self.operating_cash() - self.asset_purchases
    }

    /// Net change in cash (3.9).
    pub fn net_cash_change(&self) -> f64 {
        self.operating_cash() - self.asset_purchases
            + self.asset_sale_proceeds
            + self.line_drawn_or_repaid
            + self.shares_issued_net
            - self.dividends
    }

    /// Line-by-line sum (a quarter of months, a year of quarters).
    pub fn plus(&self, o: &Ledger) -> Ledger {
        Ledger {
            revenue: self.revenue + o.revenue,
            variable: self.variable + o.variable,
            fixed_cash: self.fixed_cash + o.fixed_cash,
            rd: self.rd + o.rd,
            shared: self.shared + o.shared,
            depreciation: self.depreciation + o.depreciation,
            line_interest: self.line_interest + o.line_interest,
            line_fee: self.line_fee + o.line_fee,
            interest_income: self.interest_income + o.interest_income,
            asset_sale_gain: self.asset_sale_gain + o.asset_sale_gain,
            tax: self.tax + o.tax,
            tax_paid: self.tax_paid + o.tax_paid,
            asset_purchases: self.asset_purchases + o.asset_purchases,
            asset_sale_proceeds: self.asset_sale_proceeds + o.asset_sale_proceeds,
            line_drawn_or_repaid: self.line_drawn_or_repaid + o.line_drawn_or_repaid,
            shares_issued_net: self.shares_issued_net + o.shares_issued_net,
            dividends: self.dividends + o.dividends,
        }
    }

    /// Every line times `k` (a quarter of the run rate is `× 0.25`).
    pub fn scaled(&self, k: f64) -> Ledger {
        Ledger {
            revenue: self.revenue * k,
            variable: self.variable * k,
            fixed_cash: self.fixed_cash * k,
            rd: self.rd * k,
            shared: self.shared * k,
            depreciation: self.depreciation * k,
            line_interest: self.line_interest * k,
            line_fee: self.line_fee * k,
            interest_income: self.interest_income * k,
            asset_sale_gain: self.asset_sale_gain * k,
            tax: self.tax * k,
            tax_paid: self.tax_paid * k,
            asset_purchases: self.asset_purchases * k,
            asset_sale_proceeds: self.asset_sale_proceeds * k,
            line_drawn_or_repaid: self.line_drawn_or_repaid * k,
            shares_issued_net: self.shares_issued_net * k,
            dividends: self.dividends * k,
        }
    }

    /// The sum of several ledgers, in the order given.
    pub fn sum<'a>(items: impl IntoIterator<Item = &'a Ledger>) -> Ledger {
        items
            .into_iter()
            .fold(Ledger::default(), |acc, l| acc.plus(l))
    }

    /// The income statement (3.9).
    pub fn income(&self) -> IncomeStatement {
        IncomeStatement {
            revenue: self.revenue,
            variable: self.variable,
            fixed_cash: self.fixed_cash,
            operating_costs: self.operating_costs(),
            rd: self.rd,
            shared: self.shared,
            depreciation: self.depreciation,
            ebit: self.ebit(),
            interest_expense: self.interest_expense(),
            interest_income: self.interest_income,
            asset_sale_gain: self.asset_sale_gain,
            pre_tax_income: self.pre_tax_income(),
            tax: self.tax,
            net_income: self.net_income(),
        }
    }

    /// The cash flow statement (3.9).
    pub fn cash_flow(&self) -> CashFlowStatement {
        CashFlowStatement {
            operating_cash: self.operating_cash(),
            asset_purchases: self.asset_purchases,
            asset_sales: self.asset_sale_proceeds,
            line_drawn_or_repaid: self.line_drawn_or_repaid,
            shares_issued_net: self.shares_issued_net,
            dividends: self.dividends,
            net_change: self.net_cash_change(),
        }
    }
}

/// Income statement lines (spec 3.9), with the 5.10 gain or loss on sales above pre-tax income.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct IncomeStatement {
    pub revenue: f64,
    pub variable: f64,
    pub fixed_cash: f64,
    pub operating_costs: f64,
    pub rd: f64,
    pub shared: f64,
    pub depreciation: f64,
    pub ebit: f64,
    pub interest_expense: f64,
    pub interest_income: f64,
    pub asset_sale_gain: f64,
    pub pre_tax_income: f64,
    pub tax: f64,
    pub net_income: f64,
}

/// Cash flow lines (spec 3.9).
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct CashFlowStatement {
    pub operating_cash: f64,
    pub asset_purchases: f64,
    pub asset_sales: f64,
    pub line_drawn_or_repaid: f64,
    pub shares_issued_net: f64,
    pub dividends: f64,
    pub net_change: f64,
}

/// Key figures at the period end (spec 3.9), filled by the caller from the company's state.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct KeyFigures {
    pub productivity: f64,
    pub pc_bonus: u32,
    pub labor_units: u64,
    pub held_tb: f64,
    pub free_rd_pct: u32,
    pub management_score: f64,
    pub rating: Rating,
    /// Guidance range on next quarter's net income, low and high (5.16).
    pub guidance: (f64, f64),
}

/// The period a statement covers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Period {
    Quarter(Quarter),
    Year(i32),
}

/// One statement: the period's lines, the balance sheet at its end and the key figures
/// (spec 3.9).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Statement {
    pub period: Period,
    pub lines: Ledger,
    pub balance: BalanceSheet,
    pub key: KeyFigures,
    /// Built from the starting run rate (4.4, 7.1), not from posted ledgers.
    pub synthetic: bool,
}

impl Statement {
    pub fn income(&self) -> IncomeStatement {
        self.lines.income()
    }

    pub fn cash_flow(&self) -> CashFlowStatement {
        self.lines.cash_flow()
    }
}

/// A quarter's statement (spec 4.4 Close and compile): the sum of its three monthly ledgers, in
/// month order, with the balance sheet and key figures at the close.
pub fn quarter_statement(
    quarter: Quarter,
    months: &[Ledger; MONTHS_PER_QUARTER],
    closing: BalanceSheet,
    key: KeyFigures,
) -> Statement {
    Statement {
        period: Period::Quarter(quarter),
        lines: Ledger::sum(months),
        balance: closing,
        key,
        synthetic: false,
    }
}

/// A year's statement (spec 4.5 step 1): the sum of its four quarters in order; the balance sheet
/// and key figures are Q4's. Synthetic if any quarter is.
pub fn year_statement(year: i32, quarters: &[Statement; QUARTERS_PER_YEAR]) -> Statement {
    let last = quarters[QUARTERS_PER_YEAR - 1];
    Statement {
        period: Period::Year(year),
        lines: Ledger::sum(quarters.iter().map(|q| &q.lines)),
        balance: last.balance,
        key: last.key,
        synthetic: quarters.iter().any(|q| q.synthetic),
    }
}

/// The synthetic history (spec 4.4, 7.1): four quarters of 2019 at the starting run rate, each a
/// quarter of `annual` (revenue ÷ 4 and so on), all with the starting balance sheet and key
/// figures (D228). The last is the Q4 2019 statement released on 2 January 2020.
pub fn synthetic_history(
    annual: &Ledger,
    start: BalanceSheet,
    key: KeyFigures,
) -> [Statement; QUARTERS_PER_YEAR] {
    let lines = annual.scaled(RUN_RATE_QUARTER_SHARE);
    std::array::from_fn(|i| Statement {
        period: Period::Quarter(Quarter {
            year: SYNTHETIC_YEAR,
            q: (i + 1) as u8,
        }),
        lines,
        balance: start,
        key,
        synthetic: true,
    })
}

/// Trailing figures (spec 5.12 "trailing 4 quarters", 5.13 TTM, 6 ROA): the sum of the last
/// four quarterly statements. With fewer (a company born in play, 5.19) the available quarters
/// are annualized, `× 4 ÷ n`; `None` with none (D228).
pub fn trailing_four(quarters: &[Statement]) -> Option<Ledger> {
    let n = quarters.len().min(QUARTERS_PER_YEAR);
    if n == 0 {
        return None;
    }
    let sum = Ledger::sum(quarters[quarters.len() - n..].iter().map(|s| &s.lines));
    Some(if n == QUARTERS_PER_YEAR {
        sum
    } else {
        sum.scaled(QUARTERS_PER_YEAR as f64 / n as f64)
    })
}

/// Appends a statement to an archive kept oldest first, dropping the oldest past `keep`
/// (spec 4.5 step 2: [`ARCHIVE_QUARTERS`] quarters, [`ARCHIVE_YEARS`] years).
pub fn archive_push(archive: &mut Vec<Statement>, s: Statement, keep: usize) {
    archive.push(s);
    if archive.len() > keep {
        let extra = archive.len() - keep;
        archive.drain(..extra);
    }
}
