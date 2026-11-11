// Helpers every fixture shares: a view wrapper and the figures the pre-pivot views show.

import type { Figure, View } from "@tc20ff/sim";
import { unitHash } from "../mockWorld.ts";

/** A figure as the UI sees it: exact when published, else a band of about +/-25% (D420). */
export function shown(value: number, banded: boolean, key: string): Figure {
  if (!banded) return exact(value);
  const estimate = value * (0.9 + 0.2 * unitHash(key, 31));
  return {
    kind: "Band",
    band: { estimate, low: Math.min(value, estimate) * 0.75, high: Math.max(value, estimate) * 1.25 },
  };
}

export const exact = (value: number) => ({ kind: "Exact" as const, value });
export const view = <T>(data: T, version: number): View<T> => ({ data, version, dirty: false });
