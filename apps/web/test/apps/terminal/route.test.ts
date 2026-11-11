// The Pdoomberg app's route grammar, command line and the order ticket's arithmetic (pure).

import { describe, expect, it } from "vitest";
import {
  capOf,
  estimate,
  inputProblem,
  lastCommission,
  limitOf,
  sharesOf,
  warnings,
} from "../../../src/apps/terminal/order.ts";
import {
  companySegment,
  formatTermRoute,
  HOME_ROUTE,
  parseCommand,
  parseTermPage,
  parseTermRoute,
  resolveCompany,
} from "../../../src/apps/terminal/route.ts";

const rows = [
  { id: 3, ticker: "ARDR", public: true },
  { id: 4, ticker: "", public: false },
  { id: 9, ticker: "k.b", public: true },
];

describe("the route codec", () => {
  it("reads null and the empty string as the home page", () => {
    expect(parseTermRoute(null)).toEqual(HOME_ROUTE);
    expect(parseTermRoute("")).toEqual(HOME_ROUTE);
  });

  it("round-trips a page with and without a ticker", () => {
    for (const r of [
      { page: "F2", company: null },
      { page: "F3", company: "ARDR" },
      { page: "F4", company: "~12" },
      { page: "F8", company: null },
      { page: "F10", company: "K.B" },
    ] as const) {
      expect(parseTermRoute(formatTermRoute(r))).toEqual(r);
    }
    expect(formatTermRoute({ page: "F3", company: "ARDR" })).toBe("page/F3/ARDR");
  });

  it("accepts a lower case key, a page name and a lower case ticker", () => {
    expect(parseTermRoute("page/f3/ardr")).toEqual({ page: "F3", company: "ARDR" });
    expect(parseTermRoute("page/account")).toEqual({ page: "F8", company: null });
    expect(parseTermRoute("page/order/ardr")).toEqual({ page: "F4", company: "ARDR" });
  });

  it("refuses what is not this app's route", () => {
    for (const bad of ["race/3", "page", "page/F1", "page/F11", "page/F3/a b", "page/F3/x/y", "F3"]) {
      expect(parseTermRoute(bad)).toBeNull();
    }
  });

  it("knows the pages by key and name", () => {
    expect(parseTermPage("F9")).toBe("F9");
    expect(parseTermPage("scrn")).toBe("F10");
    expect(parseTermPage("nonsense")).toBeNull();
  });
});

describe("companies in a route", () => {
  it("names a company by its ticker, or ~id without one", () => {
    expect(companySegment(rows[0] as never)).toBe("ARDR");
    expect(companySegment(rows[1] as never)).toBe("~4");
  });

  it("resolves a segment against the rows", () => {
    expect(resolveCompany("ARDR", rows)).toBe(3);
    expect(resolveCompany("K.B", rows)).toBe(9);
    expect(resolveCompany("~4", rows)).toBe(4);
    expect(resolveCompany("~5", rows)).toBeNull();
    expect(resolveCompany("NOPE", rows)).toBeNull();
    expect(resolveCompany("ARDR", undefined)).toBeNull();
    expect(resolveCompany(null, rows)).toBeNull();
  });
});

describe("the command line", () => {
  const here = { page: "F2", company: "ARDR" } as const;
  it("takes TICKER Fn and Fn TICKER", () => {
    expect(parseCommand("ardr f3", rows, here)).toEqual({ ok: true, route: { page: "F3", company: "ARDR" } });
    expect(parseCommand("F5 K.B", rows, here)).toEqual({ ok: true, route: { page: "F5", company: "K.B" } });
  });
  it("keeps the company for a page alone, and opens the chart for a ticker alone", () => {
    expect(parseCommand("F6", rows, here)).toEqual({ ok: true, route: { page: "F6", company: "ARDR" } });
    expect(parseCommand("K.B", rows, here)).toEqual({ ok: true, route: { page: "F3", company: "K.B" } });
    expect(parseCommand("account", rows, here)).toEqual({ ok: true, route: { page: "F8", company: "ARDR" } });
  });
  it("says what it could not read", () => {
    expect(parseCommand("", rows, here)).toMatchObject({ ok: false });
    expect(parseCommand("ZZZZ F3", rows, here)).toEqual({ ok: false, message: "No page or ticker ZZZZ." });
    expect(parseCommand("a b c", rows, here)).toMatchObject({ ok: false });
  });
});

describe("the order ticket's arithmetic", () => {
  const base = { side: "Buy", qty: 10, type: "Market", limit: Number.NaN, tif: "Day" } as const;
  it("refuses an unreadable quantity or limit before sending", () => {
    expect(inputProblem(base)).toBeNull();
    expect(inputProblem({ ...base, qty: 0 })).not.toBeNull();
    expect(inputProblem({ ...base, qty: 1.5 })).not.toBeNull();
    expect(inputProblem({ ...base, qty: Number.NaN })).not.toBeNull();
    expect(inputProblem({ ...base, type: "Limit" })).not.toBeNull();
    expect(inputProblem({ ...base, type: "Limit", limit: 12 })).toBeNull();
    expect(limitOf({ ...base, type: "Limit", limit: 12 })).toBe(12);
    expect(limitOf(base)).toBeNull();
  });
  it("works the 5% cap from the market cap and the price", () => {
    expect(sharesOf(1_000_000, 10)).toBe(100_000);
    expect(sharesOf(0, 10)).toBeNull();
    expect(capOf(100_000, 1_200)).toEqual({ cap: 5_000, held: 1_200, room: 3_800 });
    expect(capOf(100_000, 6_000)).toEqual({ cap: 5_000, held: 6_000, room: 0 });
    expect(capOf(null, 0)).toBeNull();
  });
  it("estimates a buy with the commission last charged and a sell net of it", () => {
    expect(estimate("Buy", 10, 20, 1)).toEqual({ price: 20, gross: 200, commission: 1, total: 201 });
    expect(estimate("Sell", 10, 20, 1).total).toBe(199);
    expect(estimate("Buy", 10, 20, null).total).toBe(200);
  });
  it("finds the commission on the latest brokerage fill that charged one", () => {
    const fill = (venue: string, fee: number) => ({ venue, fee }) as never;
    expect(lastCommission([fill("Brokerage", 1), fill("Exchange", 0), fill("Brokerage", 2)])).toBe(2);
    expect(lastCommission([fill("Exchange", 0)])).toBeNull();
  });
  it("warns about the cap, the cash and a sale of what is not held", () => {
    const cap = { cap: 100, held: 90, room: 10 };
    expect(warnings("Buy", 20, estimate("Buy", 20, 5, null), cap, 1_000)[0]).toMatch(/5% holding cap/);
    expect(warnings("Buy", 5, estimate("Buy", 5, 5, null), cap, 10)[0]).toMatch(/free cash/);
    expect(warnings("Sell", 95, null, cap, 0)[0]).toMatch(/long only/);
    expect(warnings("Buy", 5, estimate("Buy", 5, 5, null), cap, 1_000)).toEqual([]);
  });
});
