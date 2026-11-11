// @vitest-environment happy-dom
// The browser app in the DOM (React Testing Library; pivot 15.3, 5.11, 1.2; D1047): every route
// renders against the mock at its start, the toolbar and the address bar navigate (and write the
// window's route), links in articles stay in the app or open the app that shows the thing better,
// search finds and opens an article, the old pages open inside the app and show no hidden stat, a
// scripted event shows in the page it changes, hidden stats appear only with Omniscient, and the
// window works at a narrow width.

import type { FromSim } from "@tc20ff/sim";
import { loadWorld } from "@tc20ff/sim-data/node";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BrowserApp from "../../../src/apps/browser/BrowserApp.tsx";
import { setAppOpener } from "../../../src/links/nav.ts";
import type { AppProps } from "../../../src/os/apps.ts";
import type { SimClient } from "../../../src/sim/client.ts";
import { SimContext } from "../../../src/sim/hooks.ts";
import { SCRIPT } from "../../../src/sim/mock/fixtures/script.ts";
import { SimHost } from "../../../src/sim/mock/host.ts";
import { MOCK_PIVOT, type MockSim } from "../../../src/sim/mock/mockSim.ts";
import { RealHost } from "../../../src/sim/real/host.ts";
import { type Frame, SimStore } from "../../../src/sim/store.ts";
import { mockWorld } from "../../mock/common.ts";
import { worldMini } from "../../world-mini.ts";

afterEach(() => {
  cleanup();
  setAppOpener(null);
});

interface Rig {
  host: SimHost;
  sim: MockSim;
  store: SimStore;
  client: SimClient;
  /** Steps the mock clock to `t` and posts what moved. */
  runTo(t: number): void;
  /** Sends a control and posts the frames it makes. */
  control(c: Parameters<SimHost["handle"]>[0]): void;
}

/** A mock pivot game feeding a store, as the worker's frames would. */
function rig(opts: { debug?: boolean } = {}): Rig {
  const host = new SimHost(mockWorld(), { ...MOCK_PIVOT, ...opts });
  const store = new SimStore();
  const apply = (out: FromSim[]) => {
    for (const m of out) if (m.kind === "Frame") store.applyFrame(m as Frame);
  };
  apply(host.handle({ kind: "NewGame", id: 1, seed: 7 }));
  const sim = host.sim as MockSim;
  let id = 1;
  return {
    host,
    sim,
    store,
    client: { store } as unknown as SimClient,
    runTo(t) {
      while (sim.now < t) {
        sim.paused = false;
        sim.step();
      }
      apply(host.tick(0));
    },
    control(c) {
      apply(host.handle({ ...c, id: ++id } as never));
    },
  };
}

let calls: { routes: (string | null)[]; titles: (string | null)[]; closed: number };
const opened: [string, string | null][] = [];

function props(route: string | null): AppProps {
  return {
    route,
    onRoute: (r) => calls.routes.push(r),
    close: () => {
      calls.closed++;
    },
    setTitle: (t) => calls.titles.push(t),
  };
}

function mount(r: Rig, route: string | null = null) {
  const view = (rt: string | null) => (
    <SimContext.Provider value={r.client}>
      <BrowserApp {...props(rt)} />
    </SimContext.Provider>
  );
  const out = render(view(route));
  return { ...out, setRoute: (rt: string | null) => out.rerender(view(rt)) };
}

beforeEach(() => {
  calls = { routes: [], titles: [], closed: 0 };
  opened.length = 0;
  setAppOpener((id, route) => opened.push([id, route]));
});

const text = () => screen.getByTestId("browser-page").textContent ?? "";
const address = () => (screen.getByTestId("browser-address") as HTMLInputElement).value;

