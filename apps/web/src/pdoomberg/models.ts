// Pdoomberg's function pages as data (crates/game/src/pdoomberg/pages.rs, M9.4; spec 8 Pdoomberg;
// 20-ui 20.5.2; 3-markets 3.13.1), and the terminal's text lines (pdoomberg/mod.rs
// `security_text`, the status bar, the command line): each page is a table or chart model built
// from the views (spec 9). Figures go through figureCell (D461), so a company that does not
// publish shows bands, never a hidden value; the true V a share (v_quotes `value`, Omniscient
// only) is never read (spec 8 "true V is never shown").
//
// The chart helpers of crates/game/src/chart/data.rs that F3 uses (Ohlc::from_bar, weekly,
// last_years, ten_year_view) are here too: F3 is their only reader.

import {
  type Archetype,
  BANDS,
  barRows,
  type ClockView,
  type CompanyId,
  type CompanyRow,
  type DailyBar,
  dateTimeDate,
  daysInMonth,
  type Figure,
  formatQuarter,
  type Listing,
  type SimDate,
  simDateAddDays,
  simDateDaysSinceEpoch,
  simDateWeekday,
  WEEKDAY_VALUES,
  type ZoneId,
} from "@tc20ff/sim";
import type { NameIndex } from "../links/names.ts";
import type { ChartModel, DocColumn, Ohlc, TableDoc } from "../pages/doc.ts";
import { type Filter, filterGet, filterId, sortedOptions } from "../pages/kinds/news.tsx";
import { type Pick, pickOf } from "../pages/Picker.tsx";
import { type PageRef, PDB_FUNCTION_NAME, type PdbFunction } from "../pages/ref.ts";
import { linkCell, statusText } from "../pages/tables.ts";
import { byId, byKey, type ViewsData } from "../pages/views.ts";
import {
  bandIn,
  type Cell,
  date,
  display,
  figureCell,
  gain,
  percent,
  price,
  ratingLabel,
} from "../widgets/cells.ts";

/** What the terminal shows: a function page, and the company loaded (pages/mod.rs). */
export interface PdoombergRoute {
  function: PdbFunction;
  company: CompanyId | null;
}

/** The route before anything is loaded: F2 Quotes. */
export const DEFAULT_ROUTE: PdoombergRoute = { function: "F2", company: null };

export const routeEq = (a: PdoombergRoute, b: PdoombergRoute) =>
  a.function === b.function && a.company === b.company;

/** Real milliseconds between two remakes of a table over v_quotes (every tick; D510). */
export const QUOTES_REFRESH_MS = 500;
/** Days of daily bars on F3 (3.13.1: daily bars up to a year). */
export const DAILY_DAYS = 365;
/** Years the long view covers (3-markets 3.13.1: weekly bars up to 10 years). */
export const LONG_VIEW_YEARS = 10;
/** The EFV band's half width (3.14.2; D140): market/jobs.rs EFV_ERROR_WIDTH. */
export const EFV_ERROR_WIDTH = 0.15;

const dash: Cell = { k: "text", v: "-" };

/** The exchange code of a zone ("NYSE"), from v_exchanges. */
function exchangeCode(v: ViewsData, z: ZoneId): string {
  return byKey(v.exchanges?.exchanges, (x) => x.zone, z)?.code ?? "-";
}

function ticker(r: CompanyRow): string {
  return r.public && r.ticker !== "" ? r.ticker : "-";
}

// ---------------------------------------------------------------- F2 Quotes

/**
 * F2's watchlists (spec 8: All, by industry, by country; the Disclosure radar is hidden, D515),
 * plus the player's own watchlist: `list` 0 is All, 1 the watchlist; `industry` and `country`
 * narrow either. The watchlist is v_clock's (D975).
 */
