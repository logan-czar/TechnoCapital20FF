// Port of crates/sim/tests/spec_5_11.rs: spec 5.11 tax (10.5.5): each quarter tax = max(0, pre-tax
// income less the loss carryforward used) x corp_tax_rate of the HQ country, losses carried
// forward without limit, accrued monthly and paid at the quarter close (build-plan M4.3: unit
// tests for loss years and carryforward use). Pure formulas, no RNG.
//
// Expects:
//   ../../src/finance/tax.ts      type QuarterTax { pre_tax_income, carryforward_used, tax,
//                                 carryforward_added, carryforward_after },
//                                 quarterTax(pre_tax, carryforward, rate) -> QuarterTax,
//                                 accrueMonth(book, pre_tax, rate) -> number (mutates the TaxBook),
//                                 closeQuarter(book) -> QuarterTax (resets the book)
//   ../../src/finance/balance.ts  type Books, booksTaxPayable(books)   [Books::tax_payable]
//   ./finance_common/index.ts     data
import { describe, expect, it } from "vitest";
import { type Books, booksTaxPayable } from "../../src/finance/balance.ts";
import { accrueMonth, closeQuarter, type QuarterTax, quarterTax } from "../../src/finance/tax.ts";
import { zeroTax } from "./common/defaults.ts";
import { data } from "./finance_common/index.ts";

function near(a: number, b: number): void {
  expect(Math.abs(a - b) < 1e-6, `${a} vs ${b}`).toBe(true);
}

function rate(iso: string): number {
  const e = data().country_economy.rows.find((x) => x.iso3 === iso);
  if (e === undefined) throw new Error(`no economy row ${iso}`);
  return e.corp_tax_rate;
}

