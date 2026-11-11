// Where the page's sim runs (sim/spawn.ts; pivot 15.1): the mock Web Worker when `?mock=1` or the
// Electron app's `--mock` asks for it, the Electron sim process behind a MessagePort when the
// shell is there, else the real Web Worker. And the port transport itself, over a real
// MessageChannel.

import type { FromSim, ToSim } from "@tc20ff/sim";
import { TC_SIM_FAILED, TC_SIM_PORT, type TcFlags, type TcHost } from "@tc20ff/sim-host/bridge";
import { afterEach, describe, expect, it, vi } from "vitest";
import { portTransport, SimClient } from "../src/sim/client.ts";
import { simHome, spawnSim } from "../src/sim/spawn.ts";

const FLAGS: TcFlags = {
  mock: false,
  paused: false,
  world: null,
  save: null,
  smoke: false,
  testHooks: false,
  dev: false,
};

/** A Worker that only records how it was made. */
class FakeWorker {
  static made: { url: string; name: string | undefined }[] = [];
  onmessage: unknown = null;
  onerror: unknown = null;
  onmessageerror: unknown = null;
  sent: unknown[] = [];
  constructor(url: URL | string, options?: { name?: string }) {
    FakeWorker.made.push({ url: String(url), name: options?.name });
  }
  postMessage(m: unknown): void {
    this.sent.push(m);
  }
}

function page(search: string, host: Partial<TcHost> | null): { listeners: ((e: unknown) => void)[] } {
  const listeners: ((e: unknown) => void)[] = [];
  FakeWorker.made = [];
  vi.stubGlobal("location", { search });
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("addEventListener", (type: string, cb: (e: unknown) => void) => {
    if (type === "message") listeners.push(cb);
  });
  if (host !== null) vi.stubGlobal("tcHost", host);
  return { listeners };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
/** Waits for messages to cross a MessageChannel. */
async function settle(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(ok()).toBe(true);
}

describe("spawnSim", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as { __tcSim?: unknown }).__tcSim;
  });

  it("boots the mock sim in a Web Worker for ?mock=1 in a plain browser", () => {
    page("?mock=1", null);
    expect(simHome()).toBe("mock");
    const client = spawnSim();
    expect(FakeWorker.made).toHaveLength(1);
    expect(FakeWorker.made[0]?.url).toMatch(/sim\/mock\/worker\.ts$/);
    expect(client.store.status.ready).toBe(false);
    expect((globalThis as { __tcSim?: unknown }).__tcSim).toBeUndefined();
  });

  it("runs the real sim in a Web Worker named after the world in a plain browser", () => {
    page("", null);
    expect(simHome()).toBe("worker");
    spawnSim();
    expect(FakeWorker.made).toHaveLength(1);
    expect(FakeWorker.made[0]?.url).toMatch(/sim\/real\/worker\.ts$/);
    expect(FakeWorker.made[0]?.name).toBe("1995");
    page("?world=2020", null);
    spawnSim();
    expect(FakeWorker.made[0]?.name).toBe("");
  });

  it("boots the mock for the Electron app's --mock, with no sim process asked for", () => {
    const connectSim = vi.fn();
    page("", { flags: { ...FLAGS, mock: true }, connectSim });
    expect(simHome()).toBe("mock");
    spawnSim();
    expect(FakeWorker.made[0]?.url).toMatch(/sim\/mock\/worker\.ts$/);
    expect(connectSim).not.toHaveBeenCalled();
  });

  it("talks to the Electron sim process through the port the shell hands over", async () => {
    const connectSim = vi.fn();
    const { listeners } = page("", { flags: { ...FLAGS, testHooks: true }, connectSim });
    expect(simHome()).toBe("electron");
    const client = spawnSim();
    expect(FakeWorker.made).toHaveLength(0);
    expect(connectSim).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(1);
    expect((globalThis as { __tcSim?: unknown }).__tcSim).toBe(client);

    // The far end of the channel stands in for the sim process.
    const { port1, port2 } = new MessageChannel();
    const got: ToSim[] = [];
    port2.onmessage = (e: MessageEvent<ToSim>) => got.push(e.data);
    const send = listeners[0] as (e: unknown) => void;
    // A message from elsewhere, or one that is not the shell's, is not taken for the port.
    send({ source: {}, data: { tc: TC_SIM_PORT }, ports: [port1] });
    send({ source: globalThis, data: "hello", ports: [] });
    send({ source: globalThis, data: { tc: TC_SIM_PORT }, ports: [port1] });
    port2.postMessage({ kind: "Ready" } satisfies FromSim);
    await client.ready;
    expect(client.store.status.ready).toBe(true);
    expect(client.store.status.fatal).toBeNull();

    // A request goes out through the port and its Reply comes back.
    const asked = client.listSaves();
    await settle(() => got.some((m) => m.kind === "ListSaves"));
    const request = got.find((m) => m.kind === "ListSaves");
    if (request?.kind !== "ListSaves") throw new Error("no request");
    port2.postMessage({
      kind: "Reply",
      id: request.id,
      result: { kind: "Saves", saves: [] },
    } satisfies FromSim);
    expect(await asked).toEqual([]);

    // The shell says the sim process is gone: shown, and nothing left hanging.
    const hanging = client.saveSlot("one");
    send({
      source: globalThis,
      data: { tc: TC_SIM_FAILED, message: "the simulation process stopped" },
      ports: [],
    });
    expect(await hanging).toEqual({ kind: "Refused", message: "the simulation process stopped" });
    expect(client.store.status.fatal).toBe("the simulation process stopped");
    port1.close();
    port2.close();
  });
});

