// Cell values and their display formats. Ported from crates/game/src/table/format.rs (build-plan
// M7.7; M9 A2, D456): money, percent, counts, per-share prices, dates, ratings, ratios, colored
// gains and losses, links to pages, estimate bands, text and "?" for values the player does not
// know (20-ui 20.1). A view's Figure becomes a cell through `figureCell`, the one path every page
// uses (D461): an exact figure is its plain cell, a band shows its range and sorts by its midpoint,
// never by a hidden value.

import {
  cmpStr,
  type Figure,
  RATING_VALUES,
  type Rating,
  roundHalfAway,
  roundTiesEven,
  type SimDate,
  totalCmp,
} from "@tc20ff/sim";

import type { PageRef } from "../pages/ref.ts";

/** A page a link cell opens (pages/ref.ts). */
export type { PageRef };

/** What a gain cell counts. */
export type GainUnit = "percent" | "money" | "price";
/** What a figure counts, so an exact figure and a band of it read alike (D461). */
export type Unit = "money" | "price" | "percent" | "ratio" | "number";

export type Cell =
  | { k: "int"; v: number }
  | { k: "money"; v: number }
  | { k: "percent"; v: number }
  | { k: "price"; v: number }
  | { k: "date"; v: SimDate }
  | { k: "rating"; v: Rating }
  | { k: "ratio"; v: number }
  | { k: "number"; v: number }
  | { k: "gain"; v: number; unit: GainUnit }
  | { k: "text"; v: string }
  | { k: "link"; text: string; page: PageRef }
  | { k: "band"; unit: Unit; low: number; high: number }
  | { k: "unknown" };

/**
 * Rust `format!("{:.N}")`: an exact decimal tie rounds to even (JS `toFixed` rounds it up), so the
 * scaled value goes through `roundTiesEven` first (D952).
 */
export function fixed(x: number, decimals: number): string {
  const scale = 10 ** decimals;
  return (roundTiesEven(x * scale) / scale).toFixed(decimals);
}

/** `1234567` as `1,234,567`. */
export function int(n: number): string {
  const digits = String(Math.abs(Math.trunc(n)));
  let out = n < 0 ? "-" : "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return out;
}

const MONEY_SCALES: readonly (readonly [number, string])[] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** Money scaled to T, B, M or K with three significant digits; under $1,000 in whole dollars. */
export function money(v: number): string {
  if (!Number.isFinite(v)) return "?";
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  for (const [scale, suffix] of MONEY_SCALES) {
    if (a >= scale) {
      const x = a / scale;
      const decimals = x >= 100 ? 0 : x >= 10 ? 1 : 2;
      return `${sign}$${fixed(x, decimals)}${suffix}`;
    }
  }
  return `${sign}$${fixed(a, 0)}`;
}

/** A fraction as a percent with one decimal; signed values keep their minus. */
export function percent(f: number): string {
  if (!Number.isFinite(f)) return "?";
  return `${fixed(f * 100, 1)}%`;
}

/** USD a share with cents and thousands separators: $45.23, $1,234.50. */
export function price(v: number): string {
  if (!Number.isFinite(v)) return "?";
  const cents = roundHalfAway(Math.abs(v) * 100);
  const sign = v < 0 && cents > 0 ? "-" : "";
  return `${sign}$${int(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, "0")}`;
}

