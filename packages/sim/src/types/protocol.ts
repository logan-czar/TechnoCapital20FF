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
//
// The pivot's messages (pivot 3.5, 15; D1029): a new game may start from a baked save or a
// generated history (`NewGame.start`), a long request reports `Progress` and can be cancelled
// (`Cancel`), saves live in named slots the sim's process writes (`SaveSlot`, `LoadSlot`,
// `ListSaves`, `DeleteSave`), and the player acts through `Act`. A host that cannot serve one of
// these answers it `Refused` with `unsupportedMessage`'s text: the browser's worker has no slots
// and no starts; the Electron sim process serves them all, a generated history included (D1037).
//
// The pivot's views (D1037): their heavy parts are slices built from the state (`SliceKey`), and
// their growing lists travel as appended and changed rows (`APPEND_LISTS`, `ViewsPatch.appended`).

import type { ActError, PlayerAction } from "./action.ts";
import type { DateTime, Quarter, SimDate } from "./calendar.ts";
import type { Control } from "./control.ts";
import type { CompanyId, ContractId, RaceId, ZoneId } from "./ids.ts";
import type { Notice } from "./notice.ts";
import type { SimError, StateHash } from "./sim-api.ts";
import type { DailyBar, IndexHistory } from "./state/market.ts";
import type { Headline } from "./state/news.ts";
import type { Difficulty } from "./state/player.ts";
import type { FrontPage } from "./views/feed.ts";
import type { ClockView, SimViews, ViewName } from "./views/index.ts";
import type { ContractBook, ContractHistory } from "./views/markets.ts";
import type { RecapQuarter } from "./views/recap.ts";
import type { RollCallVotes } from "./views/records.ts";
import type { RaceCountyReturns } from "./views/returns.ts";
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

/** Where a new game's first day comes from (pivot 3.1 to 3.5). */
export type GameStart =
  /** A pre-simulated 2020 that ships with the game (pivot 3.5): one of `Ready`'s `starts`. */
  | { kind: "baked"; id: string }
  /**
   * A new history: the 1995 world run forward to 2020 at Coarse fidelity under a hidden scenario,
   * then hydrated (pivot 3.2 to 3.4). Reports `Progress` and can be cancelled.
   */
  | { kind: "generate" };

/** A pre-baked start as `Ready` lists it (pivot 3.5; `assets/starts/`, written by headless `--bake`). */
export interface BakedStart {
  /** Its name in a `NewGame.start`. */
  id: string;
  label: string;
  /** The seed its history was generated from. */
  seed: number;
  /** The `SAVE_VERSION` it was written with: a start from another version is not listed. */
  save_version: number;
  /** Its state hash on its first day, for the checks. */
  hash: StateHash;
  /** Its scenario as the baker named it, or "hidden" (D1037): opaque to the game, never shown in play. */
  scenario: string;
  /** Its first day of play, "YYYY-MM-DD". */
  date: string;
  /** Its save's file name in the starts folder, and the file's size in bytes. */
  file: string;
  bytes: number;
}

/** What a long request is doing (pivot 3.5). */
export type ProgressPhase =
  /** Reading a save or a baked start. */
  | "Load"
  /** The Coarse pre-simulation (pivot 3.2). */
  | "Presim"
  /** The switch to Full at 2020-01-01 (pivot 3.4). */
  | "Hydrate"
  /** Writing a save. */
  | "Save";

/** A save in a slot, as `ListSaves` reports it (pivot 15.4). */
export interface SaveInfo {
  /** The slot's name: a file name without its folder or extension. */
  slot: string;
  /** A rotating autosave, not one the player named. */
  autosave: boolean;
  /** The game's clock and seed in it. */
  time: DateTime;
  seed: number;
  /** The `SAVE_VERSION` it was written with; this build loads only its own. */
  save_version: number;
  /** Its size on disk. */
  bytes: number;
}

