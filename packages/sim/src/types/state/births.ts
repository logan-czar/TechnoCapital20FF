// The births state on the World and the births types a Company holds (spec 3.1
// `startup_events`, 5.19, 5.20; build-plan M6.6 to M6.9). Ported from crates/sim/src/births/:
// state.rs (BirthsState, EventRecord, KeyCitySite, Sites), fixed.rs (Trigger, Region,
// FixedGroup, FixedEvent), random.rs (CountRange, EventType, EventKind), names.rs
// (CompanyNames), startup.rs (RunRate) and ipo.rs (VoterRole, BallotVoter, Ballot, VoteResult).
// Types only.
//
// Tuple-variant field names (Rust tuple variants have none; the union tag is `kind`):
// Trigger::Date(Date) is `date`, Region::Superregion(String) `slug`, Region::Country(String)
// `iso3`, EventKind::Random(EventType) `event_type`, EventKind::Fixed(String) `id`,
// VoterRole::Seat(Seat) `seat`, VoterRole::Director(u32) `position`, BallotVoter::Full(CharacterId)
// `character`.
//
// Not ported (logic and types no World field reaches): BirthsState::{from_data, in_regions,
// home_others}, Sites::{superregion_slug, key_city_lists, place}, BadBirthsData,
// PEOPLE_PER_MILLION; Region::{parse, contains}, FixedEvent::from_row, BadEvent; CountRange::{new,
// draw}, TypeRow and TYPE_TABLE, StartupDraft, EventDraft and the random event draws;
// CompanyNames::{build, from_data, draw, ticker} and the name constants; startup.rs Carve,
// CapTable, BirthInputs, Birth and the startup build; cast.rs CastSeat, Cast; ipo.rs
// IpoTestInputs, Voter, Listing, the IPO tests, yes chances and the vote; weights.rs; jobs.rs.

import type { SimDate } from "../calendar.ts";
import type { CharacterId, CompanyId, CountryId, IndustryId, ProvinceId, StartupEventId } from "../ids.ts";
import type { Seat } from "./people.ts";

// ---------------------------------------------------------------- state.rs

/** The World's births state (spec 3.1 `startup_events`, 5.19). */
export interface BirthsState {
  /** F1 to F9 from startup-events.csv, in file order (5.19.2). */
  fixed: FixedEvent[];
  /** Whether each fixed event has fired (3.1 `startup_events` "fired flag"), by `fixed` index. */
  fixed_fired: boolean[];
  /** Every event that fired, fixed or random, in order; the id is the position (3.1). */
  events: EventRecord[];
  /** Company name lists (5.19.3; D272). */
  names: CompanyNames;
  sites: Sites;
  /**
   * The lab whose chatbot sets off the boom (5.1.1, 7-starting-world 7.6; D111, D281), drawn at
   * load right after the pop roll.
   */
  tipped_lab: CompanyId | null;
}

/** One startup event that fired (spec 3.1 `startup_events` log, 9.2 `list_startup_events`). */
export interface EventRecord {
  id: StartupEventId;
  kind: EventKind;
  /** The plan lock it fired at. */
  date: SimDate;
  /** The industries its startups were born in, in birth order (repeats kept). */
  industries: IndustryId[];
  /** The companies it made, in birth order. */
  companies: CompanyId[];
}

/**
 * A key city's site data (spec 5.19.1 HQ weight, 5.18 place names): its name and the industries
 * it lists (key-cities.csv `specialties`, matched by industry name).
 */
export interface KeyCitySite {
  name: string;
  industries: IndustryId[];
}

/** The static province data the HQ draws read (spec 5.19.1; 2-map 2.3.1), by province ordinal. */
export interface Sites {
  /** 2-map 2.3.1 province weight, USD: total development × $0.3B × G (D260). */
  weight: number[];
  /**
   * The startup HQ weight's province part (spec 5.19.1, D830): development above the floor ×
   * $0.3B × G, or `weight` for every province of a country whose provinces all sit at the floor.
   */
  hq_weight: number[];
  /**
   * The countries whose HQ weight fell back to `weight` (all their provinces at the floor), in id
   * order (D830).
   */
  hq_fallback_countries: CountryId[];
  /**
   * The province's superregion, as an index into sim_data `SUPERREGIONS` (the province file
   * names; 5.19.2 regions). Each a u8.
   */
  superregion: number[];
  /** The key city the province belongs to, if any (index into `key_cities`; u32). */
  key_city: (number | null)[];
  key_cities: KeyCitySite[];
  /** The provinces of each country, by country ordinal, each in id order (3.7.2 home province). */
  country_provinces: ProvinceId[][];
}

// ---------------------------------------------------------------- fixed.rs

