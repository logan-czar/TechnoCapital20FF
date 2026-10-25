// Company names for startups (spec 5.19.3 "generated from the world-gen name lists, unique") and
// tickers at listing (spec 5.20.1 Listing step 4: "a unique ticker of up to 4 letters"). Ported
// from crates/sim/src/births/names.rs.
//
// Names follow world-gen gen.py `company_name`: a prefix from the HQ country's culture (90%) or
// from the anglo and local lists together (10%), then a suffix of the industry
// (names/industry-suffixes.csv), `"{prefix} {suffix}"`, suffix first for "Maison" and "Atelier".
// Built once at load into `CompanyNames` (stored on the World like `NameBooks`, D272).
//
// CompanyNames is in types/state/births.ts.

import { SUPERREGIONS, type WorldData } from "@tc20ff/sim-data";
import type { DrawSource } from "../types/draws.ts";
import type { CountryId, IndustryId } from "../types/ids.ts";
import { cmpStr } from "../types/num.ts";
import type { CompanyNames } from "../types/state/births.ts";

export type { CompanyNames };

/** gen.py: the culture whose prefixes join the local ones 10% of the time. */
export const ANGLO_CULTURE = "anglo";
/** gen.py: a local prefix 90% of the time. */
export const LOCAL_PREFIX_CHANCE = 0.9;
/** gen.py: tries at a unique name (D272: then the lowest free roman numeral suffix). */
export const COMPANY_NAME_TRIES = 500;
/** gen.py: suffixes written before the prefix. */
export const SUFFIX_FIRST: readonly string[] = ["Maison", "Atelier"];
/** Spec 5.20.1: tickers are up to 4 letters; gen.py's are 3 or 4 (D273). */
export const TICKER_MIN_LETTERS = 3;
export const TICKER_MAX_LETTERS = 4;
/** gen.py: initials of at most the first four words. */
export const TICKER_INITIAL_WORDS = 4;

