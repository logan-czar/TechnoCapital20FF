// Person names from the superregion name lists (spec 3.7.1 "name from a list for the HQ country's
// superregion", 3.7.2 "unique against characters.csv"; data/names/, M0.6). Ported from
// crates/sim/src/people/names.rs. The `NameBook` and `NameBooks` types are in
// types/state/people.ts.
//
// A country's culture comes from names/country-cultures.csv; its first names and surnames from
// the rows of that culture in the country's superregion file. Cultures with `family_first` put
// the surname first, as the world-gen generator does (tools/world-gen/gen.py `person_name`).
//
// Jobs see only the `World` (no `WorldData`), and a save loads without the CSVs (D13), so the
// books are built once at load into `NameBooks` (one entry per country in country id order) and
// stored on the World; generators read from there.

import { type NameRow, SUPERREGIONS, type WorldData } from "@tc20ff/sim-data";
import type { DrawSource } from "../types/draws.ts";
import type { CountryId } from "../types/ids.ts";
import { cmpStr } from "../types/num.ts";
import type { NameBook, NameBooks } from "../types/state/people.ts";
import type { Result } from "../types/world.ts";

export type { NameBook, NameBooks } from "../types/state/people.ts";

/** Chance a generated person is female (decision D203). */
export const FEMALE_CHANCE = 0.5;
/** Tries at a unique full name before a numeral suffix is added (D203; world-gen uses 200). */
export const UNIQUE_NAME_TRIES = 200;

/**
 * The book for `culture` from one superregion file's rows, or null if the file has no first names
 * and surnames for it. Rust `NameBook::from_rows`.
 */
export function nameBookFromRows(rows: readonly NameRow[], culture: string): NameBook | null {
  const pick = (kind: NameRow["kind"]): string[] =>
    rows.filter((r) => r.culture === culture && r.kind === kind).map((r) => r.name);
  const book: NameBook = {
    culture,
    family_first: rows.some((r) => r.culture === culture && r.family_first),
    male: pick("Male"),
    female: pick("Female"),
    surnames: pick("Surname"),
  };
  const usable = book.male.length > 0 && book.female.length > 0 && book.surnames.length > 0;
  return usable ? book : null;
}

/**
 * The book for a country (countries.csv `iso3`): its culture from country-cultures.csv, in its
 * superregion's file. If the culture is missing from that file, the file's first culture (in file
 * order) is used (D203); the sim-data checks make this not happen with today's data. Scans the
 * name rows: build `NameBooks` once at load rather than calling this per draw.
 * Rust `NameBook::for_country`.
 */
export function nameBookForCountry(data: WorldData, iso3: string): NameBook | null {
  const rc = countryCulture(data, iso3);
  if (rc === null) return null;
  const table = data.names[rc[0]];
  if (table === undefined) return null;
  return nameBookFromRows(table.rows, rc[1]);
}

/**
 * A random full name: female with `FEMALE_CHANCE`, then a first name and a surname, each uniform
 * over the lists (gen stream). Draw order is frozen: sex, first name, surname. Rust `NameBook::draw`.
 */
export function nameBookDraw(book: NameBook, draws: DrawSource): string {
  const female = draws.chance("Gen", FEMALE_CHANCE);
  const firsts = female ? book.female : book.male;
  const first = pick(draws, firsts);
  const sur = pick(draws, book.surnames);
  return book.family_first ? `${sur} ${first}` : `${first} ${sur}`;
}

/**
 * A name for which `taken` is false (spec 3.7.2: unique against characters.csv and the characters
 * made in play). After `UNIQUE_NAME_TRIES` tries the last draw gets the lowest numeral suffix
 * (" II", " III", ...) that is free (D203). Rust `NameBook::draw_unique`.
 */
export function nameBookDrawUnique(
  book: NameBook,
  draws: DrawSource,
  taken: (name: string) => boolean,
): string {
  let name = "";
  for (let i = 0; i < UNIQUE_NAME_TRIES; i++) {
    name = nameBookDraw(book, draws);
    if (!taken(name)) return name;
  }
  for (let n = 2; ; n++) {
    const candidate = `${name} ${roman(n)}`;
    if (!taken(candidate)) return candidate;
  }
}

/** The superregion file index and culture a country's names come from (D203 fallback). */
function countryCulture(data: WorldData, iso3: string): [number, string] | null {
  const country = data.countries.rows.find((c) => c.iso3 === iso3);
  if (country === undefined) return null;
  const region = SUPERREGIONS.findIndex(([, name]) => name === country.superregion);
  if (region < 0) return null;
  const table = data.names[region];
  if (table === undefined) return null;
  const rows = table.rows;
  const listedRow = data.country_cultures.rows.find((c) => c.iso3 === iso3);
  const listed =
    listedRow !== undefined && nameBookFromRows(rows, listedRow.culture) !== null ? listedRow.culture : null;
  const culture = listed ?? rows[0]?.culture ?? null;
  return culture === null ? null : [region, culture];
}

/** Rust `NameBooks::default()`. */
export function nameBooksDefault(): NameBooks {
  return { books: [], by_country: [] };
}

/**
 * Builds the books for `countryKeys` (iso3), given in country id order (the World's `countries`
 * table order, D4), so `nameBooksGet(CountryId)` lines up with the World. The error is the iso3
 * of a country with no name book (Rust `NoNameBook`). Rust `NameBooks::build`.
 */
export function nameBooksBuild(data: WorldData, countryKeys: Iterable<string>): Result<NameBooks, string> {
  const keys: [number, string][] = [];
  const out = nameBooksDefault();
  for (const iso3 of countryKeys) {
    const key = countryCulture(data, iso3);
    if (key === null) return { ok: false, error: iso3 };
    let index = keys.findIndex((k) => k[0] === key[0] && k[1] === key[1]);
    if (index < 0) {
      const table = data.names[key[0]];
      if (table === undefined) return { ok: false, error: iso3 };
      const book = nameBookFromRows(table.rows, key[1]);
      if (book === null) return { ok: false, error: iso3 };
      keys.push(key);
      out.books.push(book);
      index = out.books.length - 1;
    }
    out.by_country.push(index);
  }
  return { ok: true, value: out };
}

/**
 * Builds the books for every country of `data` in ascending iso3 byte order, the World's country
 * id order (D4). Rust `NameBooks::from_data`.
 */
export function nameBooksFromData(data: WorldData): Result<NameBooks, string> {
  const keys = data.countries.rows.map((c) => c.iso3).sort(cmpStr);
  return nameBooksBuild(data, keys);
}

/** The book of a country. Rust `NameBooks::get`. */
export function nameBooksGet(books: NameBooks, country: CountryId): NameBook | null {
  const i = books.by_country[country];
  if (i === undefined) return null;
  return books.books[i] ?? null;
}

/** Countries covered. Rust `NameBooks::len`. */
export function nameBooksLen(books: NameBooks): number {
  return books.by_country.length;
}

/** Rust `NameBooks::is_empty`. */
export function nameBooksIsEmpty(books: NameBooks): boolean {
  return books.by_country.length === 0;
}

/** Distinct books held. Rust `NameBooks::distinct`. */
export function nameBooksDistinct(books: NameBooks): number {
  return books.books.length;
}

function pick(draws: DrawSource, list: readonly string[]): string {
  const i = draws.intInclusive("Gen", 0, list.length - 1);
  return list[i] as string;
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
export function roman(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN_TABLE) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}
