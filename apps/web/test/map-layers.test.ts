// The map modes' pure parts (crates/game/src/map: modes.rs, colors.rs, pins.rs, labels.rs and
// picking.rs tests; D636, D640, D700 to D706): the mode state and steppers, the ramps, the legend,
// the pin layout, label placement and picking, on hand-built layers and a small model.

import type { CompanyId, IndustryId, MapLayer, MapPin, ProvinceId, ZoneId } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import {
  countryColor,
  layerColors,
  MUTED_SHARE,
  mix,
  RAMP_LOW,
  scalarColor,
  sectorColor,
  unitOf,
} from "../src/map/colors.ts";
import {
  type Anchor,
  groupAnchor,
  type LabelAnchors,
  labelBox,
  placeLabels,
  weightedMedian,
} from "../src/map/labels.ts";
import { legendDoc, SCALE_STOPS, scaleValue } from "../src/map/legend.ts";
import type { MapModel, ProvinceShape } from "../src/map/model.ts";
import {
  DEFAULT_MODE_STATE,
  hqCountries,
  listedLabel,
  modeOf,
  nextListed,
  setMode,
  stepIn,
  stepIndustry,
} from "../src/map/modes.ts";
import { pick, TINY_DOT_HIT_PX, TINY_TARGET_PX, tinyTargets } from "../src/map/picking.ts";
import { HUB_PIN_PX, hubLabel, PIN_MAX_PX, PIN_MIN_PX, pinLayout, pinPx, spread } from "../src/map/pins.ts";
import {
  FRAME_WIDTH,
  type MapViewState,
  panBy,
  pxPerBitmapPx,
  toMap,
  toScreen,
  type Viewport,
  zoomBy,
  zoomLevel,
} from "../src/map/view.ts";

const layer = (over: Partial<MapLayer>): MapLayer => ({
  mode: { kind: "Political" },
  values: { kind: "Categories", values: [] },
  style: "Political",
  scale: null,
  hatched: [],
  legend: [],
  pins: [],
  notes: [],
  ...over,
});

const hq = (company: number, province: number, size: number, category = 0): MapPin => ({
  province: province as ProvinceId,
  target: { kind: "Company", company: company as CompanyId },
  size,
  category,
  code: "",
  level: null,
});

describe("map modes (D700)", () => {
  it("steps wrap through none", () => {
    const opts = [3, 5, 9];
    expect(stepIn(null, 1, opts)).toBe(3);
    expect(stepIn(9, 1, opts)).toBe(null);
    expect(stepIn(null, -1, opts)).toBe(9);
    expect(stepIn(3, -1, opts)).toBe(null);
    expect(stepIndustry(null, 1, 4)).toBe(0);
    expect(stepIndustry(3 as IndustryId, 1, 4)).toBe(null);
  });
  it("a mode keeps its parameter", () => {
    let s = setMode(DEFAULT_MODE_STATE, { kind: "Development", track: "Commerce" });
    s = setMode(s, { kind: "Political" });
    expect(modeOf(s, "Development")).toEqual({ kind: "Development", track: "Commerce" });
    s = setMode(s, { kind: "CompanyHqs", filter: { industry: null, country: null, listed: true } });
    s = setMode(s, { kind: "FinancialZones" });
    expect(modeOf(s, "CompanyHqs")).toEqual({
      kind: "CompanyHqs",
      filter: { industry: null, country: null, listed: true },
    });
  });
  it("cycles the listed filter all, listed, private", () => {
    expect([nextListed(null), nextListed(true), nextListed(false)]).toEqual([true, false, null]);
    expect(listedLabel(false)).toBe("Private only");
  });
  it("lists the HQ countries sorted and once each", () => {
    const h = (country: number) => ({ country }) as never;
    expect(hqCountries({ hqs: [h(5), h(2), h(5), h(0)] })).toEqual([0, 2, 5]);
  });
});

