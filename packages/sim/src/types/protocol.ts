// The worker message protocol: the spec 9 sim to UI boundary over postMessage (D950; replaces
// crates/game/src/bridge.rs and its Bevy events and resources). The sim and its tick loop live in
// a Web Worker; the UI sends requests in and receives notices and views out. Every message is
// plain data (structured clone): no classes, functions or symbols.
//
// Pacing: the worker owns the clock. At speeds 1 to 4 it runs one game hour per D8's real-time
// step; at max it runs as many ticks as fit in a frame budget. It posts at most one `Frame` per
// FRAME_MS while running, carrying every notice since the last frame and every view whose
// `version` differs from the version it last posted (Rust `SimViews::copy_changed_from`,
// views/mod.rs). Never use a view's `dirty` flag across frames: it is true only for the latest
// refresh, so a view rebuilt at 00:00 is clean again at 01:00 and many ticks run per frame.
//
// Requests rebuild views too: NewGame and Load rebuild every view, and a control rebuilds the
// on_control views (and the on_omniscient ones when it toggles Omniscient; refresh_after_control,
// views/mod.rs). So after each request the worker posts a Frame with those changes FIRST, then
// the Reply: when the UI's awaited reply resolves, its views are already current. A paused game
// posts nothing else.

import type { Control } from "./control.ts";
import type { Notice } from "./notice.ts";
import type { SimError } from "./sim-api.ts";
import type { Headline } from "./state/news.ts";
import type { ClockView, SimViews } from "./views/index.ts";

/** The worker posts at most one frame this often while running (60 a second). */
export const FRAME_MS = 1000 / 60;

/** A request id the reply echoes, so the UI can await new-game, load, save and control results. */
export type RequestId = number;

/**
 * The controls the UI may send (spec 9.1). NewGame, Save and Load are requests of their own
 * (`ToSim`), since in the browser they carry bytes, not paths; the worker rejects them as controls.
 */
export type UiControl = Exclude<Control, { kind: "NewGame" | "Save" | "Load" }>;

/** UI → worker. */
export type ToSim =
  /**
   * A new game from the starting data (spec 7), paused at 2020-01-01 00:00 (spec 7.3). The seed
   * is a safe integer (Rust takes any u64; seeds above 2^53 - 1 are out of scope, D952).
   */
  | { kind: "NewGame"; id: RequestId; seed: number }
  /** Load a save (D13, D953): pauses and drops any skip. */
  | { kind: "Load"; id: RequestId; bytes: Uint8Array }
  /** Write a save; the reply carries its bytes. */
  | { kind: "Save"; id: RequestId }
  /** A spec 9.1 control (speed, pause, skip, alerts, watchlist), applied at once (D5). */
  | { kind: "Control"; id: RequestId; control: UiControl };

/** Worker → UI. */
export type FromSim =
  /** Sent once the worker has loaded the data and is ready for NewGame or Load. */
  | { kind: "Ready" }
  /** The answer to one request, posted after the Frame carrying the views it changed. */
  | { kind: "Reply"; id: RequestId; result: Reply }
  /** Notices in order since the last frame, the clock, and the views whose version moved. */
  | { kind: "Frame"; notices: Notice[]; clock: ClockView; views: ViewsPatch }
  /** The worker hit an error it cannot recover from (a sim panic in Rust terms). */
  | { kind: "Fatal"; message: string };

/** What a request produced. */
export type Reply =
  | { kind: "Ok"; notices: Notice[] }
  | { kind: "Saved"; bytes: Uint8Array }
  /** A sim error the UI can branch on (BadSpeed, DebugOnly, a bad save …). */
  | { kind: "SimError"; error: SimError }
  /** A request the worker refused before reaching the sim (e.g. a Control of kind NewGame). */
  | { kind: "Refused"; message: string };

/**
 * The views whose version moved since the last frame; the UI replaces those it holds. The news
 * view is the exception: it only grows, so a frame carries the headlines appended since the last
 * one (`news_appended`, in post order) and the UI appends them to its `news.data.feed`.
 *
 * A view whose builder is not ported yet (Step 3) is never in a patch, news included: the sim
 * holds only a placeholder empty value for it, which the UI must not show as real data. Until its
 * builder lands, the UI keeps its own (mock) data for that view.
 */
export type ViewsPatch = Partial<Omit<SimViews, "news">> & {
  news_appended?: Headline[];
  /**
   * The feed was replaced (a new game or a load): `news_appended` is the whole new feed, and the
   * UI replaces its `news.data.feed` with it instead of appending.
   */
  news_reset?: true;
  /** The news view's version after the append. */
  news_version?: number;
};
