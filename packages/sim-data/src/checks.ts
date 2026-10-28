// Load-time checks on the starting world: the id, range and balance checks of
// `tools/mvp-data/validate.py`, ported one for one (build-plan M0.4), plus row counts (M0.2).
// Ported from crates/sim-data/src/checks.rs.
//
// Python economy runs (growth and boom runs, profit tables) are not ported here: they become
// engine tests in M2 (build-plan M2.4, M2.10). Missing or removed columns (validate.py batch 155
// and 157 column checks) are rejected at load, since every row spec denies unknown columns and
// requires all of its own.
//
// Not ported: validate.py zone spread seed check (credit_spread_bps equals the GDP-weighted member
// spread unless gen.py ZONE_ECON_SET sets it by hand) is a generator identity that needs the gen.py
// hand-set table, so it stays in Python. Two company-start.csv checks need the run-rate EBITDA,
// which only the engine computes: that `start_rating` is the 7.1 rating of the starting balances,
// and that a line cut below its 7.1 line is the largest within its own limit (D15). Their twins are
// the sim tests (`spec_5_12_rating`, `spec_5_12_credit`); here the limit and the D16 rule read
// `start_rating` as written.

import { type DataError, dataErrorFile } from "./error.ts";
import { type Table, tableErr, tableFileErr, tableIsEmpty, tableIter } from "./load.ts";
import { MAP_META } from "./map.ts";
import { type KeyCity, NAME_KIND_VALUES, type NameKind, nameKindDebug } from "./rows.ts";
import { SUPERREGIONS, type WorldData, worldDataAllProvinces, worldDataCounts } from "./world.ts";

/** Expected row counts (spec 10 M0, build-plan M0.2). */
export const EXPECTED_COUNTS: readonly (readonly [string, number])[] = [
  ["countries", 211],
  ["provinces", 3963],
  ["companies", 651],
  ["characters", 296],
  ["industries", 42],
  ["country-economy", 211],
  ["financial-zones", 26],
  ["ai-boom", 15],
  ["key-cities", 88],
  ["company-start", 651],
  ["startup-events", 9],
];

/** Asset decay is 0% to 10% a year (validate.py; spec 5.10). */
const ASSET_DECAY_MAX = 0.1;
/** Quarterly growth volatility is 0% to 10% (validate.py; spec 5.1). */
const VOLATILITY_MAX = 0.1;
/** Equality index range (batch 158). */
const WEALTH_INDEX_RANGE = [10, 95] as const;
/** Zone base credit spread range in bps (batch 155; spec 5.1.2). */
const CREDIT_SPREAD_MAX_BPS = 2500.0;
/** Zone confidence_start range (batch 155; spec 5.13). */
const CONFIDENCE_RANGE = [-100.0, 100.0] as const;
/** Opening share price range in whole dollars (batch 161; spec 7.1). */
const OPEN_PRICE_RANGE = [5.0, 200.0] as const;
/** Starting asset book is half of gross assets (spec 7.1). */
const ASSET_BOOK_SHARE = 0.5;
/** min_cash is 5% of revenue; a company drawing its line holds no more (spec 7.1, 5.12). */
const MIN_CASH_SHARE = 0.05;
/**
 * The 18 notches of the rating scale, best first (spec 5.12, 3.6.2; D220): company-start.csv
 * `start_rating` is one of them.
 */
export const RATING_LABELS: readonly string[] = [
  "AAA",
  "AA+",
  "AA",
  "AA-",
  "A+",
  "A",
  "A-",
  "BBB+",
  "BBB",
  "BBB-",
  "BB+",
  "BB",
  "BB-",
  "B+",
  "B",
  "B-",
  "CCC",
  "CC",
];
/**
 * Spec 5.12 rating factor by band (T); a notch reads its band (D220). The twin of the sim
 * `finance::rating::rating_factor`, which the sim tests check against it.
 */
