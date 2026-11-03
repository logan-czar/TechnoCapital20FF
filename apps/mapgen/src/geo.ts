// The two pieces of planar geometry mapgen needs for a province too small to cover a pixel centre
// (D607): a polygon's area and its interior point. Both follow the Rust `geo` crate (0.33) step for
// step, so the forced pixels land where the Rust mapgen put them (D1017).

/** A ring in lon/lat degrees, closed (its last point repeats its first), as `[x, y]` pairs. */
export type Coords = readonly (readonly [number, number])[];
/** A polygon: its exterior ring, then its holes. */
export type Polygon = readonly Coords[];

/** Twice the signed shoelace area of a closed ring, each point shifted by the first (`geo`). */
function twiceSignedRingArea(ring: Coords): number {
  if (ring.length < 3) return 0;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) return 0;
  let sum = 0;
  let px = ring[1]![0] - first[0];
  let py = ring[1]![1] - first[1];
  for (let k = 2; k < ring.length; k++) {
    const x = ring[k]![0] - first[0];
    const y = ring[k]![1] - first[1];
    sum += px * y - py * x;
    px = x;
    py = y;
  }
  return sum;
}

/** A polygon's area: the exterior's less its holes' (`geo`'s `unsigned_area`). */
export function unsignedArea(poly: Polygon): number {
  const ext = poly[0];
  if (ext === undefined) return 0;
  let area = Math.abs(twiceSignedRingArea(ext) / 2);
  for (let k = 1; k < poly.length; k++) area -= Math.abs(twiceSignedRingArea(poly[k]!) / 2);
  return Math.abs(area);
}

type Pt = readonly [number, number];
type Seg = readonly [Pt, Pt];

/** `geo`'s `raw_line_intersection`: homogeneous coordinates about the overlap's midpoint. */
function rawIntersection(p: Seg, q: Seg): Pt | null {
  const [ps, pe] = p;
  const [qs, qe] = q;
  const midX =
    (Math.max(Math.min(ps[0], pe[0]), Math.min(qs[0], qe[0])) +
      Math.min(Math.max(ps[0], pe[0]), Math.max(qs[0], qe[0]))) /
    2;
  const midY =
    (Math.max(Math.min(ps[1], pe[1]), Math.min(qs[1], qe[1])) +
      Math.min(Math.max(ps[1], pe[1]), Math.max(qs[1], qe[1]))) /
    2;
  const p1x = ps[0] - midX;
  const p1y = ps[1] - midY;
  const p2x = pe[0] - midX;
  const p2y = pe[1] - midY;
  const q1x = qs[0] - midX;
  const q1y = qs[1] - midY;
  const q2x = qe[0] - midX;
  const q2y = qe[1] - midY;
  const px = p1y - p2y;
  const py = p2x - p1x;
  const pw = p1x * p2y - p2x * p1y;
  const qx = q1y - q2y;
  const qy = q2x - q1x;
  const qw = q1x * q2y - q2x * q1y;
  const xw = py * qw - qy * pw;
  const yw = qx * pw - px * qw;
  const w = px * qy - qx * py;
  const x = xw / w;
  const y = yw / w;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x + midX, y + midY];
}

const inRect = (s: Seg, c: Pt) =>
  c[0] >= Math.min(s[0][0], s[1][0]) &&
  c[0] <= Math.max(s[0][0], s[1][0]) &&
  c[1] >= Math.min(s[0][1], s[1][1]) &&
  c[1] <= Math.max(s[0][1], s[1][1]);

/** Distance from `c` to segment `s`. */
function pointSegment(c: Pt, s: Seg): number {
  const [a, b] = s;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(c[0] - a[0], c[1] - a[1]);
  const r = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / len2;
  if (r <= 0) return Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (r >= 1) return Math.hypot(c[0] - b[0], c[1] - b[1]);
  return Math.abs((a[1] - c[1]) * dx - (a[0] - c[0]) * dy) / Math.sqrt(len2);
}

