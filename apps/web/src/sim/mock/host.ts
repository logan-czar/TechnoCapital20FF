// The mock worker's brain, free of Worker globals so tests can drive it directly: it answers ToSim
// requests and paces the clock, returning the FromSim messages to post, in order. It follows the
// protocol's rules (types/protocol.ts): after each request a Frame with the views it changed
// FIRST, then the Reply; while running, at most one Frame per FRAME_MS.
//
// `MockOptions` (mockSim.ts) says which mock it hosts: the pivot world by default (D1037), where
// `Act` is served; with `pivot: false` the pre-pivot one. With the pivot world, once the UI sends a
// `Want` (D1016) the mock posts only the views and slices it names, as the real host does: a
// contract's book and history, a race's county returns, a roll call's votes and a day's front
// pages (protocol.ts `SliceKey`). `slice` reads one in process, for tests.

import {
  ALERT_LEVEL_VALUES,
  type FromSim,
  type Notice,
  type Reply,
  type SliceData,
  type SliceKey,
  type ToSim,
  unsupportedMessage,
  type ViewsPatch,
  type ViewWant,
} from "@tc20ff/sim";
import { type MockOptions, type MockSave, MockSim } from "./mockSim.ts";
import type { MockWorld } from "./mockWorld.ts";
import type { RecordedAction } from "./pivot.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class SimHost {
  sim: MockSim | null = null;
  /** The views and slices the UI reads (D1016); null until its first `Want`: every view then. */
  private want: ViewWant | null = null;

  constructor(
    private readonly world: MockWorld,
    private readonly opts: MockOptions = {},
  ) {}

  private patch(sim: MockSim): ViewsPatch {
    return sim.takePatch(this.want);
  }

  private frame(sim: MockSim, notices: Notice[]): FromSim {
    return { kind: "Frame", notices, clock: sim.views.clock.data, views: this.patch(sim) };
  }

  /** A slice of a pivot view, at the current tick; null with no game, no pivot world or nothing by that key. */
  slice<K extends SliceKey>(key: K): SliceData<K>;
  slice(key: SliceKey): SliceData {
    return this.sim?.slice(key) ?? null;
  }

  /** Handles one request: [Frame, Reply], or just a Reply when nothing changed. */
  handle(msg: ToSim): FromSim[] {
    switch (msg.kind) {
      case "Want": {
        // The pre-pivot mock posts every view whole, whatever is wanted, as its tests pin.
        if (this.opts.pivot === false) return [];
        this.want = { views: new Set(msg.views), slices: msg.slices };
        if (this.sim === null) return [];
        // Whatever is newly wanted goes out now, even while paused (no frame would carry it).
        const views = this.patch(this.sim);
        if (Object.keys(views).length === 0) return [];
        return [{ kind: "Frame", notices: [], clock: this.sim.views.clock.data, views }];
      }
      case "FrameDone":
      // Nothing the mock does takes long enough to cancel.
      case "Cancel":
        return [];
      case "SaveSlot":
      case "LoadSlot":
      case "ListSaves":
      case "DeleteSave":
        return [this.reply(msg.id, { kind: "Refused", message: unsupportedMessage(msg.kind) })];
      case "Act": {
        // The pivot world takes the action (pivot.ts `act`); without it the mock refuses, as the
        // real sim of M1 does (types/action.ts). A refused action changes nothing: no Frame.
        if (this.sim === null) return [this.refuse(msg.id)];
        const result = this.sim.act(msg.action);
        if (result.kind !== "Ok") return [this.reply(msg.id, result)];
        return [this.frame(this.sim, result.notices), this.reply(msg.id, result)];
      }
      case "NewGame": {
        // The mock has one start (pivot 3.5 arrives with lane U3's fixtures).
        if (msg.start !== undefined) {
          return [this.reply(msg.id, { kind: "Refused", message: unsupportedMessage(msg.kind) })];
        }
        this.sim = new MockSim(this.world, msg.seed, undefined, this.opts);
        return [this.frame(this.sim, []), this.reply(msg.id, { kind: "Ok", notices: [] })];
      }
      case "Load": {
        const save = this.decode(msg.bytes);
        if (save === null) {
          return [
            this.reply(msg.id, { kind: "SimError", error: { kind: "Save", error: { kind: "BadMagic" } } }),
          ];
        }
        // A load pauses and drops any skip (D13).
        this.sim = new MockSim(this.world, save.seed, save, this.opts);
        const notices: Notice[] = [{ kind: "Paused", reason: { kind: "Loaded" } }];
        return [this.frame(this.sim, notices), this.reply(msg.id, { kind: "Ok", notices })];
      }
      case "Save": {
        if (this.sim === null) return [this.refuse(msg.id)];
        const bytes = encoder.encode(JSON.stringify(this.sim.save()));
        return [this.reply(msg.id, { kind: "Saved", bytes })];
      }
      case "Control": {
        if (this.sim === null) return [this.refuse(msg.id)];
        const kind: string = msg.control.kind;
        if (kind === "NewGame" || kind === "Save" || kind === "Load") {
          return [this.reply(msg.id, { kind: "Refused", message: `${kind} is a request, not a control` })];
        }
        const result = this.sim.apply(msg.control);
        const notices = result.kind === "Ok" ? result.notices : [];
        return [this.frame(this.sim, notices), this.reply(msg.id, result)];
      }
    }
  }

  /** Advances the clock by `dtMs` of real time; a Frame only if something moved. */
  tick(dtMs: number): FromSim[] {
    if (this.sim === null) return [];
    const notices = this.sim.advance(dtMs);
    if (notices.length === 0 && !this.sim.hasPatch()) return [];
    return [this.frame(this.sim, notices)];
  }

  private reply(id: number, result: Reply): FromSim {
    return { kind: "Reply", id, result };
  }

  private refuse(id: number): FromSim {
    return this.reply(id, { kind: "Refused", message: "no game yet: send NewGame or Load first" });
  }

  private decode(bytes: Uint8Array): MockSave | null {
    try {
      const v: unknown = JSON.parse(decoder.decode(bytes));
      if (typeof v !== "object" || v === null || Reflect.get(v, "mock") !== 1) return null;
      const { seed, now, speed, alerts } = v as Record<string, unknown>;
      if (typeof seed !== "number" || typeof now !== "number" || typeof speed !== "number") return null;
      if (!Array.isArray(alerts) || !alerts.every((a) => ALERT_LEVEL_VALUES.some((l) => l === a)))
        return null;
      const save: MockSave = { mock: 1, seed, now, speed, alerts };
      // A pivot game's start and recorded actions (pivot 16.1): replayed as they are, so only their shape is checked.
      const pivot = (v as { pivot?: unknown }).pivot;
      if (typeof pivot === "object" && pivot !== null) {
        const { start, actions } = pivot as Record<string, unknown>;
        if (typeof start !== "number" || !Array.isArray(actions)) return null;
        if (
          !actions.every(
            (a) =>
              typeof a === "object" &&
              a !== null &&
              typeof a.at === "number" &&
              typeof a.action?.kind === "string",
          )
        )
          return null;
        save.pivot = { start, actions: actions as RecordedAction[] };
      }
      return save;
    } catch {
      return null;
    }
  }
}