describe("portTransport", () => {
  it("keeps what is sent before the port arrives, and sends it in order", async () => {
    const { port1, port2 } = new MessageChannel();
    const got: ToSim[] = [];
    port2.onmessage = (e: MessageEvent<ToSim>) => got.push(e.data);
    let arrive: (p: MessagePort) => void = () => {};
    const transport = portTransport(
      new Promise<MessagePort>((r) => {
        arrive = r;
      }),
    );
    const client = new SimClient(transport);
    const first = client.control({ kind: "Pause" });
    const second = client.control({ kind: "Resume" });
    await tick();
    expect(got).toEqual([]);
    arrive(port1);
    await settle(() => got.filter((m) => m.kind === "Control").length === 2);
    const controls = got.filter((m) => m.kind === "Control");
    expect(controls.map((m) => (m.kind === "Control" ? m.control.kind : ""))).toEqual(["Pause", "Resume"]);
    for (const m of controls) {
      if (m.kind === "Control") {
        port2.postMessage({ kind: "Reply", id: m.id, result: { kind: "Ok", notices: [] } } satisfies FromSim);
      }
    }
    expect((await first).kind).toBe("Ok");
    expect((await second).kind).toBe("Ok");
    port1.close();
    port2.close();
  });

  it("marks the game started when a Frame comes with no request: the sim process loaded a save", async () => {
    const { port1, port2 } = new MessageChannel();
    const client = new SimClient(portTransport(port1));
    port2.onmessage = () => {};
    port2.postMessage({ kind: "Ready", choices: { world_id: "1995", scenarios: [] } } satisfies FromSim);
    await client.ready;
    expect(client.store.status.started).toBe(false);
    const clock = { now: 5, paused: true } as unknown as Extract<FromSim, { kind: "Frame" }>["clock"];
    port2.postMessage({
      kind: "Frame",
      notices: [{ kind: "TickDone" }],
      clock,
      views: {},
    } as unknown as FromSim);
    await settle(() => client.frames === 1);
    expect(client.store.status.started).toBe(true);
    expect(client.ticks).toBe(1);
    expect(client.clock?.now).toBe(5);
    port1.close();
    port2.close();
  });
});