export function quotesTable(v: ViewsData, index: NameIndex, f: Filter): TableDoc {
  const watch = new Set<number>(v.clock?.watchlist ?? []);
  const industry = filterId(f, "industry");
  const country = filterId(f, "country");
  const rows: Cell[][] = [];
  for (const r of v.company_rows?.rows ?? []) {
    if (r.status === "Removed") continue;
    if (filterGet(f, "list") === 1 && !watch.has(r.id)) continue;
    if (industry !== null && r.industry !== industry) continue;
    if (country !== null && r.hq_country !== country) continue;
    const q = byId(v.quotes?.rows, r.id);
    const unknown: Cell = { k: "unknown" };
    rows.push([
      { k: "text", v: ticker(r) },
      linkCell(index, { kind: "company", id: r.id }),
      linkCell(index, { kind: "industry", id: r.industry }),
      linkCell(index, { kind: "country", id: r.hq_country }),
      r.exchange === null ? dash : { k: "text", v: exchangeCode(v, r.exchange) },
      q ? { k: "price", v: q.last } : unknown,
      q ? { k: "gain", v: q.change, unit: "price" } : unknown,
      q ? { k: "gain", v: q.change_pct, unit: "percent" } : unknown,
      // The published estimate and its +-15% band (3.14.2; D140).
      q ? { k: "band", unit: "price", low: q.efv_low, high: q.efv_high } : unknown,
      q && q.efv > 0 ? { k: "gain", v: q.last / q.efv - 1, unit: "percent" } : unknown,
      q ? { k: "number", v: q.buzz } : unknown,
      figureCell(r.value, "money"),
      { k: "rating", v: r.rating },
      { k: "text", v: watch.has(r.id) ? "*" : "" },
    ]);
  }
  return {
    id: "pdb.f2",
    columns: [
      { title: "Ticker", width: 60 },
      { title: "Name", width: 210 },
      { title: "Industry", width: 150 },
      { title: "HQ", width: 110 },
      { title: "Exch", width: 56 },
      { title: "Last", width: 76, hint: "USD a share; ? while not quoted" },
      { title: "Chg", width: 66, hint: "Since the last close" },
      { title: "Chg%", width: 64 },
      { title: "EFV band", width: 130, hint: "The estimated fair value band, +-15% (3.14.2)" },
      { title: "Gap", width: 64, hint: "Last over the EFV (3.14.2)" },
      { title: "Buzz", width: 56, hint: "-100 to +100 (3.10)" },
      {
        title: "Value",
        width: 120,
        hint: "Market cap at EFV when listed; a band while not published (D420)",
      },
      { title: "Rating", width: 50 },
      { title: "W", width: 24, hint: "* on the watchlist (click a row to toggle)" },
    ],
    rows,
  };
}

/** The country options: every country with an HQ, by name. */
export function countryOptions(v: ViewsData): [string, Pick][] {
  return sortedOptions(
    (v.countries?.countries ?? [])
      .filter((c) => c.hq_companies.length > 0)
      .map((c) => [c.name, pickOf(c.id)]),
  );
}

// ---------------------------------------------------------------- F3 Chart

/**
 * A view bar with its EFV band (chart/data.rs Ohlc::from_bar; D424, D465): the bar's efv_low to
 * efv_high, the estimate in force through that day.
 */
export function ohlcFromBar(b: DailyBar): Ohlc {
  const band: [number, number] | null =
    Number.isFinite(b.efv) && b.efv > 0
      ? [b.efv * (1 - EFV_ERROR_WIDTH), b.efv * (1 + EFV_ERROR_WIDTH)]
      : null;
  return { date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, band };
}

const dayNumber = (d: SimDate) => simDateDaysSinceEpoch(d);

/**
 * Daily bars into Monday-to-Sunday weeks, each dated by its first bar (chart/data.rs `weekly`):
 * the first open, the last close, the highest high and lowest low, and the band of the week's
 * last bar (the band at the close, D457), as v_price_bars' weekly bars take the last day's EFV
 * (D424).
 */
export function weekly(daily: readonly Ohlc[]): Ohlc[] {
  const key = (d: SimDate) => dayNumber(d) - WEEKDAY_VALUES.indexOf(simDateWeekday(d));
  const out: Ohlc[] = [];
  let lastKey: number | null = null;
  for (const b of daily) {
    const k = key(b.date);
    const w = out[out.length - 1];
    if (w && lastKey === k) {
      w.high = Math.max(w.high, b.high);
      w.low = Math.min(w.low, b.low);
      w.close = b.close;
      w.band = b.band;
    } else {
      out.push({ ...b });
      lastKey = k;
    }
  }
  return out;
}

