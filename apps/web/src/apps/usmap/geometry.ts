// The USA map's shapes (pivot 5.1, 15.3; D1048): the county topology decoded into polygons, the
// arcs between counties as edges with a county on each side, and the binding of those shapes to
// the counties a v_usmap_layers view lists.
//
// The topology (assets/usmap/counties.topo.json, tools/usmap/build.py) is in the Albers USA plane
// of the game's county centroids, 975 by 610 with y down, one feature per county in FIPS order. The
// game's 3,142 counties bind to it one to one. A county set that is not all in the topology (the
// mock's invented counties) is drawn on a schematic instead: each state's counties as a mosaic of
// equal hexagons laid inside the real state's outline, with the real state borders behind.
//
// Every edge carries the counties on its two sides, so any border (state, district, a selection's
// outline) is a filter over the edges (./borders.ts) and nothing is re-triangulated when a plan or a
// colour changes.

/** A point in the map plane (x right, y down). */
export type XY = [number, number];

/** One polygon of a county (outer ring, then holes). */
export interface Part {
  county: number;
  polygon: XY[][];
}

/** A line between two counties, or between a county and the outside (`b` = -1). */
export interface Edge {
  path: XY[];
  a: number;
  b: number;
}

export interface MapGeometry {
  /** "real": the county shapes; "schematic": the hexagon mosaic over the real state outlines. */
  kind: "real" | "schematic";
  /** Counties, in the view's order: a county's index here is its index in v_usmap_layers. */
  count: number;
  parts: Part[];
  /** Each county's parts. */
  partsOf: Part[][];
  /** A point inside each county's largest part, for markers and labels. */
  centroid: XY[];
  /** Each county's box: x0, y0, x1, y1 at 4i. */
  bounds: Float64Array;
  /** The lines between counties (and from a county to the outside). */
  edges: Edge[];
  /** The state borders drawn under the schematic (real mode draws them from `edges`). */
  backdrop: XY[][];
  /** The plane's size. */
  width: number;
  height: number;
}

/** The topology the build writes (a TopoJSON subset: quantized, delta-encoded arcs). */
export interface CountyTopology {
  type: "Topology";
  transform: { scale: [number, number]; translate: [number, number] };
  plane?: [number, number];
  objects: {
    counties: {
      type: "GeometryCollection";
      geometries: { type: "Polygon" | "MultiPolygon"; arcs: number[][] | number[][][]; id: string }[];
    };
  };
  arcs: [number, number][][];
}

/** The plane's size when the topology does not say (tools/world-1995/counties/README.md). */
export const PLANE_WIDTH = 975;
export const PLANE_HEIGHT = 610;

/** The topology decoded, in its own (FIPS) order. */
export interface BaseGeometry {
  fips: string[];
  parts: Part[];
  partsOf: Part[][];
  centroid: XY[];
  bounds: Float64Array;
  edges: Edge[];
  width: number;
  height: number;
}

/** Signed area of a ring (positive or negative by winding); the shoelace sum halved. */
export function ringArea(ring: readonly XY[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p = ring[i] as XY;
    const q = ring[j] as XY;
    s += q[0] * p[1] - p[0] * q[1];
  }
  return s / 2;
}

