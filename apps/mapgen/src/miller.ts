// The Miller cylindrical projection and the bitmap frame (build-plan P5, Logan's choice;
// docs/build/m8-map-assets.md `map-meta.toml`). Ported from the Rust mapgen (D1017).
//
// Miller: x = lon, y = 1.25 ln tan(pi/4 + 0.4 lat) (both in radians). The bitmap covers lon -180 to
// 180 across its width and wraps east to west. Pixels are square, so the latitude band kept is fixed
// by its top edge (`LAT_MAX_DEG`, D600) and the 2:1 frame: the y extent is 2 pi x height / width.

/**
 * Top edge of the map in degrees (D600): north of Cape Columbia (83.1 N) and the northern tip of
 * Greenland (83.7 N). With a 2:1 frame the bottom edge is then about 57.8 S, south of Cape Horn;
 * Antarctica, which holds no province, is left off.
 */
export const LAT_MAX_DEG = 84.0;
/** Default bitmap size (build-plan P7 **(T)**; docs/build/m8-map-assets.md). */
export const WIDTH = 8192;
export const HEIGHT = 4096;

const toRadians = (deg: number) => deg * (Math.PI / 180);
const toDegrees = (rad: number) => rad * (180 / Math.PI);

/** Miller y for a latitude in degrees. */
export function millerY(latDeg: number): number {
  return 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * toRadians(latDeg)));
}

/** Latitude in degrees for a Miller y. */
export function millerLat(y: number): number {
  return toDegrees(2.5 * Math.atan(Math.exp(0.8 * y)) - 0.625 * Math.PI);
}

/** The bitmap frame: size and the Miller y band it covers. */
export class Frame {
  readonly width: number;
  readonly height: number;
  readonly latMax: number;
  readonly latMin: number;
  private readonly yTop: number;
  /** Pixels per Miller unit (the same on both axes: square pixels). */
  private readonly pxPerUnit: number;

  constructor(width: number, height: number, latMax: number) {
    this.width = width;
    this.height = height;
    this.latMax = latMax;
    this.pxPerUnit = width / (2 * Math.PI);
    this.yTop = millerY(latMax);
    this.latMin = millerLat(this.yTop - height / this.pxPerUnit);
  }

  /** The default 8192 x 4096 frame topped at `LAT_MAX_DEG`. */
  static standard(): Frame {
    return new Frame(WIDTH, HEIGHT, LAT_MAX_DEG);
  }

  /** Continuous pixel coordinates (0..width, 0..height; y down) for a lon/lat in degrees. */
  project(lon: number, lat: number): [number, number] {
    const x = ((lon + 180) / 360) * this.width;
    const y = (this.yTop - millerY(Math.min(Math.max(lat, -89.9), 89.9))) * this.pxPerUnit;
    return [x, y];
  }

  /** Lon/lat in degrees for continuous pixel coordinates (x wraps into -180..180). */
  unproject(x: number, y: number): [number, number] {
    const w = this.width;
    const xw = remEuclid(x, w);
    const lon = (xw / w) * 360 - 180;
    const lat = millerLat(this.yTop - y / this.pxPerUnit);
    return [lon, lat];
  }
}

/** Rust's `rem_euclid` for f64: the remainder in `[0, m)`. */
export function remEuclid(x: number, m: number): number {
  const r = x % m;
  return r < 0 ? r + m : r;
}
