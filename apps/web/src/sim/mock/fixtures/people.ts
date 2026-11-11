// The mock's people (v_people; pivot 5.7 to 5.11): invented politicians with public records and
// hidden stats. Names come from the world's own name lists (names/*.csv, the anglo culture), so no
// real politician appears.

import {
  type CareerEntry,
  type ChamberRow,
  type Ideology,
  type Party,
  type PeopleView,
  type PersonId,
  type PersonStatus,
  type SimDate,
  type Skills,
  TRAIT_VALUES,
  type Trait,
  type UsStateId,
} from "@tc20ff/sim";
import type { MockWorld } from "../mockWorld.ts";
import type { MockRng } from "./rng.ts";

export interface MockPerson {
  id: PersonId;
  name: string;
  age: number;
  party: Party | null;
  ideology: Ideology;
  home_state: UsStateId;
  status: PersonStatus;
  office: string | null;
  career: CareerEntry[];
  /** Hidden (pivot 5.11). */
  skills: Skills;
  traits: Trait[];
  integrity: number;
  xp: number;
  level: number;
}

/** The factions of each party (pivot 5.12), most common first. */
const FACTIONS: Readonly<Record<Party, readonly Ideology[]>> = {
  Democrats: ["Liberals", "Liberals", "EffectiveAltruists", "Communists", "NeoLuddites", "Transhumanists"],
  Republicans: ["Sovereigntists", "Sovereigntists", "Landites", "Chuds", "Accelerationists", "Liberals"],
};
const ALL_IDEOLOGIES: readonly Ideology[] = [
  "Liberals",
  "Communists",
  "Accelerationists",
  "EffectiveAltruists",
  "Transhumanists",
  "NeoLuddites",
  "Sovereigntists",
  "Landites",
  "Chuds",
];

/**
 * The mock's own names, added to the world's when its lists are short (the 2020 world has 24 anglo
 * surnames; the mock needs about 140 people with few shared ones). Invented combinations only.
 */
const EXTRA_FIRST = [
  "Avery",
  "Blake",
  "Casey",
  "Dana",
  "Ellis",
  "Flynn",
  "Greer",
  "Harper",
  "Ines",
  "Jules",
  "Kerry",
  "Lane",
  "Marlo",
  "Noor",
  "Odell",
  "Perrin",
  "Quinn",
  "Reese",
  "Sasha",
  "Tobin",
  "Una",
  "Vaughn",
  "Wren",
  "Yael",
  "Anselm",
  "Briony",
  "Cormac",
  "Delia",
  "Emeric",
  "Fenella",
  "Garrick",
  "Honor",
  "Ignatius",
  "Jocasta",
];
const EXTRA_LAST = [
  "Stone",
  "Mercer",
  "Vale",
  "Hartwell",
  "Quist",
  "Brandt",
  "Okafor",
  "Lindqvist",
  "Ruiz",
  "Tanaka",
  "Abernathy",
  "Bellweather",
  "Castellan",
  "Drummond",
  "Easterbrook",
  "Farrow",
  "Gallowglass",
  "Halloran",
  "Iverson",
  "Jessop",
  "Kettering",
  "Lockridge",
  "Mandeville",
  "Northcott",
  "Oyelaran",
  "Pennington",
  "Quarles",
  "Rosenthal",
  "Sutcliffe",
  "Thibodeaux",
  "Underhill",
  "Vanterpool",
  "Winterbourne",
  "Yarborough",
  "Zeller",
  "Achterberg",
  "Bontemps",
  "Coverdale",
  "Dragomir",
  "Eisenhart",
  "Fontaine",
  "Greenhalgh",
  "Hollingworth",
  "Imamura",
  "Jankowski",
  "Kowalczyk",
  "Lachance",
  "Montenegro",
  "Nakashima",
  "Oberholtzer",
  "Papadakis",
  "Quintanilla",
  "Ravenscroft",
  "Szymanski",
  "Trevelyan",
  "Usher",
  "Villanueva",
  "Wainwright",
  "Xiong",
  "Yoder",
  "Zamora",
  "Ashcombe",
  "Birkenhead",
  "Clutterbuck",
  "Dunwoody",
];
/** More surnames, made of a stem and an ending: 200 of them. */
const STEMS = [
  "Ash",
  "Black",
  "Carr",
  "Dun",
  "Elm",
  "Fair",
  "Glen",
  "Hart",
  "King",
  "Lang",
  "Marsh",
  "North",
  "Oak",
  "Pem",
  "Red",
  "Stan",
  "Thorn",
  "West",
  "Whit",
  "Wood",
];
const ENDINGS = ["by", "combe", "ford", "field", "ley", "man", "ridge", "ton", "well", "worth"];
const MADE_LAST = STEMS.flatMap((s) => ENDINGS.map((e) => s + e));
/** A world list shorter than this is topped up with the mock's own. */
const ENOUGH_FIRST = 60;
const ENOUGH_LAST = 150;

