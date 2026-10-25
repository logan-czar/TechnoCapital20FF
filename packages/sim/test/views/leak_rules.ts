// The leak test's map of the views (leak.test.ts): which subtrees belong to a company, which
// leaves are ids, counts or dates, and which plain numbers a banded company's subtree may hold.
// Not a Rust file: crates/game/tests/m9_leak.rs (D574) scans rendered text and knows its subjects
// from the screens; here the view data is walked, so the subjects come from these rules.
//
// Paths are "normalized": the view's name, then each field, with `[]` for any array index
// (`company_rows.rows[].revenue_ttm`). Every rule names a full path, so a field name means
// nothing on its own: `units` under province_cards is a list of unit ids, `units` in v_units
// will be full rows with money, and only the first is listed here.
//
// Every ported view must have an entry in `VIEW_RULES` (the test fails on one that has none), so
// porting a view (v_units, v_tech, v_projection, v_recap, the industry views, v_map_layers)
// means classifying it here: its company subtrees, its id leaves and what of a banded company
// it may show as a plain number.
import type { CompanyId } from "../../src/types/ids.ts";
import type { Figure } from "../../src/types/views/estimate.ts";
import type { ViewName } from "../../src/types/views/index.ts";
import { statementLineIndex } from "../../src/views/estimate.ts";

export interface ViewRules {
  /**
   * The arrays whose elements are about one company: the element's normalized path, then the
   * field that holds the company's id (a null id is about no company).
   */
  readonly owners?: Readonly<Record<string, string>>;
  /**
   * Leaves that are ids, counts, ticks or enum numbers, never a figure: the scan skips them.
   * Dates and quarters are skipped by their shape (`isDateLike`), not listed.
   */
  readonly ids?: readonly string[];
  /**
   * Plain numbers a banded company's subtree may hold besides its ids and dates: what D420
   * leaves exact (operations, ratings, shares, the cap table), market data and the EFV (D140).
   * Any other plain number there is a figure served exact, and fails the shape check.
   */
  readonly bandedPlain?: readonly string[];
}

