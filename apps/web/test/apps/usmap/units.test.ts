// The USA map's pure parts (D1048): district borders derived from a plan on a small synthetic map,
// the layers' colour functions, the hidden lean, and the route codec.

import type {
  CountyId,
  DistrictsView,
  RaceCountyReturns,
  RaceId,
  UsMapCounties,
  UsStateId,
} from "@tc20ff/sim";
import { districtRefId } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import { bordersBetween, outlineOf, planIndex, stateBorders } from "../../../src/apps/usmap/borders.ts";
import type { Edge, XY } from "../../../src/apps/usmap/geometry.ts";
import {
  countsByCounty,
  formatInt,
  GROUND_RGB,
  LIVE_ALPHA_MIN,
  layerChoices,
  leaderOf,
  marginRgb,
  NO_DATA_RGB,
  OUTSIDE_ALPHA,
  PARTY_A_RGB,
  PARTY_B_RGB,
  paintDistricts,
  paintLean,
  paintLive,
  paintPopulation,
  paintPresident,
} from "../../../src/apps/usmap/layers.ts";
import { countyOfKey, formatRoute, HOME, parseRoute } from "../../../src/apps/usmap/route.ts";

// A 3 by 2 grid of square counties, ids row by row:
//   0 1 2
//   3 4 5
// in one state (7). Edges are the unit sides, each with its two counties (or -1 outside).
function grid(): Edge[] {
  const edges: Edge[] = [];
  const at = (c: number, r: number) => (c < 0 || c > 2 || r < 0 || r > 1 ? -1 : r * 3 + c);
  for (let r = 0; r < 2; r++)
    for (let c = 0; c <= 3; c++) {
      const a = at(c - 1, r);
      const b = at(c, r);
      const path: XY[] = [
        [c, r],
        [c, r + 1],
      ];
      if (a >= 0 || b >= 0) edges.push(a >= 0 ? { path, a, b } : { path, a: b, b: -1 });
    }
  for (let r = 0; r <= 2; r++)
    for (let c = 0; c < 3; c++) {
      const a = at(c, r - 1);
      const b = at(c, r);
      const path: XY[] = [
        [c, r],
        [c + 1, r],
      ];
      edges.push(a >= 0 ? { path, a, b } : { path, a: b, b: -1 });
    }
  return edges;
}

const share = (county: number, from = 0, to = 1) => ({ county: county as CountyId, from, to });

function plan(districts: { number: number; shares: ReturnType<typeof share>[] }[]): DistrictsView {
  const state = 7 as UsStateId;
  return {
    plans: [
      {
        state,
        census_year: 2010,
        since: { year: 2012, month: 1, day: 3 },
        drawn_by: null,
        struck: false,
        strength: null,
      },
    ],
    districts: districts.map((d) => ({
      id: districtRefId(state, d.number),
      state,
      number: d.number,
      shares: d.shares,
      population: 0,
      member: null,
      lean: null,
    })),
  };
}

const key = (p: XY[]) => p.map((x) => x.join(",")).join(" ");

