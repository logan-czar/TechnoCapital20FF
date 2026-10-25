// Port of crates/sim/tests/spec_5_20.rs: spec 5.20 and 5.20.1 (listings), build-plan M6.9: the IPO
// tests, the board vote with trait modifiers and its tie rule, the cap of 3 with its overflow
// order, the listing mechanics (open price, re-split, the 20% float, A = L + E after listing, the
// index divisor) and tickers. Same seed gives the same votes, member by member.
//
// Expects (Rust methods are free functions named type + method, camelCased):
//   ../../src/births/ipo.ts      type IpoTestInputs { listed, status, quarters_since_birth |
//                                null, ttm_revenue, ttm_net_income, revenue_growth, rating,
//                                label }, type Voter { role, traits, is_controller },
//                                applyCap(passed: [CompanyId, ttm_revenue][]) -> [listing,
//                                capped], drawFirstVote(draws) -> Quarter, holdVote(board, label,
//                                confidence, draws) -> VoteResult, listCompany(pre_money, key) ->
//                                Listing { open_price, resplit_shares, new_shares, shares_out,
//                                net, fees }, listingMarketCap(l), listingResplitHolding(l,
//                                holding, old_shares_out), nextVoteAfter(q), passesIpoTests(i),
//                                traitModifier(t), voters(seats: [Seat, traits, is_controller][],
//                                directors: [traits, is_controller][], controller: traits | null)
//                                -> Voter[], yesChance(label, confidence, traits)
//   ../../src/births/names.ts    ticker(name, taken(t) -> boolean), tickerCandidates(name)
//   ../../src/finance/balance.ts booksDefault() [Books::default()], balanceSheet(books, status),
//                                checkIdentity(sheet, status) -> Result<void, string>
//   ../../src/market/index_.ts   exchangeIndexAtLoad, exchangeIndexLevel, exchangeIndexReweight
//                                (Rust market/index.rs; file name to confirm, see spec_5_14)
//   ./common/rng.ts              newRng, newRngStreams, newNoNoise, newScripted, scriptedPush
//
// Changed from the Rust: the seeds (42, 1) seed the new generator (D951). The same-seed test asserts
// determinism (equal results for one seed), the 7 ballots at 47%, and that votes draw from the gen
// stream only (the other four streams' next draws match a fresh set via rngStreamsNextU32; the raw
// draw is 32-bit in TS). draw_first_vote under a seeded stream is a range check; NoNoise's value
// (Q2) is a NoNoise rule and stays exact. The println of the ticker match count is dropped.
import { describe, expect, it } from "vitest";
import {
  applyCap,
  drawFirstVote,
  holdVote,
  type IpoTestInputs,
  listCompany,
  listingMarketCap,
  listingResplitHolding,
  nextVoteAfter,
  passesIpoTests,
  traitModifier,
  type Voter,
  voters,
  yesChance,
} from "../../src/births/ipo.ts";
import { ticker, tickerCandidates } from "../../src/births/names.ts";
import { balanceSheet, booksDefault, checkIdentity } from "../../src/finance/balance.ts";
import { exchangeIndexAtLoad, exchangeIndexLevel, exchangeIndexReweight } from "../../src/market/index_.ts";
import { rngStreamsDraws, rngStreamsNextU32 } from "../../src/rng.ts";
import type { CompanyId } from "../../src/types/ids.ts";
import type { VoterRole } from "../../src/types/state/births.ts";
import type { Seat, Trait } from "../../src/types/state/people.ts";
import { data } from "./common/index.ts";
import { newNoNoise, newRng, newRngStreams, newScripted, scriptedPush } from "./common/rng.ts";

const eligible = (): IpoTestInputs => ({
  listed: false,
  status: "Active",
  quarters_since_birth: null,
  ttm_revenue: 300.0e6,
  ttm_net_income: 10.0e6,
  revenue_growth: 0.0,
  rating: "BMinus",
  label: "Normal",
});

