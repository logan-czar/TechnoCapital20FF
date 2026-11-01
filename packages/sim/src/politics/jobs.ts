// The US politics daily job (D980 to D988; 4-politics 4.6, 4.7.3, 4.21.1): the start seats, November
// elections, the January handovers, retirements and appointments. Every draw comes from the Politics
// stream and nothing else reads this state, so the economy is untouched.

import { newsWireQueue, politicsHeadline } from "../news.ts";
import { nameBooksGet } from "../people/names.ts";
import { rangeDraw } from "../people/simple.ts";
import { dateTimeDate } from "../time/calendar.ts";
import type { JobCtx, Scheduler } from "../time/scheduler.ts";
import { schedulerRegister } from "../time/scheduler.ts";
import type { SimDate } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import {
  type DistrictId,
  ordinal,
  type PoliticianId,
  type PoliticsPostId,
  type UsStateId,
} from "../types/ids.ts";
import type { NameBook, SkillKind } from "../types/state/people.ts";
import {
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
  isElectionDay,
  isPoliticsDay,
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
import { officeHolders, partySeats } from "./state.ts";
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
  return p === "Democrats" ? "Republicans" : "Democrats";
}

function usNames(world: World, p: PoliticsState): NameBook {
  const book = nameBooksGet(world.name_books, p.country);
  if (book === null) throw new Error("no name book for the USA");
  return book;
}

/** Turns a drawn person into an office holder, taking the next id. */
function seat(p: PoliticsState, d: Drawn, party: Party, office: Office, since: SimDate): Politician {
  const id = ordinal<PoliticianId>(p.politicians_made);
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

// ---------------------------------------------------------------- start

/**
 * The start seats (D987): a generated president of the 19.22 party in a first term, their VP and
 * cabinet, Congress filled by the D986 vote with no incumbency, and the courts. All Politics draws.
 */
export function politicsStart(world: World, draws: DrawSource): void {
  const p = world.politics;
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
  // Congress, House then Senate in state order; with no holders every race seats a new member.
  for (const race of congressRaces(p, null)) {
    const { seated } = runRace(p, g, names, race, climate, new Map(), date);
    if (seated !== null) p.politicians.push(seated);
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
    office: { kind: "House", state: d.state, district: ordinal<DistrictId>(i) },
    lean_pts: d.lean_pts,
    ranges: HOUSE_RANGES,
  }));
  p.states.forEach((s, si) => {
    for (const c of s.senate_classes) {
      if (senateClass !== null && c !== senateClass) continue;
      races.push({
        office: { kind: "Senate", state: ordinal<UsStateId>(si), senate_class: c },
        lean_pts: s.lean_pts,
        ranges: SENATE_RANGES,
      });
    }
  });
  return races;
}

/** A legislator's seat as a lookup key (never iterated); "" for any other office. */
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
 * side is a drawn candidate. Plurality; a tie goes to the Democrats.
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
  const holder = holders.get(seatKey(race.office));
  const running = holder !== undefined && !g.chance("Politics", retireChance(holder.age)) ? holder : null;
  const side = (party: Party): { person: Drawn; contender: Contender } => {
    const person: Drawn =
      running?.party === party ? running : drawPerson(g, names, race.ranges, "persuasion", party);
    const incumbency = person === running ? INCUMBENCY : 0;
    return { person, contender: { party, persuasion: person.skills.persuasion, incumbency } };
  };
  const [first, second] = PARTY_VALUES;
  const a = side(first);
  const b = side(second);
  const noise = g.normal("Politics") * (race.office.kind === "Senate" ? SENATE_NOISE_SD : RACE_NOISE_SD);
  const [sa, sb] = shares(race.lean_pts, a.contender, b.contender, climate, noise);
  const won = sa >= sb ? a : b;
  const party = won.contender.party;
  return { seated: won.person === running ? null : seat(p, won.person, party, race.office, date), party };
}

/** D988: a legislator's chance of retiring at an election. */
export function retireChance(age: number): number {
  const over = Math.max(0, age - LEGISLATOR_RETIRE_FROM_AGE);
  return LEGISLATOR_RETIRE_BASE + over * LEGISLATOR_RETIRE_PER_YEAR;
}

/** D988: past the age a legislator is certain to retire, so nobody runs for president either. */
function pastRunning(c: Politician): boolean {
  return retireChance(c.age) >= 1;
}

/** D988: a judge's yearly chance of retiring. */
export function judgeRetireChance(age: number): number {
  const over = age - JUDGE_RETIRE_FROM_AGE;
  return over <= 0 ? 0 : over * JUDGE_RETIRE_PER_YEAR;
}

/** The sitting president; the state always has one once started. */
function sittingPresident(p: PoliticsState): Politician {
  const found = officeHolders(p, "President")[0];
  if (found === undefined) throw new Error("no sitting president");
  return found;
}

/** A party's presidential nominee (D985): the eligible president, the VP, or the best senator. */
interface Nominee {
  party: Party;
  /** A politician when they already hold an office; drawn otherwise. */
  person: Politician | Drawn;
  incumbent: boolean;
}

