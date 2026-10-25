// The typed main-thread client of the sim worker (protocol.ts). Requests return promises resolved
// by the matching Reply; Frames are merged into the store. The worker posts a request's Frame
// BEFORE its Reply, so when an awaited request resolves, the store already holds its views.
// A request never hangs: a Fatal message or a worker error settles every pending one as Refused.

import {
  type FromSim,
  type Reply,
  type RequestId,
  type SimError,
  simErrorMessage,
  type ToSim,
  type UiControl,
} from "@tc20ff/sim";
import { SimStore } from "./store.ts";

/** Anything that carries protocol messages: a Worker, or a test double. */
export interface SimTransport {
  send(msg: ToSim): void;
  onMessage(cb: (msg: FromSim) => void): void;
  /** The channel itself failed (a worker script error, an unreadable message). */
  onFailure(cb: (message: string) => void): void;
}

/** What a failed or refused request reads as to the player. */
export function replyProblem(r: Reply): string | null {
  switch (r.kind) {
    case "SimError":
      return simErrorMessage(r.error satisfies SimError);
    case "Refused":
      return r.message;
    default:
      return null;
  }
}

interface Pending {
  resolve: (r: Reply) => void;
  /** The notice mark when the request was sent. */
  mark: number;
}

export class SimClient {
  readonly store = new SimStore();
  /** Resolves when the worker says Ready. */
  readonly ready: Promise<void>;
  private nextId = 1;
  private pending = new Map<RequestId, Pending>();
  private resolveReady: () => void = () => {};

  constructor(private readonly transport: SimTransport) {
    this.ready = new Promise((res) => {
      this.resolveReady = res;
    });
    transport.onMessage((m) => this.receive(m));
    transport.onFailure((message) => this.fail(message));
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
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (!p) break;
        if (m.result.kind === "Ok") this.store.mergeReplyNotices(m.result.notices, p.mark);
        const problem = replyProblem(m.result);
        if (problem !== null) this.store.pushMessage("error", problem);
        p.resolve(m.result);
        break;
      }
      case "Fatal":
        this.fail(m.message);
        break;
    }
  }

  /** The worker is gone or broken: show it and settle every pending request. */
  private fail(message: string): void {
    this.store.setStatus({ fatal: message });
    const stuck = [...this.pending.values()];
    this.pending.clear();
    for (const p of stuck) p.resolve({ kind: "Refused", message });
    this.resolveReady();
  }

  private request(build: (id: RequestId) => ToSim): Promise<Reply> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      if (this.store.status.fatal !== null) {
        resolve({ kind: "Refused", message: this.store.status.fatal });
        return;
      }
      this.pending.set(id, { resolve, mark: this.store.noticeMark() });
      this.transport.send(build(id));
    });
  }

  async newGame(seed: number): Promise<Reply> {
    const r = await this.request((id) => ({ kind: "NewGame", id, seed }));
    if (r.kind === "Ok") this.store.setStatus({ started: true });
    return r;
  }

  async load(bytes: Uint8Array): Promise<Reply> {
    const r = await this.request((id) => ({ kind: "Load", id, bytes }));
    if (r.kind === "Ok") this.store.setStatus({ started: true });
    return r;
  }

  async save(): Promise<Uint8Array | null> {
    const r = await this.request((id) => ({ kind: "Save", id }));
    return r.kind === "Saved" ? r.bytes : null;
  }

  control(control: UiControl): Promise<Reply> {
    return this.request((id) => ({ kind: "Control", id, control }));
  }
}

/** Wraps a Worker as a transport. */
export function workerTransport(worker: Worker): SimTransport {
  return {
    send: (msg) => worker.postMessage(msg),
    onMessage: (cb) => {
      worker.onmessage = (e: MessageEvent<FromSim>) => cb(e.data);
    },
    onFailure: (cb) => {
      worker.onerror = (e) => cb(e.message || "the simulation worker failed");
      worker.onmessageerror = () => cb("the simulation worker sent a message that could not be read");
    },
  };
}
