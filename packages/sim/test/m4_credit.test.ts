// Port of crates/sim/tests/m4_credit.rs: build-plan M4.4 against the live engine: the credit
// line's limit, home spread rate, interest, fees, interest on cash, auto-draw and repay, and the
// release-day review (spec 5.12, 5.1.2, C10, C23, 6.5).
//
// Done line: a Chilean company pays a 312 bps home spread. Andes Cobre (CO-0179, Santiago) sits
// in the Argentina zone (base 591 bps) with Chile's sovereign spread of 32 bps
// (financial-zones.csv, country-economy.csv): round((591 + 32) / 2) = 312 at load, where the base
// spread applies (D235); from the first step 12 the zone's effective spread does.
//
// Expects:
//   ../src/lib.ts           simNew, simStep, simNow, simWorld, simRegisterTestJob(sim, slot, name, job)
//   ../src/finance/jobs.ts  assetBook(world, company), companyHomeSpread(world, company, base)
//   ../src/finance/rating.ts ratingBand(r)
//   ../src/time/calendar.ts simDateYmd, dateTimeAt
//   ../src/finance/statements.ts ledgerOperatingCash(ledger)
// Test-job state that Rust kept in static atomics (f64 bits) is module-level variables here.
// CompanyFinance::quarters() is c.finance.archive.quarters; CreditLine::available is
// lineAvailable (./common/finance_live.ts).
//
// Changed from the Rust: the seeds (1, 2, 3) feed the new generator (D951). The assertions are
// formula checks against the World the run produced, so none depends on a particular draw; the
// println lines are dropped.
import { describe, expect, it } from "vitest";
import { assetBook, companyHomeSpread } from "../src/finance/jobs.ts";
import { ratingBand } from "../src/finance/rating.ts";
import { ledgerOperatingCash } from "../src/finance/statements.ts";
import { simNew, simNow, simRegisterTestJob, simStep, simWorld } from "../src/lib.ts";
import { dateTimeAt, simDateYmd } from "../src/time/calendar.ts";
import type { JobCtx } from "../src/time/scheduler.ts";
import type { Band } from "../src/types/state/finance.ts";
import type { World } from "../src/types/world.ts";
import { cloneWorld, isFrozen, lineAvailable, specSpread, statusOf } from "./common/finance_live.ts";
import { data, unwrap } from "./common/index.ts";
import { company, runTo } from "./common/ops.ts";
import { financeStart } from "./finance_common/index.ts";

/** Spec 5.12 rating factor by band (T). */
function specFactor(b: Band): number {
  switch (b) {
    case "Aaa":
      return 1.0;
    case "Aa":
      return 0.9;
    case "A":
      return 0.8;
    case "Bbb":
      return 0.65;
    case "Bb":
      return 0.5;
    case "B":
      return 0.3;
    case "Ccc":
    case "Cc":
      return 0.0;
  }
}

/** Spec 5.12 limit: max(0, 0.5 x asset_book + own cash) x rating factor, own cash = cash - drawn floored at 0 (C10). */
function specLimit(book: number, cash: number, drawn: number, b: Band): number {
  return Math.max(0.5 * book + Math.max(cash - drawn, 0.0), 0.0) * specFactor(b);
}

/** Andes Cobre's fixed cost rate at load. */
let chileRate = 0;

/**
 * Before step 9 each month: the Argentina zone's spread is held at its base (a quarter with no
 * zone effect, 5.1.2), so the home spread in play is 312 bps; in January Andes Cobre gets an
 * extra cost of its cash plus half its undrawn limit, so it draws on its line.
 */
function chileDraws(w: World, ctx: JobCtx): void {
  const id = company(w, "CO-0179");
  const c = w.companies[id];
  if (c === undefined) throw new Error("no CO-0179");
  const country = w.countries[c.hq_country];
  const zone = w.zones[country?.zone as number];
  if (zone === undefined) throw new Error("no zone");
  zone.credit_spread = zone.credit_spread_base;
  const u = w.units[c.units[0] as number];
  if (u === undefined) throw new Error("no unit");
  const d = ctx.facts.date;
  const extra = d.year === 2020 && d.month === 2 ? c.cash_usd + 0.5 * lineAvailable(c.finance.line) : 0.0;
  u.fixed_cost_rate = chileRate + (12.0 * extra) / u.gross_assets;
}

