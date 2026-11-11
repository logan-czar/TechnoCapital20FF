// The mock's betting exchange (v_markets; pivot 10, 11): contracts of every kind of pivot 10.2 in
// groups, each with its written rule, a price that walks toward what the published information
// implies (the forecast before the vote, the count on election night, the script for governing and
// people contracts), and an order book around that price.
//
// A row carries the best bid and ask. A contract's depth and price history are `contractBook` and
// `contractHistory`, the slices `{ view: "markets", slice: "book" | "history", contract }` (D1037).
// The mock has no cohorts (pivot 11.3): one market belief per contract stands in for them.

import {
  type BookLevel,
  CONTRACT_CLOSES_KEPT,
  type ContractBook,
  type ContractHistory,
  type ContractId,
  type ContractKind,
  type ContractRow,
  type ContractStatus,
  type DateTime,
  type EntityRef,
  type InstrumentId,
  type MarketsView,
  type OrderRow,
  type OrderSide,
  type Party,
  type PersonId,
  type SimDate,
} from "@tc20ff/sim";
import {
  ballotOdds,
  distBetween,
  type ForecastModel,
  normalCdf,
  type Outlook,
  pDem,
  totalEv,
} from "./forecast.ts";
import type { MockGeo, MockState } from "./geo.ts";
import { ballotCandidate, type MockPolitics, type MockRace, other } from "./races.ts";
import { BILL, type RecordsState } from "./records.ts";
import { type MockRng, unitHash } from "./rng.ts";
import { MOCK_HISTORY_START, PARTIES, ymd } from "./script.ts";

/** Price levels a book shows on each side (pivot 11.2). */
export const BOOK_LEVELS = 6;
/** How fast the market's belief moves to what the news implies, an hour: before the vote and during the count. */
const BELIEF_SPEED = 0.08;
const BELIEF_SPEED_COUNT = 0.5;
/** The hourly noise in a belief, as a probability. */
const BELIEF_NOISE = 0.004;
/** How far a belief may tilt from fair for good: the partisans' thumb on the scale (pivot 11.4). */
const BELIEF_TILT = 0.04;
/** How far sweeping a whole side of the book moves the belief (pivot 11.2). */
const IMPACT = 0.06;
/** A belief stays inside this, so a price stays inside 1 to 99 cents. */
const BELIEF_MIN = 0.004;

/** What a contract's fair chance is read from. Totals are party A's. */
export type Fair =
  | { kind: "RaceWinner"; race: number; ballot: number }
  | { kind: "Chamber"; chamber: "House" | "Senate"; party: Party }
  | { kind: "SenateSeats"; lo: number; hi: number }
  | { kind: "Ev"; lo: number; hi: number }
  /** The national popular margin in points, `lo` inclusive to `hi` exclusive. */
  | { kind: "PopVote"; lo: number; hi: number }
  /** A scripted chance: `MarketState.targets[key]`. */
  | { kind: "Script"; key: string };

export interface MockContract {
  id: ContractId;
  kind: ContractKind;
  group: number | null;
  title: string;
  rule: string;
  subject: EntityRef | null;
  listed: SimDate;
  deadline: SimDate | null;
  fair: Fair;
  /** The size of a price level near the touch, in contracts. */
  liquidity: number;
  /** The gap between bid and ask, in cents. */
  spread: number;
  tilt: number;
  status: ContractStatus;
  outcome: boolean | null;
  /** The market's chance, 0 to 1, and the price it implies, in cents. */
  belief: number;
  mid: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume: number;
  open_interest: number;
  /** Resting orders that are not the player's, best first. */
  bids: BookLevel[];
  asks: BookLevel[];
  /** The price each hour from `history_start`, in whole cents. */
  history_start: DateTime;
  history: number[];
  /** Who, which party and what range it is about (D1037). */
  person: PersonId | null;
  party: Party | null;
  bracket: { lo: number | null; hi: number | null } | null;
  /** Each day's closing price, oldest first, the last `CONTRACT_CLOSES_KEPT`. */
  closes: number[];
}

