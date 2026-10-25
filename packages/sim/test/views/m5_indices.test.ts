// Port of crates/sim/tests/m5_indices.rs: build-plan M5.6 on the live engine (spec 5.14; batches
// 152, 154; D250): 26 zone exchanges, each headline index the market-cap weighted level of its
// quoted companies, kept by a divisor so it does not jump when the constituents change.
//
// - A listing (5.20, as M6's IPOs will call it): at the 9 January 2020 plan lock a test job lists
//   two private companies, one on an exchange with listings and one on an exchange with none; the
//   first exchange's level is the same just before and just after, the empty one opens at 1,000.
//   A share issue (6.6) keeps the level too.
// - A delisting at bankruptcy (5.12 step 2, D126): Arrowhead (CO-0001, ATX) is squeezed into
//   bankruptcy as in m4_distress. Its exchange's level read at 4.3 step 12 and again at step 14 of
//   the bankruptcy month (prices do not move between them) is the same; its price is then $0.00,
//   it leaves the quotes and the index and never steps again.
// - The level is sum(P x shares) / divisor, written out here, every day.
//
// Expects:
//   ../../src/lib.ts              simNew, simStep, simNow, simWorld, simViews, simRegisterTestJob
//   ../../src/market/jobs.ts      indexLevel(world, zone) -> number | null,
//                                 listCompany(world, company, price, date) -> boolean,
//                                 setSharesOut(world, company, shares)
//   ../../src/finance/distress.ts companyStatusIsFrozen(status)
//   views: quotes.data.indices[].level, quotes.data.rows[].id, exchanges.data.exchanges[z].constituents
//   market state: s.bars.log (ChunkLog); "bars not empty" is barHistoryIsEmpty(bars) from
//   ../../src/market/state.ts
//   ./common/market.ts            specLevel (new, this lane)
//
// Changed from the Rust: statics are module variables; seeds 2 and 4 now seed the new generator
// (D951). The structural assertions hold for any draws; the bankruptcy test squeezes Arrowhead
// by its fixed cost rate, which does not depend on draws. Prints dropped.
import { describe, expect, it } from "vitest";
import { companyStatusIsFrozen } from "../../src/finance/distress.ts";
import { simNew, simNow, simRegisterTestJob, simStep, simViews, simWorld } from "../../src/lib.ts";
import { indexLevel, listCompany, setSharesOut } from "../../src/market/jobs.ts";
import { barHistoryIsEmpty } from "../../src/market/state.ts";
import { dateTimeHour, dateTimeMidnight, simDateYmd } from "../../src/time/calendar.ts";
import type { JobCtx } from "../../src/time/scheduler.ts";
import { dateEq } from "../../src/types/calendar.ts";
import type { CompanyId, ZoneId } from "../../src/types/ids.ts";
import { roundHalfAway } from "../../src/types/num.ts";
import type { World } from "../../src/types/world.ts";
import { data, unwrap } from "../common/index.ts";
import { specLevel } from "../common/market.ts";

/** Spec 5.14: the base level. */
const INDEX_BASE = 1000.0;

function near(a: number, b: number, what: string): void {
  expect(Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(b), 1.0), `${what}: ${a} vs ${b}`).toBe(true);
}

interface ListingSeen {
  listed: CompanyId;
  zone: ZoneId;
  before: number;
  after: number;
  empty_listed: [CompanyId, ZoneId, number | null, number | null] | null;
  issue_before: number;
  issue_after: number;
}

/** What the listing job saw. */
let listing: ListingSeen | null = null;

