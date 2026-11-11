// The M1 contracts on the UI side (pivot 15; D1029), as M2 left them (D1037): both hosts answer the
// pivot's new messages, serving what M2 serves (the real host generates a history; the mock, whose
// pivot world is now the default, takes actions); the plain mock boots with the pivot's views present
// and empty; the Step control works on the mock; and the app registry and `openApp` are safe.

import type { FromSim, PlayerAction, Reply, ToSim } from "@tc20ff/sim";
import { unsupportedMessage, VIEW_NAMES } from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { loadWorld } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { openApp, setAppOpener } from "../src/links/nav.ts";
import { type AppSpec, appSpecOf, buildAppRegistry, entityRoute, registeredApps } from "../src/os/apps.ts";
import { replyProblem } from "../src/sim/client.ts";
import { SimHost } from "../src/sim/mock/host.ts";
import { buildMockWorld, type MockWorld } from "../src/sim/mock/mockWorld.ts";
import { RealHost } from "../src/sim/real/host.ts";
import { worldMini } from "./world-mini.ts";

let data: WorldData;
let mockWorld: MockWorld;
beforeAll(() => {
  const loaded = loadWorld(worldMini().dir);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  data = loaded.value;
  mockWorld = buildMockWorld(data);
});

const replyOf = (out: FromSim[]): Reply => {
  const r = out.at(-1);
  if (r?.kind !== "Reply") throw new Error("last message is not a Reply");
  return r.result;
};

const ORDER: PlayerAction = {
  kind: "Transfer",
  from: "Brokerage",
  to: "Exchange",
  amount: 100,
};

const SLOT_REQUESTS: ToSim[] = [
  { kind: "SaveSlot", id: 11, slot: "one" },
  { kind: "LoadSlot", id: 12, slot: "one" },
  { kind: "ListSaves", id: 13 },
  { kind: "DeleteSave", id: 14, slot: "one" },
];

describe("the pivot's messages", () => {
  for (const [name, make, real] of [
    ["the real host", () => new RealHost(data), true],
    ["the mock host", () => new SimHost(mockWorld), false],
  ] as const) {
    it(`${name} plays as before and refuses what it does not serve yet`, () => {
      const host = make();
      // A baked start needs a start store, which neither has here, and starts no game.
      const baked = host.handle({ kind: "NewGame", id: 1, seed: 7, start: { kind: "baked", id: "a" } });
      expect(replyOf(baked)).toEqual({ kind: "Refused", message: unsupportedMessage("NewGame") });
      expect(host.sim).toBeNull();
      const generated = host.handle({ kind: "NewGame", id: 2, seed: 7, start: { kind: "generate" } });
      // The real host generates a history of a historical world (D1037; sim-host generate.test.ts);
      // this world is not one. The mock has one start.
      expect(replyOf(generated).kind).toBe("Refused");
      if (real) expect(replyOf(generated)).toMatchObject({ message: expect.stringContaining("historical") });
      // With no `start` it is today's new game.
      const made = host.handle({ kind: "NewGame", id: 3, seed: 7 });
      expect(made.map((m) => m.kind)).toEqual(["Frame", "Reply"]);
      expect(replyOf(made)).toEqual({ kind: "Ok", notices: [] });
      for (const msg of SLOT_REQUESTS) {
        const out = host.handle(msg);
        expect(out.length).toBe(1);
        expect(replyOf(out)).toEqual({ kind: "Refused", message: unsupportedMessage(msg.kind) });
      }
      expect(host.handle({ kind: "Cancel", id: 3 })).toEqual([]);
      const acted = host.handle({ kind: "Act", id: 20, action: ORDER });
      const refused: Reply = { kind: "ActError", error: { kind: "NotAvailable", action: "Transfer" } };
      if (real) {
        // The real sim takes no action until lane P (D1037).
        expect(acted).toEqual([{ kind: "Reply", id: 20, result: refused }]);
      } else {
        // The mock's pivot world takes it: a Frame with the account, then Ok.
        expect(acted.map((m) => m.kind)).toEqual(["Frame", "Reply"]);
        expect(replyOf(acted)).toEqual({ kind: "Ok", notices: [] });
      }
      expect(replyProblem(refused)).toBe("Transfer is not available in this build");
    });
  }

  it("the plain mock boots and posts the pivot's views, empty", () => {
    const host = new SimHost(mockWorld, { pivot: false });
    const out = host.handle({ kind: "NewGame", id: 1, seed: 7 });
    const frame = out[0];
    if (frame?.kind !== "Frame") throw new Error("no frame");
    const views = frame.views as Record<string, { data: unknown } | undefined>;
    for (const n of VIEW_NAMES.slice(30)) expect(views[n], n).toBeDefined();
    expect(host.sim?.views.returns.version).toBe(1);
    expect(views.feed?.data).toEqual({ outlets: [], articles: [], front_pages: [] });
    expect(views.account?.data).toMatchObject({ open: false, cash: [], bankrupt: false });
    expect(views.returns?.data).toEqual({ election: null, races: [] });
  });

  it("a Step runs its hours on the mock and pauses", () => {
    const host = new SimHost(mockWorld);
    host.handle({ kind: "NewGame", id: 1, seed: 7 });
    const bad = host.handle({ kind: "Control", id: 2, control: { kind: "Step", hours: 0 } });
    expect(replyOf(bad)).toEqual({ kind: "SimError", error: { kind: "BadStep", hours: 0 } });
    expect(replyOf(host.handle({ kind: "Control", id: 3, control: { kind: "Step", hours: 2 } })).kind).toBe(
      "Ok",
    );
    const sim = host.sim;
    if (sim === null) throw new Error("no sim");
    const t0 = sim.now;
    const notices = [];
    for (let i = 0; i < 100 && !sim.paused; i++) notices.push(...sim.advance(1000));
    expect(sim.now).toBe(t0 + 2);
    expect(notices.filter((n) => n.kind === "Paused")).toEqual([
      { kind: "Paused", reason: { kind: "StepDone" } },
    ]);
  });
});

