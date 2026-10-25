// Port of crates/sim/tests/spec_5_18.rs: spec 5.18 (Pdoomberg Wire headlines) and 8 (News feed,
// Quarterly recap), build-plan M6.5: one test per headline type, the release picks, the daily
// post, the tipped lab, and the recap's world and company pages. Texts are checked against 5.18's
// wording where it gives one.
//
// Expects (Rust methods are free functions named type + method, camelCased):
//   ../../src/news.ts           the headline constructors as free functions: bankruptcy(date,
//                               industry, company, name), phaseChange(date, industry,
//                               industry_name, from, to), result(date, industry, company, name,
//                               surprise) -> Headline | null, removal, ratingChange(date, ind,
//                               co, name, from, to) -> Headline | null, raise(date, ind, co,
//                               name, method, net_usd | null), failedRaise, chatbotRush(date,
//                               event, ind, lab_name, n), fixedEvent(date, id, name, n),
//                               startupLaunch(date, ind, co, name, industry_name, place),
//                               hotCluster(date, ind, industry_name, place, n), ipoVote(date,
//                               ind, co, name, exchange, passed, [yes, no]), listing(date, ind,
//                               co, name, exchange, price, net_usd), chatbot(date, ind,
//                               company | null, name); topResults(results) -> [beats, misses];
//                               tippedLabCandidates(labs) -> CompanyId[]; drawTippedLab(candidates,
//                               draws) -> CompanyId | null; headlineByline(h);
//                               headlineConfidence(h) -> ConfidenceHeadline | null
//                               (a { kind } union: Beat, BigBeat, Miss, BigMiss, Bankruptcy and
//                               { kind: "RatingChange", notches });
//                               newsWireDefault(), newsWireQueue(wire, h), newsWirePostDay(wire, date)
//                               -> Headline[], newsWireSince(wire, date) -> Iterable<Headline>
//   ../../src/recap.ts          expectedResultNew(company, projection, consensus), worldRecap(q,
//                               phase, g_t, industries[], expected[]), companyRecap(q, expected,
//                               elapsed, confidence_factor, exchange_confidence | null, outlook),
//                               ratingWatch(current, implied) -> RatingWatch | null
//   ../../src/world/log.ts      chunkLogLen (ported)
//
// Changed from the Rust: RngStreams::new(8) is the new generator (D951): the tipped-lab draw
// asserts determinism for one seed (and membership in the candidates) instead of a Rust value.
// NoNoise's draw (u = 0.5 -> index 2 of 5, candidate CompanyId 14) is a rule of NoNoise, not of the
// generator, and stays exact.
import { describe, expect, it } from "vitest";
import * as news from "../src/news.ts";
import { companyRecap, expectedResultNew, ratingWatch, worldRecap } from "../src/recap.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import type { CompanyId, IndustryId } from "../src/types/ids.ts";
import { BYLINE } from "../src/types/state/news.ts";
import type { Outlook } from "../src/types/state/recap.ts";
import { chunkLogLen } from "../src/world/log.ts";
import { newNoNoise, newRng } from "./common/rng.ts";

const D = simDateYmd(2021, 4, 9);
const IND = 3 as IndustryId;
const CO = 42 as CompanyId;

