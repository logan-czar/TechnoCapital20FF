// The parts of mapgen on their own: the fill, the distance transform, the frame, the sea links, the
// seam unwrap, exclaves, colours, number formatting and the PNG writer (ported from the Rust crate's
// unit tests, D1017).

import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { colorsFor, provinceStats, unwrapShift } from "../src/build.ts";
import { distance } from "../src/edt.ts";
import { fixed } from "../src/fmt.ts";
import { interiorPoint, unsignedArea } from "../src/geo.ts";
import { encodePng, parseCsv } from "../src/io.ts";
import { Frame } from "../src/miller.ts";
import { fillRings } from "../src/raster.ts";
import { pairKey, seaLinks, steps } from "../src/sea.ts";

describe("fillRings", () => {
  const count = (rings: number[][]) => {
    const px: string[] = [];
    fillRings(
      16,
      16,
      rings.map((r) => Float64Array.from(r)),
      (x, y) => px.push(`${x},${y}`),
    );
    return px;
  };

  it("takes the pixels whose centres a square covers", () => {
    const px = count([[2, 2, 6, 2, 6, 5, 2, 5]]);
    expect(px.length).toBe(12);
    expect(px).toContain("2,2");
    expect(px).toContain("5,4");
    expect(px).not.toContain("6,2");
  });

  it("gives neighbours no shared pixel and no gap", () => {
    const a = count([[1, 1, 4.3, 1, 4.3, 6, 1, 6]]);
    const b = count([[4.3, 1, 9, 1, 9, 6, 4.3, 6]]);
    expect(a.filter((p) => b.includes(p))).toEqual([]);
    expect(a.length + b.length).toBe(8 * 5);
  });

  it("leaves a hole empty", () => {
    expect(
      count([
        [0, 0, 8, 0, 8, 8, 0, 8],
        [2, 2, 2, 6, 6, 6, 6, 2],
      ]).length,
    ).toBe(64 - 16);
  });
});

describe("distance", () => {
  it("matches brute force with and without the wrap", () => {
    const w = 23;
    const h = 11;
    const feature = new Uint8Array(w * h);
    const pts = [
      [1, 1],
      [21, 5],
      [10, 9],
      [11, 9],
      [3, 7],
    ] as const;
    for (const [x, y] of pts) feature[y * w + x] = 1;
    for (const wrap of [false, true]) {
      const got = distance(feature, w, h, wrap, 100);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let want = Number.POSITIVE_INFINITY;
          for (const [fx, fy] of pts) {
            let dx = Math.abs(x - fx);
            if (wrap) dx = Math.min(dx, w - dx);
            want = Math.min(want, Math.hypot(dx, y - fy));
          }
          expect(Math.abs(got[y * w + x]! - want)).toBeLessThan(1e-9);
        }
      }
    }
  });
});

describe("Frame", () => {
  it("round-trips and spans 84 N to about 57.8 S", () => {
    const f = Frame.standard();
    expect(Math.abs(f.latMin - -57.783)).toBeLessThan(0.001);
    for (const [lon, lat] of [
      [-74.0, 40.7],
      [139.7, 35.7],
      [-179.9, 52.0],
      [0.0, -55.0],
    ] as const) {
      const [x, y] = f.project(lon, lat);
      const [lon2, lat2] = f.unproject(x, y);
      expect(Math.abs(lon - lon2)).toBeLessThan(1e-9);
      expect(Math.abs(lat - lat2)).toBeLessThan(1e-9);
    }
    expect(Math.abs(f.project(0, f.latMax)[1])).toBeLessThan(1e-6);
    expect(Math.abs(f.project(0, f.latMin)[1] - 4096)).toBeLessThan(1e-6);
  });
});

describe("seaLinks", () => {
  const frame = Frame.standard();
  const w = 8192;
  const y0 = 2048;

  // the full frame, as the step lengths depend on it
  it("links facing shores, not far ones, land neighbours, or past a shared coastal neighbour", () => {
    const raster = new Uint16Array(w * 4096);
    for (let y = y0; y < y0 + 5; y++) {
      for (let x = 100; x < 105; x++) raster[y * w + x] = 1;
      for (let x = 108; x < 113; x++) raster[y * w + x] = 2;
      for (let x = 200; x < 205; x++) raster[y * w + x] = 3;
    }
    const waterOf = (r: Uint16Array) => {
      const water = new Uint8Array(r.length);
      for (let i = 0; i < r.length; i++) water[i] = r[i] === 0 ? 1 : 0;
      return water;
    };
    expect(seaLinks(frame, raster, waterOf(raster), new Set())).toEqual([pairKey(1, 2)]);
    // land neighbours are not sea links
    expect(seaLinks(frame, raster, waterOf(raster), new Set([pairKey(1, 2)]))).toEqual([]);
    // nor two provinces that share a coastal land neighbour (3 touches both on land)
    const r3 = raster.slice();
    for (let y = y0; y < y0 + 5; y++) {
      for (let x = 200; x < 205; x++) r3[y * w + x] = 0;
      r3[(y0 + 6) * w + 106] = 3;
    }
    const both = new Set([pairKey(1, 3), pairKey(2, 3)]);
    expect(seaLinks(frame, r3, waterOf(r3), both)).toEqual([]);
  });

  it("shrinks the steps towards the poles", () => {
    const [hEq, vEq] = steps(frame, 2600);
    const [hHi, vHi] = steps(frame, 300);
    expect(hHi).toBeLessThan(hEq);
    expect(vHi).toBeLessThan(vEq);
    expect(hEq).toBeGreaterThan(4000);
    expect(hEq).toBeLessThan(4900);
  });
});

