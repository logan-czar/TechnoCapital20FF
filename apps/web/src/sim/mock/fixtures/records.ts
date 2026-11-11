// The mock's official records (v_records; pivot 7.1, 7.4 to 7.6, 8.6): seven bills at different
// stages, their roll calls with every member's vote, executive actions and campaign finance
// filings. Always true. The scripted steps (a bill passing, a veto) are driven from ../pivot.ts.
//
// A roll call's row carries its tally. How each member voted is `rollCallVotes`, the slice the
// view's type describes (`RollCallVotes`); the protocol cannot carry it yet (README).

import type {
  BillId,
  BillStage,
  Chamber,
  ExecActionRow,
  FilingRow,
  LeverChange,
  PersonId,
  RecordsView,
  RollCallRow,
  RollCallVotes,
  SimDate,
} from "@tc20ff/sim";
import type { MockWorld } from "../mockWorld.ts";
import type { MockGeo } from "./geo.ts";
import { type MockCandidate, type MockPolitics, other } from "./races.ts";
import type { MockRng } from "./rng.ts";
import { ymd } from "./script.ts";

/** The share of a chamber needed to end debate (pivot 7.4 `CLOTURE_VOTES` = 60 of 100) and to override a veto (7.5). */
const CLOTURE_SHARE = 0.6;
const OVERRIDE_SHARE = 2 / 3;
/** How often a member votes with the sponsor's party, by whether it is their own. */
const VOTE_WITH_OWN = 0.93;
const VOTE_WITH_OTHER = 0.22;
const NOT_VOTING = 0.03;

/** The mock's bills, by their place in the table. */
export const BILL = {
  broadband: 0 as BillId,
  infrastructure: 1 as BillId,
  tax: 2 as BillId,
  tariff: 3 as BillId,
  platform: 4 as BillId,
  growth: 5 as BillId,
  border: 6 as BillId,
} as const;

export interface MockBill {
  id: BillId;
  title: string;
  summary: string;
  sponsor: PersonId;
  subject: string;
  stage: BillStage;
  changes: LeverChange[];
  introduced: SimDate;
  last_action: SimDate;
  effective: SimDate | null;
}

export interface RecordsState {
  bills: MockBill[];
  roll_calls: RollCallRow[];
  /** By roll call id. */
  votes: RollCallVotes["votes"][];
  actions: ExecActionRow[];
  filings: FilingRow[];
}

export type VoteNeed = "Majority" | "Cloture" | "Override";

/**
 * Holds a roll call (pivot 7.4): each member votes with or against the sponsor's party, and the
 * tally is then nudged, lowest member first, until it comes out as the script says (`passes`).
 */
export function holdVote(
  rs: RecordsState,
  pol: MockPolitics,
  bill: BillId,
  chamber: Chamber,
  question: string,
  date: SimDate,
  need: VoteNeed,
  passes: boolean,
  rng: MockRng,
): RollCallRow {
  const b = rs.bills[bill] as MockBill;
  const sponsorParty = (pol.people[b.sponsor] as { party: string | null }).party;
  const members = chamber === "House" ? pol.reps : pol.senators.map((s) => s.person);
  const votes: RollCallVotes["votes"] = members.map((person) => {
    if (rng.chance(NOT_VOTING)) return { person, vote: "NotVoting" };
    const own = (pol.people[person] as { party: string | null }).party === sponsorParty;
    return { person, vote: rng.chance(own ? VOTE_WITH_OWN : VOTE_WITH_OTHER) ? "Yea" : "Nay" };
  });
  const tally = () => {
    const yeas = votes.filter((v) => v.vote === "Yea").length;
    const nays = votes.filter((v) => v.vote === "Nay").length;
    const bar =
      need === "Majority"
        ? Math.floor((yeas + nays) / 2) + 1
        : Math.ceil(members.length * (need === "Cloture" ? CLOTURE_SHARE : OVERRIDE_SHARE));
    return { yeas, nays, passed: yeas >= bar };
  };
  for (let i = 0; i < votes.length && tally().passed !== passes; i++) {
    const v = votes[i] as RollCallVotes["votes"][number];
    if (passes && v.vote !== "Yea") v.vote = "Yea";
    else if (!passes && v.vote === "Yea") v.vote = "Nay";
  }
  const row: RollCallRow = { id: rs.roll_calls.length, bill, chamber, date, question, ...tally() };
  rs.roll_calls.push(row);
  rs.votes.push(votes);
  b.last_action = date;
  return row;
}

/** Moves a bill to a stage (pivot 7.1); a law takes effect on `effective`. */
export function setStage(
  rs: RecordsState,
  bill: BillId,
  stage: BillStage,
  date: SimDate,
  effective: SimDate | null = null,
): void {
  const b = rs.bills[bill] as MockBill;
  rs.bills[bill] = { ...b, stage, last_action: date, effective: effective ?? b.effective };
}