const RATING_FACTORS: readonly (readonly [string, number])[] = [
  ["AAA", 1.0],
  ["AA", 0.9],
  ["A", 0.8],
  ["BBB", 0.65],
  ["BB", 0.5],
  ["B", 0.3],
  ["CCC", 0.0],
  ["CC", 0.0],
];
/** Spec 5.12 limit: `0.5 x asset_book + own cash`, times the rating factor. */
const LIMIT_ASSET_BOOK_SHARE = 0.5;
/** D16 (Logan, M3 gate): no company starts rated CCC or CC with a drawn line. */
const NO_LINE_RATINGS: readonly string[] = ["CCC", "CC"];
/** Dollar tolerances of validate.py for rounded balances. */
const BALANCE_TOL_USD = 2.0;
const ASSET_BOOK_TOL_USD = 1.0;
const MIN_CASH_TOL_USD = 1.0;
/** Cost shares sum to 1 (validate.py). */
const SHARE_SUM_TOL = 1e-9;
/** The fixed events F1 to F9 bring 32 startups (spec 5.19.2). */
const FIXED_EVENT_STARTUPS = 32;
/** Every startup brings 1 to 5 full and 1 to 5 partial characters (spec 5.19, batch 165). */
const CAST_RANGE = [1, 5] as const;

// sim-data cannot import the sim number helpers (sim depends on sim-data), so the few it needs are
// here: byte order for strings (D4; ids are ASCII), and Rust f64 min/max (a NaN operand loses).
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function minF(a: number, b: number): number {
  if (Number.isNaN(a)) return b;
  if (Number.isNaN(b)) return a;
  return Math.min(a, b);
}
function maxF(a: number, b: number): number {
  if (Number.isNaN(a)) return b;
  if (Number.isNaN(b)) return a;
  return Math.max(a, b);
}
/** `(lo..=hi).contains(&x)`. */
function within(x: number, lo: number, hi: number): boolean {
  return x >= lo && x <= hi;
}
/** Rust `{:.0}` of an f64 in a message. */
function fixed0(x: number): string {
  return x.toFixed(0);
}
/** Rust `{:?}` of a list of strings. */
function debugStrs(xs: readonly string[]): string {
  return `[${xs.map((x) => JSON.stringify(x)).join(", ")}]`;
}
function sorted(xs: Iterable<string>): string[] {
  return [...xs].sort(cmpStr);
}

/** Runs every check and returns all problems found (empty when the data is good). */
export function check(w: WorldData): DataError[] {
  const errors: DataError[] = [];
  const ids = idsNew(w, errors);
  counts(w, errors);
  industries(w, ids, errors);
  countries(w, errors);
  countryEconomy(w, ids, errors);
  zones(w, ids, errors);
  keyCities(w, ids, errors);
  companies(w, ids, errors);
  companyStart(w, errors);
  startupEvents(w, ids, errors);
  names(w, ids, errors);
  map(w, ids, errors);
  return errors;
}

/** Id sets and lookups shared by the checks (iterated sorted, never in insertion order). */
interface Ids {
  countries: Set<string>;
  /** Province id to its country. */
  provinces: Map<string, string>;
  industries: Set<string>;
  zones: Set<string>;
}

function idsNew(w: WorldData, errors: DataError[]): Ids {
  const provinces = new Map<string, string>();
  for (const [t, line, p] of worldDataAllProvinces(w)) {
    const had = provinces.has(p.id);
    provinces.set(p.id, p.country);
    if (had) errors.push(tableErr(t, line, "id", `duplicate province id ${p.id}`));
  }
  return {
    countries: unique(w.countries, "iso3", (r) => r.iso3, errors),
    provinces,
    industries: unique(w.industries, "name", (r) => r.name, errors),
    zones: unique(w.financial_zones, "zone_id", (r) => r.zone_id, errors),
  };
}

