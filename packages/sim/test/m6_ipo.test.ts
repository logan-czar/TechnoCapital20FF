// Port of crates/sim/tests/m6_ipo.rs: build-plan M6.9 on the live engine: IPO tests, board votes,
// the cap of 3 and the listing (spec 5.20, 5.20.1). Done lines: the same seed gives the same
// votes, member by member; A = L + E after the listing.
//
// Expected values from the spec: each member's yes chance `15% + phase adj + confidence / 10 +
// trait modifiers`, clamped 5% to 95% (the 5.20.1 table), voters in seat order then directors
// then an unseated named or state controller; a majority passes, a tie goes the controller's way;
// at most 3 listings a quarter; the listing re-splits to `pre-money / open_price` and sells 20%
// new shares at `open_price x 0.92` less 3% fees; the index level does not jump.
//
// Expects:
//   ../src/lib.ts           simNew, simStep, simNow, simWorld, simStateHash, simRegisterTestJob
//   ../src/market/jobs.ts   indexLevel(world, zone) -> number | null   [market::jobs::index_level]
//
// Changed from the Rust: the seeds (31, 32) seed the new generator (D951); every assertion is a
// spec rule (the voters, chances, majority, cap, listing arithmetic), so none depends on which
// companies the draws pick, only the counts (votes > 20, > 10, some listing in 2020) are
// structural. Rust's static Mutex vectors are per-run arrays. The test job closures are
// registered per Sim (simRegisterTestJob).
import { describe, expect, it } from "vitest";
import { simNew, simNow, simRegisterTestJob, simStateHash, simStep, simWorld } from "../src/lib.ts";
import { indexLevel } from "../src/market/jobs.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import type { JobCtx } from "../src/time/scheduler.ts";
import type { SimDate } from "../src/types/calendar.ts";
import type { CompanyId } from "../src/types/ids.ts";
import { roundTiesEven } from "../src/types/num.ts";
import type { VoterRole } from "../src/types/state/births.ts";
import { SEAT_LABOR, type Trait } from "../src/types/state/people.ts";
import type { Notice, PhaseLabel, World } from "../src/types/world.ts";
import { sameDate, sum } from "./common/births.ts";
import { data, idRows, rowOf, unwrap } from "./common/index.ts";

/** Spec 5.20.1 trait modifiers (T), in points. */
function modifier(t: Trait): number {
  switch (t) {
    case "Ambitious":
    case "Greedy":
      return 15.0;
    case "Brave":
    case "Visionary":
    case "Narcissist":
      return 10.0;
    case "Paranoid":
      return -20.0;
    case "Cautious":
      return -15.0;
    case "Conservative":
    case "Content":
    case "Shy":
      return -10.0;
    default:
      return 0.0;
  }
}

/** Spec 5.20.1 step 3. */
function specChance(label: PhaseLabel, confidence: number, traits: readonly Trait[]): number {
  const phase = label === "Boom" ? 15.0 : label === "Glut" ? -10.0 : 0.0;
  const mods = sum(traits.map(modifier));
  const x = (15.0 + phase + confidence / 10.0 + mods) / 100.0;
  return Math.min(Math.max(x, 0.05), 0.95);
}

/**
 * The state the IPO step reads, kept per lock: labels, zone confidences, index levels, each
 * company's cash and voters (a test job after the random startup events).
 */
interface Before {
  date: SimDate;
  labels: PhaseLabel[];
  confidence: number[];
  levels: (number | null)[];
  cash: number[];
  /** Each company's voters with their traits, as the board stood. */
  voters: [VoterRole, Trait[]][][];
}

const levels = (w: World): (number | null)[] => w.zones.map((_, z) => indexLevel(w, z as never));