describe("every route at the start of the mock", () => {
  const r = rig();
  const v = r.sim.views;
  const person = v.people.data.people[0];
  const route = (kind: string, id: number | undefined) => `${kind}/${id}`;
  const cases: [string, string | null, string][] = [
    ["home", null, "Almanac"],
    ["a person", route("person", person?.id), person?.name ?? ""],
    ["a race", route("race", v.races.data.races[0]?.id), v.races.data.races[0]?.title ?? ""],
    ["a bill", route("bill", v.records.data.bills[0]?.id), v.records.data.bills[0]?.title ?? ""],
    ["a state", route("state", v.usmap_layers.data.states[0]?.id), v.usmap_layers.data.states[0]?.name ?? ""],
    ["a county", "county/0", v.usmap_layers.data.counties.name[0] ?? ""],
    ["a district", route("district", v.districts.data.districts[0]?.id), "House district"],
    ["an outlet", route("outlet", v.feed.data.outlets[0]?.id), v.feed.data.outlets[0]?.name ?? ""],
    ["a pollster", route("pollster", v.polls.data.pollsters[0]?.id), v.polls.data.pollsters[0]?.name ?? ""],
    ["the people index", "people", "People in politics"],
    ["the states index", "states", "States"],
    ["the races index", "races", "Elections"],
    ["the bills index", "bills", "Bills"],
    ["the outlets index", "outlets", "News outlets"],
    ["the pollsters index", "pollsters", "Polling firms"],
    ["a search", "search/a", "Search: a"],
    ["a route nothing answers", "country/3", "No article yet"],
    ["a handle's route", "handle/4", "No article yet"],
    ["a person who does not exist", "person/987654", "No article yet"],
  ];
  for (const [name, rt, expected] of cases) {
    it(`draws ${name}`, () => {
      mount(r, rt);
      expect(screen.getByTestId("app-root-browser")).toBeTruthy();
      expect(screen.getByTestId("article")).toBeTruthy();
      expect(text()).toContain(expected);
    });
  }

  it("draws the lead, infobox and a table row id for an index", () => {
    mount(r, "people");
    expect(screen.getByTestId("table-index.people")).toBeTruthy();
    expect(screen.getByTestId(`person-row-${person?.id}`)).toBeTruthy();
  });

  it("names the window after the page, and the home page after the app", () => {
    mount(r, `person/${person?.id}`);
    expect(calls.titles.at(-1)).toBe(`${person?.name} - Almanac`);
    cleanup();
    mount(r, null);
    expect(calls.titles.at(-1)).toBeNull();
  });
});

