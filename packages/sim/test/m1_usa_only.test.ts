// The USA cut and the rest-of-world block (pivot 4.1, 4.2; lane S3), behind `features.usa_only`,
// which no shipped manifest sets: a flagged 1995 world keeps only its US companies, each industry's
// supply at load is what it was with the foreign ones present, startups are born in the USA only,
// and the world runs. Not a Rust test.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseManifest } from "@tc20ff/sim-data";
import { worldDataDir } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { nextCompanyNumber } from "../src/births/jobs.ts";
import { leversApply } from "../src/governing/levers.ts";
import { type Sim, simNew, simRunUntil, simViews, simWorld } from "../src/lib.ts";
import type { IndustryId } from "../src/types/ids.ts";
import type { World } from "../src/types/world.ts";
import { data1995, unwrap } from "./common/index.ts";
import { notFinite, usaOnly1995 } from "./common/usa_only.ts";

const flagged = (seed: number): Sim => unwrap(simNew(usaOnly1995(), seed), "flagged 1995 world");
const whole = (seed: number): Sim => unwrap(simNew(data1995(), seed), "1995 world");

describe("features.usa_only in manifest.json", () => {
  const text = readFileSync(join(worldDataDir("1995"), "manifest.json"), "utf8");
  const withFlag = (v: unknown): string => {
    const m = JSON.parse(text) as { features: Record<string, unknown> };
    m.features.usa_only = v;
    return JSON.stringify(m);
  };

  it("is false when absent, and no shipped world sets it", () => {
    expect(unwrap(parseManifest(text)).features.usa_only).toBe(false);
    expect(text).not.toContain("usa_only");
  });

  it("reads a boolean and refuses anything else", () => {
    expect(unwrap(parseManifest(withFlag(true))).features.usa_only).toBe(true);
    expect(unwrap(parseManifest(withFlag(false))).features.usa_only).toBe(false);
    expect(parseManifest(withFlag("yes")).ok).toBe(false);
  });
});

