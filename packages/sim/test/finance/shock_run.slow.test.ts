// D1059: company shocks over a real run. A 1995 world's companies take some charges, each on the
// wire, and the M4.9 check still balances every month; the frozen 2020 test world takes none.
import { loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { type Sim, simNew, simRunTicks, simWorld } from "../../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../../src/time/calendar.ts";
import type { Headline } from "../../src/types/state/news.ts";
import { chunkLogRows } from "../../src/world/log.ts";
import { data1995, unwrap } from "../common/index.ts";
import { worldMini } from "../common/world_mini.ts";

/** The seed and the years a stable 1995 run is watched (it takes charges in them). */
const SEED = 1;
const YEARS: readonly [number, number] = [1996, 2005];

function runYears(sim: Sim): Map<string, Headline> {
  const charges = new Map<string, Headline>();
  for (let y = YEARS[0]; y <= YEARS[1]; y++) {
    simRunTicks(sim, dateTimeMidnight(simDateYmd(y, 1, 1)), Number.MAX_SAFE_INTEGER);
    for (const h of chunkLogRows(simWorld(sim).news.feed)) {
      if (h.kind.kind !== "SpecialCharge") continue;
      charges.set(`${h.company}:${h.date.year}-${h.date.month}-${h.date.day}`, h);
    }
  }
  return charges;
}

describe("company shocks over a run (D1059)", () => {
  it("charges some 1995 companies, each on the wire, and every month's books still roll", () => {
    const sim = unwrap(simNew(data1995(), SEED, { scenario: "stable" }), "1995 world");
    const charges = runYears(sim);
    expect(charges.size).toBeGreaterThan(0);
    for (const h of charges.values()) {
      expect(h.company).not.toBeNull();
      expect(h.text).toMatch(/ takes (a \$[0-9.]+M charge|a charge) after /);
    }
    const w = simWorld(sim);
    expect(w.books_check.checked).toBeGreaterThan(0);
    expect(w.books_check.failures, w.books_check.first_failure ?? "").toBe(0);
  }, 300_000);

  it("never charges a company in the frozen test world, which has no era", () => {
    const r = loadWorld(worldMini().dir);
    if (!r.ok) throw new Error("data");
    const sim = unwrap(simNew(structuredClone(r.value), SEED), "test world");
    simRunTicks(sim, dateTimeMidnight(simDateYmd(2022, 1, 1)), Number.MAX_SAFE_INTEGER);
    const w = simWorld(sim);
    expect(chunkLogRows(w.news.feed).some((h) => h.kind.kind === "SpecialCharge")).toBe(false);
    for (const c of w.companies) {
      for (const m of c.finance.months) expect(m.lines.special_charge).toBe(0);
    }
  }, 300_000);
});
