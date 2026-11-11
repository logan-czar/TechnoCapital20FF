// What the Records app works out from the views, as pure functions (pivot 7.1 to 7.6, 8.6, 9.4):
// stage and kind names, lever changes in plain words, the threshold a roll call was held under,
// party totals, filing totals, which seat a person holds, who a certified count elected. Nothing
// here reads a hook or the DOM, so the tests call it directly.

import type {
  BillRow,
  BillStage,
  Chamber,
  ExecActionRow,
  FilingRow,
  LeverChange,
  Party,
  PersonRow,
  RollCallRow,
  RollCallVotes,
  SimDate,
  StateReturns,
} from "@tc20ff/sim";
import { int } from "../../widgets/cells.ts";
import type { BillFilter } from "./route.ts";

/** Votes to end a filibuster in the Senate of 100 (pivot 7.4 `CLOTURE_VOTES`). */
export const CLOTURE_VOTES = 60;
/** A veto is overridden by two thirds of each chamber (pivot 7.5). */
export const OVERRIDE_RULE = "two thirds";

/** A sortable number for a date. */
export function dayKey(d: SimDate): number {
  return d.year * 10_000 + d.month * 100 + d.day;
}

export const STAGE_LABEL: Readonly<Record<BillStage, string>> = {
  Drafted: "Drafted",
  Committee: "In committee",
  HouseFloor: "House floor",
  SenateFloor: "Senate floor",
  Conference: "In conference",
  President: "With the President",
  Law: "Law",
  Dead: "Failed",
};

export const EXEC_LABEL: Readonly<Record<ExecActionRow["kind"], string>> = {
  Nomination: "Nomination",
  Confirmation: "Confirmation",
  Order: "Executive order",
  Veto: "Veto",
  Shutdown: "Shutdown",
  Impeachment: "Impeachment",
  Resignation: "Resignation",
};

/** A bill's number as the site prints it: "H.B. 3" for one introduced in the House. */
export function billLabel(b: Pick<BillRow, "id" | "chamber_of_origin">): string {
  return `${b.chamber_of_origin === "House" ? "H.B." : "S.B."} ${b.id + 1}`;
}

/** A roll call's number as the site prints it (ids count from 0, the site from 1). */
export function rollLabel(id: number): string {
  return `Roll call no. ${id + 1}`;
}

/** "Plural" party names for a table: Democrats, Republicans, Independents. */
export function partyPlural(p: Party | null): string {
  return p === null ? "Independents" : p;
}

/** A fraction as a percent without trailing zeros: 0.025 is "2.5%", 0.1 is "10%". */
export function pctText(v: number): string {
  const s = (v * 100).toFixed(2).replace(/\.?0+$/, "");
  return `${s === "-0" ? "0" : s}%`;
}

function signedPct(v: number): string {
  return `${v > 0 ? "+" : ""}${pctText(v)}`;
}

/** The names a lever change needs: an industry's and a state's, by id. */
export interface LeverNames {
  industry(id: number): string;
  state(id: number): string;
}

/** One lever change in plain words (pivot 4.3, 7.1): what the value becomes once it takes effect. */
export function leverText(c: LeverChange, names: LeverNames): string {
  const ind = c.index === null ? "all industries" : names.industry(c.index);
  const st = c.index === null ? "every state" : names.state(c.index);
  switch (c.lever) {
    case "corp_tax":
      return `Sets the national corporate tax rate to ${pctText(c.to)}.`;
    case "fiscal":
      return `Sets federal spending stimulus to ${pctText(c.to)} of US demand.`;
    case "rate_bias":
      return `Moves the policy interest rate target by ${signedPct(c.to)}.`;
    case "regulation":
      return `Sets the added operating cost of regulating ${ind} to ${pctText(c.to)}.`;
    case "subsidy":
      return `Sets the subsidy to ${ind} to ${pctText(c.to)} of demand.`;
    case "antitrust":
      return `Sets the antitrust cap on the largest firm in ${ind} to ${c.to.toFixed(2)} (0 is no cap, 1 the hardest).`;
    case "tariff":
      return `Sets the tariff on imported ${ind} goods and services to ${pctText(c.to)}.`;
    case "state_growth":
      return `Shifts yearly growth in ${st} by ${signedPct(c.to)}.`;
    case "gains_tax":
      return `Sets the tax on investors' realised gains to ${pctText(c.to)}.`;
    case "income_tax":
      return `Sets the tax on interest income to ${pctText(c.to)}.`;
  }
}

