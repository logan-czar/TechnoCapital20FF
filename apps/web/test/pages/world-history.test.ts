// The World History page's data (1995-rework 8.1): built from a small history by hand, since the sim
// takes a run to make one. Colors follow their key, the chronology runs by year, and the 2020 world
// says it has none.

import type { CompanyId, HistoryView } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import type { NameIndex } from "../../src/links/names.ts";
import {
  chronology,
  scenarioText,
  sectorShares,
  tonesByKey,
  worldHistoryDoc,
} from "../../src/pages/kinds/world-history.tsx";
import type { ViewsData } from "../../src/pages/views.ts";

const index = { title: (p: { kind: string }) => p.kind } as unknown as NameIndex;

function history(over: Partial<HistoryView> = {}): HistoryView {
  return {
    world_id: "1995",
    start_year: 1995,
    scenario: null,
    years: [1995, 1996],
    gdp_usd: [30e12, 31e12],
    companies: [300, 310],
    base_rate: [0.05, 0.04],
    zone_gdp_usd: [
      [20e12, 10e12],
      [20e12, 11e12],
    ],
    recessions: [1996],
    industry_demand_usd: [
      [10, 30, 0],
      [20, 30, 50],
    ],
    failures: [0, 2],
    top10: [{ year: 1995, companies: [{ company: 3 as CompanyId, name: "A", cap_usd: 1e9 }] }],
    emergences: [{ year: 1996, industry: "E-commerce" }],
    run: {
      ended: false,
      reveal_year: 2020,
      presidents: [{ year: 1995, name: "Pat", party: "Democrats" }],
      us_corp_tax: [0.35, 0.34],
      founders: [{ year: 1996, name: "Jo", company: 4 as CompanyId, company_name: "Jo Co" }],
      successions: [],
      major_failures: [{ year: 1995, company: 5 as CompanyId, company_name: "Gone Co" }],
      sectors: ["Tech", "Energy", "Tech"],
      removed: [5 as CompanyId],
    },
    ...over,
  };
}

describe("the series colors", () => {
  it("hold a key's color when other keys come and go", () => {
    const a = tonesByKey([0, 1, 2]);
    const b = tonesByKey([1, 2]);
    expect(b.get(1)).toBe(a.get(1));
    expect(b.get(2)).toBe(a.get(2));
  });

  it("never give two keys one color", () => {
    const t = tonesByKey([0, 5, 10, 15, 20]);
    expect(new Set(t.values()).size).toBe(5);
  });
});

describe("the sector shares", () => {
  it("sum each sector's industries, as a share of the year", () => {
    const s = sectorShares(history());
    expect(s.map((x) => x.name)).toEqual(["Tech", "Energy"]);
    expect(s[0]?.shares).toEqual([0.25, 0.7]);
    expect(s[1]?.shares).toEqual([0.75, 0.3]);
  });
});

describe("the chronology", () => {
  it("runs by year, and holds each kind of event", () => {
    const events = chronology(history(), []);
    expect(events.map((e) => e.year)).toEqual([...events.map((e) => e.year)].sort((a, b) => a - b));
    expect(events.map((e) => e.kind)).toEqual([
      "President",
      "Major failure",
      "Recession",
      "New industry",
      "Founded by Jo",
    ]);
  });

  it("names a removed company as text, by the name the history kept, and links a live one", () => {
    const events = chronology(history(), []);
    expect(events.find((e) => e.kind === "Major failure")?.cell).toEqual({ k: "text", v: "Gone Co" });
    expect(events.find((e) => e.kind === "Founded by Jo")?.cell).toEqual({
      k: "link",
      text: "Jo Co",
      page: { kind: "company", id: 4 },
    });
  });
});

describe("the scenario line", () => {
  it("stays back until the view has a name", () => {
    expect(scenarioText(history())).toContain("Hidden");
    expect(scenarioText(history({ scenario: "Stagnation" }))).toBe("Stagnation");
  });
});

describe("the page", () => {
  const views = (h: HistoryView): ViewsData => ({ history: h, politics: { elections: [] } }) as never;

  it("has every section for a run", () => {
    const doc = worldHistoryDoc(views(history()), index);
    expect(doc.sections.map((s) => s.id)).toEqual(["economy", "industries", "zones", "chronology", "top10"]);
  });

  it("says when the run has ended", () => {
    const h = history();
    const run = h.run;
    if (!run) throw new Error("no run");
    run.ended = true;
    expect(JSON.stringify(worldHistoryDoc(views(h), index).head)).toContain("nothing past here is tuned");
  });

  it("says so in the 2020 world, which has no run", () => {
    const { run: _, ...old } = history();
    const doc = worldHistoryDoc(views(old), index);
    expect(doc.sections).toEqual([]);
    expect(JSON.stringify(doc.head)).toContain("no long history");
  });
});
