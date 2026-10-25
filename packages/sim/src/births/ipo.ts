// Listings (spec 5.20; Logan, batches 163 Q6a, 165 and 166): the IPO tests, the board vote with
// trait modifiers (5.20.1), the world-wide cap of 3 a quarter and the listing itself. Ported from
// crates/sim/src/births/ipo.rs.
//
// Every IPO is a board vote. Each voter rolls once on the gen stream, in seat order (labor seats 1
// to 5, then directors, then an unseated named or state controller; D276), so a seed always gives
// the same votes, member by member.
//
// VoterRole, BallotVoter, Ballot and VoteResult are in types/state/births.ts.

import { ratingFactor } from "../finance/rating.ts";
import { quarterNext } from "../time/calendar.ts";
import type { Quarter } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import type { CompanyId } from "../types/ids.ts";
import { clamp, roundTiesEven, totalCmp, toU64Sat } from "../types/num.ts";
import type { Ballot, VoteResult, VoterRole } from "../types/state/births.ts";
import type { CompanyStatus, Rating } from "../types/state/finance.ts";
import { SEAT_VALUES, type Seat, type Trait } from "../types/state/people.ts";
import type { PhaseLabel } from "../types/world.ts";
import { openPrice, sharesFor } from "./startup.ts";

export type { Ballot, BallotVoter, VoteResult, VoterRole } from "../types/state/births.ts";

/** Spec 5.20: at least 8 quarters since birth (starting companies pass at once) ... */
export const MIN_QUARTERS_SINCE_BIRTH = 8;
/**
 * ... and TTM revenue at least $250M (T), lowered to $75M by the M10 tuning pass (M10.7, D362,
 * pending Logan): at $250M born companies, which start at $5M to $50M and mostly grow at the 6.2
 * below-hurdle 2%, almost never qualify, and 30 years give 34 to 54 listings against spec 10's 60
 * to 250.
 */
export const MIN_TTM_REVENUE_USD = 75.0e6;
/** Spec 5.20: TTM net income above 0, or 4-quarter revenue growth of at least 20%. */
export const MIN_REVENUE_GROWTH = 0.2;
/**
 * Spec 5.20.1 step 1: a starting private company's first vote falls at one of the four 2020 plan
 * locks (A).
 */
export const FIRST_VOTE_YEAR = 2020;
export const QUARTERS_PER_YEAR = 4;
/** Spec 5.20.1 step 1: after a failed vote, the plan lock 4 quarters later (T). */
export const RETRY_QUARTERS = 4;
/** Spec 5.20.1 step 3: `15% + phase adj + confidence ÷ 10 + trait modifiers`, in points ... */
export const BASE_YES = 0.15;
/** ... phase adj Boom +15, Normal 0, Glut −10 (Bust is not eligible, 5.20) ... */
export const PHASE_ADJ_BOOM = 0.15;
export const PHASE_ADJ_NORMAL = 0.0;
export const PHASE_ADJ_GLUT = -0.1;
/** ... confidence (−100 to +100) ÷ 10 points, so ÷ 1,000 as a fraction ... */
export const CONFIDENCE_DIVISOR = 1000.0;
/** ... clamped 5% to 95%. */
export const MIN_YES = 0.05;
export const MAX_YES = 0.95;
/** Spec 5.20.1 step 6: at most 3 listings world-wide a quarter (T). */
export const LISTINGS_PER_QUARTER = 3;
/** Spec 5.20.1 Listing step 3: new shares equal to 20% of the re-split shares ... */
export const PUBLIC_FLOAT_SHARE = 0.2;
/** ... at `open_price × 0.92` (the 6.6 small-cap discount) ... */
export const IPO_DISCOUNT = 0.08;
/** ... less 3% fees. */
export const IPO_FEE = 0.03;

/**
 * The 5.20.1 trait modifier (T), a fraction: Ambitious +15, Greedy +15, Brave +10, Visionary +10,
 * Narcissist +10, Paranoid −20, Cautious −15, Conservative −10, Content −10, Shy −10; others 0.
 */
export function traitModifier(t: Trait): number {
  switch (t) {
    case "Ambitious":
    case "Greedy":
      return 0.15;
    case "Brave":
    case "Visionary":
    case "Narcissist":
      return 0.1;
    case "Paranoid":
      return -0.2;
    case "Cautious":
      return -0.15;
    case "Conservative":
    case "Content":
    case "Shy":
      return -0.1;
    default:
      return 0.0;
  }
}