describe("map colors (D702)", () => {
  it("sectors differ and stand out", () => {
    const c = Array.from({ length: 7 }, (_, i) => sectorColor(i).join(","));
    expect(new Set(c).size).toBe(7);
    for (let i = 0; i < 7; i++) expect(Math.max(...sectorColor(i))).toBeGreaterThan(150);
  });
  it("ramps run from dark to the accent; the zone ramp diverges", () => {
    const s = { low: 0, high: 30, unit: "Points" as const, label: "" };
    const dev = { kind: "Development", track: "Total" } as const;
    expect(unitOf(s, 0)).toBe(0);
    expect(unitOf(s, 30)).toBe(1);
    expect(scalarColor("Sequential", dev, 0)).toEqual(RAMP_LOW);
    const d = { low: -0.2, high: 0.2, unit: "Rate" as const, label: "" };
    expect(unitOf(d, -0.2)).toBe(-1);
    expect(unitOf(d, 0)).toBe(0);
    const neg = scalarColor("Diverging", { kind: "FinancialZones" }, -1);
    const pos = scalarColor("Diverging", { kind: "FinancialZones" }, 1);
    expect(neg[0]).toBeGreaterThan(neg[1]);
    expect(pos[2]).toBeGreaterThan(pos[0]);
  });
  it("money goes by square root, so small holdings show", () => {
    const s = { low: 0, high: 100, unit: "Money" as const, label: "" };
    expect(unitOf(s, 25)).toBeCloseTo(0.5);
  });
  it("mutes the countries under the HQ pins", () => {
    const l = layer({ style: "Muted", values: { kind: "Categories", values: [4] } });
    expect([...layerColors(l, 1)]).toEqual([...mix(RAMP_LOW, countryColor(4), MUTED_SHARE)]);
  });
  it("colors an industry's assets amber and development green", () => {
    const scale = { low: 0, high: 1, unit: "Points" as const, label: "" };
    const top = (mode: MapLayer["mode"]) => [
      ...layerColors(
        layer({ mode, style: "Sequential", scale, values: { kind: "Scalars", values: [1] } }),
        1,
      ),
    ];
    const amber = top({ kind: "Industry", industry: 2 as IndustryId });
    const green = top({ kind: "Development", track: "Total" });
    expect(amber[0]).toBeGreaterThan(amber[2] as number);
    expect(green[1]).toBeGreaterThan(green[0] as number);
  });
});

describe("map legend (D702, D705)", () => {
  it("counts countries in Political", () => {
    const doc = legendDoc(
      layer({
        legend: [
          { value: 0, label: "A" },
          { value: 1, label: "B" },
        ],
      }),
      false,
    );
    expect(doc.title).toBe("Political: provinces by country");
    expect(doc.rows.map((r) => r[1])).toEqual(["2 countries, a colour each", "Contested (hatched)"]);
  });
  it("lists sectors and the HQs shown, and the Metro swatch when on", () => {
    const l = layer({
      mode: { kind: "CompanyHqs", filter: { industry: null, country: null, listed: null } },
      style: "Muted",
      legend: [{ value: 0, label: "Tech" }],
      pins: [hq(1, 0, 1e9)],
    });
    const doc = legendDoc(l, true);
    expect(doc.rows.map((r) => r[1])).toEqual([
      "Tech",
      "1 HQs shown",
      "Private: sized by the estimate",
      "Contested (hatched)",
      "Metro outline",
    ]);
  });
  it("writes a scale's stops high to low, then the notes and the hubs", () => {
    const l = layer({
      mode: { kind: "FinancialZones" },
      style: "Diverging",
      scale: { low: -0.02, high: 0.02, unit: "Rate", label: "Zone effect" },
      notes: [["Global phase", "Expansion"]],
    });
    const doc = legendDoc(l, false);
    expect(doc.title).toBe("Zone effect");
    expect(doc.rows.slice(0, SCALE_STOPS).map((r) => r[1])).toEqual([
      "+0.020",
      "+0.010",
      "+0.000",
      "-0.010",
      "-0.020",
    ]);
    expect(doc.rows[SCALE_STOPS]?.[1]).toBe("Global phase: Expansion");
    expect(doc.rows[SCALE_STOPS + 1]?.[1]).toBe("0 hubs: exchange and index level");
    expect(scaleValue("Points", 29.6)).toBe("30");
    expect(scaleValue("Money", 2.5e9)).toBe("$2.50B");
  });
});