describe("spec 5.11 tax", () => {
  it("profit_with_no_losses_pays_the_national_rate", () => {
    // Tax is national (5.1.2, C28): Chile 27%, Germany 29.9%, from country-economy.csv.
    const chl = rate("CHL");
    const deu = rate("DEU");
    expect([chl, deu]).toEqual([0.27, 0.299]);
    near(quarterTax(100.0e6, 0.0, chl).tax, 27.0e6);
    near(quarterTax(100.0e6, 0.0, deu).tax, 29.9e6);
    expect(quarterTax(0.0, 0.0, chl).tax).toBe(0.0);
  });

  it("a_loss_year_then_carryforward_use", () => {
    // Rate 25%. A loss year (four quarters of -10M) builds 40M of carryforward and pays no tax;
    // the next year profits use it up before any tax is paid.
    const r = 0.25;
    let cf = 0.0;
    for (let i = 0; i < 4; i++) {
      const q = quarterTax(-10.0e6, cf, r);
      expect(q.tax).toBe(0.0);
      expect(q.carryforward_used).toBe(0.0);
      expect(q.carryforward_added).toBe(10.0e6);
      cf = q.carryforward_after;
    }
    expect(cf).toBe(40.0e6);
    // Q1 +15M: all of it offset, no tax, 25M left.
    let q = quarterTax(15.0e6, cf, r);
    const want: QuarterTax = {
      pre_tax_income: 15.0e6,
      carryforward_used: 15.0e6,
      tax: 0.0,
      carryforward_added: 0.0,
      carryforward_after: 25.0e6,
    };
    expect(q).toEqual(want);
    cf = q.carryforward_after;
    // Q2 +35M: 25M used, tax on 10M = 2.5M, carryforward gone.
    q = quarterTax(35.0e6, cf, r);
    expect(q.carryforward_used).toBe(25.0e6);
    expect(q.tax).toBe(2.5e6);
    expect(q.carryforward_after).toBe(0.0);
    // Q3 +20M: full tax.
    expect(quarterTax(20.0e6, 0.0, r).tax).toBe(5.0e6);
  });

  it("losses_carry_forward_without_limit", () => {
    // 5.11 (A): no expiry. Ten years of quarterly losses, then one big profit uses all of them.
    const r = 0.3;
    let cf = 0.0;
    for (let i = 0; i < 40; i++) {
      cf = quarterTax(-1.0e6, cf, r).carryforward_after;
    }
    expect(cf).toBe(40.0e6);
    let q = quarterTax(50.0e6, cf, r);
    expect(q.carryforward_used).toBe(40.0e6);
    near(q.tax, 10.0e6 * r);
    // A loss adds to the carryforward and uses none of it.
    q = quarterTax(-5.0e6, 3.0e6, r);
    expect([q.carryforward_used, q.carryforward_after]).toEqual([0.0, 8.0e6]);
  });

  it("accrued_monthly_paid_at_the_close", () => {
    // Three months of 10M at 30%: 3M accrued each month, 9M paid at the close.
    const r = 0.3;
    const book = zeroTax();
    const accruals = [0, 1, 2].map(() => accrueMonth(book, 10.0e6, r));
    for (const a of accruals) {
      near(a, 3.0e6);
    }
    near(book.accrued, 9.0e6);
    const q = closeQuarter(book);
    near(q.tax, 9.0e6);
    near(
      accruals.reduce((x, y) => x + y, 0),
      q.tax,
    );
    expect(book, "the quarter resets").toEqual(zeroTax());
  });

  it("accrual_reads_the_carryforward_and_reverses_on_a_loss_month", () => {
    const r = 0.3;
    // 15M of carryforward: months of 10M accrue 0, then 1.5M, then 3M (cumulative, D227).
    let book = zeroTax({ carryforward: 15.0e6 });
    let a = [0, 1, 2].map(() => accrueMonth(book, 10.0e6, r));
    near(a[0] as number, 0.0);
    near(a[1] as number, 1.5e6);
    near(a[2] as number, 3.0e6);
    let q = closeQuarter(book);
    near(q.tax, 4.5e6);
    expect(book.carryforward).toBe(0.0);
    // A loss month after a profit month reverses its accrual; the quarter net profit is taxed and
    // creates no carryforward.
    book = zeroTax();
    a = [10.0e6, -10.0e6, 5.0e6].map((p) => accrueMonth(book, p, r));
    near(a[0] as number, 3.0e6);
    near(a[1] as number, -3.0e6);
    near(a[2] as number, 1.5e6);
    q = closeQuarter(book);
    near(q.tax, 1.5e6);
    expect(book.carryforward).toBe(0.0);
    // A loss quarter adds its net loss at the close, not month by month.
    book = zeroTax();
    for (const p of [-4.0e6, 1.0e6, -2.0e6]) {
      expect(accrueMonth(book, p, r)).toBe(0.0);
    }
    q = closeQuarter(book);
    expect([q.tax, q.carryforward_added]).toEqual([0.0, 5.0e6]);
    expect(book.carryforward).toBe(5.0e6);
  });

  it("the_close_pays_exactly_what_was_accrued", () => {
    // The close takes no rate: it pays the tax book accrual, the one tax payable the balance sheet
    // reads, and never recomputes it. Accruals made at 30% then 20% (a rate change in the quarter)
    // pay what the months booked: the cumulative accrual at the last month 20%.
    const book = zeroTax();
    const a = [
      accrueMonth(book, 10.0e6, 0.3),
      accrueMonth(book, 10.0e6, 0.3),
      accrueMonth(book, 10.0e6, 0.2),
    ];
    near(book.accrued, 6.0e6);
    // Books::default() with the tax book set; the tax book is copied as Rust Copy would.
    const books: Books = { cash: 0, asset_book: 0, line_drawn: 0, tax: { ...book } };
    expect(booksTaxPayable(books)).toBe(book.accrued);
    const q = closeQuarter(book);
    expect(q.tax).toBe(booksTaxPayable(books));
    near(
      a.reduce((x, y) => x + y, 0),
      q.tax,
    );
    expect(book.accrued).toBe(0.0);
  });
});
