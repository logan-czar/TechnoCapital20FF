// The mock worker's brain, free of Worker globals so tests can drive it directly: it answers ToSim
// requests and paces the clock, returning the FromSim messages to post, in order. It follows the
// protocol's rules (types/protocol.ts): after each request a Frame with the views it changed
// FIRST, then the Reply; while running, at most one Frame per FRAME_MS.

import type { FromSim, Notice, Reply, ToSim } from "@tc20ff/sim";
import { type MockSave, MockSim } from "./mockSim.ts";
import type { MockWorld } from "./mockWorld.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function frame(sim: MockSim, notices: Notice[]): FromSim {
  return { kind: "Frame", notices, clock: sim.views.clock.data, views: sim.takePatch() };
}

export class SimHost {
  sim: MockSim | null = null;

  constructor(private readonly world: MockWorld) {}

  /** Handles one request: [Frame, Reply], or just a Reply when nothing changed. */
  handle(msg: ToSim): FromSim[] {
    switch (msg.kind) {
      case "NewGame": {
        this.sim = new MockSim(this.world, msg.seed);
        return [frame(this.sim, []), this.reply(msg.id, { kind: "Ok", notices: [] })];
      }
      case "Load": {
        const save = this.decode(msg.bytes);
        if (save === null) {
          return [
            this.reply(msg.id, { kind: "SimError", error: { kind: "Save", error: { kind: "BadMagic" } } }),
          ];
        }
        // A load pauses and drops any skip (D13).
        this.sim = new MockSim(this.world, save.seed, save);
        const notices: Notice[] = [{ kind: "Paused", reason: { kind: "Loaded" } }];
        return [frame(this.sim, notices), this.reply(msg.id, { kind: "Ok", notices })];
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
        return [frame(this.sim, notices), this.reply(msg.id, result)];
      }
    }
  }

  /** Advances the clock by `dtMs` of real time; a Frame only if something moved. */
  tick(dtMs: number): FromSim[] {
    if (this.sim === null) return [];
    const notices = this.sim.advance(dtMs);
    if (notices.length === 0 && !this.sim.hasPatch()) return [];
    return [frame(this.sim, notices)];
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
      return v as MockSave;
    } catch {
      return null;
    }
  }
}
