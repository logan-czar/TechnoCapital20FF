// The US politics state and its daily job (D980 to D988; 4-politics 4.6, 4.7.3, 4.21.1): the start
// world, November elections, the January handovers, retirements and appointments. Every draw comes
// from the Politics stream and nothing else reads this state, so the economy is untouched.

import type { WorldData } from "@tc20ff/sim-data";
import { worldDataAllProvinces } from "@tc20ff/sim-data";
import { newsWireQueue, politicsHeadline } from "../news.ts";
import { nameBooksGet } from "../people/names.ts";
import { rangeDraw } from "../people/simple.ts";
import { dateTimeDate } from "../time/calendar.ts";
import type { JobCtx, Scheduler } from "../time/scheduler.ts";
import { schedulerRegister } from "../time/scheduler.ts";
import { dateEq, type SimDate } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import type { CountryId, ProvinceId } from "../types/ids.ts";
import { cmpStr, totalCmp } from "../types/num.ts";
import type { NameBook, Skills } from "../types/state/people.ts";
import {
  type CourtLevel,
  type District,
  type ElectionResult,
  type Office,
  PARTY_VALUES,
  type Party,
  type Politician,
  type PoliticsPost,
  type PoliticsState,
} from "../types/state/politics.ts";
import type { World } from "../types/world.ts";
import {
  CONGRESS_HANDOVER_DAY,
  electionDay,
  isElectionYear,
  isPresidentYear,
  PRESIDENT_HANDOVER_DAY,
  senateClassUp,
} from "./calendar.ts";
import {
  CABINET_RANGES,
  type Drawn,
  drawJudgeLeaning,
  drawPerson,
  HOUSE_RANGES,
  JUDGE_INTEGRITY,
  JUDGE_RANGES,
  type OfficeRanges,
  PRESIDENT_RANGES,
  politicsDraws,
  SENATE_RANGES,
} from "./generate.ts";
import {
  type Contender,
  INCUMBENCY,
  NATIONAL_SWING_SD,
  PRESIDENT_INCUMBENCY,
  PRESIDENT_SWING_SD,
  RACE_NOISE_SD,
  SENATE_NOISE_SD,
  shares,
  type VoteClimate,
} from "./vote.ts";

/** The one country of the POC. */
export const POLITICS_COUNTRY_KEY = "USA";
/** Two-term limit (D985). */
export const PRESIDENT_TERM_LIMIT = 2;
/** The 19.22 president's party at the start (Logan: the name is generated, D987). */
export const START_PRESIDENT_PARTY: Party = "Democrats";
/** Candidates the president draws for a post (4.7.3: 3 to 5). */
export const APPOINTMENT_CANDIDATES = 3;
/** Score bonus for the president's party in the 4.7.3 appointment score (D984, T). */
export const SAME_PARTY_BONUS = 5;
/** Chance a judicial candidate is of the president's party (D984, T). */
export const NOMINEE_SAME_PARTY_CHANCE = 0.85;
/** 4.21.1 confirmation (D984, T): by whether the president's party holds the Senate. */
export const CONFIRM_CHANCE_FRIENDLY = 0.95;
export const CONFIRM_CHANCE_HOSTILE = 0.6;
/** After this many rejections the seat takes the next nominee (D984). */
export const CONFIRM_TRIES = 5;
/** A district's fixed offset from its state's lean, sd in points (D982, T). */
export const DISTRICT_LEAN_SD_PTS = 16;
/** Retirement (D988, T): a chance by age, reaching certainty at about 85 for a member, 88 for a judge. */
export const LEGISLATOR_RETIRE_BASE = 0.05;
export const LEGISLATOR_RETIRE_FROM_AGE = 65;
export const LEGISLATOR_RETIRE_PER_YEAR = 0.05;
export const JUDGE_RETIRE_FROM_AGE = 68;
export const JUDGE_RETIRE_PER_YEAR = 0.05;

/** Senate seats that make a majority with the vice president's casting vote (D984). */
export const SENATE_MAJORITY = 50;

/** The other party. */
export function otherParty(p: Party): Party {
  return p === PARTY_VALUES[0] ? PARTY_VALUES[1] : PARTY_VALUES[0];
}

// ---------------------------------------------------------------- start

/**
 * `total` split in proportion to `weights` by largest remainder, ties to the lower index (D982).
 * Every weight is positive.
 */