describe("a 1995 world cut to the USA (pivot 4.1, 4.2)", () => {
  it("keeps the US companies, with their keys, and no other", () => {
    const rows = data1995().companies.rows;
    const w = simWorld(flagged(1));
    const usa = w.politics.country;
    expect(w.companies.every((c) => c.hq_country === usa)).toBe(true);
    expect(w.companies.map((c) => c.key)).toEqual(
      rows
        .filter((c) => c.hq_country === "USA")
        .map((c) => c.id)
        .sort(),
    );
    expect(w.companies.length).toBeLessThan(rows.length);
    expect(w.units.length).toBe(w.companies.length);
    expect(w.market.stocks.length).toBe(w.companies.length);
    // The other countries, zones and provinces stay as rows.
    const all = simWorld(whole(1));
    expect(w.countries.length).toBe(all.countries.length);
    expect(w.zones.length).toBe(all.zones.length);
    expect(w.provinces.length).toBe(all.provinces.length);
    expect(w.market.indices.length).toBe(w.zones.length);
    // A controller is a character, a kept company, a state or none.
    for (const c of w.companies) {
      const ctl = c.start_control?.controller;
      if (ctl?.kind === "Company") expect(w.companies[ctl.company]).toBeDefined();
    }
  });

  it("puts the removed companies' supply in the rest-of-world block, so supply at load is as before", () => {
    const all = simWorld(whole(2));
    const cut = simWorld(flagged(2));
    const usa = all.politics.country;
    let blocks = 0;
    all.industries.forEach((a, id) => {
      const c = cut.industries[id] as World["industries"][number];
      // The fringe is the size it was, and the block is the foreign units' supply at load.
      expect(c.fringe_assets).toBe(a.fringe_assets);
      let foreign = 0.0;
      for (const u of all.units) {
        const owner = all.companies[u.company] as World["companies"][number];
        if (u.industry === id && owner.hq_country !== usa) {
          foreign += (u.gross_assets * (u.productivity + owner.pc_bonus + u.location_bonus)) / 100;
        }
      }
      expect(c.row_assets).toBeCloseTo(foreign, -3);
      expect(Math.abs(c.row_assets - foreign)).toBeLessThanOrEqual(1e-9 * Math.max(foreign, 1));
      if (c.row_assets > 0) blocks += 1;
      expect(c.demand).toBe(a.demand);
      expect(Math.abs(c.supply - a.supply)).toBeLessThanOrEqual(1e-9 * Math.max(a.supply, 1));
      expect(c.supply_ratio).toBeCloseTo(a.supply_ratio, 9);
      expect(c.market_factor).toBeCloseTo(a.market_factor, 9);
    });
    expect(blocks).toBeGreaterThan(10);
    // With the flag off there is no block.
    expect(all.industries.every((i) => i.row_assets === 0)).toBe(true);
  });

  it("draws startup headquarters in the USA only", () => {
    const w = simWorld(flagged(1));
    const usa = w.politics.country;
    let home = 0;
    w.provinces.forEach((p, id) => {
      const weight = (w.births.sites.weight[id] as number) + (w.births.sites.hq_weight[id] as number);
      if (p.country === usa) home += weight;
      else expect(weight).toBe(0);
    });
    expect(home).toBeGreaterThan(0);
  });

  it("gives a born company a key no kept company holds", () => {
    const w = simWorld(flagged(1));
    const highest = Math.max(...w.companies.map((c) => Number(c.key.slice(3))));
    expect(highest).toBeGreaterThan(w.companies.length);
    expect(nextCompanyNumber(w)).toBe(highest + 1);
    // With no gaps it is the count plus one, as it always was.
    const all = simWorld(whole(1));
    expect(nextCompanyNumber(all)).toBe(all.companies.length + 1);
  });

  it("runs two years: every company American, every key its own, no number lost", () => {
    const sim = flagged(1);
    const w = simWorld(sim);
    const loaded = w.companies.length;
    const block = w.industries.map((i) => i.row_assets);
    const r = simRunUntil(sim, { year: 1997, month: 1, day: 1 });
    expect(r.ended).toBe(false);
    const usa = w.politics.country;
    expect(w.companies.length).toBeGreaterThan(loaded);
    expect(w.companies.every((c) => c.hq_country === usa)).toBe(true);
    expect(new Set(w.companies.map((c) => c.key)).size).toBe(w.companies.length);
    // The blocks moved on their industries' long-term rates (one with a rate of 0 stands still),
    // and an industry with none still has none.
    let grew = 0;
    w.industries.forEach((ind, id) => {
      if ((block[id] as number) === 0) expect(ind.row_assets).toBe(0);
      else if (ind.row_assets > (block[id] as number)) grew += 1;
    });
    expect(grew).toBeGreaterThan(10);
    expect(notFinite({ ...w, name_books: null })).toEqual([]);
    expect(notFinite(simViews(sim))).toEqual([]);
  }, 300_000);

  it("a tariff on an industry's block tightens its market", () => {
    const month = { year: 1995, month: 2, day: 1 };
    const open = flagged(3);
    const shut = flagged(3);
    const id = simWorld(open).industries.findIndex((i) => i.row_assets > 0 && i.supply > 0);
    leversApply(simWorld(shut), { tariff: [[id as IndustryId, 0.5]] });
    simRunUntil(open, month);
    simRunUntil(shut, month);
    const a = simWorld(open).industries[id] as World["industries"][number];
    const b = simWorld(shut).industries[id] as World["industries"][number];
    expect(b.row_assets).toBe(a.row_assets);
    expect(b.supply).toBeLessThan(a.supply);
    expect(b.supply_ratio).toBeLessThan(a.supply_ratio);
    expect(b.market_factor).toBeGreaterThanOrEqual(a.market_factor);
  }, 120_000);
});
