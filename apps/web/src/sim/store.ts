// The UI's copy of the sim's views: a small hand-rolled store (no library needed), merged from
// Frames as protocol.ts describes. Subscribers register per key (a view name, the notice log, the
// messages or the status), so a frame that moves only the quotes wakes only the components that
// read quotes. A view the sim has not ported yet never arrives (views/patch.ts): readers see
// `undefined` for it and must cope.
//
// What is read is what is wanted (D1016): the views with a subscriber, and the slices of the heavy
// views with one (`subscribeSlice`). When that set changes the store calls `onWant` once, after the
// current task, and the client tells the worker, which then posts only those. A view nobody reads
// keeps its last copy here until someone does.

import {
  APPEND_LISTS,
  type ClockView,
  type FromSim,
  type NewGameChoices,
  type Notice,
  priceBarsApply,
  type SimViews,
  type SliceData,
  type SliceKey,
  sliceId,
  VIEW_NAMES,
  type ViewName,
  type ViewsPatch,
} from "@tc20ff/sim";

export type StoreKey = ViewName | "notices" | "messages" | "status";

/** A long request's progress (protocol.ts `Progress`; pivot 3.5): a generated history's ticks. */
export type ProgressInfo = Omit<Extract<FromSim, { kind: "Progress" }>, "kind">;
export type Frame = Extract<FromSim, { kind: "Frame" }>;

/** A notice worth showing the player: tick, day and month markers are bookkeeping only. */
export function isNotable(n: Notice): boolean {
  return n.kind !== "TickDone" && n.kind !== "DayDone" && n.kind !== "MonthDone";
}

export interface NoticeEntry {
  /** A count of notable notices received, for list keys. */
  seq: number;
  /** The clock when the frame carrying it arrived. */
  time: number;
  notice: Notice;
}

/** Something the player should read: a refused request, a failed save. */
export interface Message {
  id: number;
  level: "error" | "info";
  text: string;
}

export interface Status {
  /** The worker said Ready. */
  ready: boolean;
  /** A game exists (NewGame or Load succeeded). */
  started: boolean;
  /** This world's new game needs picking (1995-rework 4.1). */
  choices: NewGameChoices | null;
  /** The worker's Fatal message, or a worker error. */
  fatal: string | null;
  /** The running request's progress (a generated history); null when nothing long is running. */
  progress: ProgressInfo | null;
}

/** Notices kept in the log; older ones drop off. */
export const NOTICE_LOG_CAP = 300;
/** Messages kept on screen. */
export const MESSAGE_CAP = 5;

type Listener = () => void;

const VIEW_NAME_SET: ReadonlySet<string> = new Set(VIEW_NAMES);

/** A slice the store holds: its key, its view's version when posted, and its data. */
export interface SliceEntry {
  key: SliceKey;
  version: number;
  data: SliceData;
}

export class SimStore {
  private views: { [K in ViewName]?: SimViews[K] } = {};
  private listeners = new Map<StoreKey, Set<Listener>>();
  private slices = new Map<string, SliceEntry>();
  private sliceListeners = new Map<string, { key: SliceKey; set: Set<Listener> }>();
  /** Called after the set of wanted views or slices changed (D1016); the client sends `Want`. */
  onWant: ((views: ViewName[], slices: SliceKey[]) => void) | null = null;
  private wantQueued = false;
  private lastWant = "";
  private seq = 0;
  private messageId = 0;
  notices: readonly NoticeEntry[] = [];
  messages: readonly Message[] = [];
  status: Status = { ready: false, started: false, choices: null, fatal: null, progress: null };

  getView<K extends ViewName>(name: K): SimViews[K] | undefined {
    return this.views[name];
  }