export function largestRemainder(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((n, w) => n + w, 0);
  const quotas = weights.map((w) => (total * w) / sum);
  const seats = quotas.map((q) => Math.floor(q));
  const left = total - seats.reduce((n, s) => n + s, 0);
  const order = quotas
    .map((q, i) => [q - (seats[i] as number), i] as const)
    .sort((a, b) => totalCmp(b[0], a[0]) || a[1] - b[1]);
  for (let k = 0; k < left; k++) {
    const i = (order[k] as readonly [number, number])[1];
    seats[i] = (seats[i] as number) + 1;
  }
  return seats;
}

/** The static tables from the data, before any draw; null for a world without the USA (test worlds). */
export function politicsStateFromData(
  data: WorldData,
  countryIds: ReadonlyMap<string, CountryId>,
  provinceIds: ReadonlyMap<string, ProvinceId>,
): PoliticsState | null {
  const country = countryIds.get(POLITICS_COUNTRY_KEY);
  if (country === undefined) return null;
  const provinces = worldDataAllProvinces(data)
    .map(([, , p]) => p)
    .filter((p) => p.country === POLITICS_COUNTRY_KEY);
  const states = data.politics_states.rows.map((s) => ({
    name: s.state,
    house_seats: s.house_seats,
    senate_classes: s.senate_classes.map((c) => Number.parseInt(c, 10)),
    lean_pts: s.dem_margin_pts,
    weight: provinces.reduce((n, p) => (p.region === s.state ? n + p.population : n), 0),
  }));
  const posts: PoliticsPost[] = data.politics_offices.rows.map((o) => ({
    key: o.id,
    title: o.title,
    kind: o.kind as PoliticsPost["kind"],
    seats: o.seats,
    skill: o.skill as keyof Skills,
  }));
  // D982: a state's districts sit in its provinces, by largest remainder of province population.
  const districts: District[] = [];
  states.forEach((s, si) => {
    if (s.house_seats === 0) return;
    const own = provinces.filter((p) => p.region === s.name).sort((a, b) => cmpStr(a.id, b.id));
    const seats = largestRemainder(
      own.map((p) => p.population),
      s.house_seats,
    );
    let number = 1;
    own.forEach((p, pi) => {
      const province = provinceIds.get(p.id) as ProvinceId;
      for (let k = 0; k < (seats[pi] as number); k++) {
        districts.push({ state: si, number, lean_pts: s.lean_pts, home_province: province });
        number++;
      }
    });
  });
  return {
    country,
    states,
    districts,
    posts,
    politicians: [],
    politicians_made: 0,
    president_terms: 0,
    pending: null,
    elections: [],
  };
}

function usNames(world: World, p: PoliticsState): NameBook {
  const book = nameBooksGet(world.name_books, p.country);
  if (book === null) throw new Error("no name book for the USA");
  return book;
}

/** Turns a drawn person into an office holder, taking the next id. */
function seat(p: PoliticsState, d: Drawn, party: Party, office: Office, since: SimDate): Politician {
  const id = p.politicians_made;
  p.politicians_made += 1;
  return {
    class: "Politician",
    id,
    name: d.name,
    age: d.age,
    skills: d.skills,
    traits: d.traits,
    party,
    ideology: d.ideology,
    office,
    since,
    integrity: null,
    leaning: null,
  };
}

/**
 * The start seats (D987): a generated president of the 19.22 party in a first term, their VP and
 * cabinet, Congress filled by the D986 vote with no incumbency, and the courts. All Politics draws.
 */
export function politicsStart(world: World, draws: DrawSource): void {
  const p = world.politics;
  if (!p) return;
  const g = politicsDraws(draws);
  const names = usNames(world, p);
  const date = dateTimeDate(world.clock);
  // D982: each district's fixed offset.
  for (const d of p.districts) d.lean_pts += g.normal("Politics") * DISTRICT_LEAN_SD_PTS;
  const president = seat(
    p,
    drawPerson(g, names, PRESIDENT_RANGES, "persuasion", START_PRESIDENT_PARTY),
    START_PRESIDENT_PARTY,
    { kind: "President" },
    date,
  );
  p.politicians.push(president);
  p.president_terms = 1;
  const climate: VoteClimate = { incumbent_party: START_PRESIDENT_PARTY, growth: 0, swing: 0 };
  // Congress, House then Senate in state order; the winner is seated at once.
  for (const race of congressRaces(p, null)) {
    const winner = runRace(p, g, names, race, climate, new Map(), date);
    p.politicians.push(winner.seated as Politician);
  }
  fillExecutive(p, g, names, president, date);
  fillCourtVacancies(p, g, names, president, date);
}