/**
 * The bars of the last `years` years up to the last bar (dates after the same day `years`
 * earlier; 29 Feb falls back to 28 Feb in a non-leap year).
 */
export function lastYears(daily: readonly Ohlc[], years: number): readonly Ohlc[] {
  const last = daily[daily.length - 1];
  if (!last) return daily;
  const d = last.date;
  const y = d.year - years;
  const from: SimDate = { year: y, month: d.month, day: Math.min(d.day, daysInMonth(y, d.month)) };
  const f = dayNumber(from);
  let lo = 0;
  let hi = daily.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dayNumber((daily[mid] as Ohlc).date) <= f) lo = mid + 1;
    else hi = mid;
  }
  return daily.slice(lo);
}

/** The 10-year view: the last ten years in weekly bars. */
export function tenYearView(daily: readonly Ohlc[]): Ohlc[] {
  return weekly(lastYears(daily, LONG_VIEW_YEARS));
}

/** A candle chart (chart/data.rs ChartModel::candles). */
export function candlesChart(title: string, bars: Ohlc[]): ChartModel {
  return {
    title,
    labels: bars.map((b) => date(b.date)),
    series: [{ k: "candles", bars }],
    format: "Price",
    reference: null,
  };
}

/** A company's daily bars, every one (the views keep 10 years). */
function companyBars(v: ViewsData, id: CompanyId): DailyBar[] | null {
  const h = byId(v.price_bars?.companies, id);
  return h ? barRows(h.bars) : null;
}

/** A company's daily bars over the last year with each day's EFV band (spec 8 F3; D424, D465). */
export function dailyChart(v: ViewsData, id: CompanyId): ChartModel | null {
  const bars = companyBars(v, id);
  const last = bars?.[bars.length - 1];
  if (!bars || !last) return null;
  const from = dayNumber(simDateAddDays(last.date, -DAILY_DAYS));
  const shown = bars.filter((b) => dayNumber(b.date) >= from).map(ohlcFromBar);
  return candlesChart("Daily bars over the EFV band, 1 year", shown);
}

/** The 10-year view: weekly bars, each with its last day's band (3.13.1; D457, D465). */
export function weeklyChart(v: ViewsData, id: CompanyId): ChartModel | null {
  const bars = companyBars(v, id);
  if (!bars || bars.length === 0) return null;
  return candlesChart("10 years, weekly bars over the EFV band", tenYearView(bars.map(ohlcFromBar)));
}

/** F3's line about the company: its published EFV band, or the value band of a private one. */
export function chartNote(v: ViewsData, id: CompanyId): string {
  const q = byId(v.quotes?.rows, id);
  if (q)
    return `EFV band ${bandIn("price", q.efv_low, q.efv_high)} (EFV +-15%, 3.14.2). The true value is never shown.`;
  const r = byId(v.company_rows?.rows, id);
  return r
    ? `Not quoted: no price bars. Value shown (5.13 step 6): ${display(figureCell(r.value, "money"))}.`
    : "Not in the game.";
}

/** F3 with no company loaded. */
export const NO_COMPANY =
  "No company loaded. Type TICKER F3 in the command bar (Ctrl+K), or right-click a row in F2, F5, F6 or F10.";

// ---------------------------------------------------------------- F4 Order

/** F4 Order holds only the lock (spec 8 "F4 Order shows Read-only MVP"; D516). */
export const READ_ONLY_LOCK = "Read-only MVP";

// ---------------------------------------------------------------- F5 Filings

/**
 * F5 Filings (spec 8: quarterly statements): every company's newest published quarter
 * (v_filings, D130); a company that does not publish shows its lines as bands (D420).
 */