/** Rust `CompanyNames::default()`. */
export function companyNamesDefault(): CompanyNames {
  return { prefix_lists: [], by_country: [], anglo: [], suffixes: [] };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/**
 * Builds the lists for `countries` (iso3, in the World's country order) and `industries`
 * (industries.csv names, in the World's industry order). A country whose culture has no prefixes
 * in its superregion file uses the anglo list (D272). Rust `CompanyNames::build`.
 */
export function companyNamesBuild(
  data: WorldData,
  countries: Iterable<string>,
  industries: Iterable<string>,
): CompanyNames {
  const anglo: string[] = [];
  for (const table of data.names) {
    for (const r of table.rows) {
      if (r.culture === ANGLO_CULTURE && r.kind === "CompanyPrefix" && !anglo.includes(r.name)) {
        anglo.push(r.name);
      }
    }
  }
  const out: CompanyNames = { ...companyNamesDefault(), anglo };
  for (const iso3 of countries) {
    let list = localPrefixes(data, iso3);
    if (list.length === 0) list = [...out.anglo];
    let i = out.prefix_lists.findIndex((l) => sameList(l, list));
    if (i < 0) {
      out.prefix_lists.push(list);
      i = out.prefix_lists.length - 1;
    }
    out.by_country.push(i);
  }
  for (const name of industries) {
    out.suffixes.push(data.industry_suffixes.rows.filter((s) => s.industry === name).map((s) => s.suffix));
  }
  return out;
}

/** Builds the lists in the World's orders: countries by iso3, industries by id (D4). Rust `CompanyNames::from_data`. */
export function companyNamesFromData(data: WorldData): CompanyNames {
  const countries = data.countries.rows.map((c) => c.iso3).sort(cmpStr);
  const industries = data.industries.rows
    .map((i): [string, string] => [i.id, i.name])
    .sort((a, b) => cmpStr(a[0], b[0]) || cmpStr(a[1], b[1]));
  return companyNamesBuild(
    data,
    countries,
    industries.map(([, n]) => n),
  );
}

/** The local prefixes of a country (Rust `CompanyNames::prefixes`). */
export function companyNamesPrefixes(names: CompanyNames, country: CountryId): readonly string[] {
  const i = names.by_country[country] ?? 0;
  return names.prefix_lists[i] ?? [];
}

/** The suffixes of an industry (Rust `CompanyNames::suffixes`). */
export function companyNamesSuffixes(names: CompanyNames, industry: IndustryId): readonly string[] {
  return names.suffixes[industry] ?? [];
}

/**
 * A unique company name (gen stream; D272). Per try, in order: the 90% local-prefix roll, the
 * prefix, the suffix. After `COMPANY_NAME_TRIES` the last draw takes the lowest free roman numeral
 * (" II", ...). Rust `CompanyNames::draw`.
 */
export function companyNamesDraw(
  names: CompanyNames,
  country: CountryId,
  industry: IndustryId,
  taken: (name: string) => boolean,
  draws: DrawSource,
): string {
  const local = companyNamesPrefixes(names, country);
  const mixed = [...names.anglo, ...local];
  const suffixes = companyNamesSuffixes(names, industry);
  let name = "";
  for (let t = 0; t < COMPANY_NAME_TRIES; t++) {
    const pool = draws.chance("Gen", LOCAL_PREFIX_CHANCE) ? local : mixed;
    const pre = pick(pool, draws);
    const suf = pick(suffixes, draws);
    name = compose(pre, suf);
    if (!taken(name)) return name;
  }
  for (let n = 2; ; n++) {
    const candidate = `${name} ${roman(n)}`;
    if (!taken(candidate)) return candidate;
  }
}

function localPrefixes(data: WorldData, iso3: string): string[] {
  const country = data.countries.rows.find((c) => c.iso3 === iso3);
  if (country === undefined) return [];
  const region = SUPERREGIONS.findIndex(([, n]) => n === country.superregion);
  if (region < 0) return [];
  const culture = data.country_cultures.rows.find((c) => c.iso3 === iso3)?.culture;
  if (culture === undefined) return [];
  const table = data.names[region];
  if (table === undefined) return [];
  return table.rows.filter((r) => r.culture === culture && r.kind === "CompanyPrefix").map((r) => r.name);
}

function pick(list: readonly string[], draws: DrawSource): string {
  if (list.length === 0) return "";
  const i = draws.intInclusive("Gen", 0, list.length - 1);
  return list[i] as string;
}

/** `"{prefix} {suffix}"`, or `"{suffix} {prefix}"` for Maison and Atelier (gen.py). */
export function compose(prefix: string, suffix: string): string {
  const [a, b] = SUFFIX_FIRST.includes(suffix) ? [suffix, prefix] : [prefix, suffix];
  return [a, b].filter((s) => s !== "").join(" ");
}

const ROMAN_TABLE: readonly (readonly [number, string])[] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** A roman numeral (for name suffixes). */
function roman(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN_TABLE) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

/** The first `n` characters (code points) of a string, Rust `chars().take(n).collect()`. */
function head(s: string, n: number): string {
  return Array.from(s).slice(0, n).join("");
}

/** Rust `char::is_whitespace` (Unicode White_Space). */
const WHITESPACE = /[\t-\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/;

/**
 * The ticker candidates of a name, in order (world-gen gen.py `ticker`): the initials of the first
 * four words, the first two letters of the first two words, the first three of the first word and
 * the first of the second, the first four letters, the first three; only those of 3 or 4 letters.
 */
export function tickerCandidates(name: string): string[] {
  const cleaned = name.replaceAll("-", " ").replaceAll("'", "");
  const words = cleaned
    .split(WHITESPACE)
    .filter((w) => w !== "")
    .filter((w) => /^\p{Alphabetic}/u.test(w));
  const letters = name
    .toUpperCase()
    .split("")
    .filter((c) => /^[A-Za-z]$/.test(c))
    .join("");
  const out: string[] = [];
  if (words.length >= 2) {
    const w0 = words[0] as string;
    const w1 = words[1] as string;
    out.push(
      words
        .slice(0, TICKER_INITIAL_WORDS)
        .map((w) => head(w, 1))
        .join("")
        .toUpperCase(),
    );
    out.push(`${head(w0, 2)}${head(w1, 2)}`.toUpperCase());
    out.push(`${head(w0, 3)}${head(w1, 1)}`.toUpperCase());
  }
  out.push(head(letters, TICKER_MAX_LETTERS));
  out.push(head(letters, TICKER_MIN_LETTERS));
  return out.filter((t) => {
    const count = Array.from(t).length;
    return count >= TICKER_MIN_LETTERS && count <= TICKER_MAX_LETTERS && /^[A-Z]*$/.test(t);
  });
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * A unique ticker for a listing (spec 5.20.1; D273): the first free `tickerCandidates`; else, with
 * no draw (gen.py's random fallback replaced by a fixed order), the first free 4-letter code that
 * starts with the name's first letter, the other three running AAA to ZZZ; else the first free
 * 4-letter code from AAAA.
 */
export function ticker(name: string, taken: (t: string) => boolean): string {
  const first = tickerCandidates(name).find((t) => !taken(t));
  if (first !== undefined) return first;
  const initial =
    name
      .toUpperCase()
      .split("")
      .find((c) => /^[A-Z]$/.test(c)) ?? "A";
  for (const a of ALPHABET) {
    for (const b of ALPHABET) {
      for (const c of ALPHABET) {
        const t = `${initial}${a}${b}${c}`;
        if (!taken(t)) return t;
      }
    }
  }
  for (const f of ALPHABET) {
    for (const a of ALPHABET) {
      for (const b of ALPHABET) {
        for (const c of ALPHABET) {
          const t = `${f}${a}${b}${c}`;
          if (!taken(t)) return t;
        }
      }
    }
  }
  throw new Error("all 456,976 four-letter tickers are taken");
}
