// The politics POC's table as a mirror (D1040, D1052). In a world with counties the offices table
// (`World.persons`: lane C's careers and lane E's elections) is the one record of who holds office;
// the readers that still read `PoliticsState` (the era's lever drift, era/policy.ts; v_politics and
// the politics page; the tides' list of presidents) keep working because this file copies every
// office the POC knows (the president, the vice president, the cabinet, the Senate, the House with
// `districts` rebuilt to the plan in force, the courts) back there, and writes one `ElectionResult`
// per federal general. Nothing writes the POC's office rows but this file in such a world: the POC's
// own vote, appointments, ageing and census are off there (politics/jobs.ts). The M3 contracts change
// deletes the POC fields and this file with them.

import { newsWireQueue, politicsHeadline } from "../news.ts";
import { mirrorPolitician } from "../politics/jobs.ts";
import { personGet } from "../politics/people.ts";
import type { SimDate } from "../types/calendar.ts";
import {
  type CountyId,
  type DistrictId,
  ordinal,
  type PoliticsPostId,
  type ProvinceId,
  type UsStateId,
} from "../types/ids.ts";
import type { Race } from "../types/state/elections.ts";
import type { County } from "../types/state/geo.ts";
import type { OfficeSeat, Person } from "../types/state/persons.ts";
import type { District, ElectionResult, Office, Party, Politician } from "../types/state/politics.ts";
import type { World } from "../types/world.ts";
import { PRESIDENT_TERM_YEARS } from "./calendar.ts";
import { countiesByState, districtUnits, houseSeats, shareLean, shareSize } from "./geography.ts";

/** A POC row's place as the mirror keys it (the district's state and number for a member). */
function pocKey(o: Office, p: World["politics"]): string {
  switch (o.kind) {
    case "President":
      return "President";
    case "VicePresident":
      return "VicePresident";
    case "Cabinet":
      return `Cabinet/${o.post}`;
    case "Senate":
      return `Senate/${o.state}/${o.senate_class}`;
    case "House": {
      const d = p.districts[o.district];
      return `House/${d?.state}/${d?.number}`;
    }
    case "Judge":
      return `Judge/${o.post}`;
  }
}

/** The same key for a pivot seat, or null for a seat the POC has no office for (governors, the Fed). */
function seatPocKey(seat: OfficeSeat): string | null {
  switch (seat.kind) {
    case "President":
    case "VicePresident":
      return seat.kind;
    case "Cabinet":
      return `Cabinet/${seat.post}`;
    case "Senate":
      return `Senate/${seat.state}/${seat.senate_class}`;
    case "House":
      return `House/${seat.state}/${seat.district}`;
    case "Judge":
      return `Judge/${seat.post}`;
    default:
      return null;
  }
}

/** The POC's districts rebuilt to the plan in force (D982's shape: a state, a number, a lean, a province). */
function mirrorDistricts(world: World): District[] {
  const p = world.politics;
  const byState = countiesByState(world);
  const home = (s: number): ProvinceId => {
    const era = world.era?.politics.states[s]?.provinces[0]?.id;
    if (era !== undefined) return era;
    return p.districts.find((d) => d.state === s)?.home_province ?? ordinal<ProvinceId>(0);
  };
  const out: District[] = [];
  p.states.forEach((_, si) => {
    const state = ordinal<UsStateId>(si);
    const seats = houseSeats(world, state);
    const counties = byState[si] as CountyId[];
    for (let n = 1; n <= seats; n++) {
      let people = 0;
      let lean = 0;
      for (const s of districtUnits(world, state, n, seats, counties)) {
        const c = world.geo.counties[s.county] as County;
        const k = shareSize(c, s);
        people += k;
        lean += k * shareLean(c, s);
      }
      out.push({ state, number: n, lean_pts: people > 0 ? lean / people : 0, home_province: home(si) });
    }
  });
  return out;
}

/** A person as the POC's drawn shape. */
function drawn(person: Person, year: number) {
  return {
    name: person.name,
    age: year - person.born,
    skills: { ...person.skills },
    traits: person.traits.slice(),
    ideology: person.ideology,
  };
}

