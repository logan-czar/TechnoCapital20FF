// The people of politics and their offices (pivot 5.7 to 5.12; D1037): `World.persons`. Types only.
// Lane C (politics/careers.ts, politics/people.ts) fills and runs it in M2; until then every table
// is empty and the politics POC's `PoliticsState.politicians` (./politics.ts) holds who is in
// office. The two coexist until lane E's elections and lane C's careers take over (pivot-lanes.md
// "The politics POC").
//
// A `Person` outlives office (pivot 5.7): the table keeps everyone who was ever on a bench, ran or
// held office, with the career record the records site and the browser show. Hidden stats (pivot
// 5.11: skills, traits, integrity, XP and level) live here and reach a view only under Omniscient.

import type { SimDate } from "../calendar.ts";
import type { CompanyId, PersonId, PoliticsPostId, UsStateId } from "../ids.ts";
import type { Skills, Trait } from "./people.ts";
import type { CourtLevel, Ideology, Party } from "./politics.ts";

/** Where a person is in public life (pivot 5.9). The same values as v_people's `PersonStatus`. */
export type PersonStatus =
  /** On a state's bench: a rising figure who may run (pivot 5.9 item 1). */
  | "Bench"
  /** Filed in an open race and not yet out of it. */
  | "Candidate"
  | "InOffice"
  /** Out of public life for good, alive (retired, defeated and done, resigned). */
  | "Retired"
  | "Dead";

/** PersonStatus in declaration order. */
export const PERSON_STATUS_VALUES = ["Bench", "Candidate", "InOffice", "Retired", "Dead"] as const;

/** Where a person came from (pivot 5.9). */
export type PersonOrigin =
  /** Held an office at the world's start. */
  | "Start"
  | "Mayor"
  | "StateLegislator"
  | "Business"
  | "Celebrity"
  /** Made when a race lacked a candidate (pivot 5.9 item 2). */
  | "Challenger"
  /** A corporate executive who lost their seat (pivot 5.9 item 3): `Person.company`. */
  | "Executive"
  /** Drawn for an appointment (Cabinet, a court, the Fed). */
  | "Appointee";

/** An office a person can hold (pivot 5.8): one seat of it. */
export type OfficeSeat =
  | { kind: "President" }
  | { kind: "VicePresident" }
  /** One of the 14 Cabinet posts: its row in `PoliticsState.posts`. */
  | { kind: "Cabinet"; post: PoliticsPostId }
  /** `senate_class` is 1, 2 or 3. */
  | { kind: "Senate"; state: UsStateId; senate_class: number }
  /** `district` is the district's number in its state's plan in force (`GeoState.plans`), 1 up. */
  | { kind: "House"; state: UsStateId; district: number }
  | { kind: "Governor"; state: UsStateId }
  /** `seat` numbers the post's seats from 0 (a court post has `PoliticsPost.seats` of them). */
  | { kind: "Judge"; post: PoliticsPostId; level: CourtLevel; seat: number }
  | { kind: "FedChair" };

/** The kinds of office, in the order the offices table and the views list them. */
export const OFFICE_KIND_VALUES = [
  "President",
  "VicePresident",
  "Cabinet",
  "Senate",
  "House",
  "Governor",
  "Judge",
  "FedChair",
] as const satisfies readonly OfficeSeat["kind"][];

/** How a person came to hold an office (pivot 5.9; the request for `CareerEntry.how`). */
export type OfficeHow =
  /** Held it at the world's start. */
  | "Start"
  | "Elected"
  /** Won a special election (pivot 6.1). */
  | "Special"
  | "Appointed"
  /** Took it by succession (a vice president becoming president). */
  | "Succeeded";

/** How a person left an office. */
export type OfficeExit =
  /** Their term ended and they did not run again. */
  | "TermEnded"
  | "Defeated"
  | "Retired"
  | "Resigned"
  | "Died"
  /** Took another office (a senator becoming president). */
  | "Promoted"
  | "Removed";

/** One office a person held or holds (pivot 5.7): a line of the career record. */
export interface CareerRecord {
  seat: OfficeSeat;
  how: OfficeHow;
  from: SimDate;
  /** Null while held. */
  to: SimDate | null;
  /** Null while held. */
  exit: OfficeExit | null;
}

/** A person in politics (pivot 5.7). */
export interface Person {
  id: PersonId;
  name: string;
  /** The year they were born; age is the year now less this. Whole number. */
  born: number;
  /** The six skills of mvp-spec 3.7.1, 0 to 30. Hidden (pivot 5.11). */
  skills: Skills;
  /** Traits of mvp-spec 3.7.1 (ambition is one, pivot 5.9). Hidden (pivot 5.11). */
  traits: Trait[];
  /** 0 to 100 (pivot 5.5, 5.6). Hidden (pivot 5.11). */
  integrity: number;
  /** Their faction inside their party (pivot 5.12). Public. */
  ideology: Ideology;
  /** Null for an independent. */
  party: Party | null;
  home_state: UsStateId;
  status: PersonStatus;
  origin: PersonOrigin;
  /** The company an executive came from (pivot 5.9 item 3); null otherwise. */
  company: CompanyId | null;
  /** Experience points (pivot 5.10). Hidden (pivot 5.11). Whole number. */
  xp: number;
  /** The level `xp` has reached (pivot 5.10); each level raised one skill. Hidden. Whole number. */
  level: number;
  /** Every office held, oldest first; the last may be held now. */
  career: CareerRecord[];
  /** When they left public life (status Retired or Dead); null before. */
  left: SimDate | null;
}

/** Who holds one seat now (pivot 5.8). */
export interface OfficeHolder {
  seat: OfficeSeat;
  person: PersonId;
  since: SimDate;
  /** When the term ends (an elected office's next handover); null for a life or pleasure post. */
  term_ends: SimDate | null;
}

/** How a vacant seat is filled (pivot 6.1 "by office", T). */
export type VacancyFill = "Appointment" | "Special" | "Succession";

/** A seat with nobody in it (pivot 6.1): raised by lane C, filled by C (appointment, succession) or E (special election). */
export interface Vacancy {
  seat: OfficeSeat;
  since: SimDate;
  fill: VacancyFill;
  /** A special election's general day once lane E has set it; null otherwise. */
  special: SimDate | null;
}

/** A party's platform (pivot 5.12): the seat-weighted mix of its officeholders' ideologies. */
export interface PartyPlatform {
  party: Party;
  /** Shares 0 to 1 summing to 1 (or all 0 with no officeholders), in `IDEOLOGY_VALUES` order. */
  mix: number[];
}

/** The people of politics (`World.persons`; pivot 5.7 to 5.12). Empty in every world until lane C. */
export interface PersonsState {
  /** In id order. A person is never removed while referenced by an office, a race or a record. */
  persons: Person[];
  /** Persons made so far, so the next one's id (`PersonId`). Whole number (u32). */
  persons_made: number;
  /** Every filled seat, in `officeSeatOrder` order (politics/people.ts). */
  offices: OfficeHolder[];
  /** Empty seats, oldest first. */
  vacancies: Vacancy[];
  /** Each state's bench (pivot 5.9 item 1), by `UsStateId`: persons in id order. Empty before lane C. */
  benches: PersonId[][];
  /** In `PARTY_VALUES` order once lane C computes them; empty before. */
  platforms: PartyPlatform[];
}