/** The traits of each voter, in the 5.20.1 roll order. */
function voterTraits(w: World, id: CompanyId): [VoterRole, Trait[]][] {
  const c = rowOf(w.companies, id);
  const out: [VoterRole, Trait[]][] = [];
  let seated = false;
  c.board.forEach((h, i) => {
    if (h === null) return;
    const seat = SEAT_LABOR[i];
    if (seat === undefined) throw new Error("board longer than the labor seats");
    if (h.kind === "Simple") {
      out.push([{ kind: "Seat", seat }, [...h.seat.character.traits]]);
    } else {
      seated ||= h.character === c.controller;
      out.push([{ kind: "Seat", seat }, [...rowOf(w.characters, h.character).traits]]);
    }
  });
  c.directors.forEach((d, i) => {
    let t: Trait[];
    if (d.kind === "Simple") {
      t = [...d.seat.character.traits];
    } else {
      seated ||= d.character === c.controller;
      t = [...rowOf(w.characters, d.character).traits];
    }
    out.push([{ kind: "Director", position: i }, t]);
  });
  if (!seated) {
    if (c.state_controlled) {
      out.push([{ kind: "Controller" }, []]);
    } else if (c.controller !== null) {
      out.push([{ kind: "Controller" }, [...rowOf(w.characters, c.controller).traits]]);
    }
  }
  return out;
}

function run(seed: number, end: SimDate, probe: boolean) {
  const before: Before[] = [];
  const after: [(number | null)[], number[]][] = [];
  const sim = unwrap(simNew(data(), seed), "Sim::new");
  if (probe) {
    simRegisterTestJob(sim, "LockRandomStartupEvents", "test.before_ipo", (w: World, ctx: JobCtx) => {
      before.push({
        date: ctx.facts.date,
        labels: w.industries.map((i) => i.phase_label),
        confidence: w.zones.map((z) => z.confidence),
        levels: levels(w),
        cash: w.companies.map((c) => c.cash_usd),
        voters: w.companies.map((_, id) => voterTraits(w, id as CompanyId)),
      });
    });
    simRegisterTestJob(sim, "LockIpoVotes", "test.after_ipo", (w: World) => {
      after.push([levels(w), w.companies.map((c) => c.cash_usd)]);
    });
  }
  const seen: Notice[] = [];
  const stop = dateTimeMidnight(end);
  while (simNow(sim) < stop) {
    for (const n of simStep(sim)) {
      if (n.kind === "IpoVote" || n.kind === "CompanyListed") seen.push(n);
    }
  }
  return { sim, seen, before, after };
}

