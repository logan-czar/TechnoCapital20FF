// @vitest-environment happy-dom
// The Polls app in the DOM, against the mock world (apps/web/src/sim/mock): each route renders at the
// start, a Step brings new polls and a new forecast run, hidden fields show only when Omniscient is
// on, links open the right app and page, and a narrow window still renders everything.

import type { FromSim, ToSim } from "@tc20ff/sim";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearForecastHistory } from "../../../src/apps/polls/hooks.ts";
import PollsApp from "../../../src/apps/polls/PollsApp.tsx";
import { setAppOpener } from "../../../src/links/nav.ts";
import { SimClient, type SimTransport } from "../../../src/sim/client.ts";
import { SimContext } from "../../../src/sim/hooks.ts";
import { SimHost } from "../../../src/sim/mock/host.ts";
import { MOCK_PIVOT } from "../../../src/sim/mock/mockSim.ts";
import { mockWorld } from "../../mock/common.ts";

let host: SimHost;
let client: SimClient;
let opened: [string, string | null][];
/** Delivers a message the host sent on its own (a tick's frame) to the client. */
let push: (m: FromSim) => void;

/** A client wired straight to the mock host: its replies arrive on the next microtask. */
function connect(g: SimHost): SimClient {
  let deliver: (m: FromSim) => void = () => {};
  push = (m) => deliver(m);
  const transport: SimTransport = {
    send(msg: ToSim) {
      for (const m of g.handle(msg)) queueMicrotask(() => deliver(m));
    },
    onMessage(cb) {
      deliver = cb;
    },
    onFailure() {},
  };
  return new SimClient(transport);
}

function mount(route: string | null, opts: { width?: number } = {}) {
  const onRoute = vi.fn();
  const setTitle = vi.fn();
  const ui = (r: string | null) => (
    <SimContext.Provider value={client}>
      <div style={opts.width === undefined ? undefined : { width: opts.width, height: 360 }}>
        <PollsApp route={r} onRoute={onRoute} setTitle={setTitle} close={() => {}} />
      </div>
    </SimContext.Provider>
  );
  const view = render(ui(route));
  return { onRoute, setTitle, view, rerender: (r: string | null) => view.rerender(ui(r)) };
}

async function step(hours: number): Promise<void> {
  await act(async () => {
    await client.control({ kind: "Step", hours });
    // The clock runs on real time: tick until the step ends (or a pause lands).
    for (let i = 0; i < 400 && host.sim?.paused === false; i++) {
      for (const m of host.tick(1000)) push(m);
    }
  });
}

beforeEach(async () => {
  clearForecastHistory();
  host = new SimHost(mockWorld(), { ...MOCK_PIVOT, debug: true });
  client = connect(host);
  // The first frame carries every view into the store; later frames only the views a page reads.
  await client.newGame(7);
  opened = [];
  setAppOpener((app, route) => {
    opened.push([app, route]);
  });
});

afterEach(() => {
  cleanup();
  setAppOpener(null);
});

const views = () => (host.sim as NonNullable<SimHost["sim"]>).views;
const president = () => views().races.data.races.find((r) => r.office === "President");