export function filingsTable(v: ViewsData, index: NameIndex): TableDoc {
  const m = (x: Figure) => figureCell(x, "money");
  const rows = (v.filings?.filings ?? []).map((f): Cell[] => {
    const row = byId(v.company_rows?.rows, f.company);
    return [
      row ? { k: "text", v: ticker(row) } : dash,
      linkCell(index, { kind: "company", id: f.company }),
      { k: "text", v: formatQuarter(f.quarter) },
      m(f.revenue),
      m(f.ebit),
      m(f.ebitda),
      m(f.net_income),
      m(f.operating_cash),
      m(f.cash),
      m(f.line_drawn),
      m(f.equity),
      { k: "rating", v: f.rating },
      { k: "text", v: f.estimated ? "estimates" : f.synthetic ? "synthetic 2019" : "published" },
    ];
  });
  const n = (title: string): DocColumn => ({ title, width: 110 });
  return {
    id: "pdb.f5",
    columns: [
      { title: "Ticker", width: 60 },
      { title: "Company", width: 210 },
      { title: "Quarter", width: 70 },
      n("Revenue"),
      n("EBIT"),
      n("EBITDA"),
      n("Net income"),
      n("Op. cash"),
      n("Cash"),
      n("Line drawn"),
      n("Equity"),
      { title: "Rating", width: 50 },
      { title: "Figures", width: 100, hint: "Bands for a company that does not publish (D420)" },
    ],
    rows,
  };
}

/** F5's line over the table. */
export function filingsNote(v: ViewsData): string {
  const q = v.filings?.quarter;
  return q
    ? `Filings: ${formatQuarter(q)}, the newest published quarter. Older quarters are on each company's Financials tab.`
    : "No quarter published yet.";
}

// ---------------------------------------------------------------- F6 Ratings

/** A rating's band in capitals ("AA" for AA+, AA and AA-; finance::rating::Band, D220). */
export function ratingBandText(r: CompanyRow["rating"]): string {
  return ratingLabel(r).replace(/[+-]$/, "");
}

/**
 * F6 Ratings: credit ratings only (spec 8; no analyst ratings in the MVP), for every company
 * still in the game (D157: F6 shows all ratings).
 */
export function ratingsTable(v: ViewsData, index: NameIndex): TableDoc {
  const rows: Cell[][] = [];
  for (const c of v.ratings?.companies ?? []) {
    if (c.status === "Removed") continue;
    const row = byId(v.company_rows?.rows, c.id);
    const n = c.last_review_notches;
    rows.push([
      row ? { k: "text", v: ticker(row) } : dash,
      linkCell(index, { kind: "company", id: c.id }),
      { k: "rating", v: c.rating },
      { k: "text", v: ratingBandText(c.rating) },
      { k: "text", v: n > 0 ? `+${n}` : String(n) },
      { k: "percent", v: c.line_rate },
      { k: "percent", v: c.home_spread },
      figureCell(c.line_drawn, "money"),
      figureCell(c.line_limit, "money"),
      { k: "text", v: statusText(c.status) },
    ]);
  }
  return {
    id: "pdb.f6",
    columns: [
      { title: "Ticker", width: 60 },
      { title: "Company", width: 210 },
      { title: "Rating", width: 56, hint: "Credit rating (spec 5.12)" },
      { title: "Band", width: 50 },
      { title: "Last review", width: 80, hint: "Notches at the last review" },
      { title: "Line rate", width: 76, hint: "Base + home spread + rating spread (5.12)" },
      { title: "Home spread", width: 86 },
      { title: "Line drawn", width: 120 },
      { title: "Line limit", width: 120 },
      { title: "Status", width: 80 },
    ],
    rows,
  };
}

/** The ratings strip: the base rate and the companies in each band (bankrupt and removed not). */
export function ratingsStrip(v: ViewsData): string {
  const r = v.ratings;
  if (!r) return "";
  const counts = BANDS.map((b) => {
    const label = b.toUpperCase();
    const n = r.companies.filter(
      (c) => c.status !== "Bankrupt" && c.status !== "Removed" && ratingBandText(c.rating) === label,
    ).length;
    return `${label} ${n}`;
  });
  return `Base rate ${percent(r.base_rate)} | by band: ${counts.join("  ")}`;
}

// ---------------------------------------------------------------- F7 Bonds

