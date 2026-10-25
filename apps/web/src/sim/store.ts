// The UI's copy of the sim's views: a small hand-rolled store (no library needed), merged from
// Frames as protocol.ts describes. Subscribers register per key (a view name, the notice log, the
// messages or the status), so a frame that moves only the quotes wakes only the components that
// read quotes. A view the sim has not ported yet never arrives (views/patch.ts): readers see
// `undefined` for it and must cope.

import type { ClockView, FromSim, Notice, SimViews, ViewName, ViewsPatch } from "@tc20ff/sim";

export type StoreKey = ViewName | "notices" | "messages" | "status";
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
  /** The worker's Fatal message, or a worker error. */
  fatal: string | null;
}

/** Notices kept in the log; older ones drop off. */
export const NOTICE_LOG_CAP = 300;
/** Messages kept on screen. */
export const MESSAGE_CAP = 5;

type Listener = () => void;

export class SimStore {
  private views: { [K in ViewName]?: SimViews[K] } = {};
  private listeners = new Map<StoreKey, Set<Listener>>();
  private seq = 0;
  private messageId = 0;
  notices: readonly NoticeEntry[] = [];
  messages: readonly Message[] = [];
  status: Status = { ready: false, started: false, fatal: null };

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
    return () => set.delete(cb);
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
    this.views[name] = next;
    moved.push(name);
  }

  /**
   * Merges a frame: replaces each view in the patch, appends `news_appended` to the news feed
   * (or replaces it on `news_reset`), and logs the notable notices. Only the keys that moved are
   * notified.
   */
  applyFrame(frame: Frame): void {
    const patch = frame.views;
    const moved: StoreKey[] = [];
    this.take(patch, "places", moved);
    this.take(patch, "countries", moved);
    this.take(patch, "zones", moved);
    this.take(patch, "rates", moved);
    this.take(patch, "characters", moved);
    this.take(patch, "cap_table", moved);
    this.take(patch, "quotes", moved);
    this.take(patch, "price_bars", moved);
    this.take(patch, "exchanges", moved);
    this.take(patch, "market_stats", moved);
    this.take(patch, "births", moved);
    this.take(patch, "projection", moved);
    this.take(patch, "company_rows", moved);
    this.take(patch, "company_detail", moved);
    this.take(patch, "units", moved);
    this.take(patch, "tech", moved);
    this.take(patch, "industry_rows", moved);
    this.take(patch, "industry_detail", moved);
    this.take(patch, "cycle", moved);
    this.take(patch, "map_layers", moved);
    this.take(patch, "province_cards", moved);
    this.take(patch, "statements", moved);
    this.take(patch, "filings", moved);
    this.take(patch, "ratings", moved);
    this.take(patch, "recap", moved);
    this.take(patch, "map_static", moved);
    this.take(patch, "clock", moved);
    if (patch.news_appended !== undefined) {
      const old = this.views.news;
      const feed =
        patch.news_reset || !old ? patch.news_appended : [...old.data.feed, ...patch.news_appended];
      const version = patch.news_version ?? old?.version ?? 0;
      this.views.news = { data: { feed }, version, dirty: false };
      moved.push("news");
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