/** Every ported view's rules (see the header). */
export const VIEW_RULES: Partial<Record<ViewName, ViewRules>> = {
  clock: {
    ids: [
      "clock.now",
      "clock.hour",
      "clock.speed",
      "clock.selected_speed",
      "clock.days_to_next_phase",
      "clock.next_release",
    ],
  },
  places: { ids: ["places.provinces[].id", "places.provinces[].country", "places.countries[].id"] },
  countries: {
    ids: ["countries.countries[].id", "countries.countries[].zone", "countries.countries[].hq_companies[]"],
  },
  zones: { ids: ["zones.zones[].id", "zones.zones[].number", "zones.zones[].members[]"] },
  rates: {
    ids: [
      "rates.zones[].zone",
      "rates.zones[].number",
      "rates.sovereigns[].country",
      "rates.sovereigns[].zone",
    ],
  },
  characters: {
    // A character's holdings and roles are about the company they name.
    owners: {
      "characters.full[].holdings[]": "company",
      "characters.full[].roles[]": "company",
      "characters.partial[].roles[]": "company",
    },
    ids: [
      "characters.full[].id.id",
      "characters.full[].age",
      "characters.full[].home.province",
      "characters.full[].home.country",
      "characters.full[].roles[].company",
      "characters.full[].holdings[].company",
      "characters.full[].holdings[].shares",
      "characters.partial[].id.id",
      "characters.partial[].age",
      "characters.partial[].roles[].company",
      ...skills("characters.full[]"),
      ...skills("characters.partial[]"),
    ],
    // Shares and the share of the company held are the cap table's (D420: never banded).
    bandedPlain: ["characters.full[].holdings[].share"],
  },
  cap_table: {
    owners: { "cap_table.companies[]": "company" },
    ids: [
      "cap_table.companies[].company",
      "cap_table.companies[].shares_out",
      "cap_table.companies[].lines[].shares",
      "cap_table.companies[].lines[].holder.controller.character",
      "cap_table.companies[].lines[].holder.controller.company",
      "cap_table.companies[].lines[].holder.controller.country",
      "cap_table.companies[].lines[].holder.character",
    ],
    // Shares are not money, so a cap table is never banded (D420, D425).
    bandedPlain: ["cap_table.companies[].lines[].share"],
  },
  quotes: {
    owners: { "quotes.rows[]": "id" },
    ids: ["quotes.rows[].id", "quotes.rows[].exchange", "quotes.rows[].volume", "quotes.indices[].zone"],
    // A quoted company's market data, and its EFV with the ±15% band (D140, 3.14.2): public even
    // for a new listing before its first release. `value` (the true V) is Omniscient only.
    bandedPlain: [
      "quotes.rows[].last",
      "quotes.rows[].prev_close",
      "quotes.rows[].change",
      "quotes.rows[].change_pct",
      "quotes.rows[].efv",
      "quotes.rows[].efv_low",
      "quotes.rows[].efv_high",
      "quotes.rows[].buzz",
      "quotes.rows[].market_cap",
    ],
  },
  price_bars: {
    owners: { "price_bars.companies[]": "id" },
    ids: [
      "price_bars.companies[].id",
      "price_bars.companies[].bars.log.closed.len",
      "price_bars.companies[].bars.log.open.len",
    ],
    // The daily bars: prices and each day's EFV (D424), market data.
    bandedPlain: ["open", "high", "low", "close", "efv"].flatMap((f) => [
      `price_bars.companies[].bars.log.closed.slots[][].${f}`,
      `price_bars.companies[].bars.log.open.slots[].${f}`,
    ]),
  },
  exchanges: {
    ids: [
      "exchanges.exchanges[].zone",
      "exchanges.exchanges[].zone_number",
      "exchanges.exchanges[].hub_province",
      "exchanges.exchanges[].listed_count",
      "exchanges.exchanges[].constituents[]",
      "exchanges.exchanges[].closes.log.closed.len",
      "exchanges.exchanges[].closes.log.open.len",
    ],
  },
  market_stats: {
    ids: [
      "market_stats.listed",
      "market_stats.quoted",
      "market_stats.within_band",
      "market_stats.reports",
      "market_stats.beats",
      "market_stats.misses",
    ],
  },
  news: {
    owners: { "news.feed[]": "company" },
    ids: [
      "news.feed[].id",
      "news.feed[].industry",
      "news.feed[].company",
      "news.feed[].event",
      "news.feed[].kind.yes",
      "news.feed[].kind.no",
      "news.feed[].kind.startups",
    ],
    // `kind.price` and `kind.net_usd` only on a Listing headline (`plainInBandedIf`).
  },
  births: {
    owners: { "births.births[]": "id", "births.listings[]": "id" },
    ids: [
      "births.events[].id",
      "births.events[].industries[]",
      "births.events[].startups[]",
      "births.births[].id",
      "births.births[].industry",
      "births.births[].hq",
      "births.births[].event",
      "births.listings[].id",
      "births.listings[].exchange",
      "births.full_characters_made",
      "births.full_characters",
      "births.births_by_industry[]",
    ],
    // The IPO price is the listing's public price (spec 5.18).
    bandedPlain: ["births.listings[].ipo_price"],
  },
  company_rows: {
    owners: { "company_rows.rows[]": "id" },
    ids: [
      "company_rows.rows[].id",
      "company_rows.rows[].industry",
      "company_rows.rows[].hq_country",
      "company_rows.rows[].exchange",
      "company_rows.rows[].listing.exchange",
      "company_rows.rows[].controller.character",
      "company_rows.rows[].controller.company",
      "company_rows.rows[].controller.country",
      "company_rows.rows[].owner_of_record",
      "company_rows.rows[].origin.event",
    ],
    // Market data (price, day change, the listing's IPO price, spec 5.18).
    bandedPlain: [
      "company_rows.rows[].price",
      "company_rows.rows[].change",
      "company_rows.rows[].listing.ipo_price",
    ],
  },
  company_detail: {
    owners: { "company_detail.companies[]": "id" },
    ids: [
      "company_detail.companies[].id",
      "company_detail.companies[].industry",
      "company_detail.companies[].hq_country",
      "company_detail.companies[].hq_province",
      "company_detail.companies[].controller",
      "company_detail.companies[].shares_out",
      "company_detail.companies[].exchange",
      "company_detail.companies[].origin.event",
      "company_detail.companies[].founders[]",
      "company_detail.companies[].board[].holder.age",
      "company_detail.companies[].board[].holder.character",
      "company_detail.companies[].board[].holder.partial_id",
      "company_detail.companies[].directors[].age",
      "company_detail.companies[].directors[].character",
      "company_detail.companies[].directors[].partial_id",
      "company_detail.companies[].ipo_last_vote.result.ballots[].voter.id",
      "company_detail.companies[].ipo_last_vote.result.ballots[].voter.character",
      "company_detail.companies[].ipo_last_vote.result.yes",
      "company_detail.companies[].ipo_last_vote.result.no",
      ...skills("company_detail.companies[].board[].holder"),
      ...skills("company_detail.companies[].directors[]"),
    ],
    // D420 leaves the management score exact (an operation, not books); its confidence factor
    // follows from it (5.7); a seat's skill used and a ballot's chance are the board's; price and
    // buzz are market data.
    bandedPlain: [
      "company_detail.companies[].management_score",
      "company_detail.companies[].confidence_factor",
      "company_detail.companies[].price",
      "company_detail.companies[].buzz",
      "company_detail.companies[].board[].skill_used",
      "company_detail.companies[].ipo_last_vote.result.ballots[].chance",
    ],
  },
  cycle: {
    ids: ["cycle.quarters_left", "cycle.zones[].id", "cycle.zones[].number", "cycle.zones[].lag_quarters"],
  },
  province_cards: {
    ids: [
      "province_cards.cards[].id",
      "province_cards.cards[].country",
      "province_cards.cards[].commerce",
      "province_cards.cards[].industry",
      "province_cards.cards[].population",
      "province_cards.cards[].total",
      // Lists of company and unit ids (an array of numbers; never an array of rows).
      "province_cards.cards[].hqs[]",
      "province_cards.cards[].units[]",
    ],
  },
  statements: {
    owners: { "statements.companies[]": "id" },
    ids: ["statements.companies[].id"],
    // D420 leaves productivity, the PC bonus, labor units, the free R&D step and the management
    // score exact (operations that follow the stations, not books); they are still scanned for
    // truths, as any number not an id.
    bandedPlain: ["estimated_quarters", "estimated_years"].flatMap((p) =>
      ["productivity", "pc_bonus", "labor_units", "free_rd_pct", "management_score"].map(
        (f) => `statements.companies[].${p}[].operating.${f}`,
      ),
    ),
  },
  filings: {
    owners: { "filings.filings[]": "company" },
    ids: ["filings.filings[].company"],
  },
  ratings: {
    owners: { "ratings.companies[]": "id" },
    ids: [
      "ratings.companies[].id",
      "ratings.companies[].implied.cover_notches",
      "ratings.companies[].implied.size_notches",
      "ratings.companies[].implied.sector_notches",
      "ratings.companies[].last_review_notches",
      "ratings.companies[].excess_months_left",
      "ratings.companies[].distress_months",
      "ratings.companies[].frozen_quarters",
    ],
    // The rating and its breakdown are published (F6, D157), the line's rate follows from the
    // rating and the home spread (5.11).
    bandedPlain: ["ratings.companies[].line_rate", "ratings.companies[].home_spread"],
  },
  map_static: {
    ids: [
      "map_static.provinces[].id",
      "map_static.provinces[].country",
      "map_static.provinces[].commerce",
      "map_static.provinces[].industry",
      "map_static.provinces[].population",
      "map_static.provinces[].region",
      "map_static.provinces[].key_city",
      "map_static.provinces[].metro",
      "map_static.metros[].provinces[]",
      "map_static.key_cities[].provinces[]",
      "map_static.regions[].provinces[]",
    ],
  },
};

