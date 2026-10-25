import { describe, expect, it } from "vitest";
import type { CompanyId, IndustryId } from "../../src/types/ids.ts";
import type { BusinessUnit, Company, GlobalCycle, World } from "../../src/types/world.ts";
import { aiStageName, cyclePhaseName, globalCycleGLagged } from "../../src/world/economy.ts";
import {
  businessUnitAssetsEff,
  businessUnitEbitM,
  businessUnitOpexM,
  companyDataIn,
  companySeat,
  originIsBorn,
  phaseLabelName,
} from "../../src/world/entities.ts";
import { worldIndustryEstimatedAt, worldPublishes, worldPublishesAt } from "../../src/world/index.ts";
import {
  alertKindDefaultLevel,
  alertKindIndex,
  alertLevelsAllOff,
  alertLevelsDefault,
  alertLevelsGet,
  alertLevelsSet,
} from "../../src/world/notice.ts";

// An independent check on the day count: the test may use Date, the sim may not.
const hours = (y: number, m: number, d: number) => (Date.UTC(y, m - 1, d) - Date.UTC(2020, 0, 1)) / 3_600_000;

describe("world helpers", () => {
  it("global cycle g_lagged clamps to the history", () => {
    const c = { g_t: 0.3, g_history: [0.3, 0.2, 0.1] } as GlobalCycle;
    expect(globalCycleGLagged(c, 0)).toBe(0.3);
    expect(globalCycleGLagged(c, 2)).toBe(0.1);
    expect(globalCycleGLagged(c, 9)).toBe(0.1);
    expect(globalCycleGLagged({ ...c, g_history: [] }, 4)).toBe(0.3);
    expect(cyclePhaseName("Recovery")).toBe("Recovery");
    expect(aiStageName("Bust")).toBe("Bust");
    expect(phaseLabelName("Glut")).toBe("Glut");
  });

  it("unit figures follow spec 5.2 and 5.5", () => {
    const u = {
      gross_assets: 1000,
      ramping: [
        { amount: 100, months_left: 2 },
        { amount: 50, months_left: 1 },
      ],
      revenue_m: 100,
      variable_m: 30,
      fixed_m: 20,
      rd_m: 5,
      dep_m: 4,
      shared_m: 1,
    } as BusinessUnit;
    expect(businessUnitAssetsEff(u)).toBeCloseTo(970, 9);
    expect(businessUnitOpexM(u)).toBe(50);
    expect(businessUnitEbitM(u)).toBe(40);
  });

  it("seats and data lookups", () => {
    const holder = { kind: "Full", character: 4 } as const;
    const co = {
      board: [null, holder, null, null, null],
      data: [{ industry: 3, book: { tag: "x" } }],
    } as unknown as Company;
    expect(companySeat(co, "Ceo")).toBeNull();
    expect(companySeat(co, "Cfo")).toBe(holder);
    expect(companySeat(co, "Chair")).toBeNull();
    expect(companyDataIn(co, 3 as IndustryId)).toEqual({ tag: "x" });
    expect(companyDataIn(co, 2 as IndustryId)).toBeNull();
    expect(originIsBorn({ kind: "Start" })).toBe(false);
    expect(originIsBorn({ kind: "Born", date: { year: 2021, month: 1, day: 1 }, event: 0 as never })).toBe(
      true,
    );
  });

  it("alert levels", () => {
    const d = alertLevelsDefault();
    expect(d).toEqual(["Pause", "Pause", "Pause", "Notify", "Pause", "Pause"]);
    expect(alertKindDefaultLevel("BankruptcyInWatchlist")).toBe("Notify");
    expect(alertKindIndex("QuarterStart")).toBe(5);
    const off = alertLevelsAllOff();
    expect(off.every((l) => l === "Off")).toBe(true);
    alertLevelsSet(off, "PlanLock", "Log");
    expect(alertLevelsGet(off, "PlanLock")).toBe("Log");
    expect(alertLevelsGet(off, "EarningsDay")).toBe("Off");
  });

  /** A world with the fields publishes and industry_estimated_at read. */
  function world(): World {
    const stock = (exchange: number | null, listed_on: World["market"]["stocks"][number]["listed_on"]) =>
      ({ exchange, listed_on }) as World["market"]["stocks"][number];
    const company = (origin: Company["origin"], bankrupt_on: Company["finance"]["bankrupt_on"] = null) =>
      ({ origin, finance: { bankrupt_on } }) as Company;
    const unit = (c: number) => ({ industry: 0, company: c }) as BusinessUnit;
    return {
      clock: 0,
      market: {
        stocks: [
          stock(0, null), // 0: listed at load
          stock(null, null), // 1: private
          stock(0, { year: 2020, month: 5, day: 20 }), // 2: listed in play in Q2 2020
          stock(null, null), // 3: private, born later
          stock(null, null), // 4: private, bankrupt
        ],
      },
      companies: [
        company({ kind: "Start" }),
        company({ kind: "Start" }),
        company({ kind: "Start" }),
        company({ kind: "Born", date: { year: 2021, month: 1, day: 1 }, event: 0 as never }),
        company({ kind: "Start" }, { year: 2020, month: 3, day: 1 }),
      ],
      units: [unit(0), unit(1), unit(2), unit(3), unit(4)],
    } as unknown as World;
  }

  it("publishes_at: load listings always, in-play listings from the next release, private never", () => {
    const w = world();
    expect(worldPublishes(w, 0 as CompanyId)).toBe(true);
    expect(worldPublishes(w, 1 as CompanyId)).toBe(false);
    // Listed 20 May 2020 (Q2): publishes from the Q3 release, 2 Jul 2020 00:00.
    expect(worldPublishesAt(w, 2 as CompanyId, hours(2020, 7, 2) - 1)).toBe(false);
    expect(worldPublishesAt(w, 2 as CompanyId, hours(2020, 7, 2))).toBe(true);
    // A Q4 listing's next release is in January of the next year.
    const w2 = world();
    w2.market.stocks[2]!.listed_on = { year: 2020, month: 11, day: 3 };
    expect(worldPublishesAt(w2, 2 as CompanyId, hours(2021, 1, 2) - 1)).toBe(false);
    expect(worldPublishesAt(w2, 2 as CompanyId, hours(2021, 1, 2))).toBe(true);
  });

  it("industry_estimated_at counts the born, unbankrupt, unpublished companies (1 or 2)", () => {
    const w = world();
    const id = 0 as IndustryId;
    // 1 Jan 2020: companies 1, 2 and 4 do not publish (4 not yet bankrupt): 3 -> not estimated.
    expect(worldIndustryEstimatedAt(w, id, hours(2020, 1, 1))).toBe(false);
    // After company 4 is bankrupt (1 Mar 2020): companies 1 and 2 -> estimated.
    expect(worldIndustryEstimatedAt(w, id, hours(2020, 3, 5))).toBe(true);
    // After company 2 starts to publish (July 2020): only company 1 -> estimated.
    expect(worldIndustryEstimatedAt(w, id, hours(2020, 7, 5))).toBe(true);
    // Company 3 is born 1 Jan 2021 and does not publish: companies 1 and 3 -> estimated.
    expect(worldIndustryEstimatedAt(w, id, hours(2021, 2, 1))).toBe(true);
    // Make a third unpublished company exist: not estimated (it is a whole industry's worth).
    w.market.stocks[0]!.exchange = null;
    expect(worldIndustryEstimatedAt(w, id, hours(2021, 2, 1))).toBe(false);
    // All publish: none unpublished -> not estimated.
    for (const s of w.market.stocks) s.exchange = 0 as never;
    expect(worldIndustryEstimatedAt(w, id, hours(2021, 2, 1))).toBe(false);
  });
});