/** What a roll call needed to pass, as the site words it. */
export interface Threshold {
  rule: "Majority" | "Cloture" | "Override";
  /** "A majority of those voting: 217 of 433." */
  text: string;
  /** The yeas needed when the rule fixes a number (a majority of those voting, cloture); else null. */
  needed: number | null;
}

/**
 * The rule a roll call was held under, read from its question (`RollCallRow` carries no threshold;
 * D1046): cloture needs `CLOTURE_VOTES` (pivot 7.4), an override two thirds (pivot 7.5), anything
 * else a majority of those voting.
 */
export function thresholdOf(rc: Pick<RollCallRow, "question" | "yeas" | "nays">): Threshold {
  const q = rc.question.toLowerCase();
  if (q.includes("cloture")) {
    return {
      rule: "Cloture",
      needed: CLOTURE_VOTES,
      text: `Cloture ends a filibuster and needs ${CLOTURE_VOTES} yeas of the Senate's 100.`,
    };
  }
  if (q.includes("veto") || q.includes("overrid")) {
    return {
      rule: "Override",
      needed: null,
      text: `Overriding a veto needs ${OVERRIDE_RULE} of the chamber.`,
    };
  }
  const needed = Math.floor((rc.yeas + rc.nays) / 2) + 1;
  return {
    rule: "Majority",
    needed,
    text: `A majority of those voting: ${needed} of ${rc.yeas + rc.nays}.`,
  };
}

export type VoteKind = RollCallVotes["votes"][number]["vote"];
export const VOTE_KINDS: readonly VoteKind[] = ["Yea", "Nay", "NotVoting"];
export const VOTE_LABEL: Readonly<Record<VoteKind, string>> = {
  Yea: "Yea",
  Nay: "Nay",
  NotVoting: "Not voting",
};

export interface PartyTotals {
  party: Party | null;
  Yea: number;
  Nay: number;
  NotVoting: number;
}

/**
 * A roll call's votes by party (pivot 7.4), in party order with independents last. A person the
 * people view does not hold counts as an independent. Democrats and Republicans always appear;
 * independents only when one voted.
 */
export function partyTotals(
  votes: RollCallVotes["votes"],
  party: (person: number) => Party | null | undefined,
): PartyTotals[] {
  const rows: PartyTotals[] = [
    { party: "Democrats", Yea: 0, Nay: 0, NotVoting: 0 },
    { party: "Republicans", Yea: 0, Nay: 0, NotVoting: 0 },
    { party: null, Yea: 0, Nay: 0, NotVoting: 0 },
  ];
  for (const v of votes) {
    const p = party(v.person) ?? null;
    const row = rows.find((r) => r.party === p) as PartyTotals;
    row[v.vote] += 1;
  }
  return rows.filter((r) => r.party !== null || r.Yea + r.Nay + r.NotVoting > 0);
}

/** Bills matching the index's filters and search (pivot 8.6): sponsor, title, summary, subject and number. */
export function filterBills(
  bills: readonly BillRow[],
  f: BillFilter,
  sponsorName: (id: number) => string,
): BillRow[] {
  const q = f.q.trim().toLowerCase();
  return bills.filter((b) => {
    if (f.stage !== null && b.stage !== f.stage) return false;
    if (f.chamber !== null && b.chamber_of_origin !== f.chamber) return false;
    if (f.subject !== "" && b.subject !== f.subject) return false;
    if (q === "") return true;
    return [b.title, b.summary, b.subject, sponsorName(b.sponsor), billLabel(b)].some((s) =>
      s.toLowerCase().includes(q),
    );
  });
}