function skills(prefix: string): string[] {
  return ["finance", "operations", "persuasion", "intrigue", "tech", "hustle"].map(
    (s) => `${prefix}.skills.${s}`,
  );
}

/**
 * Public world data that a private figure can equal by the data: a private company's round
 * starting revenue can equal a country's GDP (country-economy.csv). These, a publishing company's
 * subtrees and a listed company's EFV are the only values dropped from the truths.
 */
export const PUBLIC_PATHS: ReadonlySet<string> = new Set(["countries.countries[].gdp_usd"]);

// ---------------------------------------------------------------- the walk

/** Where a leaf is: its view, the company its subtree is about (null: none) and that row. */
export interface Ctx {
  readonly view: ViewName;
  readonly owner: CompanyId | null;
  readonly row: Readonly<Record<string, unknown>> | null;
}

/** One leaf of a view: a Figure (whole), or a number, string, boolean or null. */
export interface Leaf {
  readonly norm: string;
  readonly raw: string;
  readonly ctx: Ctx;
  readonly figure: Figure | null;
  readonly value: unknown;
  /** A field of a date or quarter ({year, month, day}, {year, month} or {year, q}). */
  readonly date: boolean;
}

export const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

export const isFigure = (x: unknown): x is Figure =>
  isRecord(x) &&
  ((x.kind === "Exact" && typeof x.value === "number") || (x.kind === "Band" && isRecord(x.band)));

