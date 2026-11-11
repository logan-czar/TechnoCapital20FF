// The mock's cast and races (v_races; pivot 5.8, 6.1, 6.2, 6.7): who holds what, the 48 races of
// the 2020 general (President, 12 Senate, 30 House, 5 Governor), their candidates, and the truth of
// each race: its final vote by county, fixed at generation and hidden until it is counted (pivot
// 9.1). Polls sample it (polls.ts) and election night reports it (returns.ts).

import type {
  CandidateStatus,
  CountyId,
  DateTime,
  ElectedOffice,
  Party,
  PersonId,
  RaceId,
  RaceStatus,
  RacesView,
  SimDate,
} from "@tc20ff/sim";
import type { MockWorld } from "../mockWorld.ts";
import { type MockCounty, type MockGeo, type MockState, shareLean } from "./geo.ts";
import { held, type MockPerson, PeopleGen, past } from "./people.ts";
import type { MockRng } from "./rng.ts";
import {
  CERTIFICATION_DATE,
  MOCK_CYCLE,
  PARTIES,
  RECOUNT_CERTIFICATION_DATE,
  SCRIPT,
  ymd,
} from "./script.ts";

/** A margin under this many points is recounted (pivot 9.4 `RECOUNT_MARGIN`; a mock number). */
export const RECOUNT_MARGIN = 0.5;
/** The margin the mock forces on its one recount race, in points. */
const NAILBITER_MARGIN = 0.25;
/** Points an incumbent is worth (pivot 6.7). */
const INCUMBENCY_PTS = 3;
/** How far a race's polls start from its final margin, in points (one standard deviation). */
const TREND_PTS = 3;
/** Hours over which a race's margin moves to its final value: `HYDRATE_POLL_DAYS` of 60 days. */
const TREND_HOURS = 60 * 24;
/** The votes cast for an office, as a share of the presidential vote there. */
const OFFICE_TURNOUT: Readonly<Record<ElectedOffice, number>> = {
  President: 1,
  Senate: 0.97,
  Governor: 0.96,
  House: 0.94,
};
/** Money a campaign has raised by the summer, USD: low and high by office (pivot 6.3). */
const MONEY: Readonly<Record<ElectedOffice, readonly [number, number]>> = {
  President: [3.5e8, 7e8],
  Senate: [4e6, 3e7],
  Governor: [2.5e6, 1.5e7],
  House: [5e5, 3.5e6],
};
/**
 * The mock's twelve states lean to party B down the ballot, and a one-sided chamber trades at 2
 * cents. So the House races are re-centred on the median district (plus this many points), and six
 * of the twelve senators not up are party A's (the most party-A states'), which leaves both
 * chambers worth betting on.
 */
const HOUSE_CENTRE_PTS = 1.5;
const HOLDOVER_DEMS = 6;
/** Points of margin a point of campaign strength is worth (pivot 6.6). */
const STRENGTH_PTS = 0.15;
/** An incumbent president's edge, as a share of `INCUMBENCY_PTS`. */
const PRESIDENT_INCUMBENCY = 0.5;
/** The points the false drop-out rumour costs its target while it is believed (pivot 8.3). */
const RUMOUR_SHOCK_PTS = 3;

export interface MockCandidate {
  person: PersonId;
  party: Party | null;
  incumbent: boolean;
  status: CandidateStatus;
  /** Hidden (pivot 5.11, 6.6). */
  strength: number;
  /** Cumulative, as last filed (pivot 8.6). */
  raised: number | null;
  cash: number | null;
  /** USD a week the campaign raises: what the filings are built from. */
  weekly: number;
}

/** A county, or a district's share of one, voting in a race. */
export interface RaceUnit {
  county: CountyId;
  /** `MockState.idx`. */
  state: number;
  people: number;
  lean: number;
  turnout: number;
  noise: number;
  /** The final vote, in ballot order. */
  votes: number[];
}