/** A contract's hourly prices: the `history` slice (D1037). */
export type MockContractHistory = ContractHistory;

export interface MarketState {
  contracts: MockContract[];
  groups: number;
  /** The scripted chances, by key (`Fair` Script). */
  targets: Record<string, number>;
  /** The contracts the script names. */
  named: Record<string, ContractId>;
}

export interface NewContract {
  kind: ContractKind;
  group: number | null;
  title: string;
  rule: string;
  subject: EntityRef | null;
  listed: SimDate;
  deadline?: SimDate;
  fair: Fair;
  liquidity: number;
  status?: ContractStatus;
  /** Who, which party and what range it is about; read from `fair` when absent. */
  person?: PersonId | null;
  party?: Party | null;
  bracket?: { lo: number | null; hi: number | null } | null;
}

const NO_REFUND = "There are no refunds.";

/** Lists a contract (pivot 10.3). Its belief starts at `start`. */
export function listContract(
  ms: MarketState,
  def: NewContract,
  start: number,
  t: DateTime,
  name?: string,
): MockContract {
  const id = ms.contracts.length as ContractId;
  const c: MockContract = {
    id,
    kind: def.kind,
    group: def.group,
    title: def.title,
    rule: def.rule,
    subject: def.subject,
    listed: def.listed,
    deadline: def.deadline ?? null,
    fair: def.fair,
    liquidity: def.liquidity,
    spread: def.liquidity >= 1000 ? 1 : def.liquidity >= 300 ? 2 : 3,
    tilt: (unitHash(def.title, 5) - 0.5) * 2 * BELIEF_TILT,
    status: def.status ?? "Open",
    outcome: null,
    belief: Math.min(1 - BELIEF_MIN, Math.max(BELIEF_MIN, start)),
    mid: 50,
    bid: null,
    ask: null,
    last: null,
    volume: 0,
    open_interest: Math.floor(def.liquidity * (3 + 6 * unitHash(def.title, 6))),
    bids: [],
    asks: [],
    history_start: t,
    history: [],
    person: def.person ?? null,
    party: def.party ?? null,
    bracket: def.bracket ?? null,
    closes: [],
  };
  ms.contracts.push(c);
  if (name !== undefined) ms.named[name] = id;
  return c;
}

/** A contract's fair chance from what is published (pivot 11.4, 11.5): never from a hidden truth. */
export function fairOf(c: MockContract, ms: MarketState, pol: MockPolitics, m: ForecastModel): number {
  const f = c.fair;
  switch (f.kind) {
    case "RaceWinner": {
      const r = pol.races[f.race] as MockRace;
      const dem = r.office === "President" ? m.pres_dem : pDem(m.outlooks[r.id] as Outlook);
      return ballotOdds(r, dem)[f.ballot] as number;
    }
    case "Chamber": {
      const d = f.chamber === "House" ? m.house_dem : m.senate_dem;
      return f.party === "Democrats" ? d : 1 - d;
    }
    case "SenateSeats":
      return distBetween(m.senate, f.lo, f.hi);
    case "Ev":
      return distBetween(m.ev, f.lo, f.hi);
    case "PopVote": {
      const o = m.outlooks[0] as Outlook;
      return normalCdf((f.hi - o.margin) / o.sigma) - normalCdf((f.lo - o.margin) / o.sigma);
    }
    case "Script":
      return ms.targets[f.key] ?? 0.5;
  }
}

/** Rebuilds the resting orders around the bid and ask (pivot 11.2): deeper away from the touch. */
function buildBook(c: MockContract, t: DateTime): void {
  const day = Math.floor(t / 24);
  const level = (price: number, k: number): BookLevel => ({
    price,
    qty: Math.max(1, Math.floor(c.liquidity * (1 + 0.5 * k) * (0.5 + unitHash(`${c.id}:${price}`, day)))),
  });
  c.bids = [];
  c.asks = [];
  for (let k = 0; k < BOOK_LEVELS; k++) {
    if (c.bid !== null && c.bid - k >= 1) c.bids.push(level(c.bid - k, k));
    if (c.ask !== null && c.ask + k <= 99) c.asks.push(level(c.ask + k, k));
  }
}