/** F7's zone credit spreads (batch 155): base and effective. */
export function zoneSpreadsTable(v: ViewsData, index: NameIndex): TableDoc {
  return {
    id: "pdb.f7.zones",
    columns: [
      { title: "No.", width: 36 },
      { title: "Zone", width: 180 },
      { title: "Base", width: 64, hint: "Base credit spread (5.1.2)" },
      { title: "Effective", width: 70, hint: "After the cycle's effect (5.1.2)" },
    ],
    rows: (v.rates?.zones ?? []).map((z): Cell[] => [
      { k: "int", v: z.number },
      linkCell(index, { kind: "zone", id: z.zone }),
      { k: "percent", v: z.base },
      { k: "percent", v: z.effective },
    ]),
  };
}

/** F7's sovereign spreads (batch 155): each country's rating and spread. */
export function sovereignsTable(v: ViewsData, index: NameIndex): TableDoc {
  return {
    id: "pdb.f7.sovereigns",
    columns: [
      { title: "Country", width: 170 },
      { title: "ISO3", width: 44 },
      { title: "Zone", width: 160 },
      { title: "Rating", width: 50 },
      { title: "Spread", width: 64 },
    ],
    rows: (v.rates?.sovereigns ?? []).map((s): Cell[] => [
      linkCell(index, { kind: "country", id: s.country }),
      { k: "text", v: s.iso3 },
      linkCell(index, { kind: "zone", id: s.zone }),
      { k: "rating", v: s.rating },
      { k: "percent", v: s.spread },
    ]),
  };
}

/** F7's corporate spread by rating (5.12). */
export function ratingSpreadsTable(v: ViewsData): TableDoc {
  return {
    id: "pdb.f7.ratings",
    columns: [
      { title: "Rating", width: 56 },
      { title: "Spread", width: 64, hint: "Corporate spread over base (5.12)" },
    ],
    rows: (v.rates?.rating_spreads ?? []).map((r): Cell[] => [
      { k: "rating", v: r.rating },
      { k: "percent", v: r.spread },
    ]),
  };
}

/** F7's line over its tables. */
export function bondsNote(v: ViewsData): string {
  return v.rates ? `World base rate ${percent(v.rates.base_rate)}` : "";
}

// ---------------------------------------------------------------- F10 Screener

/** The archetypes (spec 6.1), for the screener's filter. */
export const ARCHETYPES: readonly Archetype[] = [
  "StateChampion",
  "Startup",
  "AggressiveGrower",
  "CashCow",
  "Incumbent",
];

/** An archetype's name (ai/archetype.rs Archetype::name). */
export const ARCHETYPE_NAMES: Readonly<Record<Archetype, string>> = {
  StateChampion: "State champion",
  Startup: "Startup",
  AggressiveGrower: "Aggressive grower",
  CashCow: "Cash cow",
  Incumbent: "Incumbent",
};

/** The listing filter's year picks start here: `LISTED_YEAR + year` (D511). */
export const LISTED_YEAR = 10_000;

/**
 * The listing filter: 1 private, 2 listed before 2020, 3 listed in play, `LISTED_YEAR + y`
 * listed in play in year `y` (spec 8 Startups and listings: "F10 Screener filter by origin and
 * listing date").
 */
export function listingPasses(l: Listing, pick: Pick): boolean {
  if (pick === 0) return true;
  if (pick === 1) return l.kind === "Private";
  if (pick === 2) return l.kind === "BeforeStart";
  if (pick === 3) return l.kind === "InPlay";
  if (pick > LISTED_YEAR) return l.kind === "InPlay" && l.date.year === pick - LISTED_YEAR;
  return true;
}

/**
 * F10 Screener (spec 8 read-only filters; 9.2 `list_companies` filters: industry, country,
 * zone, exchange, public, archetype, origin and listing date).
 */