/** The set of `key(row)`, reporting duplicates. */
function unique<T>(t: Table<T>, field: string, key: (r: T) => string, errors: DataError[]): Set<string> {
  const set = new Set<string>();
  for (const [line, r] of tableIter(t)) {
    const k = key(r);
    if (set.has(k)) errors.push(tableErr(t, line, field, `duplicate ${field} ${k}`));
    set.add(k);
  }
  return set;
}

function counts(w: WorldData, errors: DataError[]): void {
  const have = worldDataCounts(w);
  for (const [name, expected] of EXPECTED_COUNTS) {
    const n = have.find(([k]) => k === name)?.[1] ?? 0;
    if (n !== expected) {
      errors.push(dataErrorFile(`${name}.csv`, `${n} rows, expected ${expected}`));
    }
  }
}

function industries(w: WorldData, ids: Ids, errors: DataError[]): void {
  const t = w.industries;
  unique(t, "id", (r) => r.id, errors);
  // Industry names match companies.csv exactly (validate.py; spec 10.3 42 industries).
  const used = new Set(w.companies.rows.map((c) => c.industry));
  const diff = sorted([
    ...[...ids.industries].filter((i) => !used.has(i)),
    ...[...used].filter((i) => !ids.industries.has(i)),
  ]);
  if (diff.length > 0) {
    errors.push(tableFileErr(t, `industry names differ from companies.csv: ${debugStrs(diff)}`));
  }
  for (const [line, r] of tableIter(t)) {
    const range = (field: string, okay: boolean, what: string): void => {
      if (!okay) errors.push(tableErr(t, line, field, `${r.name}: ${what}`));
    };
    range("asset_decay", within(r.asset_decay, 0.0, ASSET_DECAY_MAX), "out of 0 to 10%");
    range("asset_decay_threshold_usd", r.asset_decay_threshold_usd >= 0.0, "negative");
    range(
      "variable_cost_share",
      Math.abs(r.margin_full_use + r.fixed_cost_share + r.variable_cost_share - 1.0) <= SHARE_SUM_TOL,
      "margin_full_use + fixed_cost_share + variable_cost_share is not 1",
    );
    range("volatility", within(r.volatility, 0.0, VOLATILITY_MAX), "out of 0 to 10% a quarter");
    // spec 5.1.1: boom uplift 0 to 1, crash drop 0 to under 1
    range("boom_uplift", within(r.boom_uplift, 0.0, 1.0), "out of 0 to 1");
    range("crash_drop", r.crash_drop >= 0.0 && r.crash_drop < 1.0, "out of 0 to under 1");
    // drift plan (D977): the mature rate is a rate a year; a half life of 0 means no fade
    range("mature_rate", within(r.mature_rate, -0.5, 1.0), "out of -50% to 100% a year");
    range("fade_half_life_years", r.fade_half_life_years >= 0.0, "negative");
  }
}

function countries(w: WorldData, errors: DataError[]): void {
  const t = w.countries;
  const [lo, hi] = WEALTH_INDEX_RANGE;
  for (const [line, r] of tableIter(t)) {
    if (!within(r.wealth_index, lo, hi)) {
      errors.push(
        tableErr(t, line, "wealth_index", `${r.wealth_index} is not an equality index of ${lo} to ${hi}`),
      );
    }
    if (!SUPERREGIONS.some(([, name]) => name === r.superregion)) {
      errors.push(tableErr(t, line, "superregion", `unknown ${r.superregion}`));
    }
  }
}

function countryEconomy(w: WorldData, ids: Ids, errors: DataError[]): void {
  const t = w.country_economy;
  // Every country in exactly one row, so in exactly one financial zone (batch 152).
  const seen = unique(t, "iso3", (r) => r.iso3, errors);
  for (const [line, r] of tableIter(t)) {
    if (!ids.countries.has(r.iso3)) {
      errors.push(tableErr(t, line, "iso3", `unknown country ${r.iso3}`));
    }
    if (!ids.zones.has(r.financial_zone)) {
      errors.push(tableErr(t, line, "financial_zone", `unknown financial zone ${r.financial_zone}`));
    }
  }
  for (const iso of sorted(ids.countries)) {
    if (!seen.has(iso)) errors.push(tableFileErr(t, `${iso} has no row (no financial zone)`));
  }
}