describe("m4 credit", () => {
  it("a_chilean_company_pays_312_bps", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    let w = simWorld(sim);
    const id = company(w, "CO-0179");
    let c = w.companies[id];
    if (c === undefined) throw new Error("no CO-0179");
    const country = w.countries[c.hq_country];
    if (country === undefined) throw new Error("no country");
    expect(country.key).toBe("CHL");
    // Load reads the zone's base spread (D235): round((591 + 32) / 2) = 312 bps.
    expect(w.zones[country.zone]?.credit_spread_base).toBe(0.0591);
    expect(country.sovereign_spread).toBe(0.0032);
    expect(companyHomeSpread(w, c, true)).toBe(0.0312);
    // The fixture's rate is base 3% + 312 bps + the starting rating's spread (5.12).
    const row = financeStart().find((r) => r.id() === "CO-0179");
    if (row === undefined) throw new Error("no fixture row");
    expect(row.num("home_spread_bps")).toBe(312.0);
    const start = row.rating("start_rating");
    expect(c.finance.rating).toBe(start);
    expect(Math.abs(row.num("line_rate") - (0.03 + 0.0312 + specSpread(start))) < 1e-12).toBe(true);

    // In play: with the zone at its base spread and a drawn line, February's interest is the
    // drawn line at 3% + 312 bps + the rating's spread, a twelfth of it (5.12 "Monthly").
    const u = w.units[c.units[0] as number];
    chileRate = (u as NonNullable<typeof u>).fixed_cost_rate;
    simRegisterTestJob(sim, "MonthlyDemand", "test.chile_draws", chileDraws);
    runTo(sim, simDateYmd(2020, 2, 1));
    w = simWorld(sim);
    c = w.companies[id] as NonNullable<typeof c>;
    const drawn = c.finance.line.drawn;
    expect(drawn > 0.0, "Andes Cobre drew on its line in January").toBe(true);
    const rating = c.finance.rating;
    runTo(sim, simDateYmd(2020, 3, 1));
    w = simWorld(sim);
    c = w.companies[id] as NonNullable<typeof c>;
    expect(companyHomeSpread(w, c, false)).toBe(0.0312);
    const l = (c.finance.last_month as NonNullable<typeof c.finance.last_month>).lines;
    const rate = 0.03 + 0.0312 + specSpread(rating);
    expect(
      Math.abs(l.line_interest - (drawn * rate) / 12.0) < 1e-6,
      `${l.line_interest} vs ${(drawn * rate) / 12.0}`,
    ).toBe(true);
  });

  it("starting_limits_for_all_651", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const w = simWorld(sim);
    for (const row of financeStart()) {
      const c = w.companies[company(w, row.id())];
      if (c === undefined) throw new Error(`no company ${row.id()}`);
      const want = specLimit(assetBook(w, c), c.cash_usd, c.finance.line.drawn, ratingBand(c.finance.rating));
      expect(Math.abs(c.finance.line.limit - want) < 1e-6, row.id()).toBe(true);
      expect(
        Math.abs(c.finance.line.limit - row.num("limit")) < 1e-6 * Math.max(want, 1.0),
        `${row.id()} limit ${c.finance.line.limit} vs fixture ${row.num("limit")}`,
      ).toBe(true);
    }
  });

  it("the_review_recomputes_every_limit", { timeout: 300_000 }, () => {
    const sim = unwrap(simNew(data(), 2), "Sim::new");
    for (const [y, m] of [
      [2020, 1],
      [2020, 4],
      [2021, 7],
    ] as const) {
      const review = dateTimeAt(simDateYmd(y, m, 2), 1);
      while (simNow(sim) < review) simStep(sim);
      const w = simWorld(sim);
      for (const c of w.companies) {
        if (isFrozen(statusOf(c))) continue;
        const f = c.finance;
        const want = specLimit(assetBook(w, c), c.cash_usd, f.line.drawn, ratingBand(f.rating));
        expect(Math.abs(f.line.limit - want) < 1e-6, `${c.key} ${y}-${m}`).toBe(true);
        // Over the new limit: 3 months to repay the excess (5.12 review, 10.0.9).
        const over = f.line.drawn > f.line.limit;
        expect(f.line.excess_months_left, c.key).toBe(over ? 3 : 0);
      }
    }
  });

  // The test company's fixed cost rate at load.
  let baseRate = 0;
  // Arrowhead's January extra cost: its cash plus $10M, so it draws about $10M; March's credit (a
  // negative cost) puts it far above twice min_cash, so the plan repays (6.5).
  const JANUARY_COST = 80.4e6 + 10.0e6;
  const MARCH_CREDIT = 30.0e6;

  function drawThenRepay(w: World, ctx: JobCtx): void {
    const id = company(w, "CO-0001");
    const c = w.companies[id];
    const u = w.units[(c as NonNullable<typeof c>).units[0] as number];
    if (u === undefined) throw new Error("no unit");
    const d = ctx.facts.date;
    let extra = 0.0;
    if (d.year === 2020 && d.month === 2) extra = JANUARY_COST;
    else if (d.year === 2020 && d.month === 4) extra = -MARCH_CREDIT;
    u.fixed_cost_rate = baseRate + (12.0 * extra) / u.gross_assets;
  }

  it("auto_draw_then_the_plan_repays", () => {
    const sim = unwrap(simNew(data(), 3), "Sim::new");
    const id = company(simWorld(sim), "CO-0001");
    const c0 = simWorld(sim).companies[id] as NonNullable<World["companies"][number]>;
    baseRate = (simWorld(sim).units[c0.units[0] as number] as NonNullable<World["units"][number]>)
      .fixed_cost_rate;
    simRegisterTestJob(sim, "MonthlyDemand", "test.draw_then_repay", drawThenRepay);
    // January: cash below 0 after the month draws the shortfall, up to the limit (5.12).
    runTo(sim, simDateYmd(2020, 1, 31));
    let before = cloneWorld(sim);
    runTo(sim, simDateYmd(2020, 2, 1));
    let w = simWorld(sim);
    let c = w.companies[id] as NonNullable<typeof c0>;
    let l = (c.finance.last_month as NonNullable<typeof c.finance.last_month>).lines;
    let b = before.companies[id] as NonNullable<typeof c0>;
    const cashAfterMonth = b.cash_usd + ledgerOperatingCash(l) - l.asset_purchases + l.asset_sale_proceeds;
    expect(cashAfterMonth < 0.0).toBe(true);
    expect(-cashAfterMonth < b.finance.line.limit, "within the limit").toBe(true);
    expect(Math.abs(l.line_drawn_or_repaid + cashAfterMonth) < 1e-6, "draws the shortfall").toBe(true);
    expect(Math.abs(c.finance.line.drawn + cashAfterMonth) < 1e-6).toBe(true);
    expect(Math.abs(c.cash_usd) < 1e-6).toBe(true);
    // February: own cash is 0 (cash - drawn, C10), so the plan repays nothing; a month that ends
    // short draws again.
    runTo(sim, simDateYmd(2020, 3, 1));
    c = simWorld(sim).companies[id] as NonNullable<typeof c0>;
    expect(
      (c.finance.last_month as NonNullable<typeof c.finance.last_month>).lines.line_drawn_or_repaid >= 0.0,
    ).toBe(true);
    expect(c.cash_usd >= 0.0).toBe(true);
    // March: the credit lifts own cash above 2 x min_cash; the plan repays min(drawn, own cash -
    // 1.5 x min_cash) (6.5), min_cash 5% of trailing revenue (6).
    before = cloneWorld(sim);
    runTo(sim, simDateYmd(2020, 4, 1));
    w = simWorld(sim);
    c = w.companies[id] as NonNullable<typeof c0>;
    b = before.companies[id] as NonNullable<typeof c0>;
    // March closes on 1 April, a quarter end: the posted month carries the quarter's tax paid at
    // the close, after the settle, so it is added back for the cash the settle saw.
    l = (c.finance.last_month as NonNullable<typeof c.finance.last_month>).lines;
    const qs = b.finance.archive.quarters;
    let ttm = 0;
    for (const s of qs.slice(qs.length - 4)) ttm += s.lines.revenue;
    const minCash = 0.05 * ttm;
    const drawn = b.finance.line.drawn;
    const cash = b.cash_usd + ledgerOperatingCash(l) + l.tax_paid - l.asset_purchases + l.asset_sale_proceeds;
    const own = Math.max(cash - drawn, 0.0);
    expect(own > 2.0 * minCash).toBe(true);
    const repay = Math.min(drawn, own - 1.5 * minCash);
    expect(Math.abs(l.line_drawn_or_repaid + repay) < 1e-6, `${l.line_drawn_or_repaid} vs ${repay}`).toBe(
      true,
    );
    expect(Math.abs(c.finance.line.drawn - (drawn - repay)) < 1e-6).toBe(true);
  });
});