export function screenerTable(v: ViewsData, index: NameIndex, f: Filter): TableDoc {
  const zoneOf = (r: CompanyRow) => byId(v.countries?.countries, r.hq_country)?.zone ?? null;
  const [industry, country, zone, exchange, archetype] = [
    "industry",
    "country",
    "zone",
    "exchange",
    "archetype",
  ].map((k) => filterId(f, k));
  const rows: Cell[][] = [];
  for (const r of v.company_rows?.rows ?? []) {
    if (r.status === "Removed") continue;
    if (industry != null && r.industry !== industry) continue;
    if (country != null && r.hq_country !== country) continue;
    const z = zoneOf(r);
    if (zone != null && z !== zone) continue;
    if (exchange != null && r.exchange !== exchange) continue;
    const pub = filterGet(f, "public");
    if ((pub === 1 && !r.public) || (pub === 2 && r.public)) continue;
    if (archetype != null && ARCHETYPES[archetype] !== r.archetype) continue;
    const origin = filterGet(f, "origin");
    if ((origin === 1 && r.origin.kind !== "Start") || (origin === 2 && r.origin.kind !== "Born")) continue;
    if (!listingPasses(r.listing, filterGet(f, "listing"))) continue;
    rows.push([
      { k: "text", v: ticker(r) },
      linkCell(index, { kind: "company", id: r.id }),
      linkCell(index, { kind: "industry", id: r.industry }),
      linkCell(index, { kind: "country", id: r.hq_country }),
      z === null ? dash : linkCell(index, { kind: "zone", id: z }),
      r.exchange === null ? dash : { k: "text", v: exchangeCode(v, r.exchange) },
      { k: "text", v: r.public ? "listed" : "private" },
      { k: "text", v: ARCHETYPE_NAMES[r.archetype] },
      { k: "text", v: r.origin.kind === "Start" ? "start" : `born ${date(r.origin.date)}` },
      r.listing.kind === "InPlay"
        ? { k: "date", v: r.listing.date }
        : { k: "text", v: r.listing.kind === "BeforeStart" ? "before 2020" : "-" },
      figureCell(r.revenue_ttm, "money"),
      figureCell(r.net_income_ttm, "money"),
      figureCell(r.value, "money"),
      { k: "rating", v: r.rating },
    ]);
  }
  return {
    id: "pdb.f10",
    columns: [
      { title: "Ticker", width: 60 },
      { title: "Name", width: 200 },
      { title: "Industry", width: 150 },
      { title: "HQ", width: 110 },
      { title: "Zone", width: 140 },
      { title: "Exch", width: 56 },
      { title: "Public", width: 60 },
      { title: "Archetype", width: 120, hint: "Spec 6.1" },
      { title: "Origin", width: 120, hint: "A starting company, or born in play (5.19)" },
      { title: "Listed", width: 96, hint: "The listing date (5.20.1)" },
      { title: "Revenue TTM", width: 120, hint: "A band while not published" },
      { title: "NI TTM", width: 120 },
      { title: "Value", width: 120 },
      { title: "Rating", width: 50 },
    ],
    rows,
  };
}

/** The screener's pickers: label, filter key, options (the Picker adds "All"). */
export function screenerPickers(
  v: ViewsData,
  index: NameIndex,
  industries: [string, Pick][],
): [string, string, [string, Pick][]][] {
  const zones = sortedOptions(
    (v.zones?.zones ?? []).map((z) => [index.title({ kind: "zone", id: z.id }), pickOf(z.id)]),
  );
  const exchanges = sortedOptions((v.exchanges?.exchanges ?? []).map((x) => [x.code, pickOf(x.zone)]));
  const archetypes = ARCHETYPES.map((a, i): [string, Pick] => [ARCHETYPE_NAMES[a], pickOf(i)]);
  const listing: [string, Pick][] = [
    ["Private", 1],
    ["Listed before 2020", 2],
    ["Listed in play", 3],
  ];
  const years = new Set<number>((v.births?.listings ?? []).map((l) => l.date.year));
  // The current year from the name index's newest recap: the page does not read v_clock.
  const recap = index.latestRecap();
  const now = v.clock?.date.year ?? (recap?.kind === "recap" ? recap.quarter.year : 2020);
  for (let y = 2020; y <= now; y++) years.add(y);
  for (const y of [...years].sort((a, b) => a - b))
    listing.push([`Listed in ${y}`, LISTED_YEAR + Math.max(0, y)]);
  return [
    ["Industry", "industry", industries],
    ["Country", "country", countryOptions(v)],
    ["Zone", "zone", zones],
    ["Exchange", "exchange", exchanges],
    [
      "Public",
      "public",
      [
        ["Listed", 1],
        ["Private", 2],
      ],
    ],
    ["Archetype", "archetype", archetypes],
    [
      "Origin",
      "origin",
      [
        ["Starting company", 1],
        ["Born in play", 2],
      ],
    ],
    ["Listing", "listing", listing],
  ];
}