/** Whole years from `from` to `to`. */
function yearsBetween(from: SimDate, to: SimDate): number {
  return (
    to.year - from.year - (to.month < from.month || (to.month === from.month && to.day < from.day) ? 1 : 0)
  );
}

/**
 * The offices the mirror last copied, per world (a cache, never saved): a sync with nothing changed
 * since is skipped. A sync is idempotent, so a lost cache (a load) only costs one rebuild.
 */
const SYNCED = new WeakMap<World, string>();

/**
 * What the mirror copies, as a cheap fingerprint: each seat's holder and start, the year (ages) and
 * the districts' count. Equal fingerprints mean equal rows (a row's skills are its person's when the
 * row is made, so a level-up later changes nothing here).
 */
function fingerprint(world: World, year: number): string {
  let h = year;
  let n = 0;
  for (const o of world.persons.offices) {
    if (o.seat.kind === "Governor" || o.seat.kind === "FedChair") continue;
    h =
      (Math.imul(h, 31) +
        o.person * 7 +
        o.since.year * 13 +
        o.since.month * 17 +
        o.since.day +
        officeTag(o.seat)) |
      0;
    n += 1;
  }
  return `${n}/${h}/${world.politics.districts.length}`;
}

/** A seat's place as a number for the fingerprint. */
function officeTag(seat: OfficeSeat): number {
  switch (seat.kind) {
    case "Senate":
      return seat.state * 4 + seat.senate_class;
    case "House":
      return seat.state * 1000 + seat.district;
    case "Cabinet":
    case "Judge":
      return seat.post * 100 + (seat.kind === "Judge" ? seat.seat : 0);
    default:
      return 0;
  }
}

/** The sitting president's terms (D985's count), from their seat's start. */
function presidentTerms(world: World, date: SimDate): void {
  const held = world.persons.offices.find((o) => o.seat.kind === "President");
  world.politics.president_terms =
    held === undefined ? 0 : Math.floor(yearsBetween(held.since, date) / PRESIDENT_TERM_YEARS) + 1;
}

/**
 * Rewrites the mirror's rows from `World.persons` on `date` (D1040, D1052): every office the POC
 * knows, its holders' ages, party and integrity (skills as they were when the row was made); a row
 * whose person (by name) and place are
 * unchanged keeps its id, the others are new rows. `districts` rebuilds the POC's districts to the
 * plans in force first (at the start, a House handover, a redraw). A new president is sworn in: the
 * headline and the era's list of presidents (the tides read it); `president_terms` counts the sitting
 * president's terms from their seat's start.
 */
export function mirrorSync(world: World, date: SimDate, districts: boolean): void {
  if (districts || SYNCED.get(world) !== fingerprint(world, date.year)) mirrorRows(world, date, districts);
  presidentTerms(world, date);
}