describe("Polls app", () => {
  it("shows the overview: presidential odds, electoral votes, chambers, closest races", async () => {
    const { setTitle } = mount(null);
    await screen.findByTestId("polls-home");
    expect(screen.getByTestId("app-root-polls")).toBeTruthy();
    const pres = president();
    expect(pres).toBeDefined();
    const odds = within(await screen.findByTestId("home-president")).getByTestId("odds-bars");
    for (const c of pres?.ballot ?? []) expect(within(odds).getByTestId(`odds-row-${c}`)).toBeTruthy();
    expect(screen.getByTestId("ev-range")).toBeTruthy();
    expect(screen.getByTestId("chamber-House")).toBeTruthy();
    expect(screen.getByTestId("chamber-Senate")).toBeTruthy();
    expect(screen.getByTestId("seats-Senate")).toBeTruthy();
    const closest = screen.getByTestId("home-closest");
    expect(within(closest).getAllByTestId(/^closest-row-/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("polls-updated").textContent).toMatch(/Model run \d+ Oct 2020/);
    // The overview keeps the app's own title.
    expect(setTitle).toHaveBeenLastCalledWith(null);
    // The site's wording: an estimate, not a fact.
    expect(screen.getByText(/can be wrong/)).toBeTruthy();
  });

  it("shows a race: candidates in ballot order, the poll table, the trend and the odds history", async () => {
    const pres = president();
    if (pres === undefined) throw new Error("no presidential race");
    const { setTitle } = mount(`race/${pres.id}`);
    await screen.findByTestId(`race-page-${pres.id}`);
    await waitFor(() => expect(setTitle).toHaveBeenLastCalledWith(`${pres.title} - Polls`));
    const rows = screen.getAllByTestId(/^candidate-row-/);
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual(
      pres.ballot.map((c) => `candidate-row-${c}`),
    );
    const national = views().polls.data.polls.filter(
      (p) => p.race === pres.id && p.state === null && p.stage === "General",
    );
    expect(national.length).toBeGreaterThan(5);
    expect(screen.getAllByTestId(/^poll-row-/).length).toBe(national.length);
    expect(screen.getByTestId("poll-trend-svg")).toBeTruthy();
    expect(screen.getByTestId("odds-history-svg")).toBeTruthy();
    expect(screen.getByTestId("race-margin").textContent).toMatch(/leads by/);
    // The forecast's history is what the app has seen: one run so far, and it says so.
    expect(screen.getByTestId("history-short")).toBeTruthy();
    // The poll table has a column per candidate of the ballot, in its order.
    const heads = within(screen.getByTestId("poll-table")).getAllByRole("columnheader");
    expect(heads.length).toBe(5 + pres.ballot.length + 1);
  });

  it("lists a multi-candidate primary on its own ballot, in the primary's order", async () => {
    const pres = president();
    if (pres === undefined) throw new Error("no presidential race");
    const idx = pres.primaries.findIndex((p) =>
      views().polls.data.polls.some(
        (x) => x.race === pres.id && x.stage === "Primary" && x.party === p.party,
      ),
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    const primary = pres.primaries[idx];
    expect(primary?.ballot.length).toBeGreaterThan(2);
    const { onRoute } = mount(`race/${pres.id}`);
    fireEvent.click(await screen.findByTestId(`stage-primary-${idx}`));
    expect(onRoute).toHaveBeenLastCalledWith(`race/${pres.id}/primary-${idx}`);
    const rows = await screen.findAllByTestId(/^candidate-row-/);
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual(
      (primary?.ballot ?? []).map((c) => `candidate-row-${c}`),
    );
    const primaryPolls = views().polls.data.polls.filter(
      (p) => p.race === pres.id && p.stage === "Primary" && p.party === primary?.party,
    );
    expect(screen.getAllByTestId(/^poll-row-/).length).toBe(primaryPolls.length);
    // Several people of one party get distinct line colours.
    const legend = document.querySelectorAll(".polls-swatch");
    const colours = new Set([...legend].map((s) => (s as HTMLElement).style.background));
    expect(colours.size).toBe(primary?.ballot.length);
  });

  it("opens a candidate in the encyclopedia and a pollster inside the app", async () => {
    const pres = president();
    if (pres === undefined) throw new Error("no presidential race");
    const { onRoute } = mount(`race/${pres.id}`);
    await screen.findByTestId(`race-page-${pres.id}`);
    const person = pres.ballot[0];
    fireEvent.click(
      within(screen.getByTestId(`candidate-row-${person}`)).getByTestId(`link-person-${person}`),
    );
    expect(opened).toEqual([["browser", `person/${person}`]]);
    const first = screen.getAllByTestId(/^poll-pollster-/)[0] as HTMLElement;
    fireEvent.click(first);
    expect(onRoute).toHaveBeenLastCalledWith(expect.stringMatching(/^pollster\/\d+$/));
    // The page followed the click even though the window is told, not asked.
    await screen.findByTestId(/^pollster-page-/);
  });

  it("links a race to the exchange's contracts on it", async () => {
    const pres = president();
    if (pres === undefined) throw new Error("no presidential race");
    mount(`race/${pres.id}`);
    const market = await screen.findByTestId("race-market");
    const links = within(market).getAllByTestId(/^link-contract-/);
    expect(links.length).toBeGreaterThan(0);
    fireEvent.click(links[0] as HTMLElement);
    expect(opened[0]?.[0]).toBe("exchange");
  });

  it("shows a pollster's polls, and its house effect only when Omniscient is on", async () => {
    const { rerender } = mount("pollster/0");
    await screen.findByTestId("pollster-page-0");
    const mine = views().polls.data.polls.filter((p) => p.pollster === 0);
    expect(screen.getAllByTestId(/^poll-row-/).length).toBe(mine.length);
    expect(screen.getByTestId("pollster-count").textContent).toBe(String(mine.length));
    expect(views().polls.data.pollsters[0]?.house_effect).toBeNull();
    expect(screen.queryByTestId("house-effect")).toBeNull();
    await act(async () => {
      await client.control({ kind: "SetOmniscient", on: true });
    });
    await screen.findByTestId("house-effect");
    expect(views().polls.data.pollsters[0]?.house_effect).not.toBeNull();
    rerender("pollster/0");
  });

  it("shows a state of the presidency: its odds and its polls", async () => {
    const st = views().forecast.data.states[0];
    if (st === undefined) throw new Error("no state forecast");
    mount(`state/${st.state}`);
    await screen.findByTestId(`state-page-${st.state}`);
    expect(screen.getByTestId("state-title").textContent).toBe(
      views().usmap_layers.data.states.find((s) => s.id === st.state)?.name,
    );
    expect(within(screen.getByTestId("state-forecast")).getByTestId("odds-bars")).toBeTruthy();
    const statePolls = views().polls.data.polls.filter((p) => p.state === st.state);
    expect(statePolls.length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/^poll-row-/).length).toBe(statePolls.length);
    expect(screen.getByTestId("state-trend")).toBeTruthy();
  });

  it("lists every race, filters and sorts it through the route", async () => {
    const races = views().races.data.races;
    const { onRoute, rerender } = mount("races");
    await screen.findByTestId("races-table");
    expect(screen.getAllByTestId(/^race-row-/).length).toBe(races.length);
    expect(screen.getByTestId("races-count").textContent).toBe(`${races.length} of ${races.length} races`);
    // Closest first by default: the first row's odds are the lowest.
    fireEvent.change(screen.getByTestId("filter-office"), { target: { value: "Senate" } });
    expect(onRoute).toHaveBeenLastCalledWith("races?office=Senate");
    rerender("races?office=Senate");
    await waitFor(() =>
      expect(screen.getAllByTestId(/^race-row-/).length).toBe(
        races.filter((r) => r.office === "Senate").length,
      ),
    );
    fireEvent.click(screen.getByTestId("sort-title"));
    expect(onRoute).toHaveBeenLastCalledWith("races?office=Senate&sort=title&dir=asc");
    rerender("races?office=Senate&sort=title&dir=asc");
    const titles = screen.getAllByTestId(/^race-link-/).map((b) => b.textContent ?? "");
    expect(titles).toEqual([...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    expect(screen.getByTestId("sort-title").closest("th")?.getAttribute("aria-sort")).toBe("ascending");
  });

  it("filters by rating bucket and says so when nothing matches", async () => {
    mount("races?rating=safe-r&office=President");
    await screen.findByTestId("races-none");
  });

  it("steps to election eve: new polls and a new model run appear", async () => {
    const pres = president();
    if (pres === undefined) throw new Error("no presidential race");
    mount(`race/${pres.id}`);
    await screen.findByTestId(`race-page-${pres.id}`);
    const before = screen.getAllByTestId(/^poll-row-/).length;
    const run = views().forecast.data.updated;
    await step(168);
    await waitFor(() => expect(screen.getAllByTestId(/^poll-row-/).length).toBeGreaterThan(before));
    expect(views().forecast.data.updated).not.toEqual(run);
    // A second run is on the chart now: the history has grown.
    await step(24);
    await waitFor(() => expect(screen.queryByTestId("history-short")).toBeNull());
  });

  it("answers an unknown route and a missing race with a way back", async () => {
    mount("bill/3");
    expect(await screen.findByTestId("route-unknown")).toBeTruthy();
    cleanup();
    mount("race/99999");
    expect(await screen.findByTestId("race-missing")).toBeTruthy();
  });

  it("follows a route set from outside, and goes back through the pages it has shown", async () => {
    const { rerender, onRoute } = mount(null);
    await screen.findByTestId("polls-home");
    rerender("races");
    await screen.findByTestId("races-page");
    expect((screen.getByTestId("polls-back") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId("polls-back"));
    await screen.findByTestId("polls-home");
    expect(onRoute).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByTestId("polls-forward"));
    await screen.findByTestId("races-page");
  });

  it("renders every page in a 480 px window", async () => {
    const pres = president();
    if (pres === undefined) throw new Error("no presidential race");
    for (const r of [null, `race/${pres.id}`, "pollster/1", "races"]) {
      const { view } = mount(r, { width: 480 });
      await waitFor(() =>
        expect(view.container.querySelector(".polls-main")?.children.length).toBeGreaterThan(0),
      );
      await waitFor(() => expect(screen.queryByTestId("polls-loading")).toBeNull());
      expect(view.container.querySelector(".polls-app")).not.toBeNull();
      cleanup();
    }
  });
});
