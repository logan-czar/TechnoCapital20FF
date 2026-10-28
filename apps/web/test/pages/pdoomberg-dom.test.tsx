// @vitest-environment happy-dom
// Full-screen Pdoomberg in the DOM (React Testing Library): the terminal halves of
// crates/game/tests/market_pages.rs (every_function_key_opens_its_page,
// ticker_function_commands_route, right_click_load_keeps_the_page) and the News feed's pickers.
// The views come from a real game run to 20 January 2020 in-process (the worker's host), and
// controls go through the same host, so a watch click really moves v_clock's watchlist (D975).
// The models themselves (rows, bands, filters) are checked in market.test.ts.
//
// The virtualizer measures its scroll box (clientHeight); happy-dom has no layout, so every box reports a fixed
// size here and the first rows render. The chart block (lightweight-charts, a canvas) is a stub
// that prints its model's title and slot count.

import type { CompanyId, ToSim } from "@tc20ff/sim";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SettingsContext } from "../../src/config/hooks.ts";
import { SettingsStore } from "../../src/config/settings.ts";
import { buildNameIndex, type NameIndex } from "../../src/links/names.ts";
import type { ChartModel } from "../../src/pages/doc.ts";
import { PageBody } from "../../src/pages/PagePane.tsx";
import { setProvinceKeys } from "../../src/pages/ref.ts";
import { type ViewsData, viewsData } from "../../src/pages/views.ts";
import { DEFAULT_ROUTE, type PdoombergRoute, READ_ONLY_LOCK } from "../../src/pdoomberg/models.ts";
import { Pdoomberg } from "../../src/pdoomberg/Pdoomberg.tsx";
import { buildEntries, makeFuse, search } from "../../src/shell/CommandBar.tsx";
import type { SimClient } from "../../src/sim/client.ts";
import { SimContext } from "../../src/sim/hooks.ts";
import { RealHost } from "../../src/sim/real/host.ts";
import { type Frame, SimStore } from "../../src/sim/store.ts";

vi.mock("../../src/pages/ChartBlock.tsx", () => ({
  ChartBlock: ({ chart }: { chart: ChartModel }) => (
    <div data-testid="chart">
      {chart.title} ({chart.labels.length})
    </div>
  ),
}));

/** Ticks to 20 January 2020 00:00 (market_pages ticker_function_commands_route). */
const TICKS = 19 * 24;

let host: RealHost;
let store: SimStore;
let views: () => ViewsData;
let index: () => NameIndex;
let nextId = 100;

function send(msg: ToSim): void {
  for (const m of host.handle(msg)) if (m.kind === "Frame") store.applyFrame(m as Frame);
}

const rect = HTMLElement.prototype.getBoundingClientRect;
const sizes = ["clientWidth", "clientHeight"].map(
  (k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)] as const,
);

beforeAll(() => {
  const loaded = loadWorld(defaultDataDir());
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  host = new RealHost(loaded.value);
  store = new SimStore();
  send({ kind: "NewGame", seed: 42, id: 1 });
  const sim = host.sim;
  if (!sim) throw new Error("no game");
  for (let i = 0; i < TICKS; i++) sim.step();
  // A control posts a frame with every view that moved since the first.
  send({ kind: "Control", id: 2, control: { kind: "Pause" } });
  views = () => viewsData(sim.views());
  index = () => buildNameIndex(views());
  HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 600,
    right: 1600,
    width: 1600,
    height: 600,
    toJSON: () => ({}),
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1600 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 600 });
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = rect;
  for (const [k, d] of sizes) if (d) Object.defineProperty(HTMLElement.prototype, k, d);
  setProvinceKeys(null);
});

afterEach(() => cleanup());

const client = () =>
  ({
    store,
    control: vi.fn(async (control) => {
      send({ kind: "Control", id: nextId++, control });
      return { kind: "Ok", notices: [] };
    }),
  }) as unknown as SimClient;

