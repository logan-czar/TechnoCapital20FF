// Scale-up financing and listing in a historical world (1995-rework 9; D997): how a firm born in the
// run gets large enough to reach the top 10.

import { describe, expect, it } from "vitest";
import {
  type GrowthRaiseInputs,
  growthRaisePlan,
  MAX_NEW_SHARE_FRACTION,
  SCALEUP_QUARTERS,
} from "../src/ai/raise.ts";
import { holdVote, listingSizeBonus, MIN_TTM_REVENUE_USD } from "../src/births/ipo.ts";
import { simNew, simViews, simWorld } from "../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { data, data1995, macrotask } from "./common/index.ts";
import { newNoNoise } from "./common/rng.ts";

function inputs(over: Partial<GrowthRaiseInputs> = {}): GrowthRaiseInputs {
  return {
    status: "Active",
    listed: true,
    price: 10.0,
    shares_out: 1_000_000,
    value_per_share: 10.0,
    confidence_factor: 1.0,
    label: "Normal",
    failed_raises: 0,
    g_dem: 0.4,
    min_g_dem: 0.1,
    wanted_purchases: 200_000.0,
    funded_purchases: 100_000.0,
    funding_share: 0.5,
    ...over,
  };
}

describe("a growth raise", () => {
  it("funds what the funding cap holds back, as a 6.6 share issue", () => {
    const plan = growthRaisePlan(inputs());
    expect(plan?.method).toBe("ShareIssue");
    expect(plan?.target).toBeCloseTo((SCALEUP_QUARTERS * 100_000) / 0.5);
    expect(plan?.net).toBeLessThanOrEqual(plan?.gross ?? 0);
    expect(plan?.chance).toBeGreaterThan(0);
  });

  it("is capped at the 6.6 share limit, however much it wants", () => {
    const plan = growthRaisePlan(inputs({ wanted_purchases: 1e12 }));
    expect(plan?.new_shares).toBe(Math.floor(MAX_NEW_SHARE_FRACTION * 1_000_000));
  });

  it("is not for a firm in a slow or falling market, or one not held back, or not Active", () => {
    expect(growthRaisePlan(inputs({ g_dem: 0.05 }))).toBeNull();
    expect(growthRaisePlan(inputs({ label: "Bust" }))).toBeNull();
    expect(growthRaisePlan(inputs({ label: "Glut" }))).toBeNull();
    expect(growthRaisePlan(inputs({ wanted_purchases: 100_000.0 }))).toBeNull();
    expect(growthRaisePlan(inputs({ status: "Distressed" }))).toBeNull();
  });

  it("prices a private firm at the 6.6 private discount", () => {
    const listed = growthRaisePlan(inputs());
    const priv = growthRaisePlan(inputs({ listed: false }));
    expect(priv?.issue_price).toBeLessThan(listed?.issue_price ?? 0);
    expect(priv?.price_after).toBe(10.0);
  });
});

describe("a board's listing vote", () => {
  it("leans to yes the larger the firm, up to a limit", () => {
    expect(listingSizeBonus(MIN_TTM_REVENUE_USD)).toBe(0);
    expect(listingSizeBonus(MIN_TTM_REVENUE_USD * 100)).toBeCloseTo(0.4);
    expect(listingSizeBonus(1e15)).toBe(0.6);
  });

  it("still clamps each yes chance", () => {
    const voter = { role: "Chair", traits: [], is_controller: false } as never;
    const r = holdVote([voter], "Boom", 100.0, newNoNoise(), 5.0);
    expect(r.ballots[0]?.chance).toBe(0.95);
  });
});

describe("a run", () => {
  it("raises and lists firms in a historical world, and none of it in the 2020 world", async () => {
    const made = simNew(data1995(), 1, { scenario: "stable" });
    if (!made.ok) throw new Error("did not load");
    const sim = made.value;
    const end = dateTimeMidnight(simDateYmd(2006, 1, 1));
    let n = 0;
    while (sim.now() < end) {
      sim.step();
      if (++n % 8760 === 0) await macrotask();
    }
    const w = simWorld(sim);
    const born = w.companies.filter((c) => c.origin.kind === "Born");
    expect(born.some((c) => c.holders.some((h) => h.holder.kind === "NewInvestors"))).toBe(true);
    const rows = simViews(sim).company_rows.data.rows;
    expect(rows.some((r) => r.origin.kind === "Born" && r.listing.kind === "InPlay")).toBe(true);

    const old = simNew(data(), 1);
    if (!old.ok) throw new Error("did not load");
    expect(simWorld(old.value).era).toBeUndefined();
  }, 300_000);
});
