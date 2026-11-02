// v_politics (types/views/politics.ts; politics POC, D980): reads World.politics, rebuilt only on the
// US political calendar's days, the only days it changes (D985).

import { isPresidentYear, nextElectionAfter, senateClassUp } from "../politics/calendar.ts";
import { ERA_IDEOLOGY_NAMES } from "../politics/era.ts";
import { officeHolders, partySeats } from "../politics/state.ts";
import { dateTimeDate } from "../time/calendar.ts";
import {
  COURT_LEVEL_VALUES,
  type Office,
  type Politician,
  type PoliticsState,
} from "../types/state/politics.ts";
import type { PoliticianRow, PoliticsView } from "../types/views/politics.ts";
import type { ViewInput } from "./index.ts";

/** The holder's title as shown (D980). */
function officeTitle(p: PoliticsState, o: Office): string {
  switch (o.kind) {
    case "President":
      return "President";
    case "VicePresident":
    case "Cabinet":
    case "Judge":
      return p.posts[o.post]?.title ?? "";
    case "House":
      return `${p.states[o.state]?.name ?? ""} ${p.districts[o.district]?.number ?? ""}`;
    case "Senate":
      return `${p.states[o.state]?.name ?? ""} (class ${o.senate_class})`;
  }
}

/** Above any Senate class (1 to 3), so a state's seats sort together. */
const STATE_SORT_STEP = 4;

/** Where a holder sorts among their office's holders: post, district, or state then class. */
function seatOrder(o: Office): number {
  switch (o.kind) {
    case "President":
      return 0;
    case "VicePresident":
    case "Cabinet":
    case "Judge":
      return o.post;
    case "House":
      return o.district;
    case "Senate":
      return o.state * STATE_SORT_STEP + o.senate_class;
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
    province: o.kind === "House" ? (p.districts[o.district]?.home_province ?? null) : null,
    skills: { ...c.skills },
    traits: c.traits.slice(),
    since: c.since,
    integrity: c.integrity,
    leaning: c.leaning,
  };
}

/** The view before the first build, and the mock's. */
export function emptyPolitics(): PoliticsView {
  return {
    country: null,
    president: null,
    president_terms: 0,
    vice_president: null,
    cabinet: [],
    house: [],
    house_seats: [0, 0],
    senate: [],
    senate_seats: [0, 0],
    courts: [],
    next: null,
    elections: [],
  };
}

export function buildPolitics(input: ViewInput): PoliticsView {
  const p = input.world.politics;
  const of = (kind: Office["kind"]): Politician[] =>
    officeHolders(p, kind).sort((a, b) => seatOrder(a.office) - seatOrder(b.office));
  const rows = (cs: readonly Politician[]): PoliticianRow[] => cs.map((c) => row(p, c));
  const house = of("House");
  const senate = of("Senate");
  const judges = of("Judge");
  const date = nextElectionAfter(dateTimeDate(input.world.clock));
  return {
    ...(input.world.era === undefined ? {} : { ideology_names: { ...ERA_IDEOLOGY_NAMES } }),
    country: p.country,
    president: rows(of("President"))[0] ?? null,
    president_terms: p.president_terms,
    vice_president: rows(of("VicePresident"))[0] ?? null,
    cabinet: rows(of("Cabinet")),
    house: rows(house),
    house_seats: partySeats(house),
    senate: rows(senate),
    senate_seats: partySeats(senate),
    courts: COURT_LEVEL_VALUES.map((level) => {
      const bench = judges.filter((c) => c.office.kind === "Judge" && c.office.level === level);
      return { level, judges: rows(bench), seats: partySeats(bench) };
    }),
    next: { date, presidential: isPresidentYear(date.year), senate_class: senateClassUp(date.year) },
    elections: p.elections.slice().reverse(),
  };
}