describe("spec 5.20 IPO tests", () => {
  it("ipo_tests_one_condition_at_a_time", () => {
    expect(passesIpoTests(eligible())).toBe(true);
    const fails = (f: (i: IpoTestInputs) => void): boolean => {
      const i = eligible();
      f(i);
      return !passesIpoTests(i);
    };
    // 8 quarters since birth (starting companies, null, pass at once).
    expect(
      fails((i) => {
        i.quarters_since_birth = 7;
      }),
    ).toBe(true);
    expect(
      fails((i) => {
        i.quarters_since_birth = 8;
      }),
    ).toBe(false);
    // TTM revenue at least $75M (D362, the M10.7 tuning of the spec's $250M).
    expect(
      fails((i) => {
        i.ttm_revenue = 74.9e6;
      }),
    ).toBe(true);
    expect(
      fails((i) => {
        i.ttm_revenue = 75.0e6;
      }),
    ).toBe(false);
    // Net income above 0, or 4-quarter growth of at least 20%.
    expect(
      fails((i) => {
        i.ttm_net_income = 0.0;
      }),
    ).toBe(true);
    expect(
      fails((i) => {
        i.ttm_net_income = -5.0e6;
        i.revenue_growth = 0.2;
      }),
    ).toBe(false);
    // Rated B or better (B- counts: rating factor above 0); CCC fails.
    expect(
      fails((i) => {
        i.rating = "Ccc";
      }),
    ).toBe(true);
    // Not Distressed, not already listed, industry not Bust.
    expect(
      fails((i) => {
        i.status = "Distressed";
      }),
    ).toBe(true);
    expect(
      fails((i) => {
        i.listed = true;
      }),
    ).toBe(true);
    expect(
      fails((i) => {
        i.label = "Bust";
      }),
    ).toBe(true);
    expect(
      fails((i) => {
        i.label = "Glut";
      }),
    ).toBe(false);
  });

  it("yes_chance_with_phase_confidence_and_traits", () => {
    // 15% + phase adj + confidence / 10 + trait modifiers, clamped 5% to 95%.
    const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-12;
    expect(close(yesChance("Normal", 0.0, []), 0.15)).toBe(true);
    expect(close(yesChance("Boom", 0.0, []), 0.3)).toBe(true);
    expect(close(yesChance("Glut", 0.0, []), 0.05)).toBe(true);
    expect(close(yesChance("Normal", 50.0, []), 0.2)).toBe(true);
    expect(close(yesChance("Normal", 0.0, ["Ambitious", "Greedy"]), 0.45)).toBe(true);
    expect(yesChance("Normal", -100.0, ["Paranoid"])).toBe(0.05);
    const allIn: Trait[] = ["Ambitious", "Greedy", "Brave", "Visionary", "Narcissist"];
    expect(yesChance("Boom", 100.0, allIn)).toBe(0.95);
    // The 5.20.1 table.
    const table: [Trait, number][] = [
      ["Ambitious", 0.15],
      ["Greedy", 0.15],
      ["Brave", 0.1],
      ["Visionary", 0.1],
      ["Narcissist", 0.1],
      ["Paranoid", -0.2],
      ["Cautious", -0.15],
      ["Conservative", -0.1],
      ["Content", -0.1],
      ["Shy", -0.1],
      ["Honest", 0.0],
      ["Diligent", 0.0],
    ];
    for (const [t, m] of table) expect(traitModifier(t), t).toBe(m);
  });

  it("voters_in_seat_order_then_directors_then_controller", () => {
    const none: Trait[] = [];
    const seats: [Seat, Trait[], boolean][] = [
      ["Cmo", none, false],
      ["Ceo", none, false],
      ["Cfo", none, false],
    ];
    const dirs: [Trait[], boolean][] = [[none, false]];
    const v = voters(seats, dirs, none);
    const roles: VoterRole[] = v.map((x) => x.role);
    expect(roles).toEqual([
      { kind: "Seat", seat: "Ceo" },
      { kind: "Seat", seat: "Cfo" },
      { kind: "Seat", seat: "Cmo" },
      { kind: "Director", position: 0 },
      { kind: "Controller" },
    ]);
    expect(v[4]?.is_controller).toBe(true);
  });
});

