// Dates, money and shares as the apps print them (D1037). One place, so every app writes "3 Nov
// 2020", "$1.2M" and "52.4%" the same way. Pure functions; no locale (the sim and the tests must
// agree on every character).

import { type DateTime, dateTimeDate, dateTimeHour, type SimDate } from "@tc20ff/sim";

/** Month names as the apps print them. */
export const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "3 Nov 2020". */
export function formatDay(d: SimDate): string {
  return `${d.day} ${MONTH_NAMES_SHORT[d.month - 1]} ${d.year}`;
}

/** "3 Nov 2020, 21:00". */
export function formatWhen(t: DateTime): string {
  return `${formatDay(dateTimeDate(t))}, ${String(dateTimeHour(t)).padStart(2, "0")}:00`;
}

/** "21:00" (the hour of a tick). */
export function formatHour(t: DateTime): string {
  return `${String(dateTimeHour(t)).padStart(2, "0")}:00`;
}

/** USD, short: "$950", "$12.4K", "$1.2M", "$3.40B"; a minus sign before the dollar. */
export function formatUsd(v: number): string {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toFixed(a >= 100 ? 0 : 2)}`;
}

/** A share 0 to 1 as a percent with one decimal: "52.4%". */
export function formatPct(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

/** A contract price in whole cents (pivot 10.1): "57¢"; a dash with none. */
export function formatCents(price: number | null): string {
  return price === null ? "-" : `${price}¢`;
}

/** A margin in points toward party A: "D+3.2", "R+0.4", "even". */
export function formatMargin(points: number): string {
  if (Math.abs(points) < 0.05) return "even";
  return `${points > 0 ? "D" : "R"}+${Math.abs(points).toFixed(1)}`;
}