// ---------------------------------------------------------------- the terminal's lines

/**
 * The security line of the loaded company (20.5.2): ticker, name, industry, last and change,
 * EFV band, rating and the next earnings; a private company's value band instead of a price.
 */
export function securityText(v: ViewsData, index: NameIndex, id: CompanyId): string {
  const r = byId(v.company_rows?.rows, id);
  if (!r) return `${index.title({ kind: "company", id })}: not in the game`;
  const industry = index.title({ kind: "industry", id: r.industry });
  const t = r.ticker === "" ? "-" : r.ticker;
  const q = byId(v.quotes?.rows, id);
  const px = q
    ? `LAST ${price(q.last)}  CHG ${gain(q.change_pct, "percent")}  EFV ${bandIn("price", q.efv_low, q.efv_high)}`
    : `NOT QUOTED  VALUE ${display(figureCell(r.value, "money"))}`;
  const next = v.clock ? date(dateTimeDate(v.clock.next_release)) : "-";
  return `${t}  ${r.name.toUpperCase()}  ${industry.toUpperCase()}  ${px}  RATING ${ratingLabel(r.rating)}  NEXT EARNINGS ${next}`;
}

/** The status bar: date and hour, speed, and the alert count (20.5.2 (A)). */
export function statusLine(c: ClockView, alerts: number): string {
  const speed = c.paused ? "PAUSED" : `SPEED ${c.speed}`;
  return `${c.weekday.toUpperCase()} ${date(c.date).toUpperCase()} ${String(c.hour).padStart(2, "0")}:00  ${speed}  ALERTS ${alerts}`;
}

/** The command line: the route as a terminal command ("> ARDR F3 <GO>   CHART"). */
export function commandLine(route: PdoombergRoute, index: NameIndex): string {
  let who = "";
  if (route.company !== null) {
    const p: PageRef = { kind: "company", id: route.company };
    const alias = index.entry(p)?.aliases[0];
    who = `${alias ? alias : index.title(p)} `;
  }
  return `> ${who}${route.function} <GO>   ${PDB_FUNCTION_NAME[route.function].toUpperCase()}`;
}

/** The company a row of a Pdoomberg table is about: the first cell that links to a company. */
export function rowCompany(row: readonly Cell[]): CompanyId | null {
  for (const c of row) if (c.k === "link" && c.page.kind === "company") return c.page.id;
  return null;
}

/** What a row click does (mod.rs `row_clicks`). */
export type RowAction =
  | { k: "load"; company: CompanyId }
  | { k: "watch"; company: CompanyId; add: boolean }
  | null;

/**
 * A row click on the page's main table: a right-click on any page loads the company (when it is
 * not loaded already); on F2 a primary click watches or unwatches it (M7.8; design fix 8). A
 * middle click does nothing.
 */
export function rowAction(
  route: PdoombergRoute,
  row: readonly Cell[],
  button: number,
  watchlist: readonly CompanyId[],
): RowAction {
  const id = rowCompany(row);
  if (id === null) return null;
  if (button === 2) return route.company === id ? null : { k: "load", company: id };
  if (button === 0 && route.function === "F2")
    return { k: "watch", company: id, add: !watchlist.includes(id) };
  return null;
}

/** The views each function page reads (and the security line's), for its subscription. */
export const FUNCTION_VIEWS = {
  F2: ["quotes", "company_rows", "exchanges", "clock", "industry_rows", "countries"],
  F3: ["quotes", "company_rows", "price_bars"],
  F4: [],
  F5: ["filings", "company_rows"],
  F6: ["ratings", "company_rows"],
  F7: ["rates"],
  F9: ["industry_rows", "births"],
  F10: ["company_rows", "countries", "exchanges", "zones", "births", "industry_rows"],
} as const;
