// Port of crates/sim/tests/m6_news.rs: build-plan M6.5 on the live engine: the Pdoomberg Wire and
// the recap data (spec 5.18, 8, 21.6.2). Done line: every headline type of 5.18 posts in a test
// run. The three years 2020 to 2022 post every type but the boom's (the chatbot and F4's rush,
// checked in m6_full_year) and the 6.6 raises, which are parked: no industry is cash_burning, so
// none posts with the real data.
//
// Each headline reads the state it reports: a release's five largest beats and misses among the
// quoted companies (5.15 tags), a rating move of 2+ notches at the review, each bankruptcy and
// removal on its day, each startup, IPO vote and listing with 5.18's wording. Every one carries
// the neutral Pdoomberg Wire byline and posts at the next 00:00 daily job (D158).
//
// Expects:
//   ../../src/lib.ts              simNew, simStep, simNow, simWorld, simViews
//   ../../src/news.ts       headlineByline(h) -> string      [Headline::byline]
//   ../../src/finance/rating.ts   notchesBetween(from, to) -> number
//   ../../src/views/estimate.ts   showsEstimates(world, company) -> boolean
//   ../../src/views/recap.ts      recapViewLatest(view) -> RecapQuarter | null   [RecapView::latest]
//   ../../src/views/news.ts       newsViewGetNews(view, since, filter | null) -> Headline[]
//                                 [NewsView::get_news]
//
// Changed from the Rust: the seed (41) seeds the new generator (D951), so which headlines post
// differs; the test asserts that every type posts across three years, which is the done line, not
// a count from one seed. If a seed misses a type (a rating change of 2+ notches is the rarest)
// move the seed rather than loosen the check. BYLINE is the types/state/news.ts constant.
import { describe, expect, it } from "vitest";
import { notchesBetween } from "../../src/finance/rating.ts";
import { simNew, simNow, simStep, simViews, simWorld } from "../../src/lib.ts";
import { headlineByline } from "../../src/news.ts";
import {
  dateTimeDate,
  dateTimeHour,
  dateTimeMidnight,
  simDateQuarter,
  simDateYmd,
} from "../../src/time/calendar.ts";
import { isRecapDay } from "../../src/time/quarter.ts";
import type { SimDate } from "../../src/types/calendar.ts";
import type { CompanyId } from "../../src/types/ids.ts";
import { BYLINE, type Headline, type HeadlineKind } from "../../src/types/state/news.ts";
import type { Notice } from "../../src/types/world.ts";
import { showsEstimates } from "../../src/views/estimate.ts";
import { newsViewGetNews } from "../../src/views/news.ts";
import { recapViewLatest } from "../../src/views/recap.ts";
import { chunkLogRows } from "../../src/world/log.ts";
import { figureBand, figureExact, isFrozen, sameDate } from "./common/births.ts";
import { data, rowOf, unwrap } from "./common/index.ts";

