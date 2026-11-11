// v_feed (pivot 8.2, 8.7, 8.8): the news app. Every outlet, every article published so far and each
// outlet's latest front page. Type only: the builder arrives with the information layer (M4).
//
// The articles only grow, oldest first, with ids in publication order, so a frame carries the
// rows appended since the last one (protocol.ts `ViewsPatch.appended`, `APPEND_LISTS`) and an
// article corrected since as a changed row (`ViewsPatch.changed`). Past front pages are the slice
// `{ view: "feed", slice: "front_pages", date }` (D1037). Text is already rendered: the sim stores
// a template id and arguments and the view builder runs the grammar (pivot 8.7).

import type { DateTime, SimDate } from "../calendar.ts";
import type { OutletId, UsStateId } from "../ids.ts";
import type { EntityRef } from "./entity.ts";

/** What an outlet is (pivot 8.2). */
export type OutletKind = "Wire" | "National" | "Regional";

export interface OutletRow {
  id: OutletId;
  name: string;
  kind: OutletKind;
  /** A regional paper's state. */
  state: UsStateId | null;
  /** Its slant, in points toward party A. Hidden (pivot 8.1): null unless Omniscient. */
  slant: number | null;
  /** 0 to 1. Hidden (pivot 8.1): null unless Omniscient. */
  reliability: number | null;
}

/** What an article is (pivot 8.2; D1037). */
export type ArticleKind =
  /** A news report of an event. */
  | "Report"
  /** Analysis or a poll story. */
  | "Analysis"
  | "Opinion"
  /** The outlet calls a race (pivot 9.3) or takes a call back. */
  | "Call"
  /** A correction or retraction of an earlier article (`source`). */
  | "Correction";

/** ArticleKind in declaration order. */
export const ARTICLE_KIND_VALUES = ["Report", "Analysis", "Opinion", "Call", "Correction"] as const;

/** What an article follows from: an earlier article it corrects or follows up, or the post it reports. */
export type ArticleSource = { kind: "Article"; id: number } | { kind: "Post"; id: number };

export interface Article {
  /** Its place in publication order, from 0. */
  id: number;
  time: DateTime;
  outlet: OutletId;
  kind: ArticleKind;
  /** The article it corrects or follows, or the social post it reports (pivot 8.3); null for none. */
  source: ArticleSource | null;
  headline: string;
  body: string;
  /** Who and what it names, in the order the text does. */
  refs: EntityRef[];
  /** The outlet ran it as an unconfirmed claim (pivot 8.2). */
  unconfirmed: boolean;
  /** The outlet has since corrected or retracted it. */
  corrected: boolean;
}

/** An outlet's ranking of the past day's stories (pivot 8.8). */
export interface FrontPage {
  outlet: OutletId;
  date: SimDate;
  /** Article ids, the lead first. */
  articles: number[];
}

export interface FeedView {
  /** In outlet id order. */
  outlets: OutletRow[];
  /** Every article, oldest first. An append list (protocol.ts `APPEND_LISTS`). */
  articles: Article[];
  /** Each outlet's latest, in outlet id order. Earlier days' are the `front_pages` slice. */
  front_pages: FrontPage[];
}
