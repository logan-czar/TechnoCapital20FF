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
// Every ported view (all 28) must have an entry in `VIEW_RULES` (the test fails on one that has
// none), so a new view or field means classifying it here: its subject subtrees, its id leaves
// and what of a banded subject it may show as a plain number.
//
// A subtree's subject is a company, an industry or both (a unit, or a company's line in an
// industry), and it is banded as the views band it: a company that does not publish (D420), an
// industry in the estimated class (D432), and both for a unit's monthly figures and data book
// (D436: a published company's are bands in an estimated industry); an industry history quarter
// by the class it closed in (D437).

import { companyStatusIsFrozen } from "../../src/finance/distress.ts";
import { companyFinanceQuarters, companyFinanceStatus } from "../../src/finance/state.ts";
import { jumpedPrice, surprise } from "../../src/market/earnings.ts";
import { EFV_ERROR_WIDTH } from "../../src/market/jobs.ts";
import type { Quarter } from "../../src/types/calendar.ts";
import type { CompanyId, IndustryId } from "../../src/types/ids.ts";
import { totalCmp } from "../../src/types/num.ts";
import type { Figure } from "../../src/types/views/estimate.ts";
import type { SimViews, ViewName } from "../../src/types/views/index.ts";
import { TOP_COMPANIES } from "../../src/types/views/industry_rows.ts";
import { TRACKING_BAND } from "../../src/types/views/market_stats.ts";
import type { World } from "../../src/types/world.ts";
import {
  figureExactOf,
  figureRatio,
  figureShown,
  figureSum,
  statementLineIndex,
} from "../../src/views/estimate.ts";
import { gap } from "../../src/views/market_stats.ts";

/** How an array element names its subject (`OWNERS`' values; a string is a company field). */
export interface OwnerRule {
  /** The field holding the company's id. */
  readonly company?: string;
  /** The field holding the industry's id. */
  readonly industry?: string;
  /** The industry is the enclosing subtree's (a company's line in an industry). */
  readonly parentIndustry?: true;
  /** The industry is the company's own (v_tech, D436). */
  readonly ownIndustry?: true;
  /** The field holding the quarter whose close sets the industry's class (D437). */
  readonly quarter?: string;
  /** The element's index is a unit ordinal (`UnitAt`; v_map_layers' unit assets). */
  readonly unitOrdinal?: true;
}

/** The company and industry of the k-th unit a view lists (leak.test.ts has the World). */
export type UnitAt = (k: number) => { company: CompanyId; industry: IndustryId } | null;

/** A subtree's subject, as `walkView` hands it to the `banded` resolver. */
export interface Subject {
  readonly company: CompanyId | null;
  readonly industry: IndustryId | null;
  /** The company's own industry is meant (resolved by the caller, who has the World). */
  readonly ownIndustry: boolean;
  readonly quarter: Quarter | null;
}