describe("spec 5.18 news", () => {
  it("every_headline_has_the_pdoomberg_wire_byline", () => {
    const h = news.bankruptcy(D, IND, CO, "Acme");
    expect(news.headlineByline(h)).toBe("Pdoomberg Wire");
    expect(BYLINE).toBe("Pdoomberg Wire");
    expect([h.date, h.industry, h.company]).toEqual([D, IND, CO]);
  });

  it("phase_change", () => {
    const h = news.phaseChange(D, IND, "Retail", "Normal", "Bust");
    expect(h.text).toBe("Retail moves from Normal to Bust");
    expect(h.company).toBeNull();
    expect(h.kind.kind).toBe("PhaseChange");
  });

  it("results_beats_and_misses", () => {
    let h = news.result(D, IND, CO, "Acme", 0.12);
    expect(h?.text).toBe("Acme beats consensus by 12%");
    expect(h && news.headlineConfidence(h)).toEqual({ kind: "Beat" });
    h = news.result(D, IND, CO, "Acme", 0.35);
    expect(h?.text).toBe("Acme posts a big beat, 35% over consensus");
    expect(h && news.headlineConfidence(h)).toEqual({ kind: "BigBeat" });
    h = news.result(D, IND, CO, "Acme", -0.08);
    expect(h?.text).toBe("Acme misses consensus by 8%");
    h = news.result(D, IND, CO, "Acme", -0.5);
    expect(h?.text).toBe("Acme posts a big miss, 50% under consensus");
    expect(h && news.headlineConfidence(h)).toEqual({ kind: "BigMiss" });
    // Inside +-5% there is no story.
    expect(news.result(D, IND, CO, "Acme", 0.05)).toBeNull();
  });

  it("release_posts_the_five_largest_beats_and_misses", () => {
    const r: [CompanyId, number][] = [0.3, 0.06, 0.5, 0.1, 0.1, 0.2, 0.04, -0.06, -0.3, -0.2, -0.04].map(
      (s, i) => [i as CompanyId, s],
    );
    const [beats, misses] = news.topResults(r);
    const ids = (v: [CompanyId, number][]): number[] => v.map(([c]) => c);
    // 0.5, 0.30, 0.2, then the 0.1 tie to the lower id (3 before 4).
    expect(ids(beats)).toEqual([2, 0, 5, 3, 4]);
    // Worst first; -4% is not a miss.
    expect(ids(misses)).toEqual([8, 9, 7]);
  });

  it("bankruptcy_and_removal", () => {
    const b = news.bankruptcy(D, IND, CO, "Acme");
    expect(b.text).toBe("Acme goes bankrupt; shareholders wiped out");
    expect(news.headlineConfidence(b)).toEqual({ kind: "Bankruptcy" });
    const r = news.removal(D, IND, CO, "Acme");
    expect(r.text).toBe("Acme is wound up and removed after its bankruptcy");
    expect(news.headlineConfidence(r)).toBeNull();
  });

  it("rating_changes_of_two_notches_or_more", () => {
    expect(news.ratingChange(D, IND, CO, "Acme", "Bbb", "BbbMinus")).toBeNull();
    let h = news.ratingChange(D, IND, CO, "Acme", "Bbb", "BbMinus");
    expect(h?.text).toBe("Acme downgraded 4 notches to BB-, from BBB");
    expect(h && news.headlineConfidence(h)).toEqual({ kind: "RatingChange", notches: -4 });
    h = news.ratingChange(D, IND, CO, "Acme", "A", "AaMinus");
    expect(h?.text).toBe("Acme upgraded 2 notches to AA-, from A");
  });

  it("raises_and_failed_raises", () => {
    let h = news.raise(D, IND, CO, "Acme", "ShareIssue", 58.2e6);
    expect(h.text).toBe("Acme raises $58.2M in a share issue");
    h = news.raise(D, IND, CO, "Acme", "CreditLine", 60.0e6);
    expect(h.text).toBe("Acme raises $60.0M on its credit line");
    // A company that does not publish: no amount on the wire (D420).
    h = news.raise(D, IND, CO, "Acme", "CreditLine", null);
    expect(h.text).toBe("Acme raises money on its credit line");
    h = news.failedRaise(D, IND, CO, "Acme", "ShareIssue");
    expect(h.text).toBe("Acme fails to sell new shares");
  });

  it("startup_events", () => {
    // F4 has its own line (5.18).
    let h = news.chatbotRush(D, "F4", IND, "Lattice Labs", 5);
    expect(h.text).toBe("Lattice Labs's chatbot sets off a startup rush: 5 new AI labs");
    h = news.fixedEvent(D, "F2", "The crypto and SPAC mania", 3);
    expect(h.text).toBe("The crypto and SPAC mania: 3 new startups");
    // Random: "[Name] launches in [industry] in [city or province]".
    h = news.startupLaunch(D, IND, CO, "Ironbark Software", "Software", "Toronto");
    expect(h.text).toBe("Ironbark Software launches in Software in Toronto");
    // Hot cluster: "[n] startups launch in [industry] in [city]".
    h = news.hotCluster(D, IND, "Drones", "Shenzhen", 3);
    expect(h.text).toBe("3 startups launch in Drones in Shenzhen");
  });

  it("ipo_votes_and_listings", () => {
    let h = news.ipoVote(D, IND, CO, "Acme", "ATX", true, [4, 2]);
    expect(h.text).toBe("Acme board votes to list on ATX, 4 to 2");
    h = news.ipoVote(D, IND, CO, "Acme", "ATX", false, [1, 4]);
    expect(h.text).toBe("Acme board votes against listing, 4 to 1");
    h = news.listing(D, IND, CO, "Acme", "ATX", 24.0, 105.3e6);
    expect(h.text).toBe("Acme lists on ATX at $24, raising $105.3M");
  });

  it("chatbot_and_the_tipped_lab", () => {
    const h = news.chatbot(D, IND, CO, "Lattice Labs");
    expect(h.text).toBe("Lattice Labs launches its chatbot");
    // The five largest AI labs by starting revenue, ties to the lower id (D281).
    const labs: [CompanyId, number][] = [
      [10 as CompanyId, 300.0],
      [11 as CompanyId, 900.0],
      [12 as CompanyId, 50.0],
      [13 as CompanyId, 300.0],
      [14 as CompanyId, 400.0],
      [15 as CompanyId, 700.0],
    ];
    const c = news.tippedLabCandidates(labs);
    expect(c).toEqual([11, 15, 14, 10, 13]);
    expect(news.drawTippedLab(c, newNoNoise())).toBe(14);
    // The same seed draws the same lab, and it is one of the candidates.
    const a = news.drawTippedLab(c, newRng(8));
    expect(a).toBe(news.drawTippedLab(c, newRng(8)));
    expect(c).toContain(a);
    expect(news.drawTippedLab([], newNoNoise())).toBeNull();
  });

  it("the_wire_posts_the_days_queue", () => {
    const w = news.newsWireDefault();
    const later = simDateYmd(2021, 4, 10);
    news.newsWireQueue(w, news.bankruptcy(D, IND, CO, "A"));
    news.newsWireQueue(w, news.removal(later, IND, CO, "B"));
    news.newsWireQueue(w, news.bankruptcy(D, IND, 7 as CompanyId, "C"));
    const posted = news.newsWirePostDay(w, D);
    expect(posted.map((h) => h.text)).toEqual([
      "A goes bankrupt; shareholders wiped out",
      "C goes bankrupt; shareholders wiped out",
    ]);
    expect(w.queued.length).toBe(1);
    expect(news.newsWirePostDay(w, later).length).toBe(1);
    expect(Array.from(news.newsWireSince(w, later)).length).toBe(1);
    expect(chunkLogLen(w.feed)).toBe(3);
  });
});