describe("the app registry", () => {
  const spec = (id: string, extra: Partial<AppSpec> = {}): AppSpec => ({
    id,
    title: id,
    icon: id,
    Component: null as unknown as AppSpec["Component"],
    defaultSize: { width: 640, height: 480 },
    singleton: true,
    ...extra,
  });

  it("holds the apps that registered (the debug workspace and the M2 apps' placeholders), and is safe to ask", () => {
    const apps = ["browser", "debug", "news", "polls", "records", "social", "terminal", "usmap"];
    expect(registeredApps().map((s) => s.id)).toEqual(apps);
    expect(registeredApps(true).map((s) => s.id)).toEqual(apps);
    expect(appSpecOf("debug")?.title).toBe("Debug workspace");
    expect(appSpecOf("news")?.PhoneView).toBeDefined();
    expect(appSpecOf("betting")).toBeUndefined();
  });

  it("lists apps in id order and refuses an id twice", () => {
    const modules = {
      "../apps/social/app.tsx": { app: spec("social") },
      "../apps/debug/app.tsx": { app: spec("debug", { debugOnly: true }) },
      "../apps/news/app.tsx": { app: spec("news") },
      "../apps/empty/app.tsx": {},
    };
    expect([...buildAppRegistry(modules).keys()]).toEqual(["debug", "news", "social"]);
    expect(() =>
      buildAppRegistry({
        "../apps/a/app.tsx": { app: spec("news") },
        "../apps/b/app.tsx": { app: spec("news") },
      }),
    ).toThrow("app news registered twice (../apps/b/app.tsx)");
  });

  it("writes an entity's route", () => {
    expect(entityRoute({ kind: "Person", id: 12 })).toBe("person/12");
    expect(entityRoute({ kind: "Contract", id: 3 })).toBe("contract/3");
  });

  it("openApp does nothing with no desktop, and calls the opener when there is one", () => {
    setAppOpener(null);
    expect(openApp("news", "article/4")).toBe(false);
    const opened: [string, string | null][] = [];
    setAppOpener((id, route) => opened.push([id, route]));
    expect(openApp("news", "article/4")).toBe(true);
    expect(openApp("betting")).toBe(true);
    expect(opened).toEqual([
      ["news", "article/4"],
      ["betting", null],
    ]);
    setAppOpener(null);
    expect(openApp("news")).toBe(false);
  });
});