function listTwo(w: World, ctx: JobCtx): void {
  if (listing !== null) return;
  const hasListing = (z: ZoneId): boolean => w.market.stocks.some((s) => s.quoted && s.exchange === z);
  const zoneOf = (id: CompanyId): ZoneId =>
    (w.countries[(w.companies[id] as World["companies"][number]).hq_country] as World["countries"][number])
      .zone;
  const priv: CompanyId[] = [];
  w.companies.forEach((c, i) => {
    if (
      !c.public &&
      !companyStatusIsFrozen(c.finance.distress.status) &&
      (w.market.stocks[i] as World["market"]["stocks"][number]).exchange === null
    ) {
      priv.push(i as CompanyId);
    }
  });
  const first = priv.find((id) => hasListing(zoneOf(id)));
  if (first === undefined) throw new Error("a private company on an exchange with listings");
  const zone = zoneOf(first);
  const before = indexLevel(w, zone) as number;
  const stockOf = (id: CompanyId): World["market"]["stocks"][number] =>
    w.market.stocks[id] as World["market"]["stocks"][number];
  // Rust: value.max(5.0).round(), f64::round is half away from zero (values here are far from .5).
  const priceOf = (id: CompanyId): number => roundHalfAway(Math.max(stockOf(id).value, 5.0));
  expect(listCompany(w, first, priceOf(first), ctx.facts.date)).toBe(true);
  const after = indexLevel(w, zone) as number;
  const emptyId = priv.find((id) => !hasListing(zoneOf(id)));
  let emptyListed: ListingSeen["empty_listed"] = null;
  if (emptyId !== undefined) {
    const z = zoneOf(emptyId);
    const b = indexLevel(w, z);
    expect(listCompany(w, emptyId, priceOf(emptyId), ctx.facts.date)).toBe(true);
    emptyListed = [emptyId, z, b, indexLevel(w, z)];
  }
  // A share issue of 10% on the first listing's exchange (6.6).
  const issueBefore = indexLevel(w, zone) as number;
  const shares = (w.companies[first] as World["companies"][number]).shares_out;
  setSharesOut(w, first, shares + Math.floor(shares / 10));
  const issueAfter = indexLevel(w, zone) as number;
  listing = {
    listed: first,
    zone,
    before,
    after,
    empty_listed: emptyListed,
    issue_before: issueBefore,
    issue_after: issueAfter,
  };
}

