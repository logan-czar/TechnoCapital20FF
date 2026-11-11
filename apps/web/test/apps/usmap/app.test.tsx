// @vitest-environment happy-dom
// The USA map app in the DOM against the mock (D1048): each route renders, the panels link to the
// right apps, election night shows the count, the calls and the retraction as the mock plays it,
// certification fills the presidential layer, the hidden lean shows only with Omniscient, and a
// narrow window still works. happy-dom has no WebGL, so the canvas is replaced by its notice; the
// shapes and colours are tested in geometry.test.ts and units.test.ts.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DateTime, FromSim, SimViews } from "@tc20ff/sim";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { formatMargin } from "../../../src/apps/_shared/index.ts";
import { setTopologyLoader } from "../../../src/apps/usmap/data.ts";
import type { CountyTopology } from "../../../src/apps/usmap/geometry.ts";
import UsMapApp from "../../../src/apps/usmap/UsMapApp.tsx";
import { setAppOpener } from "../../../src/links/nav.ts";
import type { SimClient } from "../../../src/sim/client.ts";
import { SimContext } from "../../../src/sim/hooks.ts";
import { SCRIPT } from "../../../src/sim/mock/fixtures/script.ts";
import { SimHost } from "../../../src/sim/mock/host.ts";
import { MOCK_PIVOT, type MockSim } from "../../../src/sim/mock/mockSim.ts";
import { SimStore } from "../../../src/sim/store.ts";
import { mockWorld } from "../../mock/common.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const topology = JSON.parse(
  readFileSync(resolve(repo, "assets/usmap/counties.topo.json"), "utf8"),
) as CountyTopology;

beforeAll(() => setTopologyLoader(async () => topology));
afterAll(() => setTopologyLoader(null));
afterEach(() => {
  cleanup();
  setAppOpener(null);
});

interface Harness {
  client: SimClient;
  views: () => SimViews;
  runTo: (t: DateTime) => void;
  omniscient: (on: boolean) => void;
}

/** The mock host behind a store, answering the app's `Want`s as the worker does. */
function harness(): Harness {
  const host = new SimHost(mockWorld(), { ...MOCK_PIVOT, debug: true });
  const store = new SimStore();
  const apply = (out: FromSim[]) => {
    for (const m of out) if (m.kind === "Frame") store.applyFrame(m);
  };
  apply(host.handle({ kind: "NewGame", id: 1, seed: 7 }));
  store.onWant = (views, slices) => apply(host.handle({ kind: "Want", views, slices }));
  const sim = host.sim as MockSim;
  let id = 10;
  return {
    client: { store } as unknown as SimClient,
    views: () => sim.views,
    runTo(t) {
      act(() => {
        while (sim.now < t) {
          sim.paused = false;
          sim.step();
          apply(host.tick(0));
        }
      });
    },
    omniscient(on) {
      act(() => apply(host.handle({ kind: "Control", id: ++id, control: { kind: "SetOmniscient", on } })));
    },
  };
}

/** The app in a fake window that keeps its route and title. */
function mount(h: Harness, start: string | null) {
  const seen = { route: start as string | null, title: null as string | null };
  function Window() {
    const [route, setRoute] = useState<string | null>(start);
    seen.route = route;
    return (
      <UsMapApp
        route={route}
        onRoute={setRoute}
        close={() => {}}
        setTitle={(t) => {
          seen.title = t;
        }}
      />
    );
  }
  const r = render(
    <SimContext.Provider value={h.client}>
      <Window />
    </SimContext.Provider>,
  );
  return { ...r, seen };
}

/** Lets the shapes load and the wants answer. */
async function settle() {
  for (let i = 0; i < 3; i++) await act(async () => {});
}