/** Sets the bid and ask from the mid price; true when either moved. */
function requote(c: MockContract, t: DateTime): boolean {
  const s = c.spread;
  const low = s % 2 === 1 ? Math.floor(c.mid) - (s - 1) / 2 : Math.floor(c.mid + 0.5) - s / 2;
  const bid = low >= 1 ? low : null;
  const ask = low + s <= 99 ? low + s : null;
  const moved = bid !== c.bid || ask !== c.ask || c.bids.length + c.asks.length === 0;
  if (!moved) return false;
  const up = (bid ?? 0) + (ask ?? 100) > (c.bid ?? 0) + (c.ask ?? 100);
  c.bid = bid;
  c.ask = ask;
  c.last = up ? (ask ?? bid) : (bid ?? ask);
  buildBook(c, t);
  return true;
}

/**
 * One hour of trading (pivot 11.4, much reduced): each open contract's belief moves toward its fair
 * chance with some noise, a group's beliefs are scaled to sum to one, and the quotes follow. True
 * when any row changed.
 */
export function marketStep(
  ms: MarketState,
  pol: MockPolitics,
  model: ForecastModel,
  counting: boolean,
  t: DateTime,
  rng: MockRng,
): boolean {
  const speed = counting ? BELIEF_SPEED_COUNT : BELIEF_SPEED;
  const sums = new Array<number>(ms.groups).fill(0);
  const open = ms.contracts.filter((c) => c.status === "Open");
  for (const c of open) {
    const fair = Math.min(1 - BELIEF_MIN, Math.max(BELIEF_MIN, fairOf(c, ms, pol, model) * (1 + c.tilt)));
    c.belief += speed * (fair - c.belief) + BELIEF_NOISE * (c.spread > 1 ? 2 : 1) * rng.normal();
    c.belief = Math.min(1 - BELIEF_MIN, Math.max(BELIEF_MIN, c.belief));
    if (c.group !== null) sums[c.group] = (sums[c.group] as number) + c.belief;
  }
  let changed = false;
  for (const c of open) {
    if (c.group !== null) c.belief /= sums[c.group] as number;
    c.mid = Math.min(99.4, Math.max(0.6, 100 * c.belief));
    if (requote(c, t)) {
      c.volume += Math.floor(c.liquidity * (0.05 + 0.3 * rng.next()));
      changed = true;
    }
  }
  for (const c of ms.contracts) {
    if (c.status === "Open") c.history.push(Math.min(99, Math.max(1, Math.floor(c.mid + 0.5))));
  }
  return changed;
}

/** A new day: the day's volume starts again, and an open contract's close is kept (D1037). */
export function marketNewDay(ms: MarketState): void {
  for (const c of ms.contracts) {
    c.volume = 0;
    if (c.status !== "Open") continue;
    c.closes.push(c.last ?? Math.min(99, Math.max(1, Math.floor(c.mid + 0.5))));
    if (c.closes.length > CONTRACT_CLOSES_KEPT) c.closes.shift();
  }
}

/**
 * Fills up to `qty` against the resting orders (pivot 11.1): a buy takes the asks from the best up
 * to `limit`, a sell the bids down to it. Returns the fills, best price first, and moves the belief
 * by how much of the book was swept (pivot 11.2).
 */