describe("district borders from a plan", () => {
  it("are the edges between counties of different districts, and move with the plan", () => {
    const edges = grid();
    // District 1: the left column and the middle; district 2: the right column.
    const a = planIndex(
      plan([
        { number: 1, shares: [share(0), share(1), share(3), share(4)] },
        { number: 2, shares: [share(2), share(5)] },
      ]),
      6,
    );
    expect([...a.district]).toEqual([701, 701, 702, 701, 701, 702]);
    expect(a.split).toEqual([]);
    expect(bordersBetween(edges, a.district).map(key).sort()).toEqual(["2,0 2,1", "2,1 2,2"]);
    // Redrawn: top row against bottom row.
    const b = planIndex(
      plan([
        { number: 1, shares: [share(0), share(1), share(2)] },
        { number: 2, shares: [share(3), share(4), share(5)] },
      ]),
      6,
    );
    expect(bordersBetween(edges, b.district).map(key).sort()).toEqual(["0,1 1,1", "1,1 2,1", "2,1 3,1"]);
    // Outside edges and the state's own outline are not district borders.
    expect(stateBorders(edges, [7, 7, 7, 7, 7, 7]).length).toBe(10);
    expect(outlineOf(edges, (c) => b.district[c] === 701).length).toBe(3 + 2 + 3);
  });

  it("puts a split county in its largest share's district and lists its pieces", () => {
    const p = planIndex(
      plan([
        { number: 1, shares: [share(0), share(1), share(4, 0, 0.3)] },
        { number: 2, shares: [share(2), share(3), share(4, 0.3, 1), share(5)] },
      ]),
      6,
    );
    expect(p.district[4]).toBe(702);
    expect(p.split).toEqual([4]);
    expect(p.pieces[4]?.map((x) => [x.district, Number(x.share.toFixed(2))])).toEqual([
      [702, 0.7],
      [701, 0.3],
    ]);
    expect(p.counties.get(701)).toEqual([0, 1, 4]);
    // No plan: no districts, no borders.
    const none = planIndex(undefined, 6);
    expect([...none.district].every((d) => d === -1)).toBe(true);
    expect(bordersBetween(grid(), none.district)).toEqual([]);
  });

  it("keeps borders between states for the state layer only", () => {
    const edges = grid();
    const d = new Int32Array([1, 1, 2, 3, 3, 4]);
    const states = [1, 1, 2, 1, 1, 3];
    const sameState = (a: number, b: number) => states[a] === states[b];
    // Counties 2 and 5 are each their own state: their edges are state borders, not district ones.
    expect(bordersBetween(edges, d, sameState).map(key).sort()).toEqual(["0,1 1,1", "1,1 2,1"]);
  });
});

function counties(over: Partial<UsMapCounties> = {}): UsMapCounties {
  return {
    fips: ["01001", "01003", "01005"],
    state: [1, 1, 1],
    name: ["A", "B", "C"],
    population: [1000, 100_000, 5_000_000],
    district: [1, 1, 2],
    turnout: [0.3, 0.45, 0.6],
    last_votes: [0, 0, 0],
    last_winner: [null, null, null],
    last_margin: [null, null, null],
    lean: null,
    ...over,
  };
}

const rgbaAt = (out: Uint8Array, i: number) => [...out.subarray(4 * i, 4 * i + 4)];

describe("layer colours", () => {
  it("the last presidential vote: winner's colour by margin, no data before one", () => {
    const out = new Uint8Array(12);
    paintPresident(
      out,
      counties({ last_winner: ["Democrats", "Republicans", null], last_margin: [40, -2, null] }),
    );
    expect(rgbaAt(out, 0)).toEqual([...PARTY_A_RGB, 255]);
    const b = rgbaAt(out, 1);
    // A narrow Republican win: pinker than the ground, short of full.
    expect(b[0]).toBeGreaterThan(GROUND_RGB[0]);
    expect(b[0]).toBeLessThan(PARTY_B_RGB[0]);
    expect(rgbaAt(out, 2)).toEqual([...NO_DATA_RGB, 255]);
    expect(marginRgb(-40)).toEqual(PARTY_B_RGB);
  });

  it("population rises with people", () => {
    const out = new Uint8Array(12);
    paintPopulation(out, counties());
    const lum = (i: number) => (out[4 * i] as number) + (out[4 * i + 1] as number);
    expect(lum(0)).toBeLessThan(lum(1));
    expect(lum(1)).toBeLessThan(lum(2));
  });

  it("districts take the holder's party; vacant and unknown are plain", () => {
    const out = new Uint8Array(16);
    const party = (id: number) =>
      id === 701 ? "Democrats" : id === 702 ? "Republicans" : id === 703 ? null : undefined;
    paintDistricts(out, new Int32Array([701, 702, 704, -1]), party);
    expect((out[2] as number) > (out[0] as number)).toBe(true); // blue
    expect((out[4] as number) > (out[6] as number)).toBe(true); // pink
    expect(rgbaAt(out, 3)).toEqual([...NO_DATA_RGB, 255]);
  });

  it("live returns: leader's colour, opacity by the share reported, outside the race dimmed", () => {
    const slice: RaceCountyReturns = {
      race: 3 as RaceId,
      counties: [0, 1, 1].map((c) => c as CountyId),
      reporting: [1, 0, 0.5],
      votes: [
        [600, 400],
        [0, 0],
        [100, 300],
      ],
    };
    const counts = countsByCounty(slice, 3);
    expect(counts[1]).toEqual({ votes: [100, 300], reporting: 0.5 });
    expect(counts[2]).toBeNull();
    const out = new Uint8Array(12);
    paintLive(out, 3, counts, ["Democrats", "Republicans"]);
    expect(out[3]).toBe(255);
    expect(out[0]).toBeLessThan(out[2] as number); // party A leads county 0: blue
    expect(out[4]).toBeGreaterThan(out[6] as number); // party B leads county 1: pink
    expect(out[7]).toBe(Math.floor(LIVE_ALPHA_MIN + (255 - LIVE_ALPHA_MIN) * 0.5 + 0.5));
    expect(out[11]).toBe(OUTSIDE_ALPHA);
    expect(leaderOf([0, 0])).toBeNull();
    expect(leaderOf([10, 30, 20])).toEqual({ lead: 1, margin: (10 / 60) * 100, total: 60 });
  });

  it("formats whole numbers without a locale", () => {
    expect(formatInt(1234567)).toBe("1,234,567");
    expect(formatInt(999)).toBe("999");
    expect(formatInt(-4200)).toBe("-4,200");
  });
});

