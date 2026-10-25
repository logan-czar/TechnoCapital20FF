// Port of crates/sim/tests/m4_ledger.rs: build-plan M4.1 against the live engine: the monthly
// ledger in the 4.3 step order (steps 9 to 14). Done line: every line posts once a month.
//
// Each line of a posted month is checked against the spec formula written out here, on the World
// one tick before the monthly job (the month's opening balances) and the unit lines the job
// computed: step 9 the 5.5 lines, step 11 the 5.10 purchases and depreciation, step 12 the 5.12
// charges on the opening balances, step 13 the line movement and step 14 the 5.11 accrual on the
// month's pre-tax income. Between monthly closes nothing posts.
//
// Expects:
//   ../src/lib.ts                simNew, simStep, simNow, simWorld
//   ../src/finance/statements.ts ledgerPreTaxIncome(ledger)
//   ../src/time/calendar.ts      simDateYmd, dateTimeMidnight, dateTimeNext, simDateMonthOf,
//                                   monthPrev
// specSpread, cloneWorld and the status helpers are in ./common/finance_live.ts.
//
// Changed from the Rust: the seeds (5, 6) feed the new generator (D951). Every assertion is a
// formula check against the run's own World, so none depends on a particular draw.
import { describe, expect, it } from "vitest";
import { ledgerPreTaxIncome } from "../src/finance/statements.ts";
import { simNew, simNow, simStep, simWorld } from "../src/lib.ts";
import {
  dateTimeMidnight,
  dateTimeNext,
  monthPrev,
  simDateMonthOf,
  simDateYmd,
} from "../src/time/calendar.ts";
import { roundHalfAway } from "../src/types/num.ts";
import { cloneWorld, inGame, isFrozen, specSpread, statusOf } from "./common/finance_live.ts";
import { data, unwrap } from "./common/index.ts";
import { runTo } from "./common/ops.ts";

function near(what: string, a: number, b: number): void {
  expect(Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b), 1.0), `${what}: ${a} vs ${b}`).toBe(
    true,
  );
}