export function addAction(rs: RecordsState, a: Omit<ExecActionRow, "id">): ExecActionRow {
  const row = { id: rs.actions.length, ...a };
  rs.actions.push(row);
  return row;
}

/**
 * Every campaign on a ballot files for the period ending `through` (pivot 6.3, 8.6): `weeks` of
 * receipts, most of it spent. Updates what each candidate has raised and holds.
 */
export function fileReports(
  rs: RecordsState,
  pol: MockPolitics,
  through: SimDate,
  weeks: number,
  rng: MockRng,
): void {
  for (const r of pol.races) {
    for (const i of r.ballot) {
      const c = r.candidates[i] as MockCandidate;
      const raised = Math.floor(c.weekly * weeks * rng.range(0.7, 1.4));
      const spent = Math.min((c.cash ?? 0) + raised, Math.floor(raised * rng.range(0.8, 1.3)));
      c.raised = (c.raised ?? 0) + raised;
      c.cash = (c.cash ?? 0) + raised - spent;
      rs.filings.push({ race: r.id, person: c.person, through, raised, spent, cash: c.cash });
    }
  }
}

export function genRecords(base: MockWorld, pol: MockPolitics, geo: MockGeo, rng: MockRng): RecordsState {
  const industries = Math.max(1, base.data.industries.rows.length);
  const industry = () => rng.int(industries);
  const industryName = (i: number) => base.data.industries.rows[i]?.name ?? "industry";
  const member = (party: string) => {
    const pool = [...pol.reps, ...pol.senators.map((s) => s.person)].filter(
      (p) => (pol.people[p] as { party: string | null }).party === party,
    );
    return (pool.length > 0 ? rng.pick(pool) : (pol.reps[0] as PersonId)) as PersonId;
  };
  const inc = pol.incumbent_party;
  const opp = other(inc);
  const telecom = industry();
  const data = industry();
  const platform = industry();
  const growthState = rng.pick(geo.states);
  const jan = { year: 2021, month: 1, day: 1 };
  const bill = (
    id: BillId,
    title: string,
    summary: string,
    sponsorParty: string,
    subject: string,
    stage: BillStage,
    changes: LeverChange[],
    introduced: SimDate,
    last_action: SimDate,
    effective: SimDate | null = null,
  ): MockBill => ({
    id,
    title,
    summary,
    sponsor: member(sponsorParty),
    subject,
    stage,
    changes,
    introduced,
    last_action,
    effective,
  });
  const rs: RecordsState = {
    bills: [
      bill(
        BILL.broadband,
        "Rural Broadband Expansion Act",
        `Subsidises network build-out in ${industryName(telecom)} for counties under 40,000 people.`,
        inc,
        "Infrastructure",
        "Law",
        [{ lever: "subsidy", index: telecom, to: 0.02 }],
        ymd(3, 10),
        ymd(7, 30),
        jan,
      ),
      bill(
        BILL.infrastructure,
        "Grid and Infrastructure Renewal Act",
        "A five-year programme of federal spending on the power grid, roads and ports.",
        inc,
        "Budget",
        "HouseFloor",
        [{ lever: "fiscal", index: null, to: 0.004 }],
        ymd(6, 9),
        ymd(8, 6),
      ),
      bill(
        BILL.tax,
        "Corporate Rate Adjustment Act",
        `Sets the corporate tax rate at ${inc === "Democrats" ? 25 : 18}%.`,
        inc,
        "Tax",
        "Committee",
        [{ lever: "corp_tax", index: null, to: inc === "Democrats" ? 0.25 : 0.18 }],
        ymd(7, 14),
        ymd(7, 14),
      ),
      bill(
        BILL.tariff,
        "Data Tariff Act",
        `Places a tariff on imported ${industryName(data)} goods and services.`,
        opp,
        "Trade",
        "Committee",
        [{ lever: "tariff", index: data, to: 0.1 }],
        ymd(5, 5),
        ymd(6, 22),
      ),
      bill(
        BILL.platform,
        "Platform Accountability Act",
        `Tightens rules on ${industryName(platform)} and caps the growth of its largest firm.`,
        opp,
        "Regulation",
        "SenateFloor",
        [
          { lever: "regulation", index: platform, to: 0.03 },
          { lever: "antitrust", index: platform, to: 0.4 },
        ],
        ymd(2, 11),
        ymd(7, 1),
      ),
      bill(
        BILL.growth,
        "State Growth Compact Act",
        `Federal matching funds for ${growthState.name}'s development zones.`,
        inc,
        "Regional development",
        "Drafted",
        [{ lever: "state_growth", index: growthState.id, to: 0.003 }],
        ymd(8, 18),
        ymd(8, 18),
      ),
      bill(
        BILL.border,
        "Border Adjustment Tax Act",
        "Taxes imports and exempts exports under the corporate tax.",
        opp,
        "Tax",
        "President",
        [{ lever: "tariff", index: industry(), to: 0.05 }],
        ymd(1, 21),
        ymd(8, 13),
      ),
    ],
    roll_calls: [],
    votes: [],
    actions: [],
    filings: [],
  };
  // What had already happened by the time the mock's history starts.
  holdVote(rs, pol, BILL.platform, "House", "On passage", ymd(7, 1), "Majority", true, rng);
  holdVote(rs, pol, BILL.broadband, "House", "On passage", ymd(6, 18), "Majority", true, rng);
  holdVote(rs, pol, BILL.broadband, "Senate", "On passage", ymd(7, 22), "Majority", true, rng);
  holdVote(rs, pol, BILL.border, "House", "On passage", ymd(7, 9), "Majority", true, rng);
  holdVote(rs, pol, BILL.border, "Senate", "On passage", ymd(8, 13), "Majority", true, rng);
  rs.roll_calls.sort((a, b) => a.date.month * 100 + a.date.day - (b.date.month * 100 + b.date.day));
  // Roll call ids are places in date order: renumber, keeping each one's votes with it.
  const byOld = rs.roll_calls.map((r) => rs.votes[r.id] as RollCallVotes["votes"]);
  rs.roll_calls = rs.roll_calls.map((r, i) => ({ ...r, id: i }));
  rs.votes = byOld;
  (rs.bills[BILL.broadband] as MockBill).last_action = ymd(7, 30);
  (rs.bills[BILL.platform] as MockBill).last_action = ymd(7, 1);
  (rs.bills[BILL.border] as MockBill).last_action = ymd(8, 13);

  addAction(rs, {
    date: { year: 2017, month: 1, day: 23 },
    kind: "Nomination",
    actor: pol.president,
    subject: pol.treasury,
    text: "Nominated to be Secretary of the Treasury.",
    changes: [],
  });
  addAction(rs, {
    date: { year: 2017, month: 2, day: 13 },
    kind: "Confirmation",
    actor: null,
    subject: pol.treasury,
    text: "Confirmed by the Senate as Secretary of the Treasury.",
    changes: [],
  });
  addAction(rs, {
    date: ymd(3, 19),
    kind: "Order",
    actor: pol.president,
    subject: null,
    text: `Executive order easing federal review of ${industryName(platform)} permits.`,
    changes: [{ lever: "regulation", index: platform, to: -0.01 }],
  });
  // The filing for the second quarter: what each campaign had raised by the summer.
  for (const r of pol.races) {
    for (const i of r.ballot) {
      const c = r.candidates[i] as MockCandidate;
      const raised = c.raised ?? 0;
      rs.filings.push({
        race: r.id,
        person: c.person,
        through: ymd(6, 30),
        raised,
        spent: raised - (c.cash ?? 0),
        cash: c.cash ?? 0,
      });
    }
  }
  return rs;
}