function zones(w: WorldData, ids: Ids, errors: DataError[]): void {
  const t = w.financial_zones;
  unique(t, "exchange_code", (r) => r.exchange_code, errors);
  const members = t.rows.reduce((n, z) => n + z.countries, 0);
  if (members !== ids.countries.size) {
    errors.push(tableFileErr(t, `member counts sum to ${members}, not the ${ids.countries.size} countries`));
  }
  const zoneOf = new Map(w.country_economy.rows.map((r) => [r.iso3, r.financial_zone] as const));
  const cities = new Map<string, KeyCity>(w.key_cities.rows.map((k) => [k.city, k] as const));
  for (const [line, z] of tableIter(t)) {
    const id = z.zone_id;
    if (z.intensity <= 0.0) {
      errors.push(tableErr(t, line, "intensity", `${id}: must be above 0`));
    }
    if (!within(z.credit_spread_bps, 0.0, CREDIT_SPREAD_MAX_BPS)) {
      errors.push(tableErr(t, line, "credit_spread_bps", `${id}: out of 0 to 2500`));
    }
    const [lo, hi] = CONFIDENCE_RANGE;
    if (!within(z.confidence_start, lo, hi)) {
      errors.push(tableErr(t, line, "confidence_start", `${id}: out of -100 to +100`));
    }
    for (const p of z.extra_provinces) {
      if (!ids.provinces.has(p)) {
        errors.push(tableErr(t, line, "extra_provinces", `${id}: unknown province ${p}`));
      }
    }
    // Batch 152: the hub province exists, belongs to the hub key city and lies in the zone.
    const hp = z.hub_province;
    const country = ids.provinces.get(hp);
    if (country === undefined) {
      errors.push(tableErr(t, line, "hub_province", `${id}: unknown province ${hp}`));
      continue;
    }
    const city = cities.get(z.hub_city);
    if (city === undefined) {
      errors.push(tableErr(t, line, "hub_city", `${id}: ${z.hub_city} is not in key-cities.csv`));
    } else if (!city.province_ids.some((p) => p === hp)) {
      errors.push(
        tableErr(t, line, "hub_province", `${id}: ${hp} is not among ${z.hub_city} key city provinces`),
      );
    }
    if (!z.extra_provinces.some((p) => p === hp) && zoneOf.get(country) !== id) {
      errors.push(tableErr(t, line, "hub_province", `${id}: ${hp} lies in ${country}, outside the zone`));
    }
  }
}

function keyCities(w: WorldData, ids: Ids, errors: DataError[]): void {
  const t = w.key_cities;
  unique(t, "id", (r) => r.id, errors);
  for (const [line, k] of tableIter(t)) {
    if (!ids.countries.has(k.country)) {
      errors.push(tableErr(t, line, "country", `${k.city}: unknown country ${k.country}`));
    }
    if (k.province_ids.length === 0) {
      errors.push(tableErr(t, line, "province_ids", `${k.city}: no provinces`));
    }
    for (const p of k.province_ids) {
      if (!ids.provinces.has(p)) {
        errors.push(tableErr(t, line, "province_ids", `${k.city}: unknown province ${p}`));
      }
    }
    for (const s of k.specialties) {
      if (!ids.industries.has(s)) {
        errors.push(tableErr(t, line, "specialties", `${k.city}: unknown industry ${s}`));
      }
    }
  }
}

function companies(w: WorldData, ids: Ids, errors: DataError[]): void {
  const t = w.companies;
  unique(t, "id", (r) => r.id, errors);
  for (const [line, c] of tableIter(t)) {
    if (!ids.countries.has(c.hq_country)) {
      errors.push(tableErr(t, line, "hq_country", `${c.id}: unknown country ${c.hq_country}`));
    }
    if (!ids.provinces.has(c.hq_province)) {
      errors.push(tableErr(t, line, "hq_province", `${c.id}: unknown province ${c.hq_province}`));
    }
  }
}