/** The area centroid of a ring; the mean of its points when it has no area. */
export function ringCentroid(ring: readonly XY[]): XY {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p = ring[i] as XY;
    const q = ring[j] as XY;
    const f = q[0] * p[1] - p[0] * q[1];
    a += f;
    cx += (q[0] + p[0]) * f;
    cy += (q[1] + p[1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    let sx = 0;
    let sy = 0;
    for (const p of ring) {
      sx += p[0];
      sy += p[1];
    }
    const n = Math.max(1, ring.length);
    return [sx / n, sy / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Even-odd point in polygon (outer ring and holes). */
export function inPolygon(polygon: readonly (readonly XY[])[], x: number, y: number): boolean {
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

function fillBounds(bounds: Float64Array, i: number, parts: readonly Part[]): void {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const part of parts) {
    for (const p of part.polygon[0] ?? []) {
      if (p[0] < x0) x0 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[0] > x1) x1 = p[0];
      if (p[1] > y1) y1 = p[1];
    }
  }
  if (x0 > x1) {
    x0 = 0;
    y0 = 0;
    x1 = 0;
    y1 = 0;
  }
  bounds[4 * i] = x0;
  bounds[4 * i + 1] = y0;
  bounds[4 * i + 2] = x1;
  bounds[4 * i + 3] = y1;
}

function largestCentroid(parts: readonly Part[]): XY {
  let best: XY = [0, 0];
  let size = -1;
  for (const part of parts) {
    const ring = part.polygon[0] ?? [];
    const a = Math.abs(ringArea(ring));
    if (a > size) {
      size = a;
      best = ringCentroid(ring);
    }
  }
  return best;
}

/** Decodes the topology: polygons, centroids, boxes, and every arc as an edge with its two counties. */
export function decodeTopology(topo: CountyTopology): BaseGeometry {
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;
  const arcs: XY[][] = topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty] as XY;
    });
  });
  const geoms = topo.objects.counties.geometries;
  const owners: number[][] = arcs.map(() => []);
  const ring = (refs: readonly number[], county: number): XY[] => {
    const out: XY[] = [];
    for (const r of refs) {
      const j = r >= 0 ? r : ~r;
      const own = owners[j] as number[];
      if (!own.includes(county)) own.push(county);
      const pts = arcs[j] as XY[];
      const seq = r >= 0 ? pts : pts.slice().reverse();
      for (let k = out.length === 0 ? 0 : 1; k < seq.length; k++) out.push(seq[k] as XY);
    }
    return out;
  };
  const parts: Part[] = [];
  const partsOf: Part[][] = [];
  geoms.forEach((g, county) => {
    const polys = (g.type === "Polygon" ? [g.arcs] : g.arcs) as number[][][];
    const mine: Part[] = polys.map((poly) => ({ county, polygon: poly.map((refs) => ring(refs, county)) }));
    partsOf.push(mine);
    parts.push(...mine);
  });
  const count = geoms.length;
  const bounds = new Float64Array(4 * count);
  const centroid: XY[] = [];
  for (let i = 0; i < count; i++) {
    fillBounds(bounds, i, partsOf[i] as Part[]);
    centroid.push(largestCentroid(partsOf[i] as Part[]));
  }
  const edges: Edge[] = [];
  arcs.forEach((path, j) => {
    const own = owners[j] as number[];
    if (own.length === 0) return;
    edges.push({ path, a: own[0] as number, b: own[1] ?? -1 });
  });
  return {
    fips: geoms.map((g) => g.id),
    parts,
    partsOf,
    centroid,
    bounds,
    edges,
    width: topo.plane?.[0] ?? PLANE_WIDTH,
    height: topo.plane?.[1] ?? PLANE_HEIGHT,
  };
}

/** A county's state as its FIPS prefix. */
export const fipsState = (fips: string): string => fips.slice(0, 2);

/** The real state borders: edges between counties of two states, and the coast. */
export function stateBorderEdges(base: BaseGeometry): XY[][] {
  return base.edges
    .filter((e) => e.b < 0 || fipsState(base.fips[e.a] ?? "") !== fipsState(base.fips[e.b] ?? ""))
    .map((e) => e.path);
}

/**
 * The shapes for the counties `fips` lists, in that order: the real shapes when every code is in
 * the topology, the schematic otherwise.
 */
export function bindGeometry(base: BaseGeometry, fips: readonly string[]): MapGeometry {
  const at = new Map<string, number>();
  base.fips.forEach((f, i) => {
    at.set(f, i);
  });
  const idx = fips.map((f) => at.get(f) ?? -1);
  if (idx.every((i) => i >= 0)) return realGeometry(base, idx);
  return schematicGeometry(base, fips);
}

