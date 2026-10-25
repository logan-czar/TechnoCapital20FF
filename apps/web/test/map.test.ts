import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { countryColor, politicalColors } from "../src/map/colors.ts";
import { parseCsv } from "../src/map/csv.ts";
import {
  buildMapModel,
  type ProvinceRow,
  type ProvinceTopology,
  provinceOrdinals,
  type XY,
} from "../src/map/model.ts";
import {
  clampView,
  FRAME_BOTTOM,
  FRAME_TOP,
  FRAME_WIDTH,
  fitZoom,
  initialView,
  MAX_ZOOM,
  provinceLineAlpha,
  pxToMiller,
  spanDeg,
  wrapX,
} from "../src/map/view.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = resolve(repo, "docs/design/data");
const readCsv = (path: string) => parseCsv(readFileSync(path, "utf8"));

function loadRows(): ProvinceRow[] {
  return readdirSync(dataDir)
    .filter((f) => /^provinces-[a-z-]+\.csv$/.test(f))
    .flatMap((f) => readCsv(resolve(dataDir, f)))
    .map((r) => ({ id: r.id ?? "", name: r.name ?? "", country: r.country ?? "" }));
}

const topology = JSON.parse(
  readFileSync(resolve(repo, "assets/map/provinces.topo.json"), "utf8"),
) as ProvinceTopology;
const rows = loadRows();
const countryCodes = readCsv(resolve(dataDir, "countries.csv")).map((r) => r.iso3 ?? "");

/** Even-odd point-in-polygon over a ring set (outer ring and holes). */
function inside(polygon: XY[][], x: number, y: number): boolean {
  let hit = false;
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] as XY;
      const [xj, yj] = ring[j] as XY;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

describe("csv", () => {
  it("reads quoted fields, doubled quotes and CRLF", () => {
    expect(parseCsv('a,b\r\n1,"x, ""y"""\r\n\r\n2,\r\n')).toEqual([
      { a: "1", b: 'x, "y"' },
      { a: "2", b: "" },
    ]);
  });
});

describe("province ordinals", () => {
  it("number ids in ascending byte order", () => {
    const o = provinceOrdinals(["US-0002", "GB-0001", "US-0001", "AD-0001"]);
    expect([...o.entries()]).toEqual([
      ["AD-0001", 0],
      ["GB-0001", 1],
      ["US-0001", 2],
      ["US-0002", 3],
    ]);
  });
  it("reject a duplicate id", () => {
    expect(() => provinceOrdinals(["A-1", "A-1"])).toThrow(/duplicate/);
  });
});

describe("map model on the committed assets", () => {
  const model = buildMapModel(topology, rows, countryCodes);

  it("has one shape for every CSV province", () => {
    expect(rows.length).toBe(3963);
    expect(model.rows.length).toBe(rows.length);
    const ids = topology.objects.provinces.geometries.map((g) => g.properties?.province_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(rows.map((r) => r.id)));
    for (const parts of model.partsOf) expect(parts.length).toBeGreaterThan(0);
  });

  it("orders rows by ascending id and maps each part to its ordinal", () => {
    for (let i = 1; i < model.rows.length; i++) {
      expect((model.rows[i - 1] as ProvinceRow).id < (model.rows[i] as ProvinceRow).id).toBe(true);
    }
    model.partsOf.forEach((parts, i) => {
      for (const p of parts) expect(p.ordinal).toBe(i);
    });
    expect(model.parts.length).toBe(model.partsOf.flat().length);
  });

  it("assigns country ordinals by sorted countries.csv iso3", () => {
    expect(model.countries).toEqual([...countryCodes].sort());
    model.rows.forEach((r, i) => {
      expect(model.countries[model.countryOf[i] as number]).toBe(r.country);
    });
  });

  it("draws country borders as a proper subset of all borders", () => {
    expect(model.countryBorders.length).toBeGreaterThan(0);
    expect(model.countryBorders.length).toBeLessThan(model.borders.length);
  });

  it("stays inside the Miller frame", () => {
    let maxX = 0;
    let maxY = -Infinity;
    let minY = Infinity;
    for (const p of model.parts) {
      for (const ring of p.polygon) {
        for (const [x, y] of ring) {
          maxX = Math.max(maxX, Math.abs(x));
          maxY = Math.max(maxY, y);
          minY = Math.min(minY, y);
        }
      }
    }
    expect(maxX).toBeLessThanOrEqual(Math.PI + 1e-3);
    expect(maxY).toBeLessThanOrEqual(FRAME_TOP + 1e-3);
    expect(minY).toBeGreaterThanOrEqual(FRAME_BOTTOM - 1);
  });

  it("throws on a CSV row without a shape or a shape without a row", () => {
    const extra = { id: "ZZ-9999", name: "x", country: model.countries[0] ?? "" };
    expect(() => buildMapModel(topology, [...rows, extra], countryCodes)).toThrow(/no shape/);
    expect(() => buildMapModel(topology, rows.slice(1), countryCodes)).toThrow(/no CSV row/);
  });

  it("throws on a country missing from countries.csv", () => {
    expect(() => buildMapModel(topology, rows, countryCodes.slice(1))).toThrow(/not in countries.csv/);
  });

  it("throws when a province has no polygon (null geometry)", () => {
    const [first, ...rest] = topology.objects.provinces.geometries;
    const broken = {
      ...topology,
      objects: {
        provinces: {
          ...topology.objects.provinces,
          geometries: [{ type: null, properties: first?.properties }, ...rest],
        },
      },
    } as unknown as ProvinceTopology;
    expect(() => buildMapModel(broken, rows, countryCodes)).toThrow(/no polygon/);
  });

  it("finds the province under a known point (the pick the map click resolves)", () => {
    // province-centroids.csv label points are bitmap pixels; a non-tiny province holds its label point
    const centroids = readCsv(resolve(repo, "assets/map/province-centroids.csv"));
    const ordinals = provinceOrdinals(rows.map((r) => r.id));
    let checked = 0;
    let hits = 0;
    for (const c of centroids) {
      if (c.tiny === "Y") continue;
      const [x, y] = pxToMiller(Number(c.label_x), Number(c.label_y));
      const ordinal = ordinals.get(c.province_id ?? "") as number;
      checked++;
      if ((model.partsOf[ordinal] ?? []).some((p) => inside(p.polygon, x, y))) hits++;
    }
    expect(checked).toBeGreaterThan(3000);
    expect(hits / checked).toBeGreaterThan(0.99);
  });
});

