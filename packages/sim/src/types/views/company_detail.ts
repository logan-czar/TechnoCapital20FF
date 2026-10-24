// v_company_detail (crates/sim/src/views/company_detail.rs): `get_company` and
// `get_company_board` (spec 9.2), the Company screen's header, its Overview tab (management
// score, confidence factor, cash, line, rating, status, archetype; M5 adds value and price, M6
// the next release's projection) and its Board tab (seat cards for labor units 1 to 5 with the
// skill used, spec 8). Rebuilt monthly and on load (spec 9.4), and when Omniscient is toggled
// (D423). Removed companies stay in the list (ids are row indices) with status Removed; screens
// drop them (spec 5.12 step 3). A private company's or new listing's cash, line and value are
// estimate bands (D420).
//
// Not ported: CompanyDetailView::get, simple_person, full_person, person, director and the
// `ViewData` build (logic).

import type { Quarter } from "../calendar.ts";
import type { CharacterId, CompanyId, CountryId, IndustryId, ProvinceId, ZoneId } from "../ids.ts";
import type { IpoVoteRecord, Origin } from "../world.ts";
import type { Figure } from "./estimate.ts";
import type { Archetype, CompanyStatus, Rating, Seat, Skills, Trait } from "./shared.ts";

/** Who sits in a seat (spec 3.7, 3.7.1, 3.7.2). */
export interface SeatPerson {
  name: string;
  /** u8. */
  age: number;
  skills: Skills;
  traits: Trait[];
  /** A simple (partial) character (spec 8 Board tab: "partial characters are marked"). */
  partial: boolean;
  /** The full character's id, for a full character. */
  character: CharacterId | null;
  /** The partial character's 3.7.1 id (u32), for a partial one (v_characters' `partial`). */
  partial_id: number | null;
}

/** One seat card (spec 8 Board tab). */
export interface SeatCard {
  seat: Seat;
  /**
   * The seat exists: the company has that many labor units (spec 3.7). The Chair is never
   * open in the MVP.
   */
  open: boolean;
  /**
   * The skill the management score reads for the seat (spec 5.7): the seat skill plus trait
   * shifts, or 3 when empty.
   */
  skill_used: number;
  holder: SeatPerson | null;
}

/** One company's header, Overview figures and board. */
export interface CompanyDetail {
  id: CompanyId;
  /** companies.csv id. */
  key: string;
  name: string;
  ticker: string;
  public: boolean;
  industry: IndustryId;
  hq_country: CountryId;
  hq_province: ProvinceId;
  /** The named controller when it is a full character. */
  controller: CharacterId | null;
  controller_name: string | null;
  /** 0 to 100 (spec 5.7) and the investor confidence factor `0.8 + score ÷ 250`. */
  management_score: number;
  confidence_factor: number;
  /** Bands for a private company or a new listing (D420). */
  cash_usd: Figure;
  line_drawn_usd: Figure;
  /** The credit line limit (spec 5.12). */
  line_limit_usd: Figure;
  /** The credit rating (spec 5.12). */
  rating: Rating;
  /** Active, Distressed, Bankrupt or Removed (spec 3.5, 5.12). */
  status: CompanyStatus;
  /** Spec 6.1. */
  archetype: Archetype;
  /**
   * Start or Born (spec 8 header "Founded [date] ([event])"), its founders and directors, and
   * the last IPO vote with the next vote's quarter (spec 8 Board tab, 5.20.1).
   */
  origin: Origin;
  founders: CharacterId[];
  /**
   * The directors (5.19.4 step 4: board seats with no labor unit) in seat position order,
   * Director 1 first, as the IPO ballots number them (`VoterRole::Director`, D541).
   */
  directors: SeatPerson[];
  ipo_last_vote: IpoVoteRecord | null;
  ipo_next_vote: Quarter | null;
  /** Shares outstanding (spec 3.10), whole number (u64). */
  shares_out: number;
  /** The listing exchange (spec 5.14), null while private; quoted unless delisted. */
  exchange: ZoneId | null;
  quoted: boolean;
  /** P at the rebuild, USD a share (5.14); 0 for a private or delisted company. */
  price: number;
  /**
   * The estimated fair value a share shown for a listed company (3.14.2), exact (it is
   * already an estimate, D140); a private company's 0.7 × V (spec 5.13 step 6) as a band
   * (D420).
   */
  shown_value_per_share: Figure;
  /** The figures are estimate bands (D420). */
  estimated: boolean;
  /** Buzz (3.10). */
  buzz: number;
  /** CEO, CFO, CIO, CMO, COO, then the Chair (spec 3.7). */
  board: SeatCard[];
}

export interface CompanyDetailView {
  /** Every company in company id order. */
  companies: CompanyDetail[];
}
