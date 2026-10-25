// Port of crates/sim/tests/m4_tax.rs: build-plan M4.3 against the live engine: tax with unlimited
// loss carryforward, accrued monthly and paid at the quarter close (spec 5.11; D227). The formula
// cases (a loss year, ten years of carryforward, a loss month reversing an accrual) are lane F's
// spec_5_11; here a live company runs a loss quarter and the test follows 5.11 quarter by quarter.
//
// A test job gives Arrowhead (Canada, 26.5% in country-economy.csv) an extra cost in January 2020
// only, so Q1 2020 is a loss and the carryforward shields the next quarters. For each close the
// expected tax is max(0, pre-tax - carryforward used) x rate, with the carryforward kept here from
// the quarters' pre-tax income.
//
// Expects:
//   ../../src/lib.ts                simNew, simWorld, simRegisterTestJob
//   ../../src/finance/statements.ts ledgerPreTaxIncome(ledger)
//   ../../src/time/calendar.ts      simDateYmd, quarterFirstMonth, quarterNext
// Period::Quarter(q) is { kind: "Quarter", quarter: q }; CompanyFinance::quarters() is
// c.finance.archive.quarters.
//
// Changed from the Rust: the seed (7) feeds the new generator (D951). Arrowhead's income is the
// start data's run rate, only slightly moved by the cycle draws; the "shielded >= 2" and
// "taxed > 0" counts are tuned to the Rust run and may need a different seed or LOSS_USD if the
// new generator's cycle shifts Arrowhead's quarters. The println is dropped.
import { describe, expect, it } from "vitest";
import { ledgerPreTaxIncome } from "../../src/finance/statements.ts";
import { simNew, simRegisterTestJob, simWorld } from "../../src/lib.ts";
import { quarterFirstMonth, quarterNext, simDateYmd } from "../../src/time/calendar.ts";
import type { JobCtx } from "../../src/time/scheduler.ts";
import type { Quarter } from "../../src/types/calendar.ts";
import type { World } from "../../src/types/world.ts";
import { data, unwrap } from "./common/index.ts";
import { company, runTo } from "./common/ops.ts";

/** January 2020's extra cost, USD: several quarters of Arrowhead's pre-tax income. */
const LOSS_USD = 3.0e6;
let baseRate = 0;

function januaryLoss(w: World, ctx: JobCtx): void {
  const id = company(w, "CO-0001");
  const c = w.companies[id];
  const u = w.units[(c as NonNullable<typeof c>).units[0] as number];
  if (u === undefined) throw new Error("no unit");
  const d = ctx.facts.date;
  u.fixed_cost_rate =
    d.year === 2020 && d.month === 2 ? baseRate + (12.0 * LOSS_USD) / u.gross_assets : baseRate;
}

describe("m4 tax", () => {
  it("a_loss_quarter_carries_forward_and_tax_is_paid_at_each_close", { timeout: 300_000 }, () => {
    const d = data();
    const can = d.country_economy.rows.find((e) => e.iso3 === "CAN");
    if (can === undefined) throw new Error("no CAN row");
    const rate = can.corp_tax_rate;
    const sim = unwrap(simNew(d, 7), "Sim::new");
    const id = company(simWorld(sim), "CO-0001");
    const c0 = simWorld(sim).companies[id] as NonNullable<World["companies"][number]>;
    baseRate = (simWorld(sim).units[c0.units[0] as number] as NonNullable<World["units"][number]>)
      .fixed_cost_rate;
    simRegisterTestJob(sim, "MonthlyDemand", "test.january_loss", januaryLoss);

    let cf = 0.0;
    let shielded = 0;
    let taxed = 0;
    let q: Quarter = { year: 2020, q: 1 };
    while (q.year < 2023) {
      // Each month's accrual is the quarter-to-date tax less earlier months' (D227): watch the
      // payable over the quarter's three closes.
      const accrued: number[] = [];
      for (let m = 0; m < 3; m++) {
        const month = quarterFirstMonth(q).month + m;
        const [y, mo] = month === 12 ? [q.year + 1, 1] : [q.year, month + 1];
        runTo(sim, simDateYmd(y as number, mo as number, 1));
        const c = simWorld(sim).companies[id] as NonNullable<typeof c0>;
        accrued.push((c.finance.last_month as NonNullable<typeof c.finance.last_month>).lines.tax);
        if (m < 2) {
          // Unpaid until the close: the tax payable is the accrual so far.
          const soFar = accrued.reduce((a, b) => a + b, 0);
          expect(Math.abs(c.finance.tax.accrued - soFar) < 1e-6).toBe(true);
        }
      }
      const c = simWorld(sim).companies[id] as NonNullable<typeof c0>;
      const qs = c.finance.archive.quarters;
      const s = qs[qs.length - 1] as NonNullable<(typeof qs)[number]>;
      expect(s.period).toEqual({ kind: "Quarter", quarter: q });
      const pti = ledgerPreTaxIncome(s.lines);
      const used = Math.min(cf, Math.max(pti, 0.0));
      const tax = Math.max(pti - used, 0.0) * rate;
      cf = cf - used + Math.max(-pti, 0.0);
      const tag = `${q.year}Q${q.q}`;
      // The quarter's tax is the sum of its accruals, all paid at the close (5.11).
      expect(Math.abs(s.lines.tax - tax) < 1e-6, `${tag}: ${s.lines.tax} vs ${tax}`).toBe(true);
      expect(Math.abs(accrued.reduce((a, b) => a + b, 0) - tax) < 1e-6, tag).toBe(true);
      expect(Math.abs(s.lines.tax_paid - tax) < 1e-6, tag).toBe(true);
      expect(c.finance.tax.accrued, `${tag}: nothing left payable`).toBe(0.0);
      expect(Math.abs(c.finance.tax.carryforward - cf) < 1e-6, `${tag} carryforward`).toBe(true);
      if (q.year === 2020 && q.q === 1) {
        expect(pti < 0.0, `Q1 2020 is a loss: ${pti}`).toBe(true);
        expect(tax).toBe(0.0);
      } else if (used > 0.0) {
        shielded += 1;
      } else if (tax > 0.0) {
        taxed += 1;
      }
      q = quarterNext(q);
    }
    expect(shielded >= 2, "the carryforward shields more than one quarter").toBe(true);
    expect(taxed > 0, "and runs out").toBe(true);
    expect(cf).toBe(0.0);
  });
});