/** A seat in Congress as the people view words it ("Representative, Texas 12", "Senator, Ohio"). */
export interface Seat {
  chamber: Chamber;
  state: number;
  /** A House member's district number; null for a senator. */
  district: number | null;
}

/**
 * The seat a person holds now, from `PersonRow.office` (the view gives no chamber or state of its
 * own; D1046): "Representative..." is the House and "Senator..." the Senate; the state is the
 * longest state name the title holds, or the home state. Null for anyone else.
 */
export function seatOf(p: PersonRow, states: readonly { id: number; name: string }[]): Seat | null {
  if (p.status !== "InOffice" || p.office === null) return null;
  const chamber: Chamber | null = p.office.startsWith("Representative")
    ? "House"
    : p.office.startsWith("Senator")
      ? "Senate"
      : null;
  if (chamber === null) return null;
  let state = p.home_state as number;
  let best = 0;
  for (const s of states) {
    if (p.office.includes(s.name) && s.name.length > best) {
      best = s.name.length;
      state = s.id;
    }
  }
  const d = /(\d+)\s*$/.exec(p.office);
  return { chamber, state, district: chamber === "House" && d !== null ? Number(d[1]) : null };
}

/** What a campaign has filed in all (pivot 6.3, 8.6). */
export interface FilingTotals {
  raised: number;
  spent: number;
  /** On hand at the end of the latest filing. */
  cash: number;
  /** The last day the latest filing covers. */
  through: SimDate;
  filings: number;
}

/** The totals of a campaign's filings (any order); null with none. */
export function filingTotals(filings: readonly FilingRow[]): FilingTotals | null {
  let latest: FilingRow | null = null;
  let raised = 0;
  let spent = 0;
  for (const f of filings) {
    raised += f.raised;
    spent += f.spent;
    if (latest === null || dayKey(f.through) >= dayKey(latest.through)) latest = f;
  }
  if (latest === null) return null;
  return { raised, spent, cash: latest.cash, through: latest.through, filings: filings.length };
}

/** The filings by person, each list oldest first. */
export function filingsBy<K extends number>(
  filings: readonly FilingRow[],
  key: (f: FilingRow) => K,
): Map<K, FilingRow[]> {
  const out = new Map<K, FilingRow[]>();
  for (const f of filings) {
    const list = out.get(key(f));
    if (list === undefined) out.set(key(f), [f]);
    else list.push(f);
  }
  for (const list of out.values()) list.sort((a, b) => dayKey(a.through) - dayKey(b.through));
  return out;
}

/** The index in `votes` of the most votes; ties go to the first, the lower position (CLAUDE.md). */
export function leaderIndex(votes: readonly { votes: number }[]): number {
  let best = -1;
  let top = -1;
  votes.forEach((v, i) => {
    if (v.votes > top) {
      top = v.votes;
      best = i;
    }
  });
  return best;
}

/**
 * Electoral votes of the states that have certified (pivot 9.4), by person: a certified state's
 * votes go to the person with most votes in it. Calls by outlets and uncertified counts are not
 * official, so they do not count.
 */
export function officialElectoralVotes(states: readonly StateReturns[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of states) {
    if (s.certified === null) continue;
    const i = leaderIndex(s.votes);
    const who = s.votes[i];
    if (who === undefined) continue;
    out.set(who.person, (out.get(who.person) ?? 0) + s.electoral_votes);
  }
  return out;
}

/** Whole dollars with thousands separators, as a filing prints them: "$1,234,567". */
export function usdFull(v: number): string {
  const r = Math.round(v);
  return `${r < 0 ? "-" : ""}$${int(Math.abs(r))}`;
}

/** A share of a total as a fraction; 0 for an empty total. */
export function shareOf(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}