export interface ViewRules {
  /**
   * The arrays whose elements are about one subject: the element's normalized path, then how
   * it names its subject (a string: the field holding a company id; a null id is about none).
   */
  readonly owners?: Readonly<Record<string, string | OwnerRule>>;
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
  units: {
    // A unit's figures are bands for a company that does not publish or in an estimated
    // industry (D436).
    owners: { "units.units[]": { company: "company", industry: "industry" } },
    ids: [
      "units.units[].id",
      "units.units[].company",
      "units.units[].industry",
      "units.units[].base_province",
    ],
    // The growth and R&D plans are shown exactly (spec 8 Units tab, D420).
    bandedPlain: ["units.units[].growth_plan", "units.units[].rd_plan"],
  },
  tech: {
    owners: { "tech.companies[]": { company: "company", ownIndustry: true } },
    ids: [
      "tech.companies[].company",
      "tech.companies[].labor_units",
      "tech.companies[].pc_bonus",
      "tech.companies[].data[].industry",
      "tech.companies[].data[].buckets",
      "tech.companies[].data[].free_rd_pct",
      ...stations("tech.companies[]"),
      "tech.companies[].compute.extra_base_compute",
      "tech.companies[].compute.data_compute",
      "tech.companies[].compute.licences",
    ],
    // What follows the published station counts and step tables (D434, D431): PC, the next PC
    // bonus step (5.8), the compute bill, the next free R&D step (5.9) and the conversion
    // capacity.
    bandedPlain: [
      "tech.companies[].pc",
      "tech.companies[].next_bonus_pc",
      "tech.companies[].compute.monthly_usd",
      "tech.companies[].data[].next_step_tb",
      "tech.companies[].data[].conversion_tb",
    ],
  },
  industry_rows: {
    owners: { "industry_rows.rows[]": { industry: "id" } },
    ids: ["industry_rows.rows[].id", "industry_rows.rows[].top_companies[]"],
    // Demand, its trend, the long-term rate and this quarter's growth stay exact in an estimated
    // industry (D432).
    bandedPlain: [
      "industry_rows.rows[].demand",
      "industry_rows.rows[].trend_demand",
      "industry_rows.rows[].lt",
      "industry_rows.rows[].growth_annual",
    ],
  },
  industry_detail: {
    owners: {
      "industry_detail.industries[]": { industry: "id" },
      // A company's line: its revenue and share are banded as its units' (D436).
      "industry_detail.industries[].companies[]": { company: "company", parentIndustry: true },
      // A history quarter's supply is banded by the class it closed in (D437).
      "industry_detail.industries[].history[]": { parentIndustry: true, quarter: "quarter" },
    },
    ids: ["industry_detail.industries[].id", "industry_detail.industries[].companies[].company"],
    bandedPlain: [
      "industry_detail.industries[].history[].demand",
      "industry_detail.industries[].history[].q_growth",
      "industry_detail.industries[].history[].lt",
    ],
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
  projection: {
    owners: { "projection.companies[]": "id" },
    ids: ["projection.companies[].id"],
    // The range's half-width is the 5.16 width at the share of the quarter elapsed (D252): the
    // same for every company, never its books. The plan is Omniscient only (`shape` checks it is
    // null).
    bandedPlain: ["projection.companies[].width"],
  },
  recap: {
    owners: {
      "recap.recaps[].world.expected_beats[]": "company",
      "recap.recaps[].world.expected_misses[]": "company",
      "recap.recaps[].companies[]": "company",
    },
    ids: [
      "recap.recaps[].world.expected_beats[].company",
      "recap.recaps[].world.expected_misses[].company",
      "recap.recaps[].world.industries_by_label[][][]",
      "recap.recaps[].companies[].company",
      "recap.recaps[].companies[].expected.company",
      // The outlook's count of loss quarters in a row (spec 8 recap; shown as it is, as Rust).
      "recap.recaps[].companies[].outlook.loss_quarters",
      "recap.watchlist[]",
    ],
    // A banded company's expected surprise and reaction are worked out from the shown estimates
    // (D420, D430: `derivedOf` recomputes them); confidence is shown as it is (5.7, 5.15).
    bandedPlain: [
      "recap.recaps[].world.expected_beats[].expected_surprise",
      "recap.recaps[].world.expected_misses[].expected_surprise",
      "recap.recaps[].companies[].expected.expected_surprise",
      "recap.recaps[].companies[].expected_reaction",
      "recap.recaps[].companies[].confidence_factor",
      "recap.recaps[].companies[].exchange_confidence",
    ],
  },
  map_layers: {
    owners: {
      "map_layers.hqs[]": "company",
      // A unit's assets name no company: the k-th row is the k-th unit of a company still in the
      // game, in unit id order (`unitAt`), banded as v_units bands it (D436, D701).
      "map_layers.unit_assets[]": { unitOrdinal: true },
    },
    ids: [
      "map_layers.political.country[]",
      "map_layers.zone[]",
      "map_layers.unit_assets[].industry",
      "map_layers.unit_assets[].province",
      "map_layers.hqs[].company",
      "map_layers.hqs[].province",
      "map_layers.hqs[].industry",
      "map_layers.hqs[].country",
      "map_layers.hqs[].sector",
    ],
    // The development tracks (spec 3.3, points) are data about no subject: scanned, as any number.
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

function stations(prefix: string): string[] {
  return ["productivity", "enterprise", "fifty_fifty", "research", "idle"].map(
    (s) => `${prefix}.stations.${s}`,
  );
}

function skills(prefix: string): string[] {
  return ["finance", "operations", "persuasion", "intrigue", "tech", "hustle"].map(
    (s) => `${prefix}.skills.${s}`,
  );
}

/**
 * Public world data that a private figure can equal by the data: a private company's round
 * starting revenue can equal a country's GDP (country-economy.csv). These, a publishing company's
 * subtrees and a quoted company's EFV (`isEfvLeaf`, as `derivedOf` checks it) are the only values
 * dropped from the truths.
 */
export const PUBLIC_PATHS: ReadonlySet<string> = new Set([
  "countries.countries[].gdp_usd",
  // What follows the published station counts and step tables (D434, D431; PR #91's
  // PUBLIC_DATA): a banded company's are public too.
  "tech.companies[].pc",
  "tech.companies[].next_bonus_pc",
  "tech.companies[].compute.monthly_usd",
  "tech.companies[].data[].next_step_tb",
  "tech.companies[].data[].conversion_tb",
]);

// ---------------------------------------------------------------- the walk

/**
 * Where a leaf is: its view, the company and industry its subtree is about (null: none), whether
 * that subject's figures are bands (null: no subject) and the subject's row.
 */
export interface Ctx {
  readonly view: ViewName;
  readonly owner: CompanyId | null;
  readonly industry: IndustryId | null;
  readonly banded: boolean | null;
  readonly row: Readonly<Record<string, unknown>> | null;
}

/** Whether a subject's figures are bands now (leak.test.ts has the World). */
export type BandedOf = (s: Subject) => boolean;

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
export function isDateLike(x: Record<string, unknown>): boolean {
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

/** The subject an element names by its owner rule, within the enclosing `ctx`. */
function subjectOf(
  rule: string | OwnerRule,
  y: Record<string, unknown>,
  i: number,
  ctx: Ctx,
  unitAt: UnitAt,
): Subject | null {
  const r: OwnerRule = typeof rule === "string" ? { company: rule } : rule;
  if (r.unitOrdinal === true) {
    const u = unitAt(i);
    if (u === null) throw new Error(`${ctx.view}: no unit ${i}`);
    return { company: u.company, industry: u.industry, ownIndustry: false, quarter: null };
  }
  const id = (f: string | undefined): number | null => {
    const v = f === undefined ? null : y[f];
    return typeof v === "number" ? v : null;
  };
  const company = id(r.company) as CompanyId | null;
  const industry = (r.parentIndustry === true ? ctx.industry : id(r.industry)) as IndustryId | null;
  if (company === null && industry === null && r.ownIndustry !== true) return null;
  if (r.company !== undefined && company === null) return null;
  const q = r.quarter === undefined ? null : y[r.quarter];
  return {
    company,
    industry,
    ownIndustry: r.ownIndustry === true,
    quarter: isRecord(q) ? (q as unknown as Quarter) : null,
  };
}

/** Calls `visit` on every leaf of one view's data, in order; `banded` classes its subjects. */
export function walkView(
  view: ViewName,
  data: unknown,
  banded: BandedOf,
  visit: (leaf: Leaf) => void,
  unitAt: UnitAt = () => null,
): void {
  const owners = rulesOf(view).owners ?? {};
  const go = (x: unknown, norm: string, raw: string, ctx: Ctx, date: boolean): void => {
    if (isFigure(x)) {
      visit({ norm, raw, ctx, figure: x, value: null, date: false });
    } else if (Array.isArray(x)) {
      const el = `${norm}[]`;
      const rule = owners[el];
      x.forEach((y, i) => {
        let c = ctx;
        if (rule !== undefined && isRecord(y)) {
          const s = subjectOf(rule, y, i, ctx, unitAt);
          c =
            s === null
              ? { view, owner: null, industry: null, banded: null, row: y }
              : { view, owner: s.company, industry: s.industry, banded: banded(s), row: y };
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
  go(data, view, view, { view, owner: null, industry: null, banded: null, row: null }, false);
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
 * first release; a unit's compute and licences cost (D434); an estimated industry's S with no
 * demand (nothing to divide the supply band by).
 */
export function exactInBanded(leaf: Leaf): boolean {
  switch (leaf.norm) {
    case "statements.companies[].estimated_quarters[].lines[]":
    case "statements.companies[].estimated_years[].lines[]":
      return lastIndex(leaf.raw) === SHARED;
    case "units.units[].shared_m":
      return true;
    case "industry_rows.rows[].supply_ratio":
      return !((leaf.ctx.row?.demand as number) > 0);
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

// ---------------------------------------------------------------- the recomputations

/** The leaves that hold a listed company's EFV (D140, 3.14.2). */
const EFV_PATHS: ReadonlySet<string> = new Set([
  "quotes.rows[].efv",
  "quotes.rows[].efv_low",
  "quotes.rows[].efv_high",
  "company_rows.rows[].value",
  "company_detail.companies[].shown_value_per_share",
]);

/** A leaf that holds an EFV (`derivedOf` checks it is a quoted company's, as the World has it). */
export const isEfvLeaf = (leaf: Leaf): boolean => EFV_PATHS.has(leaf.norm);

/** A leaf's own number: an exact figure's value or a plain number (else undefined). */
export function leafValue(leaf: Leaf): number | undefined {
  if (leaf.figure !== null) return leaf.figure.kind === "Exact" ? leaf.figure.value : undefined;
  return typeof leaf.value === "number" ? leaf.value : undefined;
}

/**
 * An industry's named revenue as the published table sums it (spec 1, D432): every unit's last
 * monthly revenue in the industry, biggest first (src/views/industry_rows.ts `companiesByRevenue`,
 * the order the view sums in, so the float sum is the same).
 */
function namedRevenue(w: World, ind: number): number {
  const list = w.units
    .filter((u) => u.industry === ind)
    .map((u): [number, number] => [u.company, u.revenue_m]);
  list.sort((a, b) => totalCmp(b[1], a[1]) || a[0] - b[0]);
  let named = 0;
  for (const [, r] of list) named += r;
  return named;
}

/**
 * An industry's units' revenue figures as build `v` shows them (v_units), biggest shown first,
 * ties to the lower id: the order the industry views sum them in (src/views/industry_rows.ts
 * `rankedAsShown`, so the float sums are the same).
 */
function shownRevenues(v: SimViews, ind: number): Figure[] {
  const list = v.units.data.units
    .filter((u) => u.industry === ind)
    .map((u): [number, Figure] => [u.company, u.revenue_m]);
  list.sort((a, b) => totalCmp(figureShown(b[1]), figureShown(a[1])) || a[0] - b[0]);
  return list.map(([, f]) => f);
}

/**
 * The bands `derivedOf` works out again from the build's shown parts (D430, D432): an estimated
 * industry's named revenue is many companies' revenue bands summed, each with its own sign of
 * error, and the detail's shares divide by that sum and the fringe again, so the errors can
 * cancel and `BAND_MIN_ERROR` does not hold for them. Each part is a single subject's band,
 * checked for distance itself, and the recomputation pins the sum to the parts, so a sum band
 * centred on the truth fails `derivedOf`. Containment of the truth is still checked (leak.test.ts,
 * 2).
 */
export const SUM_BAND_PATHS: ReadonlySet<string> = new Set([
  "industry_rows.rows[].named_revenue_m",
  "industry_detail.industries[].companies[].share",
  "industry_detail.industries[].fringe_share",
]);

/** v_market_stats worked out from the World's quoted stocks and companies (D144, 3.14). */
function marketStats(w: World): Record<string, number> {
  const gaps = w.market.stocks.filter((s) => s.quoted).map((s) => gap(s.price, s.value));
  gaps.sort(totalCmp);
  const n = gaps.length;
  const median = n === 0 ? 0 : n % 2 === 1 ? gaps[(n - 1) / 2]! : 0.5 * (gaps[n / 2 - 1]! + gaps[n / 2]!);
  let reports = 0;
  let beats = 0;
  let misses = 0;
  w.companies.forEach((c, i) => {
    if (companyStatusIsFrozen(companyFinanceStatus(c.finance))) return;
    if (companyFinanceQuarters(c.finance).length === 0) return;
    reports++;
    const t = w.market.stocks[i]!.tags.surprise;
    if (t === "Beat" || t === "BigBeat") beats++;
    if (t === "Miss" || t === "BigMiss") misses++;
  });
  let confidence = 0;
  for (const z of w.zones) confidence += z.confidence;
  return {
    listed: w.market.stocks.filter((s) => s.exchange !== null).length,
    quoted: n,
    median_gap: median,
    within_band: gaps.filter((g) => g <= TRACKING_BAND).length,
    mean_confidence: confidence / Math.max(w.zones.length, 1),
    reports,
    beats,
    misses,
  };
}

/** An expected row's surprise worked out from its shown estimates (5.15, D430). */
function shownSurprise(e: unknown): number | undefined {
  if (!isRecord(e) || !isFigure(e.projection) || !isFigure(e.consensus)) return undefined;
  return surprise(figureShown(e.projection), figureShown(e.consensus));
}

/**
 * The leaves that follow private books by a published formula, so they move when the books do
 * and are not compared across the perturbation's builds (leak.test.ts, 4): each is worked out
 * again from its own build's World or shown bands and must equal that, in every build (the shape
 * check, 1, runs on every build), so a value that follows anything else (a private cash, a true
 * revenue) fails. Gives the value the leaf must hold, a string saying why it may not be there, or
 * undefined for every other leaf.
 *
 * - A quoted company's EFV and its ±15% band (D140, 3.14.2), and a listed company's value, EFV
 *   × shares (v_company_row) or a share (v_company_detail): V × (1 + e) from its stock. An EFV of
 *   a company that is not quoted fails (a private company has a V and an EFV error too).
 * - v_market_stats (D144: the soak's aggregates, no screen): from the World's quoted stocks and
 *   companies (the median and the count within ±30% of |P ÷ V − 1|, the report tags).
 * - An industry's exact named revenue (spec 1; D432 outside the estimated class): the sum of its
 *   units' revenue; the detail's exact shares, a company's revenue and the fringe's over the
 *   named and fringe total.
 * - An estimated industry's named revenue band (D432): the sum of its units' revenue figures as
 *   the build's v_units shows them (src/views/industry_rows.ts `figureSum` of `rankedAsShown`);
 *   the detail's share bands, the unit's shown figure and the shown fringe revenue over the sum
 *   of those and the fringe (D430 interval division, src/views/industry_detail.ts); outside the
 *   class, a private company's share band is its revenue band over the exact total. Their
 *   distance from the truth is the parts' (`SUM_BAND_PATHS`), so a band centred on the truth
 *   fails here instead.
 * - v_recap's banded expected surprise and reaction (D420, D430: worked out from the shown
 *   projection and consensus estimates, src/views/recap.ts `expectedRow`, `page`; a band's
 *   estimate moves with its truth, D421): from the shown bands of the same row.
 */
export function derivedOf(leaf: Leaf, w: World, v: SimViews): Figure | number | string | undefined {
  const row = leaf.ctx.row;
  const exact = leaf.figure !== null && leaf.figure.kind === "Exact";
  const field = leaf.norm.slice(leaf.norm.lastIndexOf(".") + 1);
  switch (leaf.norm) {
    case "quotes.rows[].efv":
    case "quotes.rows[].efv_low":
    case "quotes.rows[].efv_high": {
      const s = w.market.stocks[row?.id as number];
      if (s === undefined || s.exchange === null || !s.quoted)
        return `an EFV of company ${row?.id}, not quoted`;
      const efv = s.value * (1.0 + s.efv_error);
      if (field === "efv") return efv;
      return field === "efv_low" ? efv * (1.0 - EFV_ERROR_WIDTH) : efv * (1.0 + EFV_ERROR_WIDTH);
    }
    case "company_rows.rows[].value":
    case "company_detail.companies[].shown_value_per_share": {
      const s = w.market.stocks[row?.id as number];
      if (!exact || s === undefined || s.exchange === null) return undefined;
      return (field === "value" ? s.fair_value : s.value) * (1.0 + s.efv_error);
    }
    case "industry_rows.rows[].named_revenue_m":
      if (exact) return namedRevenue(w, row?.id as number);
      // A band only in an estimated industry (the shape check flags any other).
      return leaf.figure !== null && row?.estimated === true
        ? figureSum(shownRevenues(v, row.id as number))
        : undefined;
    case "industry_detail.industries[].companies[].share":
    case "industry_detail.industries[].fringe_share": {
      if (leaf.figure === null || leaf.ctx.industry === null) return undefined;
      const ind = leaf.ctx.industry;
      if (!exact) {
        // A band: the shown part over the whole, the sum of what is shown in an estimated
        // industry, else the exact named and fringe total (a private company's revenue band over
        // it, D430).
        const d = v.industry_detail.data.industries[ind];
        if (d === undefined) return `no industry ${ind} in v_industry_detail`;
        const total = d.estimated
          ? figureSum([...shownRevenues(v, ind), d.fringe_revenue_m])
          : figureExactOf(namedRevenue(w, ind) + w.industries[ind]!.fringe_revenue_m);
        if (field !== "share") return figureRatio(d.fringe_revenue_m, total);
        const u = v.units.data.units.find((x) => x.company === row?.company && x.industry === ind);
        if (u === undefined) return `a share of company ${row?.company}, with no unit in industry ${ind}`;
        return figureRatio(u.revenue_m, total);
      }
      const fringe = w.industries[ind]!.fringe_revenue_m;
      const total = namedRevenue(w, ind) + fringe;
      let part = fringe;
      if (field === "share") {
        const u = w.units.find((x) => x.company === row?.company && x.industry === ind);
        if (u === undefined) return `a share of company ${row?.company}, with no unit in industry ${ind}`;
        part = u.revenue_m;
      }
      return total > 0.0 ? part / total : 0.0;
    }
    case "recap.recaps[].world.expected_beats[].expected_surprise":
    case "recap.recaps[].world.expected_misses[].expected_surprise":
      return leaf.ctx.banded === true ? shownSurprise(row) : undefined;
    case "recap.recaps[].companies[].expected.expected_surprise":
      return leaf.ctx.banded === true ? shownSurprise(row?.expected) : undefined;
    case "recap.recaps[].companies[].expected_reaction": {
      const s = leaf.ctx.banded === true ? shownSurprise(row?.expected) : undefined;
      return s === undefined ? undefined : jumpedPrice(1.0, s) - 1.0;
    }
    default:
      return leaf.norm.startsWith("market_stats.") ? marketStats(w)[field] : undefined;
  }
}

/**
 * The leaves the perturbation check (leak.test.ts, 4) does not compare across its builds, besides
 * the bands and `derivedOf`'s: the top 5, ranked by the revenue shown, so by the bands' estimates
 * (D420, D436). `rankingBad` checks that order in every build instead, with v_industry_detail's
 * (whose list `canonical` puts in id order for the comparison).
 */
export function perturbExempt(leaf: Leaf): boolean {
  return leaf.norm === "industry_rows.rows[].top_companies[]";
}

/**
 * The rankings by revenue shown (D420, D436; src/views/industry_rows.ts `rankedAsShown`), in one
 * build before `canonical`: every industry's companies in v_industry_detail are its units in
 * v_units, each with the unit's revenue figure, biggest estimate first, ties to the lower id; and
 * v_industry_row's top 5 are the first `TOP_COMPANIES` of them. A ranking by the true revenue
 * fails wherever the two orders differ.
 */
export function rankingBad(v: SimViews): string[] {
  const bad: string[] = [];
  const shown = new Map<number, [number, Figure][]>();
  for (const u of v.units.data.units) {
    const list = shown.get(u.industry) ?? [];
    list.push([u.company, u.revenue_m]);
    shown.set(u.industry, list);
  }
  v.industry_detail.data.industries.forEach((d, i) => {
    const want = [...(shown.get(i) ?? [])];
    want.sort((a, b) => totalCmp(figureShown(b[1]), figureShown(a[1])) || a[0] - b[0]);
    const ids = want.map(([c]) => c);
    const got = d.companies.map((c) => c.company);
    if (got.join(",") !== ids.join(",")) {
      bad.push(`industry_detail[${i}] lists ${got.join(",")}, by the revenue shown ${ids.join(",")}`);
    }
    d.companies.forEach((c, k) => {
      const u = want.find(([id]) => id === c.company);
      if (u !== undefined && JSON.stringify(u[1]) !== JSON.stringify(c.revenue_m)) {
        bad.push(`industry_detail[${i}].companies[${k}].revenue_m is not its unit's`);
      }
    });
    const top = (v.industry_rows.data.rows[i]?.top_companies ?? []).join(",");
    const top5 = ids.slice(0, TOP_COMPANIES).join(",");
    if (top !== top5) bad.push(`industry_rows[${i}].top_companies ${top}, by the revenue shown ${top5}`);
  });
  return bad;
}

/**
 * A view's data in an order that does not follow the figures shown: v_industry_detail lists an
 * industry's companies by the revenue shown (D420), so both builds' lists are put in company id
 * order before they are compared (a band's estimate moves with its truth, and so may the order;
 * `rankingBad` checks the order itself in each build).
 */
export function canonical(view: ViewName, data: unknown): unknown {
  if (view !== "industry_detail" || !isRecord(data) || !Array.isArray(data.industries)) return data;
  return {
    ...data,
    industries: (data.industries as Record<string, unknown>[]).map((d) => ({
      ...d,
      companies: [...(d.companies as { company: number }[])].sort((a, b) => a.company - b.company),
    })),
  };
}
