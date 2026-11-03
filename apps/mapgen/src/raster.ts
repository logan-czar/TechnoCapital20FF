// Scanline polygon fill with pixel-centre sampling (D606: our own fill, not a library's).
//
// A pixel belongs to a polygon when its centre is inside (even-odd over all rings, so holes work).
// Edges are half-open in y and spans half-open in x, so two polygons that share an edge never both
// take, and never both miss, a pixel on it.

/** A ring in pixel coordinates, as flat `[x0, y0, x1, y1, ...]`. */
export type Ring = Float64Array;

/** Calls `put(x, y)` for every pixel whose centre lies inside the rings (pixel coordinates). */
export function fillRings(
  width: number,
  height: number,
  rings: readonly Ring[],
  put: (x: number, y: number) => void,
): void {
  let ymin = Number.POSITIVE_INFINITY;
  let ymax = Number.NEGATIVE_INFINITY;
  for (const r of rings) {
    for (let k = 1; k < r.length; k += 2) {
      const y = r[k]!;
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
  }
  if (!Number.isFinite(ymin)) return;
  const row0 = Math.max(Math.ceil(ymin - 0.5), 0);
  const row1 = Math.min(Math.floor(ymax - 0.5), height - 1);
  const xs: number[] = [];
  for (let row = row0; row <= row1; row++) {
    const yc = row + 0.5;
    xs.length = 0;
    for (const r of rings) {
      const n = r.length / 2;
      if (n < 3) continue;
      for (let i = 0; i < n; i++) {
        const x0 = r[2 * i]!;
        const y0 = r[2 * i + 1]!;
        const j = (i + 1) % n;
        const x1 = r[2 * j]!;
        const y1 = r[2 * j + 1]!;
        if (y0 <= yc !== y1 <= yc) {
          // from the endpoint with the lower y, so a shared edge walked either way gives
          // bit-identical crossings
          if (y0 <= y1) xs.push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0));
          else xs.push(x1 + ((yc - y1) * (x0 - x1)) / (y0 - y1));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(Math.ceil(xs[k]! - 0.5), 0);
      const c1 = Math.min(Math.ceil(xs[k + 1]! - 0.5) - 1, width - 1);
      for (let c = c0; c <= c1; c++) put(c, row);
    }
  }
}
