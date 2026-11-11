// Slot saves, the rotating autosave, baked starts, a booted game and the generate seam (pivot 15.4,
// 3.5): the host with its stores in memory, then the stores on disk in a temp folder.

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BakedStart, FromSim, Reply, ToSim } from "@tc20ff/sim";
import { dateTimeDate, dateTimeHour, MAX_SPEED, unsupportedMessage } from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { loadWorld, worldDataDir } from "@tc20ff/sim-data/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RealHost, type RealHostOptions } from "../src/host.ts";
import { WorkerLoop } from "../src/loop.ts";
import { DiskSaveStore, DiskStartStore, loadWorldData, SAVE_EXT, saveMetaOf } from "../src/node.ts";
import {
  AUTOSAVE_SLOTS,
  autosaveSlot,
  isAutosaveSlot,
  MemorySaveStore,
  nextAutosaveSlot,
  SAVE_VERSION,
  type StartStore,
  slotNameOk,
} from "../src/saves.ts";

let data: WorldData;
// Scratch stays on D:, beside the package (node_modules is git-ignored).
const tmpRoot = join(import.meta.dirname, "..", "node_modules", ".test-tmp");
let tmp: string;
beforeAll(() => {
  const loaded = loadWorld(worldDataDir("1995"));
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  data = loaded.value;
  mkdirSync(tmpRoot, { recursive: true });
  tmp = mkdtempSync(join(tmpRoot, "saves-"));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const replyOf = (out: FromSim[]): Reply => {
  const r = out.at(-1);
  if (r?.kind !== "Reply") throw new Error("last message is not a Reply");
  return r.result;
};

function hostOf(opts: RealHostOptions = {}): RealHost {
  let t = 0;
  // Each read moves the clock a little, so a max-speed frame ends after a few ticks.
  const host = new RealHost(data, { budgetMs: 4, now: () => t++, ...opts });
  expect(replyOf(host.handle({ kind: "NewGame", id: 1, seed: 3, scenario: "stable" })).kind).toBe("Ok");
  return host;
}

/** Runs at max speed until `months` month starts have passed. */
function runMonths(host: RealHost, months: number): void {
  host.handle({ kind: "Control", id: 2, control: { kind: "SetSpeed", speed: MAX_SPEED } });
  const sim = host.sim;
  if (sim === null) throw new Error("no game");
  const first = dateTimeDate(sim.now());
  const target = first.year * 12 + first.month + months;
  for (let guard = 0; guard < 100_000; guard++) {
    const d = dateTimeDate(sim.now());
    if (d.year * 12 + d.month >= target) return;
    if (sim.controls().paused) host.handle({ kind: "Control", id: 3, control: { kind: "Resume" } });
    host.tick(16);
    host.handle({ kind: "FrameDone" });
  }
  throw new Error("the months did not pass");
}

describe("slot names", () => {
  it("are plain file names", () => {
    for (const ok of ["one", "My save 2", "a_b-c", "1995"]) expect(slotNameOk(ok)).toBe(true);
    for (const bad of ["", " lead", "trail ", "../up", "a/b", "a\\b", "a.b", "con:", "x".repeat(65)]) {
      expect(slotNameOk(bad)).toBe(false);
    }
  });

  it("keep autosave-1 to autosave-N for autosaves", () => {
    expect(isAutosaveSlot(autosaveSlot(1))).toBe(true);
    expect(isAutosaveSlot(autosaveSlot(AUTOSAVE_SLOTS))).toBe(true);
    expect(isAutosaveSlot(autosaveSlot(AUTOSAVE_SLOTS + 1))).toBe(false);
    expect(isAutosaveSlot("autosave-x")).toBe(false);
    expect(isAutosaveSlot("mine")).toBe(false);
  });
});

describe("slot saves", () => {
  it("are unsupported by a host with no store, as in the browser", () => {
    const host = hostOf();
    const requests: ToSim[] = [
      { kind: "SaveSlot", id: 11, slot: "one" },
      { kind: "LoadSlot", id: 12, slot: "one" },
      { kind: "ListSaves", id: 13 },
      { kind: "DeleteSave", id: 14, slot: "one" },
    ];
    for (const msg of requests) {
      expect(replyOf(host.handle(msg))).toEqual({ kind: "Refused", message: unsupportedMessage(msg.kind) });
    }
  });

  it("save, list, load back to the same state, and delete", () => {
    const saves = new MemorySaveStore();
    const host = hostOf({ saves, autosave: false });
    runMonths(host, 1);
    host.handle({ kind: "Control", id: 4, control: { kind: "Pause" } });
    const sim = host.sim;
    if (sim === null) throw new Error("no game");
    const [hash, now] = [sim.stateHash(), sim.now()];
    expect(replyOf(host.handle({ kind: "SaveSlot", id: 5, slot: "one" }))).toEqual({
      kind: "Ok",
      notices: [],
    });

    const listed = replyOf(host.handle({ kind: "ListSaves", id: 6 }));
    if (listed.kind !== "Saves") throw new Error("not Saves");
    expect(listed.saves).toHaveLength(1);
    expect(listed.saves[0]).toMatchObject({
      slot: "one",
      autosave: false,
      time: now,
      seed: 3,
      save_version: SAVE_VERSION,
    });
    expect(listed.saves[0]?.bytes).toBeGreaterThan(1000);

    // The game moves on, then the slot brings the saved state back, paused, with its Frame first.
    runMonths(host, 1);
    expect(host.sim?.stateHash()).not.toBe(hash);
    const out = host.handle({ kind: "LoadSlot", id: 7, slot: "one" });
    expect(out.map((m) => m.kind)).toEqual(["Frame", "Reply"]);
    expect(replyOf(out).kind).toBe("Ok");
    expect(host.sim?.stateHash()).toBe(hash);
    expect(host.sim?.now()).toBe(now);
    expect(host.sim?.controls().paused).toBe(true);

    expect(replyOf(host.handle({ kind: "DeleteSave", id: 8, slot: "one" }))).toEqual({
      kind: "Ok",
      notices: [],
    });
    expect(replyOf(host.handle({ kind: "DeleteSave", id: 9, slot: "one" })).kind).toBe("Refused");
    expect(replyOf(host.handle({ kind: "LoadSlot", id: 10, slot: "one" })).kind).toBe("Refused");
    expect(replyOf(host.handle({ kind: "ListSaves", id: 11 }))).toEqual({ kind: "Saves", saves: [] });
  });

  it("refuse a bad name, an autosave's name, and a save with no game", () => {
    const saves = new MemorySaveStore();
    const host = hostOf({ saves });
    expect(replyOf(host.handle({ kind: "SaveSlot", id: 5, slot: "../../etc" })).kind).toBe("Refused");
    expect(replyOf(host.handle({ kind: "LoadSlot", id: 6, slot: "a/b" })).kind).toBe("Refused");
    expect(replyOf(host.handle({ kind: "SaveSlot", id: 7, slot: autosaveSlot(1) })).kind).toBe("Refused");
    expect(saves.list()).toEqual([]);
    const idle = new RealHost(data, { saves });
    expect(replyOf(idle.handle({ kind: "SaveSlot", id: 8, slot: "one" })).kind).toBe("Refused");
    // A store that throws is an answer, not a Fatal.
    const broken = hostOf({
      saves: {
        write: () => {
          throw new Error("disk full");
        },
        read: () => null,
        list: () => [],
        delete: () => false,
      },
    });
    expect(replyOf(broken.handle({ kind: "SaveSlot", id: 9, slot: "one" }))).toEqual({
      kind: "SimError",
      error: { kind: "Save", error: { kind: "Io", message: "disk full" } },
    });
  });
});

describe("the autosave", () => {
  it("is written at each month start and rotates through three slots", () => {
    const saves = new MemorySaveStore();
    const host = hostOf({ saves, autosaveMinMs: 0 });
    runMonths(host, 2);
    let list = saves.list();
    expect(list.map((s) => s.slot)).toEqual([autosaveSlot(2), autosaveSlot(1)]);
    expect(list.every((s) => s.autosave)).toBe(true);
    // Each was taken at 00:00 on the first of a month.
    for (const s of list) {
      expect(dateTimeHour(s.time)).toBe(0);
      expect(dateTimeDate(s.time).day).toBe(1);
    }
    runMonths(host, 3);
    list = saves.list();
    // Five month starts, three files: the two oldest were written over.
    expect(list.map((s) => s.slot)).toEqual([autosaveSlot(2), autosaveSlot(1), autosaveSlot(3)]);
    const times = list.map((s) => s.time);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(nextAutosaveSlot(list)).toBe(autosaveSlot(3));
  });

  it("does not move the state hash", () => {
    const plain = hostOf({ saves: new MemorySaveStore(), autosave: false });
    const saving = hostOf({ saves: new MemorySaveStore(), autosaveMinMs: 0 });
    runMonths(plain, 2);
    runMonths(saving, 2);
    const [a, b] = [plain.sim, saving.sim];
    if (a === null || b === null) throw new Error("no game");
    // The two stopped a few ticks apart (an autosave ends its frame): bring both to the same tick.
    const until = Math.max(a.now(), b.now());
    while (a.now() < until) a.step();
    while (b.now() < until) b.step();
    expect(b.stateHash()).toBe(a.stateHash());
  });

  it("waits out the real-time gap, and can be turned off", () => {
    const gapped = new MemorySaveStore();
    // The fake clock moves about a ms per read: a gap this long is never waited out here.
    runMonths(hostOf({ saves: gapped, autosaveMinMs: 1e12 }), 3);
    expect(gapped.list().map((s) => s.slot)).toEqual([autosaveSlot(1)]);
    const off = new MemorySaveStore();
    runMonths(hostOf({ saves: off, autosave: false }), 2);
    expect(off.list()).toEqual([]);
  });
});

describe("baked starts and the generate seam", () => {
  const start = (id: string, save_version: number): BakedStart => ({
    id,
    label: `Start ${id}`,
    seed: 3,
    save_version,
    hash: "0".repeat(32),
  });

  it("lists this build's starts in Ready, and none when the folder has none", async () => {
    const posted: FromSim[] = [];
    const loopOf = (starts: StartStore | undefined) =>
      new WorkerLoop({
        post: (m) => posted.push(m),
        load: async () => new RealHost(data, starts === undefined ? {} : { starts }),
        now: () => 0,
        setInterval: () => 0,
        clearInterval: () => {},
      });
    await loopOf(undefined).start();
    expect(posted.at(-1)).toMatchObject({ kind: "Ready" });
    expect(posted.at(-1)).not.toHaveProperty("starts");
    await loopOf({ list: () => [], read: () => null }).start();
    expect(posted.at(-1)).toMatchObject({ kind: "Ready", starts: [] });
    const rows = [start("now", SAVE_VERSION), start("old", SAVE_VERSION - 1)];
    await loopOf({ list: () => rows, read: () => null }).start();
    expect(posted.at(-1)).toMatchObject({ kind: "Ready", starts: [rows[0]] });
  });

  it("starts a game from a baked start's save", () => {
    const source = hostOf();
    runMonths(source, 1);
    const sim = source.sim;
    if (sim === null) throw new Error("no game");
    const bytes = sim.saveBytes();
    const starts: StartStore = {
      list: () => [start("a", SAVE_VERSION), start("old", SAVE_VERSION - 1), start("gone", SAVE_VERSION)],
      read: (id) => (id === "a" || id === "old" ? bytes : null),
    };
    const host = new RealHost(data, { starts });
    const out = host.handle({ kind: "NewGame", id: 1, seed: 99, start: { kind: "baked", id: "a" } });
    expect(out.map((m) => m.kind)).toEqual(["Frame", "Reply"]);
    expect(replyOf(out).kind).toBe("Ok");
    expect(host.sim?.stateHash()).toBe(sim.stateHash());
    // The start's own seed, not the request's.
    expect(host.sim?.seed()).toBe(3);
    for (const id of ["nope", "old", "gone"]) {
      const refused = new RealHost(data, { starts });
      const r = replyOf(refused.handle({ kind: "NewGame", id: 2, seed: 1, start: { kind: "baked", id } }));
      expect(r.kind).toBe("Refused");
      expect(refused.sim).toBeNull();
    }
  });

  it("answers a generated start through the seam: unsupported until lane S4 injects one", () => {
    const host = new RealHost(data);
    const msg: ToSim = { kind: "NewGame", id: 1, seed: 1, start: { kind: "generate" } };
    expect(replyOf(host.handle(msg))).toEqual({ kind: "Refused", message: unsupportedMessage("NewGame") });
    expect(host.sim).toBeNull();
    const seen: unknown[] = [];
    const injected = new RealHost(data, {
      generate: (req) => {
        seen.push(req);
        return [{ kind: "Reply", id: req.id, result: { kind: "Cancelled" } }];
      },
    });
    expect(replyOf(injected.handle({ ...msg, scenario: "stable" }))).toEqual({ kind: "Cancelled" });
    expect(seen).toEqual([{ id: 1, seed: 1, scenario: "stable" }]);
  });
});

describe("a booted game", () => {
  it("is posted after Ready, once the UI is there", async () => {
    const source = hostOf();
    runMonths(source, 1);
    const sim = source.sim;
    if (sim === null) throw new Error("no game");
    const bytes = sim.saveBytes();
    const posted: FromSim[] = [];
    let host: RealHost | null = null;
    const loop = new WorkerLoop({
      post: (m) => posted.push(m),
      load: async () => {
        host = new RealHost(data);
        expect(host.boot({ kind: "load", bytes })).toBeNull();
        return host;
      },
      now: () => 0,
      setInterval: () => 0,
      clearInterval: () => {},
    });
    await loop.start();
    expect(posted.map((m) => m.kind)).toEqual(["Ready", "Frame"]);
    expect((host as RealHost | null)?.sim?.stateHash()).toBe(sim.stateHash());
    const frame = posted[1];
    if (frame?.kind !== "Frame") throw new Error("no frame");
    expect(frame.clock.now).toBe(sim.now());
    expect(frame.clock.paused).toBe(true);
  });

  it("says what is wrong with a save that does not load", () => {
    const host = new RealHost(data);
    expect(host.boot({ kind: "load", bytes: new Uint8Array([1, 2, 3]) })).toMatch(/save/i);
    expect(host.sim).toBeNull();
    expect(host.boot({ kind: "new", seed: 5, scenario: "stable" })).toBeNull();
    expect(host.sim?.seed()).toBe(5);
  });
});

describe("the stores on disk", () => {
  it("write a slot whole, list newest first, and survive a lost .json", () => {
    const dir = join(tmp, "saves");
    const store = new DiskSaveStore(dir);
    expect(store.list()).toEqual([]);
    const host = hostOf({ saves: store, autosave: false });
    expect(replyOf(host.handle({ kind: "SaveSlot", id: 5, slot: "first" })).kind).toBe("Ok");
    runMonths(host, 1);
    expect(replyOf(host.handle({ kind: "SaveSlot", id: 6, slot: "second one" })).kind).toBe("Ok");
    const sim = host.sim;
    if (sim === null) throw new Error("no game");
    // No temp file is left behind.
    expect(readdirSync(dir).sort()).toEqual(
      ["first", "second one"].flatMap((s) => [`${s}${SAVE_EXT}`, `${s}${SAVE_EXT}.json`]).sort(),
    );
    const list = store.list();
    expect(list.map((s) => s.slot).sort()).toEqual(["first", "second one"]);
    const second = list.find((s) => s.slot === "second one");
    expect(second).toMatchObject({ time: sim.now(), seed: 3, save_version: SAVE_VERSION, autosave: false });

    // The save says the same about itself, so a file with no .json beside it still lists.
    const bytes = store.read("second one");
    if (bytes === null) throw new Error("no bytes");
    expect(saveMetaOf(bytes)).toEqual({ time: sim.now(), seed: 3, save_version: SAVE_VERSION });
    rmSync(join(dir, `second one${SAVE_EXT}.json`));
    expect(store.list().find((s) => s.slot === "second one")).toEqual(second);
    // A file that is no save is left out, not an error.
    writeFileSync(join(dir, `junk${SAVE_EXT}`), "not a save");
    expect(
      store
        .list()
        .map((s) => s.slot)
        .sort(),
    ).toEqual(["first", "second one"]);

    // Loading the file gives the state back.
    const hash = sim.stateHash();
    runMonths(host, 1);
    expect(replyOf(host.handle({ kind: "LoadSlot", id: 7, slot: "second one" })).kind).toBe("Ok");
    expect(host.sim?.stateHash()).toBe(hash);

    expect(store.delete("first")).toBe(true);
    expect(store.delete("first")).toBe(false);
    expect(store.read("first")).toBeNull();
    expect(() => store.path("../up")).toThrow();
  });

  it("read the baked starts' index, and take a missing one as no starts", () => {
    const dir = join(tmp, "starts");
    const store = new DiskStartStore(dir);
    expect(store.list()).toEqual([]);
    expect(store.read("a")).toBeNull();
    mkdirSync(dir, { recursive: true });
    const row = { id: "a", label: "A", seed: 1, save_version: SAVE_VERSION, hash: "ab".repeat(16) };
    writeFileSync(
      join(dir, "index.json"),
      JSON.stringify({ starts: [row, { id: "b" }, { ...row, id: "c", file: "../c.tcsave" }] }),
    );
    writeFileSync(join(dir, `a${SAVE_EXT}`), new Uint8Array([7, 8, 9]));
    expect(store.list().map((s) => s.id)).toEqual(["a", "c"]);
    expect(store.list()[0]).toEqual(row);
    expect([...(store.read("a") ?? [])]).toEqual([7, 8, 9]);
    // A file name that leaves the folder is not read.
    expect(store.read("c")).toBeNull();
    writeFileSync(join(dir, "index.json"), "{ not json");
    expect(store.list()).toEqual([]);
  });

  it("load a world from disk as the worker's lists name it", async () => {
    const loaded = await loadWorldData("1995", { world: worldDataDir("1995"), map: null });
    expect(loaded.manifest.id).toBe("1995");
    expect(loaded.map).toBeNull();
    // The same tables as sim-data's own Node loader gives.
    expect(JSON.stringify({ ...loaded, map: null })).toBe(JSON.stringify({ ...data, map: null }));
    await expect(loadWorldData("1995", { world: join(tmp, "nowhere"), map: null })).rejects.toThrow(
      /not found/,
    );
  });
});