function mirrorRows(world: World, date: SimDate, districts: boolean): void {
  const p = world.politics;
  // Rows by place and name, in id order; a name twice in one place (two judges of a court) keeps both.
  const old = new Map<string, Politician[]>();
  for (const c of p.politicians) {
    const k = `${pocKey(c.office, p)}|${c.name}`;
    const list = old.get(k);
    if (list === undefined) old.set(k, [c]);
    else list.push(c);
  }
  const oldPresident = p.politicians.find((c) => c.office.kind === "President");
  if (districts) {
    p.districts = mirrorDistricts(world);
    p.states.forEach((s, si) => {
      s.house_seats = houseSeats(world, ordinal<UsStateId>(si));
    });
  }
  const at = new Map(p.districts.map((d, i) => [`${d.state}/${d.number}`, i] as const));
  const vp = p.posts.findIndex((x) => x.kind === "VicePresident");
  const year = date.year;
  const rows: Politician[] = [];
  for (const o of world.persons.offices) {
    const key = seatPocKey(o.seat);
    if (key === null) continue;
    const person = personGet(world.persons, o.person);
    if (person === undefined || person.party === null) continue;
    let office: Office;
    switch (o.seat.kind) {
      case "President":
        office = { kind: "President" };
        break;
      case "VicePresident":
        if (vp < 0) continue;
        office = { kind: "VicePresident", post: ordinal<PoliticsPostId>(vp) };
        break;
      case "Cabinet":
        office = { kind: "Cabinet", post: o.seat.post };
        break;
      case "Senate":
        office = { kind: "Senate", state: o.seat.state, senate_class: o.seat.senate_class };
        break;
      case "House": {
        const i = at.get(`${o.seat.state}/${o.seat.district}`);
        if (i === undefined) continue;
        office = { kind: "House", state: o.seat.state, district: ordinal<DistrictId>(i) };
        break;
      }
      case "Judge":
        office = { kind: "Judge", post: o.seat.post, level: o.seat.level };
        break;
      default:
        continue;
    }
    const prev = old.get(`${key}|${person.name}`)?.shift();
    const row = prev ?? mirrorPolitician(p, drawn(person, year), person.party, office, o.since);
    row.office = office;
    row.party = person.party;
    row.age = year - person.born;
    row.integrity = person.integrity;
    rows.push(row);
  }
  p.politicians = rows.sort((a, b) => a.id - b.id);
  SYNCED.set(world, fingerprint(world, year));
  const president = rows.find((c) => c.office.kind === "President");
  if (president === undefined) return;
  if (oldPresident !== undefined && oldPresident.id !== president.id) {
    newsWireQueue(world.news, politicsHeadline(date, `${president.name} is sworn in as US president`));
    world.era?.history.presidents.push({ year, name: president.name, party: president.party });
  }
}

/**
 * The POC's record of a federal general (D985) from lane E's results on `date`: the House and the
 * Senate after it (the seats not up carried over), the presidency's winner and shares, and the
 * headlines the POC queued.
 */
export function mirrorElection(
  world: World,
  races: readonly Race[],
  date: SimDate,
  senateClass: number,
): void {
  const p = world.politics;
  const partyOf = (id: number): Party | null => personGet(world.persons, id as never)?.party ?? null;
  const house: { party: Party }[] = [];
  const senate: { party: Party }[] = [];
  const raced = new Set<string>();
  let president: ElectionResult["president"] = null;
  for (const r of races) {
    if (r.result === null) continue;
    const party = partyOf(r.result.winner);
    if (r.office === "House" && party !== null) house.push({ party });
    if (r.office === "Senate") {
      raced.add(`${r.state}/${r.senate_class}`);
      if (party !== null) senate.push({ party });
    }
    if (r.office === "President" && party !== null) {
      const winner = personGet(world.persons, r.result.winner);
      const loser = r.ballot.find((id) => id !== r.result?.winner);
      const total = r.result.votes.reduce((a, b) => a + b, 0);
      const share = (i: number): number => (total > 0 ? (r.result?.votes[i] ?? 0) / total : 0);
      president = {
        winner: winner?.name ?? "",
        party,
        loser: loser === undefined ? "" : (personGet(world.persons, loser)?.name ?? ""),
        shares: [share(0), share(1)],
      };
      newsWireQueue(
        world.news,
        politicsHeadline(date, `${winner?.name ?? ""} (${party}) wins the US presidency`),
      );
    }
  }
  for (const o of world.persons.offices) {
    if (o.seat.kind !== "Senate" || raced.has(`${o.seat.state}/${o.seat.senate_class}`)) continue;
    const party = partyOf(o.person);
    if (party !== null) senate.push({ party });
  }
  const seats = (rows: readonly { party: Party }[]): [number, number] => {
    const dem = rows.filter((r) => r.party === "Democrats").length;
    return [dem, rows.length - dem];
  };
  const result: ElectionResult = {
    date,
    house: seats(house),
    senate: seats(senate),
    senate_class: senateClass,
    president,
  };
  newsWireQueue(
    world.news,
    politicsHeadline(
      date,
      `US Congress after the vote: House ${result.house[0]} D, ${result.house[1]} R; Senate ${result.senate[0]} D, ${result.senate[1]} R`,
    ),
  );
  p.elections.push(result);
}