function realGeometry(base: BaseGeometry, idx: readonly number[]): MapGeometry {
  const identity = idx.length === base.fips.length && idx.every((b, i) => b === i);
  if (identity) {
    return {
      kind: "real",
      count: idx.length,
      parts: base.parts,
      partsOf: base.partsOf,
      centroid: base.centroid,
      bounds: base.bounds,
      edges: base.edges,
      backdrop: [],
      width: base.width,
      height: base.height,
    };
  }
  // A subset or another order: renumber the shapes to the view's indices.
  const mine = new Int32Array(base.fips.length).fill(-1);
  idx.forEach((b, i) => {
    mine[b] = i;
  });
  const partsOf = idx.map((b, i) => (base.partsOf[b] ?? []).map((p) => ({ county: i, polygon: p.polygon })));
  const bounds = new Float64Array(4 * idx.length);
  idx.forEach((b, i) => {
    bounds.set(base.bounds.subarray(4 * b, 4 * b + 4), 4 * i);
  });
  const edges: Edge[] = [];
  for (const e of base.edges) {
    const a = mine[e.a] ?? -1;
    const b = e.b < 0 ? -1 : (mine[e.b] ?? -1);
    if (a < 0 && b < 0) continue;
    edges.push(a < 0 ? { path: e.path, a: b, b: -1 } : { path: e.path, a, b });
  }
  return {
    kind: "real",
    count: idx.length,
    parts: partsOf.flat(),
    partsOf,
    centroid: idx.map((b) => base.centroid[b] as XY),
    bounds,
    edges,
    backdrop: identity ? [] : stateBorderEdges(base),
    width: base.width,
    height: base.height,
  };
}

/** The schematic's hexagons: a state's cells start at this share of the size that would just fill it. */
const HEX_FILL = 0.92;
/** Each try shrinks the cells by this much until enough centres fall inside the state. */
const HEX_SHRINK = 0.9;
const HEX_TRIES = 40;
/** sqrt(3), the pointy-top hexagon's width over its radius. */
const SQRT3 = 1.7320508075688772;
/** Where a state the topology does not know is put: a row along the plane's bottom right. */
const STRAY_ORIGIN: XY = [760, 560];
const STRAY_RADIUS = 6;

