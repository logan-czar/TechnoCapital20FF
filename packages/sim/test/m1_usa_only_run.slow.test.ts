// The USA cut over a whole run (pivot 4.1, 4.2; lane S3): a 1995 world with `features.usa_only`
// plays its 25 years, 1995 to 2020, for seeds 1 and 2 without an error, with every number finite,
// every company American and every key its own. It checks that the flagged world runs, not any
// economic target: the flagged world is not tuned yet (D1030). Not a Rust test.

import { describe, expect, it } from "vitest";
import { simNew, simRunUntil, simViews, simWorld } from "../src/lib.ts";
import { macrotask, unwrap } from "./common/index.ts";
import { notFinite, usaOnly1995 } from "./common/usa_only.ts";

describe("a 1995 world cut to the USA runs to 2020", () => {
  for (const seed of [1, 2]) {
    it(`seed ${seed}`, async () => {
      const sim = unwrap(simNew(usaOnly1995(), seed), "flagged 1995 world");
      const w = simWorld(sim);
      const usa = w.politics.country;
      const loaded = w.companies.length;
      for (let year = 1996; year <= 2020; year++) {
        simRunUntil(sim, { year, month: 1, day: 1 });
        await macrotask();
        if (year % 5 !== 0) continue;
        // An industry with no demand reads as fully oversupplied, `Number.MAX_VALUE`: finite.
        expect(notFinite({ ...w, name_books: null }).map((p) => `${year}${p}`)).toEqual([]);
        expect(notFinite(simViews(sim)).map((p) => `${year}${p}`)).toEqual([]);
      }
      expect(w.companies.length).toBeGreaterThan(loaded);
      expect(w.companies.every((c) => c.hq_country === usa)).toBe(true);
      expect(new Set(w.companies.map((c) => c.key)).size).toBe(w.companies.length);
      expect(w.industries.some((i) => i.row_assets > 0)).toBe(true);
    }, 600_000);
  }
});
