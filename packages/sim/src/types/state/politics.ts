// Politics POC types the World holds (D980 to D988; 4-politics 4.2.1, 4.4.7, 4.6, 4.7, 4.21.1). USA
// only. Office holders are base characters of class Politician (people.ts `BaseCharacter`). Nothing
// outside politics/, the views and the news reads this state: the economy never sees it.

import type { SimDate } from "../calendar.ts";
import type { CountryId, ProvinceId } from "../ids.ts";
import type { BaseCharacter, SkillKind } from "./people.ts";

/** The two starting parties (4.4.7; D981). */
export type Party = "Democrats" | "Republicans";

/** Party order: index 0 is who a positive lean or swing favours, and ties go to it. */
export const PARTY_VALUES = ["Democrats", "Republicans"] as const;

/** The nine ideologies (5-ideology 5.2). */
export type Ideology =
  | "Liberals"
  | "Communists"
  | "Accelerationists"
  | "EffectiveAltruists"
  | "Transhumanists"
  | "NeoLuddites"
  | "Sovereigntists"
  | "Landites"
  | "Chuds";

/** A judge's bias in cases between these sides (4.21.1). */
export type JudgeLeaning = "Business" | "Neutral" | "State" | "Labor";

/** A court level (4.21.1). */
export type CourtLevel = "Supreme" | "Appeals" | "Trial";

/** Court levels, top down. */
export const COURT_LEVEL_VALUES = ["Supreme", "Appeals", "Trial"] as const;

/** What a politician holds. `post` indexes `PoliticsState.posts`, `state` `.states`, `district` `.districts`. */
export type Office =
  | { kind: "President" }
  | { kind: "VicePresident"; post: number }
  | { kind: "Cabinet"; post: number }
  | { kind: "House"; state: number; district: number }
  /** `senate_class` is 1, 2 or 3. */
  | { kind: "Senate"; state: number; senate_class: number }
  | { kind: "Judge"; post: number; level: CourtLevel };

/** A base character holding a US office (D980). Removed from the table when they leave office. */
export interface Politician extends BaseCharacter {
  class: "Politician";
  /** The politics id, from `PoliticsState.politicians_made`. Whole number (u32). */
  id: number;
  party: Party;
  ideology: Ideology;
  office: Office;
  /** In office since. */
  since: SimDate;
  /** 0 to 100, judges only (4.21.1). */
  integrity: number | null;
  /** Judges only (4.21.1). */
  leaning: JudgeLeaning | null;
}

/** A US state (politics-usa.csv; D980). */
export interface PoliticsUsState {
  name: string;
  /** Whole number. */
  house_seats: number;
  /** The real Senate classes (1, 2, 3); empty for DC. */
  senate_classes: number[];
  /** Party lean: Democrats minus Republicans, in points. */
  lean_pts: number;
  /** The state's share of the national vote: the sum of its provinces' `population`. */
  weight: number;
}

/** A House district (D982). */
export interface District {
  /** Index in `PoliticsState.states`. */
  state: number;
  /** 1 up within its state. */
  number: number;
  /** The state's lean plus this district's fixed offset, in points. */
  lean_pts: number;
  home_province: ProvinceId;
}

/** An appointed post (politics-usa-offices.csv; D983, D984). */
export interface PoliticsPost {
  title: string;
  kind: "VicePresident" | "Cabinet" | CourtLevel;
  /** Whole number. */
  seats: number;
  /** The skill the 4.7.3 appointment score reads. */
  skill: SkillKind;
}

/** Winners who take office at the next handover (D985). */
export interface PendingHandover {
  /** New legislators, taking their seats on 3 January; re-elected members are not here. */
  legislators: Politician[];
  /** Who takes the presidency on 20 January: maybe already in office (president, VP, a senator). */
  president_elect: Politician | null;
}

/** One November's results (D985). */
export interface ElectionResult {
  date: SimDate;
  /** Whole numbers: seats after this election, Democrats then Republicans. */
  house: [number, number];
  senate: [number, number];
  /** The Senate class that was up. */
  senate_class: number;
  /** Null in a midterm year. */
  president: {
    winner: string;
    party: Party;
    loser: string;
    /** Share of the national vote, Democrats then Republicans (4.6.3). */
    shares: [number, number];
  } | null;
}

/** The US political state (World.politics). */
export interface PoliticsState {
  country: CountryId;
  states: PoliticsUsState[];
  districts: District[];
  posts: PoliticsPost[];
  /** Office holders now, in id order. */
  politicians: Politician[];
  /** Politicians made so far, so the next one's id. Whole number (u32). */
  politicians_made: number;
  /** Terms the sitting president has won, the one being served included. Whole number. */
  president_terms: number;
  pending: PendingHandover | null;
  /** Every November so far, oldest first. */
  elections: ElectionResult[];
}