/** A pointy-top hexagon's corners around `c` with radius `r`, closed. */
function hexagon(c: XY, r: number): XY[] {
  const out: XY[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((60 * k - 30) * Math.PI) / 180;
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  out.push(out[0] as XY);
  return out;
}

/** The centres of a pointy-top grid with radius `r` over a box, anchored on `anchor`. */
function gridCentres(anchor: XY, r: number, box: [number, number, number, number]): XY[] {
  const w = SQRT3 * r;
  const h = 1.5 * r;
  const out: XY[] = [];
  const r0 = Math.floor((box[1] - anchor[1]) / h) - 1;
  const r1 = Math.ceil((box[3] - anchor[1]) / h) + 1;
  for (let row = r0; row <= r1; row++) {
    const y = anchor[1] + row * h;
    const shift = (row & 1) === 0 ? 0 : w / 2;
    const c0 = Math.floor((box[0] - anchor[0] - shift) / w) - 1;
    const c1 = Math.ceil((box[2] - anchor[0] - shift) / w) + 1;
    for (let col = c0; col <= c1; col++) out.push([anchor[0] + shift + col * w, y]);
  }
  return out;
}

/**
 * The schematic (D1048): each state's counties, in FIPS order, as equal hexagons read left to right
 * and top to bottom inside the real state's outline (the cells shrink until enough centres fall in
 * it). One cell a county; neighbouring cells share an edge, so district borders work as on the real
 * shapes.
 */
export function schematicGeometry(base: BaseGeometry, fips: readonly string[]): MapGeometry {
  const byState = new Map<string, number[]>();
  fips.forEach((f, i) => {
    const s = fipsState(f);
    const list = byState.get(s) ?? [];
    list.push(i);
    byState.set(s, list);
  });
  const realOf = new Map<string, number[]>();
  base.fips.forEach((f, i) => {
    const s = fipsState(f);
    const list = realOf.get(s) ?? [];
    list.push(i);
    realOf.set(s, list);
  });
  const cells: { county: number; centre: XY; r: number }[] = [];
  let stray = 0;
  for (const [st, counties] of [...byState.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const real = realOf.get(st) ?? [];
    const n = counties.length;
    let placed: XY[] | null = null;
    let radius = STRAY_RADIUS;
    if (real.length > 0) {
      const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
      let area = 0;
      let cx = 0;
      let cy = 0;
      for (const i of real) {
        box[0] = Math.min(box[0], base.bounds[4 * i] as number);
        box[1] = Math.min(box[1], base.bounds[4 * i + 1] as number);
        box[2] = Math.max(box[2], base.bounds[4 * i + 2] as number);
        box[3] = Math.max(box[3], base.bounds[4 * i + 3] as number);
        for (const p of base.partsOf[i] ?? []) {
          const a = Math.abs(ringArea(p.polygon[0] ?? []));
          const c = ringCentroid(p.polygon[0] ?? []);
          area += a;
          cx += c[0] * a;
          cy += c[1] * a;
        }
      }
      const anchor: XY = area > 0 ? [cx / area, cy / area] : [box[0], box[1]];
      const inside = (p: XY) =>
        real.some((i) => {
          const b = base.bounds;
          if (p[0] < (b[4 * i] as number) || p[0] > (b[4 * i + 2] as number)) return false;
          if (p[1] < (b[4 * i + 1] as number) || p[1] > (b[4 * i + 3] as number)) return false;
          return (base.partsOf[i] ?? []).some((part) => inPolygon(part.polygon, p[0], p[1]));
        });
      let r = Math.sqrt(area / (n * 1.5 * SQRT3)) * HEX_FILL;
      for (let t = 0; t < HEX_TRIES && r > 0; t++, r *= HEX_SHRINK) {
        const hits = gridCentres(anchor, r, box).filter(inside);
        if (hits.length < n) continue;
        // The n cells nearest the state's centre, then in reading order.
        const near = hits
          .map((p) => ({ p, d: (p[0] - anchor[0]) ** 2 + (p[1] - anchor[1]) ** 2 }))
          .sort((x, y) => x.d - y.d || x.p[1] - y.p[1] || x.p[0] - y.p[0])
          .slice(0, n)
          .map((x) => x.p);
        near.sort((x, y) => x[1] - y[1] || x[0] - y[0]);
        placed = near;
        radius = r;
        break;
      }
    }
    if (placed === null) {
      // A state with no outline (or too small for its cells): a row of its own.
      radius = STRAY_RADIUS;
      placed = counties.map((_, k) => [
        STRAY_ORIGIN[0] + (k % 12) * SQRT3 * radius,
        STRAY_ORIGIN[1] - stray * 1.5 * radius - Math.floor(k / 12) * 1.5 * radius,
      ]);
      stray += 1 + Math.floor(n / 12);
    }
    const at: XY[] = placed;
    const size = radius;
    counties.forEach((county, k) => {
      cells.push({ county, centre: at[k] as XY, r: size });
    });
  }
  cells.sort((x, y) => x.county - y.county);
  const count = fips.length;
  const partsOf: Part[][] = [];
  const centroid: XY[] = [];
  const bounds = new Float64Array(4 * count);
  for (let i = 0; i < count; i++) {
    const cell = cells[i] as { county: number; centre: XY; r: number };
    const part: Part = { county: i, polygon: [hexagon(cell.centre, cell.r)] };
    partsOf.push([part]);
    centroid.push(cell.centre);
    fillBounds(bounds, i, [part]);
  }
  // Edges: a hexagon side shared by two cells joins them; one no other cell shares is the outside.
  const sides = new Map<string, Edge>();
  const key = (p: XY) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  partsOf.forEach((ps, i) => {
    const ring = (ps[0] as Part).polygon[0] as XY[];
    for (let k = 0; k < 6; k++) {
      const p = ring[k] as XY;
      const q = ring[k + 1] as XY;
      const k1 = key([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
      const had = sides.get(k1);
      if (had === undefined) sides.set(k1, { path: [p, q], a: i, b: -1 });
      else if (had.b < 0 && had.a !== i) had.b = i;
    }
  });
  return {
    kind: "schematic",
    count,
    parts: partsOf.flat(),
    partsOf,
    centroid,
    bounds,
    edges: [...sides.values()],
    backdrop: stateBorderEdges(base),
    width: base.width,
    height: base.height,
  };
}

/** The box around a set of counties, or null for none. */
export function boundsOf(
  g: MapGeometry,
  counties: Iterable<number>,
): [number, number, number, number] | null {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const i of counties) {
    if (i < 0 || i >= g.count) continue;
    x0 = Math.min(x0, g.bounds[4 * i] as number);
    y0 = Math.min(y0, g.bounds[4 * i + 1] as number);
    x1 = Math.max(x1, g.bounds[4 * i + 2] as number);
    y1 = Math.max(y1, g.bounds[4 * i + 3] as number);
  }
  return x0 > x1 ? null : [x0, y0, x1, y1];
}
