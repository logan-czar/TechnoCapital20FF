// The store takes every view a frame carries: its list is written out by hand, so a new view left
// off it would reach no page while every sim test still passed (the politics POC's view did).
import { VIEW_NAMES } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import { type Frame, SimStore } from "../../src/sim/store.ts";

describe("SimStore", () => {
  it("takes every view but the news (appended headlines) and the clock (the frame's own)", () => {
    const store = new SimStore();
    const views: Record<string, unknown> = {};
    const names = VIEW_NAMES.filter((n) => n !== "news" && n !== "clock");
    for (const n of names) views[n] = { data: { name: n }, version: 1, dirty: true };
    store.applyFrame({ kind: "Frame", views, clock: { now: 0 }, notices: [] } as unknown as Frame);
    for (const n of names) expect(store.getView(n)?.data, n).toEqual({ name: n });
  });
});
