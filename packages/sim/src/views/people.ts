// v_people's builder (pivot 5.7 to 5.11; D1037, D1041), owned by lane C (careers): every person in
// `World.persons`, in or out of office, as public record (name, age, party, faction, home state,
// status, the office held now and every office held with how it began and ended), and the
// chambers' make-up. Hidden stats (pivot 5.11: skills, traits, integrity, XP and level) are null
// unless the Omniscient debug toggle is on, so a UI that reads only views cannot leak them.

import { houseSeatsOf } from "../politics/careers.ts";
import { personGet } from "../politics/people.ts";
import { dateTimeDate } from "../time/calendar.ts";
import type { SimDate } from "../types/calendar.ts";
import { ordinal, type PersonId, type UsStateId } from "../types/ids.ts";
import type { OfficeSeat, PersonsState } from "../types/state/persons.ts";
import { PARTY_VALUES, type Party, type PoliticsState } from "../types/state/politics.ts";
import type { ChamberRow, PeopleView, PersonRow } from "../types/views/people.ts";
import type { World } from "../types/world.ts";
import type { ViewBuilder, ViewInput } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyPeople(): PeopleView {
  return { people: [], chambers: [] };
}

/** A seat as the records write it: "Governor of Ohio", "Representative, Texas 12" (`CareerEntry.title`). */
export function seatTitle(p: PoliticsState, seat: OfficeSeat): string {
  const state = (s: number): string => p.states[s]?.name ?? `state ${s}`;
  switch (seat.kind) {
    case "President":
      return "President of the United States";
    case "VicePresident":
      return "Vice President of the United States";
    case "Cabinet":
      return p.posts[seat.post]?.title ?? `Cabinet post ${seat.post}`;
    case "Senate":
      return `Senator, ${state(seat.state)}`;
    case "House":
      return `Representative, ${state(seat.state)} ${seat.district}`;
    case "Governor":
      return `Governor of ${state(seat.state)}`;
    case "Judge": {
      const title = p.posts[seat.post]?.title ?? `Court ${seat.post}`;
      return seat.level === "Supreme" ? `Justice, ${title}` : `Judge, ${title}`;
    }
    case "FedChair":
      return "Chair of the Federal Reserve";
  }
}

const date = (d: SimDate): SimDate => ({ year: d.year, month: d.month, day: d.day });

/** One chamber's seats by party, vacancies and majority (D1037). */
function chamber(world: World, kind: "House" | "Senate"): ChamberRow {
  const s = world.persons;
  const p = world.politics;
  const seats = new Map<Party, number>();
  let independents = 0;
  let filled = 0;
  for (const o of s.offices) {
    if (o.seat.kind !== kind) continue;
    filled += 1;
    const party = personGet(s, o.person)?.party ?? null;
    if (party === null) independents += 1;
    else seats.set(party, (seats.get(party) ?? 0) + 1);
  }
  let total = 0;
  p.states.forEach((st, i) => {
    total += kind === "House" ? houseSeatsOf(world, ordinal<UsStateId>(i)) : st.senate_classes.length;
  });
  const parties = PARTY_VALUES.map((party) => ({ party, seats: seats.get(party) ?? 0 }));
  let majority: Party | null = null;
  for (const row of parties) if (row.seats * 2 > total) majority = row.party;
  if (majority === null && kind === "Senate") {
    // A tie goes to the vice president's party (pivot 5.8; D984).
    const vp = s.offices.find((o) => o.seat.kind === "VicePresident");
    const vpParty = vp === undefined ? null : (personGet(s, vp.person)?.party ?? null);
    const tied = parties.find((row) => row.seats * 2 === total && row.party === vpParty);
    if (tied !== undefined) majority = tied.party;
  }
  return { chamber: kind, parties, independents, vacant: Math.max(0, total - filled), majority };
}

/** The office each person holds now: the first in table order. */
function heldNow(s: PersonsState): Map<PersonId, OfficeSeat> {
  const out = new Map<PersonId, OfficeSeat>();
  for (const o of s.offices) if (!out.has(o.person)) out.set(o.person, o.seat);
  return out;
}

/** v_people (pivot 5.7 to 5.11): built anew each day; hidden stats only under Omniscient. */
export function buildPeople(input: ViewInput): PeopleView {
  const w = input.world;
  const s = w.persons;
  if (s.persons.length === 0) return emptyPeople();
  const omni = input.controls.omniscient;
  const year = dateTimeDate(w.clock).year;
  const now = heldNow(s);
  const people = s.persons.map((p): PersonRow => {
    const seat = now.get(p.id);
    return {
      id: p.id,
      name: p.name,
      age: year - p.born,
      party: p.party,
      ideology: p.ideology,
      home_state: p.home_state,
      status: p.status,
      office: seat === undefined ? null : seatTitle(w.politics, seat),
      career: p.career.map((c) => ({
        title: seatTitle(w.politics, c.seat),
        how: c.how,
        from: date(c.from),
        to: c.to === null ? null : date(c.to),
        exit: c.exit,
      })),
      skills: omni ? { ...p.skills } : null,
      traits: omni ? [...p.traits] : null,
      integrity: omni ? p.integrity : null,
      xp: omni ? p.xp : null,
      level: omni ? p.level : null,
    };
  });
  return { people, chambers: [chamber(w, "House"), chamber(w, "Senate")] };
}

/** v_people's slot in `VIEW_BUILDERS`. */
export const peopleBuilder: ViewBuilder<PeopleView> = {
  rust: "(none: pivot 5.7)",
  empty: emptyPeople,
  build: buildPeople,
};