/** What the IPO tests read at a plan lock (spec 5.20). */
export interface IpoTestInputs {
  listed: boolean;
  status: CompanyStatus;
  /** null for the 651 starting companies (they pass the age test at once; u32). */
  quarters_since_birth: number | null;
  ttm_revenue: number;
  ttm_net_income: number;
  /** 4-quarter revenue growth (`market/fair_value` `revenueGrowth`). */
  revenue_growth: number;
  rating: Rating;
  label: PhaseLabel;
}

/**
 * True if a company may be put to an IPO vote (spec 5.20): private and Active; 8 quarters since
 * birth (starting companies at once); TTM revenue at least $75M (D362; the spec says $250M); TTM
 * net income above 0 or revenue growth of at least 20%; rated B or better (rating factor above 0,
 * as 6.6 reads it: B- counts); its industry not labeled Bust. ("Not Distressed" is in "Active".)
 */
export function passesIpoTests(i: IpoTestInputs): boolean {
  return (
    !i.listed &&
    i.status === "Active" &&
    (i.quarters_since_birth === null || i.quarters_since_birth >= MIN_QUARTERS_SINCE_BIRTH) &&
    i.ttm_revenue >= MIN_TTM_REVENUE_USD &&
    (i.ttm_net_income > 0.0 || i.revenue_growth >= MIN_REVENUE_GROWTH) &&
    ratingFactor(i.rating) > 0.0 &&
    i.label !== "Bust"
  );
}

/**
 * A starting private company's first vote (spec 5.20.1 step 1, A): one of the four 2020 plan locks,
 * uniform on the gen stream (D276: drawn at load for each starting private company in id order,
 * after the boards).
 */
export function drawFirstVote(draws: DrawSource): Quarter {
  const q = draws.intInclusive("Gen", 1, QUARTERS_PER_YEAR);
  return { year: FIRST_VOTE_YEAR, q };
}

/**
 * The plan lock a failed (or capped) IPO comes back at (spec 5.20.1 steps 1 and 6): 4 quarters
 * later.
 */
export function nextVoteAfter(failed_at: Quarter): Quarter {
  let q = failed_at;
  for (let k = 0; k < RETRY_QUARTERS; k++) q = quarterNext(q);
  return q;
}

/** Phase adj (spec 5.20.1 step 3) of the company's industry label. */
export function phaseAdj(label: PhaseLabel): number {
  switch (label) {
    case "Boom":
      return PHASE_ADJ_BOOM;
    case "Normal":
    case "Bust":
      return PHASE_ADJ_NORMAL;
    case "Glut":
      return PHASE_ADJ_GLUT;
  }
}

/**
 * A voter's yes chance (spec 5.20.1 step 3): `15% + phase adj + confidence ÷ 10 + trait
 * modifiers`, clamped 5% to 95%; `confidence` is the listing exchange's (5.1.2).
 */
export function yesChance(label: PhaseLabel, confidence: number, traits: readonly Trait[]): number {
  let mods = 0.0;
  for (const t of traits) mods += traitModifier(t);
  return clamp(BASE_YES + phaseAdj(label) + confidence / CONFIDENCE_DIVISOR + mods, MIN_YES, MAX_YES);
}

/** One voter (spec 5.20.1 step 2). */
export interface Voter {
  role: VoterRole;
  /** The member's traits (a state controller has none). */
  traits: readonly Trait[];
  /** This vote is the controller's (a seated lead founder, or the extra controller vote). */
  is_controller: boolean;
}

/**
 * The voters of a board (spec 5.20.1 steps 2 and 4), in roll order: the seated labor seats in seat
 * order, then the directors, then the controller's own vote when the controller is a named
 * character or a state holding no seat. `seats` and `directors` hold each member's traits and
 * whether it is the controller; a trust or other unnamed controller casts none.
 */
