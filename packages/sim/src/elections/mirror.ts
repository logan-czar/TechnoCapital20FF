// The politics POC's table as a mirror (D1040). In a world with counties, lane E's elections decide
// the seats in `World.persons`; the readers that still read `PoliticsState` (the era's lever drift,
// era/policy.ts; v_politics and the politics page; the tides' list of presidents) keep working
// because this file writes the elected seats back there: the president, the Senate and the House
// (with `districts` rebuilt to the plan in force), and one `ElectionResult` per federal general.
// The POC's appointments (vice president, cabinet, courts) stay the POC's until lane C replaces
// them. The M3 contracts change deletes the POC fields and this file with them.

import { newsWireQueue, politicsHeadline } from "../news.ts";
import { executiveHandover, mirrorPolitician } from "../politics/jobs.ts";
import { personGet, seatKey } from "../politics/people.ts";
import type { SimDate } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import { type CountyId, type DistrictId, ordinal, type ProvinceId, type UsStateId } from "../types/ids.ts";
import type { Race } from "../types/state/elections.ts";
import type { County } from "../types/state/geo.ts";
import type { Person } from "../types/state/persons.ts";
import type { District, ElectionResult, Office, Party, Politician } from "../types/state/politics.ts";
import type { World } from "../types/world.ts";
import { countiesByState, districtUnits, houseSeats, shareLean, shareSize } from "./geography.ts";

/** The POC office of an elected seat, or null for one the mirror does not keep. */
function mirrorKey(o: Office, p: World["politics"]): string {
  if (o.kind === "President") return "President";
  if (o.kind === "Senate") return `Senate/${o.state}/${o.senate_class}`;
  if (o.kind === "House") {
    const d = p.districts[o.district];
    return `House/${d?.state}/${d?.number}`;
  }
  return "";
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

/**
 * Rewrites the mirror's elected seats from `World.persons` on `date` (D1040): rows whose person
 * (by name) and seat are unchanged keep their id; the others are new rows. With `executive`, a new
 * president's vice president and cabinet follow (`executiveHandover`).
 */
export function mirrorOffices(world: World, draws: DrawSource, date: SimDate, executive: boolean): void {
  const p = world.politics;
  const old = new Map<string, Politician>();
  for (const c of p.politicians) {
    const key = mirrorKey(c.office, p);
    if (key !== "") old.set(`${key}|${c.name}`, c);
  }
  const oldPresident = p.politicians.find((c) => c.office.kind === "President");
  p.districts = mirrorDistricts(world);
  p.states.forEach((s, si) => {
    s.house_seats = houseSeats(world, ordinal<UsStateId>(si));
  });
  const at = new Map(p.districts.map((d, i) => [`${d.state}/${d.number}`, i] as const));
  const kept = p.politicians.filter((c) => mirrorKey(c.office, p) === "");
  const year = date.year;
  const rows: Politician[] = [];
  for (const o of world.persons.offices) {
    const person = personGet(world.persons, o.person);
    if (person === undefined || person.party === null) continue;
    let office: Office;
    if (o.seat.kind === "President") office = { kind: "President" };
    else if (o.seat.kind === "Senate")
      office = { kind: "Senate", state: o.seat.state, senate_class: o.seat.senate_class };
    else if (o.seat.kind === "House") {
      const i = at.get(`${o.seat.state}/${o.seat.district}`);
      if (i === undefined) continue;
      office = { kind: "House", state: o.seat.state, district: ordinal<DistrictId>(i) };
    } else continue;
    // `seatKey` writes the seats as `mirrorKey` does.
    const key = `${seatKey(o.seat)}|${person.name}`;
    const prev = old.get(key);
    if (prev !== undefined) {
      prev.office = office;
      prev.party = person.party;
      rows.push(prev);
    } else {
      rows.push(mirrorPolitician(p, drawn(person, year), person.party, office, o.since));
    }
  }
  p.politicians = [...kept, ...rows].sort((a, b) => a.id - b.id);
  const president = rows.find((c) => c.office.kind === "President");
  if (president === undefined) return;
  if (oldPresident === undefined || oldPresident.id !== president.id) {
    p.president_terms = 1;
    if (executive) executiveHandover(world, president, draws, date);
  }
}

/** A re-elected president's new term in the mirror (D985's count of terms). */
export function mirrorReelected(world: World): void {
  world.politics.president_terms += 1;
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