/** Experience points per level (pivot 5.10; a mock number). */
const XP_PER_LEVEL = 100;

export interface PersonSpec {
  party: Party | null;
  home: UsStateId;
  status: PersonStatus;
  office?: string | null;
  career?: CareerEntry[];
  /** Youngest and oldest age. */
  age?: [number, number];
}

/** Makes people one at a time, with ids in the order made and no name used twice. */
export class PeopleGen {
  readonly people: MockPerson[] = [];
  private readonly first: string[];
  private readonly last: string[];
  private readonly used = new Set<string>();

  constructor(
    base: MockWorld,
    private readonly rng: MockRng,
  ) {
    const anglo = base.data.names.flatMap((t) => t.rows).filter((r) => r.culture === "anglo");
    const first = anglo.filter((r) => r.kind === "Male" || r.kind === "Female").map((r) => r.name);
    const last = anglo.filter((r) => r.kind === "Surname").map((r) => r.name);
    this.first = first.length >= ENOUGH_FIRST ? first : [...new Set([...first, ...EXTRA_FIRST])];
    this.last = last.length >= ENOUGH_LAST ? last : [...new Set([...last, ...EXTRA_LAST, ...MADE_LAST])];
  }

  private name(): string {
    for (let i = 0; i < 50; i++) {
      const n = `${this.rng.pick(this.first)} ${this.rng.pick(this.last)}`;
      if (!this.used.has(n)) {
        this.used.add(n);
        return n;
      }
    }
    const n = `${this.rng.pick(this.first)} ${this.rng.pick(this.last)} ${this.people.length}`;
    this.used.add(n);
    return n;
  }

  make(spec: PersonSpec): MockPerson {
    const rng = this.rng;
    const skill = () => 4 + rng.int(22);
    const traits: Trait[] = [];
    const pairs = new Set<number>();
    const want = 2 + rng.int(2);
    while (traits.length < want) {
      const i = rng.int(TRAIT_VALUES.length);
      if (pairs.has(i >> 1)) continue;
      pairs.add(i >> 1);
      traits.push(TRAIT_VALUES[i] as Trait);
    }
    const xp = rng.int(900);
    const [lo, hi] = spec.age ?? [38, 72];
    const p: MockPerson = {
      id: this.people.length as PersonId,
      name: this.name(),
      age: lo + rng.int(hi - lo + 1),
      party: spec.party,
      ideology: spec.party === null ? rng.pick(ALL_IDEOLOGIES) : rng.pick(FACTIONS[spec.party]),
      home_state: spec.home,
      status: spec.status,
      office: spec.office ?? null,
      career: spec.career ?? [],
      skills: {
        finance: skill(),
        operations: skill(),
        persuasion: skill(),
        intrigue: skill(),
        tech: skill(),
        hustle: skill(),
      },
      traits,
      integrity: 15 + rng.int(80),
      xp,
      level: Math.floor(xp / XP_PER_LEVEL),
    };
    this.people.push(p);
    return p;
  }
}

/** A career line held now, from 3 January of `year`. */
export function held(title: string, year: number): CareerEntry {
  return { title, how: "Elected", from: { year, month: 1, day: 3 }, to: null, exit: null };
}
export function past(title: string, from: number, to: number): CareerEntry {
  return {
    title,
    how: "Elected",
    from: { year: from, month: 1, day: 3 },
    to: { year: to, month: 1, day: 3 },
    exit: "TermEnded",
  };
}

/** A person leaves their office on `date` (a resignation: pivot 5.9). */
export function leaveOffice(p: MockPerson, date: SimDate): MockPerson {
  return {
    ...p,
    status: "Retired",
    office: null,
    career: p.career.map((c) => (c.to === null ? { ...c, to: date, exit: "Resigned" } : c)),
  };
}

/** v_people: hidden stats null unless Omniscient (pivot 5.11). */
export function peopleView(
  people: MockPerson[],
  omniscient: boolean,
  chambers: ChamberRow[] = [],
): PeopleView {
  return {
    chambers,
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      party: p.party,
      ideology: p.ideology,
      home_state: p.home_state,
      status: p.status,
      office: p.office,
      career: p.career,
      skills: omniscient ? p.skills : null,
      traits: omniscient ? p.traits : null,
      integrity: omniscient ? p.integrity : null,
      xp: omniscient ? p.xp : null,
      level: omniscient ? p.level : null,
    })),
  };
}
