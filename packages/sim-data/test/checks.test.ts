// Port of crates/sim-data/tests/checks.rs: each ported validate.py check catches a broken value
// and names its file, line and field (build-plan M0.4).
//
// Expects:
//   "@tc20ff/sim-data": check, RATING_LABELS, ratingFactorOfLabel (rating_factor_of_label,
//   returns number | null), type WorldData whose tables keep the Rust snake_case names
//   ({ file, rows, lines }); provinces: Table[] (one per superregion file); row fields snake_case.
//   "@tc20ff/sim-data/node": loadWorld, defaultDataDir (via ./helpers.ts)
import { RATING_LABELS, ratingFactorOfLabel } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import { expectError, world } from "./helpers.ts";

/** Row i of a table: noUncheckedIndexedAccess makes rows[i] possibly undefined. */
function at<T>(a: readonly T[], i: number): T {
  const v = a[i];
  if (v === undefined) throw new Error(`no row ${i}`);
  return v;
}

describe("sim-data checks", () => {
  it("unknown_key_city_province", () => {
    expectError(
      (w) => at(w.key_cities.rows, 0).province_ids.push("XX-9999"),
      "key-cities.csv",
      2,
      "province_ids",
    );
  });

  it("unknown_specialty", () => {
    expectError(
      (w) => at(w.key_cities.rows, 3).specialties.push("Alchemy"),
      "key-cities.csv",
      5,
      "specialties",
    );
  });

  it("hub_province_outside_zone", () => {
    // Move zone 1 hub to zone 2 hub province: wrong key city and wrong zone.
    expectError(
      (w) => {
        at(w.financial_zones.rows, 0).hub_province = at(w.financial_zones.rows, 1).hub_province;
      },
      "financial-zones.csv",
      2,
      "hub_province",
    );
  });

  it("unknown_zone_of_country", () => {
    expectError(
      (w) => {
        at(w.country_economy.rows, 2).financial_zone = "ZZ";
      },
      "country-economy.csv",
      4,
      "financial_zone",
    );
  });

  it("industry_ranges", () => {
    expectError(
      (w) => {
        at(w.industries.rows, 1).asset_decay = 0.2;
      },
      "industries.csv",
      3,
      "asset_decay",
    );
    expectError(
      (w) => {
        at(w.industries.rows, 1).crash_drop = 1.0;
      },
      "industries.csv",
      3,
      "crash_drop",
    );
  });

  it("wealth_index_range", () => {
    expectError(
      (w) => {
        at(w.countries.rows, 0).wealth_index = 100;
      },
      "countries.csv",
      2,
      "wealth_index",
    );
  });

  it("company_start_balance_identity", () => {
    expectError(
      (w) => {
        at(w.company_start.rows, 0).cash_usd += 10.0;
      },
      "company-start.csv",
      2,
      "book_equity_usd",
    );
    expectError(
      (w) => {
        at(w.company_start.rows, 1).open_price = 250.0;
      },
      "company-start.csv",
      3,
      "open_price",
    );
  });

  it("company_start_lines_within_their_limit", () => {
    // D15: CO-0002 starts at A with its line sized to 0.5 x asset book x 0.65 (BBB, its rating
    // with EBITDA 10% lower, D241); at BB (0.5) the same line is over its limit.
    expectError(
      (w) => {
        at(w.company_start.rows, 1).start_rating = "BB";
      },
      "company-start.csv",
      3,
      "credit_drawn_usd",
    );
    // D15: a line above the 7.1 line (asset book - book value + min_cash, $73.7M).
    expectError(
      (w) => {
        const r = at(w.company_start.rows, 1);
        r.credit_drawn_usd += 30.0e6;
        r.book_equity_usd -= 30.0e6;
      },
      "company-start.csv",
      3,
      "credit_drawn_usd",
    );
    // D15 equity rule: the book value of CO-0002 is below its asset book, so it holds exactly
    // min_cash ($16.5M, 5% of $330M); $1M more cash (and equity, so the sheet still balances)
    // is caught.
    expectError(
      (w) => {
        const r = at(w.company_start.rows, 1);
        r.cash_usd += 1.0e6;
        r.book_equity_usd += 1.0e6;
      },
      "company-start.csv",
      3,
      "credit_drawn_usd",
    );
    // D16: CO-0007 draws its line; rated CCC it may not.
    expectError(
      (w) => {
        at(w.company_start.rows, 6).start_rating = "CCC";
      },
      "company-start.csv",
      8,
      "start_rating",
    );
    expectError(
      (w) => {
        at(w.company_start.rows, 0).start_rating = "AAA+";
      },
      "company-start.csv",
      2,
      "start_rating",
    );
  });

  it("rating_factors_by_label", () => {
    // Spec 5.12 rating factors; a notch reads its band (D220). The Rust Option<f64> is
    // number | null here.
    const f = ratingFactorOfLabel;
    expect(RATING_LABELS.length).toBe(18);
    expect(f("AAA")).toBe(1.0);
    expect(f("AA-")).toBe(0.9);
    expect(f("BBB+")).toBe(0.65);
    expect(f("BB-")).toBe(0.5);
    expect(f("B+")).toBe(0.3);
    expect(f("CCC")).toBe(0.0);
    expect(f("CC")).toBe(0.0);
    expect(f("C")).toBeNull();
    expect(f("CCC+")).toBeNull();
  });

  it("duplicate_province_id", () => {
    const line = at(at(world().provinces, 1).lines, 1);
    expectError(
      (w) => {
        const t = at(w.provinces, 1);
        t.rows[1] = { ...at(t.rows, 1), id: at(t.rows, 0).id };
      },
      "provinces-europe.csv",
      line,
      "id",
    );
  });

  it("startup_event_references", () => {
    expectError(
      (w) => {
        at(at(w.startup_events.rows, 0).startups, 0).industry = "Alchemy";
      },
      "startup-events.csv",
      2,
      "startups",
    );
    expectError(
      (w) => {
        at(at(w.startup_events.rows, 1).startups, 0).regions[0] = "atlantis";
      },
      "startup-events.csv",
      3,
      "startups",
    );
    expectError(
      (w) => {
        at(w.startup_events.rows, 2).date = "2022-13-09";
      },
      "startup-events.csv",
      4,
      "date",
    );
  });

  it("country_culture_must_be_in_its_superregion_file", () => {
    // USA (line 2) moved to a culture the North America file does not have.
    expectError(
      (w) => {
        at(w.country_cultures.rows, 0).culture = "japanese";
      },
      "names/country-cultures.csv",
      2,
      "culture",
    );
  });
});