describe("country colors", () => {
  it("are deterministic and distinct for neighbouring ordinals", () => {
    expect(countryColor(7)).toEqual(countryColor(7));
    const seen = new Set(Array.from({ length: 60 }, (_, c) => countryColor(c).join(",")));
    expect(seen.size).toBe(60);
  });
  it("color every province by its country", () => {
    const model = buildMapModel(topology, rows, countryCodes);
    const a = politicalColors(model);
    expect(a).toEqual(politicalColors(model));
    expect(a.length).toBe(rows.length * 3);
    for (let i = 0; i < rows.length; i++) {
      expect([...a.subarray(i * 3, i * 3 + 3)]).toEqual([...countryColor(model.countryOf[i] as number)]);
    }
  });
});

describe("view limits", () => {
  it("fits the map width at the farthest zoom, whatever the height", () => {
    expect(fitZoom(1600, 800)).toBeCloseTo(Math.log2(1600 / FRAME_WIDTH));
    expect(fitZoom(400, 2000)).toBeCloseTo(Math.log2(400 / FRAME_WIDTH));
    expect(spanDeg(fitZoom(1234, 500), 1234)).toBeCloseTo(360);
  });
  it("starts centred at the farthest zoom", () => {
    const v = initialView(1600, 800);
    expect(v.zoom).toBeCloseTo(fitZoom(1600, 800));
    expect(clampView(v, 1600, 800)).toEqual(v);
  });
  it("centres y when the whole height shows (a tall panel)", () => {
    const v = clampView({ target: [0, 3, 0], zoom: -20 }, 400, 2000);
    expect(v.target[1]).toBeCloseTo((FRAME_TOP + FRAME_BOTTOM) / 2);
  });
  it("wraps x east to west", () => {
    expect(wrapX(Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5);
    expect(wrapX(-Math.PI - 0.5)).toBeCloseTo(Math.PI - 0.5);
    expect(wrapX(3 * FRAME_WIDTH + 1)).toBeCloseTo(1);
    const v = clampView({ target: [Math.PI + 1, 0, 0], zoom: 3 }, 1000, 600);
    expect(v.target[0]).toBeCloseTo(-Math.PI + 1);
  });
  it("clamps zoom and keeps y in the frame", () => {
    const far = clampView({ target: [0, 100, 0], zoom: 50 }, 1000, 600);
    expect(far.zoom).toBe(MAX_ZOOM);
    const halfH = 600 / 2 / 2 ** far.zoom;
    expect(far.target[1]).toBeCloseTo(FRAME_TOP - halfH);
    expect(clampView({ target: [0, 0, 0], zoom: -20 }, 1000, 600).zoom).toBeCloseTo(fitZoom(1000, 600));
  });
  it("converts bitmap pixels to Miller units", () => {
    expect(pxToMiller(0, 0)).toEqual([-Math.PI, FRAME_TOP]);
    const [x, y] = pxToMiller(4096, 2048);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo((FRAME_TOP + FRAME_BOTTOM) / 2);
  });
  it("fades province lines in from 56 to 28 degrees of longitude", () => {
    expect(provinceLineAlpha(360)).toBe(0);
    expect(provinceLineAlpha(56)).toBe(0);
    expect(provinceLineAlpha(42)).toBeCloseTo(0.5);
    expect(provinceLineAlpha(28)).toBe(1);
    expect(provinceLineAlpha(5)).toBe(1);
  });
});