export interface MockRace {
  id: RaceId;
  office: ElectedOffice;
  /** `MockState.idx`; null for the presidency. */
  state: number | null;
  /** `MockDistrict.idx` and its number, for a House race. */
  district_idx: number | null;
  district: number | null;
  senate_class: number | null;
  title: string;
  primaries: { party: Party; date: SimDate }[];
  candidates: MockCandidate[];
  /** The candidates on the general ballot, as indexes into `candidates`, in candidate order. */
  ballot: number[];
  /** Where the Democrat and the Republican sit in `ballot`. */
  dem: number;
  rep: number;
  // What the count will show (pivot 9.1). Hidden until reported.
  units: RaceUnit[];
  effect: number;
  ind_share: number;
  totals: number[];
  /** Points toward party A over the whole race. */
  final_margin: number;
  /** The ballot index of the winner. */
  winner_ballot: number;
  /** The presidency only: each state's margin and the electoral votes of [Democrats, Republicans]. */
  state_margins: number[] | null;
  electoral: [number, number] | null;
  /** How far from its final margin the race stood 60 days out. */
  trend: number;
  shocks: { from: DateTime; to: DateTime; pts: number }[];
  /** What a public model would guess with no polls (pivot 8.5): the place's lean and incumbency, with an error. */
  fundamentals: number;
  /** A recount moves this unit's count by this much, in ballot order (pivot 9.4). */
  recount: { unit: number; delta: number[] } | null;
  // What is public now.
  status: RaceStatus;
  winner: PersonId | null;
}

export interface MockSenator {
  person: PersonId;
  state: number;
  party: Party;
  /** The seat is up this cycle. */
  up: boolean;
}

export interface MockPolitics {
  people: MockPerson[];
  races: MockRace[];
  incumbent_party: Party;
  president: PersonId;
  vice_president: PersonId;
  challenger: PersonId;
  /** The secretary who resigns, the one who stays and the nominee to follow the first (pivot 7.6). */
  interior: PersonId;
  treasury: PersonId;
  nominee: PersonId;
  /** The 24 sitting senators and the 30 sitting representatives (by `MockDistrict.idx`). */
  senators: MockSenator[];
  reps: PersonId[];
  /** By `MockState.idx`. */
  governors: PersonId[];
  national_swing: number;
  /** The one race forced inside `RECOUNT_MARGIN`. */
  recount_race: RaceId;
  /** The Senate race and candidate of the false drop-out rumour. */
  dropout_race: RaceId;
  dropout_person: PersonId;
  /** A senator the market lists a retirement contract on. */
  retiree: PersonId;
}

export const other = (p: Party): Party => (p === "Democrats" ? "Republicans" : "Democrats");
const sign = (p: Party): number => (p === "Democrats" ? 1 : -1);

/** The share of the two-party-and-others vote a margin gives the Democrat, in percent. */
function demPct(margin: number, ind: number): number {
  return Math.min(98 - ind, Math.max(2, (100 - ind) / 2 + margin / 2));
}

/** Fills a race's final votes from its units, effect and swings (pivot 6.7, much reduced). */
function countRace(r: MockRace, swing: (state: number) => number): void {
  const n = r.ballot.length;
  r.totals = new Array<number>(n).fill(0);
  for (const u of r.units) {
    const total = Math.floor(u.people * u.turnout * OFFICE_TURNOUT[r.office]);
    const d = Math.floor((total * demPct(u.lean + swing(u.state) + r.effect + u.noise, r.ind_share)) / 100);
    const rep = n > 2 ? Math.floor((total * (100 - r.ind_share)) / 100) - d : total - d;
    u.votes = new Array<number>(n).fill(0);
    u.votes[r.dem] = d;
    u.votes[r.rep] = rep;
    // Any others split what is left, the first taking the remainder.
    const rest = total - d - rep;
    const others = r.ballot.map((_, i) => i).filter((i) => i !== r.dem && i !== r.rep);
    others.forEach((i, k) => {
      u.votes[i] =
        k === 0
          ? rest - Math.floor(rest / others.length) * (others.length - 1)
          : Math.floor(rest / others.length);
    });
    for (let i = 0; i < n; i++) r.totals[i] = (r.totals[i] as number) + (u.votes[i] as number);
  }
  const all = r.totals.reduce((a, b) => a + b, 0);
  r.final_margin = (((r.totals[r.dem] as number) - (r.totals[r.rep] as number)) / all) * 100;
  r.winner_ballot = r.final_margin >= 0 ? r.dem : r.rep;
}

/** The true margin of a race at a time (pivot 6.7): what a perfect poll that day would find. */
export function raceMarginAt(r: MockRace, t: DateTime): number {
  const left = Math.min(1.5, Math.max(0, (SCRIPT.election_day - t) / TREND_HOURS));
  let m = r.final_margin + r.trend * left;
  for (const s of r.shocks) if (t >= s.from && t < s.to) m += s.pts;
  return m;
}

/**
 * Whether a race's final margin sends it to a recount (pivot 9.4). The forced race always does; now
 * and then another lands inside the margin by chance. The presidency is recounted by state, which
 * the mock does not model.
 */
