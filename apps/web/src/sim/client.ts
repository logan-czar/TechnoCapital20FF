// The typed main-thread client of the sim (protocol.ts), wherever the sim runs: a Web Worker, or the
// Electron sim process behind a MessagePort (pivot 15.1). Requests return promises resolved by the
// matching Reply; Frames are merged into the store. The sim posts a request's Frame BEFORE its
// Reply, so when an awaited request resolves, the store already holds its views. A request never
// hangs: a Fatal message or a transport failure settles every pending one as Refused.

import {
  actErrorMessage,
  type ClockView,
  type FromSim,
  type GameStart,
  type PlayerAction,
  type Reply,
  type RequestId,
  type SaveInfo,
  type SimError,
  simErrorMessage,
  type ToSim,
  type UiControl,
} from "@tc20ff/sim";
import { SimStore } from "./store.ts";

/** Anything that carries protocol messages: a Worker, a MessagePort, or a test double. */
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
    case "ActError":
      return actErrorMessage(r.error);
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
  /** Frames read so far, and the ticks they carried: what the desktop's smoke run counts. */
  frames = 0;
  ticks = 0;
  /** The clock of the last Frame; null before the first. */
  clock: ClockView | null = null;
  /** A long request's progress (pivot 3.5), also kept in `store.status.progress` (D1037). */
  onProgress: (p: Extract<FromSim, { kind: "Progress" }>) => void = () => {};
  /** The NewGame request still running, so `cancel` can stop it (a generated history, pivot 3.5). */
  private running: RequestId | null = null;

  constructor(private readonly transport: SimTransport) {
    this.ready = new Promise((res) => {
      this.resolveReady = res;
    });
    transport.onMessage((m) => this.receive(m));
    transport.onFailure((message) => this.fail(message));
    // The worker posts only what the UI reads (D1016).
    this.store.onWant = (views, slices) => transport.send({ kind: "Want", views, slices });
    this.store.resendWant();
  }

  private receive(m: FromSim): void {
    switch (m.kind) {
      case "Ready":
        this.store.setStatus({ ready: true, choices: m.choices ?? null });
        this.resolveReady();
        break;
      case "Frame":
        this.store.applyFrame(m);
        this.frames += 1;
        this.clock = m.clock;
        for (const n of m.notices) if (n.kind === "TickDone") this.ticks += 1;
        // A Frame means a game is running. The sim process may have started one by itself (the
        // desktop's `--save`), with no request of ours to tell us so.
        if (!this.store.status.started) this.store.setStatus({ started: true });
        // Read: the worker may post the next one (D1004).
        this.transport.send({ kind: "FrameDone" });
        break;
      case "Reply": {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.id === this.running) {
          this.running = null;
          if (this.store.status.progress !== null) this.store.setStatus({ progress: null });
        }
        if (!p) break;
        if (m.result.kind === "Ok") this.store.mergeReplyNotices(m.result.notices, p.mark);
        const problem = replyProblem(m.result);
        if (problem !== null) this.store.pushMessage("error", problem);
        p.resolve(m.result);
        break;
      }
      case "Progress":
        this.store.setStatus({
          progress: { id: m.id, phase: m.phase, done: m.done, total: m.total, date: m.date },
        });
        this.onProgress(m);
        break;
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

  /**
   * A new game (pivot 3.5): the world's own first day, or `start`, a baked start or a generated
   * history. A generated one reports its progress in `store.status.progress` and can be stopped
   * with `cancel` (the reply is then `Cancelled`).
   */
  async newGame(seed: number, scenario?: string, start?: GameStart): Promise<Reply> {
    const r = await this.request((id) => {
      this.running = id;
      return {
        kind: "NewGame",
        id,
        seed,
        ...(scenario === undefined ? {} : { scenario }),
        ...(start === undefined ? {} : { start }),
      };
    });
    if (r.kind === "Ok") this.store.setStatus({ started: true });
    return r;
  }

  /** Stops the running NewGame (a generated history); false when none is running. */
  cancel(): boolean {
    if (this.running === null) return false;
    this.transport.send({ kind: "Cancel", id: this.running });
    return true;
  }

  /** A player action (pivot 1.2; D1027): the reply is `Ok`, or `ActError` saying why it was refused. */
  act(action: PlayerAction): Promise<Reply> {
    return this.request((id) => ({ kind: "Act", id, action }));
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

  /** Writes the game to a named slot on the sim's disk (pivot 15.4). Only the Electron sim has one. */
  saveSlot(slot: string): Promise<Reply> {
    return this.request((id) => ({ kind: "SaveSlot", id, slot }));
  }

  async loadSlot(slot: string): Promise<Reply> {
    const r = await this.request((id) => ({ kind: "LoadSlot", id, slot }));
    if (r.kind === "Ok") this.store.setStatus({ started: true });
    return r;
  }

  /** The saves on the sim's disk, newest first; null when the request failed (the reason is shown). */
  async listSaves(): Promise<SaveInfo[] | null> {
    const r = await this.request((id) => ({ kind: "ListSaves", id }));
    return r.kind === "Saves" ? r.saves : null;
  }

  deleteSave(slot: string): Promise<Reply> {
    return this.request((id) => ({ kind: "DeleteSave", id, slot }));
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

/** A port transport, with a way to say from outside that the far end is gone. */
export interface PortTransport extends SimTransport {
  fail(message: string): void;
}

/**
 * Wraps a MessagePort as a transport (the Electron sim process, pivot 15.1). The port may still be
 * on its way: what is sent before it arrives is kept and sent in order when it does.
 */
export function portTransport(source: MessagePort | Promise<MessagePort>): PortTransport {
  let port: MessagePort | null = null;
  const waiting: ToSim[] = [];
  let onMessage: (msg: FromSim) => void = () => {};
  let onFailure: (message: string) => void = () => {};
  void Promise.resolve(source).then(
    (p) => {
      port = p;
      // Setting onmessage also starts the port.
      p.onmessage = (e: MessageEvent<FromSim>) => onMessage(e.data);
      p.onmessageerror = () => onFailure("the simulation sent a message that could not be read");
      for (const m of waiting.splice(0)) p.postMessage(m);
    },
    (e: unknown) => onFailure(e instanceof Error ? e.message : String(e)),
  );
  return {
    send: (msg) => {
      if (port === null) waiting.push(msg);
      else port.postMessage(msg);
    },
    onMessage: (cb) => {
      onMessage = cb;
    },
    onFailure: (cb) => {
      onFailure = cb;
    },
    fail: (message) => onFailure(message),
  };
}
