// The Pdoomberg app's route grammar (pivot 15.3) and its command line.
//
//   page/<fn>[/<ticker>]     page/F2   page/F3/ARDR   page/F4/ARDR   page/F8
//
// `<fn>` is a function key F2 to F10 (F8 is the Account page, which the old terminal lacked; F4 is
// the Order ticket) or its name (quotes, chart, order, filings, ratings, bonds, account,
// industries, screener). `<ticker>` is the company loaded; a company with no ticker is `~<id>`.
// A null or unreadable route is the home page, F2 Quotes. The window manager keeps the string, so
// links, back and forward and a saved desktop reopen the same page.

import type { CompanyId } from "@tc20ff/sim";
import { PDB_FUNCTION_NAME, type PdbFunction } from "../../pages/ref.ts";

/** Every page of the app, in key order. F8 is the Account page (this app's, not pdoomberg/'s). */
export const TERM_PAGES = ["F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"] as const;
export type TermPage = (typeof TERM_PAGES)[number];

export const TERM_PAGE_NAME: Readonly<Record<TermPage, string>> = {
  ...PDB_FUNCTION_NAME,
  F8: "Account",
};

/** What the page is called in a route and on the command line, besides its key. */
const ALIASES: Readonly<Record<string, TermPage>> = {
  quotes: "F2",
  chart: "F3",
  order: "F4",
  filings: "F5",
  ratings: "F6",
  bonds: "F7",
  account: "F8",
  acct: "F8",
  industries: "F9",
  screener: "F10",
  scrn: "F10",
};

/** A page by its key ("F3", "f10") or name ("chart"); null for anything else. */
export function parseTermPage(s: string): TermPage | null {
  const u = s.trim().toUpperCase();
  if ((TERM_PAGES as readonly string[]).includes(u)) return u as TermPage;
  return ALIASES[s.trim().toLowerCase()] ?? null;
}

/** The page and the company loaded; the company is a ticker or `~<id>`, upper case. */
export interface TermRoute {
  page: TermPage;
  company: string | null;
}

export const HOME_ROUTE: TermRoute = { page: "F2", company: null };

const COMPANY_SEGMENT = /^(?:~\d+|[A-Z0-9][A-Z0-9.\-_]*)$/;

/** The route a string names; null when it is not one of this app's routes. */
export function parseTermRoute(route: string | null): TermRoute | null {
  if (route === null || route === "") return HOME_ROUTE;
  const parts = route.split("/");
  if (parts[0] !== "page" || parts.length < 2 || parts.length > 3) return null;
  const page = parseTermPage(parts[1] ?? "");
  if (page === null) return null;
  const seg = parts[2];
  if (seg === undefined || seg === "") return { page, company: null };
  const company = decodeURIComponent(seg).toUpperCase();
  return COMPANY_SEGMENT.test(company) ? { page, company } : null;
}

export function formatTermRoute(r: TermRoute): string {
  return r.company === null ? `page/${r.page}` : `page/${r.page}/${encodeURIComponent(r.company)}`;
}

/** What a company row needs to be found by: its id and ticker. */
export interface TickerRow {
  id: number;
  ticker: string;
  public: boolean;
}

/** The segment that names company `row` in a route: its ticker when it has one, else `~id`. */
export function companySegment(row: TickerRow): string {
  return row.public && row.ticker !== "" ? row.ticker.toUpperCase() : `~${row.id}`;
}

/** The company a route segment names, or null while the rows are not loaded or none matches. */
export function resolveCompany(seg: string | null, rows: readonly TickerRow[] | undefined): CompanyId | null {
  if (seg === null || rows === undefined) return null;
  if (seg.startsWith("~")) {
    const id = Number(seg.slice(1));
    return rows.some((r) => r.id === id) ? (id as CompanyId) : null;
  }
  const row = rows.find((r) => r.public && r.ticker.toUpperCase() === seg);
  return row === undefined ? null : (row.id as CompanyId);
}

/** The result of a line typed at the command bar. */
export type Command = { ok: true; route: TermRoute } | { ok: false; message: string };

/**
 * `TICKER Fn`, `Fn TICKER`, `Fn` or `TICKER` (20-ui 20.5.2): a page keeps the company loaded, and a
 * ticker alone opens the chart (F3) of that company.
 */
export function parseCommand(
  text: string,
  rows: readonly TickerRow[] | undefined,
  current: TermRoute,
): Command {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter((t) => t !== "");
  if (tokens.length === 0) return { ok: false, message: "Type TICKER Fn, for example ARDR F3." };
  if (tokens.length > 2) return { ok: false, message: "Too many words: type TICKER Fn." };
  let page: TermPage | null = null;
  let company: string | null = null;
  for (const t of tokens) {
    const p: TermPage | null = page === null ? parseTermPage(t) : null;
    if (p !== null) {
      page = p;
      continue;
    }
    const row =
      company === null
        ? rows?.find((r) => r.public && r.ticker.toUpperCase() === t.toUpperCase())
        : undefined;
    if (row === undefined) return { ok: false, message: `No page or ticker ${t.toUpperCase()}.` };
    company = companySegment(row);
  }
  if (page === null) return { ok: true, route: { page: "F3", company } };
  return { ok: true, route: { page, company: company ?? current.company } };
}

/** Narrows a Pdoomberg page key to this app's page type (F8 is not in pdoomberg/'s list). */
export function pdbPageOf(page: TermPage): PdbFunction {
  // The Account page (F8) sits over the lock page's area: pdoomberg/ has no F8.
  return page === "F8" ? "F4" : page;
}