function board(n: number, controllerAt: number | null, traits: readonly Trait[]): Voter[] {
  return Array.from({ length: n }, (_, i) => ({
    role: { kind: "Director", position: i } as VoterRole,
    traits,
    is_controller: controllerAt === i,
  }));
}

describe("spec 5.20.1 vote", () => {
  it("majority_and_the_tie_rule", () => {
    // Normal, confidence 0, no traits: each yes chance is 15%. Scripted uniforms decide.
    const vote = (us: number[], ctl: number | null) => {
      const s = newScripted();
      scriptedPush(s, "Gen", us);
      return holdVote(board(us.length, ctl, []), "Normal", 0.0, s);
    };
    // 3 yes of 5 pass.
    const r = vote([0.1, 0.1, 0.1, 0.9, 0.9], null);
    expect([r.yes, r.no, r.passed]).toEqual([3, 2, true]);
    // 2 to 3 fails.
    expect(vote([0.1, 0.1, 0.9, 0.9, 0.9], 0).passed).toBe(false);
    // A 2 to 2 tie goes the controller's way...
    expect(vote([0.1, 0.1, 0.9, 0.9], 0).passed).toBe(true);
    expect(vote([0.1, 0.1, 0.9, 0.9], 3).passed).toBe(false);
    // ...and fails with no voting controller.
    expect(vote([0.1, 0.1, 0.9, 0.9], null).passed).toBe(false);
  });

  it("same_seed_same_votes_member_by_member", () => {
    const t: Trait[] = ["Ambitious"];
    const b = board(7, 0, t);
    const a = holdVote(b, "Boom", 20.0, newRng(42));
    const c = holdVote(b, "Boom", 20.0, newRng(42));
    expect(a).toEqual(c);
    expect(a.ballots.length).toBe(7);
    // Each member's chance is 15 + 15 + 2 + 15 = 47%.
    expect(a.ballots.every((x) => Math.abs(x.chance - 0.47) < 1e-12)).toBe(true);
    // The votes draw from the gen stream only (5.20.1 step 3).
    const r = newRngStreams(42);
    holdVote(b, "Boom", 20.0, rngStreamsDraws(r));
    const fresh = newRngStreams(42);
    for (const s of ["Cycle", "Growth", "Prices", "Ai"] as const) {
      expect(rngStreamsNextU32(r, s)).toBe(rngStreamsNextU32(fresh, s));
    }
  });

  it("cap_of_three_by_ttm_revenue_then_lower_id", () => {
    const passed: [CompanyId, number][] = [
      [9 as CompanyId, 400.0e6],
      [2 as CompanyId, 900.0e6],
      [7 as CompanyId, 500.0e6],
      [4 as CompanyId, 500.0e6],
      [1 as CompanyId, 300.0e6],
    ];
    const [listing, capped] = applyCap(passed);
    expect(listing).toEqual([2, 4, 7]);
    expect(capped).toEqual([9, 1]);
    // The capped and the failed come back at the lock 4 quarters later.
    expect(nextVoteAfter({ year: 2021, q: 3 })).toEqual({ year: 2022, q: 3 });
    // A starting private company's first vote: one of the four 2020 locks (NoNoise: Q2).
    expect(drawFirstVote(newNoNoise())).toEqual({ year: 2020, q: 2 });
    const r = newRng(1);
    for (let i = 0; i < 100; i++) {
      const q = drawFirstVote(r);
      expect(q.year === 2020 && q.q >= 1 && q.q <= 4).toBe(true);
    }
  });
});