export function needsRecount(r: MockRace): boolean {
  return r.office !== "President" && Math.abs(r.final_margin) < RECOUNT_MARGIN;
}

/** The candidate on the ballot at ballot index `i`. */
export function ballotCandidate(r: MockRace, i: number): MockCandidate {
  return r.candidates[r.ballot[i] as number] as MockCandidate;
}

export function genPolitics(base: MockWorld, geo: MockGeo, rng: MockRng): MockPolitics {
  const gen = new PeopleGen(base, rng);
  const incParty: Party = rng.chance(0.5) ? "Democrats" : "Republicans";
  const chalParty = other(incParty);
  const anyState = () => rng.pick(geo.states);
  const partyFor = (lean: number): Party => (lean + 9 * rng.normal() >= 0 ? "Democrats" : "Republicans");

  const president = gen.make({
    party: incParty,
    home: anyState().id,
    status: "InOffice",
    office: "President",
    career: [past("Governor", 2009, 2017), held("President", 2017)],
    age: [55, 76],
  });
  const vp = gen.make({
    party: incParty,
    home: anyState().id,
    status: "InOffice",
    office: "Vice President",
    career: [past("Senator", 2005, 2017), held("Vice President", 2017)],
    age: [50, 70],
  });
  const cabinet = (title: string) =>
    gen.make({
      party: incParty,
      home: anyState().id,
      status: "InOffice",
      office: title,
      career: [held(title, 2017)],
    });
  const interior = cabinet("Secretary of the Interior");
  const treasury = cabinet("Secretary of the Treasury");
  const nomineeHome = anyState();
  const nominee = gen.make({
    party: incParty,
    home: nomineeHome.id,
    status: "Bench",
    career: [past(`State senator, ${nomineeHome.name}`, 2011, 2019)],
  });

  const swingNational = 1 + 2 * rng.normal();
  const swingState = geo.states.map(() => 2 * rng.normal());
  const swing = (state: number) => swingNational + (swingState[state] as number);

  const races: MockRace[] = [];
  const leans = geo.districts.map((d) => d.lean).sort((a, b) => a - b);
  const houseTilt = HOUSE_CENTRE_PTS - ((leans[Math.floor(leans.length / 2)] ?? 0) + swingNational);
  const challengerOf = (party: Party | null, st: MockState): MockPerson =>
    gen.make({
      party,
      home: st.id,
      status: "Candidate",
      career: [past(rng.chance(0.5) ? `State senator, ${st.name}` : `Mayor, ${st.name}`, 2013, 2019)],
      age: [34, 66],
    });

  const candidate = (
    p: MockPerson,
    office: ElectedOffice,
    incumbent: boolean,
    status: CandidateStatus,
  ): MockCandidate => {
    const [lo, hi] = MONEY[office];
    const raised = Math.floor(rng.range(lo, hi) * (incumbent ? 1.3 : 1) * (status === "Nominee" ? 1 : 0.15));
    return {
      person: p.id,
      party: p.party,
      incumbent,
      status,
      strength: Math.floor((p.skills.persuasion + p.skills.hustle) / 2 + 3 * rng.normal() + 0.5),
      raised,
      cash: Math.floor(raised * rng.range(0.15, 0.45)),
      weekly: status === "Nominee" || status === "Running" ? Math.floor(raised / 26) : 0,
    };
  };

  /** Builds a race from its nominees; `incumbent` is the sitting holder when they run. */
  const addRace = (
    office: ElectedOffice,
    st: MockState | null,
    title: string,
    units: RaceUnit[],
    cands: MockCandidate[],
    lean: number,
    extra: { district_idx?: number; district?: number; senate_class?: number; primary: SimDate },
  ): MockRace => {
    const ballot = cands
      .map((c, i) => (c.status === "Nominee" || c.status === "Running" ? i : -1))
      .filter((i) => i >= 0);
    const dem = ballot.findIndex((i) => (cands[i] as MockCandidate).party === "Democrats");
    const rep = ballot.findIndex((i) => (cands[i] as MockCandidate).party === "Republicans");
    const d = cands[ballot[dem] as number] as MockCandidate;
    const r = cands[ballot[rep] as number] as MockCandidate;
    const edge = INCUMBENCY_PTS * (office === "President" ? PRESIDENT_INCUMBENCY : 1);
    const inc = d.incumbent ? edge : r.incumbent ? -edge : 0;
    const race: MockRace = {
      id: races.length as RaceId,
      office,
      state: st?.idx ?? null,
      district_idx: extra.district_idx ?? null,
      district: extra.district ?? null,
      senate_class: extra.senate_class ?? null,
      title,
      primaries: PARTIES.map((party) => ({ party, date: extra.primary })),
      candidates: cands,
      ballot,
      dem,
      rep,
      units,
      effect:
        STRENGTH_PTS * (d.strength - r.strength) +
        inc +
        (office === "House" ? houseTilt : 0) +
        (office === "President" ? rng.normal() : 2 * rng.normal()),
      ind_share: ballot.length > 2 ? rng.range(4, 9) : 0,
      totals: [],
      final_margin: 0,
      winner_ballot: 0,
      state_margins: null,
      electoral: null,
      trend: TREND_PTS * rng.normal(),
      shocks: [],
      fundamentals: lean + inc + 2.5 * rng.normal(),
      recount: null,
      status: "General",
      winner: null,
    };
    countRace(race, swing);
    races.push(race);
    return race;
  };

  const wholeUnits = (counties: MockCounty[]): RaceUnit[] =>
    counties.map((c) => ({
      county: c.id,
      state: c.state,
      people: c.population,
      lean: c.lean,
      turnout: c.turnout,
      noise: 2.5 * rng.normal(),
      votes: [],
    }));

  // The presidency: the incumbent and the other party's field (pivot 6.2).
  const chalHome = anyState();
  const challenger = gen.make({
    party: chalParty,
    home: chalHome.id,
    status: "Candidate",
    career: [past(`Governor of ${chalHome.name}`, 2011, 2019)],
    age: [48, 74],
  });
  const field = [0, 1, 2, 3].map((i) => {
    const home = anyState();
    return gen.make({
      party: chalParty,
      home: home.id,
      status: "Bench",
      career: [past(i % 2 === 0 ? `Senator, ${home.name}` : `Governor of ${home.name}`, 2007, 2019)],
      age: [44, 78],
    });
  });
  const totalPop = geo.counties.reduce((a, c) => a + c.population, 0);
  const nationalLean = geo.counties.reduce((a, c) => a + c.lean * c.population, 0) / totalPop;
  const pres = addRace(
    "President",
    null,
    "President",
    wholeUnits(geo.counties),
    [
      candidate(president, "President", true, "Nominee"),
      candidate(field[0] as MockPerson, "President", false, "DroppedOut"),
      candidate(challenger, "President", false, "Nominee"),
      candidate(field[1] as MockPerson, "President", false, "LostPrimary"),
      candidate(field[2] as MockPerson, "President", false, "LostPrimary"),
      candidate(field[3] as MockPerson, "President", false, "DroppedOut"),
    ],
    nationalLean,
    { primary: ymd(3, 3) },
  );

  // Each state: two senators (one seat up), a governor, and its representatives.
  const senators: MockSenator[] = [];
  const governors: PersonId[] = [];
  const reps: PersonId[] = [];
  const statePrimary = geo.states.map(() => (rng.chance(0.5) ? ymd(6, 2) : ymd(8, 4)));
  const byLean = geo.states.slice().sort((a, b) => b.lean - a.lean || a.idx - b.idx);
  const demHoldover = new Set(byLean.slice(0, HOLDOVER_DEMS).map((s) => s.idx));
  const holders = geo.states.map((st) => {
    const upParty = partyFor(st.lean);
    const up = gen.make({
      party: upParty,
      home: st.id,
      status: "InOffice",
      office: `Senator, ${st.name}`,
      career: [held(`Senator, ${st.name}`, rng.chance(0.5) ? 2015 : 2009)],
    });
    const overParty: Party = demHoldover.has(st.idx) ? "Democrats" : "Republicans";
    const over = gen.make({
      party: overParty,
      home: st.id,
      status: "InOffice",
      office: `Senator, ${st.name}`,
      career: [held(`Senator, ${st.name}`, rng.chance(0.5) ? 2017 : 2019)],
    });
    senators.push({ person: up.id, state: st.idx, party: upParty, up: true });
    senators.push({ person: over.id, state: st.idx, party: overParty, up: false });
    st.governor = partyFor(st.lean * 0.6);
    const gov = gen.make({
      party: st.governor,
      home: st.id,
      status: "InOffice",
      office: `Governor of ${st.name}`,
      career: [held(`Governor of ${st.name}`, rng.chance(0.5) ? 2017 : 2019)],
    });
    governors.push(gov.id);
    return { up, gov };
  });

  /** The two nominees of a race, the incumbent among them when they run, and now and then a third name. */
  const fieldOf = (
    office: ElectedOffice,
    st: MockState,
    holder: MockPerson,
    openChance: number,
    extras: boolean,
  ): MockCandidate[] => {
    const runs = !rng.chance(openChance);
    const holderParty = holder.party as Party;
    const own = runs ? holder : challengerOf(holderParty, st);
    const opp = challengerOf(other(holderParty), st);
    const out = [candidate(own, office, runs, "Nominee"), candidate(opp, office, false, "Nominee")];
    if (extras && rng.chance(0.25)) out.push(candidate(challengerOf(null, st), office, false, "Running"));
    if (extras && rng.chance(0.3)) {
      const loser = challengerOf(rng.chance(0.5) ? "Democrats" : "Republicans", st);
      loser.status = "Bench";
      out.splice(1, 0, candidate(loser, office, false, "LostPrimary"));
    }
    return out;
  };

  geo.states.forEach((st, i) => {
    const counties = st.counties.map((id) => geo.counties[id] as MockCounty);
    addRace(
      "Senate",
      st,
      `${st.name} Senate`,
      wholeUnits(counties),
      fieldOf("Senate", st, (holders[i] as (typeof holders)[number]).up, 0.25, true),
      st.lean,
      {
        senate_class: 2,
        primary: statePrimary[i] as SimDate,
      },
    );
  });
  for (const d of geo.districts) {
    const st = geo.states[d.state] as MockState;
    const title = `Representative, ${st.name} ${d.number}`;
    const party = partyFor(d.lean * 1.5);
    const member = gen.make({
      party,
      home: st.id,
      status: "InOffice",
      office: title,
      career: [held(title, 2013 + 2 * rng.int(4))],
      age: [32, 74],
    });
    reps.push(member.id);
    const units: RaceUnit[] = d.shares.map((s) => {
      const c = geo.counties[s.county] as MockCounty;
      return {
        county: c.id,
        state: c.state,
        people: (s.to - s.from) * c.population,
        lean: shareLean(c, s),
        turnout: c.turnout,
        noise: 2.5 * rng.normal(),
        votes: [],
      };
    });
    addRace(
      "House",
      st,
      `${st.name} ${d.number}`,
      units,
      fieldOf("House", st, member, 0.15, false),
      d.lean + houseTilt,
      {
        district_idx: d.idx,
        district: d.number,
        primary: statePrimary[d.state] as SimDate,
      },
    );
  }
  // Five governors are up: the mock's most evenly split states, for close races.
  const govStates = geo.states
    .slice()
    .sort((a, b) => Math.abs(a.lean) - Math.abs(b.lean) || a.idx - b.idx)
    .slice(0, 5)
    .sort((a, b) => a.idx - b.idx);
  for (const st of govStates) {
    const counties = st.counties.map((id) => geo.counties[id] as MockCounty);
    const holder = (holders[st.idx] as (typeof holders)[number]).gov;
    addRace(
      "Governor",
      st,
      `${st.name} Governor`,
      wholeUnits(counties),
      fieldOf("Governor", st, holder, 0.3, true),
      st.lean * 0.6,
      {
        primary: statePrimary[st.idx] as SimDate,
      },
    );
  }

  // The presidency is won by electoral votes (pivot 6.7). A 27 to 27 tie goes to the incumbent:
  // the mock has no contingent election.
  pres.state_margins = geo.states.map((st) => {
    let d = 0;
    let r = 0;
    for (const u of pres.units) {
      if (u.state !== st.idx) continue;
      d += u.votes[pres.dem] as number;
      r += u.votes[pres.rep] as number;
    }
    return ((d - r) / (d + r)) * 100;
  });
  const ev: [number, number] = [0, 0];
  pres.state_margins.forEach((m, i) => {
    ev[m >= 0 ? 0 : 1] += (geo.states[i] as MockState).electoral_votes;
  });
  pres.electoral = ev;
  const demWins = ev[0] > ev[1] || (ev[0] === ev[1] && incParty === "Democrats");
  pres.winner_ballot = demWins ? pres.dem : pres.rep;

  // One House race is forced inside the recount margin (pivot 9.4), keeping its leader.
  const house = races.filter((r) => r.office === "House" && r.ballot.length === 2);
  const close = house.reduce((a, b) => (Math.abs(b.final_margin) < Math.abs(a.final_margin) ? b : a));
  for (let pass = 0; pass < 3; pass++) {
    const target = close.final_margin >= 0 ? NAILBITER_MARGIN : -NAILBITER_MARGIN;
    close.effect += target - close.final_margin;
    countRace(close, swing);
  }
  const big = close.units.reduce(
    (best, u, i) => (u.people > (close.units[best] as RaceUnit).people ? i : best),
    0,
  );
  const moved = 12 + rng.int(30);
  const delta = new Array<number>(close.ballot.length).fill(0);
  delta[close.winner_ballot] = moved;
  delta[close.winner_ballot === close.dem ? close.rep : close.dem] = Math.floor(moved / 3);
  close.recount = { unit: big, delta };

  // The false rumour's target: the trailing nominee of the closest Senate race.
  const senate = races.filter((r) => r.office === "Senate");
  const tight = senate.reduce((a, b) => (Math.abs(b.final_margin) < Math.abs(a.final_margin) ? b : a));
  const trailing = tight.final_margin >= 0 ? tight.rep : tight.dem;
  const target = ballotCandidate(tight, trailing);
  tight.shocks.push({
    from: SCRIPT.rumour_false_posted,
    to: SCRIPT.rumour_false_debunked,
    pts: target.party === "Democrats" ? -RUMOUR_SHOCK_PTS : RUMOUR_SHOCK_PTS,
  });
  const holdover = senators.filter((s) => !s.up);

  return {
    people: gen.people,
    races,
    incumbent_party: incParty,
    president: president.id,
    vice_president: vp.id,
    challenger: challenger.id,
    interior: interior.id,
    treasury: treasury.id,
    nominee: nominee.id,
    senators,
    reps,
    governors,
    national_swing: swingNational,
    recount_race: close.id,
    dropout_race: tight.id,
    dropout_person: target.person,
    retiree: (holdover[rng.int(holdover.length)] as MockSenator).person,
  };
}

