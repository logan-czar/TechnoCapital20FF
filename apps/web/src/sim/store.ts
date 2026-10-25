// The UI's copy of the sim's views: a small hand-rolled store (no library needed), merged from
// Frames as protocol.ts describes. Subscribers register per key (a view name, the notice log or the
// status), so a frame that moves only the quotes wakes only the components that read quotes.

import type { ClockView, FromSim, Notice, SimViews, ViewName } from "@tc20ff/sim";
import { VIEW_NAMES } from "@tc20ff/sim";
import type { UiViewsPatch } from "./patch.ts";

export type StoreKey = ViewName | "notices" | "status";
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

export interface Status {
  /** The worker said Ready. */
  ready: boolean;
  /** A game exists (NewGame or Load succeeded). */
  started: boolean;
  /** The worker's Fatal message. */
  fatal: string | null;
}

/** Notices kept in the log; older ones drop off. */
export const NOTICE_LOG_CAP = 300;

type Listener = () => void;

export class SimStore {
  private views: { [K in ViewName]?: SimViews[K] } = {};
  private listeners = new Map<StoreKey, Set<Listener>>();
  private seq = 0;
  notices: readonly NoticeEntry[] = [];
  status: Status = { ready: false, started: false, fatal: null };

  getView<K extends ViewName>(name: K): SimViews[K] | undefined {
    return this.views[name] as SimViews[K] | undefined;
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

  /**
   * Merges a frame: replaces each view in the patch, appends `news_appended` to the news feed
   * (or replaces it on `news_reset`), and logs the notable notices. Only the keys that moved are
   * notified.
   */
  applyFrame(frame: Frame): void {
    const patch = frame.views as UiViewsPatch;
    const moved: StoreKey[] = [];
    const v = this.views as Record<string, unknown>;
    for (const name of VIEW_NAMES) {
      if (name === "news") continue;
      const next = patch[name];
      if (next !== undefined) {
        v[name] = next;
        moved.push(name);
      }
    }
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
    const fresh = frame.notices.filter(isNotable);
    if (fresh.length > 0) {
      const entries = fresh.map(
        (notice): NoticeEntry => ({ seq: ++this.seq, time: frame.clock.now, notice }),
      );
      this.notices = [...this.notices, ...entries].slice(-NOTICE_LOG_CAP);
      moved.push("notices");
    }
    this.emit(moved);
  }

  private setClock(clock: ClockView, moved: StoreKey[]): void {
    const held = this.views.clock;
    if (held && held.data === clock) return;
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