describe("spec 5.20.1 listing", () => {
  it("listing_mechanics_and_a_equals_l_plus_e", () => {
    // Pre-money $500M for CO-0700, worked by hand from 7.1 and gen.py: jitter 1 + 0.1 x (2 x
    // (crc32("price:CO-0700") mod 10001) / 10000 - 1) = 1.08316, so the open price is round(25 x
    // 0.5^0.35 x 1.08316) = round(21.25) = $21; the re-split is round(500M / 21) = 23,809,524
    // shares; the float round(0.2 x that) = 4,761,905 shares at $21 x 0.92, less 3%:
    // $89,240,004.46 net.
    const l = listCompany(500.0e6, "CO-0700");
    expect(l.open_price).toBe(21.0);
    expect(l.resplit_shares).toBe(23_809_524);
    expect(l.new_shares).toBe(4_761_905);
    expect(l.shares_out).toBe(23_809_524 + 4_761_905);
    expect(Math.abs(l.net - 89_240_004.462) < 0.01, `${l.net}`).toBe(true);
    expect(Math.abs(l.fees - 0.03 * 4_761_905 * 21.0 * 0.92) < 1e-6).toBe(true);
    // Post-money cap: $21 x 28,571,429 shares.
    expect(listingMarketCap(l)).toBe(21.0 * 28_571_429);
    // A holder of 60% before keeps 60% of the re-split, 50% after the 20% issue.
    const old = 1_000_000;
    const h = listingResplitHolding(l, 600_000, old);
    expect(Math.abs(h / l.resplit_shares - 0.6) < 1e-6).toBe(true);
    expect(Math.abs(h / l.shares_out - 0.5) < 1e-5).toBe(true);

    // A = L + E after listing, on a $50M cash, $300M book, $100M line company (equity $250M):
    // after the listing cash is $139.24M, assets $439.24M, liabilities still $100M, equity
    // $339.24M. This checks the listing's cash against hand-worked balances; the engine-level
    // check (the 5.12 month roll-forward with the issue in `pending`, D125) is M6.10's wiring test.
    const after = { ...booksDefault(), cash: 50.0e6 + l.net, asset_book: 300.0e6, line_drawn: 100.0e6 };
    const s1 = balanceSheet(after, "Active");
    const ok = checkIdentity(s1, "Active");
    expect(ok.ok, JSON.stringify(ok)).toBe(true);
    expect(Math.abs(s1.total_assets - 439_240_004.462) < 0.01).toBe(true);
    expect(s1.total_liabilities).toBe(100.0e6);
    expect(Math.abs(s1.equity - 339_240_004.462) < 0.01).toBe(true);

    // The exchange index does not jump when it joins: the divisor takes the new cap.
    const idx = exchangeIndexAtLoad(2.0e9);
    const level = exchangeIndexLevel(idx, 2.2e9) as number;
    expect(Math.abs(level - 1100.0) < 1e-9).toBe(true);
    exchangeIndexReweight(idx, 2.2e9, 2.2e9 + listingMarketCap(l));
    expect(Math.abs((exchangeIndexLevel(idx, 2.2e9 + listingMarketCap(l)) as number) - 1100.0) < 1e-9).toBe(
      true,
    );
  });

  it("tickers_follow_world_gen_and_never_repeat", () => {
    // world-gen gen.py: initials, 2 + 2, 3 + 1, first 4 letters, first 3; 3 or 4 letters.
    expect(tickerCandidates("Arrowhead Drilling")).toEqual(["ARDR", "ARRD", "ARRO", "ARR"]);
    expect(ticker("Arrowhead Drilling", () => false)).toBe("ARDR");
    // Replaying the scheme over companies.csv's public companies, in file order.
    const d = data();
    const used: string[] = [];
    let same = 0;
    let all = 0;
    for (const c of d.companies.rows.filter((x) => x.public)) {
      const t = ticker(c.name, (x) => used.includes(x));
      all += 1;
      if (t === c.ticker) same += 1;
      used.push(c.ticker);
    }
    expect(same, `${same} of ${all} companies.csv tickers follow the scheme`).toBe(all);
    // With every candidate taken, the fixed fallback: the first letter, then AAA up.
    expect(ticker("Arrowhead Drilling", (x) => x.length === 3 || x.startsWith("AR"))).toBe("AAAA");
    expect(ticker("Zed Co", (x) => x !== "ZAAB")).toBe("ZAAB");
  });
});
