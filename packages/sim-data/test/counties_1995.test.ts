// The 1995 world's county tables (pivot 5.1, 5.4; D1028): assets/worlds/1995/counties.csv and
// county-adjacency.csv, built by tools/world-1995/counties. They load with the manifest's counts and
// pass the county checks, and each check catches the fault it is for. Not a Rust test.

import { check, type DataError, type WorldData, worldDataCounts } from "@tc20ff/sim-data";
import { loadWorld, worldDataDir } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { errText } from "./helpers.ts";

/** pivot 5.1: the frozen vintage. */
const COUNTY_COUNT = 3142;
/** The 1990 census: the residents of the 50 states and DC. */
const US_POP_1990 = 248_709_873;

let cached: WorldData | undefined;

function world1995(): WorldData {
  if (cached === undefined) {
    const r = loadWorld(worldDataDir("1995"));
    if (!r.ok) throw new Error(errText(r.error));
    cached = r.value;
  }
  return structuredClone(cached);
}

/**
 * The county checks' messages after `edit` (the other tables are untouched, so they stay clean),
 * without the row counts, which an edit that drops a row also trips.
 */
function countyErrors(edit: (w: WorldData) => void): string[] {
  const w = world1995();
  edit(w);
  return check(w)
    .filter((e: DataError) => e.file === "counties.csv" || e.file === "county-adjacency.csv")
    .map(errText)
    .filter((e) => !/: \d+ rows, expected \d+$/.test(e));
}

describe("1995 counties", () => {
  it("loads the frozen vintage and passes every check", () => {
    const w = world1995();
    expect(w.manifest.features.counties).toBe(true);
    const counts = new Map(worldDataCounts(w));
    expect(counts.get("counties")).toBe(COUNTY_COUNT);
    expect(counts.get("county-adjacency")).toBe(w.county_adjacency.rows.length);
    expect(new Map(w.manifest.expected_counts).get("county-adjacency")).toBe(w.county_adjacency.rows.length);
    expect(check(w).map(errText)).toEqual([]);
    const fips = w.counties.rows.map((c) => c.fips);
    expect(fips).toEqual([...new Set(fips)].sort());
    expect(w.counties.rows.reduce((n, c) => n + c.pop_1990, 0)).toBe(US_POP_1990);
  });

  it("carries the vintage's merged, renamed and stand-in counties", () => {
    const by = new Map(world1995().counties.rows.map((c) => [c.fips, c] as const));
    // Bedford city VA and Clifton Forge VA are merged away; Shannon SD and Wade Hampton AK renumbered.
    for (const gone of ["51515", "51560", "46113", "02270", "12025"]) expect(by.has(gone), gone).toBe(false);
    expect(by.get("46102")?.name).toBe("Oglala Lakota County");
    expect(by.get("02158")?.name).toBe("Kusilvak Census Area");
    expect(by.get("08014")).toMatchObject({ state: "Colorado", name: "Broomfield County", pop_1990: 24638 });
    expect(by.get("11001")).toMatchObject({ state: "District of Columbia", lean_pts: 70 });
    // Every Alaska borough carries the state's lean (no borough returns).
    const alaska = [...by.values()].filter((c) => c.state === "Alaska");
    expect(alaska.length).toBe(29);
    expect(new Set(alaska.map((c) => c.lean_pts)).size).toBe(1);
    // Spread: nothing for a small rural county, the most for the largest urban one (pivot 5.4).
    expect(by.get("48301")?.spread).toBe(0);
    expect(by.get("06037")?.spread).toBe(45);
  });

  it("joins Hawaii's islands by ferry edges", () => {
    const pairs = new Set(world1995().county_adjacency.rows.map((r) => `${r.fips}-${r.neighbour_fips}`));
    for (const [a, b] of [
      ["15001", "15009"],
      ["15003", "15009"],
      ["15003", "15007"],
      ["15005", "15009"],
    ]) {
      expect(pairs.has(`${a}-${b}`) && pairs.has(`${b}-${a}`), `${a}-${b}`).toBe(true);
    }
  });

  it("names a county in no state, and a state with no county", () => {
    const errors = countyErrors((w) => {
      for (const c of w.counties.rows) if (c.state === "Delaware") c.state = "Atlantis";
    });
    expect(errors.some((e) => e.includes("Atlantis is not in politics-usa.csv"))).toBe(true);
    expect(errors).toContain("counties.csv: Delaware has no county");
  });

  it("holds each state's counties to its people and its lean", () => {
    const people = countyErrors((w) => {
      (w.counties.rows.find((c) => c.fips === "56021") as { pop_1990: number }).pop_1990 += 5000;
    });
    // More people in one county also moves the state's mean lean.
    expect(people.every((e) => e.startsWith("counties.csv: Wyoming: "))).toBe(true);
    expect(people[0]).toMatch(/^counties\.csv: Wyoming: its counties have \d+ people/);
    const lean = countyErrors((w) => {
      (w.counties.rows.find((c) => c.fips === "56021") as { lean_pts: number }).lean_pts += 1;
    });
    expect(lean.length).toBe(1);
    expect(lean[0]).toMatch(/^counties\.csv: Wyoming: mean county lean/);
  });

  it("holds lean, spread, turnout and elasticity to their ranges", () => {
    const errors = countyErrors((w) => {
      const c = w.counties.rows.find((r) => r.fips === "11001") as WorldData["counties"]["rows"][number];
      c.spread = 40; // lean 70 + 40 passes 100
      c.turnout = 0.9;
      c.elasticity = 0;
    });
    expect(errors.map((e) => /field `(\w+)`/.exec(e)?.[1])).toEqual(["spread", "elasticity", "turnout"]);
  });

  it("wants adjacency rows in both orders, between known counties, once", () => {
    const oneWay = countyErrors((w) => {
      const i = w.county_adjacency.rows.findIndex((r) => r.fips === "01001" && r.neighbour_fips === "01021");
      w.county_adjacency.rows.splice(i, 1);
      w.county_adjacency.lines.splice(i, 1);
    });
    expect(oneWay.length).toBe(1);
    expect(oneWay[0]).toContain("no row 01001-01021");
    const bad = countyErrors((w) => {
      const rows = w.county_adjacency.rows;
      (rows[0] as { neighbour_fips: string }).neighbour_fips = "99999";
      (rows[1] as { neighbour_fips: string }).neighbour_fips = (rows[1] as { fips: string }).fips;
      (rows[3] as { neighbour_fips: string }).neighbour_fips = (
        rows[2] as { neighbour_fips: string }
      ).neighbour_fips;
    });
    expect(bad.some((e) => e.includes("unknown county 99999"))).toBe(true);
    expect(bad.some((e) => e.includes("is its own neighbour"))).toBe(true);
    expect(bad.some((e) => e.includes("appears twice"))).toBe(true);
  });

  it("finds a state left in pieces", () => {
    const errors = countyErrors((w) => {
      const keep = w.county_adjacency.rows.map((r) => !(r.fips === "15007" || r.neighbour_fips === "15007"));
      w.county_adjacency.rows = w.county_adjacency.rows.filter((_, i) => keep[i]);
      w.county_adjacency.lines = w.county_adjacency.lines.filter((_, i) => keep[i]);
    });
    expect(errors).toEqual(['county-adjacency.csv: Hawaii is in pieces: no path to ["15007"]']);
  });
});