/**
 * Batch 161 (G6): the starting balance sheet, share count and opening price (spec 7.1); D15 and
 * D16 (Logan, M3 gate): starting lines within their 5.12 limit, none rated CCC or CC.
 */
function companyStart(w: WorldData, errors: DataError[]): void {
  const t = w.company_start;
  const cos = w.companies.rows;
  if (t.rows.length !== cos.length || t.rows.some((r, i) => r.id !== (cos[i] as { id: string }).id)) {
    errors.push(tableFileErr(t, "ids differ from companies.csv (same ids in the same order)"));
    return;
  }
  const [pLo, pHi] = OPEN_PRICE_RANGE;
  tableIter(t).forEach(([line, r], i) => {
    const c = cos[i] as (typeof cos)[number];
    const id = r.id;
    const p = r.open_price;
    if (p % 1 !== 0 || !within(p, pLo, pHi)) {
      errors.push(tableErr(t, line, "open_price", `${id}: ${p} is not a whole dollar in 5 to 200`));
    }
    const assets = r.cash_usd + r.asset_book_usd;
    const claims = r.credit_drawn_usd + r.book_equity_usd;
    if (Math.abs(assets - claims) > BALANCE_TOL_USD) {
      errors.push(
        tableErr(
          t,
          line,
          "book_equity_usd",
          `${id}: assets ${fixed0(assets)} != liabilities ${fixed0(r.credit_drawn_usd)} + equity ${fixed0(r.book_equity_usd)}`,
        ),
      );
    }
    // Spec 7.1 cash and line, with D15: book value at or above the asset book holds cash and no
    // line, so book equity is book value; below it, cash is min_cash and the line at most the 7.1
    // line (asset book - book value + min_cash), so book equity is book value plus what the line
    // was cut by.
    const bookValue = c.book_value_usd_m * 1e6;
    const minCash = MIN_CASH_SHARE * 1e6 * c.revenue_usd_m;
    if (bookValue >= r.asset_book_usd) {
      if (r.credit_drawn_usd > 0.0 || Math.abs(r.book_equity_usd - bookValue) > BALANCE_TOL_USD) {
        errors.push(
          tableErr(
            t,
            line,
            "book_equity_usd",
            `${id}: book value covers the asset book, but the line is drawn or book equity differs from companies.csv book value`,
          ),
        );
      }
    } else {
      const line71 = r.asset_book_usd - bookValue + minCash;
      if (
        Math.abs(r.cash_usd - minCash) > MIN_CASH_TOL_USD ||
        r.credit_drawn_usd > line71 + BALANCE_TOL_USD ||
        r.book_equity_usd < bookValue - BALANCE_TOL_USD
      ) {
        errors.push(
          tableErr(
            t,
            line,
            "credit_drawn_usd",
            `${id}: book value is below the asset book, but cash is not min_cash, or the line is above the 7.1 line ${fixed0(line71)}, or book equity is below book value`,
          ),
        );
      }
    }
    // D15: no starting line above its 5.12 limit at its starting rating; D16: none rated CCC or CC
    // with a drawn line.
    const factor = ratingFactorOfLabel(r.start_rating);
    if (factor === null) {
      errors.push(
        tableErr(t, line, "start_rating", `${id}: ${r.start_rating} is not on the AAA to CC scale`),
      );
    } else {
      const ownCash = maxF(r.cash_usd - r.credit_drawn_usd, 0.0);
      const limit = maxF(LIMIT_ASSET_BOOK_SHARE * r.asset_book_usd + ownCash, 0.0) * factor;
      if (r.credit_drawn_usd > limit) {
        errors.push(
          tableErr(
            t,
            line,
            "credit_drawn_usd",
            `${id}: line ${fixed0(r.credit_drawn_usd)} above its 5.12 limit ${fixed0(limit)} at ${r.start_rating}`,
          ),
        );
      }
      if (r.credit_drawn_usd > 0.0 && NO_LINE_RATINGS.includes(r.start_rating)) {
        errors.push(
          tableErr(t, line, "start_rating", `${id}: starts rated ${r.start_rating} with a drawn line`),
        );
      }
    }
    if (
      Math.abs(r.asset_book_usd - ASSET_BOOK_SHARE * r.gross_assets_usd) > ASSET_BOOK_TOL_USD ||
      minF(minF(r.asset_book_usd, r.cash_usd), r.credit_drawn_usd) < 0.0
    ) {
      errors.push(tableErr(t, line, "asset_book_usd", `${id}: not 50% of gross, or a negative balance`));
    }
    if (r.credit_drawn_usd > 0.0 && r.cash_usd > minCash + MIN_CASH_TOL_USD) {
      errors.push(tableErr(t, line, "cash_usd", `${id}: draws the line while holding cash above min_cash`));
    }
    if (r.shares < 1.0 || Math.abs(r.shares * p - r.engine_value_usd) > p) {
      errors.push(tableErr(t, line, "shares", `${id}: shares x open_price is not the engine value`));
    }
  });
}

