// Helpers for the tests of the USA cut (pivot 4.1, 4.2; `features.usa_only`): the 1995 data with the
// flag on, which no shipped manifest sets, and a scan for numbers that are not finite.

import type { WorldData } from "@tc20ff/sim-data";
import { data1995 } from "./index.ts";

/** The 1995 data with `features.usa_only` on: a test-only override of the manifest. */
export function usaOnly1995(): WorldData {
  const d = data1995();
  d.manifest = { ...d.manifest, features: { ...d.manifest.features, usa_only: true } };
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