// ---------------------------------------------------------------- elections

/** One seat being contested. */
interface Race {
  office: Office;
  lean_pts: number;
  ranges: OfficeRanges;
}

/** Every race of a November, House then Senate; `senateClass` null fills all three classes. */
function congressRaces(p: PoliticsState, senateClass: number | null): Race[] {
  const races: Race[] = p.districts.map((d, i) => ({
    office: { kind: "House", state: d.state, district: i },
    lean_pts: d.lean_pts,
    ranges: HOUSE_RANGES,
  }));
  p.states.forEach((s, si) => {
    for (const c of s.senate_classes) {
      if (senateClass !== null && c !== senateClass) continue;
      races.push({
        office: { kind: "Senate", state: si, senate_class: c },
        lean_pts: s.lean_pts,
        ranges: SENATE_RANGES,
      });
    }
  });
  return races;
}

/** A legislator's seat as a lookup key (never iterated). */
function seatKey(o: Office): string {
  if (o.kind === "House") return `h${o.district}`;
  if (o.kind === "Senate") return `s${o.state}/${o.senate_class}`;
  return "";
}

interface RaceOutcome {
  /** The new member, when the seat changes hands or opens. */
  seated: Politician | null;
  party: Party;
}

/**
 * One race (D986, 4.6.3): the sitting member runs for their party unless they retire; every other
 * side is a drawn candidate. Plurality; a tie goes to the Democrats (PARTY_VALUES order).
 */
function runRace(
  p: PoliticsState,
  g: DrawSource,
  names: NameBook,
  race: Race,
  climate: VoteClimate,
  holders: ReadonlyMap<string, Politician>,
  date: SimDate,
): RaceOutcome {
  const holder = holders.get(seatKey(race.office)) ?? null;
  const running = holder !== null && !g.chance("Politics", retireChance(holder.age)) ? holder : null;
  const sides = PARTY_VALUES.map((party) =>
    running !== null && running.party === party
      ? { party, drawn: null }
      : { party, drawn: drawPerson(g, names, race.ranges, "persuasion", party) },
  );
  const contender = (s: (typeof sides)[number]): Contender =>
    s.drawn === null
      ? { party: s.party, persuasion: (running as Politician).skills.persuasion, incumbency: INCUMBENCY }
      : { party: s.party, persuasion: s.drawn.skills.persuasion, incumbency: 0 };
  const a = sides[0] as (typeof sides)[number];
  const b = sides[1] as (typeof sides)[number];
  const noise = g.normal("Politics") * (race.office.kind === "Senate" ? SENATE_NOISE_SD : RACE_NOISE_SD);
  const [sa, sb] = shares(race.lean_pts, contender(a), contender(b), climate, noise);
  const won = sa >= sb ? a : b;
  if (won.drawn === null) return { seated: null, party: won.party };
  return { seated: seat(p, won.drawn, won.party, race.office, date), party: won.party };
}

/** D988: a legislator's chance of retiring at an election. */
export function retireChance(age: number): number {
  const over = Math.max(0, age - LEGISLATOR_RETIRE_FROM_AGE);
  return LEGISLATOR_RETIRE_BASE + over * LEGISLATOR_RETIRE_PER_YEAR;
}

/** D988: a judge's yearly chance of retiring. */
export function judgeRetireChance(age: number): number {
  const over = age - JUDGE_RETIRE_FROM_AGE;
  return over <= 0 ? 0 : over * JUDGE_RETIRE_PER_YEAR;
}

/** The sitting president; the politics state always has one once started. */
export function sittingPresident(p: PoliticsState): Politician {
  const found = p.politicians.find((c) => c.office.kind === "President");
  if (found === undefined) throw new Error("no sitting president");
  return found;
}

function officeHolders(p: PoliticsState, kind: Office["kind"]): Politician[] {
  return p.politicians.filter((c) => c.office.kind === kind);
}

/** The seats each party would hold of `kind`, Democrats then Republicans. */
export function partySeats(rows: readonly Politician[]): [number, number] {
  let dem = 0;
  for (const r of rows) if (r.party === PARTY_VALUES[0]) dem++;
  return [dem, rows.length - dem];
}

/** A party's presidential nominee (D985): the eligible president, the VP, or the best senator. */
interface Nominee {
  party: Party;
  existing: Politician | null;
  drawn: Drawn | null;
  incumbent: boolean;
  persuasion: number;
  name: string;
}