/** When a fixed event fires (spec 5.19.2). */
export type Trigger =
  /** The first plan lock on or after the date. */
  | { kind: "Date"; date: SimDate }
  /**
   * The first plan lock after the bust ends: the first lock with the AI stage Postcrash (5.1.1;
   * D275).
   */
  | { kind: "AfterBust" };

/** Where a group's startups may put their HQ (startup-events.csv `@region`). */
export type Region =
  | { kind: "Any" }
  /** A superregion slug, as in the province file names (`north-america`). */
  | { kind: "Superregion"; slug: string }
  /** A country iso3 (`CHN`). */
  | { kind: "Country"; iso3: string };

/**
 * One group of an event: `count` startups in `industry_name` (industries.csv name), HQ in any of
 * `regions`.
 */
export interface FixedGroup {
  /** Whole number (u32). */
  count: number;
  industry_name: string;
  regions: Region[];
}

/** A fixed startup event (spec 5.19.2; startup-events.csv). */
export interface FixedEvent {
  id: string;
  name: string;
  trigger: Trigger;
  groups: FixedGroup[];
  /** Revenue each, USD a year, low and high. */
  revenue_usd: [number, number];
  /** Full characters per startup (5.19.4). */
  full: CountRange;
  /** Partial characters per startup (5.19.4). */
  partial: CountRange;
}

// ---------------------------------------------------------------- random.rs

/** An inclusive count range (spec 5.19.1 type table, 5.19.2). Each bound a u8. */
export interface CountRange {
  lo: number;
  hi: number;
}

/** A random startup event's type (spec 5.19.1), in the type table's order. */
export type EventType = "GarageFounder" | "SpinOutTeam" | "HotCluster" | "BackedVenture";

/** EventType in declaration order (the 5.19.1 type table order). */
export const EVENT_TYPE_VALUES = ["GarageFounder", "SpinOutTeam", "HotCluster", "BackedVenture"] as const;

/** What an event is: random of a type, or fixed (startup-events.csv id). */
export type EventKind =
  | { kind: "Random"; event_type: EventType }
  /** `id`: the startup-events.csv id. */
  | { kind: "Fixed"; id: string };

// ---------------------------------------------------------------- names.rs

/**
 * The company name lists (spec 5.19.3 "generated from the world-gen name lists, unique"; D272),
 * one prefix list per country and one suffix list per industry, in id order (D4). Built once at
 * load and stored on the World like `NameBooks`. Every field is private in Rust.
 */
export interface CompanyNames {
  /** Distinct prefix lists; `by_country` indexes into it. */
  prefix_lists: string[][];
  /** For each country ordinal, its index in `prefix_lists` (u32). */
  by_country: number[];
  /** The anglo culture's prefixes (joined with the local ones 10% of the time). */
  anglo: string[];
  /** For each industry ordinal, its suffixes (industry-suffixes.csv, matched by name). */
  suffixes: string[][];
}

// ---------------------------------------------------------------- startup.rs

/** A year at the run rate (spec 5.19.3 "rating implied from the run rate"; 7.1; D271). USD. */
export interface RunRate {
  /** Whole number (u32). */
  pc_bonus: number;
  revenue: number;
  ebit: number;
  ebitda: number;
}

// ---------------------------------------------------------------- ipo.rs

/** Where a vote comes from (spec 5.20.1 steps 2 and 4). */
export type VoterRole =
  /** A labor seat holder. */
  | { kind: "Seat"; seat: Seat }
  /** A director (5.19.4 step 4), by position (u32). */
  | { kind: "Director"; position: number }
  /** A named or state controller who holds no seat: one extra vote. */
  | { kind: "Controller" };

/**
 * Who cast a ballot, as the board stood at the vote (spec 5.20.1 step 2; D542): a full character
 * by id, a partial (simple) character by its 3.7.1 id (u32) with its name (a partial character
 * can leave its seat and the views then no longer list it), or the state.
 */
export type BallotVoter =
  | { kind: "Full"; character: CharacterId }
  | { kind: "Partial"; id: number; name: string }
  /** A state controller holding no seat (5.20.1 step 4). */
  | { kind: "State" };

/** One cast vote. */
export interface Ballot {
  role: VoterRole;
  /** The yes chance rolled against (5.20.1 step 3). */
  chance: number;
  yes: boolean;
  /**
   * Who held the role at the vote (D542). `hold_vote` leaves it null (it sees traits, not
   * people); the vote job sets it.
   */
  voter: BallotVoter | null;
}

/** An IPO vote (spec 5.20.1; 3.5 `ipo_last_vote`). */
export interface VoteResult {
  ballots: Ballot[];
  /** Whole number (u32). */
  yes: number;
  /** Whole number (u32). */
  no: number;
  passed: boolean;
}