/** The text of a `Refused` reply to a request this host does not serve yet. */
export function unsupportedMessage(kind: ToSim["kind"]): string {
  return `unsupported: this build's sim does not handle ${kind} yet`;
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
      /**
       * Where the game starts (pivot 3.5). Absent: the loaded world's own first day, as before the
       * pivot (the 1995 world in 1995, the 2020 world in 2020).
       */
      start?: GameStart;
      /**
       * The player's difficulty preset (pivot 3.6; D1052) for a start that opens an account (a
       * generated or baked 2020 start). Absent: Normal. A world's own first day has no account.
       */
      difficulty?: Difficulty;
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
  | { kind: "Want"; views: ViewName[]; slices: SliceKey[] }
  /**
   * Stop request `id` (a generating NewGame, pivot 3.5). It has no reply of its own: the request
   * it names replies `Cancelled`, or as usual if it had already finished.
   */
  | { kind: "Cancel"; id: RequestId }
  /** Write the game to a named slot on disk (pivot 15.4). Replies Ok. */
  | { kind: "SaveSlot"; id: RequestId; slot: string }
  /** Load the save in a slot: pauses and drops any skip, as `Load`. */
  | { kind: "LoadSlot"; id: RequestId; slot: string }
  /** The saves on disk. Replies `Saves`. */
  | { kind: "ListSaves"; id: RequestId }
  | { kind: "DeleteSave"; id: RequestId; slot: string }
  /** A player action (types/action.ts; D1027), applied at once, between ticks. */
  | { kind: "Act"; id: RequestId; action: PlayerAction };

/** The requests a reply answers: every `ToSim` with an id of its own. */
export type SimRequest = Exclude<ToSim, { kind: "FrameDone" | "Want" | "Cancel" }>;

/**
 * A slice of a heavy view (D1016). The three pre-pivot ones come from their view's data; the
 * pivot's (D1037, with a `slice` naming which part) are built from the state by the view's builder
 * (views/index.ts `ViewBuilder.slice`) when a frame carries them:
 * - `markets` `book`: a contract's depth (`ContractBook`);
 * - `markets` `history`: a contract's hourly prices (`ContractHistory`);
 * - `returns` `counties`: a race's count by county (`RaceCountyReturns`);
 * - `records` `votes`: how each member voted in a roll call (`RollCallVotes`);
 * - `feed` `front_pages`: every outlet's front page of one day (`FrontPage[]`).
 */
export type SliceKey =
  | { view: "statements"; company: CompanyId }
  | { view: "recap"; quarter: Quarter }
  | { view: "exchanges"; zone: ZoneId }
  | { view: "markets"; slice: "book"; contract: ContractId }
  | { view: "markets"; slice: "history"; contract: ContractId }
  | { view: "returns"; slice: "counties"; race: RaceId }
  | { view: "records"; slice: "votes"; roll_call: number }
  | { view: "feed"; slice: "front_pages"; date: SimDate };

/** A slice's data (see `SliceKey`); null when the view has none by that key. */
export type SliceData<K extends SliceKey = SliceKey> = K extends { view: "statements" }
  ? CompanyStatements | null
  : K extends { view: "recap" }
    ? RecapQuarter | null
    : K extends { view: "exchanges" }
      ? IndexHistory | null
      : K extends { slice: "book" }
        ? ContractBook | null
        : K extends { slice: "history" }
          ? ContractHistory | null
          : K extends { slice: "counties" }
            ? RaceCountyReturns | null
            : K extends { slice: "votes" }
              ? RollCallVotes | null
              : FrontPage[] | null;

/** One slice in a frame, at its view's version. */
export interface SlicePatch {
  key: SliceKey;
  version: number;
  data: SliceData;
}

/**
 * A slice's identity, for maps: "statements/12", "recap/1997-Q3", "exchanges/4", "markets/book/7",
 * "markets/history/7", "returns/counties/3", "records/votes/12", "feed/front_pages/2020-11-04".
 */
export function sliceId(k: SliceKey): string {
  switch (k.view) {
    case "statements":
      return `statements/${k.company}`;
    case "recap":
      return `recap/${k.quarter.year}-Q${k.quarter.q}`;
    case "exchanges":
      return `exchanges/${k.zone}`;
    case "markets":
      return `markets/${k.slice}/${k.contract}`;
    case "returns":
      return `returns/counties/${k.race}`;
    case "records":
      return `records/votes/${k.roll_call}`;
    case "feed": {
      const d = k.date;
      return `feed/front_pages/${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
    }
  }
}

// ---------------------------------------------------------------- append and changed rows (D1037)

/**
 * The lists in the pivot's views that only grow, oldest first (D1037). A frame never carries them
 * inside their view: a posted view holds each of these as `[]`, and `ViewsPatch.appended` carries
 * the rows added since the last frame (or the whole list, with `reset`). The UI keeps its own copy
 * and appends, as it does v_news's feed (`news_appended`). A row already sent that changed since
 * (an article corrected, a rumour confirmed) comes in `ViewsPatch.changed`. The sim must keep a row
 * object it did not change from one build to the next (views/patch.ts compares rows by identity).
 */
export const APPEND_LISTS = {
  feed: ["articles"],
  social: ["posts"],
  polls: ["polls"],
  notifications: ["items"],
  account: ["fills"],
  records: ["roll_calls", "actions", "filings"],
} as const satisfies { readonly [V in ViewName]?: readonly (keyof SimViews[V]["data"])[] };

/** A view with append lists. */
export type AppendView = keyof typeof APPEND_LISTS;

/** An append list's field name in view `V`. */
export type AppendField<V extends AppendView> = (typeof APPEND_LISTS)[V][number];

/** The row type of list `F` of view `V`. */
export type AppendRow<V extends AppendView, F extends AppendField<V>> = SimViews[V]["data"][F &
  keyof SimViews[V]["data"]] extends readonly (infer R)[]
  ? R
  : never;

/** The rows appended to one list since the last frame (D1037). */
export type AppendPatch = {
  [V in AppendView]: {
    [F in AppendField<V>]: {
      view: V;
      field: F;
      /** Replace the list held with `rows` (a new game, a load, a first post), not append to it. */
      reset: boolean;
      rows: AppendRow<V, F>[];
    };
  }[AppendField<V>];
}[AppendView];

/** Rows of one list, already sent, that changed since (D1037): `index` is the row's place in the list. */
export type ChangedPatch = {
  [V in AppendView]: {
    [F in AppendField<V>]: {
      view: V;
      field: F;
      rows: { index: number; row: AppendRow<V, F> }[];
    };
  }[AppendField<V>];
}[AppendView];

/** Worker → UI. */
export type FromSim =
  /**
   * Sent once the worker has loaded the data and is ready for NewGame or Load. `choices` says this
   * world's new game needs picking (1995-rework 4.1); absent, the UI starts one at once.
   */
  | {
      kind: "Ready";
      choices?: NewGameChoices;
      /** The pre-baked starts this build ships (pivot 3.5); absent or empty when it has none. */
      starts?: BakedStart[];
    }
  /**
   * How far request `id` has got (pivot 3.5), posted now and then while it runs: `done` of `total`
   * in the phase's own units (ticks for Presim), and the game day reached, when the phase has one.
   */
  | {
      kind: "Progress";
      id: RequestId;
      phase: ProgressPhase;
      done: number;
      total: number;
      date: SimDate | null;
    }
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
  /** The answer to `ListSaves`, newest first. */
  | { kind: "Saves"; saves: SaveInfo[] }
  /** The request was stopped by a `Cancel`; nothing changed. */
  | { kind: "Cancelled" }
  /** The sim refused a player action (types/action.ts). */
  | { kind: "ActError"; error: ActError }
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
  /**
   * Rows added to the pivot views' append lists since the last frame (`APPEND_LISTS`; D1037), for
   * the views in this patch. A view in the patch holds those lists empty: keep the old rows and
   * append these (or replace them, on `reset`).
   */
  appended?: AppendPatch[];
  /** Rows already sent that changed since (D1037): replace the row at each `index`. */
  changed?: ChangedPatch[];
};