/**
 * The spec 5.12 rating factor of a notch label on the AAA to CC scale (a notch reads its band, D220:
 * "BB+" reads BB 0.5); null off the scale.
 */
export function ratingFactorOfLabel(label: string): number | null {
  if (!RATING_LABELS.includes(label)) return null;
  const band = label.replace(/[+-]+$/, "");
  return RATING_FACTORS.find(([b]) => b === band)?.[1] ?? null;
}

/** The fixed startup events F1 to F9 (spec 5.19.2, build-plan M0.5); the twin of validate.py. */
function startupEvents(w: WorldData, ids: Ids, errors: DataError[]): void {
  const t = w.startup_events;
  const expected = Array.from({ length: 9 }, (_, i) => `F${i + 1}`);
  if (t.rows.length !== expected.length || t.rows.some((e, i) => e.id !== expected[i])) {
    errors.push(tableFileErr(t, "expected the 9 rows F1 to F9 in order"));
  }
  const regionOk = (r: string): boolean =>
    r === "any" || SUPERREGIONS.some(([slug]) => slug === r) || ids.countries.has(r);
  let startups = 0;
  for (const [line, e] of tableIter(t)) {
    const id = e.id;
    const dateOk = e.trigger === "Date" ? isIsoDate(e.date) : e.date === "";
    if (!dateOk) {
      errors.push(tableErr(t, line, "date", `${id}: \`${e.date}\` does not fit the trigger`));
    }
    if (e.startups.length === 0) {
      errors.push(tableErr(t, line, "startups", `${id}: no startups`));
    }
    for (const g of e.startups) {
      startups += g.count;
      if (!ids.industries.has(g.industry)) {
        errors.push(tableErr(t, line, "startups", `${id}: unknown industry ${g.industry}`));
      }
      for (const r of g.regions.filter((r) => !regionOk(r))) {
        errors.push(tableErr(t, line, "startups", `${id}: unknown region ${r}`));
      }
    }
    if (!(e.revenue_min_usd_m > 0.0 && e.revenue_min_usd_m <= e.revenue_max_usd_m)) {
      errors.push(tableErr(t, line, "revenue_max_usd_m", `${id}: bad revenue range`));
    }
    const [lo, hi] = CAST_RANGE;
    for (const [field, min, max] of [
      ["full_max", e.full_min, e.full_max],
      ["partial_max", e.partial_min, e.partial_max],
    ] as const) {
      if (!(lo <= min && min <= max && max <= hi)) {
        errors.push(tableErr(t, line, field, `${id}: cast ${min} to ${max} not within 1 to 5`));
      }
    }
  }
  if (!tableIsEmpty(t) && startups !== FIXED_EVENT_STARTUPS) {
    errors.push(tableFileErr(t, `${startups} startups, expected 32`));
  }
}