describe("m6 news", () => {
  it("every_headline_type_posts_and_reports_its_event", () => {
    const sim = unwrap(simNew(data(), 41), "Sim::new");
    const end = dateTimeMidnight(simDateYmd(2023, 1, 10));
    const notices: Notice[] = [];
    const recaps: SimDate[] = [];
    while (simNow(sim) < end) {
      for (const n of simStep(sim)) {
        if (
          n.kind === "StartupEvent" ||
          n.kind === "CompanyBorn" ||
          n.kind === "IpoVote" ||
          n.kind === "CompanyListed"
        ) {
          notices.push(n);
        }
      }
      const t = simNow(sim);
      if (dateTimeHour(t) === 0 && isRecapDay(dateTimeDate(t))) {
        recaps.push(dateTimeDate(t));
        const w = simWorld(sim);
        const r = w.recaps[w.recaps.length - 1];
        if (r === undefined) throw new Error("the recap is built on its day");
        expect(r.world.quarter).toEqual(simDateQuarter(dateTimeDate(t)));
        const pages = w.companies.filter((c) => !isFrozen(c)).length;
        expect(r.companies.length).toBe(pages);
        expect(r.world.expected_beats.length <= 5 && r.world.expected_misses.length <= 5).toBe(true);
        for (const b of r.world.expected_beats) {
          const s = rowOf(w.market.stocks, b.company);
          expect(s.quoted).toBe(true);
          expect([b.projection, b.consensus]).toEqual([s.projection_ni, s.consensus_ni]);
          expect(b.expected_surprise).toBeGreaterThan(0.0);
        }
        // The view copies the recap; a company that does not publish shows bands (D420).
        const v = recapViewLatest(simViews(sim).recap.data);
        if (v === null) throw new Error("the view holds the latest recap");
        expect(v.world.quarter).toEqual(r.world.quarter);
        expect(v.companies.length).toBe(r.companies.length);
        v.companies.forEach((p, k) => {
          const tr = r.companies[k];
          if (tr === undefined) throw new Error("page count differs");
          expect(p.company).toBe(tr.company);
          const estimated = showsEstimates(w, tr.company);
          expect(p.estimated).toBe(estimated);
          if (estimated) {
            const b = figureBand(p.expected.consensus);
            if (b === null) throw new Error("estimated consensus is a band");
            expect(b.low < tr.expected.consensus && tr.expected.consensus < b.high).toBe(true);
            expect(b.estimate).not.toBe(tr.expected.consensus);
          } else {
            expect(figureExact(p.range[0])).toBe(tr.range[0]);
            expect(figureExact(p.range[1])).toBe(tr.range[1]);
            expect(figureExact(p.expected.projection)).toBe(tr.expected.projection);
          }
        });
      }
    }
    expect(recaps.length, `a recap each pre-quarter-end week: ${JSON.stringify(recaps)}`).toBe(12);
    const w = simWorld(sim);
    const feed: Headline[] = chunkLogRows(w.news.feed);
    const has = (f: (k: HeadlineKind) => boolean): boolean => feed.some((h) => f(h.kind));
    for (const h of feed) expect(headlineByline(h)).toBe(BYLINE);
    expect(BYLINE).toBe("Pdoomberg Wire");
    expect(has((k) => k.kind === "PhaseChange")).toBe(true);
    expect(has((k) => k.kind === "Result" && (k.tag === "Beat" || k.tag === "BigBeat"))).toBe(true);
    expect(has((k) => k.kind === "Result" && (k.tag === "Miss" || k.tag === "BigMiss"))).toBe(true);
    expect(has((k) => k.kind === "Bankruptcy")).toBe(true);
    expect(has((k) => k.kind === "Removal")).toBe(true);
    expect(has((k) => k.kind === "RatingChange")).toBe(true);
    expect(has((k) => k.kind === "FixedStartupEvent")).toBe(true);
    expect(has((k) => k.kind === "StartupLaunch")).toBe(true);
    expect(has((k) => k.kind === "HotCluster")).toBe(true);
    expect(has((k) => k.kind === "IpoVote" && k.passed)).toBe(true);
    expect(has((k) => k.kind === "IpoVote" && !k.passed)).toBe(true);
    expect(has((k) => k.kind === "Listing")).toBe(true);
    expect(
      has((k) => k.kind === "Raise" || k.kind === "FailedRaise"),
      "6.6 is parked: no raise with the real data",
    ).toBe(false);

    // Each headline reports its event (5.18 texts).
    const name = (c: CompanyId): string => rowOf(w.companies, c).name;
    for (const h of feed) {
      const k = h.kind;
      if (k.kind === "Bankruptcy") {
        const c = h.company as CompanyId;
        expect(sameDate(rowOf(w.companies, c).finance.bankrupt_on, h.date)).toBe(true);
        expect(h.text).toBe(`${name(c)} goes bankrupt; shareholders wiped out`);
      } else if (k.kind === "Removal") {
        const c = h.company as CompanyId;
        expect(sameDate(rowOf(w.companies, c).finance.removed_on, h.date)).toBe(true);
      } else if (k.kind === "RatingChange") {
        expect(Math.abs(notchesBetween(k.from, k.to)), h.text).toBeGreaterThanOrEqual(2);
      } else if (k.kind === "Result") {
        // Released quarters only: the 2nd of a quarter's first month, 01:00.
        expect(h.date.day).toBe(2);
        expect(Math.abs(k.surprise)).toBeGreaterThan(0.05);
        const c = h.company as CompanyId;
        expect(rowOf(w.market.stocks, c).exchange !== null, "listed only (D157)").toBe(true);
      } else if (k.kind === "StartupLaunch") {
        const co = rowOf(w.companies, h.company as CompanyId);
        const ind = rowOf(w.industries, co.industry).name;
        expect(h.text.startsWith(`${co.name} launches in ${ind} in `), h.text).toBe(true);
      } else if (k.kind === "IpoVote") {
        const c = h.company as CompanyId;
        const want = k.passed
          ? `${name(c)} board votes to list on ${k.exchange}, ${k.yes} to ${k.no}`
          : `${name(c)} board votes against listing, ${k.no} to ${k.yes}`;
        expect(h.text).toBe(want);
      } else if (k.kind === "Listing") {
        const c = h.company as CompanyId;
        const s = rowOf(w.market.stocks, c);
        expect(sameDate(s.listed_on, h.date)).toBe(true);
        expect(k.price).toBe(s.ipo_price);
        const code = rowOf(w.zones, s.exchange as NonNullable<typeof s.exchange>).exchange_code;
        expect(k.exchange).toBe(code);
        expect(h.text.startsWith(`${name(c)} lists on ${code} at $`)).toBe(true);
      }
    }
    // Each release posts at most the five largest beats and five largest misses (5.18).
    for (const m of [4, 7, 10]) {
      const d = simDateYmd(2021, m, 2);
      const n = feed.filter((h) => sameDate(h.date, d) && h.kind.kind === "Result").length;
      expect(n, `${JSON.stringify(d)}: ${n} result headlines`).toBeLessThanOrEqual(10);
    }
    // Notices for 9.3: startup_event, company_born, ipo_vote, company_listed.
    for (const want of ["StartupEvent", "CompanyBorn", "IpoVote", "CompanyListed"]) {
      expect(
        notices.some((n) => n.kind === want),
        want,
      ).toBe(true);
    }
    // v_news (9.2 get_news): every posted headline, oldest first.
    const v = simViews(sim).news.data;
    expect(newsViewGetNews(v, simDateYmd(2020, 1, 1), null).length).toBe(feed.length);
  });
});
