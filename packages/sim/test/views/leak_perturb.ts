// The leak test's perturbed world (leak.test.ts, check 4): a copy of the state in which every
// company that shows estimates (D420) has other books. Not a Rust file.
//
// What is perturbed: a banded company's books, the figures D420 bands or keeps out of the views:
// cash, the credit line (drawn and limit), the starting revenue (a birth's size), the tax book,
// every ledger (the open month, the pending one, the posted months, the archived statements'
// lines but `shared`), every balance sheet (the opening one, the archive's), a statement's held
// TB and guidance, the data books (held and unstructured TB), its units' assets and monthly
// figures (but `shared_m`), and its stock's fair value, V, consensus and projection. Not
// perturbed: what D420 leaves exact (productivity, management score, stations, compute and the
// compute and licences line, D434, labor units, the PC bonus, the free R&D step, ratings,
// shares, the cap table), market data (price, prev close, buzz, the EFV error, the bars, the IPO
// price) and every publishing company.
//
// How: each number x becomes x × k + c, k from `FACTORS` and c a small offset, both stepped by
// the field's position and a counter of the objects perturbed so far. So the books change
// unevenly: a ratio of two figures (a margin, a quarter-on-quarter growth) changes as well as
// each figure, and a true 0 does not stay 0, so a derived value that follows the books (a
// figure in $M, rounded to $1M, over the shares, a ratio) changes too. A year statement whose
// four quarters are archived is rebuilt from the perturbed quarters (flows summed, the balance
// sheet, held TB and guidance Q4's), so the perturbed books stay ones the estimated year can
// band (D430) and the perturbed build's bands can be checked against them.
import type { CompanyId } from "../../src/types/ids.ts";
import type { World } from "../../src/types/world.ts";
import { showsEstimates } from "../../src/views/estimate.ts";

/** The scale factors (none is 1). */
const FACTORS = [1.25, 0.8, 1.5, 1.125, 0.625, 1.375, 0.9];
/**
 * The offsets' units: money in USD, data in TB (odd values, so a perturbed truth does not meet a
 * public number such as a 0.75 share or a 0.375 tax rate by chance).
 */
const OFFSET_USD = 1234.5678;
const OFFSET_TB = 0.37129;

const LEDGER_FIELDS = [
  "revenue",
  "variable",
  "fixed_cash",
  "rd",
  // Not `shared`: the compute and licences cost is exact by D434.
  "depreciation",
  "line_interest",
  "line_fee",
  "interest_income",
  "asset_sale_gain",
  "tax",
  "tax_paid",
  "asset_purchases",
  "asset_sale_proceeds",
  "line_drawn_or_repaid",
  "shares_issued_net",
  "dividends",
] as const;

const BALANCE_FIELDS = [
  "cash",
  "asset_book",
  "total_assets",
  "line_drawn",
  "tax_payable",
  "total_liabilities",
  "estate",
  "equity",
] as const;

const UNIT_FIELDS = [
  "gross_assets",
  "asset_book",
  "revenue_m",
  "variable_m",
  "fixed_m",
  "rd_m",
  "dep_m",
  "capex_m",
  "sale_proceeds_m",
  "sale_gain_m",
] as const;

/** The ids of the companies that show estimates now (D420). */
export function bandedCompanies(w: World): CompanyId[] {
  return w.companies.map((_, i) => i as CompanyId).filter((id) => showsEstimates(w, id));
}

/** A copy of `w` with every banded company's books perturbed (see the header). */
export function perturbBooks(w: World): World {
  const p = structuredClone(w);
  const banded = new Set(bandedCompanies(p));
  // Objects a publishing company reaches: perturbing one of them would change a published figure.
  const published = new Set<object>();
  p.companies.forEach((c, i) => {
    if (banded.has(i as CompanyId)) return;
    const f = c.finance;
    for (const s of [...f.archive.quarters, ...f.archive.years]) {
      published.add(s);
      published.add(s.lines);
      published.add(s.balance);
      published.add(s.key);
    }
  });
  const seen = new Set<object>();
  let n = 0;
  const bump = (o: object, fields: readonly string[], offset: number): void => {
    if (seen.has(o)) return;
    if (published.has(o)) throw new Error("a banded company's books are shared with a published one");
    seen.add(o);
    const r = o as Record<string, number>;
    fields.forEach((f, i) => {
      const x = r[f];
      if (typeof x !== "number") throw new Error(`perturb: no number at ${f}`);
      const j = i + n;
      r[f] = x * FACTORS[j % FACTORS.length]! + offset * (1 + (j % 3));
    });
    n++;
  };
  for (const id of banded) {
    const c = p.companies[id]!;
    const f = c.finance;
    bump(c, ["cash_usd", "revenue_usd"], OFFSET_USD);
    bump(f.line, ["drawn", "limit"], OFFSET_USD);
    bump(f.tax, ["carryforward", "quarter_pre_tax", "accrued"], OFFSET_USD);
    bump(f.pending, LEDGER_FIELDS, OFFSET_USD);
    bump(f.month, LEDGER_FIELDS, OFFSET_USD);
    for (const m of f.months) bump(m.lines, LEDGER_FIELDS, OFFSET_USD);
    if (f.last_month !== null) bump(f.last_month.lines, LEDGER_FIELDS, OFFSET_USD);
    bump(f.opening, BALANCE_FIELDS, OFFSET_USD);
    for (const s of f.archive.quarters) {
      bump(s.lines, LEDGER_FIELDS, OFFSET_USD);
      bump(s.balance, BALANCE_FIELDS, OFFSET_USD);
      bump(s.key, ["held_tb"], OFFSET_TB);
      bump(s.key.guidance, ["0", "1"], OFFSET_USD);
    }
    for (const y of f.archive.years) {
      const year = y.period.kind === "Year" ? y.period.year : Number.NaN;
      const qs = f.archive.quarters.filter(
        (s) => s.period.kind === "Quarter" && s.period.quarter.year === year,
      );
      if (qs.length !== 4) {
        bump(y.lines, LEDGER_FIELDS, OFFSET_USD);
        bump(y.balance, BALANCE_FIELDS, OFFSET_USD);
        bump(y.key, ["held_tb"], OFFSET_TB);
        bump(y.key.guidance, ["0", "1"], OFFSET_USD);
        continue;
      }
      // A year with its four quarters stays their year (3.9, D430): its flows are their sums,
      // its balance sheet, held TB and guidance Q4's, as the estimated year takes them.
      for (const o of [y, y.lines, y.balance, y.key]) {
        if (published.has(o)) throw new Error("a banded company's books are shared with a published one");
      }
      for (const l of LEDGER_FIELDS) y.lines[l] = qs.reduce((sum, q) => sum + q.lines[l], 0);
      const q4 = qs[3]!;
      y.balance = { ...q4.balance };
      y.key = { ...y.key, held_tb: q4.key.held_tb, guidance: [q4.key.guidance[0], q4.key.guidance[1]] };
    }
    for (const d of c.data) {
      bump(d.book, ["held"], OFFSET_TB);
      bump(
        d.book.unstructured,
        d.book.unstructured.map((_, i) => String(i)),
        OFFSET_TB,
      );
    }
    for (const u of c.units) bump(p.units[u]!, UNIT_FIELDS, OFFSET_USD);
    bump(p.market.stocks[id]!, ["fair_value", "value", "consensus_ni", "projection_ni"], OFFSET_USD);
  }
  return p;
}