describe("map pins (D703)", () => {
  it("grow with revenue within bounds", () => {
    expect(pinPx(0)).toBe(PIN_MIN_PX);
    expect(pinPx(1e9)).toBeGreaterThan(pinPx(1e8));
    expect(pinPx(1e11)).toBeGreaterThan(pinPx(1e9));
    expect(pinPx(1e15)).toBe(PIN_MAX_PX);
    expect(pinPx(-5)).toBe(PIN_MIN_PX);
  });
  it("spread a province's pins largest first, the largest in the middle", () => {
    const l = pinLayout([hq(1, 7, 1e8), hq(2, 7, 5e9), hq(3, 7, 1e7), hq(4, 2, 1e6)]);
    expect(l.map((p) => (p.pin.target.kind === "Company" ? p.pin.target.company : -1))).toEqual([4, 2, 1, 3]);
    expect(l[1]?.offset).toEqual([0, 0]);
    expect(Math.hypot(...(l[2]?.offset ?? [0, 0]))).toBeGreaterThan(0);
    expect(l[2]?.offset).not.toEqual(l[3]?.offset);
    expect(spread(0)).toEqual([0, 0]);
  });
  it("draws hubs at a fixed size with their code and level", () => {
    const hub: MapPin = {
      province: 1 as ProvinceId,
      target: { kind: "Exchange", zone: 0 as ZoneId },
      size: 0,
      category: 0,
      code: "NYX",
      level: 1234.56,
    };
    expect(pinLayout([hub])[0]?.diameter).toBe(HUB_PIN_PX);
    expect(hubLabel(hub)).toBe("NYX 1,234.6");
    expect(hubLabel({ ...hub, level: null })).toBe("NYX -");
  });
});

/** A small model: shapes only (labels and picking read nothing else). */
function shapes(list: (Partial<ProvinceShape> & { label: [number, number] })[]): Pick<MapModel, "shapes"> {
  return {
    shapes: list.map((s) => ({ centroid: s.label, areaPx: 1000, tiny: false, ...s })),
  };
}

const vpAt = (view: MapViewState, width = 1000, height = 500): Viewport => ({ view, width, height });

describe("map camera (D636)", () => {
  it("projects to the screen and back, wrapping to the nearest copy", () => {
    const vp = vpAt({ target: [0, 0, 0], zoom: 8 });
    expect(toScreen(vp, [0, 0])).toEqual([500, 250]);
    const s = toScreen(vp, [0.5, -0.25]);
    const m = toMap(vp, s);
    expect(m[0]).toBeCloseTo(0.5);
    expect(m[1]).toBeCloseTo(-0.25);
    // a point one map width east shows at the same place
    expect(toScreen(vp, [FRAME_WIDTH + 0.5, -0.25])[0]).toBeCloseTo(s[0]);
  });
  it("names the zoom levels by the degrees the view spans", () => {
    expect(zoomLevel(200)).toBe("World");
    expect(zoomLevel(60)).toBe("Country");
    expect(zoomLevel(10)).toBe("Province");
  });
  it("zooms by a wheel step about the centre and pans with the keys", () => {
    const vp = vpAt({ target: [0, 0, 0], zoom: 9 });
    const z = zoomBy(vp, 1);
    expect(2 ** (z.zoom - 9)).toBeCloseTo(1.25);
    expect(z.target[0]).toBe(0);
    const p = panBy(vp, 100, 0);
    // A (positive dx) moves the map right: the centre goes west
    expect(p.target[0]).toBeLessThan(0);
    expect(p.target[0]).toBeCloseTo(-100 / 2 ** 9);
  });
});

