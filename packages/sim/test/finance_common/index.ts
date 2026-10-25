// Port of crates/sim/tests/finance_common/mod.rs: shared helpers of the finance tests: the data,
// lookups by id, and the finance-start.csv golden fixture written by
// docs/design/tools/mvp-data/export_finance_fixtures.py (an independent Python implementation of
// 3.9, 5.11, 5.12 and 7.1 as decisions D220 to D234 read them).
//
// Expects:
//   "@tc20ff/sim-data"            row types Company, Industry, CountryEconomy, FinancialZone,
//                                 CompanyStart and WorldData (Rust names, snake_case fields)
//   ../../src/finance/rating.ts ratingParse(s) -> Rating | null   [Rating::parse; accepts the
//                                 CSV labels "AAA", "AA+", "BBB-" and so on]
import type {
  Company,
  CompanyStart,
  CountryEconomy,
  FinancialZone,
  Industry,
  WorldData,
} from "@tc20ff/sim-data";
import { expect } from "vitest";
import { ratingParse } from "../../src/finance/rating.ts";
import type { Rating } from "../../src/types/state/finance.ts";
import { fixtureText, lines } from "../common/fixtures.ts";

export { data } from "../common/index.ts";

/** World base rate (spec 3.1). */
export const BASE_RATE = 0.03;

/** Rust Rating::parse(s).unwrap(). */
export function parseRating(s: string): Rating {
  const r = ratingParse(s);
  if (r === null) throw new Error(`not a rating: ${s}`);
  return r;
}

/** The facts a finance formula reads for one company, all from the CSVs. */
export interface CompanyFacts {
  company: Company;
  industry: Industry;
  economy: CountryEconomy;
  zone: FinancialZone;
  start: CompanyStart;
}

/** CompanyFacts::sovereign. */
export function sovereign(f: CompanyFacts): Rating {
  return parseRating(f.economy.sovereign_rating);
}

/** Zone base spread as a fraction (the CSV bps / 10,000). CompanyFacts::zone_spread. */
export function zoneSpread(f: CompanyFacts): number {
  return f.zone.credit_spread_bps / 10_000.0;
}

/** Sovereign spread as a fraction (the CSV bps / 10,000). CompanyFacts::sovereign_spread. */
export function sovereignSpread(f: CompanyFacts): number {
  return f.economy.sovereign_spread_bps / 10_000.0;
}

function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`no ${what}`);
  return v;
}

export function facts(d: WorldData, id: string): CompanyFacts {
  const company = must(
    d.companies.rows.find((c) => c.id === id),
    `company ${id}`,
  );
  const industry = must(
    d.industries.rows.find((i) => i.name === company.industry),
    `industry of ${id}`,
  );
  const economy = must(
    d.country_economy.rows.find((e) => e.iso3 === company.hq_country),
    `economy of ${id}`,
  );
  const zone = must(
    d.financial_zones.rows.find((z) => z.zone_id === economy.financial_zone),
    `zone of ${id}`,
  );
  const start = must(
    d.company_start.rows.find((s) => s.id === id),
    `company-start row ${id}`,
  );
  return { company, industry, economy, zone, start };
}

/** One row of finance-start.csv: column name to cell. */
export class FixtureRow {
  constructor(readonly cells: ReadonlyMap<string, string>) {}

  private cell(col: string): string {
    return must(this.cells.get(col), `column ${col}`);
  }

  id(): string {
    return this.cell("id");
  }

  num(col: string): number {
    const s = this.cell(col);
    const n = Number(s);
    if (s.trim() === "" || Number.isNaN(n)) throw new Error(`${this.id()} ${col}`);
    return n;
  }

  rating(col: string): Rating {
    return parseRating(this.cell(col));
  }
}

/** finance-start.csv rows in file order (plain comma-separated, no quoting). */
export function financeStart(): FixtureRow[] {
  const all = lines(fixtureText("finance-start.csv"));
  const header = must(all[0], "header").split(",");
  return all
    .slice(1)
    .filter((l) => l !== "")
    .map((l) => {
      const cells = l.split(",");
      expect(cells.length, l).toBe(header.length);
      return new FixtureRow(new Map(header.map((h, i) => [h, must(cells[i], "cell")])));
    });
}

/** a and b agree to rel of the larger magnitude (or to $0.01). */
export function close(a: number, b: number, rel: number): boolean {
  return Math.abs(a - b) <= Math.max(rel * Math.max(Math.abs(a), Math.abs(b)), 0.01);
}

export function assertClose(what: string, actual: number, expected: number): void {
  expect(close(actual, expected, 1e-9), `${what}: ${actual} vs expected ${expected}`).toBe(true);
}