function presidentialNominee(
  p: PoliticsState,
  g: DrawSource,
  names: NameBook,
  party: Party,
  senateClass: number,
): Nominee {
  const president = sittingPresident(p);
  if (party === president.party) {
    if (p.president_terms < PRESIDENT_TERM_LIMIT && !pastRunning(president)) {
      return { party, person: president, incumbent: true };
    }
    const vp = officeHolders(p, "VicePresident")[0];
    if (vp !== undefined) return { party, person: vp, incumbent: false };
  }
  // Highest Persuasion among the party's senators not up this November (their seat is safe to
  // leave) and young enough to run; ties to the lower id. The table is in id order.
  let best: Politician | null = null;
  for (const c of p.politicians) {
    if (c.office.kind !== "Senate" || c.party !== party) continue;
    if (c.office.senate_class === senateClass || c.age < PRESIDENT_RANGES.age.lo || pastRunning(c)) continue;
    if (best === null || c.skills.persuasion > best.skills.persuasion) best = c;
  }
  const person = best ?? drawPerson(g, names, PRESIDENT_RANGES, "persuasion", party);
  return { party, person, incumbent: false };
}

/** The nominees and the national vote (4.6.2, 4.6.3): every state's shares weighted by its population. */
function presidentialRace(
  p: PoliticsState,
  g: DrawSource,
  names: NameBook,
  senateClass: number,
  climate: VoteClimate,
): { winner: Nominee; loser: Nominee; shares: [number, number] } {
  const [first, second] = PARTY_VALUES;
  const a = presidentialNominee(p, g, names, first, senateClass);
  const b = presidentialNominee(p, g, names, second, senateClass);
  const contender = (n: Nominee): Contender => ({
    party: n.party,
    persuasion: n.person.skills.persuasion,
    incumbency: n.incumbent ? PRESIDENT_INCUMBENCY : 0,
  });
  const national: VoteClimate = {
    ...climate,
    swing: climate.swing + g.normal("Politics") * PRESIDENT_SWING_SD,
  };
  let dem = 0;
  let total = 0;
  for (const s of p.states) {
    const noise = g.normal("Politics") * RACE_NOISE_SD;
    dem += s.weight * shares(s.lean_pts, contender(a), contender(b), national, noise)[0];
    total += s.weight;
  }
  const share = dem / total;
  return share >= 1 - share
    ? { winner: a, loser: b, shares: [share, 1 - share] }
    : { winner: b, loser: a, shares: [share, 1 - share] };
}

/** Election Day (D985): decides every race now; winners take office at the January handovers. */
function electionDayJob(world: World, p: PoliticsState, g: DrawSource, date: SimDate): void {
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
  const presidency = isPresidentYear(date.year) ? presidentialRace(p, g, names, senateClass, climate) : null;
  const legislators: Politician[] = [];
  const house: { party: Party }[] = [];
  // Senators not up carry over.
  const senate: { party: Party }[] = officeHolders(p, "Senate").filter(
    (c) => c.office.kind === "Senate" && c.office.senate_class !== senateClass,
  );
  for (const race of congressRaces(p, senateClass)) {
    const out = runRace(p, g, names, race, climate, holders, date);
    if (out.seated !== null) legislators.push(out.seated);
    (race.office.kind === "House" ? house : senate).push(out);
  }
  const result: ElectionResult = {
    date,
    house: partySeats(house),
    senate: partySeats(senate),
    senate_class: senateClass,
    president: null,
  };
  let presidentElect: Politician | null = null;
  if (presidency !== null) {
    const { winner, loser } = presidency;
    const person = winner.person;
    // A copy of a sitting politician: pending must not alias the table, which a save would split apart.
    presidentElect =
      "id" in person ? { ...person } : seat(p, person, winner.party, { kind: "President" }, date);
    result.president = {
      winner: person.name,
      party: winner.party,
      loser: loser.person.name,
      shares: presidency.shares,
    };
    newsWireQueue(
      world.news,
      politicsHeadline(date, `${person.name} (${winner.party}) wins the US presidency`),
    );
  }
  newsWireQueue(
    world.news,
    politicsHeadline(
      date,
      `US Congress after the vote: House ${result.house[0]} D, ${result.house[1]} R; Senate ${result.senate[0]} D, ${result.senate[1]} R`,
    ),
  );
  p.elections.push(result);
  p.pending = { legislators, president_elect: presidentElect };
}

// ---------------------------------------------------------------- handovers

/** 3 January (D985): new members replace whoever held their seat. */
function congressHandover(p: PoliticsState, date: SimDate): void {
  const pending = p.pending;
  if (pending === null || pending.legislators.length === 0) return;
  for (const c of pending.legislators) c.since = date;
  const taken = new Set(pending.legislators.map((c) => seatKey(c.office)));
  p.politicians = p.politicians.filter((c) => !taken.has(seatKey(c.office)));
  p.politicians.push(...pending.legislators);
  p.politicians.sort((a, b) => a.id - b.id);
  pending.legislators = [];
}

