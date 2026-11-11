// What the UI reads (D1016): the worker posts only the wanted views, the three heavy views light,
// and their slices on demand; the store tracks what is read and keeps the slices; a page merges its
// slices back into the shapes its builder reads. A real game (the worker's host, in-process).

import type { FromSim, SliceKey, ToSim, ViewName, ViewsPatch } from "@tc20ff/sim";
import { lightView, sliceData } from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { loadWorld } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { mergeSlices, type ViewsData, viewsData } from "../src/pages/views.ts";
import { RealHost } from "../src/sim/real/host.ts";
import { SimStore } from "../src/sim/store.ts";
import { worldMini } from "./world-mini.ts";

/** Ticks to past the Q1 2020 recap and release (a recap and statements to slice). */
const PAST_Q1 = 24 * 105;

let data: WorldData;
beforeAll(() => {
  const loaded = loadWorld(worldMini().dir);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  data = loaded.value;
});

let nextId = 1;
const send = (h: RealHost, msg: ToSim): FromSim[] => h.handle(msg);
const want = (h: RealHost, views: ViewName[], slices: SliceKey[] = []) =>
  send(h, { kind: "Want", views, slices });
const frames = (out: FromSim[]) =>
  out.filter((m): m is Extract<FromSim, { kind: "Frame" }> => m.kind === "Frame");
const patchOf = (out: FromSim[]): ViewsPatch => frames(out)[0]?.views ?? {};
const viewKeys = (p: ViewsPatch) =>
  Object.keys(p)
    .filter(
      (k) => !["refresh", "omniscient", "news_appended", "news_reset", "news_version", "slices"].includes(k),
    )
    .sort();

/** A host with a game past Q1 2020, wanting only `views` (and `slices`). */
function game(views: ViewName[], slices: SliceKey[] = []): RealHost {
  const h = new RealHost(data);
  want(h, views, slices);
  send(h, { kind: "NewGame", id: nextId++, seed: 7 });
  const sim = h.sim;
  if (!sim) throw new Error("no game");
  for (let i = 0; i < PAST_Q1; i++) sim.step();
  return h;
}

describe("the worker posts what the UI wants (D1016)", () => {
  it("posts the wanted views only, and a newly wanted one at once, even paused", () => {
    const h = new RealHost(data);
    want(h, ["company_rows"]);
    const first = patchOf(send(h, { kind: "NewGame", id: nextId++, seed: 7 }));
    expect(viewKeys(first)).toEqual(["company_rows"]);
    // News always flows: it only grows, and the feed is cheap.
    expect(first.news_reset).toBe(true);
    // Nothing new is wanted: no frame.
    expect(frames(want(h, ["company_rows"]))).toEqual([]);
    const more = patchOf(want(h, ["company_rows", "quotes"]));
    expect(viewKeys(more)).toEqual(["quotes"]);
    // Let go and wanted again: it was posted at this version, so nothing to send.
    want(h, ["company_rows"]);
    expect(frames(want(h, ["company_rows", "quotes"]))).toEqual([]);
  });

  it("posts the heavy views light, and each wanted slice whole", () => {
    const h = game([]);
    const sim = h.sim;
    if (!sim) throw new Error("no game");
    const full = sim.views();
    const company = full.statements.data.companies.find((c) => c.quarters.length > 0)?.id;
    const quarter = full.recap.data.recaps.at(-1)?.world.quarter;
    const zone = full.exchanges.data.exchanges[0]?.zone;
    if (company === undefined || quarter === undefined || zone === undefined)
      throw new Error("nothing to slice");
    const slices: SliceKey[] = [
      { view: "statements", company },
      { view: "recap", quarter },
      { view: "exchanges", zone },
    ];
    const p = patchOf(want(h, ["statements", "recap", "exchanges"], slices));
    expect(viewKeys(p)).toEqual(["exchanges", "recap", "statements"]);
    expect(p.statements?.data.companies).toEqual([]);
    expect(p.recap?.data.recaps.every((r) => r.companies.length === 0)).toBe(true);
    expect(p.recap?.data.recaps.map((r) => r.world)).toEqual(full.recap.data.recaps.map((r) => r.world));
    expect(p.exchanges?.data.exchanges.every((x) => x.closes.log.closed.len === 0)).toBe(true);
    expect(p.slices?.map((s) => s.key)).toEqual(slices);
    for (const s of p.slices ?? []) expect(s.data).toBe(sliceData(full, s.key));
    expect(p.slices?.every((s) => s.data !== null)).toBe(true);
    // Posted at this version: nothing again until the view moves.
    expect(frames(want(h, ["statements", "recap", "exchanges"], slices))).toEqual([]);
    // A slice let go and wanted again goes out again.
    want(h, ["statements", "recap", "exchanges"], slices.slice(1));
    expect(patchOf(want(h, ["statements", "recap", "exchanges"], slices)).slices?.map((s) => s.key)).toEqual([
      slices[0],
    ]);
  });

  it("re-posts a slice when its view moves, and resets the news on a new game though no once-at-load view is wanted", () => {
    const h = game(["clock"], [{ view: "exchanges", zone: 0 as never }]);
    const sim = h.sim;
    if (!sim) throw new Error("no game");
    const before = sim.views().exchanges.version;
    while (sim.views().exchanges.version === before) sim.step();
    // The next frame (a control's) carries the moved slice, and the one after does not.
    const out = patchOf(send(h, { kind: "Control", id: nextId++, control: { kind: "Pause" } }));
    expect(out.slices?.[0]?.version).toBe(sim.views().exchanges.version);
    expect(
      patchOf(send(h, { kind: "Control", id: nextId++, control: { kind: "SetSpeed", speed: 1 } })).slices,
    ).toBeUndefined();
    const fresh = patchOf(send(h, { kind: "NewGame", id: nextId++, seed: 8 }));
    expect(fresh.news_reset).toBe(true);
    expect(fresh.slices?.length).toBe(1);
    sim.step();
    const after = h.handle({ kind: "Control", id: nextId++, control: { kind: "Pause" } });
    expect(patchOf(after).news_reset).toBeUndefined();
  });

  it("posts every view whole until the UI sends a Want (tests, the mock)", () => {
    const h = new RealHost(data);
    const p = patchOf(send(h, { kind: "NewGame", id: nextId++, seed: 7 }));
    expect(p.statements).toBeDefined();
    expect(p.slices).toBeUndefined();
    expect(p.exchanges?.data).toBe(h.sim?.views().exchanges.data);
  });
});

