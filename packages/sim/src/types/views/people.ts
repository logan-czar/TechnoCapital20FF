// v_people (pivot 5.7 to 5.11): every person in politics, in or out of office, as public record:
// who they are, what they hold and what they have held. Lane C builds it (views/people.ts; D1037).
//
// Hidden stats (pivot 5.11): skills, traits, integrity and experience are never shown in play. The
// builder must write `null` in every one of those fields unless the Omniscient debug toggle is on
// (`Controls.omniscient`), so a UI that reads only views cannot leak them. Today's v_politics
// `PoliticianRow` carries skills and traits openly; it is retired with the politics POC.

import type { SimDate } from "../calendar.ts";
import type { PersonId, UsStateId } from "../ids.ts";
import type { OfficeExit, OfficeHow } from "../state/persons.ts";
import type { Ideology, Party } from "../state/politics.ts";
import type { Skills, Trait } from "./shared.ts";

/** Where a person is in public life (pivot 5.9). */
export type PersonStatus = "Bench" | "Candidate" | "InOffice" | "Retired" | "Dead";

/** One line of a career record (pivot 5.7). */
export interface CareerEntry {
  /** "Governor of Ohio", "Representative, Texas 12". */
  title: string;
  /** How they came to hold it (D1037). */
  how: OfficeHow;
  from: SimDate;
  /** Null while it is held. */
  to: SimDate | null;
  /** How they left it; null while it is held. */
  exit: OfficeExit | null;
}

/** A chamber's make-up now (D1037): seats by party, vacancies and who holds the majority. */
export interface ChamberRow {
  chamber: "House" | "Senate";
  /** In `PARTY_VALUES` order. Whole numbers. */
  parties: { party: Party; seats: number }[];
  /** Independents' seats. Whole number. */
  independents: number;
  /** Empty seats. Whole number. */
  vacant: number;
  /** Who controls it (in the Senate a tie goes to the vice president's party); null for none. */
  majority: Party | null;
}

export interface PersonRow {
  id: PersonId;
  name: string;
  /** Whole number. */
  age: number;
  /** Null for an independent. */
  party: Party | null;
  /** Public: a person's ideology is their faction (pivot 5.12). */
  ideology: Ideology;
  home_state: UsStateId;
  status: PersonStatus;
  /** The office held now, as `CareerEntry.title` writes it. */
  office: string | null;
  /** Oldest first. */
  career: CareerEntry[];
  /** Hidden (pivot 5.11): null unless Omniscient. */
  skills: Skills | null;
  /** Hidden (pivot 5.11): null unless Omniscient. */
  traits: Trait[] | null;
  /** 0 to 100. Hidden (pivot 5.11): null unless Omniscient. */
  integrity: number | null;
  /** Experience points (pivot 5.10). Hidden (pivot 5.11): null unless Omniscient. */
  xp: number | null;
  /** The level that experience has reached (pivot 5.10). Hidden (pivot 5.11): null unless Omniscient. */
  level: number | null;
}

export interface PeopleView {
  /** In person id order. */
  people: PersonRow[];
  /** House then Senate; empty before anyone holds a seat. */
  chambers: ChamberRow[];
}
