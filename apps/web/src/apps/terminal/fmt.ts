// How the Pdoomberg app writes numbers: whole dollars and cents in full (a position is read to the
// cent, unlike the shared short form), a gain with its sign, a price in its venue's units.

import type { DateTime, Venue } from "@tc20ff/sim";
import { formatWhen } from "../_shared/index.ts";

/** USD to the cent with thousands separators: "$1,234.50"; a minus sign before the dollar. */
export function usd(v: number): string {
  const sign = v < 0 ? "-" : "";
  const [whole = "0", cents = "00"] = Math.abs(v).toFixed(2).split(".");
  return `${sign}$${whole.replace(/\B(?=(\d{3})+$)/g, ",")}.${cents}`;
}

/** A gain or loss in USD, always signed: "+$12.00", "-$3.40". */
export function signedUsd(v: number): string {
  return v > 0 ? `+${usd(v)}` : usd(v);
}

/** A price in the venue's units: USD a share at the brokerage, cents at the exchange. */
export function priceAt(venue: Venue, p: number | null): string {
  if (p === null) return "-";
  return venue === "Brokerage" ? usd(p) : `${Number(p.toFixed(1))}¢`;
}

export function whenOf(t: DateTime): string {
  return formatWhen(t);
}

/** "gain" or "loss" for a CSS class; "flat" at zero. */
export function tone(v: number): "gain" | "loss" | "flat" {
  return v > 0 ? "gain" : v < 0 ? "loss" : "flat";
}
