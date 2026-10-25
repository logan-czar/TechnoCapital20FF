// The typed main-thread client of the sim worker (protocol.ts). Requests return promises resolved
// by the matching Reply; Frames are merged into the store. The worker posts a request's Frame
// BEFORE its Reply, so when an awaited request resolves, the store already holds its views.

import type { FromSim, Reply, RequestId, ToSim, UiControl } from "@tc20ff/sim";
import { SimStore } from "./store.ts";

/** Anything that carries protocol messages: a Worker, or a test double. */
export interface SimTransport {
  send(msg: ToSim): void;
  onMessage(cb: (msg: FromSim) => void): void;
}

/** A request without its id (the client assigns it). */
type Request = ToSim extends infer T ? (T extends { id: RequestId } ? Omit<T, "id"> : never) : never;

export class SimClient {
  readonly store = new SimStore();
  /** Resolves when the worker says Ready. */
  readonly ready: Promise<void>;
  private nextId = 1;
  private pending = new Map<RequestId, (r: Reply) => void>();
  private resolveReady!: () => void;

  constructor(private readonly transport: SimTransport) {
    this.ready = new Promise((res) => {
      this.resolveReady = res;
    });
    transport.onMessage((m) => this.receive(m));
  }

  private receive(m: FromSim): void {
    switch (m.kind) {
      case "Ready":
        this.store.setStatus({ ready: true });
        this.resolveReady();
        break;
      case "Frame":
        this.store.applyFrame(m);
        break;
      case "Reply": {
        const done = this.pending.get(m.id);
        this.pending.delete(m.id);
        done?.(m.result);
        break;
      }
      case "Fatal":
        this.store.setStatus({ fatal: m.message });
        break;
    }
  }

  request(req: Request): Promise<Reply> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.transport.send({ ...req, id } as ToSim);
    });
  }

  async newGame(seed: number): Promise<Reply> {
    const r = await this.request({ kind: "NewGame", seed });
    if (r.kind === "Ok") this.store.setStatus({ started: true });
    return r;
  }

  async load(bytes: Uint8Array): Promise<Reply> {
    const r = await this.request({ kind: "Load", bytes });
    if (r.kind === "Ok") this.store.setStatus({ started: true });
    return r;
  }

  async save(): Promise<Uint8Array | null> {
    const r = await this.request({ kind: "Save" });
    return r.kind === "Saved" ? r.bytes : null;
  }

  control(control: UiControl): Promise<Reply> {
    return this.request({ kind: "Control", control });
  }
}

/** Wraps a Worker as a transport. */
export function workerTransport(worker: Worker): SimTransport {
  return {
    send: (msg) => worker.postMessage(msg),
    onMessage: (cb) => {
      worker.onmessage = (e: MessageEvent<FromSim>) => cb(e.data);
    },
  };
}
