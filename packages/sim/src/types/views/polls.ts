// v_polls (pivot 8.4): the polls app. The polling firms and every poll published so far. Type only:
// the builder arrives with the information layer (M4). The polls only grow, oldest first.

import type { SimDate } from "../calendar.ts";
import type { PersonId, PollsterId, RaceId } from "../ids.ts";
import type { Party } from "../state/politics.ts";

export interface PollsterRow {
  id: PollsterId;
  name: string;
  /** Its house effect, in points toward party A. Hidden (pivot 8.4): null unless Omniscient. */
  house_effect: number | null;
}

/** Which vote of a race a poll or a forecast is about (pivot 6.2). */
export type RaceStage = "Primary" | "General";

export interface Poll {
  /** Its place in publication order, from 0. */
  id: number;
  pollster: PollsterId;
  race: RaceId;
  stage: RaceStage;
  /** A primary poll's party. */
  party: Party | null;
  /** The days in the field. */
  from: SimDate;
  to: SimDate;
  published: SimDate;
  /** People asked. Whole number. */
  sample: number;
  /** Each candidate's share, 0 to 1, in the race's candidate order. */
  shares: { person: PersonId; share: number }[];
  undecided: number;
  /** The published margin of error, in points. */
  margin_of_error: number;
}

export interface PollsView {
  /** In pollster id order. */
  pollsters: PollsterRow[];
  /** Every poll, oldest first. */
  polls: Poll[];
}
