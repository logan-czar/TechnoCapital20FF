// 25 Coarse years of elections on the 1995 world (D1040), seeds 1 to 3: the vote is neither stuck
// nor lopsided. The economy does not run (harness.ts); the measured distribution is printed.

import { describe, expect, it } from "vitest";
import { simDateYmd } from "../../src/time/calendar.ts";
import type { Race } from "../../src/types/state/elections.ts";
import { runDays, runDraws, start1995 } from "./harness.ts";

/** No chamber after any general may be more one-sided than this share of its seats (D1040). */
const MAX_CHAMBER_SHARE = 0.75;

interface Run {
  presidents: string[];
  house: [number, number][];
  senate: [number, number][];
  persons: number;
  races: number;
}

function run(seed: number): Run {
  const w = start1995(seed);
  runDays(w, runDraws(seed), simDateYmd(1995, 1, 1), simDateYmd(2020, 1, 21));
  const p = w.politics;
  return {
    presidents: (w.era?.history.presidents ?? []).map((x) => `${x.year} ${x.party[0]}`),
    house: p.elections.map((e) => e.house),
    senate: p.elections.map((e) => e.senate),
    persons: w.persons.persons.length,
    races: w.elections.races.filter((r: Race) => r.status === "Certified").length,
  };
}

describe("25 Coarse years (pivot 3.2, 6.7)", () => {
  const runs = [1, 2, 3].map(run);

  it("prints the distribution", () => {
    runs.forEach((r, i) => {
      console.log(
        `seed ${i + 1}: presidents ${r.presidents.join(", ")}\n  house ${r.house.map((h) => h.join("-")).join(" ")}\n  senate ${r.senate.map((h) => h.join("-")).join(" ")}\n  persons ${r.persons}, races ${r.races}`,
      );
    });
  });

  it("holds 12 federal generals and fills every chamber", () => {
    for (const r of runs) {
      expect(r.house.length).toBe(12);
      for (const h of r.house) expect(h[0] + h[1]).toBe(435);
      for (const s of r.senate) expect(s[0] + s[1]).toBeGreaterThanOrEqual(98);
    }
  });

  it("gives neither party every presidency, and moves the House", () => {
    const won = runs.flatMap((r) => r.presidents.slice(1).map((p) => p.at(-1)));
    expect(new Set(won).size).toBe(2);
    const flips = runs.map((r) => {
      let n = 0;
      for (let i = 1; i < r.house.length; i++) {
        const a = (r.house[i - 1] as [number, number])[0] > 217;
        const b = (r.house[i] as [number, number])[0] > 217;
        if (a !== b) n++;
      }
      return n;
    });
    expect(flips.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it("keeps every chamber within the bound", () => {
    for (const r of runs) {
      for (const h of r.house) expect(Math.max(...h) / 435).toBeLessThanOrEqual(MAX_CHAMBER_SHARE);
      for (const s of r.senate) expect(Math.max(...s) / (s[0] + s[1])).toBeLessThanOrEqual(MAX_CHAMBER_SHARE);
    }
  });
});