describe("the USA map app", () => {
  it("opens at home: the layers but the hidden lean, the last presidential layer, no WebGL notice", async () => {
    const h = harness();
    mount(h, null);
    await settle();
    expect(screen.getByTestId("app-root-usmap")).toBeTruthy();
    for (const l of ["president", "population", "turnout", "districts", "live"])
      expect(screen.getByTestId(`usmap-layer-${l}`)).toBeTruthy();
    expect(screen.queryByTestId("usmap-layer-lean")).toBeNull();
    expect(screen.getByTestId("usmap-no-webgl")).toBeTruthy();
    expect(screen.getByTestId("usmap-legend").textContent).toMatch(/D\+40/);
    // The mock's counties are invented: the schematic.
    expect(screen.getByText("schematic counties")).toBeTruthy();
  });

  it("a state: its numbers, officials, districts; a district link selects it in the map", async () => {
    const h = harness();
    const st = h.views().usmap_layers.data.states.find((s) => s.house_seats > 2);
    if (!st) throw new Error("no state with three seats");
    const { seen } = mount(h, `state/${st.id}`);
    await settle();
    expect(screen.getByTestId("usmap-panel-title").textContent).toBe(st.name);
    expect(seen.title).toBe(`${st.name} - USA map`);
    const d2 = st.id * 100 + 2;
    fireEvent.click(within(screen.getByTestId(`district-row-${d2}`)).getByRole("button"));
    expect(seen.route).toBe(`district/${d2}`);
    expect(screen.getByTestId("usmap-panel-title").textContent).toBe(`${st.name} 2`);
    // Back returns to the state.
    fireEvent.click(screen.getByTestId("usmap-back"));
    expect(seen.route).toBe(`state/${st.id}`);
    fireEvent.click(screen.getByTestId("usmap-forward"));
    expect(seen.route).toBe(`district/${d2}`);
  });

  it("a district: its member and races link to their apps; its counties select", async () => {
    const h = harness();
    const d = h.views().districts.data.districts.find((x) => x.member !== null && x.shares.length > 2);
    if (!d || d.member === null) throw new Error("no district");
    const opened: [string, string | null][] = [];
    setAppOpener((app, route) => opened.push([app, route]));
    const { seen } = mount(h, `district/${d.id}`);
    await settle();
    const panel = screen.getByTestId("usmap-panel");
    fireEvent.click(within(panel).getByTestId(`link-person-${d.member}`));
    fireEvent.click(within(panel).getByTestId(`link-district-${d.id}`));
    const race = h
      .views()
      .races.data.races.find((r) => r.office === "House" && r.state === d.state && r.district === d.number);
    if (!race) throw new Error("no race");
    fireEvent.click(within(panel).getByTestId(`link-race-${race.id}`));
    expect(opened).toEqual([
      ["browser", `person/${d.member}`],
      ["browser", `district/${d.id}`],
      ["polls", `race/${race.id}`],
    ]);
    const fips = h.views().usmap_layers.data.counties.fips[d.shares[0]?.county as number] as string;
    fireEvent.click(within(screen.getByTestId(`county-row-${fips}`)).getByRole("button"));
    expect(seen.route).toBe(`county/${fips}`);
  });

  it("a county: its state, district and races; a split county lists its pieces", async () => {
    const h = harness();
    const ds = h.views().districts.data.districts;
    const seen = new Map<number, number>();
    for (const d of ds) for (const s of d.shares) seen.set(s.county, (seen.get(s.county) ?? 0) + 1);
    const split = [...seen.entries()].find(([, n]) => n > 1)?.[0];
    if (split === undefined) throw new Error("no split county");
    const c = h.views().usmap_layers.data.counties;
    mount(h, `county/${c.fips[split]}`);
    await settle();
    const panel = screen.getByTestId("usmap-panel");
    expect(screen.getByTestId("usmap-panel-title").textContent).toBe(c.name[split]);
    expect(within(panel).getAllByText(/of its people/).length).toBeGreaterThan(1);
    expect(within(panel).getByTestId(`link-county-${split}`)).toBeTruthy();
    // An EntityRef's route (county/<index>) opens the same county.
    cleanup();
    mount(h, `county/${split}`);
    await settle();
    expect(screen.getByTestId("usmap-panel-title").textContent).toBe(c.name[split]);
  });

  it("election night: no returns before the polls close, then the count, the calls and a retraction", async () => {
    const h = harness();
    const { seen } = mount(h, "race/0/live");
    await settle();
    expect(screen.getByTestId("usmap-live-waiting")).toBeTruthy();
    expect(seen.title).toBe("President - USA map");
    h.runTo(SCRIPT.election_day + 22);
    await settle();
    const reported = screen.getByTestId("usmap-reporting").textContent ?? "";
    expect(reported).toMatch(/%/);
    expect(Number.parseFloat(reported)).toBeGreaterThan(0);
    expect(screen.getByTestId("usmap-candidates").querySelectorAll("tr").length).toBeGreaterThan(1);
    expect(screen.getByTestId("usmap-ec")).toBeTruthy();
    // The race picker moves to a House race, whose counties are the district's.
    h.runTo(SCRIPT.election_day + 24 * 2 + 20);
    await settle();
    const recount = h.views().returns.data.races.find((r) => r.calls.some((c) => c.retracted));
    if (!recount) throw new Error("no retraction by 5 Nov");
    fireEvent.change(screen.getByTestId("usmap-race-picker"), { target: { value: String(recount.race) } });
    expect(seen.route).toBe(`race/${recount.race}/live`);
    await settle();
    expect(screen.getByTestId("usmap-calls").querySelector(".um-retracted")).toBeTruthy();
    expect(screen.getByTestId("usmap-calls").textContent).toMatch(/retracted its call/);
  });

  it("certification moves the last presidential result the county panel shows", async () => {
    const h = harness();
    const before = h.views().usmap_layers.data.counties.last_margin.slice();
    const probe = harness();
    probe.runTo(SCRIPT.certification + 1);
    const after = probe.views().usmap_layers.data.counties;
    const i = after.last_margin.findIndex((m, k) => m !== before[k]);
    expect(i).toBeGreaterThanOrEqual(0);
    mount(h, `county/${after.fips[i]}`);
    await settle();
    const text = () => screen.getByTestId("usmap-panel").textContent ?? "";
    expect(text()).toContain(formatMargin(before[i] as number));
    h.runTo(SCRIPT.certification + 1);
    await settle();
    expect(text()).toContain(formatMargin(after.last_margin[i] as number));
  });

  it("shows the true lean only with Omniscient on", async () => {
    const h = harness();
    const d = h.views().districts.data.districts[0];
    if (!d) throw new Error("no district");
    mount(h, `district/${d.id}`);
    await settle();
    expect(screen.queryByTestId("usmap-hidden-lean")).toBeNull();
    expect(screen.queryByTestId("usmap-layer-lean")).toBeNull();
    h.omniscient(true);
    await settle();
    expect(screen.getByTestId("usmap-hidden-lean")).toBeTruthy();
    expect(screen.getByTestId("usmap-layer-lean")).toBeTruthy();
    fireEvent.click(screen.getByTestId("usmap-layer-lean"));
    h.omniscient(false);
    await settle();
    expect(screen.queryByTestId("usmap-hidden-lean")).toBeNull();
    // The route still names the lean, but the layer falls back to the default.
    expect(screen.getByTestId("usmap-layer-president").getAttribute("aria-selected")).toBe("true");
  });

  it("works in a narrow window", async () => {
    const h = harness();
    const st = h.views().usmap_layers.data.states[0];
    if (!st) throw new Error("no state");
    const { container } = render(
      <div style={{ width: "480px", height: "360px" }}>
        <SimContext.Provider value={h.client}>
          <UsMapApp
            route={`race/0/live/state/${st.id}`}
            onRoute={() => {}}
            close={() => {}}
            setTitle={() => {}}
          />
        </SimContext.Provider>
      </div>,
    );
    await settle();
    expect(within(container).getByTestId("usmap-panel")).toBeTruthy();
    expect(within(container).getByTestId("usmap-live")).toBeTruthy();
    expect(within(container).getByTestId("usmap-race-picker")).toBeTruthy();
  });
});