describe("map labels (D706)", () => {
  it("the weighted median resists far outliers", () => {
    expect(
      weightedMedian([
        [10, 50],
        [12, 40],
        [900, 30],
      ]),
    ).toBe(12);
  });
  it("boxes overlap only when they meet", () => {
    const a = labelBox("Country", "Canada", [100, 100], 1);
    const b = labelBox("Country", "Canada", [100, 200], 1);
    expect(a[3] < b[1]).toBe(true);
    expect(a[2] - a[0]).toBeCloseTo(6 * 14 * 0.6);
  });
  it("anchors a group on a member's label point, across the antimeridian", () => {
    const m = shapes([
      { label: [3.1, 0], areaPx: 500 },
      { label: [-3.1, 0], areaPx: 400 },
      { label: [0, 0], areaPx: 10 },
    ]);
    const g = groupAnchor(m, [0, 1, 2]);
    expect(g?.[1]).toBe(910);
    // the far member at 0 is not the anchor: the group sits at the antimeridian
    expect(g?.[0][0]).not.toBe(0);
  });
  it("places by priority, inside the view, never overlapping a label or a blocked rectangle", () => {
    const a = (text: string, at: [number, number], weight: number): Anchor => ({
      kind: "Country",
      text,
      at,
      weight,
      area: 1e6,
    });
    const anchors: LabelAnchors = {
      World: [a("Big", [0, 0], 3), a("Clash", [0.001, 0], 2), a("Far", [1, 0.5], 1), a("Off", [3.1, 0], 0)],
      Country: [],
      Province: [],
    };
    const vp = vpAt({ target: [0, 0, 0], zoom: Math.log2(1000 / FRAME_WIDTH) + 0.2 });
    expect(zoomLevel((1000 / 2 ** vp.view.zoom / FRAME_WIDTH) * 360)).toBe("World");
    expect(placeLabels(anchors, vp, 1, []).map((p) => p.text)).toEqual(["Big", "Far"]);
    const far = toScreen(vp, [1, 0.5]);
    const blocked: [number, number, number, number] = [far[0] - 5, far[1] - 5, far[0] + 5, far[1] + 5];
    expect(placeLabels(anchors, vp, 1, [blocked]).map((p) => p.text)).toEqual(["Big"]);
  });
  it("skips a place too small at this zoom", () => {
    const anchors: LabelAnchors = {
      World: [{ kind: "Country", text: "Speck", at: [0, 0], weight: 1, area: 1 }],
      Country: [],
      Province: [],
    };
    const vp = vpAt({ target: [0, 0, 0], zoom: Math.log2(1000 / FRAME_WIDTH) });
    expect(pxPerBitmapPx(vp.view.zoom) ** 2).toBeLessThan(300);
    expect(placeLabels(anchors, vp, 1, [])).toEqual([]);
  });
});

describe("map picking (D640)", () => {
  const vp = vpAt({ target: [0, 0, 0], zoom: 10 });
  const at = (dx: number, dy: number): [number, number] => [500 + dx, 250 + dy];
  // a tiny province with its dot at the view's centre, and a large one
  const model = shapes([
    { label: [0, 0], tiny: true, areaPx: 2 },
    { label: [0.1, 0], areaPx: 1e6 },
    { label: [0.2, 0], areaPx: 1 },
  ]);
  const tiny = tinyTargets(model);
  it("lists the tiny targets", () => {
    expect(tiny.map(([id]) => id)).toEqual([0]);
  });
  it("a click on a tiny province's dot always picks it", () => {
    expect(pick(vp, at(TINY_DOT_HIT_PX - 1, 0), 1, model, tiny)).toBe(0);
  });
  it("its wider target never steals a click from a province big enough to click", () => {
    expect(pick(vp, at(TINY_TARGET_PX - 1, 0), 1, model, tiny)).toBe(1);
  });
  it("it wins over water and over a speck", () => {
    expect(pick(vp, at(TINY_TARGET_PX - 1, 0), null, model, tiny)).toBe(0);
    expect(pick(vp, at(TINY_TARGET_PX - 1, 0), 2, model, tiny)).toBe(0);
    expect(pick(vp, at(TINY_TARGET_PX + 5, 0), 2, model, tiny)).toBe(2);
    expect(pick(vp, at(TINY_TARGET_PX + 5, 0), null, model, tiny)).toBe(null);
  });
});