function presidentialNominee(
  p: PoliticsState,
  g: DrawSource,
  names: NameBook,
  party: Party,
  senateClass: number,
): Nominee {
  const president = sittingPresident(p);
  const of = (c: Politician, incumbent: boolean): Nominee => ({
    party,
    existing: c,
    drawn: null,
    incumbent,
    persuasion: c.skills.persuasion,
    name: c.name,
  });
  if (party === president.party) {
    if (p.president_terms < PRESIDENT_TERM_LIMIT) return of(president, true);
    const vp = officeHolders(p, "VicePresident")[0];
    if (vp !== undefined) return of(vp, false);
  }
  // Highest Persuasion among the party's senators not up this November (their seat is safe to
  // leave); ties to the lower id. The table is in id order.
  let best: Politician | null = null;
  for (const c of p.politicians) {
    if (c.office.kind !== "Senate" || c.party !== party) continue;
    if (c.office.senate_class === senateClass || c.age < PRESIDENT_RANGES.age.lo) continue;
    if (best === null || c.skills.persuasion > best.skills.persuasion) best = c;
  }
  if (best !== null) return of(best, false);
  const d = drawPerson(g, names, PRESIDENT_RANGES, "persuasion", party);
  return { party, existing: null, drawn: d, incumbent: false, persuasion: d.skills.persuasion, name: d.name };
}

/** The national vote (4.6.2, 4.6.3): every state's shares weighted by its province population. */
function presidentialVote(
  p: PoliticsState,
  g: DrawSource,
  a: Nominee,
  b: Nominee,
  climate: VoteClimate,
): [number, number] {
  let dem = 0;
  let total = 0;
  const incumbency = (n: Nominee): number => (n.incumbent ? PRESIDENT_INCUMBENCY : 0);
  const ca: Contender = { party: a.party, persuasion: a.persuasion, incumbency: incumbency(a) };
  const cb: Contender = { party: b.party, persuasion: b.persuasion, incumbency: incumbency(b) };
  const raceSwing = g.normal("Politics") * PRESIDENT_SWING_SD;
  const national: VoteClimate = { ...climate, swing: climate.swing + raceSwing };
  for (const s of p.states) {
    const noise = g.normal("Politics") * RACE_NOISE_SD;
    dem += s.weight * shares(s.lean_pts, ca, cb, national, noise)[0];
    total += s.weight;
  }
  const share = dem / total;
  return [share, 1 - share];
}

/** Election Day (D985): decides every race now; winners take office at the January handovers. */
export function electionDayJob(world: World, p: PoliticsState, draws: DrawSource, date: SimDate): void {
  const g = politicsDraws(draws);
  const names = usNames(world, p);
  const president = sittingPresident(p);
  const zone = world.zones[(world.countries[p.country] as World["countries"][number]).zone];
  const climate: VoteClimate = {
    incumbent_party: president.party,
    growth: (zone as World["zones"][number]).effect,
    swing: g.normal("Politics") * NATIONAL_SWING_SD,
  };
  const senateClass = senateClassUp(date.year);
  const holders = new Map<string, Politician>();
  for (const c of p.politicians) {
    if (c.office.kind === "House" || c.office.kind === "Senate") holders.set(seatKey(c.office), c);
  }
  // The nominees are picked first, so a nominating senator's seat is not one being contested.
  let presidency: {
    a: Nominee;
    b: Nominee;
    shares: [number, number];
  } | null = null;
  if (isPresidentYear(date.year)) {
    const a = presidentialNominee(p, g, names, PARTY_VALUES[0], senateClass);
    const b = presidentialNominee(p, g, names, PARTY_VALUES[1], senateClass);
    presidency = { a, b, shares: presidentialVote(p, g, a, b, climate) };
  }
  const legislators: Politician[] = [];
  let [houseDem, senateDem] = [0, 0];
  let [houseAll, senateAll] = [0, 0];
  const racedSenate = new Set<string>();
  for (const race of congressRaces(p, senateClass)) {
    const out = runRace(p, g, names, race, climate, holders, date);
    if (out.seated !== null) legislators.push(out.seated);
    const dem = out.party === PARTY_VALUES[0];
    if (race.office.kind === "House") {
      houseAll++;
      if (dem) houseDem++;
    } else {
      racedSenate.add(seatKey(race.office));
      senateAll++;
      if (dem) senateDem++;
    }
  }
  // Senators not up carry over.
  for (const c of officeHolders(p, "Senate")) {
    if (racedSenate.has(seatKey(c.office))) continue;
    senateAll++;
    if (c.party === PARTY_VALUES[0]) senateDem++;
  }
  const result: ElectionResult = {
    date,
    house: [houseDem, houseAll - houseDem],
    senate: [senateDem, senateAll - senateDem],
    senate_class: senateClass,
    president: null,
  };
  let presidentId: number | null = null;
  let newcomer: Politician | null = null;
  if (presidency !== null) {
    const { a, b, shares: s } = presidency;
    const winner = (s[0] as number) >= (s[1] as number) ? a : b;
    const loser = winner === a ? b : a;
    if (winner.existing !== null) presidentId = winner.existing.id;
    else newcomer = seat(p, winner.drawn as Drawn, winner.party, { kind: "President" }, date);
    result.president = { winner: winner.name, party: winner.party, loser: loser.name, shares: s };
    newsWireQueue(
      world.news,
      politicsHeadline(date, winner.party, `${winner.name} (${winner.party}) wins the US presidency`),
    );
  }
  newsWireQueue(
    world.news,
    politicsHeadline(
      date,
      result.house[0] >= result.house[1] ? PARTY_VALUES[0] : PARTY_VALUES[1],
      `US Congress after the vote: House ${result.house[0]} D, ${result.house[1]} R; Senate ${result.senate[0]} D, ${result.senate[1]} R`,
    ),
  );
  p.elections.push(result);
  p.pending = { legislators, president_id: presidentId, newcomer };
}