describe("build helpers", () => {
  it("cuts the seam at the longest gap", () => {
    const occ = new Uint8Array(10);
    occ[0] = occ[9] = occ[8] = 1;
    expect(unwrapShift(occ)).toBe(8);
    const occ2 = new Uint8Array(10);
    occ2[3] = occ2[4] = 1;
    expect(unwrapShift(occ2)).toBe(3);
  });

  it("lists land exclaves, not islands", () => {
    const frame = new Frame(64, 32, 84);
    const w = 64;
    const r = new Uint16Array(w * 32);
    const fill = (v: number, x0: number, x1: number, y0: number, y1: number) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) r[y * w + x] = v;
    };
    fill(1, 10, 20, 10, 20);
    fill(2, 20, 40, 5, 25);
    fill(1, 30, 33, 14, 17); // 9 px of 1 inside 2: a land exclave
    fill(1, 50, 53, 5, 8); // 9 px of 1 in the water: an island
    fill(1, 36, 38, 7, 9); // 4 px: under EXCLAVE_MIN_PX
    const st = provinceStats(frame, r, 2, [false, false], null);
    expect(st[0]!.components).toBe(4);
    expect(st[0]!.exclaves).toEqual([[9, 31.5, 15.5]]);
    expect(st[1]!.exclaves).toEqual([]);
  });

  it("gives unique colours, never near black or white", () => {
    const ids = Array.from({ length: 4000 }, (_, i) => `XX-${String(i).padStart(4, "0")}`);
    const c = colorsFor(ids);
    expect(new Set(c.map((x) => x.join(","))).size).toBe(ids.length);
    expect(c.every((x) => x.every((v) => v >= 16 && v <= 239))).toBe(true);
  });

  it("measures area and finds an interior point as geo does", () => {
    const sq: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ];
    const hole: [number, number][] = [
      [1, 1],
      [1, 2],
      [2, 2],
      [2, 1],
      [1, 1],
    ];
    expect(unsignedArea([sq, hole])).toBe(15);
    // the rhombus of geo's own example
    const rhombus: [number, number][] = [
      [-2, 1],
      [1, 3],
      [4, 1],
      [1, -1],
      [-2, 1],
    ];
    expect(interiorPoint([rhombus])).toEqual([1, 2]);
  });
});

describe("fixed", () => {
  it("rounds an exact tie to even, as Rust prints", () => {
    expect(fixed(12.25, 1)).toBe("12.2");
    expect(fixed(12.35, 1)).toBe((12.35).toFixed(1));
    expect(fixed(12.75, 1)).toBe("12.8");
    expect(fixed(0.5, 0)).toBe("0");
    expect(fixed(1.5, 0)).toBe("2");
    expect(fixed(-2.25, 1)).toBe("-2.2");
    expect(fixed(84, 6)).toBe("84.000000");
  });
});

describe("encodePng", () => {
  /** Inflates and unfilters the IDAT of a PNG this module wrote. */
  function decode(png: Buffer, bpp: number): { w: number; h: number; raw: Uint8Array } {
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    let off = 8;
    const idat: Buffer[] = [];
    while (off < png.length) {
      const len = png.readUInt32BE(off);
      if (png.toString("ascii", off + 4, off + 8) === "IDAT") idat.push(png.subarray(off + 8, off + 8 + len));
      off += 12 + len;
    }
    const data = inflateSync(Buffer.concat(idat));
    const stride = w * bpp;
    const raw = new Uint8Array(stride * h);
    for (let y = 0; y < h; y++) {
      const f = data[y * (stride + 1)]!;
      for (let i = 0; i < stride; i++) {
        const v = data[y * (stride + 1) + 1 + i]!;
        const a = i >= bpp ? raw[y * stride + i - bpp]! : 0;
        const b = y > 0 ? raw[(y - 1) * stride + i]! : 0;
        const c = i >= bpp && y > 0 ? raw[(y - 1) * stride + i - bpp]! : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]!;
        raw[y * stride + i] = (v + pred) & 0xff;
      }
    }
    return { w, h, raw };
  }

  it("writes RGB 8 and grey 16 that decode to the same samples", () => {
    const w = 37;
    const h = 9;
    for (const [type, depth, bpp] of [
      [2, 8, 3],
      [0, 16, 2],
    ] as const) {
      const raw = new Uint8Array(w * h * bpp);
      for (let i = 0; i < raw.length; i++) raw[i] = (i * 31 + ((i / 7) | 0) * 13) & 0xff;
      const png = encodePng(w, h, raw, type, depth);
      expect([png[24], png[25]]).toEqual([depth, type]);
      const got = decode(png, bpp);
      expect([got.w, got.h]).toEqual([w, h]);
      expect(got.raw).toEqual(raw);
    }
  });
});

describe("parseCsv", () => {
  it("reads quoted fields and CRLF", () => {
    expect(parseCsv('id,name\r\nA-1,"Kyiv, ""city"""\r\nA-2,Lviv\r\n')).toEqual([
      ["id", "name"],
      ["A-1", 'Kyiv, "city"'],
      ["A-2", "Lviv"],
    ]);
  });
});