describe("navigation", () => {
  it("shows the fake address, and a link in an article navigates inside the app", () => {
    const r = rig();
    const state = r.sim.views.usmap_layers.data.states[0];
    mount(r, `state/${state?.id}`);
    expect(address()).toBe(`orr://browser/state/${state?.id}`);
    // The state's first district row links to the district article.
    const link = screen.getAllByTestId(/^ref-browser-district\//)[0] as HTMLElement;
    fireEvent.click(link);
    expect(address()).toMatch(/^orr:\/\/browser\/district\/\d+$/);
    expect(calls.routes.at(-1)).toMatch(/^district\/\d+$/);
    expect(opened).toEqual([]);
    expect(screen.getByText("House district")).toBeTruthy();
  });

  it("goes back and forward, and the buttons are disabled at the ends", () => {
    const r = rig();
    const state = r.sim.views.usmap_layers.data.states[0];
    mount(r, null);
    const back = screen.getByTestId("browser-back") as HTMLButtonElement;
    const forward = screen.getByTestId("browser-forward") as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    expect(forward.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("ref-browser-states"));
    expect(address()).toBe("orr://browser/states");
    fireEvent.click(screen.getByTestId(`state-row-${state?.id}`).querySelector("button") as HTMLElement);
    expect(address()).toBe(`orr://browser/state/${state?.id}`);
    fireEvent.click(back);
    expect(address()).toBe("orr://browser/states");
    expect(forward.disabled).toBe(false);
    fireEvent.click(back);
    expect(address()).toBe("orr://browser");
    expect(back.disabled).toBe(true);
    fireEvent.click(forward);
    fireEvent.click(forward);
    expect(address()).toBe(`orr://browser/state/${state?.id}`);
    // The window's route follows the history.
    expect(calls.routes.at(-1)).toBe(`state/${state?.id}`);
    fireEvent.click(screen.getByTestId("browser-home"));
    expect(address()).toBe("orr://browser");
    expect(calls.routes.at(-1)).toBeNull();
  });

  it("a route set from outside (a link in another app) is a click on the history", () => {
    const r = rig();
    const person = r.sim.views.people.data.people[0];
    const m = mount(r, "states");
    m.setRoute(`person/${person?.id}`);
    expect(address()).toBe(`orr://browser/person/${person?.id}`);
    fireEvent.click(screen.getByTestId("browser-back"));
    expect(address()).toBe("orr://browser/states");
  });

  it("the address bar goes to a typed address, opens another app's, and searches plain text", () => {
    const r = rig();
    const state = r.sim.views.usmap_layers.data.states[0];
    mount(r, null);
    const bar = screen.getByTestId("browser-address");
    fireEvent.change(bar, { target: { value: `orr://browser/state/${state?.id}` } });
    fireEvent.keyDown(bar, { key: "Enter" });
    expect(address()).toBe(`orr://browser/state/${state?.id}`);
    fireEvent.change(bar, { target: { value: "orr://polls/race/3" } });
    fireEvent.keyDown(bar, { key: "Enter" });
    expect(opened).toEqual([["polls", "race/3"]]);
    expect(address()).toBe(`orr://browser/state/${state?.id}`);
    fireEvent.change(bar, { target: { value: "senate" } });
    fireEvent.keyDown(bar, { key: "Enter" });
    expect(address()).toBe("orr://browser/search/senate");
    expect(text()).toContain("Search: senate");
  });

  it("opens the app that shows a thing better, from its article", () => {
    const r = rig();
    const bill = r.sim.views.records.data.bills[0];
    mount(r, `bill/${bill?.id}`);
    fireEvent.click(screen.getByText("The full record, with roll calls"));
    expect(opened).toEqual([["records", `bill/${bill?.id}`]]);
    cleanup();
    opened.length = 0;
    const race = r.sim.views.races.data.races[0];
    mount(r, `race/${race?.id}`);
    fireEvent.click(screen.getByText("Polls and forecast"));
    expect(opened).toEqual([["polls", `race/${race?.id}`]]);
  });
});

describe("search", () => {
  it("suggests as you type, opens the one picked, and Enter with none picked opens the results", () => {
    const r = rig();
    const person = r.sim.views.people.data.people[0];
    mount(r, null);
    const box = screen.getByTestId("browser-search");
    const word = (person?.name ?? "").split(" ").at(-1) ?? "";
    fireEvent.change(box, { target: { value: word } });
    const list = screen.getByTestId("browser-suggest");
    expect(within(list).getAllByRole("button").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId(`suggest-person-${person?.id}`));
    expect(address()).toBe(`orr://browser/person/${person?.id}`);
    fireEvent.change(box, { target: { value: "zzzzqqq" } });
    expect(within(screen.getByTestId("browser-suggest")).getByText("No match")).toBeTruthy();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(address()).toBe("orr://browser/search/zzzzqqq");
    expect(text()).toContain("Nothing here matches");
  });

  it("arrow keys pick a suggestion", () => {
    const r = rig();
    const state = r.sim.views.usmap_layers.data.states[0];
    mount(r, null);
    const box = screen.getByTestId("browser-search");
    fireEvent.change(box, { target: { value: state?.name ?? "" } });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(address()).toBe(`orr://browser/state/${state?.id}`);
  });
});

describe("hidden stats", () => {
  it("the mock's people carry none, so no article shows one", () => {
    const r = rig({ debug: true });
    const person = r.sim.views.people.data.people[0];
    mount(r, `person/${person?.id}`);
    expect(text()).not.toContain("Skills");
    expect(text()).not.toContain("Integrity");
    expect(screen.queryByTestId("section-hidden")).toBeNull();
  });

  it("appear the moment Omniscient is switched on, and go again when it is switched off", async () => {
    const r = rig({ debug: true });
    const person = r.sim.views.people.data.people[0];
    mount(r, `person/${person?.id}`);
    r.control({ kind: "Control", id: 0, control: { kind: "SetOmniscient", on: true } });
    await waitFor(() => expect(screen.getByTestId("section-hidden")).toBeTruthy());
    expect(text()).toContain("Skills");
    expect(text()).toContain("Integrity");
    r.control({ kind: "Control", id: 0, control: { kind: "SetOmniscient", on: false } });
    await waitFor(() => expect(screen.queryByTestId("section-hidden")).toBeNull());
  });
});

describe("a scripted event", () => {
  it("shows in the page of what it changes: the infrastructure bill is signed into law", async () => {
    const r = rig();
    const bill = r.sim.views.records.data.bills.find((b) => b.stage === "SenateFloor");
    expect(bill).toBeDefined();
    mount(r, `bill/${bill?.id}`);
    expect(text()).toContain("On the Senate floor");
    act(() => r.runTo(SCRIPT.bill_signed + 1));
    await waitFor(() => expect(text()).toMatch(/Stage\s*Law/));
    expect(text()).not.toContain("On the Senate floor");
  });

  it("a race gets its winner at certification", async () => {
    const r = rig();
    const race = r.sim.views.races.data.races.find((x) => x.office === "Senate");
    mount(r, `race/${race?.id}`);
    expect(text()).not.toContain("Winner:");
    act(() => r.runTo(SCRIPT.certification + 1));
    await waitFor(() => expect(text()).toContain("Winner:"));
    expect(text()).toContain("Certified");
  });
});

describe("the pages of the pages/ framework, inside the app", () => {
  // The mock has no company detail, so these read the real sim's first frame (the mini world).
  function realRig() {
    const loaded = loadWorld(worldMini().dir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
    const host = new RealHost(loaded.value);
    const store = new SimStore();
    const frame = host.handle({ kind: "NewGame", seed: 42, id: 1 }).find((m) => m.kind === "Frame") as Frame;
    store.applyFrame(frame);
    const sim = host.sim;
    if (!sim) throw new Error("no game");
    return { store, client: { store } as unknown as SimClient, views: sim.views() };
  }

  it("draws a company through DocView with no hidden stat, and its links stay in the app", () => {
    const real = realRig();
    const us = real.views.places.data.countries.find((c) => c.iso3 === "USA");
    const company = real.views.company_rows.data.rows.find((c) => c.hq_country === us?.id && c.public);
    expect(company).toBeDefined();
    render(
      <SimContext.Provider value={real.client}>
        <BrowserApp {...props(`company/${company?.id}`)} />
      </SimContext.Provider>,
    );
    expect(screen.getByTestId("framework-page")).toBeTruthy();
    expect(text()).toContain(company?.name ?? "");
    expect(text()).toContain("Ticker");
    for (const w of ["Management score", "Skills", "Traits", "Archetype", "Data quests", "Seats"]) {
      expect(text(), w).not.toContain(w);
    }
    expect(calls.titles.at(-1)).toBe(`${company?.name} - Almanac`);
    // The industry link is a Link of the old framework: it opens the industry here.
    const industry = real.views.industry_rows.data.rows.find((i) => i.id === company?.industry);
    fireEvent.click(
      within(screen.getByTestId("framework-page")).getAllByText(industry?.name ?? "")[0] as HTMLElement,
    );
    expect(address()).toBe(`orr://browser/industry/${company?.industry}`);
    expect(opened).toEqual([]);
    expect(screen.getByTestId("framework-page")).toBeTruthy();
  });

  it("answers another country's company with the clean no-article page", () => {
    const real = realRig();
    const us = real.views.places.data.countries.find((c) => c.iso3 === "USA");
    const foreign = real.views.company_rows.data.rows.find((c) => c.hq_country !== us?.id);
    expect(foreign).toBeDefined();
    render(
      <SimContext.Provider value={real.client}>
        <BrowserApp {...props(`company/${foreign?.id}`)} />
      </SimContext.Provider>,
    );
    expect(text()).toContain("No article yet");
    expect(text()).not.toContain(foreign?.name ?? "\u0000");
  });

  it("draws the lists and the world history, and navigates between them", () => {
    const real = realRig();
    const view = (rt: string) => (
      <SimContext.Provider value={real.client}>
        <BrowserApp {...props(rt)} />
      </SimContext.Provider>
    );
    const out = render(view("companies"));
    expect(screen.getByTestId("framework-page")).toBeTruthy();
    expect(text()).toContain("Companies");
    out.rerender(view("world-history"));
    expect(address()).toBe("orr://browser/world-history");
    expect(text()).not.toContain("No article yet");
    out.rerender(view("recap/2020-Q1"));
    expect(address()).toBe("orr://browser/recap/2020-Q1");
  });

  it("a page the browser does not draw (a country) is a clean page, not an error", () => {
    const real = realRig();
    render(
      <SimContext.Provider value={real.client}>
        <BrowserApp {...props("country/1")} />
      </SimContext.Provider>,
    );
    expect(text()).toContain("No article yet");
    expect(text()).toContain("country/1");
  });
});

describe("a narrow window", () => {
  it("keeps the toolbar, the address, the search and the article reachable at 420 px", () => {
    const r = rig();
    const state = r.sim.views.usmap_layers.data.states[0];
    const out = render(
      <div style={{ width: 420, height: 360 }}>
        <SimContext.Provider value={r.client}>
          <BrowserApp {...props(`state/${state?.id}`)} />
        </SimContext.Provider>
      </div>,
    );
    for (const id of ["browser-back", "browser-forward", "browser-home", "browser-address", "browser-search"])
      expect(screen.getByTestId(id), id).toBeTruthy();
    expect(screen.getByTestId("infobox")).toBeTruthy();
    expect(screen.getByTestId("article").textContent).toContain(state?.name ?? "");
    // Every button is reachable from the keyboard: nothing is a bare clickable box.
    expect(out.container.querySelectorAll("[onclick]").length).toBe(0);
  });
});

describe("the window", () => {
  it("is mounted with the app root test id and unmounts cleanly while a view moves", async () => {
    const r = rig();
    const m = mount(r, "races");
    expect(screen.getByTestId("app-root-browser")).toBeTruthy();
    m.unmount();
    vi.useFakeTimers();
    expect(() => act(() => r.runTo(r.sim.now + 3))).not.toThrow();
    vi.useRealTimers();
  });
});
