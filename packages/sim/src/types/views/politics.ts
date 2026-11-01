// v_politics: the US politics page's data (politics POC, D980 to D988): the president and cabinet,
// both chambers, the courts, the next vote and every past vote. All of it is public.

import type { SimDate } from "../calendar.ts";
import type { CountryId, ProvinceId } from "../ids.ts";
import type { CourtLevel, ElectionResult, Ideology, JudgeLeaning, Party } from "../state/politics.ts";
import type { Skills, Trait } from "./shared.ts";

/** One office holder. */
export interface PoliticianRow {
  id: number;
  name: string;
  /** u8. */
  age: number;
  party: Party;
  ideology: Ideology;
  /** "President", "Secretary of State", "Texas 12", "Texas (class 1)", "Supreme Court". */
  title: string;
  /** A House member's home province. */
  province: ProvinceId | null;
  skills: Skills;
  traits: Trait[];
  since: SimDate;
  integrity: number | null;
  leaning: JudgeLeaning | null;
}

/** One court level's bench. */
export interface CourtRow {
  level: CourtLevel;
  judges: PoliticianRow[];
  /** Democrat then Republican appointees. */
  seats: [number, number];
}

/** The next November vote. */
export interface NextVote {
  date: SimDate;
  /** It includes the president. */
  presidential: boolean;
  /** The Senate class up. */
  senate_class: number;
}

export interface PoliticsView {
  /** The country this government runs; null before the first build. */
  country: CountryId | null;
  president: PoliticianRow | null;
  /** Terms won by the sitting president, the current one included. */
  president_terms: number;
  vice_president: PoliticianRow | null;
  cabinet: PoliticianRow[];
  house: PoliticianRow[];
  /** Democrats then Republicans. */
  house_seats: [number, number];
  senate: PoliticianRow[];
  senate_seats: [number, number];
  courts: CourtRow[];
  next: NextVote | null;
  /** Newest first. */
  elections: ElectionResult[];
}