export function takeLiquidity(
  c: MockContract,
  side: OrderSide,
  qty: number,
  limit: number | null,
): { price: number; qty: number }[] {
  const levels = side === "Buy" ? c.asks : c.bids;
  const fills: { price: number; qty: number }[] = [];
  let left = qty;
  while (left > 0 && levels.length > 0) {
    const top = levels[0] as BookLevel;
    if (limit !== null && (side === "Buy" ? top.price > limit : top.price < limit)) break;
    const take = Math.min(left, top.qty);
    fills.push({ price: top.price, qty: take });
    left -= take;
    if (take === top.qty) levels.shift();
    else levels[0] = { price: top.price, qty: top.qty - take };
  }
  const filled = qty - left;
  if (filled > 0) {
    const swept = Math.min(1, filled / (c.liquidity * BOOK_LEVELS));
    c.belief = Math.min(
      1 - BELIEF_MIN,
      Math.max(BELIEF_MIN, c.belief + (side === "Buy" ? IMPACT : -IMPACT) * swept),
    );
    c.last = (fills[fills.length - 1] as { price: number }).price;
    c.volume += filled;
    c.open_interest += filled;
    c.bid = c.bids[0]?.price ?? null;
    c.ask = c.asks[0]?.price ?? null;
  }
  return fills;
}

/** Trading stops and the resolution is awaited (pivot 10.4). */
export function closeContract(c: MockContract): void {
  if (c.status === "Resolved") return;
  c.status = "Closed";
  c.bid = null;
  c.ask = null;
  c.bids = [];
  c.asks = [];
}

export function resolveContract(c: MockContract, outcome: boolean): void {
  closeContract(c);
  c.status = "Resolved";
  c.outcome = outcome;
  c.last = outcome ? 99 : 1;
}

function row(c: MockContract, orders: readonly OrderRow[]): ContractRow {
  // The player's own resting orders are part of the book (pivot 11.1).
  let bid = c.bid;
  let ask = c.ask;
  if (c.status === "Open") {
    for (const o of orders) {
      if (o.status !== "Open" || o.limit === null || o.instrument !== (c.id as number)) continue;
      if (o.side === "Buy" && (bid === null || o.limit > bid)) bid = o.limit;
      if (o.side === "Sell" && (ask === null || o.limit < ask)) ask = o.limit;
    }
  }
  return {
    id: c.id,
    instrument: c.id as number as InstrumentId,
    kind: c.kind,
    group: c.group,
    title: c.title,
    rule: c.rule,
    subject: c.subject,
    person: c.person,
    party: c.party,
    bracket: c.bracket,
    status: c.status,
    listed: c.listed,
    deadline: c.deadline,
    outcome: c.outcome,
    bid,
    ask,
    last: c.last,
    prev_close: c.closes.at(-1) ?? null,
    closes: c.closes.slice(),
    volume: c.volume,
    open_interest: c.open_interest,
  };
}

/** v_markets. `orders` are the player's exchange orders. */
export function marketsView(ms: MarketState, orders: readonly OrderRow[]): MarketsView {
  return { contracts: ms.contracts.map((c) => row(c, orders)) };
}

/** A contract's depth, the player's resting orders included: the slice of v_markets (`ContractBook`). */
export function contractBook(
  ms: MarketState,
  id: ContractId,
  orders: readonly OrderRow[],
  t: DateTime,
): ContractBook | null {
  const c = ms.contracts[id];
  if (c === undefined) return null;
  const bids = c.bids.map((l) => ({ ...l }));
  const asks = c.asks.map((l) => ({ ...l }));
  for (const o of orders) {
    if (o.status !== "Open" || o.limit === null || o.instrument !== (id as number) || c.status !== "Open")
      continue;
    const side = o.side === "Buy" ? bids : asks;
    const at = side.find((l) => l.price === o.limit);
    if (at) at.qty += o.qty - o.filled;
    else side.push({ price: o.limit, qty: o.qty - o.filled });
  }
  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);
  return { contract: id, time: t, bids, asks };
}

export function contractHistory(ms: MarketState, id: ContractId): MockContractHistory | null {
  const c = ms.contracts[id];
  return c === undefined ? null : { contract: id, start: c.history_start, prices: c.history.slice() };
}

// ---------------------------------------------------------------- the listings

const LIQUIDITY = { President: 4000, Senate: 600, Governor: 400, House: 120 } as const;

