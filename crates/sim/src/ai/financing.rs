//! Financing (credit line only) and the dividend (spec 6.5, 5.17): draw for the quarter's planned
//! purchases, repay from cash well above min_cash, the Cautious or Greedy repay-first row, the
//! Brave row, then the dividend by `finance::dividends`.

use super::inputs::has;
use crate::finance::credit::{CreditLine, own_cash, plan_repay};
use crate::finance::distress::CompanyStatus;
use crate::finance::dividends::{DividendInputs, dividend, payout_ratio};
use crate::people::traits::Trait;

/// Spec 6.5: a Cautious or Greedy controller repays first, to at most 25% of the limit drawn,
/// before any dividend.
pub const REPAY_FIRST_DRAWN_SHARE: f64 = 0.25;
/// Spec 6.5: a Brave controller may keep up to 75% of the limit drawn to fund growth.
pub const BRAVE_DRAWN_SHARE: f64 = 0.75;

/// What 6.5 reads at the lock.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FinancingInputs<'a> {
    /// Cash on hand at the lock, USD.
    pub cash: f64,
    pub line: CreditLine,
    /// Spec 6 min_cash.
    pub min_cash: f64,
    /// The quarter's planned purchases at the locked g (`growth::quarter_purchases`); a sale
    /// (below 0) counts as 0 here, since its cash is not planned on.
    pub planned_purchases: f64,
    /// The traits the AI reads (none for a born company, 5.19.5).
    pub traits: &'a [Trait],
    /// Net income of the quarter just released (5.17).
    pub last_quarter_net_income: f64,
    /// The archetype's payout mult (6.1).
    pub archetype_payout_mult: f64,
    pub status: CompanyStatus,
}

/// The financing moves and the dividend set at the lock (spec 6.5, 5.17).
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Financing {
    /// Drawn on the line now, USD (cash and drawn both rise).
    pub draw: f64,
    /// Repaid now, USD (cash and drawn both fall).
    pub repay: f64,
    /// Paid now from cash, USD.
    pub dividend: f64,
}

/// The 6.5 rows (D265):
///
/// 1. **Draw**: cash after the quarter's planned purchases below min_cash draws the gap, up to
///    the undrawn limit. A draw never changes own cash (C10), so this row reads cash on hand.
/// 2. **Repay** (no draw): `finance::credit::plan_repay` on the cash left after the planned
///    purchases: own cash above 2 × min_cash and the line drawn repays
///    `min(drawn, own cash − 1.5 × min_cash)`.
/// 3. **Cautious or Greedy** controller (checked before Brave): repays at least down to 25% of
///    the limit, from cash above min_cash, and pays no dividend while more stays drawn.
/// 4. **Brave** controller: keeps up to 75% of the limit drawn, so row 2 repays only what is
///    drawn above 75%.
/// 5. **Dividend**: 5.17 (`finance::dividends::dividend`) with the payout ratio
///    `SECTOR_PAYOUT × archetype payout mult`, on the balances after the draw or repayment.
pub fn financing(i: &FinancingInputs<'_>) -> Financing {
    let purchases = i.planned_purchases.max(0.0);
    let cash_after = i.cash - purchases;
    let drawn = i.line.drawn.max(0.0);
    let repay_first = has(i.traits, Trait::Cautious) || has(i.traits, Trait::Greedy);
    let brave = has(i.traits, Trait::Brave);

    let mut out = Financing::default();
    if cash_after < i.min_cash {
        out.draw = (i.min_cash - cash_after).min(i.line.available()).max(0.0);
    } else if drawn > 0.0 {
        let mut repay = plan_repay(cash_after, drawn, i.min_cash);
        if repay_first {
            let excess = (drawn - REPAY_FIRST_DRAWN_SHARE * i.line.limit).max(0.0);
            let spare = (cash_after - i.min_cash).max(0.0);
            repay = repay.max(excess.min(spare));
        } else if brave {
            repay = repay.min((drawn - BRAVE_DRAWN_SHARE * i.line.limit).max(0.0));
        }
        out.repay = repay.min(drawn).max(0.0);
    }

    let cash = i.cash + out.draw - out.repay;
    let drawn_after = drawn + out.draw - out.repay;
    let blocked = repay_first && drawn_after > REPAY_FIRST_DRAWN_SHARE * i.line.limit;
    if !blocked {
        out.dividend = dividend(&DividendInputs {
            net_income: i.last_quarter_net_income,
            cash,
            line_drawn: drawn_after,
            min_cash: i.min_cash,
            payout_ratio: payout_ratio(i.archetype_payout_mult),
            status: i.status,
        });
    }
    out
}

/// Own cash after the moves (spec 5.12, C10), for checks.
pub fn own_cash_after(cash: f64, drawn: f64, f: &Financing) -> f64 {
    own_cash(
        cash + f.draw - f.repay - f.dividend,
        drawn + f.draw - f.repay,
    )
}