/** Where a bill's stage puts it, for its history line (D1037). */
const STAGE_TEXT: Readonly<Record<BillStage, string>> = {
  Drafted: "Drafted",
  Committee: "Referred to committee",
  HouseFloor: "Reported to the House floor",
  SenateFloor: "Reported to the Senate floor",
  Conference: "Sent to conference",
  President: "Presented to the President",
  Law: "Became law",
  Dead: "Died",
};

/**
 * v_records. Every mock bill starts in the House (D1037); its history is its introduction, each roll
 * call on it, and its stage now.
 */
export function recordsView(rs: RecordsState): RecordsView {
  return {
    bills: rs.bills.map((b) => ({
      ...b,
      chamber_of_origin: "House",
      actions: [
        { date: b.introduced, chamber: "House", text: "Introduced", roll_call: null },
        ...rs.roll_calls
          .filter((r) => r.bill === b.id)
          .map((r) => ({
            date: r.date,
            chamber: r.chamber,
            text: `${r.question}: ${r.passed ? "agreed to" : "failed"} ${r.yeas} to ${r.nays}`,
            roll_call: r.id,
          })),
        ...(b.stage === "Drafted" || b.stage === "Committee"
          ? []
          : [{ date: b.last_action, chamber: null, text: STAGE_TEXT[b.stage], roll_call: null }]),
      ],
    })),
    roll_calls: rs.roll_calls.slice(),
    actions: rs.actions.slice(),
    filings: rs.filings.slice(),
  };
}

/** How each member voted in one roll call: the slice of v_records (`RollCallVotes`). */
export function rollCallVotes(rs: RecordsState, roll_call: number): RollCallVotes | null {
  const votes = rs.votes[roll_call];
  return votes === undefined ? null : { roll_call, votes: votes.slice() };
}