const DATE_SHAPES = ["day,month,year", "month,year", "q,year"];

/** A date or quarter by its shape, with whole numbers in range (else its numbers are scanned). */
function isDateLike(x: Record<string, unknown>): boolean {
  const keys = Object.keys(x).sort().join(",");
  // A statement's year period (`{ kind: "Year", year }`) too.
  if (!DATE_SHAPES.includes(keys) && !(keys === "kind,year" && x.kind === "Year")) return false;
  const ok = (k: string, lo: number, hi: number) =>
    !(k in x) || (Number.isInteger(x[k]) && (x[k] as number) >= lo && (x[k] as number) <= hi);
  return ok("year", 1900, 2200) && ok("month", 1, 12) && ok("day", 1, 31) && ok("q", 1, 4);
}

export function rulesOf(view: ViewName): ViewRules {
  const r = VIEW_RULES[view];
  if (r === undefined) throw new Error(`${view} is ported but has no leak rules (leak_rules.ts)`);
  return r;
}

/** Calls `visit` on every leaf of one view's data, in order. */
export function walkView(view: ViewName, data: unknown, visit: (leaf: Leaf) => void): void {
  const owners = rulesOf(view).owners ?? {};
  const go = (x: unknown, norm: string, raw: string, ctx: Ctx, date: boolean): void => {
    if (isFigure(x)) {
      visit({ norm, raw, ctx, figure: x, value: null, date: false });
    } else if (Array.isArray(x)) {
      const el = `${norm}[]`;
      const field = owners[el];
      x.forEach((y, i) => {
        let c = ctx;
        if (field !== undefined && isRecord(y)) {
          const id = y[field];
          c = { view, owner: typeof id === "number" ? (id as CompanyId) : null, row: y };
        }
        go(y, el, `${raw}[${i}]`, c, false);
      });
    } else if (isRecord(x)) {
      if (x instanceof Map || x instanceof Set) throw new Error(`${raw}: a Map or Set in a view`);
      const d = isDateLike(x);
      for (const k of Object.keys(x)) go(x[k], `${norm}.${k}`, `${raw}.${k}`, ctx, d);
    } else {
      visit({ norm, raw, ctx, figure: null, value: x, date });
    }
  };
  go(data, view, view, { view, owner: null, row: null }, false);
}

