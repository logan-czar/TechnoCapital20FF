// The Pdoomberg Wire on the World (spec 5.18, 8 News feed; build-plan M6.5). Ported from
// crates/sim/src/news.rs (HeadlineKind, Headline, NewsWire, BYLINE); news/jobs.rs holds jobs only.
// Types only.
//
// Not ported (logic): Headline::{of_event, byline, confidence} and the constructors (one per
// 5.18 headline type), the release-day picks (`Picks`, TOP_RESULTS), the tipped lab draw
// (TIPPED_LAB_CANDIDATES), the figure constants (PERCENT, USD_PER_MILLION),
// RATING_HEADLINE_MIN_NOTCHES, NewsWire::{queue, post_day, since} and the jobs in news/jobs.rs.

import type { SimDate } from "../calendar.ts";
import type { CompanyId, HeadlineId, IndustryId, StartupEventId } from "../ids.ts";
import type { ChunkLog } from "../log.ts";
import type { PhaseLabel } from "../world.ts";
import type { RaiseMethod } from "./ai.ts";
import type { Rating } from "./finance.ts";
import type { SurpriseTag } from "./market.ts";

/** Spec 5.18 (A): MVP headlines come from a neutral Pdoomberg Wire byline. */
export const BYLINE = "Pdoomberg Wire";

/** What a headline reports (spec 5.18): one variant per type. */
export type HeadlineKind =
  /** An industry's phase label changed (5.1). */
  | { kind: "PhaseChange"; from: PhaseLabel; to: PhaseLabel }
  /** A release-day beat or miss (5.15 tags), with the surprise s. */
  | { kind: "Result"; tag: SurpriseTag; surprise: number }
  /** Made Bankrupt (5.12 step 2). */
  | { kind: "Bankruptcy" }
  /** Removed after its frozen quarters (5.12 step 3). */
  | { kind: "Removal" }
  /** A rating change of 2+ notches at the review (5.12). */
  | { kind: "RatingChange"; from: Rating; to: Rating }
  /**
   * A 6.6 raise that succeeded. The net raised; null for a company that does not publish
   * (D420: its books are bands, so the wire does not print the amount).
   */
  | { kind: "Raise"; method: RaiseMethod; net_usd: number | null }
  /** A 6.6 raise that failed. */
  | { kind: "FailedRaise"; method: RaiseMethod }
  /** A fixed startup event (5.19.2), with the startups it made (u32). */
  | { kind: "FixedStartupEvent"; event: string; startups: number }
  /** A random event's one startup (5.19.1). */
  | { kind: "StartupLaunch" }
  /** A random hot cluster (5.19.1): several startups (u32) in one industry and place. */
  | { kind: "HotCluster"; startups: number }
  /** An IPO board vote (5.20.1); `yes` and `no` are u32. */
  | { kind: "IpoVote"; passed: boolean; yes: number; no: number; exchange: string }
  /** A listing (5.20.1). */
  | { kind: "Listing"; exchange: string; price: number; net_usd: number }
  /** The boom event: the tipped lab launches its chatbot (5.1.1). */
  | { kind: "Chatbot" };

/**
 * One Pdoomberg Wire headline (spec 5.18; 8 News feed: date and industry tag). The byline is
 * always BYLINE (spec 5.18 A).
 */
export interface Headline {
  /** Its place in the feed's post order (D544), set when it posts; 0 while queued. */
  id: HeadlineId;
  date: SimDate;
  /** The industry tag (8 News feed), when the story has one. */
  industry: IndustryId | null;
  /** The company the story is about, when there is one (5.1.2 news on listed companies). */
  company: CompanyId | null;
  /**
   * The startup event the story reports (5.19; a fixed event, a random event's startup or a hot
   * cluster), set by the plan lock that fired it (D543).
   */
  event: StartupEventId | null;
  kind: HeadlineKind;
  text: string;
}

/**
 * The wire (spec 4.2 step 5, 8 News feed): headlines queue as their jobs make them and post with
 * the next daily job; the feed keeps them in post order, in month chunks so the daily news view
 * and the plan lock's projection clone share it (D148).
 */
export interface NewsWire {
  queued: Headline[];
  feed: ChunkLog<Headline>;
  /** The headlines the last daily job posted: 4.2 step 6 reads their 5.1.2 points (D137). */
  today: Headline[];
  /** Each industry's phase label at the last monthly close, for the phase change headlines. */
  labels: PhaseLabel[];
}