/** The sign of a party's side of a margin: +1 for party A. */
export const partySign = sign;

/**
 * The party holding a seat whose holder is not running (D1037): the presidency's incumbent party, a
 * Senate seat's holder by state and class, a House seat's sitting member; null when unknown.
 */
function incumbentPartyOf(pol: MockPolitics, r: MockRace): Party | null {
  if (r.office === "President") return pol.incumbent_party;
  if (r.office === "House" && r.district_idx !== null) {
    const id = pol.reps[r.district_idx];
    return id === undefined ? null : ((pol.people[id] as { party: Party | null }).party ?? null);
  }
  if (r.office === "Senate") return pol.senators.find((s) => s.state === r.state && s.up)?.party ?? null;
  return null;
}

/** v_races: public record, with the strength number only for Omniscient (pivot 5.11). */
export function racesView(pol: MockPolitics, geo: MockGeo, omniscient: boolean): RacesView {
  return {
    cycle: MOCK_CYCLE,
    races: pol.races.map((r) => ({
      id: r.id,
      office: r.office,
      state: r.state === null ? null : (geo.states[r.state] as MockState).id,
      district: r.district,
      senate_class: r.senate_class,
      special: false,
      title: r.title,
      status: r.status,
      // Each primary's ballot is its party's candidates in filing order; the winner its nominee (D1037).
      primaries: r.primaries.map((p) => {
        const field = r.candidates.filter((c) => c.party === p.party);
        const nominee = field.find((c) => c.status !== "LostPrimary" && c.status !== "DroppedOut");
        return {
          party: p.party,
          date: p.date,
          ballot: field.map((c) => c.person),
          winner: nominee?.person ?? null,
        };
      }),
      general: ymd(11, 3),
      polls_close:
        SCRIPT.election_day +
        (r.state === null
          ? Math.max(...geo.states.map((s) => s.close_hour))
          : (geo.states[r.state] as MockState).close_hour),
      certify: r.id === pol.recount_race ? RECOUNT_CERTIFICATION_DATE : CERTIFICATION_DATE,
      incumbent_party: r.candidates.find((c) => c.incumbent)?.party ?? incumbentPartyOf(pol, r),
      electoral_votes:
        r.office === "President"
          ? Math.floor(geo.states.reduce((a, s) => a + s.electoral_votes, 0) / 2) + 1
          : null,
      candidates: r.candidates.map((c) => ({
        person: c.person,
        party: c.party,
        status: c.status,
        incumbent: c.incumbent,
        raised: c.raised,
        cash: c.cash,
        strength: omniscient ? c.strength : null,
      })),
      ballot: r.ballot.map((i) => (r.candidates[i] as MockCandidate).person),
      winner: r.winner,
    })),
  };
}