describe("spec 8 recap", () => {
  it("recap_world_page", () => {
    const q = { year: 2021, q: 2 } as const;
    const ind: [IndustryId, "Boom" | "Normal" | "Glut" | "Bust"][] = [
      [2 as IndustryId, "Bust"],
      [0 as IndustryId, "Normal"],
      [1 as IndustryId, "Boom"],
      [3 as IndustryId, "Normal"],
    ];
    const ex = [
      [110.0, 100.0],
      [80.0, 100.0],
      [100.0, 100.0],
      [130.0, 100.0],
    ].map(([p, c], i) => expectedResultNew(i as CompanyId, p as number, c as number));
    const r = worldRecap(q, "Expansion", 0.01, ind, ex);
    expect(r.industries_by_label).toEqual([
      ["Boom", [1]],
      ["Normal", [0, 3]],
      ["Glut", []],
      ["Bust", [2]],
    ]);
    // Expected beats by projection against consensus: +30%, then +10%; the miss -20%.
    expect(r.expected_beats.map((e) => e.company)).toEqual([3, 0]);
    expect(r.expected_misses.length).toBe(1);
    expect(Math.abs((r.expected_misses[0]?.expected_surprise ?? 0) + 0.2) < 1e-12).toBe(true);
  });

  it("recap_company_page", () => {
    // At the recap (about 0.92 of the quarter elapsed) the observer's 5.16 range is 0.30 x (1 -
    // 0.6 x 0.92) x (1 - 24 / 50) x 0.7 x 2 = 9.8% around the consensus.
    const e = expectedResultNew(CO, 12.0e6, 10.0e6);
    const outlook: Outlook = {
      label: "Normal",
      loss_quarters: 0,
      rating: "Bbb",
      rating_watch: ratingWatch("Bbb", "A"),
    };
    const r = companyRecap({ year: 2021, q: 2 }, e, 0.92, 1.04, 5.0, outlook);
    const w = 0.3 * (1.0 - 0.6 * 0.92) * (1.0 - 24.0 / 50.0) * 0.7 * 2.0;
    expect(Math.abs(r.range[0] - 10.0e6 * (1.0 - w)) < 1e-3).toBe(true);
    expect(Math.abs(r.range[1] - 10.0e6 * (1.0 + w)) < 1e-3).toBe(true);
    // Expected s = +20%: reaction 1.5 x clamp(0.5 x 0.2, +-25%) = +15%.
    expect(Math.abs(r.expected.expected_surprise - 0.2) < 1e-12).toBe(true);
    expect(Math.abs(r.expected_reaction - 0.15) < 1e-12).toBe(true);
    expect(r.outlook.rating_watch).toBe("Upgrade");
    expect(ratingWatch("A", "Bbb")).toBe("Downgrade");
    expect(ratingWatch("A", "A")).toBeNull();
  });
});