/** 20 January (D985): the president-elect takes office; a new president means a new cabinet. */
function presidentHandover(world: World, p: PoliticsState, g: DrawSource, date: SimDate): void {
  const elect = p.pending?.president_elect ?? null;
  p.pending = null;
  if (elect === null) return;
  const outgoing = sittingPresident(p);
  if (elect.id === outgoing.id) {
    p.president_terms += 1;
    return;
  }
  const names = usNames(world, p);
  // By id: the elect is a copy of the one in the table after a save and load.
  const held = p.politicians.find((c) => c.id === elect.id);
  const incoming = held ?? elect;
  if (held === undefined) p.politicians.push(incoming);
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
  newsWireQueue(world.news, politicsHeadline(date, `${incoming.name} is sworn in as US president`));
}

// ---------------------------------------------------------------- appointments

/** The best of the drawn candidates by the 4.7.3 score, simplified (D984); ties to the first drawn. */
function bestCandidate(
  g: DrawSource,
  names: NameBook,
  ranges: OfficeRanges,
  skill: SkillKind,
  appointerParty: Party,
  sameChance: number,
): { drawn: Drawn; party: Party } {
  const draw = () => {
    const party = g.chance("Politics", sameChance) ? appointerParty : otherParty(appointerParty);
    const drawn = drawPerson(g, names, ranges, skill, party);
    return { drawn, party, score: drawn.skills[skill] + (party === appointerParty ? SAME_PARTY_BONUS : 0) };
  };
  let best = draw();
  for (let i = 1; i < APPOINTMENT_CANDIDATES; i++) {
    const next = draw();
    if (next.score > best.score) best = next;
  }
  return best;
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
    if (post.kind !== "VicePresident" && post.kind !== "Cabinet") return;
    const { drawn, party } = bestCandidate(g, names, CABINET_RANGES, post.skill, president.party, 1);
    const office: Office = { kind: post.kind, post: ordinal<PoliticsPostId>(i) };
    p.politicians.push(seat(p, drawn, party, office, date));
  });
}

function isCourt(post: PoliticsPost): post is PoliticsPost & { kind: "Supreme" | "Appeals" | "Trial" } {
  return post.kind === "Supreme" || post.kind === "Appeals" || post.kind === "Trial";
}

/** Fills every empty judge seat (4.7.3, 4.21.1): nominate, then the Senate confirms or rejects. */
function fillCourtVacancies(
  p: PoliticsState,
  g: DrawSource,
  names: NameBook,
  president: Politician,
  date: SimDate,
): void {
  const friendly =
    officeHolders(p, "Senate").filter((c) => c.party === president.party).length >= SENATE_MAJORITY;
  const confirm = friendly ? CONFIRM_CHANCE_FRIENDLY : CONFIRM_CHANCE_HOSTILE;
  p.posts.forEach((post, i) => {
    if (!isCourt(post)) return;
    const nominate = () =>
      bestCandidate(g, names, JUDGE_RANGES, post.skill, president.party, NOMINEE_SAME_PARTY_CHANCE);
    const sitting = p.politicians.filter((c) => c.office.kind === "Judge" && c.office.post === i).length;
    for (let s = sitting; s < post.seats; s++) {
      let pick = nominate();
      for (let t = 1; t < CONFIRM_TRIES && !g.chance("Politics", confirm); t++) pick = nominate();
      const judge = seat(
        p,
        pick.drawn,
        pick.party,
        { kind: "Judge", post: ordinal<PoliticsPostId>(i), level: post.kind },
        date,
      );
      judge.integrity = rangeDraw(JUDGE_INTEGRITY, g);
      judge.leaning = drawJudgeLeaning(g);
      p.politicians.push(judge);
    }
  });
}

/** 1 January (D988): politicians age a year; judges may retire, and the president fills the seats. */
function newYear(world: World, p: PoliticsState, g: DrawSource, date: SimDate): void {
  for (const c of p.politicians) c.age += 1;
  // Winners waiting for their handover are a year older too.
  for (const c of p.pending?.legislators ?? []) c.age += 1;
  const elect = p.pending?.president_elect;
  if (elect) elect.age += 1;
  p.politicians = p.politicians.filter(
    (c) => c.office.kind !== "Judge" || !g.chance("Politics", judgeRetireChance(c.age)),
  );
  fillCourtVacancies(p, g, usNames(world, p), sittingPresident(p), date);
}

// ---------------------------------------------------------------- the job

/** The daily job (D985): acts only on the politics days of `isPoliticsDay`. */
export function politicsJob(world: World, ctx: JobCtx): void {
  const p = world.politics;
  const date = ctx.facts.date;
  if (!isPoliticsDay(date)) return;
  const g = politicsDraws(ctx.draws);
  if (isElectionDay(date)) electionDayJob(world, p, g, date);
  else if (date.day === 1) newYear(world, p, g, date);
  else if (date.day === CONGRESS_HANDOVER_DAY) congressHandover(p, date);
  else if (date.day === PRESIDENT_HANDOVER_DAY) presidentHandover(world, p, g, date);
}

/** Registers the job (`jobs.ts`). */
export function register(s: Scheduler): void {
  schedulerRegister(s, "DailyPolitics", "politics.calendar", politicsJob);
}