interface Term {
  route: () => PdoombergRoute;
  onClose: ReturnType<typeof vi.fn>;
  onOpenPage: ReturnType<typeof vi.fn>;
  sim: SimClient;
  setRoute: (r: PdoombergRoute) => void;
}

/** The terminal open on `initial`, its route held as App holds it. */
function terminal(initial: PdoombergRoute = DEFAULT_ROUTE): Term {
  let current = initial;
  let set: (r: PdoombergRoute) => void = () => {};
  const t: Term = {
    route: () => current,
    onClose: vi.fn(),
    onOpenPage: vi.fn(),
    sim: client(),
    setRoute: (r) => act(() => set(r)),
  };
  function Harness() {
    const [route, setRoute] = useState(initial);
    current = route;
    set = setRoute;
    return <Pdoomberg route={route} onRoute={setRoute} onOpenPage={t.onOpenPage} onClose={t.onClose} />;
  }
  render(
    <SimContext.Provider value={t.sim}>
      <SettingsContext.Provider value={new SettingsStore(null)}>
        <Harness />
      </SettingsContext.Provider>
    </SimContext.Provider>,
  );
  return t;
}

const key = (k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
  });
const area = () => document.querySelector(".pdb-area") as HTMLElement;
const commandLine = () => document.querySelector(".pdb-command")?.textContent ?? "";
const security = () => document.querySelector(".pdb-security")?.textContent ?? "";
const table = (id: string) => document.querySelector(`[data-table="${id}"]`) as HTMLElement | null;
const rows = (id: string) => [...(table(id)?.querySelectorAll(".tr") ?? [])] as HTMLElement[];

/** The company of a rendered row: its name link's text, looked up in the index. */
function rowCompanyName(row: HTMLElement): string {
  return row.querySelectorAll(".td")[1]?.textContent ?? "";
}