describe("m5 indices", () => {
  it("an_index_does_not_jump_when_a_company_lists_or_issues_shares", { timeout: 600_000 }, () => {
    listing = null;
    const sim = unwrap(simNew(data(), 2), "Sim::new");
    simRegisterTestJob(sim, "LockIpoVotes", "test.list_two", listTwo);
    const end = dateTimeMidnight(simDateYmd(2020, 2, 1));
    while (simNow(sim) < end) {
      simStep(sim);
      const w = simWorld(sim);
      if (dateTimeHour(simNow(sim)) === 0) {
        w.zones.forEach((_, i) => {
          const z = i as ZoneId;
          const q = (simViews(sim).quotes.data.indices.find((x) => x.zone === z) as { level: number | null })
            .level;
          const b = specLevel(w, z);
          if (q !== null && b !== null) near(q, b, "level");
          else expect([q, b], `${z}`).toEqual([null, null]);
        });
      }
    }
    const seen = listing as ListingSeen | null;
    if (seen === null) throw new Error("the lock ran");
    const w = simWorld(sim);
    expect((w.market.stocks[seen.listed] as World["market"]["stocks"][number]).exchange).toBe(seen.zone);
    near(seen.after, seen.before, "level through a listing");
    near(seen.issue_after, seen.issue_before, "level through a share issue");
    if (seen.empty_listed === null) throw new Error("a private company on an empty exchange");
    const [id, z, before, after] = seen.empty_listed;
    expect(before, "an exchange with no listing shows no level").toBeNull();
    near(after as number, INDEX_BASE, "a first listing opens at 1,000");
    const quoteIds = new Set(simViews(sim).quotes.data.rows.map((r) => r.id));
    for (const listed of [seen.listed, id]) {
      const s = w.market.stocks[listed] as World["market"]["stocks"][number];
      expect(s.quoted && s.listed_on !== null && dateEq(s.listed_on, simDateYmd(2020, 1, 9))).toBe(true);
      expect(barHistoryIsEmpty(s.bars), "it trades and gets bars").toBe(false);
      expect(quoteIds.has(listed)).toBe(true);
    }
    expect(simViews(sim).exchanges.data.exchanges[z]?.constituents.includes(id)).toBe(true);
    expect((w.market.stocks[seen.listed] as World["market"]["stocks"][number]).shares).toBe(
      (w.companies[seen.listed] as World["companies"][number]).shares_out,
    );
  });

  // --- Delisting at bankruptcy ----------------------------------------------------------------

  /** A distress month's extra cost, as a share of the asset book (as in m4_distress). */
  const LOSS_SHARE_OF_BOOK = 0.04;

  it("a_bankruptcy_delists_without_moving_the_index", { timeout: 900_000 }, () => {
    const sim = unwrap(simNew(data(), 4), "Sim::new");
    const w0 = simWorld(sim);
    const target = w0.companies.findIndex((c) => c.key === "CO-0001") as CompanyId;
    expect(target).toBeGreaterThanOrEqual(0);
    const u0 = (w0.companies[target] as World["companies"][number]).units[0] as number;
    const baseRate = (w0.units[u0] as World["units"][number]).fixed_cost_rate;
    expect(
      (w0.market.stocks[target] as World["market"]["stocks"][number]).quoted,
      "Arrowhead lists on ATX",
    ).toBe(true);
    /** Levels of the target's exchange at steps 12 and 14 of each month: [step 12, step 14, bankrupt]. */
    const levels: [number | null, number | null, boolean][] = [];
    const zoneOfTarget = (w: World): ZoneId =>
      (
        w.countries[
          (w.companies[target] as World["companies"][number]).hq_country
        ] as World["countries"][number]
      ).zone;
    const squeeze = (w: World, _ctx: JobCtx): void => {
      const c = w.companies[target] as World["companies"][number];
      if (companyStatusIsFrozen(c.finance.distress.status)) return;
      const u = w.units[c.units[0] as number] as World["units"][number];
      let extra = LOSS_SHARE_OF_BOOK * u.asset_book;
      if (c.finance.distress.status === "Active") {
        extra += Math.max(c.cash_usd, 0.0) + Math.max(c.finance.line.limit - c.finance.line.drawn, 0.0);
      }
      u.fixed_cost_rate = baseRate + (12.0 * extra) / u.gross_assets;
    };
    const level12 = (w: World, _ctx: JobCtx): void => {
      levels.push([indexLevel(w, zoneOfTarget(w)), null, false]);
    };
    const level14 = (w: World, _ctx: JobCtx): void => {
      const last = levels[levels.length - 1] as (typeof levels)[number];
      last[1] = indexLevel(w, zoneOfTarget(w));
      last[2] = (w.companies[target] as World["companies"][number]).finance.distress.status === "Bankrupt";
    };
    simRegisterTestJob(sim, "MonthlyDemand", "test.squeeze", squeeze);
    simRegisterTestJob(sim, "MonthlyInterest", "test.level_12", level12);
    simRegisterTestJob(sim, "MonthlyLedger", "test.level_14", level14);
    const end = dateTimeMidnight(simDateYmd(2021, 1, 10));
    while (simNow(sim) < end) {
      simStep(sim);
      const w = simWorld(sim);
      const s = w.market.stocks[target] as World["market"]["stocks"][number];
      if (
        companyStatusIsFrozen((w.companies[target] as World["companies"][number]).finance.distress.status)
      ) {
        // 5.12 step 2: $0.00, no quote, no bar, out of the index from the bankruptcy on.
        expect(s.price).toBe(0.0);
        expect(s.quoted).toBe(false);
        expect(s.fair_value).toBe(0.0);
        expect(simViews(sim).quotes.data.rows.some((r) => r.id === target)).toBe(false);
      }
    }
    const month = levels.find(([, , bankrupt]) => bankrupt);
    if (month === undefined) throw new Error("Arrowhead went bankrupt");
    near(month[1] as number, month[0] as number, "level through the delisting");
    const w = simWorld(sim);
    expect((w.companies[target] as World["companies"][number]).finance.distress.status).toBe("Removed");
    expect((w.market.stocks[target] as World["market"]["stocks"][number]).price).toBe(0.0);
  });
});
