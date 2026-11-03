// The worker message protocol: the spec 9 sim to UI boundary over postMessage (D950; replaces
// crates/game/src/bridge.rs and its Bevy events and resources). The sim and its tick loop live in
// a Web Worker; the UI sends requests in and receives notices and views out. Every message is
// plain data (structured clone): no classes, functions or symbols.
//
// Pacing: the worker owns the clock. Below max speed it runs one game hour per D8's real-time
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
//
// The UI answers each Frame with `FrameDone` once it has read it, and a running worker holds the next
// frame until then, so frames cannot queue faster than the UI reads them (D1004). The sim keeps
// running meanwhile; the next frame carries everything since.
//
// What the UI reads (D1016): once the UI sends `Want`, the worker posts only the views it names,
// and three heavy views in a light form: v_statements with no companies, v_recap with each
// quarter's company pages left out, v_exchanges with empty index histories. The heavy parts go as
// slices, each only while wanted: one company's statements, one quarter's whole recap, one
// exchange's index history. A view or slice posted once is posted again when its version moves.
// Before any `Want` (tests, the mock) every view is posted whole, as before.

import type { Quarter } from "./calendar.ts";
import type { Control } from "./control.ts";
import type { CompanyId, ZoneId } from "./ids.ts";
import type { Notice } from "./notice.ts";
import type { SimError } from "./sim-api.ts";
import type { DailyBar, IndexHistory } from "./state/market.ts";
import type { Headline } from "./state/news.ts";
import type { ClockView, SimViews, ViewName } from "./views/index.ts";
import type { RecapQuarter } from "./views/recap.ts";
import type { CompanyStatements } from "./views/statements.ts";

/** The worker posts at most one frame this often while running (60 a second). */
export const FRAME_MS = 1000 / 60;

/** A request id the reply echoes, so the UI can await new-game, load, save and control results. */
export type RequestId = number;

/**
 * The controls the UI may send (spec 9.1). NewGame, Save and Load are requests of their own
 * (`ToSim`), since in the browser they carry bytes, not paths; the worker rejects them as controls.
 */
export type UiControl = Exclude<Control, { kind: "NewGame" | "Save" | "Load" }>;

/** What a historical world's new game can be (1995-rework 4.1). */
export interface NewGameChoices {
  world_id: string;
  scenarios: { id: string; label: string }[];
}

/** UI → worker. */
export type ToSim =
  /**
   * A new game from the starting data (spec 7), paused at 2020-01-01 00:00 (spec 7.3). The seed
   * is a safe integer (Rust takes any u64; seeds above 2^53 - 1 are out of scope, D952).
   */
  | {
      kind: "NewGame";
      id: RequestId;
      seed: number;
      /** A historical world's scenario, one of `Ready`'s choices (1995-rework 4.1). */
      scenario?: string;
    }
  /** Load a save (D13, D953): pauses and drops any skip. */
  | { kind: "Load"; id: RequestId; bytes: Uint8Array }
  /** Write a save; the reply carries its bytes. */
  | { kind: "Save"; id: RequestId }
  /** A spec 9.1 control (speed, pause, skip, alerts, watchlist), applied at once (D5). */
  | { kind: "Control"; id: RequestId; control: UiControl }
  /** The UI has read a Frame (D1004). It has no reply. */
  | { kind: "FrameDone" }
  /**
   * What the UI reads now (D1016): the views its mounted parts read, and the heavy views' slices
   * its pages read. It has no reply; a frame follows when something wanted is not posted yet.
   */
  | { kind: "Want"; views: ViewName[]; slices: SliceKey[] };

/** A slice of a heavy view (D1016). */
export type SliceKey =
  | { view: "statements"; company: CompanyId }
  | { view: "recap"; quarter: Quarter }
  | { view: "exchanges"; zone: ZoneId };

/** A slice's data: the company's statements, the quarter's recap, the exchange's index history; null when the view has none. */
export type SliceData<K extends SliceKey = SliceKey> = K extends { view: "statements" }
  ? CompanyStatements | null
  : K extends { view: "recap" }
    ? RecapQuarter | null
    : IndexHistory | null;

/** One slice in a frame, at its view's version. */
export interface SlicePatch {
  key: SliceKey;
  version: number;
  data: SliceData;
}

/** A slice's identity, for maps: "statements/12", "recap/1997-Q3", "exchanges/4". */
export function sliceId(k: SliceKey): string {
  switch (k.view) {
    case "statements":
      return `statements/${k.company}`;
    case "recap":
      return `recap/${k.quarter.year}-Q${k.quarter.q}`;
    case "exchanges":
      return `exchanges/${k.zone}`;
  }
}

/** Worker → UI. */
export type FromSim =
  /**
   * Sent once the worker has loaded the data and is ready for NewGame or Load. `choices` says this
   * world's new game needs picking (1995-rework 4.1); absent, the UI starts one at once.
   */
  | { kind: "Ready"; choices?: NewGameChoices }
  /** The answer to one request, posted after the Frame carrying the views it changed. */
  | { kind: "Reply"; id: RequestId; result: Reply }
  /** Notices in order since the last frame, the clock, and the views whose version moved. */
  | { kind: "Frame"; notices: Notice[]; clock: ClockView; views: ViewsPatch }
  /** The worker hit an error it cannot recover from (a sim panic in Rust terms). */
  | { kind: "Fatal"; message: string };

/** One company's new bars in a frame (D1004). */
export interface PriceBarsDeltaRow {
  id: CompanyId;
  /** Forget what was held for it: `closed` is its whole list of closed chunks. */
  reset: boolean;
  /** Closed chunks that fell off the front, at the 10-year limit. */
  drop: number;
  /** Chunks closed since the last frame. */
  closed: DailyBar[][];
  /** `open` is the whole open chunk, and not rows to add to it. */
  open_reset: boolean;
  open: DailyBar[];
}

/** v_price_bars as a frame carries it (D1004). */
export interface PriceBarsDelta {
  version: number;
  dirty: boolean;
  /** Only the companies with new bars. */
  rows: PriceBarsDeltaRow[];
  /** Companies the view no longer has. */
  removed: CompanyId[];
}

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
  /** v_price_bars' new bars since the last frame, in place of the whole view (D1004). */
  price_bars_delta?: PriceBarsDelta;
  news_appended?: Headline[];
  /**
   * The feed was replaced (a new game or a load): `news_appended` is the whole new feed, and the
   * UI replaces its `news.data.feed` with it instead of appending.
   */
  news_reset?: true;
  /** The news view's version after the append. */
  news_version?: number;
  /** The wanted slices whose view moved since they were last posted, or newly wanted (D1016). */
  slices?: SlicePatch[];
};