/** Every contract listed when the mock's history starts (pivot 10.2, 10.3). */
export function genMarkets(
  pol: MockPolitics,
  geo: MockGeo,
  rs: RecordsState,
  start: ForecastModel,
): MarketState {
  const ms: MarketState = {
    contracts: [],
    groups: 0,
    targets: {
      infra_law: 0.4,
      tax_senate: 0.12,
      shutdown: 0.15,
      map_struck: 0.2,
      leaves: 0.07,
      retire: 0.2,
      cabinet: 0.05,
    },
    named: {},
  };
  const t = MOCK_HISTORY_START;
  const name = (id: number) => (pol.people[id] as { name: string }).name;
  const jan = ymd(1, 6);
  // Who, which party and what range a contract is about, from what it is read from (D1037).
  const about = (def: NewContract): NewContract => {
    const f = def.fair;
    const open = (v: number, edge: number) => (v === edge ? null : v);
    switch (f.kind) {
      case "RaceWinner": {
        const cand = ballotCandidate(pol.races[f.race] as MockRace, f.ballot);
        return { ...def, person: cand.person, party: cand.party };
      }
      case "Chamber":
        return { ...def, party: f.party };
      case "SenateSeats":
        return {
          ...def,
          party: "Democrats",
          bracket: { lo: open(f.lo, 0), hi: open(f.hi, pol.senators.length) },
        };
      case "Ev":
        return { ...def, party: "Democrats", bracket: { lo: open(f.lo, 0), hi: open(f.hi, totalEv(geo)) } };
      case "PopVote":
        return { ...def, party: "Democrats", bracket: { lo: open(f.lo, -200), hi: open(f.hi, 200) } };
      case "Script":
        return def;
    }
  };
  const add = (def: NewContract, key?: string) => {
    const c = listContract(ms, about(def), 0.5, t, key);
    c.belief = Math.min(1 - BELIEF_MIN, Math.max(BELIEF_MIN, fairOf(c, ms, pol, start)));
    return c;
  };

  // 1. Race winners: one contract per candidate in each primary and general (pivot 10.2 item 1).
  const pres = pol.races[0] as MockRace;
  const primaryParty = other(pol.incumbent_party);
  const primary = ms.groups++;
  for (const cand of pres.candidates.filter((c) => c.party === primaryParty)) {
    const c = add({
      kind: "RaceWinner",
      group: primary,
      title: `${name(cand.person)} wins the ${primaryParty === "Democrats" ? "Democratic" : "Republican"} presidential nomination`,
      rule: `Resolves Yes if ${name(cand.person)} is the party's certified nominee for President in 2020. Resolves No otherwise, for any reason. ${NO_REFUND}`,
      subject: { kind: "Race", id: pres.id },
      listed: jan,
      fair: { kind: "Script", key: "settled" },
      liquidity: 800,
      person: cand.person,
      party: cand.party,
    });
    resolveContract(c, cand.person === pol.challenger);
    c.open_interest = 0;
  }
  for (const r of pol.races) {
    const group = ms.groups++;
    r.ballot.forEach((_, i) => {
      const who = name(ballotCandidate(r, i).person);
      add({
        kind: "RaceWinner",
        group,
        title: r.office === "President" ? `${who} wins the presidency` : `${who} wins ${r.title}`,
        rule: `Resolves Yes if ${who} is the certified winner of the 2020 general election for ${r.title}. Resolves No otherwise, for any reason, including withdrawal or death. ${NO_REFUND}`,
        subject: { kind: "Race", id: r.id },
        listed: r.office === "President" ? ymd(3, 4) : ymd(8, 5),
        fair: { kind: "RaceWinner", race: r.id, ballot: i },
        liquidity: LIQUIDITY[r.office],
      });
    });
  }

  // 2. Chambers and brackets (pivot 10.2 item 2).
  for (const chamber of ["House", "Senate"] as const) {
    const group = ms.groups++;
    for (const party of PARTIES) {
      add({
        kind: "Chamber",
        group,
        title: `${party} control the ${chamber} after the 2020 election`,
        rule: `Resolves Yes if the ${party}, or their legal successor, hold more ${chamber} seats than any other party once every race is certified. A tie resolves for the party of the certified president-elect. ${NO_REFUND}`,
        subject: null,
        listed: ymd(3, 4),
        fair: { kind: "Chamber", chamber, party },
        liquidity: 1500,
      });
    }
  }
  const mid =
    pol.senators.filter((s) => !s.up && s.party === "Democrats").length +
    pol.senators.filter((s) => s.up).length / 2;
  const seats = pol.senators.length;
  const senateGroup = ms.groups++;
  for (const [lo, hi] of [
    [0, mid - 2],
    [mid - 1, mid - 1],
    [mid, mid],
    [mid + 1, mid + 1],
    [mid + 2, seats],
  ] as const) {
    add({
      kind: "Bracket",
      group: senateGroup,
      title:
        lo === hi
          ? `Democrats hold exactly ${lo} Senate seats`
          : lo === 0
            ? `Democrats hold ${hi} Senate seats or fewer`
            : `Democrats hold ${lo} Senate seats or more`,
      rule: `Resolves Yes if the Democrats hold ${lo === hi ? `exactly ${lo}` : lo === 0 ? `${hi} or fewer` : `${lo} or more`} of the ${seats} Senate seats once every 2020 race is certified, counting seats not up this year. ${NO_REFUND}`,
      subject: null,
      listed: ymd(6, 1),
      fair: { kind: "SenateSeats", lo, hi },
      liquidity: 500,
    });
  }
  const ev = totalEv(geo);
  const win = Math.floor(ev / 2) + 1;
  const evGroup = ms.groups++;
  for (const [lo, hi] of [
    [0, win - 8],
    [win - 7, win - 1],
    [win, win + 6],
    [win + 7, ev],
  ] as const) {
    add({
      kind: "Bracket",
      group: evGroup,
      title: `The Democratic ticket wins ${lo} to ${hi} electoral votes`,
      rule: `Resolves Yes if the Democratic candidate for President is certified the winner of states with ${lo} to ${hi} of the ${ev} electoral votes. ${NO_REFUND}`,
      subject: { kind: "Race", id: pres.id },
      listed: ymd(6, 1),
      fair: { kind: "Ev", lo, hi },
      liquidity: 500,
    });
  }
  const popGroup = ms.groups++;
  const pops: readonly (readonly [number, number, string])[] = [
    [-200, -5, "the Republican by 5 points or more"],
    [-5, 0, "the Republican by under 5 points"],
    [0, 5, "the Democrat by under 5 points"],
    [5, 200, "the Democrat by 5 points or more"],
  ];
  for (const [lo, hi, text] of pops) {
    add({
      kind: "Bracket",
      group: popGroup,
      title: `The popular vote for President goes to ${text}`,
      rule: `Resolves Yes if the certified national popular vote for President favours ${text}, as a share of all votes cast. An exact tie counts for the Democrat. ${NO_REFUND}`,
      subject: { kind: "Race", id: pres.id },
      listed: ymd(6, 1),
      fair: { kind: "PopVote", lo, hi },
      liquidity: 500,
    });
  }

  // 3. Governing (pivot 10.2 item 3).
  const billTitle = (id: number) => (rs.bills[id] as { title: string }).title;
  add(
    {
      kind: "Governing",
      group: null,
      title: `The ${billTitle(BILL.infrastructure)} becomes law by 31 October`,
      rule: `Resolves Yes if the ${billTitle(BILL.infrastructure)} is signed by the President, or becomes law without a signature or over a veto, on or before 31 October 2020. Resolves No at the end of that day otherwise. ${NO_REFUND}`,
      subject: { kind: "Bill", id: BILL.infrastructure },
      listed: ymd(6, 10),
      deadline: ymd(10, 31),
      fair: { kind: "Script", key: "infra_law" },
      liquidity: 300,
    },
    "infra_law",
  );
  add(
    {
      kind: "Governing",
      group: null,
      title: `The ${billTitle(BILL.tax)} passes the Senate by 6 November`,
      rule: `Resolves Yes if the Senate passes the ${billTitle(BILL.tax)} on or before 6 November 2020. Resolves No at the end of that day otherwise. ${NO_REFUND}`,
      subject: { kind: "Bill", id: BILL.tax },
      listed: ymd(7, 15),
      deadline: ymd(11, 6),
      fair: { kind: "Script", key: "tax_senate" },
      liquidity: 300,
    },
    "tax_senate",
  );
  add(
    {
      kind: "Governing",
      group: null,
      title: "A federal government shutdown begins by 11 December",
      rule: `Resolves Yes if appropriations lapse and a shutdown of the federal government begins on or before 11 December 2020. Resolves No at the end of that day otherwise. ${NO_REFUND}`,
      subject: null,
      listed: ymd(8, 3),
      deadline: ymd(12, 11),
      fair: { kind: "Script", key: "shutdown" },
      liquidity: 300,
    },
    "shutdown",
  );
  const drawn = geo.states.filter((s) => s.drawn_by !== null);
  const mapState = drawn.reduce((a, b) => (b.plan_strength > a.plan_strength ? b : a), drawn[0] as MockState);
  add(
    {
      kind: "Governing",
      group: null,
      title: `${mapState.name}'s House map is struck down by 31 December`,
      rule: `Resolves Yes if a court strikes down ${mapState.name}'s congressional district plan on or before 31 December 2020. Resolves No at the end of that day otherwise. ${NO_REFUND}`,
      subject: { kind: "State", id: mapState.id },
      listed: ymd(7, 1),
      deadline: ymd(12, 31),
      fair: { kind: "Script", key: "map_struck" },
      liquidity: 200,
    },
    "map_struck",
  );

  // 4. People (pivot 10.2 item 4).
  add(
    {
      kind: "Person",
      group: null,
      title: `${name(pol.interior)} leaves office as Secretary of the Interior by 30 November`,
      rule: `Resolves Yes if ${name(pol.interior)} resigns, is dismissed or otherwise ceases to be Secretary of the Interior on or before 30 November 2020. Resolves No at the end of that day otherwise. ${NO_REFUND}`,
      subject: { kind: "Person", id: pol.interior },
      listed: ymd(8, 3),
      deadline: ymd(11, 30),
      fair: { kind: "Script", key: "leaves" },
      liquidity: 200,
    },
    "leaves",
  );
  add(
    {
      kind: "Person",
      group: null,
      title: `${name(pol.retiree)} announces retirement from the Senate by 31 December`,
      rule: `Resolves Yes if ${name(pol.retiree)} publicly announces that they will not seek another term, or resigns, on or before 31 December 2020. Resolves No at the end of that day otherwise. ${NO_REFUND}`,
      subject: { kind: "Person", id: pol.retiree },
      listed: ymd(8, 3),
      deadline: ymd(12, 31),
      fair: { kind: "Script", key: "retire" },
      liquidity: 200,
    },
    "retire",
  );
  const hopeful = (pres.candidates[1] as { person: number }).person;
  add(
    {
      kind: "Person",
      group: null,
      title: `${name(hopeful)} is nominated to the Cabinet by 31 December`,
      rule: `Resolves Yes if the President or the certified president-elect names ${name(hopeful)} for a Cabinet post on or before 31 December 2020. Resolves No at the end of that day otherwise. ${NO_REFUND}`,
      subject: { kind: "Person", id: hopeful },
      listed: ymd(8, 3),
      deadline: ymd(12, 31),
      fair: { kind: "Script", key: "cabinet" },
      liquidity: 200,
    },
    "cabinet",
  );
  for (const c of ms.contracts) {
    if (c.status !== "Open") continue;
    c.mid = 100 * c.belief;
    requote(c, t);
  }
  return ms;
}