export const MONTHS = [
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

/** A day as `03 Jan 2020` (fixed width, so a date column aligns). */
export function date(d: SimDate): string {
  return `${String(d.day).padStart(2, "0")} ${MONTHS[d.month - 1] ?? "?"} ${d.year}`;
}

/** A multiple with two decimals: 1.23x. */
export function ratio(v: number): string {
  if (!Number.isFinite(v)) return "?";
  return `${fixed(v, 2)}x`;
}

/** A quantity with one decimal and thousands separators: 1,234.5. */
export function number(v: number): string {
  if (!Number.isFinite(v)) return "?";
  const tenths = roundHalfAway(Math.abs(v) * 10);
  const sign = v < 0 && tenths > 0 ? "-" : "";
  return `${sign}${int(Math.floor(tenths / 10))}.${tenths % 10}`;
}

/** The agency label of a rating: "AaPlus" is "AA+", "BbbMinus" is "BBB-" (country-economy.csv). */
export function ratingLabel(r: Rating): string {
  const m = /^(Aaa|Aa|A|Bbb|Bb|B|Ccc|Cc)(Plus|Minus)?$/.exec(r);
  if (!m) return r;
  return (m[1] as string).toUpperCase() + (m[2] === "Plus" ? "+" : m[2] === "Minus" ? "-" : "");
}

/** A signed change: +1.2%, -$0.45, +$1.20M; zero has no sign. */
export function gain(v: number, unit: GainUnit): string {
  if (!Number.isFinite(v)) return "?";
  const a = Math.abs(v);
  const body = unit === "percent" ? percent(a) : unit === "money" ? money(a) : price(a);
  const zero = body.replace(/^[$0.,]+/, "") === "" || body === "0.0%" || body === "$0" || body === "$0.00";
  if (zero) return body;
  return `${v < 0 ? "-" : "+"}${body}`;
}

function unitFmt(unit: Unit, v: number): string {
  switch (unit) {
    case "money":
      return money(v);
    case "price":
      return price(v);
    case "percent":
      return percent(v);
    case "ratio":
      return ratio(v);
    case "number":
      return number(v);
  }
}

/** An estimate band in `unit`: `$12.0M-$18.0M`; one reaching below zero reads `-$5.00M to $3.00M`. */
export function bandIn(unit: Unit, low: number, high: number): string {
  if (!(Number.isFinite(low) && Number.isFinite(high))) return "?";
  const [l, h] = [unitFmt(unit, low), unitFmt(unit, high)];
  return low < 0 || high < 0 ? `${l} to ${h}` : `${l}-${h}`;
}

/** The cell of a plain value in a unit. */
export function unitCell(unit: Unit, v: number): Cell {
  switch (unit) {
    case "money":
      return { k: "money", v };
    case "price":
      return { k: "price", v };
    case "percent":
      return { k: "percent", v };
    case "ratio":
      return { k: "ratio", v };
    case "number":
      return { k: "number", v };
  }
}

/**
 * The cell of a view's figure (D461): an exact figure as its unit's plain cell, a band as a band
 * cell (its range only: the estimate inside it is not printed).
 */
export function figureCell(f: Figure, unit: Unit): Cell {
  return f.kind === "Exact"
    ? unitCell(unit, f.value)
    : { k: "band", unit, low: f.band.low, high: f.band.high };
}

/** The display string. */
export function display(c: Cell): string {
  switch (c.k) {
    case "int":
      return int(c.v);
    case "money":
      return money(c.v);
    case "percent":
      return percent(c.v);
    case "price":
      return price(c.v);
    case "date":
      return date(c.v);
    case "rating":
      return ratingLabel(c.v);
    case "ratio":
      return ratio(c.v);
    case "number":
      return number(c.v);
    case "gain":
      return gain(c.v, c.unit);
    case "text":
      return c.v;
    case "link":
      return c.text;
    case "band":
      return bandIn(c.unit, c.low, c.high);
    case "unknown":
      return "?";
  }
}

/** True for the numeric kinds, which align right. */
export function isNumeric(c: Cell): boolean {
  switch (c.k) {
    case "int":
    case "money":
    case "percent":
    case "price":
    case "ratio":
    case "number":
    case "gain":
    case "band":
      return true;
    default:
      return false;
  }
}

/** The value a cell sorts by, for the numeric kinds (a band by its midpoint). */
export function cellNumber(c: Cell): number | null {
  switch (c.k) {
    case "int":
    case "money":
    case "percent":
    case "price":
    case "ratio":
    case "number":
    case "gain":
      return c.v;
    case "band":
      return (c.low + c.high) / 2;
    case "date":
      return c.v.year * 372 + (c.v.month - 1) * 31 + (c.v.day - 1);
    case "rating":
      return RATING_VALUES.indexOf(c.v);
    default:
      return null;
  }
}

/** The text a text-like cell sorts by. */
function cellText(c: Cell): string | null {
  return c.k === "text" ? c.v : c.k === "link" ? c.text : null;
}

/**
 * Ascending order between two cells of one column: numbers by value, text and links by bytes
 * (the sim's string order, D4), dates by day, ratings best first, bands by midpoint. Unknown cells
 * are not ordered here; `compareForSort` puts them last in both directions.
 */
export function cmpCell(a: Cell, b: Cell): number {
  const [x, y] = [cellNumber(a), cellNumber(b)];
  if (x !== null && y !== null) return totalCmp(x, y);
  const [s, t] = [cellText(a), cellText(b)];
  if (s !== null && t !== null) return cmpStr(s, t);
  // A mixed column: numbers before text.
  if (x !== null && t !== null) return -1;
  if (s !== null && y !== null) return 1;
  return 0;
}

/**
 * The comparator of a sorted column (table/mod.rs `sort_order`): unknown cells last whatever the
 * direction, ties by row index so the order is stable.
 */
export function compareForSort(a: Cell, b: Cell, ascending: boolean, indexA: number, indexB: number): number {
  if (a.k === "unknown" && b.k === "unknown") return indexA - indexB;
  if (a.k === "unknown") return 1;
  if (b.k === "unknown") return -1;
  const o = ascending ? cmpCell(a, b) : cmpCell(b, a);
  return o || indexA - indexB;
}

/** Row order for one column (table/mod.rs `sort_order`): indexes into `cells`. */
export function sortOrder(cells: readonly Cell[], ascending: boolean): number[] {
  const order = cells.map((_, i) => i);
  order.sort((i, j) => compareForSort(cells[i] as Cell, cells[j] as Cell, ascending, i, j));
  return order;
}

/** A theme color class for a cell, when it has its own: gains, losses, links and bands. */
export function cellTone(c: Cell): "gain" | "loss" | "muted" | "link" | "band" | null {
  switch (c.k) {
    case "gain":
      return c.v > 0 ? "gain" : c.v < 0 ? "loss" : "muted";
    case "link":
      return "link";
    case "band":
      return "band";
    default:
      return null;
  }
}
