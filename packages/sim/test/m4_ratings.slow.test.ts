// Port of crates/sim/tests/m4_ratings.rs: build-plan M4.5 against the live engine: implied
// rating, adjustments, sovereign ceiling and the one or two notch move at the 01:00 release-day
// review (spec 5.12, 3.6.3, 3.6.4).
//
// Done line: starting ratings match the run rate. The engine computes each company's starting
// rating at load from its own load month (7.1, D121); the expected rating is finance-start.csv,
// the independent Python implementation of 5.12 and 7.1 (export_finance_fixtures.py) on
// validate.py's run rate and company-start.csv.
//
// Expects:
//   ../src/lib.ts            simNew, simStep, simNow, simWorld
//   ../src/finance/rating.ts ratingParse(s) -> Rating | null, ratingNotch(r), ratingFromNotch(i),
//                               ratingLabel(r)
//   ../src/time/calendar.ts  simDateYmd, dateTimeAt, dateTimeNext
// Rating's derived Ord (better is smaller) is the notch order: max(a, b) is the larger notch.
//
// Changed from the Rust: the seeds (1, 2, 3) feed the new generator (D951). The starting-rating
// test reads load state only. The review test checks each move against the implied rating the
// engine computed in the same review, so it holds for any draws; "some ratings move" is a
// statistical claim over 8 reviews x 651 companies. The println lines are dropped.
import { describe, expect, it } from "vitest";
import { ratingFromNotch, ratingLabel, ratingNotch, ratingParse } from "../src/finance/rating.ts";
import { simNew, simNow, simStep, simWorld } from "../src/lib.ts";
import { dateTimeAt, dateTimeNext, simDateYmd } from "../src/time/calendar.ts";
import { cloneWorld, isFrozen, statusOf } from "./common/finance_live.ts";
import { data, unwrap } from "./common/index.ts";
import { company, runTo } from "./common/ops.ts";
import { financeStart } from "./finance_common/index.ts";

describe("m4 ratings", () => {
  it("starting_ratings_match_the_run_rate_for_all_651", () => {
    const d = data();
    const sim = unwrap(simNew(structuredClone(d), 1), "Sim::new");
    const w = simWorld(sim);
    const rows = financeStart();
    expect(rows.length).toBe(651);
    const off: string[] = [];
    for (const row of rows) {
      const c = w.companies[company(w, row.id())];
      if (c === undefined) throw new Error(`no company ${row.id()}`);
      // The engine's own implied rating from its run rate (7.1, 5.12; D121) against the
      // independent Python export, and against company-start.csv's start_rating, which load
      // reads as the starting rating (D241, D132).
      const computed = c.finance.implied.implied;
      const fixture = row.rating("start_rating");
      const start = d.company_start.rows.find((s) => s.id === row.id());
      if (start === undefined) throw new Error(`no company-start row ${row.id()}`);
      const csv = ratingParse(start.start_rating);
      if (csv === null) throw new Error(`not a rating: ${start.start_rating}`);
      if (computed !== fixture || computed !== csv) {
        off.push(
          `${row.id()} engine ${ratingLabel(computed)} fixture ${ratingLabel(fixture)} company-start ${ratingLabel(csv)} (leverage ${ratingLabel(c.finance.implied.leverage)} vs ${ratingLabel(row.rating("leverage_rating"))})`,
        );
      }
      // The rating is the implied one, no smoothing (7.1).
      expect(c.finance.rating, row.id()).toBe(csv);
    }
    expect(off, `${off.length} starting ratings differ`).toEqual([]);
  });

  it("ceiling_and_review_moves_on_release_day", { timeout: 600_000 }, () => {
    const sim = unwrap(simNew(data(), 2), "Sim::new");
    // Every rating sits at or below its sovereign + 1 ceiling (5.12).
    {
      const w = simWorld(sim);
      for (const c of w.companies) {
        const sov = (w.countries[c.hq_country] as NonNullable<(typeof w.countries)[number]>).sovereign_rating;
        expect(
          ratingNotch(c.finance.rating) >= ratingNotch(sov) - 1,
          `${c.key} ${ratingLabel(c.finance.rating)} above ${ratingLabel(sov)} + 1`,
        ).toBe(true);
      }
    }
    // Walk the first two years of release-day reviews. Each review moves a rating toward the
    // implied rating it computed, by 1 notch, or 2 when 3 or more notches away (3.6.4), and never
    // past it.
    const moves = [0, 0, 0];
    for (const year of [2020, 2021]) {
      for (const month of [1, 4, 7, 10]) {
        const review = dateTimeAt(simDateYmd(year, month, 2), 1);
        while (dateTimeNext(simNow(sim)) < review) simStep(sim);
        const before = cloneWorld(sim);
        simStep(sim);
        const w = simWorld(sim);
        w.companies.forEach((c, id) => {
          const b = before.companies[id];
          if (b === undefined) throw new Error(`no company ${id}`);
          if (isFrozen(statusOf(b))) {
            expect(c.finance.rating, `${c.key} frozen`).toBe(b.finance.rating);
            return;
          }
          const from = ratingNotch(b.finance.rating);
          const implied = ratingNotch(c.finance.implied.implied);
          const gap = implied - from;
          const step = Math.abs(gap) >= 3 ? 2 : Math.min(Math.abs(gap), 1);
          const want = from + Math.sign(gap) * step;
          expect(
            ratingNotch(c.finance.rating),
            `${c.key} from ${ratingLabel(b.finance.rating)} toward ${ratingLabel(c.finance.implied.implied)} on ${year}-${month}-02`,
          ).toBe(want);
          expect(c.finance.last_review_notches).toBe(from - want);
          moves[step] = (moves[step] as number) + 1;
          // The implied rating is the leverage rating plus the adjustments, clamped, capped at
          // the sovereign + 1 ceiling (5.12).
          const i = c.finance.implied;
          const adjusted = ratingFromNotch(
            ratingNotch(i.leverage) - (i.cover_notches + i.size_notches + i.sector_notches),
          );
          expect(i.adjusted, c.key).toBe(adjusted);
          const sov = (w.countries[c.hq_country] as NonNullable<(typeof w.countries)[number]>)
            .sovereign_rating;
          expect(i.ceiling).toBe(ratingFromNotch(ratingNotch(sov) - 1));
          // Rust Rating::max: the worse of the two is the larger notch.
          const worse = ratingNotch(i.adjusted) >= ratingNotch(i.ceiling) ? i.adjusted : i.ceiling;
          expect(i.implied, c.key).toBe(worse);
        });
      }
    }
    expect((moves[1] as number) > 0, "some ratings move").toBe(true);
  });

  it("first_review_reads_the_synthetic_history", () => {
    // On 2 January 2020 the trailing four quarters are the synthetic 2019 history, the run rate
    // the starting rating was read from (7.1, 4.4); with the starting balances unchanged the
    // leverage rating is the starting one.
    const sim = unwrap(simNew(data(), 3), "Sim::new");
    const atLoad = simWorld(sim).companies.map((c) => structuredClone(c.finance.implied));
    runTo(sim, simDateYmd(2020, 1, 3));
    simWorld(sim).companies.forEach((c, i) => {
      const load = atLoad[i];
      expect(c.finance.implied.leverage, c.key).toBe(load?.leverage);
      expect(c.finance.implied.size_notches, c.key).toBe(load?.size_notches);
      expect(c.finance.implied.ceiling, c.key).toBe(load?.ceiling);
    });
  });
});
