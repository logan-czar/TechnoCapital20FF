// v_social (pivot 8.3): the social feed app. Its accounts and every post so far. Type only: the
// builder arrives with the information layer (M4). The posts only grow, oldest first: a frame
// carries the new ones (protocol.ts `APPEND_LISTS`) and a post whose rumour was confirmed or
// debunked since as a changed row (`ViewsPatch.changed`; D1037).

import type { DateTime } from "../calendar.ts";
import type { HandleId } from "../ids.ts";
import type { EntityRef } from "./entity.ts";

/** Whose account it is (pivot 8.3). */
export type HandleKind = "Politician" | "Campaign" | "Pundit" | "Pollster" | "Outlet" | "Anonymous";

export interface HandleRow {
  id: HandleId;
  /** The handle as shown. */
  name: string;
  kind: HandleKind;
  /** The person, race, pollster or outlet behind it; null for a pundit or an anonymous account. */
  owner: EntityRef | null;
  /** The player follows it (pivot 8.3; `PlayerAction` Follow). */
  followed: boolean;
}

/**
 * What is publicly known of a rumour (pivot 8.3). Whether it is true is sim state the view never
 * carries: `Open` says only that nobody has confirmed or debunked it yet.
 */
export type RumourStatus = "Open" | "Confirmed" | "Debunked";

export interface Post {
  /** Its place in post order, from 0. */
  id: number;
  time: DateTime;
  handle: HandleId;
  text: string;
  refs: EntityRef[];
  /** Set when the post carries a rumour. */
  rumour: RumourStatus | null;
}

export interface SocialView {
  /** In handle id order. */
  handles: HandleRow[];
  /** Every post, oldest first. */
  posts: Post[];
}
