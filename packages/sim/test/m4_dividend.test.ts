// Port of crates/sim/tests/m4_dividend.rs: build-plan M4.8 and M6.3: the 5.17 dividend at the
// plan lock, paid by the live Lite AI batch. There is one dividend calculation (ai::financing,
// which calls finance::dividends); the batch pays it through finance::jobs::pay_dividend. Checked
// at the 9 January 2020 lock against the rule written from the spec, on the balances after the
// lock's 6.5 draw or repayment: payout ratio x NI of the quarter just released when NI is above
// 0, the company is Active and own cash after it stays above min_cash (6: 5% of trailing
// revenue), with payout ratio = 40% (the sector default, D234) x the 6.1 payout mult of the
// lock's archetype; all or nothing; a Cautious or Greedy controller pays none while more than 25%
// of its limit stays drawn (6.5). The cash leaves at the lock and the dividend posts in January's
// ledger, so the books still balance (M4.9).
//
// Expects:
//   ../src/lib.ts           simNew, simWorld (via ./common)
//   ../src/finance/statements.ts ledgerNetIncome(ledger)
//   ../src/time/calendar.ts simDateYmd
// CompanyFinance::quarters() is c.finance.archive.quarters.
//
// Changed from the Rust: the seed (9) feeds the new generator (D951). The dividend rule is
// checked per company against the plan the lock stored, whatever it drew, so no assertion depends
// on a particular draw. Which companies list at the lock (an IPO vote draw) varies; the cash
// check handles both cases, as in the Rust.
import { describe, expect, it } from "vitest";
import { ledgerNetIncome } from "../src/finance/statements.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import type { Archetype } from "../src/types/state/ai.ts";
import { cloneWorld, inGame, statusOf } from "./common/finance_live.ts";
import { data, unwrap } from "./common/index.ts";
import { company, runTo } from "./common/ops.ts";

/** Spec 6.1 payout mults (T). */
function specPayoutMult(a: Archetype): number {
  switch (a) {
    case "StateChampion":
    case "Incumbent":
      return 1.0;
    case "Startup":
      return 0.0;
    case "AggressiveGrower":
      return 0.5;
    case "CashCow":
      return 1.3;
  }
}

describe("m4 dividend", () => {
  it("the_dividend_rule_at_the_first_plan_lock", { timeout: 300_000 }, () => {
    const sim = unwrap(simNew(data(), 9), "Sim::new");
    runTo(sim, simDateYmd(2020, 1, 8));
    const before = cloneWorld(sim);
    runTo(sim, simDateYmd(2020, 1, 10));
    const after = cloneWorld(sim);
    let paying = 0;
    before.companies.forEach((c, id) => {
      const f = c.finance;
      const a = after.companies[id];
      if (a === undefined) throw new Error(`no company ${id}`);
      if (a.plan === null) throw new Error(`${c.key}: every company locks a plan`);
      const plan = a.plan;
      const qs = f.archive.quarters;
      const last = qs[qs.length - 1];
      if (last === undefined) throw new Error("no quarter");
      const ni = ledgerNetIncome(last.lines);
      let ttm = 0;
      for (const s of qs.slice(-4)) ttm += s.lines.revenue;
      const minCash = 0.05 * ttm;
      const cash = c.cash_usd + plan.financing.draw - plan.financing.repay;
      const drawn = f.line.drawn + plan.financing.draw - plan.financing.repay;
      const traits = c.controller === null ? [] : (before.characters[c.controller]?.traits ?? []);
      const repayFirst = traits.includes("Greedy") || traits.includes("Cautious");
      const blocked = repayFirst && drawn > 0.25 * f.line.limit;
      const d = 0.4 * specPayoutMult(a.archetype) * ni;
      const ownAfter = Math.max(cash - drawn, 0.0) - d;
      const want =
        statusOf(c) === "Active" && ni > 0.0 && d > 0.0 && ownAfter > minCash && !blocked ? d : 0.0;
      expect(
        Math.abs(plan.financing.dividend - want) < 1e-6,
        `${c.key}: paid ${plan.financing.dividend} want ${want}`,
      ).toBe(true);
      // Cash moved at the lock by the draw, repayment and dividend (D125), plus, for a company
      // that lists at this lock, its IPO's new money (5.20.1 listing step 3): the float sold at
      // open_price x 0.92, less 3% fees.
      let moved = plan.financing.draw - plan.financing.repay - plan.financing.dividend;
      let tolerance = 1e-6;
      if (!c.public && a.public) {
        const float = a.holders.find((h) => h.holder.kind === "PublicFloat");
        if (float === undefined) throw new Error("a listed company has a public float");
        const stock = after.market.stocks[id];
        if (stock === undefined) throw new Error("no stock");
        const net = float.shares * stock.ipo_price * 0.92 * 0.97;
        moved += net;
        // Up to rounding on the hundreds of millions raised (m6_ipo uses the same 1e-6 share).
        tolerance = 1e-6 * net;
      }
      expect(
        Math.abs(a.cash_usd - (c.cash_usd + moved)) < tolerance,
        `${c.key}: cash ${a.cash_usd} want ${c.cash_usd + moved}`,
      ).toBe(true);
      if (want > 0.0) paying += 1;
      if (a.archetype === "Startup") {
        expect(plan.financing.dividend, `${c.key}: a Startup never pays`).toBe(0.0);
      }
    });
    expect(paying > 0).toBe(true);

    // Arrowhead (7.1): a Cash cow with no line and $80M of cash, 0.40 x 1.3 = 52% of Q4 2019 NI.
    const a = company(before, "CO-0001");
    const bq = (before.companies[a] as NonNullable<(typeof before.companies)[number]>).finance.archive
      .quarters;
    const ni = ledgerNetIncome((bq[3] as NonNullable<(typeof bq)[number]>).lines);
    expect(ni > 0.0).toBe(true);
    const aa = after.companies[a] as NonNullable<(typeof after.companies)[number]>;
    expect(aa.archetype).toBe("CashCow");
    expect(Math.abs((aa.plan?.financing.dividend ?? Number.NaN) - 0.52 * ni) < 1e-6).toBe(true);

    // January's ledger posts the dividend on 1 February, and the books balance.
    runTo(sim, simDateYmd(2020, 2, 1));
    const w = simWorld(sim);
    w.companies.slice(0, before.companies.length).forEach((c, id) => {
      if (inGame(c)) {
        const d = after.companies[id]?.plan?.financing.dividend ?? Number.NaN;
        expect(Math.abs((c.finance.last_month?.lines.dividends ?? Number.NaN) - d) < 1e-6, c.key).toBe(true);
      }
    });
    expect(w.books_check.failures, `${w.books_check.first_failure}`).toBe(0);
  });
});