// ---------------------------------------------------------------- handovers

/** 3 January (D985): new members replace whoever held their seat. */
function congressHandover(p: PoliticsState): void {
  const pending = p.pending;
  if (pending === null || pending.legislators.length === 0) return;
  const taken = new Set(pending.legislators.map((c) => seatKey(c.office)));
  p.politicians = p.politicians.filter(
    (c) => !((c.office.kind === "House" || c.office.kind === "Senate") && taken.has(seatKey(c.office))),
  );
  p.politicians.push(...pending.legislators);
  p.politicians.sort((a, b) => a.id - b.id);
  pending.legislators = [];
}

/** 20 January (D985): the president-elect takes office; a new president means a new cabinet. */
function presidentHandover(world: World, p: PoliticsState, g: DrawSource, date: SimDate): void {
  const pending = p.pending;
  if (pending === null) return;
  p.pending = null;
  if (pending.president_id === null && pending.newcomer === null) return;
  const outgoing = sittingPresident(p);
  if (pending.president_id === outgoing.id) {
    p.president_terms += 1;
    return;
  }
  const names = usNames(world, p);
  let incoming: Politician;
  if (pending.newcomer !== null) {
    incoming = pending.newcomer;
    p.politicians.push(incoming);
  } else {
    incoming = p.politicians.find((c) => c.id === pending.president_id) as Politician;
  }
  const leftSeat = incoming.office.kind === "Senate" ? incoming.office : null;
  // The old executive leaves, the president-elect excepted.
  p.politicians = p.politicians.filter(
    (c) =>
      c === incoming ||
      !(c.office.kind === "President" || c.office.kind === "VicePresident" || c.office.kind === "Cabinet"),
  );
  incoming.office = { kind: "President" };
  incoming.since = date;
  p.president_terms = 1;
  // A senator who wins the presidency leaves a seat: filled at once from their party (D985).
  if (leftSeat !== null) {
    p.politicians.push(
      seat(
        p,
        drawPerson(g, names, SENATE_RANGES, "persuasion", incoming.party),
        incoming.party,
        leftSeat,
        date,
      ),
    );
  }
  fillExecutive(p, g, names, incoming, date);
  p.politicians.sort((a, b) => a.id - b.id);
  newsWireQueue(
    world.news,
    politicsHeadline(date, incoming.party, `${incoming.name} is sworn in as US president`),
  );
}

// ---------------------------------------------------------------- appointments

/** The best of the drawn candidates by the 4.7.3 score, simplified (D984); ties to the first drawn. */
function bestCandidate(
  g: DrawSource,
  names: NameBook,
  ranges: OfficeRanges,
  skill: keyof Skills,
  appointerParty: Party,
  sameChance: number,
): { drawn: Drawn; party: Party } {
  let best: { drawn: Drawn; party: Party; score: number } | null = null;
  for (let i = 0; i < APPOINTMENT_CANDIDATES; i++) {
    const party = g.chance("Politics", sameChance) ? appointerParty : otherParty(appointerParty);
    const drawn = drawPerson(g, names, ranges, skill, party);
    const score = drawn.skills[skill] + (party === appointerParty ? SAME_PARTY_BONUS : 0);
    if (best === null || score > best.score) best = { drawn, party, score };
  }
  const b = best as { drawn: Drawn; party: Party };
  return { drawn: b.drawn, party: b.party };
}