describe("m4 ledger", () => {
  it("every_line_posts_once_a_month_in_step_order", { timeout: 300_000 }, () => {
    const sim = unwrap(simNew(data(), 5), "Sim::new");
    // The tick on the 1st closes the month before: 1 March closes February and 1 May closes April
    // (ordinary months, tax only accrues); 1 April closes March and 1 July 2021 closes June,
    // quarter ends, where the 4.4 close then pays the quarter's tax.
    let quarterEnds = 0;
    for (const [y, m] of [
      [2020, 3],
      [2020, 4],
      [2020, 5],
      [2021, 2],
      [2021, 7],
    ] as [number, number][]) {
      const close = dateTimeMidnight(simDateYmd(y, m, 1));
      while (dateTimeNext(simNow(sim)) < close) simStep(sim);
      const before = cloneWorld(sim);
      simStep(sim);
      const w = simWorld(sim);
      const base = w.base_rate;
      let checked = 0;
      w.companies.forEach((c, id) => {
        const b = before.companies[id];
        if (b === undefined) throw new Error(`no company ${id}`);
        if (isFrozen(statusOf(b))) return;
        const posted = c.finance.last_month;
        if (posted === null) throw new Error(`${c.key}: a posted month`);
        expect(posted.month).toEqual(monthPrev(simDateMonthOf(simDateYmd(y, m, 1))));
        const l = posted.lines;
        const unitId = c.units[0] as number;
        const u = w.units[unitId];
        const bu = before.units[unitId];
        if (u === undefined || bu === undefined) throw new Error("no unit");
        // Step 9: the 5.5 lines of the unit, as the economy computed them this month.
        near("revenue", l.revenue, u.revenue_m);
        near("variable", l.variable, u.variable_m);
        near("fixed cash", l.fixed_cash, u.fixed_m);
        near("R&D", l.rd, u.rd_m);
        near("shared", l.shared, u.shared_m);
        // Step 11: depreciation is the month's decay off the book, capped at the book (5.5,
        // 5.10), and the purchases are gross x (d_eff + g) / 12 at the unit's locked growth plan
        // g (a sale below 0; a Distressed company buys nothing).
        const p = (w.industries[u.industry] as NonNullable<(typeof w.industries)[number]>).params;
        const decay = (p.asset_decay * Math.max(bu.gross_assets - p.asset_decay_threshold_usd, 0.0)) / 12.0;
        near("depreciation", l.depreciation, Math.min(decay, bu.asset_book));
        const distressed = statusOf(b) !== "Active";
        const plan = decay + (bu.gross_assets * bu.growth_plan) / 12.0;
        const want = distressed ? 0.0 : Math.max(plan, 0.0);
        expect(
          Math.abs(l.asset_purchases - want) <= 1e-9 * Math.max(bu.gross_assets, 1.0),
          `purchases: ${l.asset_purchases} vs ${want}`,
        ).toBe(true);
        // Step 12: interest, fee and cash interest on the opening balances (5.12), at base + home
        // spread (half the zone's effective spread, half the sovereign spread, rounded to whole
        // bps) + the corporate spread of the rating.
        const country = w.countries[c.hq_country] as NonNullable<(typeof w.countries)[number]>;
        const zone = w.zones[country.zone] as NonNullable<(typeof w.zones)[number]>;
        const zoneBps = roundHalfAway(zone.credit_spread * 1e4);
        const sovBps = roundHalfAway(country.sovereign_spread * 1e4);
        const home = roundHalfAway((zoneBps + sovBps) / 2.0) / 1e4;
        const rate = base + home + specSpread(b.finance.rating);
        const drawn = b.finance.line.drawn;
        const own = Math.max(b.cash_usd - drawn, 0.0);
        near("line interest", l.line_interest, (drawn * rate) / 12.0);
        near("undrawn fee", l.line_fee, (Math.max(b.finance.line.limit - drawn, 0.0) * 0.0025) / 12.0);
        near("interest on cash", l.interest_income, (own * (base - 0.0025)) / 12.0);
        // Step 13: the line moved by what the ledger says (5.12 auto-draw and repay), plus what
        // the month's plan lock drew or repaid (6.5, booked in `pending`, D125).
        near(
          "line drawn or repaid",
          l.line_drawn_or_repaid,
          c.finance.line.drawn - drawn + b.finance.pending.line_drawn_or_repaid,
        );
        // Step 14: the accrual is the quarter-to-date tax less earlier accruals (5.11, D227),
        // with the HQ country's rate.
        const qtd = b.finance.tax.quarter_pre_tax + ledgerPreTaxIncome(l);
        const cf = b.finance.tax.carryforward;
        const toDate = Math.max(qtd - Math.min(cf, Math.max(qtd, 0.0)), 0.0) * country.corp_tax_rate;
        near("tax accrued", l.tax, toDate - b.finance.tax.accrued);
        // The close pays the quarter's tax on its first day (4.4), else nothing is paid.
        if (m === 4 || m === 1 || m === 7 || m === 10) {
          near("tax paid", l.tax_paid, toDate);
          expect(c.finance.tax.accrued).toBe(0.0);
          quarterEnds += 1;
        } else {
          expect(l.tax_paid).toBe(0.0);
          near("tax payable", c.finance.tax.accrued, toDate);
        }
        checked += 1;
      });
      expect(checked > 600, `${checked} companies checked on ${y}-${m}-01`).toBe(true);
    }
    // Both quarter-end closes ran the tax-paid branch for every company checked.
    expect(quarterEnds > 1200, `${quarterEnds} quarter-end company-months checked`).toBe(true);
  });

  it("nothing_posts_between_monthly_closes", { timeout: 300_000 }, () => {
    const sim = unwrap(simNew(data(), 6), "Sim::new");
    runTo(sim, simDateYmd(2020, 2, 1));
    const posted = simWorld(sim).companies.map((c) => ({
      months: c.finance.months.length,
      last: structuredClone(c.finance.last_month),
      cash: c.cash_usd,
    }));
    // Every hour of February (the daily jobs, no release or lock in February): no finance line
    // moves and no month is posted.
    const stop = dateTimeMidnight(simDateYmd(2020, 2, 29));
    while (simNow(sim) < stop) {
      simStep(sim);
      simWorld(sim).companies.forEach((c, i) => {
        const p = posted[i];
        expect(c.finance.months.length).toBe(p?.months);
        expect(c.finance.last_month).toEqual(p?.last);
        expect(c.cash_usd).toBe(p?.cash);
      });
    }
    // One month posted at each close, then compiled at a quarter close: Jan, Feb, Mar posted on
    // 1 Feb, 1 Mar and 1 Apr, the quarter built on 1 Apr and the months cleared.
    runTo(sim, simDateYmd(2020, 3, 1));
    expect(simWorld(sim).companies.every((c) => !inGame(c) || c.finance.months.length === 2)).toBe(true);
    runTo(sim, simDateYmd(2020, 4, 1));
    for (const c of simWorld(sim).companies) {
      if (inGame(c)) {
        expect(c.finance.months.length, c.key).toBe(0);
        // The 651 hold the four synthetic 2019 quarters and Q1 2020; a company born at the 9
        // January lock holds Q1 2020 only.
        const want = c.origin.kind === "Born" ? 1 : 5;
        expect(c.finance.archive.quarters.length, c.key).toBe(want);
      }
    }
  });
});