describe("the hidden lean (pivot 5.11)", () => {
  it("is offered and painted only when the view carries it", () => {
    const hidden = { counties: counties(), states: [] };
    expect(layerChoices(hidden)).not.toContain("lean");
    expect(paintLean(new Uint8Array(12), hidden.counties)).toBe(false);
    const shown = { counties: counties({ lean: [10, -10, 0] }), states: [] };
    expect(layerChoices(shown)).toContain("lean");
    const out = new Uint8Array(12);
    expect(paintLean(out, shown.counties)).toBe(true);
    expect((out[2] as number) > (out[0] as number)).toBe(true);
  });
});

describe("the route codec", () => {
  it("reads and writes every route", () => {
    const cases: [string | null, ReturnType<typeof parseRoute>][] = [
      [null, HOME],
      ["state/12", { layer: "president", race: null, sel: { kind: "state", id: 12 } }],
      ["district/1203", { layer: "president", race: null, sel: { kind: "district", id: 1203 } }],
      ["county/19153", { layer: "president", race: null, sel: { kind: "county", key: "19153" } }],
      ["race/7/live", { layer: "live", race: 7, sel: null }],
      ["race/0/live/state/4", { layer: "live", race: 0, sel: { kind: "state", id: 4 } }],
      ["layer/turnout", { layer: "turnout", race: null, sel: null }],
      [
        "county/01001/layer/districts",
        { layer: "districts", race: null, sel: { kind: "county", key: "01001" } },
      ],
      ["layer/live", { layer: "live", race: null, sel: null }],
    ];
    for (const [s, r] of cases) {
      expect(parseRoute(s), String(s)).toEqual(r);
      expect(formatRoute(r), String(s)).toBe(s);
    }
  });

  it("drops what it cannot read", () => {
    expect(parseRoute("nonsense")).toEqual(HOME);
    expect(parseRoute("state/x")).toEqual(HOME);
    expect(parseRoute("layer/unknown")).toEqual(HOME);
    expect(parseRoute("race/3/dead")).toEqual(HOME);
    // A race fixes the layer.
    expect(parseRoute("race/3/live/layer/turnout").layer).toBe("live");
  });

  it("finds a county by its code or by an EntityRef's index", () => {
    const fips = ["01001", "01003"];
    expect(countyOfKey("01003", fips)).toBe(1);
    expect(countyOfKey("1", fips)).toBe(1);
    expect(countyOfKey("99999", fips)).toBe(-1);
    expect(countyOfKey("7", fips)).toBe(-1);
  });
});
