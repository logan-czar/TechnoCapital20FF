// The worker's message loop, free of Worker globals so tests can drive it: it queues requests until
// the data is loaded and the RealHost exists, answers them, runs the pacing timer, and turns any
// throw into exactly one Fatal, after which it stops (no timer, requests answered Refused).

import { FRAME_MS, type FromSim, type ToSim } from "@tc20ff/sim";
import type { RealHost } from "./host.ts";

export interface LoopDeps {
  post(m: FromSim): void;
  /** Loads the data and builds the host; a rejection is Fatal. */
  load(): Promise<RealHost>;
  /** A monotonic clock in ms (`performance.now`). */
  now(): number;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export class WorkerLoop {
  private host: RealHost | null = null;
  private queued: ToSim[] = [];
  private timer: unknown = null;
  private dead = false;

  constructor(private readonly deps: LoopDeps) {}

  /** Loads, posts Ready, answers the queued requests and starts the pacing timer. */
  async start(): Promise<void> {
    try {
      const host = await this.deps.load();
      if (this.dead) return;
      this.host = host;
      this.deps.post({ kind: "Ready" });
      const queued = this.queued;
      this.queued = [];
      for (const m of queued) this.handle(m);
      if (this.dead) return;
      let last = this.deps.now();
      this.timer = this.deps.setInterval(() => {
        const now = this.deps.now();
        const dt = now - last;
        last = now;
        this.guard(() => this.post(host.tick(dt)));
      }, FRAME_MS);
    } catch (e) {
      this.fatal(e);
    }
  }

  /** The worker's `onmessage`. */
  onMessage(msg: ToSim): void {
    if (this.dead) {
      const result = { kind: "Refused" as const, message: "the sim worker stopped" };
      this.deps.post({ kind: "Reply", id: msg.id, result });
    } else if (this.host === null) {
      this.queued.push(msg);
    } else {
      this.handle(msg);
    }
  }

  private handle(msg: ToSim): void {
    const host = this.host as RealHost;
    this.guard(() => this.post(host.handle(msg)));
  }

  private post(out: FromSim[]): void {
    for (const m of out) this.deps.post(m);
  }

  /**
   * A throw inside the sim is Fatal by design (protocol.ts: a sim panic): the state may be
   * half-updated, so the loop reports it once and stops rather than carrying on.
   */
  private guard(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      this.fatal(e);
    }
  }

  /** Posts one Fatal and stops: later errors and requests do not post another. */
  private fatal(e: unknown): void {
    if (this.dead) return;
    this.dead = true;
    if (this.timer !== null) this.deps.clearInterval(this.timer);
    this.timer = null;
    this.deps.post({ kind: "Fatal", message: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}