/** `geo`'s `nearest_endpoint`: the endpoint of either segment nearest the other. */
function nearestEndpoint(p: Seg, q: Seg): Pt {
  let best = p[0];
  let min = pointSegment(p[0], q);
  for (const [c, other] of [
    [p[1], q],
    [q[0], p],
    [q[1], p],
  ] as const) {
    const d = pointSegment(c, other);
    if (d < min) {
      min = d;
      best = c;
    }
  }
  return best;
}

/** `geo`'s `proper_intersection` of two segments known to cross at one interior point. */
function properIntersection(p: Seg, q: Seg): Pt {
  const raw = rawIntersection(p, q) ?? nearestEndpoint(p, q);
  return inRect(p, raw) && inRect(q, raw) ? raw : nearestEndpoint(p, q);
}

/** Whether `c` is inside the polygon or on its boundary (even-odd over every ring). */
function intersects(poly: Polygon, c: Pt): boolean {
  let inside = false;
  for (const ring of poly) {
    for (let k = 0; k + 1 < ring.length; k++) {
      const a = ring[k]!;
      const b = ring[k + 1]!;
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cross === 0 && inRect([a, b], c)) return true;
      if (a[1] > c[1] !== b[1] > c[1]) {
        const x = a[0] + ((c[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
        if (c[0] < x) inside = !inside;
      }
    }
  }
  return inside;
}

/**
 * `geo`'s polygon interior point with the length of the scan segment it sits on: the midpoint of
 * the longest stretch of the horizontal line through the middle of the bounding box that lies in the
 * polygon. The scan line is nudged off any vertex, so it crosses edges only at interior points.
 */
function interiorWithLength(poly: Polygon): [Pt, number] | null {
  const ext = poly[0];
  if (ext === undefined || ext.length === 0) return null;
  if (ext.length === 1) return [ext[0]!, 0];
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const ring of poly) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  let yMid = (minY + maxY) / 2;
  if (poly.some((ring) => ring.some((c) => c[1] === yMid))) {
    let closest: number | null = null;
    let gap = 0;
    for (const ring of poly) {
      for (const c of ring) {
        if (c[1] === yMid) continue;
        const g = Math.abs(c[1] - yMid);
        if (closest === null || g < gap) {
          closest = c[1];
          gap = g;
        }
      }
    }
    if (closest !== null) yMid = (yMid + closest) / 2;
  }
  const scan: Seg = [
    [minX, yMid],
    [maxX, yMid],
  ];
  const xs: number[] = [];
  for (const ring of poly) {
    for (let k = 0; k + 1 < ring.length; k++) {
      const a = ring[k]!;
      const b = ring[k + 1]!;
      if (a[1] < yMid === b[1] < yMid || a[1] === yMid || b[1] === yMid) continue;
      const edge: Seg = [a, b];
      // The sweep orders segments by their west end (a stable sort, the scan line last), and
      // intersects the earlier one with the later: an edge that starts as far west as the scan line
      // comes first.
      const edgeFirst = Math.min(a[0], b[0]) <= minX;
      xs.push((edgeFirst ? properIntersection(edge, scan) : properIntersection(scan, edge))[0]);
    }
  }
  xs.sort((a, b) => a - b);
  const segments: [Pt, number][] = [];
  for (let k = 0; k + 1 < xs.length; k++) {
    segments.push([[(xs[k]! + xs[k + 1]!) / 2, yMid], xs[k + 1]! - xs[k]!]);
  }
  segments.sort((a, b) => b[1] - a[1]);
  for (const [mid, len] of segments) {
    if (intersects(poly, mid)) return [mid, len];
  }
  const first = ext[0];
  return first === undefined ? null : [first, 0];
}

/** A polygon's interior point (`geo`'s `InteriorPoint`), or null when it has no points. */
export function interiorPoint(poly: Polygon): Pt | null {
  return interiorWithLength(poly)?.[0] ?? null;
}

/** A multipolygon's: its polygons' point on the longest scan segment (the first on a tie). */
export function multiInteriorPoint(polys: readonly Polygon[]): Pt | null {
  let best: [Pt, number] | null = null;
  for (const p of polys) {
    const r = interiorWithLength(p);
    if (r !== null && (best === null || r[1] > best[1])) best = r;
  }
  return best?.[0] ?? null;
}
