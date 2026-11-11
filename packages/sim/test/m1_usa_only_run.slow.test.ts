// The USA cut over a whole run (pivot 4.1, 4.2; lane S3, D1034, D1038): the 1995 world, cut to the
// USA as shipped, plays its 25 years, 1995 to 2020, for seeds 1 and 2 without an error, with every
// number finite, every company American and every key its own. Its startups are the USA's share of
// the uncut world's (D1038), so it ends with about as many American companies as the same seed
// uncut; measured on seeds 1 to 5, within 10% on average, so the bound here is loose. Not a Rust
// test.

import { describe, expect, it } from "vitest";
import { type Sim, simNew, simRunUntil, simViews, simWorld } from "../src/lib.ts";
import { macrotask, unwrap } from "./common/index.ts";
import { notFinite, usaOnly1995, whole1995 } from "./common/usa_only.ts";

/** American companies born by the end of a run. */
function bornInUsa(sim: Sim): number {
  const w = simWorld(sim);
  return w.companies.filter((c) => c.hq_country === w.politics.country && c.origin.kind === "Born").length;
}

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

      // The uncut world of the same seed: the cut's startups are about its American ones, far fewer
      // than all of its startups (D1038).
      const uncut = unwrap(simNew(whole1995(), seed), "uncut 1995 world");
      simRunUntil(uncut, { year: 2020, month: 1, day: 1 });
      const all = simWorld(uncut).companies.filter((c) => c.origin.kind === "Born").length;
      const home = bornInUsa(uncut);
      const cut = bornInUsa(sim);
      expect(cut).toBeGreaterThan(0.6 * home);
      expect(cut).toBeLessThan(1.5 * home);
      expect(cut).toBeLessThan(0.5 * all);
    }, 600_000);
  }
});