describe("the store's wants and slices (D1016)", () => {
  const tick = () => new Promise<void>((r) => queueMicrotask(r));

  it("tells the client what is read, once per change, and keeps slices while read", async () => {
    const store = new SimStore();
    const sent: string[] = [];
    store.onWant = (views, slices) => sent.push(`${views.join(",")}|${slices.length}`);
    const offA = store.subscribe("quotes", () => {});
    const offB = store.subscribe("company_rows", () => {});
    store.subscribe("notices", () => {});
    await tick();
    // In VIEW_NAMES order.
    expect(sent).toEqual(["quotes,company_rows|0"]);
    const key: SliceKey = { view: "statements", company: 3 as never };
    let woke = 0;
    const offS = store.subscribeSlice(key, () => woke++);
    await tick();
    expect(sent.at(-1)).toBe("quotes,company_rows|1");
    store.applyFrame({
      kind: "Frame",
      notices: [],
      clock: { now: 0 } as never,
      views: { slices: [{ key, version: 5, data: null }] },
    });
    expect(woke).toBe(1);
    expect(store.getSlice(key)?.version).toBe(5);
    offS();
    offA();
    offB();
    await tick();
    expect(sent.at(-1)).toBe("|0");
    // A slice let go is dropped, so reopening waits for a fresh copy.
    expect(store.getSlice(key)).toBeUndefined();
    // Subscribing and letting go in one task sends nothing.
    const n = sent.length;
    store.subscribe("zones", () => {})();
    await tick();
    expect(sent.length).toBe(n);
  });
});

describe("mergeSlices (D1016)", () => {
  it("puts each slice back where the full view holds it", () => {
    const h = game([]);
    const sim = h.sim;
    if (!sim) throw new Error("no game");
    const full = viewsData(sim.views());
    const v = sim.views();
    const light: ViewsData = {
      ...full,
      statements: lightView("statements", v.statements).data,
      recap: lightView("recap", v.recap).data,
      exchanges: lightView("exchanges", v.exchanges).data,
    };
    const company = v.statements.data.companies.find((c) => c.quarters.length > 0)?.id;
    const quarter = v.recap.data.recaps.at(-1)?.world.quarter;
    if (company === undefined || quarter === undefined) throw new Error("nothing to slice");
    const keys: SliceKey[] = [
      { view: "statements", company },
      { view: "recap", quarter },
      { view: "exchanges", zone: 0 as never },
    ];
    const merged = mergeSlices(
      light,
      keys.map((key) => ({ key, version: 1, data: sliceData(v, key) })),
    );
    expect(merged.statements?.companies).toEqual([full.statements?.companies.find((c) => c.id === company)]);
    expect(merged.recap?.recaps.at(-1)).toBe(full.recap?.recaps.at(-1));
    expect(merged.recap?.recaps[0]?.companies).toEqual(
      full.recap?.recaps.length === 1 ? merged.recap?.recaps[0]?.companies : [],
    );
    expect(merged.exchanges?.exchanges[0]?.closes).toBe(full.exchanges?.exchanges[0]?.closes);
    expect(merged.exchanges?.exchanges[1]?.closes.log.closed.len).toBe(0);
    // Nothing arrived yet: the views as they are.
    expect(mergeSlices(light, [undefined, undefined])).toBe(light);
  });
});
