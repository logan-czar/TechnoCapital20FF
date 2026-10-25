// The books a company carries in the World (spec 3.5 finance rows; build-plan M4): the credit
// line, the rating, the distress counters, the tax book, the month being posted, the posted
// months of the open quarter and the statement archives. The jobs in ./jobs.ts move them. Ported
// from crates/sim/src/finance/state.rs.
//
// The types (PostedMonth, CompanyFinance, Archive, BooksCheck) are in types/state/finance.ts.

import type {
  Archive,
  CompanyFinance,
  CompanyStatus,
  ImpliedRating,
  Rating,
  Statement,
} from "../types/state/finance.ts";
import { ARCHIVE_QUARTERS, ARCHIVE_YEARS } from "../types/state/finance.ts";
import { balanceSheetDefault } from "./balance.ts";
import { distressStateDefault } from "./distress.ts";
import { RATING_WORST } from "./rating.ts";
import { archivePush, ledgerDefault } from "./statements.ts";
import { taxBookDefault } from "./tax.ts";

export type { Archive, BooksCheck, CompanyFinance, PostedMonth } from "../types/state/finance.ts";

/** Rust `Archive::default()`. */
export function archiveDefault(): Archive {
  return { quarters: [], years: [] };
}

/** Rust `BooksCheck::default()`. */
export function booksCheckDefault(): { checked: number; failures: number; first_failure: string | null } {
  return { checked: 0, failures: 0, first_failure: null };
}

/**
 * The state before `start` (jobs.ts) sets the limit and history: the line as drawn and the
 * starting rating as company-start.csv has them (spec 7.1; D241, D132), with no limit yet.
 */
export function companyFinanceAtLoad(line_drawn: number, start_rating: Rating): CompanyFinance {
  const unrated: ImpliedRating = {
    leverage: RATING_WORST,
    cover_notches: 0,
    size_notches: 0,
    sector_notches: 0,
    adjusted: RATING_WORST,
    ceiling: RATING_WORST,
    implied: RATING_WORST,
  };
  return {
    line: { drawn: line_drawn, limit: 0.0, excess_months_left: 0 },
    rating: start_rating,
    implied: unrated,
    last_review_notches: 0,
    distress: distressStateDefault(),
    tax: taxBookDefault(),
    pending: ledgerDefault(),
    month: ledgerDefault(),
    month_active: false,
    months: [],
    last_month: null,
    opening: balanceSheetDefault(),
    archive: archiveDefault(),
    bankrupt_on: null,
    removed_on: null,
    removal: null,
  };
}

/** Quarterly statements, oldest first (spec 4.5 step 2; Rust `CompanyFinance::quarters`). */
export function companyFinanceQuarters(f: CompanyFinance): readonly Statement[] {
  return f.archive.quarters;
}

/** Yearly statements, oldest first (D228; Rust `CompanyFinance::years`). */
export function companyFinanceYears(f: CompanyFinance): readonly Statement[] {
  return f.archive.years;
}

/**
 * Archives a quarter's statement, keeping 20 (spec 4.5 step 2). Copy on write like Rust's
 * `Arc::make_mut` (D130): a fresh archive object, so a view holding the old one never changes.
 */
export function companyFinancePushQuarter(f: CompanyFinance, s: Statement): void {
  const quarters = [...f.archive.quarters];
  archivePush(quarters, s, ARCHIVE_QUARTERS);
  f.archive = { quarters, years: f.archive.years };
}

/** Archives a year's statement, keeping 5 (D228); copy on write like `companyFinancePushQuarter`. */
export function companyFinancePushYear(f: CompanyFinance, s: Statement): void {
  const years = [...f.archive.years];
  archivePush(years, s, ARCHIVE_YEARS);
  f.archive = { quarters: f.archive.quarters, years };
}

/** Rust `CompanyFinance::status`. */
export function companyFinanceStatus(f: CompanyFinance): CompanyStatus {
  return f.distress.status;
}

/** Still in the game: not Removed (build-plan M4.9 "every company still in the game"). */
export function companyFinanceInGame(f: CompanyFinance): boolean {
  return f.distress.status !== "Removed";
}
