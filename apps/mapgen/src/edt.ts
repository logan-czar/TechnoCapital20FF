// Exact Euclidean distance transform (Felzenszwalb and Huttenlocher), separable, with an optional
// east-west wrap. Used for the border distance field and for label points.

const FAR = 1e20;

/** 1-D squared distance transform of `f[0..n]` into `d[0..n]`. */
function edt1d(f: Float64Array, d: Float64Array, n: number, v: Int32Array, z: Float64Array): void {
  if (n === 0) return;
  let k = 0;
  v[0] = 0;
  z[0] = Number.NEGATIVE_INFINITY;
  z[1] = Number.POSITIVE_INFINITY;
  for (let q = 1; q < n; q++) {
    let s: number;
    for (;;) {
      const p = v[k]!;
      s = (f[q]! + q * q - (f[p]! + p * p)) / (2 * q - 2 * p);
      // z[0] is -inf, so this never pops the first parabola
      if (s <= z[k]!) k--;
      else break;
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Number.POSITIVE_INFINITY;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const p = v[k]!;
    d[q] = (q - p) * (q - p) + f[p]!;
  }
}

/**
 * Distance in pixels from each pixel centre to the nearest `feature` pixel centre, row-major
 * `width` x `height`. With `wrapX` the left and right edges are neighbours. Distances above `cap`
 * may be reported as anything >= `cap` (the row pass only looks `cap` pixels across the wrap seam).
 */
export function distance(
  feature: Uint8Array,
  width: number,
  height: number,
  wrapX: boolean,
  cap: number,
): Float64Array {
  if (feature.length !== width * height) throw new Error("edt: feature size");
  const n = Math.max(width, height);
  const pad = wrapX ? Math.min(Math.ceil(cap) + 1, width) : 0;
  const m = Math.max(n, width + 2 * pad);
  const f = new Float64Array(m);
  const d = new Float64Array(m);
  const v = new Int32Array(m);
  const z = new Float64Array(m + 1);
  const cols = new Float64Array(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = feature[y * width + x] ? 0 : FAR;
    edt1d(f, d, height, v, z);
    for (let y = 0; y < height; y++) cols[y * width + x] = d[y]!;
  }
  const out = new Float64Array(width * height);
  const len = width + 2 * pad;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let i = 0; i < len; i++) {
      const x = (((i - pad) % width) + width) % width;
      f[i] = cols[row + x]!;
    }
    edt1d(f, d, len, v, z);
    for (let x = 0; x < width; x++) out[row + x] = Math.sqrt(d[x + pad]!);
  }
  return out;
}