/** `YYYY-MM-DD` with a month of 1 to 12 and a day of 1 to 31. */
function isIsoDate(s: string): boolean {
  const parts = s.split("-");
  if (parts.length !== 3) return false;
  const [y, m, d] = parts as [string, string, string];
  const num = (p: string, len: number): boolean => p.length === len && /^[0-9]+$/.test(p);
  if (!(num(y, 4) && num(m, 2) && num(d, 2))) return false;
  return within(Number(m), 1, 12) && within(Number(d), 1, 31);
}

/**
 * The world-gen name lists (build-plan M0.6; spec 3.7.1, 5.19.3): every superregion file names each
 * of its cultures males, females, surnames and company prefixes; every country has a culture found
 * in its superregion file; every industry has a company name suffix.
 */
function names(w: WorldData, ids: Ids, errors: DataError[]): void {
  const KINDS: readonly NameKind[] = NAME_KIND_VALUES;
  // Superregion name to the cultures its file covers.
  const covered = new Map<string, Set<string>>();
  w.names.forEach((t, i) => {
    const region = (SUPERREGIONS[i] as readonly [string, string])[1];
    const cultures = new Set(t.rows.map((r) => r.culture));
    if (cultures.size === 0) errors.push(tableFileErr(t, "no names"));
    for (const c of sorted(cultures)) {
      for (const kind of KINDS) {
        if (!t.rows.some((r) => r.culture === c && r.kind === kind)) {
          errors.push(tableFileErr(t, `culture ${c} has no ${nameKindDebug(kind)} names`));
        }
      }
    }
    covered.set(region, cultures);
  });
  const regionOf = new Map(w.countries.rows.map((c) => [c.iso3, c.superregion] as const));
  const cc = w.country_cultures;
  const seen = unique(cc, "iso3", (r) => r.iso3, errors);
  for (const [line, r] of tableIter(cc)) {
    const region = regionOf.get(r.iso3);
    if (region === undefined) {
      errors.push(tableErr(cc, line, "iso3", `unknown country ${r.iso3}`));
    } else if (!covered.get(region)?.has(r.culture)) {
      errors.push(
        tableErr(cc, line, "culture", `${r.iso3}: ${r.culture} is not in the ${region} names file`),
      );
    }
  }
  for (const iso of sorted(ids.countries)) {
    if (!seen.has(iso)) errors.push(tableFileErr(cc, `${iso} has no culture`));
  }
  const sx = w.industry_suffixes;
  const withSuffix = new Set<string>();
  for (const [line, r] of tableIter(sx)) {
    if (!ids.industries.has(r.industry)) {
      errors.push(tableErr(sx, line, "industry", `unknown industry ${r.industry}`));
    }
    withSuffix.add(r.industry);
  }
  for (const ind of sorted(ids.industries)) {
    if (!withSuffix.has(ind)) errors.push(tableFileErr(sx, `${ind} has no company name suffix`));
  }
}

/**
 * The map assets, when loaded (M8; docs/build/m8-map-assets.md): every province they name is a
 * province of the world, and every coverage entry is a province file.
 */
function map(w: WorldData, ids: Ids, errors: DataError[]): void {
  const m = w.map;
  if (m === null) return;
  for (const [line, c] of tableIter(m.colors)) {
    if (!ids.provinces.has(c.province_id)) {
      errors.push(tableErr(m.colors, line, "province_id", `unknown province ${c.province_id}`));
    }
  }
  for (const file of m.meta.coverage) {
    const known = SUPERREGIONS.some(([slug]) => file === `provinces-${slug}.csv`);
    if (!known) {
      errors.push(dataErrorFile(MAP_META, `coverage names ${file}, which is not a province file`));
    }
  }
}