export function voters(
  seats: readonly (readonly [Seat, readonly Trait[], boolean])[],
  directors: readonly (readonly [readonly Trait[], boolean])[],
  unseated_controller: readonly Trait[] | null,
): Voter[] {
  const out: Voter[] = [];
  // Stable sort by the Seat enum order (Rust `sort_by_key`).
  const ordered = [...seats].sort((a, b) => SEAT_VALUES.indexOf(a[0]) - SEAT_VALUES.indexOf(b[0]));
  for (const [seat, traits, ctl] of ordered) {
    out.push({ role: { kind: "Seat", seat }, traits, is_controller: ctl });
  }
  directors.forEach(([traits, ctl], i) => {
    out.push({ role: { kind: "Director", position: i }, traits, is_controller: ctl });
  });
  if (unseated_controller !== null) {
    out.push({ role: { kind: "Controller" }, traits: unseated_controller, is_controller: true });
  }
  return out;
}

/**
 * Holds the vote (spec 5.20.1 steps 3 to 5): each voter rolls once on the gen stream in the given
 * order (one uniform below its yes chance is a yes). A majority of votes cast passes; a tie goes
 * the controller's way, and fails where the controller casts no vote.
 */
export function holdVote(
  voters_: readonly Voter[],
  label: PhaseLabel,
  confidence: number,
  draws: DrawSource,
): VoteResult {
  const ballots: Ballot[] = voters_.map((v) => {
    const chance = yesChance(label, confidence, v.traits);
    return { role: v.role, chance, yes: draws.chance("Gen", chance), voter: null };
  });
  const yes = ballots.filter((b) => b.yes).length;
  const no = ballots.length - yes;
  let passed: boolean;
  if (yes !== no) {
    passed = yes > no;
  } else {
    const at = voters_.findIndex((v) => v.is_controller);
    passed = at >= 0 && (ballots[at] as Ballot).yes;
  }
  return { ballots, yes, no, passed };
}

/**
 * The world-wide cap (spec 5.20.1 step 6): of the votes that passed this quarter, the 3 largest by
 * TTM revenue list; ties go to the lower id (D277). Returns (listing, capped) in that order; the
 * capped count as failed and come back in 4 quarters.
 */
export function applyCap(passed: readonly (readonly [CompanyId, number])[]): [CompanyId[], CompanyId[]] {
  const order = [...passed].sort((a, b) => totalCmp(b[1], a[1]) || a[0] - b[0]);
  const listing = order.slice(0, LISTINGS_PER_QUARTER).map(([id]) => id);
  const capped = order.slice(LISTINGS_PER_QUARTER).map(([id]) => id);
  return [listing, capped];
}

/** A listing (spec 5.20.1 Listing steps 2 and 3). */
export interface Listing {
  /** The 7.1 rule on the pre-money value; P = open_price, buzz 0 (step 4). */
  open_price: number;
  /** Existing shares after the re-split: `pre-money value ÷ open_price` (u64). */
  resplit_shares: number;
  /** New shares to the public float: 20% of the re-split shares (rounded half to even, D278; u64). */
  new_shares: number;
  /** u64. */
  shares_out: number;
  /** `new shares × open_price × 0.92`. */
  gross: number;
  /** 3% of the gross. */
  fees: number;
  /** Cash raised: gross less fees. */
  net: number;
}

/**
 * An existing holding after the re-split (holders keep their share of the company before the
 * issue): `holding × re-split ÷ old shares`, rounded half to even (D278). Rust
 * `Listing::resplit_holding`.
 */
export function listingResplitHolding(l: Listing, holding: number, old_shares_out: number): number {
  if (old_shares_out === 0) return 0;
  return toU64Sat(roundTiesEven((holding * l.resplit_shares) / old_shares_out));
}

/** Market cap at the open (5.14), for the index reweight (Rust `Listing::market_cap`). */
export function listingMarketCap(l: Listing): number {
  return l.open_price * l.shares_out;
}

/**
 * The listing (spec 5.20.1 Listing): the open price by the 7.1 rule on the pre-money value (the
 * 5.13 engine value with the exchange's X and no private discount), the re-split, 20% new shares at
 * `open_price × 0.92` less 3% fees. `key` seeds the 7.1 jitter.
 */
export function listCompany(pre_money_value: number, key: string): Listing {
  const price = openPrice(pre_money_value, key);
  const resplit = sharesFor(pre_money_value, price);
  const new_shares = toU64Sat(roundTiesEven(PUBLIC_FLOAT_SHARE * resplit));
  const gross = new_shares * price * (1.0 - IPO_DISCOUNT);
  const fees = IPO_FEE * gross;
  return {
    open_price: price,
    resplit_shares: resplit,
    new_shares,
    shares_out: resplit + new_shares,
    gross,
    fees,
    net: gross - fees,
  };
}