  subscribe(key: StoreKey, cb: Listener): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(cb);
    if (VIEW_NAME_SET.has(key)) this.wantChanged();
    return () => {
      set.delete(cb);
      if (VIEW_NAME_SET.has(key)) this.wantChanged();
    };
  }

  /** A heavy view's slice as last posted, or undefined before it arrives (D1016). */
  getSlice(key: SliceKey): SliceEntry | undefined {
    return this.slices.get(sliceId(key));
  }

  /** Reads a slice: it is wanted while subscribed, and `cb` runs when a new copy arrives. */
  subscribeSlice(key: SliceKey, cb: Listener): () => void {
    const id = sliceId(key);
    let entry = this.sliceListeners.get(id);
    if (!entry) {
      entry = { key, set: new Set() };
      this.sliceListeners.set(id, entry);
    }
    const set = entry.set;
    set.add(cb);
    this.wantChanged();
    return () => {
      set.delete(cb);
      if (set.size === 0) this.sliceListeners.delete(id);
      this.wantChanged();
    };
  }

  /** The views and slices read now. */
  wanted(): { views: ViewName[]; slices: SliceKey[] } {
    const views = VIEW_NAMES.filter((n) => (this.listeners.get(n)?.size ?? 0) > 0);
    const slices = [...this.sliceListeners.values()].map((e) => e.key);
    return { views, slices };
  }

  /** Tells `onWant` once, after the current task, if the wanted set really changed. */
  private wantChanged(): void {
    if (this.wantQueued || this.onWant === null) return;
    this.wantQueued = true;
    queueMicrotask(() => {
      this.wantQueued = false;
      const w = this.wanted();
      const key = `${w.views.join(",")}|${w.slices.map(sliceId).join(",")}`;
      if (key === this.lastWant) return;
      this.lastWant = key;
      // A slice let go is forgotten, so a page reopened later waits for a fresh copy.
      const keep = new Set(w.slices.map(sliceId));
      for (const id of this.slices.keys()) if (!keep.has(id)) this.slices.delete(id);
      this.onWant?.(w.views, w.slices);
    });
  }

  /** Sends the wanted set now (after the client attaches, or a new game), whatever was sent before. */
  resendWant(): void {
    this.lastWant = "";
    this.wantChanged();
  }

  setStatus(patch: Partial<Status>): void {
    this.status = { ...this.status, ...patch };
    this.emit(["status"]);
  }

  /** The seq of the newest logged notice: a mark to tell later notices from earlier ones. */
  noticeMark(): number {
    return this.seq;
  }

  /** Shows `text` to the player until they dismiss it. */
  pushMessage(level: Message["level"], text: string): void {
    const m: Message = { id: ++this.messageId, level, text };
    this.messages = [...this.messages, m].slice(-MESSAGE_CAP);
    this.emit(["messages"]);
  }

  dismissMessage(id: number): void {
    this.messages = this.messages.filter((m) => m.id !== id);
    this.emit(["messages"]);
  }

  private take<K extends Exclude<ViewName, "news">>(patch: ViewsPatch, name: K, moved: StoreKey[]): void {
    const next = patch[name];
    if (next === undefined) return;
    // A view with append lists comes with them empty (protocol.ts `APPEND_LISTS`; D1037): it keeps
    // the rows held, which `appended` and `changed` then bring up to date.
    const fields = (APPEND_LISTS as Partial<Record<ViewName, readonly string[]>>)[name];
    if (fields !== undefined) {
      const old = this.views[name]?.data as unknown as Record<string, unknown> | undefined;
      const data = { ...(next.data as unknown as Record<string, unknown>) };
      for (const f of fields) data[f] = old?.[f] ?? [];
      this.views[name] = { ...next, data } as unknown as SimViews[K];
    } else {
      this.views[name] = next;
    }
    moved.push(name);
  }

  /** Applies a frame's changed rows, then its appended ones, to the append lists held (D1037). */
  private applyLists(patch: ViewsPatch, moved: StoreKey[]): void {
    const edit = (view: ViewName, field: string, fn: (rows: readonly unknown[]) => unknown[]): void => {
      const v = this.views[view];
      if (v === undefined) return;
      const data = v.data as unknown as Record<string, unknown>;
      const rows = fn((data[field] ?? []) as readonly unknown[]);
      (this.views as Record<string, unknown>)[view] = { ...v, data: { ...data, [field]: rows } };
      if (!moved.includes(view)) moved.push(view);
    };
    for (const c of patch.changed ?? []) {
      edit(c.view, c.field, (rows) => {
        const out = rows.slice();
        for (const r of c.rows as { index: number; row: unknown }[]) out[r.index] = r.row;
        return out;
      });
    }
    for (const a of patch.appended ?? []) {
      edit(a.view, a.field, (rows) => (a.reset ? (a.rows as unknown[]).slice() : [...rows, ...a.rows]));
    }
  }

  /**
   * Merges a frame: replaces each view in the patch, appends `news_appended` to the news feed
   * (or replaces it on `news_reset`), and logs the notable notices. Only the keys that moved are
   * notified.
   */
  applyFrame(frame: Frame): void {
    const patch = frame.views;
    const moved: StoreKey[] = [];
    for (const name of VIEW_NAMES) if (name !== "news") this.take(patch, name, moved);
    this.applyLists(patch, moved);
    if (patch.price_bars_delta !== undefined) {
      this.views.price_bars = priceBarsApply(this.views.price_bars, patch.price_bars_delta);
      moved.push("price_bars");
    }
    if (patch.news_appended !== undefined) {
      const old = this.views.news;
      const feed =
        patch.news_reset || !old ? patch.news_appended : [...old.data.feed, ...patch.news_appended];
      const version = patch.news_version ?? old?.version ?? 0;
      this.views.news = { data: { feed }, version, dirty: false };
      moved.push("news");
    }
    for (const s of patch.slices ?? []) {
      const id = sliceId(s.key);
      this.slices.set(id, s);
      for (const cb of this.sliceListeners.get(id)?.set ?? []) cb();
    }
    // The frame's clock is the freshest; it also covers a frame whose patch left the clock view out.
    this.setClock(frame.clock, moved);
    this.logNotices(frame.notices, frame.clock.now, moved);
    this.emit(moved);
  }

  /**
   * Logs the notices a request's reply carried that no frame since `mark` already logged (the
   * worker may repeat them in the Reply, protocol.ts).
   */
  mergeReplyNotices(notices: readonly Notice[], mark: number): void {
    const seen = new Set(this.notices.filter((e) => e.seq > mark).map((e) => JSON.stringify(e.notice)));
    const fresh = notices.filter((n) => !seen.has(JSON.stringify(n)));
    const moved: StoreKey[] = [];
    this.logNotices(fresh, this.views.clock?.data.now ?? 0, moved);
    this.emit(moved);
  }

  private logNotices(all: readonly Notice[], time: number, moved: StoreKey[]): void {
    const fresh = all.filter(isNotable);
    if (fresh.length === 0) return;
    const entries = fresh.map((notice): NoticeEntry => ({ seq: ++this.seq, time, notice }));
    this.notices = [...this.notices, ...entries].slice(-NOTICE_LOG_CAP);
    moved.push("notices");
  }

  private setClock(clock: ClockView, moved: StoreKey[]): void {
    const held = this.views.clock;
    if (held && sameClock(held.data, clock)) return;
    this.views.clock = { data: clock, version: held?.version ?? 0, dirty: false };
    if (!moved.includes("clock")) moved.push("clock");
  }

  private emit(keys: StoreKey[]): void {
    for (const k of keys) for (const cb of this.listeners.get(k) ?? []) cb();
  }
}

function sameClock(a: ClockView, b: ClockView): boolean {
  return (
    a.now === b.now &&
    a.speed === b.speed &&
    a.selected_speed === b.selected_speed &&
    a.paused === b.paused &&
    a.skipping === b.skipping
  );
}
