// v_politics (types/views/politics.ts; politics POC, D980): reads World.politics, rebuilt monthly and
// on the US political calendar's days (D985).

import { isPresidentYear, nextElectionAfter, senateClassUp } from "../politics/calendar.ts";
import { partySeats } from "../politics/jobs.ts";
import { dateTimeDate } from "../time/calendar.ts";
import {
  COURT_LEVEL_VALUES,
  type Office,
  type Politician,
  type PoliticsState,
} from "../types/state/politics.ts";
import type { CourtRow, PoliticianRow, PoliticsView } from "../types/views/politics.ts";
import type { ViewInput } from "./index.ts";

/** The holder's title as shown (D980). */
export function officeTitle(p: PoliticsState, o: Office): string {
  switch (o.kind) {
    case "President":
      return "President";
    case "VicePresident":
    case "Cabinet":
    case "Judge":
      return p.posts[o.post]?.title ?? "";
    case "House": {
      const d = p.districts[o.district];
      return `${p.states[o.state]?.name ?? ""} ${d?.number ?? ""}`;
    }
    case "Senate":
      return `${p.states[o.state]?.name ?? ""} (class ${o.senate_class})`;
  }
}

function row(p: PoliticsState, c: Politician): PoliticianRow {
  const o = c.office;
  return {
    id: c.id,
    name: c.name,
    age: c.age,
    party: c.party,
    ideology: c.ideology,
    title: officeTitle(p, o),
    state: o.kind === "House" || o.kind === "Senate" ? (p.states[o.state]?.name ?? null) : null,
    province: o.kind === "House" ? (p.districts[o.district]?.home_province ?? null) : null,
    skills: { ...c.skills },
    traits: c.traits.slice(),
    since: c.since,
    integrity: c.integrity,
    leaning: c.leaning,
  };
}

/** The view of a world without the USA, and before the first build. */
export function emptyPolitics(): PoliticsView {
  return {
    active: false,
    president: null,
    president_terms: 0,
    vice_president: null,
    cabinet: [],
    house: [],
    house_seats: [0, 0],
    senate: [],
    senate_seats: [0, 0],
    courts: [],
    next_election: null,
    next_is_presidential: false,
    next_senate_class: 0,
    elections: [],
  };
}

export function buildPolitics(input: ViewInput): PoliticsView {
  const p = input.world.politics;
  if (!p) return emptyPolitics();
  const of = (kind: Office["kind"]) => p.politicians.filter((c) => c.office.kind === kind);
  const byPost = (a: Politician, b: Politician): number => {
    const ap = a.office.kind === "Cabinet" ? a.office.post : 0;
    const bp = b.office.kind === "Cabinet" ? b.office.post : 0;
    return ap - bp;
  };
  const byDistrict = (a: Politician, b: Politician): number => {
    const ad = a.office.kind === "House" ? a.office.district : 0;
    const bd = b.office.kind === "House" ? b.office.district : 0;
    return ad - bd;
  };
  const bySeat = (a: Politician, b: Politician): number => {
    if (a.office.kind !== "Senate" || b.office.kind !== "Senate") return 0;
    return a.office.state - b.office.state || a.office.senate_class - b.office.senate_class;
  };
  const house = of("House");
  const senate = of("Senate");
  const courts: CourtRow[] = COURT_LEVEL_VALUES.map((level) => {
    const judges = of("Judge").filter((c) => c.office.kind === "Judge" && c.office.level === level);
    return { level, judges: judges.map((c) => row(p, c)), seats: partySeats(judges) };
  });
  const next = nextElectionAfter(dateTimeDate(input.world.clock));
  const president = of("President")[0] ?? null;
  const vp = of("VicePresident")[0] ?? null;
  return {
    active: true,
    president: president === null ? null : row(p, president),
    president_terms: p.president_terms,
    vice_president: vp === null ? null : row(p, vp),
    cabinet: of("Cabinet")
      .sort(byPost)
      .map((c) => row(p, c)),
    house: house.sort(byDistrict).map((c) => row(p, c)),
    house_seats: partySeats(house),
    senate: senate.sort(bySeat).map((c) => row(p, c)),
    senate_seats: partySeats(senate),
    courts,
    next_election: next,
    next_is_presidential: isPresidentYear(next.year),
    next_senate_class: senateClassUp(next.year),
    elections: p.elections.slice().reverse(),
  };
}