/** An id, count, tick or date leaf: never a figure. */
export function isIdLeaf(leaf: Leaf): boolean {
  return leaf.date || (rulesOf(leaf.ctx.view).ids ?? []).includes(leaf.norm);
}

/** Every number a leaf holds: a plain number, an exact figure's value or a band's three. */
export function leafNumbers(leaf: Leaf): number[] {
  const f = leaf.figure;
  if (f !== null) return f.kind === "Exact" ? [f.value] : [f.band.estimate, f.band.low, f.band.high];
  return typeof leaf.value === "number" ? [leaf.value] : [];
}

// ---------------------------------------------------------------- the allow-lists

const SHARED = statementLineIndex("Shared");
/** The statement lines index of GuidanceHigh: its band is the low end's moved by the width (D430). */
export const GUIDANCE_HIGH = statementLineIndex("GuidanceHigh");

/** The raw path's last index (`...lines[5]` gives 5). */
function lastIndex(raw: string): number {
  const m = /\[(\d+)\]$/.exec(raw);
  return m === null ? -1 : Number(m[1]);
}

const listed = (leaf: Leaf) => leaf.ctx.row !== null && leaf.ctx.row.exchange !== null;

/**
 * The exact figures a banded company's subtree may hold, the documented exceptions to D420:
 * the compute and licences line of an estimated statement (D434: a published price list times
 * counts), and a listed company's value, its EFV (D140, already an estimate), even before its
 * first release.
 */
export function exactInBanded(leaf: Leaf): boolean {
  switch (leaf.norm) {
    case "statements.companies[].estimated_quarters[].lines[]":
    case "statements.companies[].estimated_years[].lines[]":
      return lastIndex(leaf.raw) === SHARED;
    case "company_rows.rows[].value":
    case "company_detail.companies[].shown_value_per_share":
      return listed(leaf);
    default:
      return false;
  }
}

/** A plain number a banded company's subtree may hold (`bandedPlain`, or a listing's headline). */
export function plainInBanded(leaf: Leaf): boolean {
  if ((rulesOf(leaf.ctx.view).bandedPlain ?? []).includes(leaf.norm)) return true;
  // A listing's headline prints its IPO price and the money raised (spec 5.18): the listing is
  // public. A raise's headline prints no amount for such a company (D420): net_usd is null.
  const kind = leaf.ctx.row?.kind;
  return (
    (leaf.norm === "news.feed[].kind.price" || leaf.norm === "news.feed[].kind.net_usd") &&
    isRecord(kind) &&
    kind.kind === "Listing"
  );
}

/** A listed company's EFV (D140): public, and its own V scaled by its EFV error. */
export function isListedEfv(leaf: Leaf): boolean {
  switch (leaf.norm) {
    case "quotes.rows[].efv":
    case "quotes.rows[].efv_low":
    case "quotes.rows[].efv_high":
      return true;
    case "company_rows.rows[].value":
    case "company_detail.companies[].shown_value_per_share":
      return listed(leaf) && leaf.figure?.kind === "Exact";
    default:
      return false;
  }
}

/**
 * The leaves the perturbation check (leak.test.ts, 4) lets change: a listed company's EFV (it is
 * V × (1 + error), D140, and V is in the perturbed books), and v_market_stats' gap statistics
 * over the quoted stocks' P ÷ V (the soak's diagnostics, never a screen; D144). Nothing else
 * that is not a band may follow a private company's books.
 */
export function perturbExempt(leaf: Leaf): boolean {
  return (
    isListedEfv(leaf) || leaf.norm === "market_stats.median_gap" || leaf.norm === "market_stats.within_band"
  );
}