describe("m6 ipo", () => {
  it("ipo_votes_and_listings_follow_5_20", () => {
    // Past the Q1 2021 close, so a listing at the 9 January 2021 lock has its quarter's
    // statements (the shares-issued check below).
    const { sim, seen, before, after } = run(31, simDateYmd(2021, 4, 2), true);
    const w = simWorld(sim);
    expect(before.length).toBe(after.length);

    // Each vote (5.20.1 steps 2 to 5): the voters and their chances, the majority and the tie.
    let votes = 0;
    for (const [id, c] of idRows<CompanyId, (typeof w.companies)[number]>(w.companies)) {
      const v = c.ipo_last_vote;
      if (v === null) continue;
      votes += 1;
      const b = before.find((x) => sameDate(x.date, v.date));
      if (b === undefined) throw new Error("no probe for the vote's lock");
      const label = b.labels[c.industry] as PhaseLabel;
      const zone = rowOf(w.countries, c.hq_country).zone;
      const conf = b.confidence[zone] as number;
      const voters = b.voters[id] as [VoterRole, Trait[]][];
      expect(v.result.ballots.length, c.key).toBe(voters.length);
      v.result.ballots.forEach((ballot, k) => {
        const [role, traits] = voters[k] as [VoterRole, Trait[]];
        expect(ballot.role).toEqual(role);
        expect(Math.abs(ballot.chance - specChance(label, conf, traits)) < 1e-12).toBe(true);
      });
      const yes = v.result.ballots.filter((x) => x.yes).length;
      expect([v.result.yes, v.result.no]).toEqual([yes, voters.length - yes]);
      if (2 * yes !== voters.length) expect(v.result.passed).toBe(2 * yes > voters.length);
    }
    expect(votes, `${votes} companies voted (68 starting private ones are big enough)`).toBeGreaterThan(20);

    // The cap (5.20.1 step 6) and the listings.
    const listed: [Before, CompanyId][] = [];
    for (const b of before) {
      const at = idRows<CompanyId, (typeof w.companies)[number]>(w.companies)
        .filter(([id]) => sameDate(rowOf(w.market.stocks, id).listed_on, b.date))
        .map(([id]) => id);
      expect(at.length, `${JSON.stringify(b.date)}: ${at.length} listings`).toBeLessThanOrEqual(3);
      for (const id of at) listed.push([b, id]);
    }
    expect(listed.length, "some company lists in 2020").toBeGreaterThan(0);
    expect(seen.filter((n) => n.kind === "CompanyListed").length).toBe(listed.length);
    for (const [b, id] of listed) {
      const c = rowOf(w.companies, id);
      const s = rowOf(w.market.stocks, id);
      const k = before.findIndex((x) => sameDate(x.date, b.date));
      // The index level does not move (D250).
      const zone = rowOf(w.countries, c.hq_country).zone;
      const l0 = b.levels[zone] ?? null;
      const l1 = (after[k] as (typeof after)[number])[0][zone] ?? null;
      if (l0 !== null && l1 !== null) {
        expect(Math.abs(l0 - l1) <= 1e-9 * l0, `${c.key}: index ${l0} to ${l1}`).toBe(true);
      }
      // Listing steps 2 and 3: the float is 20% of the re-split shares (halves to even), sold at
      // open_price x 0.92 less 3% fees.
      const p = s.ipo_price;
      expect(p >= 5.0 && p <= 200.0).toBe(true);
      const floatHolding = c.holders.find((h) => h.holder.kind === "PublicFloat");
      if (floatHolding === undefined) throw new Error("no public float");
      const float = floatHolding.shares;
      const resplit = c.shares_out - float;
      expect(float, c.key).toBe(roundTiesEven(0.2 * resplit));
      const net = float * p * 0.92 * 0.97;
      const raised = ((after[k] as (typeof after)[number])[1][id] as number) - (b.cash[id] as number);
      expect(Math.abs(raised - net) <= 1e-6 * net, `${c.key}: cash rose ${raised}, net ${net}`).toBe(true);
      expect(sum(c.holders.map((h) => h.shares)), `${c.key}: the cap table sums`).toBe(c.shares_out);
      expect(c.public && s.quoted).toBe(true);
      expect(c.ticker.length >= 3 && c.ticker.length <= 4).toBe(true);
      expect(w.companies.filter((o) => o.ticker === c.ticker).length).toBe(1);
      // A = L + E (build-plan M6.9): the month of the listing posts the shares issued, net of
      // fees, and every month balances.
      const issued = sum(c.finance.archive.quarters.map((qt) => qt.lines.shares_issued_net));
      expect(Math.abs(issued - net) < 1e-3, `${c.key}: shares issued ${issued} vs ${net}`).toBe(true);
    }
    expect(w.books_check.failures, `${w.books_check.first_failure}`).toBe(0);
  });

  it("the_same_seed_gives_the_same_votes_member_by_member", () => {
    const end = simDateYmd(2020, 10, 10);
    const a = run(32, end, false);
    const b = run(32, end, false);
    expect(a.seen).toEqual(b.seen);
    const wa = simWorld(a.sim);
    const wb = simWorld(b.sim);
    let votes = 0;
    wa.companies.forEach((c, id) => {
      expect(c.ipo_last_vote, c.key).toEqual(rowOf(wb.companies, id as CompanyId).ipo_last_vote);
      if (c.ipo_last_vote !== null) votes += 1;
    });
    expect(votes).toBeGreaterThan(10);
    expect(simStateHash(a.sim)).toBe(simStateHash(b.sim));
  });
});
