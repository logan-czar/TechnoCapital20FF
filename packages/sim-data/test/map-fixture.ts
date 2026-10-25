// Port of sim_data::map::fixture::write (crates/sim-data/src/map.rs): map-meta.toml,
// province-colors.csv, province-centroids.csv and province-adjacency.csv for a set of pixel
// rectangles, as a files map (the pure loader takes name to text, no directory).
//
// Expects: nothing from the packages (plain string building). Lives in pending/ only because its
// only user, map.test.ts, is pending.

/** One province: its CSV id and its pixel rectangle [x0, y0, x1, y1). */
export type Rect = readonly [string, readonly [number, number, number, number]];

export function mapFixtureFiles(
  width: number,
  height: number,
  tinyPx: number,
  rectsIn: readonly Rect[],
): Record<string, string> {
  const rects = [...rectsIn].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const meta =
    "width = " +
    width +
    "\nheight = " +
    height +
    '\nprojection = "miller"\nlon_min = -180.0\n' +
    'lon_max = 180.0\nlat_max = 83.0\nlat_min = -60.0\npipeline_version = "fixture"\n' +
    "tiny_px = " +
    tinyPx +
    '\ncoverage = ["provinces-north-america.csv"]\n\n' +
    '[sources]\nfixture = "1"\n';
  let colors = "province_id,r,g,b\n";
  let cents = "province_id,lon,lat,x,y,label_x,label_y,area_px,tiny\n";
  rects.forEach(([id, [x0, y0, x1, y1]], i) => {
    const n = i + 1;
    colors += `${id},${n % 256},${Math.trunc(n / 256) % 256},200\n`;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const area = (x1 - x0) * (y1 - y0);
    const lon = (cx / width) * 360 - 180;
    const lat = 83 - (cy / height) * 143;
    // Rust {} on an f64 prints whole numbers without a decimal point, as String() does.
    cents +=
      id +
      "," +
      lon.toFixed(4) +
      "," +
      lat.toFixed(4) +
      "," +
      cx +
      "," +
      cy +
      "," +
      cx +
      "," +
      cy +
      "," +
      area +
      "," +
      (area < tinyPx ? "Y" : "N") +
      "\n";
  });
  let adj = "a,b,border_px,kind\n";
  const overlap = (a0: number, a1: number, b0: number, b1: number): number =>
    Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  rects.forEach((a, i) => {
    for (const b of rects.slice(i + 1)) {
      const [ax0, ay0, ax1, ay1] = a[1];
      const [bx0, by0, bx1, by1] = b[1];
      let shared = 0;
      if (ax1 === bx0 || bx1 === ax0) shared = overlap(ay0, ay1, by0, by1);
      else if (ay1 === by0 || by1 === ay0) shared = overlap(ax0, ax1, bx0, bx1);
      if (shared > 0) adj += `${a[0]},${b[0]},${shared},land\n`;
    }
  });
  return {
    "map-meta.toml": meta,
    "province-colors.csv": colors,
    "province-centroids.csv": cents,
    "province-adjacency.csv": adj,
  };
}