describe("Pdoomberg (pdoomberg/; crates/game/src/pdoomberg)", () => {
  it("every function key opens its page, only while the terminal is open; F4 holds only the lock (market_pages every_function_key_opens_its_page)", () => {
    // Closed, the terminal is not mounted: an F-key has no listener and changes nothing (D517).
    const t = terminal();
    expect(t.route().function).toBe("F2");
    expect(table("pdb.f2")).not.toBeNull();
    for (const [k, id] of [
      ["F3", null],
      ["F4", null],
      ["F5", "pdb.f5"],
      ["F6", "pdb.f6"],
      ["F7", "pdb.f7.zones"],
      ["F9", "pdb.f9"],
      ["F10", "pdb.f10"],
      ["F2", "pdb.f2"],
    ] as const) {
      key(k);
      expect(t.route().function).toBe(k);
      expect(commandLine()).toContain(k);
      if (id) {
        expect(table(id), id).not.toBeNull();
        expect(rows(id).length, `${id} has rows`).toBeGreaterThan(0);
      }
      if (k === "F4") expect(area().textContent).toBe(READ_ONLY_LOCK);
      if (k === "F7")
        for (const s of ["pdb.f7.sovereigns", "pdb.f7.ratings"]) expect(table(s), s).not.toBeNull();
    }
    // The key row is clickable too.
    fireEvent.click(screen.getByRole("button", { name: "F6 RATINGS" }));
    expect(t.route().function).toBe("F6");
    expect(screen.getByRole("button", { name: "F6 RATINGS" }).getAttribute("aria-pressed")).toBe("true");
    // F9 has the 42 industries (its rows render up to the box's height).
    key("F9");
    expect(rows("pdb.f9").length).toBeGreaterThan(10);
    // A chord, or a key while a text field has the keyboard, does nothing.
    key("F5", { ctrlKey: true });
    expect(t.route().function).toBe("F9");
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    key("F5");
    expect(t.route().function).toBe("F9");
    input.remove();
    // ESC MAP leaves the terminal.
    fireEvent.click(screen.getByRole("button", { name: "ESC MAP" }));
    expect(t.onClose).toHaveBeenCalled();
    cleanup();
    key("F5");
    expect(t.route().function, "unmounted: no listener").toBe("F9");
  });

  it("TICKER Fn opens Pdoomberg on that company; F3 draws daily and 10-year charts over the EFV band (market_pages ticker_function_commands_route)", async () => {
    const v = views();
    const ix = index();
    const r = v.company_rows?.rows.find(
      (x) => x.public && x.ticker !== "" && v.quotes?.rows.some((q) => q.id === x.id),
    );
    if (!r) throw new Error("a quoted company");
    const entries = buildEntries(ix);
    const fuse = makeFuse(entries);
    const [first] = search(fuse, entries, `${r.ticker} F3`, ix);
    expect(first?.target).toEqual({ kind: "pdoomberg", route: { function: "F3", company: r.id } });
    expect(first?.label).toBe(`${r.ticker} F3 Chart`);
    // A bare function, PDB, the SCRN mnemonic, and a name that is not a ticker.
    expect(search(fuse, entries, "f5", ix)[0]?.target).toEqual({
      kind: "pdoomberg",
      route: { function: "F5", company: null },
    });
    expect(search(fuse, entries, "PDB", ix)[0]?.target).toEqual({
      kind: "pdoomberg",
      route: { function: "F2", company: null },
    });
    expect(search(fuse, entries, `${r.ticker} SCRN`, ix)[0]?.target).toEqual({
      kind: "pdoomberg",
      route: { function: "F10", company: r.id },
    });
    const byName = search(fuse, entries, `${r.name.split(" ")[0]} F3`, ix).filter(
      (e) => e.group === "Pdoomberg",
    );
    expect(byName.length).toBeGreaterThan(0);
    expect(byName.every((e) => e.target.kind === "pdoomberg" && e.target.route.company !== null)).toBe(true);
    // The route opens on its page: the command line, the security line and the two charts.
    const t = terminal({ function: "F3", company: r.id });
    expect(commandLine()).toContain(`${r.ticker} F3`);
    expect(security().startsWith(r.ticker)).toBe(true);
    expect(area().textContent).toContain("never shown");
    const charts = await screen.findAllByTestId("chart");
    expect(charts.length, "daily and 10-year charts").toBe(2);
    for (const c of charts) {
      expect(c.textContent).toContain("EFV band");
      expect(c.textContent).not.toContain("(0)");
    }
    // Every other function, on the same company.
    for (const f of ["F5", "F10"] as const) {
      t.setRoute({ function: f, company: r.id });
      expect(commandLine()).toContain(`${r.ticker} ${f}`);
      expect(table(`pdb.${f.toLowerCase()}`)).not.toBeNull();
    }
    // A right-click on an F10 row loads that company.
    const row = rows("pdb.f10")[7];
    if (!row) throw new Error("an F10 row");
    const name = rowCompanyName(row);
    fireEvent.contextMenu(row);
    const loaded = t.route().company;
    expect(loaded).not.toBe(r.id);
    expect(ix.title({ kind: "company", id: loaded as CompanyId })).toBe(name);
    // A link opens its page in the workspace and leaves the terminal (D517).
    const link = within(row).getAllByRole("button")[0] as HTMLElement;
    fireEvent.click(link);
    expect(t.onClose).toHaveBeenCalled();
    expect(t.onOpenPage).toHaveBeenCalledWith({ kind: "company", id: loaded }, "focused");
  });

  it("a right-click load on F10 keeps the page (market_pages right_click_load_keeps_the_page)", () => {
    const t = terminal({ function: "F10", company: null });
    const before = table("pdb.f10");
    fireEvent.click(screen.getByRole("button", { name: /Public:/ }));
    fireEvent.click(screen.getByRole("option", { name: "Listed" }));
    const shown = rows("pdb.f10").map(rowCompanyName);
    expect(shown.length).toBeGreaterThan(0);
    let loaded: CompanyId | null = null;
    for (const i of [0, 1]) {
      const row = rows("pdb.f10")[i];
      if (!row) throw new Error("a row");
      fireEvent.contextMenu(row);
      const id = t.route().company;
      expect(id, `row ${i} loaded`).not.toBeNull();
      expect(id, "the loaded company changed").not.toBe(loaded);
      loaded = id;
      // The same page and filter: the table was not rebuilt, still filtered.
      expect(table("pdb.f10")).toBe(before);
      expect(screen.getByRole("button", { name: /Public:/ }).textContent).toContain("Listed");
      expect(rows("pdb.f10").map(rowCompanyName)).toEqual(shown);
      const ticker = views().company_rows?.rows.find((x) => x.id === id)?.ticker ?? "?";
      expect(security().startsWith(ticker)).toBe(true);
    }
  });

  it("a row click on F2 watches and unwatches the company (M7.8, D975)", async () => {
    const t = terminal();
    const row = rows("pdb.f2")[0];
    if (!row) throw new Error("an F2 row");
    const name = rowCompanyName(row);
    const id = index().entries.find((e) => e.page.kind === "company" && e.name === name)?.page;
    if (id?.kind !== "company") throw new Error("the row's company");
    await act(async () => {
      fireEvent.click(row);
    });
    expect(t.sim.control).toHaveBeenLastCalledWith({ kind: "WatchlistAdd", company: id.id });
    expect(store.getView("clock")?.data.watchlist).toContain(id.id);
    // The watch column shows it, and the watchlist pick lists it.
    fireEvent.click(screen.getByRole("button", { name: /Watchlist:/ }));
    fireEvent.click(screen.getByRole("option", { name: "My watchlist" }));
    await act(async () => new Promise((r) => setTimeout(r, 600)));
    expect(rows("pdb.f2").map(rowCompanyName)).toEqual([name]);
    await act(async () => {
      fireEvent.click(rows("pdb.f2")[0] as HTMLElement);
    });
    expect(t.sim.control).toHaveBeenLastCalledWith({ kind: "WatchlistRemove", company: id.id });
    expect(store.getView("clock")?.data.watchlist).not.toContain(id.id);
  });
});

