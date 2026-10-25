// Port of crates/sim/tests/m6_births.rs: build-plan M6.6 to M6.8 on the live engine: random
// startup events at each plan lock (5.19.1), the fixed event F1 at its lock (5.19.2), and each
// startup carved from the fringe with its cap table, seed cash and seated cast (5.19.3, 5.19.4),
// registered in every table.
//
// Done lines: supply unchanged by a birth before PC bonuses; no empty labor seat. Expected values
// come from the spec: the type table's ranges, the 2% fringe cap and $1M floor, Glut and Bust
// industries weighing 0, `gross = revenue x capital_per_dollar` out of the fringe, cash 0.5 x
// gross, founders 60% (the lead half of it, D270) and seed investors 40%, the lead founder as CEO
// and controller, the 6.1 archetype without the trait rows.
//
// Expects:
//   ../../src/lib.ts                simNew, simStep, simNow, simWorld, simViews, simRegisterTestJob
//   ../../src/births/state.ts       birthsStateInRegions(births, province, country_key, regions)
//                                   -> boolean   [BirthsState::in_regions]
//   ../../src/views/births.ts       birthsViewListBirths(view, since) -> BirthRow[]
//                                   [BirthsView::list_births]
//   ./common/births.ts              supplyBeforeBonus, isFrozen, sameDate (this lane)
//
// Changed from the Rust: the seeds (21, 22, 6) seed the new generator (D951), so which events,
// industries and births come out differs from the Rust run; every assertion is on the spec's
// ranges, rules and conservation laws, and the counts (births >= 8 in two years, 9 locks) are
// structural. The Rust SNAPS static Mutex is a per-test array. A world snapshot for the F1 test
// is a structuredClone (the World holds only plain data).
import { describe, expect, it } from "vitest";
import { birthsStateInRegions } from "../../src/births/state.ts";
import { simNew, simNow, simRegisterTestJob, simStep, simViews, simWorld } from "../../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../../src/time/calendar.ts";
import { type JobCtx, tickFactsIsLockTick } from "../../src/time/scheduler.ts";
import type { SimDate } from "../../src/types/calendar.ts";
import type { CompanyId, IndustryId, StartupEventId } from "../../src/types/ids.ts";
import type { EventType } from "../../src/types/state/births.ts";
import type { PhaseLabel, World } from "../../src/types/world.ts";
import { birthsViewListBirths } from "../../src/views/births.ts";
import { sameDate, sum, supplyBeforeBonus } from "./common/births.ts";
import { data, idRows, rowOf, unwrap } from "./common/index.ts";
import { runTo } from "./common/ops.ts";

/** Per lock: supply and fringe before the startup events, labels and fringe revenue after the fixed events. */
interface Snap {
  date: SimDate;
  supply_before: number[];
  fringe_before: number[];
  companies_before: number;
  labels: PhaseLabel[];
  fringe_revenue_after_fixed: number[];
  supply_after: number[];
  fringe_after: number[];
}

const industryIds = (w: World): IndustryId[] => w.industries.map((_, i) => i as IndustryId);

/** Spec 5.19.1 type table ranges: (revenue $M, full, partial). */
function typeRanges(t: EventType): [[number, number], [number, number], [number, number]] {
  switch (t) {
    case "GarageFounder":
      return [
        [5.0, 20.0],
        [1, 1],
        [1, 3],
      ];
    case "SpinOutTeam":
      return [
        [10.0, 50.0],
        [2, 3],
        [2, 4],
      ];
    case "HotCluster":
      return [
        [5.0, 30.0],
        [1, 2],
        [1, 3],
      ];
    case "BackedVenture":
      return [
        [30.0, 50.0],
        [3, 5],
        [3, 5],
      ];
  }
}

/** Spec 5.19.2 F1 to F3, the fixed events due by January 2022: (revenue $M, full, partial). */
function fixedRanges(id: string): [[number, number], [number, number], [number, number]] {
  switch (id) {
    case "F1":
      return [
        [5.0, 15.0],
        [2, 3],
        [1, 2],
      ];
    case "F2":
      return [
        [10.0, 40.0],
        [1, 2],
        [2, 4],
      ];
    case "F3":
      return [
        [5.0, 30.0],
        [1, 3],
        [1, 3],
      ];
    default:
      throw new Error(`${id} is not due before 2030`);
  }
}