/** The VP and cabinet for a new president (D983): no confirmation vote in the POC. */
function fillExecutive(
  p: PoliticsState,
  g: DrawSource,
  names: NameBook,
  president: Politician,
  date: SimDate,
): void {
  p.posts.forEach((post, i) => {
    if (post.kind !== "vice_president" && post.kind !== "cabinet") return;
    const { drawn, party } = bestCandidate(g, names, CABINET_RANGES, post.skill, president.party, 1);
    const office: Office =
      post.kind === "vice_president" ? { kind: "VicePresident", post: i } : { kind: "Cabinet", post: i };
    p.politicians.push(seat(p, drawn, party, office, date));
  });
}

function courtLevel(post: PoliticsPost): CourtLevel | null {
  if (post.kind === "supreme_court") return "Supreme";
  if (post.kind === "appeals_court") return "Appeals";
  if (post.kind === "trial_court") return "Trial";
  return null;
}

/** Fills every empty judge seat (4.7.3, 4.21.1): nominate, then the Senate confirms or rejects. */
function fillCourtVacancies(
  p: PoliticsState,
  g: DrawSource,
  names: NameBook,
  president: Politician,
  date: SimDate,
): void {
  const senate = partySeats(officeHolders(p, "Senate"));
  const presidentSeats = president.party === PARTY_VALUES[0] ? senate[0] : senate[1];
  const friendly = presidentSeats >= SENATE_MAJORITY;
  const confirm = friendly ? CONFIRM_CHANCE_FRIENDLY : CONFIRM_CHANCE_HOSTILE;
  p.posts.forEach((post, i) => {
    const level = courtLevel(post);
    if (level === null) return;
    const sitting = p.politicians.filter((c) => c.office.kind === "Judge" && c.office.post === i).length;
    for (let s = sitting; s < post.seats; s++) {
      let pick = bestCandidate(
        g,
        names,
        JUDGE_RANGES,
        post.skill,
        president.party,
        NOMINEE_SAME_PARTY_CHANCE,
      );
      for (let t = 1; t < CONFIRM_TRIES && !g.chance("Politics", confirm); t++) {
        pick = bestCandidate(g, names, JUDGE_RANGES, post.skill, president.party, NOMINEE_SAME_PARTY_CHANCE);
      }
      const judge = seat(p, pick.drawn, pick.party, { kind: "Judge", post: i, level }, date);
      judge.integrity = rangeDraw(JUDGE_INTEGRITY, g);
      judge.leaning = drawJudgeLeaning(g);
      p.politicians.push(judge);
    }
  });
}

/** 1 January (D988): politicians age a year; judges may retire, and the president fills the seats. */
function newYear(world: World, p: PoliticsState, g: DrawSource, date: SimDate): void {
  for (const c of p.politicians) c.age += 1;
  p.politicians = p.politicians.filter(
    (c) => c.office.kind !== "Judge" || !g.chance("Politics", judgeRetireChance(c.age)),
  );
  fillCourtVacancies(p, g, usNames(world, p), sittingPresident(p), date);
}

// ---------------------------------------------------------------- the job

/** The daily job (D985): acts only on the politics days of `isPoliticsDay`. */
export function politicsJob(world: World, ctx: JobCtx): void {
  const p = world.politics;
  // Test worlds: no USA, or a world that skipped the start.
  if (!p?.politicians.length) return;
  const date = ctx.facts.date;
  if (date.month === 1) {
    const g = politicsDraws(ctx.draws);
    if (date.day === 1) newYear(world, p, g, date);
    else if (date.day === CONGRESS_HANDOVER_DAY) congressHandover(p);
    else if (date.day === PRESIDENT_HANDOVER_DAY) presidentHandover(world, p, g, date);
    return;
  }
  if (isElectionYear(date.year) && dateEq(date, electionDay(date.year))) {
    electionDayJob(world, p, ctx.draws, date);
  }
}

/** Registers the job (`jobs.ts`). */
export function register(s: Scheduler): void {
  schedulerRegister(s, "DailyPolitics", "politics.calendar", politicsJob);
}