describe("the market pages in a pane", () => {
  function page(p: Parameters<typeof PageBody>[0]["page"]) {
    render(
      <SimContext.Provider value={client()}>
        <SettingsContext.Provider value={new SettingsStore(null)}>
          <PageBody page={p} />
        </SettingsContext.Provider>
      </SimContext.Provider>,
    );
  }

  it("the News feed's pickers filter its table (news.rs news_page)", () => {
    page({ kind: "news" });
    const n = views().news?.feed.length ?? 0;
    expect(
      screen.getByText(`${n} headlines, ${views().births?.events.length ?? 0} startup events`),
    ).toBeTruthy();
    const count = () => document.querySelectorAll(".table .tr").length;
    const all = count();
    expect(all).toBeGreaterThan(0);
    // Show offers the newest 500 first, then more; "All" is the whole feed.
    fireEvent.click(screen.getByRole("button", { name: /Show:/ }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All",
      "Newest 500",
      "Newest 2,000",
      "Newest 10,000",
    ]);
    fireEvent.click(screen.getByRole("option", { name: "Newest 2,000" }));
    expect(screen.getByRole("button", { name: /Show:/ }).textContent).toContain("Newest 2,000");
    fireEvent.click(screen.getByRole("button", { name: /Kind:/ }));
    fireEvent.click(screen.getByRole("option", { name: "Bankruptcies and removals" }));
    expect(count()).toBeLessThanOrEqual(all);
  });

  it("each lane B kind opens a real page", () => {
    const v = views();
    const e = v.births?.events[0];
    const h = v.news?.feed[0];
    for (const p of [
      { kind: "industries" },
      { kind: "industry", id: 3 },
      { kind: "events" },
      ...(e ? [{ kind: "event", id: e.id }] : []),
      ...(h ? [{ kind: "headline", id: h.id }] : []),
    ] as Parameters<typeof PageBody>[0]["page"][]) {
      page(p);
      expect(screen.queryByText("Not ported yet"), p.kind).toBeNull();
      cleanup();
    }
  });
});
