// A minimal SimApi for the runner tests: a clock that ticks, a month notice every 730 hours,
// controls that follow the real rules (speed, pause, resume), and saves held as bytes. No economy.
import type { Control, Controls, Notice, SimViews } from "@tc20ff/sim";
import { ALERT_KIND_DEFAULT_LEVEL, ALERT_KIND_VALUES } from "@tc20ff/sim";
import type { SimFactory, SoakSimApi } from "../src/metrics.ts";

const HOURS_PER_STUB_MONTH = 730;

function freshControls(): Controls {
  return {
    speed: 1,
    paused: true,
    skip: null,
    alerts: ALERT_KIND_VALUES.map((k) => ALERT_KIND_DEFAULT_LEVEL[k]),
    omniscient: false,
    watchlist: new Set(),
  };
}

export class StubSim {
  now_ = 0;
  controls_ = freshControls();

  constructor(readonly seed_: number) {}

  step(): Notice[] {
    this.now_ += 1;
    const out: Notice[] = [];
    if (this.now_ % HOURS_PER_STUB_MONTH === 0) {
      out.push({
        kind: "MonthDone",
        month: { year: 2020, month: 1 + ((this.now_ / HOURS_PER_STUB_MONTH) % 12) },
      });
    }
    out.push({ kind: "TickDone", time: this.now_ });
    return out;
  }

  apply(c: Control): { ok: true; value: Notice[] } | { ok: false; error: { kind: "DebugOnly" } } {
    const k = this.controls_;
    switch (c.kind) {
      case "SetSpeed":
        k.speed = Math.max(c.speed, 1);
        k.paused = c.speed === 0;
        break;
      case "Pause":
        k.paused = true;
        break;
      case "Resume":
        k.paused = false;
        break;
      case "WatchlistAdd":
        k.watchlist.add(c.company);
        break;
      case "WatchlistRemove":
        k.watchlist.delete(c.company);
        break;
      case "SetAlert":
        break;
      default:
        break;
    }
    return { ok: true, value: [] };
  }

  saveBytes(): Uint8Array {
    return new TextEncoder().encode(JSON.stringify({ now: this.now_ }));
  }

  loadBytes(bytes: Uint8Array): { ok: true; value: Notice[] } {
    this.now_ = (JSON.parse(new TextDecoder().decode(bytes)) as { now: number }).now;
    this.controls_.paused = true;
    return { ok: true, value: [] };
  }

  now(): number {
    return this.now_;
  }
  stateHash(): string {
    return `h${this.now_}`;
  }
  seed(): number {
    return this.seed_;
  }
  views(): SimViews {
    return { company_rows: { data: { rows: [] }, version: 0, dirty: false } } as unknown as SimViews;
  }
  clock(): never {
    throw new Error("not used");
  }
  controls(): Controls {
    return this.controls_;
  }
}

/** A factory of stub sims, for the runner commands. */
export const stubFactory: SimFactory = (_data, seed) => ({
  ok: true,
  value: new StubSim(seed) as unknown as SoakSimApi,
});
