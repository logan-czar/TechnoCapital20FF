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
} from "../src/map/model.ts";
import { clampView, FRAME_BOTTOM, FRAME_TOP, fitZoom, initialView, MAX_ZOOM } from "../src/map/view.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = resolve(repo, "docs/design/data");

function loadRows(): ProvinceRow[] {
  return readdirSync(dataDir)
    .filter((f) => /^provinces-[a-z-]+\.csv$/.test(f))
    .flatMap((f) => parseCsv(readFileSync(resolve(dataDir, f), "utf8")))
    .map((r) => ({ id: r.id ?? "", name: r.name ?? "", country: r.country ?? "" }));
}

const topology = JSON.parse(
  readFileSync(resolve(repo, "assets/map/provinces.topo.json"), "utf8"),
) as ProvinceTopology;
const rows = loadRows();

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
  const model = buildMapModel(topology, rows);

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

  it("assigns country ordinals by sorted code", () => {
    expect([...model.countries]).toEqual([...model.countries].sort());
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
        for (const [x, y] of ring as [number, number][]) {
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
    expect(() => buildMapModel(topology, [...rows, { id: "ZZ-9999", name: "x", country: "ZZZ" }])).toThrow(
      /no shape/,
    );
    expect(() => buildMapModel(topology, rows.slice(1))).toThrow(/no CSV row/);
  });
});

describe("country colors", () => {
  it("are deterministic and distinct for neighbouring ordinals", () => {
    expect(countryColor(7)).toEqual(countryColor(7));
    const seen = new Set(Array.from({ length: 60 }, (_, c) => countryColor(c).join(",")));
    expect(seen.size).toBe(60);
  });
  it("color every province by its country", () => {
    const model = buildMapModel(topology, rows);
    const a = politicalColors(model);
    expect(a).toEqual(politicalColors(model));
    expect(a.length).toBe(rows.length * 3);
    for (let i = 0; i < rows.length; i++) {
      expect([...a.subarray(i * 3, i * 3 + 3)]).toEqual([...countryColor(model.countryOf[i] as number)]);
    }
  });
});

describe("view limits", () => {
  it("fits the whole frame at the start", () => {
    const v = initialView(1600, 800);
    expect(v.zoom).toBeCloseTo(fitZoom(1600, 800));
    expect(clampView(v, 1600, 800)).toEqual(v);
  });
  it("clamps zoom and keeps the target in the frame", () => {
    const far = clampView({ target: [100, 100, 0], zoom: 50 }, 1000, 600);
    expect(far.zoom).toBe(MAX_ZOOM);
    const half = 1000 / 2 / 2 ** far.zoom;
    expect(far.target[0]).toBeCloseTo(Math.PI - half);
    const out = clampView({ target: [0, 0, 0], zoom: -20 }, 1000, 600);
    expect(out.zoom).toBeCloseTo(fitZoom(1000, 600));
  });
});
