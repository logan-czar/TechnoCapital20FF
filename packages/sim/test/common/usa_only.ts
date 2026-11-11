// Helpers for the tests of the USA cut (pivot 4.1, 4.2; `features.usa_only`): the 1995 data with the
// flag on, as the shipped manifest has it (D1038), the same data with it off (the uncut world the cut
// is measured against), and a scan for numbers that are not finite.

import type { WorldData } from "@tc20ff/sim-data";
import { data1995 } from "./index.ts";

/** The 1995 data with `features.usa_only` on, as shipped (D1038). */
export function usaOnly1995(): WorldData {
  const d = data1995();
  d.manifest = { ...d.manifest, features: { ...d.manifest.features, usa_only: true } };
  return d;
}

/** The 1995 data with `features.usa_only` off: every company simulated (a test-only override). */
export function whole1995(): WorldData {
  const d = data1995();
  d.manifest = { ...d.manifest, features: { ...d.manifest.features, usa_only: false } };
  return d;
}

/** The paths of the first few numbers under `value` that are NaN or infinite. */
export function notFinite(value: unknown, path = "", out: string[] = []): string[] {
  if (out.length >= 8) return out;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) out.push(path);
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) notFinite(value[i], `${path}[${i}]`, out);
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) notFinite(v, `${path}.${k}`, out);
  }
  return out;
}