/** Spec 5.19.2: the plan lock each of F1 to F3 fires at. */
function fixedDate(id: string): SimDate {
  if (id === "F1") return simDateYmd(2020, 4, 9);
  if (id === "F2") return simDateYmd(2021, 4, 9);
  return simDateYmd(2022, 1, 9);
}

describe("m6 births", () => {
  it("births_follow_5_19_on_the_live_engine", () => {
    const snaps: Snap[] = [];
    const last = (): Snap => {
      const s = snaps[snaps.length - 1];
      if (s === undefined) throw new Error("no snapshot yet");
      return s;
    };
    const sim = unwrap(simNew(data(), 21), "Sim::new");
    // Hourly alerts slot (before the plan lock in the same tick).
    simRegisterTestJob(sim, "Alerts", "test.before_lock", (w: World, ctx: JobCtx) => {
      if (!tickFactsIsLockTick(ctx.facts)) return;
      const ids = industryIds(w);
      snaps.push({
        date: ctx.facts.date,
        supply_before: ids.map((i) => supplyBeforeBonus(w, i)),
        fringe_before: w.industries.map((i) => i.fringe_assets),
        companies_before: w.companies.length,
        labels: [],
        fringe_revenue_after_fixed: [],
        supply_after: [],
        fringe_after: [],
      });
    });
    // After the fixed events (registered after the built-in job in the same slot).
    simRegisterTestJob(sim, "LockFixedStartupEvents", "test.after_fixed", (w: World) => {
      const s = last();
      s.labels = w.industries.map((i) => i.phase_label);
      s.fringe_revenue_after_fixed = w.industries.map((i) => i.fringe_assets * i.params.asset_turnover);
    });
    // After the births and listings, before the Lite AI batch.
    simRegisterTestJob(sim, "LockIpoVotes", "test.after_births", (w: World) => {
      const s = last();
      s.supply_after = industryIds(w).map((i) => supplyBeforeBonus(w, i));
      s.fringe_after = w.industries.map((i) => i.fringe_assets);
    });
    const end = dateTimeMidnight(simDateYmd(2022, 1, 10));
    const bornNotices: CompanyId[] = [];
    const eventNotices: StartupEventId[] = [];
    while (simNow(sim) < end) {
      for (const n of simStep(sim)) {
        if (n.kind === "CompanyBorn") bornNotices.push(n.company);
        else if (n.kind === "StartupEvent") eventNotices.push(n.event);
      }
    }
    const w = simWorld(sim);
    expect(snaps.length, "the nine plan locks of 2020, 2021 and January 2022").toBe(9);

    // M6.8 done line: at every lock each industry's supply before PC bonuses is the same after
    // its births, and the fringe lost exactly the newborns' gross assets.
    let carves = 0;
    for (const s of snaps) {
      s.supply_before.forEach((a, i) => {
        const b = s.supply_after[i] as number;
        expect(
          Math.abs(a - b) <= 1e-9 * Math.max(a, 1.0),
          `${JSON.stringify(s.date)} industry ${i}: supply ${a} before, ${b} after`,
        ).toBe(true);
        // The fringe lost exactly the gross assets of the companies born there at this lock:
        // `revenue x capital_per_dollar` each (5.19.3).
        const industry = rowOf(w.industries, i as IndustryId);
        const carved = sum(
          w.companies
            .slice(s.companies_before)
            .filter((c) => c.industry === i && c.origin.kind === "Born" && sameDate(c.origin.date, s.date))
            .map((c) => c.revenue_usd * industry.params.capital_per_dollar),
        );
        const lost = (s.fringe_before[i] as number) - (s.fringe_after[i] as number);
        expect(
          Math.abs(lost - carved) <= 1e-6 * Math.max(carved, 1.0),
          `${JSON.stringify(s.date)} industry ${i}: fringe lost ${lost}, births carved ${carved}`,
        ).toBe(true);
        if (carved > 0.0) carves += 1;
      });
    }
    expect(carves).toBeGreaterThan(0);

    // Every born company, against 5.19.3 and 5.19.4.
    const born: CompanyId[] = idRows<CompanyId, (typeof w.companies)[number]>(w.companies)
      .filter(([, c]) => c.origin.kind === "Born")
      .map(([id]) => id);
    expect(born.length, `${born.length} births in two years`).toBeGreaterThanOrEqual(8);
    expect(bornNotices, "one company_born notice each, in order").toEqual(born);
    const names = w.companies.map((c) => c.name);
    expect(new Set(names).size, "company names are unique").toBe(names.length);
    let randomEvents = 0;
    for (const e of w.births.events) {
      expect(eventNotices).toContain(e.id);
      const snap = snaps.find((s) => sameDate(s.date, e.date));
      if (snap === undefined) throw new Error("no snapshot for the event's lock");
      let range: [number, number];
      let full: [number, number];
      let partial: [number, number];
      if (e.kind.kind === "Random") {
        const t = e.kind.event_type;
        randomEvents += 1;
        // Glut and Bust industries weigh 0 (5.19.1).
        for (const i of e.industries) {
          const label = snap.labels[i];
          expect(label !== "Glut" && label !== "Bust").toBe(true);
        }
        if (t === "HotCluster") {
          const first = rowOf(w.companies, e.companies[0] as CompanyId);
          for (const c of e.companies) expect(rowOf(w.companies, c).hq_province).toBe(first.hq_province);
          expect(e.companies.length >= 1 && e.companies.length <= 3).toBe(true);
        } else {
          expect(e.companies.length).toBe(1);
        }
        expect(e.industries.every((i) => i === e.industries[0])).toBe(true);
        [range, full, partial] = typeRanges(t);
      } else {
        expect(e.date, `${e.kind.id} fires at its plan lock`).toEqual(fixedDate(e.kind.id));
        [range, full, partial] = fixedRanges(e.kind.id);
      }
      for (const id of e.companies) {
        const c = rowOf(w.companies, id);
        const i = c.industry;
        // 5.19.3 size: the target log-uniform in the range, capped at 2% of the fringe's
        // revenue, skipped under $1M.
        const r = c.revenue_usd;
        expect(r >= 1.0e6 && r <= range[1] * 1e6 * (1.0 + 1e-12), `${c.key}: ${r}`).toBe(true);
        const cap = 0.02 * (snap.fringe_revenue_after_fixed[i] as number);
        expect(r >= range[0] * 1e6 * (1.0 - 1e-12) || r <= cap * (1.0 + 1e-9), c.key).toBe(true);
        // The cast (5.19.4): founders within the event's range; the lead founder is CEO and the
        // controller; every open labor seat held.
        const f = c.founders.length;
        expect(f >= full[0] && f <= full[1], `${c.key}: ${f} founders`).toBe(true);
        const lead = c.founders[0];
        expect(c.controller).toBe(lead);
        expect(c.board[0]).toEqual({ kind: "Full", character: lead });
        const open = Math.min(c.labor_units, 5);
        expect(
          c.board.slice(0, open).every((h) => h !== null),
          c.key,
        ).toBe(true);
        const partials =
          c.board.filter((h) => h !== null && h.kind === "Simple").length +
          c.directors.filter((d) => d.kind === "Simple").length;
        expect(partials, c.key).toBeGreaterThanOrEqual(Math.min(partial[0], open - 1));
        for (const ch of c.founders) {
          const fc = rowOf(w.characters, ch);
          expect(fc.tier).toBe("generated");
          // CH-0001 style key: the character's id plus one, four digits.
          expect(fc.key).toBe(`CH-${String(ch + 1).padStart(4, "0")}`);
          expect(fc.traits.length).toBe(3);
        }
        // The cap table (5.19.3, D270): founders 60%, the lead half of it when there are
        // several; seed investors the rest; it sums to shares_out.
        const total = sum(c.holders.map((h) => h.shares));
        if (c.public) continue;
        expect(total, c.key).toBe(c.shares_out);
        const s = c.shares_out;
        const leadShares = (c.holders[0] as { shares: number }).shares;
        expect(c.holders[0]?.holder).toEqual({ kind: "Founder", character: lead });
        const leadShare = f === 1 ? 0.6 : 0.3;
        // Each founder's shares round down (D270): off by under a share each.
        const rounding = (f + 1.0) / s;
        expect(Math.abs(leadShares / s - leadShare) <= rounding, c.key).toBe(true);
        const seed = c.holders[c.holders.length - 1];
        expect(seed?.holder).toEqual({ kind: "SeedInvestors" });
        expect(Math.abs((seed as { shares: number }).shares / s - 0.4) <= rounding, c.key).toBe(true);
        // The unit (5.19.3): gross = revenue x capital_per_dollar, book = gross, newly bought; its
        // company got a plan at the same lock (6, "new companies included").
        const u = rowOf(w.units, c.units[0] as (typeof c.units)[number]);
        expect(u.company).toBe(id);
        expect(c.plan !== null, `${c.key}: planned at its birth lock`).toBe(true);
        expect(w.market.stocks[id] !== undefined, "a stock row").toBe(true);
      }
    }
    expect(randomEvents, `${randomEvents} random events at 9 locks (mean 2 each)`).toBeGreaterThanOrEqual(8);

    // The views list the births (9.2 list_births) and the companies (list_companies).
    const v = simViews(sim);
    expect(birthsViewListBirths(v.births.data, simDateYmd(2020, 1, 1)).length).toBe(born.length);
    const rows = v.company_rows.data.rows;
    for (const id of born) {
      expect(
        rows.some((r) => r.id === id),
        "v_company_row lists a newborn",
      ).toBe(true);
    }
  });

  // The seed money and the books at birth (5.19.3): cash = 0.5 x gross, no line, assets =
  // liabilities + equity from the first month on (M4.9 counts no failure).
  it("a_newborn_opens_with_its_seed_round_and_balanced_books", () => {
    const sim = unwrap(simNew(data(), 22), "Sim::new");
    // F1 makes two AI labs at the 9 April 2020 lock (5.19.2).
    runTo(sim, simDateYmd(2020, 4, 9));
    const w = structuredClone(simWorld(sim));
    const f1 = w.births.events.find((e) => e.kind.kind === "Fixed" && e.kind.id === "F1");
    if (f1 === undefined) throw new Error("F1 fires at 9 April 2020");
    expect(f1.date).toEqual(simDateYmd(2020, 4, 9));
    expect(f1.companies.length).toBe(2);
    for (const id of f1.companies) {
      const c = rowOf(w.companies, id);
      const ind = rowOf(w.industries, c.industry);
      expect(ind.name).toBe("AI labs");
      // HQ in North America (startup-events.csv `@north-america`).
      expect(
        birthsStateInRegions(w.births, c.hq_province, rowOf(w.countries, c.hq_country).key, [
          { kind: "Superregion", slug: "north-america" },
        ]),
      ).toBe(true);
      const u = rowOf(w.units, c.units[0] as (typeof c.units)[number]);
      const gross = c.revenue_usd * ind.params.capital_per_dollar;
      expect(Math.abs(u.gross_assets - gross) < 1e-6 * gross).toBe(true);
      expect(u.asset_book).toBe(u.gross_assets);
      expect(u.ramping.length).toBe(0);
      expect(c.finance.line.drawn).toBe(0.0);
      // The Lite AI planned it in the same lock: Startup R&D and 6.5 moves only.
      const plan = c.plan;
      if (plan === null) throw new Error(`${c.key} has no plan`);
      const cash0 = 0.5 * gross;
      const moved = plan.financing.draw - plan.financing.repay - plan.financing.dividend;
      expect(Math.abs(c.cash_usd - (cash0 + moved)) < 1e-6, c.key).toBe(true);
      expect(["Startup", "Incumbent"]).toContain(c.archetype);
    }
    runTo(sim, simDateYmd(2020, 7, 2));
    const w2 = simWorld(sim);
    expect(w2.books_check.failures, `${w2.books_check.first_failure}`).toBe(0);
    for (const id of f1.companies) {
      const c = rowOf(w2.companies, id);
      expect(c.finance.archive.quarters.length, "Q2 2020 archived").toBe(1);
    }
  });

  // The tipped lab (5.1.1, D281): drawn at load among the five largest AI labs by starting revenue.
  it("the_tipped_lab_is_one_of_the_five_largest_labs", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const sim = unwrap(simNew(data(), seed), "Sim::new");
      const w = simWorld(sim);
      const labs = idRows<CompanyId, (typeof w.companies)[number]>(w.companies)
        .filter(([, c]) => rowOf(w.industries, c.industry).name === "AI labs")
        .map(([id, c]): [CompanyId, number] => [id, c.revenue_usd]);
      // Revenue descending, ties to the lower id (D2).
      labs.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      const top = labs.slice(0, 5).map(([id]) => id);
      const tipped = w.births.tipped_lab;
      expect(tipped, `seed ${seed}`).not.toBeNull();
      expect(top, `seed ${seed}`).toContain(tipped);
    }
  });
});
