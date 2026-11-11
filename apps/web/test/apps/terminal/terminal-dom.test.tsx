// @vitest-environment happy-dom
// The Pdoomberg app in the DOM (pivot 15.3, 13.1, 14.1, 1.3): its routes against the mock sim at the
// start of a game, keys that work only while its window is focused, the F8 Account page, and the F4
// Order ticket round trip (place, see it fill, refusals with their reason, cancel). The mock host
// runs in-process behind a real SimClient (the worker's protocol), so an action really goes
// through `Act` and its frame comes back to the store.
//
// happy-dom has no layout: the virtual table measures a fixed box (as pdoomberg-dom.test.tsx does),
// and the chart (a canvas) is a stub. The window's focus is made up with the `data-focused`
// attribute os/Window.tsx sets.

import type { AccountView, FromSim, OrderRow, ToSim } from "@tc20ff/sim";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { usd } from "../../../src/apps/terminal/fmt.ts";
import TerminalApp from "../../../src/apps/terminal/TerminalApp.tsx";
import { SettingsContext } from "../../../src/config/hooks.ts";
import { SettingsStore } from "../../../src/config/settings.ts";
import { setAppOpener } from "../../../src/links/nav.ts";
import type { ChartModel } from "../../../src/pages/doc.ts";
import { SimClient, type SimTransport } from "../../../src/sim/client.ts";
import { SimContext } from "../../../src/sim/hooks.ts";
import { SimHost } from "../../../src/sim/mock/host.ts";
import { MOCK_PIVOT, type MockSim } from "../../../src/sim/mock/mockSim.ts";
import type { Frame } from "../../../src/sim/store.ts";
import { mockWorld } from "../../mock/common.ts";

vi.mock("../../../src/pages/ChartBlock.tsx", () => ({
  ChartBlock: ({ chart }: { chart: ChartModel }) => <div data-testid="chart">{chart.title}</div>,
}));

const rect = HTMLElement.prototype.getBoundingClientRect;
const sizes = ["clientWidth", "clientHeight"].map(
  (k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)] as const,
);
beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 600,
    right: 1200,
    width: 1200,
    height: 600,
    toJSON: () => ({}),
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1200 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 600 });
});
afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = rect;
  for (const [k, d] of sizes) if (d) Object.defineProperty(HTMLElement.prototype, k, d);
});

interface Game {
  client: SimClient;
  host: SimHost;
  /** The views each `Want` the client sent named, in order. */
  wants: string[][];
}

/** A client over an in-process mock host, with a new game started. */
async function newGame(debug = false): Promise<Game> {
  const host = new SimHost(mockWorld(), { ...MOCK_PIVOT, debug });
  const wants: string[][] = [];
  let deliver: (m: FromSim) => void = () => {};
  const transport: SimTransport = {
    send(msg: ToSim) {
      if (msg.kind === "Want") wants.push([...msg.views]);
      for (const out of host.handle(msg)) queueMicrotask(() => deliver(out));
    },
    onMessage(cb) {
      deliver = cb;
    },
    onFailure() {},
  };
  const client = new SimClient(transport);
  deliver({ kind: "Ready" });
  const r = await client.newGame(7);
  if (r.kind !== "Ok") throw new Error(JSON.stringify(r));
  return { client, host, wants };
}

interface Mounted {
  game: Game;
  routes: (string | null)[];
  titles: (string | null)[];
  setFocused: (f: boolean) => void;
  route: () => string | null;
}

/** The app in a made-up window, its route kept as the window manager keeps it. */
async function mount(initial: string | null, game?: Game, size = { w: 1200, h: 700 }): Promise<Mounted> {
  const g = game ?? (await newGame());
  const m: Mounted = {
    game: g,
    routes: [],
    titles: [],
    setFocused: () => {},
    route: () => initial,
  };
  function Window(): ReactNode {
    const [route, setRoute] = useState<string | null>(initial);
    const [focused, setFocused] = useState(true);
    m.setFocused = (f) => act(() => setFocused(f));
    m.route = () => route;
    return (
      <div data-focused={String(focused)} style={{ width: size.w, height: size.h }}>
        <TerminalApp
          route={route}
          onRoute={(r) => {
            m.routes.push(r);
            setRoute(r);
          }}
          close={() => {}}
          setTitle={(t) => m.titles.push(t)}
        />
      </div>
    );
  }
  render(
    <SimContext.Provider value={g.client}>
      <SettingsContext.Provider value={new SettingsStore(null)}>
        <Window />
      </SettingsContext.Provider>
    </SimContext.Provider>,
  );
  await act(async () => {});
  return m;
}

/** Runs the mock's clock `hours` forward and delivers the frame, as the worker's ticks would. */
async function advance(g: Game, hours: number): Promise<void> {
  const sim = g.host.sim as MockSim;
  const target = sim.now + hours;
  while (sim.now < target) {
    sim.paused = false;
    sim.step();
  }
  await act(async () => {
    for (const m of g.host.tick(0)) if (m.kind === "Frame") g.client.store.applyFrame(m as Frame);
  });
}

const account = (g: Game): AccountView => {
  const a = g.client.store.getView("account")?.data;
  if (a === undefined) throw new Error("no account view");
  return a;
};

/** A listed company that has a quote, and a second one. */
function tickers(g: Game): { id: number; ticker: string; name: string }[] {
  const rows = g.client.store.getView("company_rows")?.data.rows ?? [];
  const quoted = new Set((g.client.store.getView("quotes")?.data.rows ?? []).map((q) => q.id));
  return rows.filter((r) => r.public && r.ticker !== "" && quoted.has(r.id));
}

const key = (k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(document.body, { key: k, ...init });
  });

beforeEach(() => setAppOpener(null));
afterEach(() => {
  cleanup();
  setAppOpener(null);
});

describe("the app's pages at the start of a game", () => {
  it("opens on F2 Quotes with its root, the amber terminal and the quote table", async () => {
    const m = await mount(null);
    expect(screen.getByTestId("app-root-terminal").getAttribute("data-page")).toBe("F2");
    expect(screen.getByText("PDOOMBERG PROFESSIONAL")).toBeTruthy();
    expect(m.titles.at(-1)).toBe("Pdoomberg - Quotes");
    expect(document.querySelector('[data-table="pdb.f2"]')).not.toBeNull();
  });

  it("opens a company's chart from its ticker in the route", async () => {
    const g = await newGame();
    const t = tickers(g)[0];
    if (t === undefined) throw new Error("no quoted company");
    const m = await mount(`page/F3/${t.ticker}`, g);
    expect(m.titles.at(-1)).toBe(`Pdoomberg - Chart ${t.ticker.toUpperCase()}`);
    // The security line names the company loaded.
    expect(
      within(screen.getByTestId("app-root-terminal")).getAllByText(new RegExp(t.ticker, "i")).length,
    ).toBeGreaterThan(0);
    await waitFor(() => expect(document.querySelector(".pdb-area")?.textContent).not.toBe(""));
  });

  it("writes a function key click and a typed command into the route", async () => {
    const g = await newGame();
    const t = tickers(g)[0];
    if (t === undefined) throw new Error("no quoted company");
    const m = await mount(null, g);
    fireEvent.click(screen.getByRole("button", { name: /F5 FILINGS/ }));
    expect(m.route()).toBe("page/F5");
    const cmd = screen.getByTestId("term-command");
    fireEvent.change(cmd, { target: { value: `${t.ticker} F3` } });
    fireEvent.submit(cmd.closest("form") as HTMLFormElement);
    expect(m.route()).toBe(`page/F3/${t.ticker.toUpperCase()}`);
    // A typo says what it could not read and goes nowhere.
    fireEvent.change(cmd, { target: { value: "ZZZZZZ F3" } });
    fireEvent.submit(cmd.closest("form") as HTMLFormElement);
    expect(screen.getByTestId("term-command-error").textContent).toMatch(/ZZZZZZ/);
    expect(m.route()).toBe(`page/F3/${t.ticker.toUpperCase()}`);
  });

  it("goes back and forward through the pages it has shown", async () => {
    const m = await mount(null);
    fireEvent.click(screen.getByRole("button", { name: /F5 FILINGS/ }));
    fireEvent.click(screen.getByRole("button", { name: /F6 RATINGS/ }));
    expect(m.route()).toBe("page/F6");
    fireEvent.click(screen.getByTestId("term-back"));
    expect(m.route()).toBe("page/F5");
    fireEvent.click(screen.getByTestId("term-back"));
    expect(m.route()).toBe("page/F2");
    expect((screen.getByTestId("term-back") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("term-forward"));
    expect(m.route()).toBe("page/F5");
  });

  it("reads only the views of the page it shows", async () => {
    const g = await newGame();
    const m = await mount(null, g);
    const lastWant = () => g.wants.at(-1) ?? [];
    expect(lastWant()).not.toContain("account");
    fireEvent.click(screen.getByTestId("term-account-tab"));
    await act(async () => {});
    expect(m.route()).toBe("page/F8");
    expect(lastWant()).toContain("account");
    fireEvent.click(screen.getByRole("button", { name: /F2 QUOTES/ }));
    await act(async () => {});
    expect(lastWant()).not.toContain("account");
  });

  it("fits a window of 640 by 400: the page and its controls are all there", async () => {
    const g = await newGame();
    const t = tickers(g)[0];
    await mount(`page/F4/${t?.ticker}`, g, { w: 640, h: 400 });
    expect(screen.getByTestId("order-qty")).toBeTruthy();
    expect(screen.getByTestId("order-submit")).toBeTruthy();
    expect(screen.getByTestId("term-command")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /F\d+ / }).length).toBeGreaterThan(8);
  });
});

describe("keys belong to the focused window", () => {
  it("does nothing on F-keys while another window is focused, and leaves the OS's keys alone", async () => {
    const m = await mount(null);
    const seen: string[] = [];
    const spy = (e: KeyboardEvent) => seen.push(`${e.key}${e.defaultPrevented ? "!" : ""}`);
    window.addEventListener("keydown", spy);
    m.setFocused(false);
    await key("F5");
    await key("F8");
    await key("/");
    await key(" ", { code: "Space" });
    await key("3");
    await key(".");
    window.removeEventListener("keydown", spy);
    expect(m.routes).toEqual([]);
    expect(document.activeElement).toBe(document.body);
    // F5 (a Pdoomberg page key) was stopped before Pdoomberg's own listener; every other key went on
    // untouched, the OS's Space, 3 and . among them.
    expect(seen).toEqual(["F8", "/", " ", "3", "."]);
  });

  it("opens F5 and F8 from the keyboard while focused, and F4 back from the Account page", async () => {
    const m = await mount(null);
    await key("F5");
    expect(m.route()).toBe("page/F5");
    await key("F8");
    expect(m.route()).toBe("page/F8");
    expect(screen.getByTestId("term-account")).toBeTruthy();
    await key("F4");
    expect(m.route()).toBe("page/F4");
    // With a Ctrl chord held the terminal does not take the key.
    await key("F2", { ctrlKey: true });
    expect(m.route()).toBe("page/F4");
  });

  it("takes the keyboard for the command line on / only while focused, and not while typing", async () => {
    const m = await mount(null);
    m.setFocused(false);
    await key("/");
    expect(document.activeElement).toBe(document.body);
    m.setFocused(true);
    await key("/");
    expect(document.activeElement).toBe(screen.getByTestId("term-command"));
    // Typing in the line is typing: F-keys wait.
    fireEvent.keyDown(screen.getByTestId("term-command"), { key: "F5" });
    expect(m.route()).toBe(null);
  });

  it("sends the taskbar's keys on untouched while focused too", async () => {
    await mount(null);
    const seen: string[] = [];
    const spy = (e: KeyboardEvent) => seen.push(`${e.key}${e.defaultPrevented ? "!" : ""}`);
    window.addEventListener("keydown", spy);
    await key(" ", { code: "Space" });
    await key("2");
    await key(".");
    window.removeEventListener("keydown", spy);
    expect(seen).toEqual([" ", "2", "."]);
  });
});

describe("F8 Account", () => {
  it("shows cash by venue, positions, open orders and recent fills from v_account", async () => {
    const g = await newGame();
    await mount("page/F8", g);
    const a = account(g);
    for (const c of a.cash) {
      const row = screen.getByTestId(`account-cash-${c.venue}`);
      expect(row.textContent).toContain(c.venue);
    }
    expect(screen.getByTestId("account-net-worth").textContent).toMatch(/^\$[\d,]+\.\d\d$/);
    expect(a.positions.length).toBeGreaterThan(0);
    for (const p of a.positions) {
      const row = screen.getByTestId(`position-row-${p.instrument}`);
      expect(row.textContent).toContain(String(p.qty));
    }
    const open = a.orders.filter((o) => o.status === "Open");
    expect(open.length).toBeGreaterThan(0);
    for (const o of open) expect(screen.getByTestId(`order-row-${o.id}`)).toBeTruthy();
    expect(screen.getByTestId("account-fills").querySelectorAll("tbody tr").length).toBeGreaterThan(0);
    // A dash for what the view does not say, never a guess or a raw null.
    const text = screen.getByTestId("term-account").textContent ?? "";
    expect(text).not.toMatch(/null|undefined|NaN/);
  });

  it("shows a stock position's average cost and unrealised gain as the view states them", async () => {
    const g = await newGame();
    await mount("page/F8", g);
    const p = account(g).positions.find((x) => x.venue === "Brokerage");
    if (p === undefined) throw new Error("no stock position at the start");
    const row = screen.getByTestId(`position-row-${p.instrument}`);
    const cells = [...row.querySelectorAll("td")].map((c) => c.textContent);
    expect(cells[5]).toBe(`$${p.mark.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`);
    expect(cells[6]).toMatch(p.unrealised >= 0 ? /^\+?\$/ : /^-\$/);
  });

  it("cancels an open order and drops it from the list", async () => {
    const g = await newGame();
    await mount("page/F8", g);
    const o = account(g).orders.find((x) => x.status === "Open") as OrderRow;
    fireEvent.click(screen.getByTestId(`order-cancel-${o.id}`));
    await waitFor(() => expect(screen.queryByTestId(`order-row-${o.id}`)).toBeNull());
    expect(account(g).orders.find((x) => x.id === o.id)?.status).toBe("Cancelled");
  });

  it("links a company to its home app", async () => {
    const g = await newGame();
    await mount("page/F8", g);
    const opened: [string, string | null][] = [];
    setAppOpener((app, route) => opened.push([app, route]));
    const p = account(g).positions.find((x) => x.what.kind === "Company");
    if (p === undefined) throw new Error("no stock position");
    fireEvent.click(
      within(screen.getByTestId(`position-row-${p.instrument}`)).getByTestId(`link-company-${p.what.id}`),
    );
    expect(opened).toEqual([["browser", `company/${p.what.id}`]]);
  });

  it("shows the new state after the mock reaches a scripted event: a held contract resolves", async () => {
    const g = await newGame();
    await mount("page/F8", g);
    const before = account(g);
    const heldBefore = before.positions.map((p) => p.instrument).sort();
    // 23 October 14:00: the Interior secretary resigns and the contract the player holds resolves.
    await advance(g, 24 * 3 + 15);
    const after = account(g);
    expect(after.settlements.length).toBeGreaterThan(before.settlements.length);
    const heldAfter = after.positions.map((p) => p.instrument).sort();
    expect(heldAfter).not.toEqual(heldBefore);
    await waitFor(() => {
      const rows = [...document.querySelectorAll('[data-testid^="position-row-"]')].map((r) =>
        (r.getAttribute("data-testid") ?? "").replace("position-row-", ""),
      );
      expect(rows.sort()).toEqual(heldAfter.map(String).sort());
    });
  });
});

describe("F4 Order ticket", () => {
  async function ticket(debug = false): Promise<{ g: Game; m: Mounted; id: number; ticker: string }> {
    const g = await newGame(debug);
    const held = new Set(account(g).positions.map((p) => p.what.id));
    const t = tickers(g).find((x) => !held.has(x.id)) ?? tickers(g)[0];
    if (t === undefined) throw new Error("no quoted company");
    const m = await mount(`page/F4/${t.ticker}`, g);
    return { g, m, id: t.id, ticker: t.ticker };
  }
  const type = (testId: string, value: string) =>
    fireEvent.change(screen.getByTestId(testId), { target: { value } });
  const submit = async () => {
    await act(async () => {
      fireEvent.click(screen.getByTestId("order-submit"));
    });
  };

  it("replaces the lock: the ticket is there, with the estimate and the 5% cap", async () => {
    const { ticker } = await ticket();
    // It is drawn inside Pdoomberg's page area, where the locked page was.
    expect(document.querySelector(".pdb-area")?.contains(screen.getByTestId("term-order"))).toBe(true);
    expect((screen.getByTestId("order-ticker") as HTMLInputElement).value).toBe(ticker);
    type("order-qty", "10");
    expect(screen.getByTestId("order-estimate-total").textContent).toMatch(/^\$[\d,]+\.\d\d for 10 shares$/);
    expect(screen.getByTestId("order-cap").textContent).toMatch(
      /5% of the company: \d+ shares; you hold \d+, room for \d+/,
    );
    // Commission as the views expose it: the last brokerage fill's fee.
    expect(screen.getByTestId("order-estimate").textContent).toMatch(/\$1\.00 \(as last charged\)/);
  });

  it("buys at market: sent as PlaceOrder with the stock's instrument, filled, held and then sold", async () => {
    const { g, id } = await ticket();
    const act1 = vi.spyOn(g.client, "act");
    type("order-qty", "10");
    await submit();
    expect(act1).toHaveBeenCalledWith({
      kind: "PlaceOrder",
      venue: "Brokerage",
      instrument: 1_000_000_000 + id,
      side: "Buy",
      qty: 10,
      limit: null,
      tif: "Day",
    });
    await waitFor(() => expect(screen.getByTestId("order-result").textContent).toMatch(/^Filled 10 at \$/));
    const pos = account(g).positions.find((p) => p.instrument === 1_000_000_000 + id);
    expect(pos?.qty).toBeGreaterThanOrEqual(10);
    // The cap line now counts them.
    expect(screen.getByTestId("order-cap").textContent).toContain(`you hold ${pos?.qty}`);

    fireEvent.click(screen.getByTestId("order-side-Sell"));
    type("order-qty", "10");
    await submit();
    await waitFor(() => expect(screen.getByTestId("order-result").textContent).toMatch(/^Filled 10 at \$/));
    expect(account(g).fills.filter((f) => f.instrument === 1_000_000_000 + id).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("shows the sim's reason when it refuses: more than is held, not enough cash, a limit that cannot fill", async () => {
    const { g, id } = await ticket();
    // Long only: this company is not held.
    fireEvent.click(screen.getByTestId("order-side-Sell"));
    type("order-qty", "5");
    expect(screen.getByTestId("order-warning").textContent).toMatch(/long only/);
    await submit();
    await waitFor(() => expect(screen.getByTestId("order-refused").textContent).toMatch(/long only/));

    fireEvent.click(screen.getByTestId("order-side-Buy"));
    type("order-qty", "100000000");
    await submit();
    await waitFor(() => expect(screen.getByTestId("order-refused").textContent).toMatch(/not enough cash/));

    fireEvent.click(screen.getByTestId("order-type-Limit"));
    type("order-qty", "1");
    type("order-limit", "0.01");
    await submit();
    await waitFor(() => expect(screen.getByTestId("order-refused").textContent).toMatch(/marketable/));
    // Nothing of the three changed the account.
    expect(account(g).fills.some((f) => f.instrument === 1_000_000_000 + id)).toBe(false);
  });

  it("does not send an unreadable quantity or a limit order with no price", async () => {
    const { g } = await ticket();
    const act1 = vi.spyOn(g.client, "act");
    expect((screen.getByTestId("order-submit") as HTMLButtonElement).disabled).toBe(true);
    type("order-qty", "2.5");
    expect((screen.getByTestId("order-submit") as HTMLButtonElement).disabled).toBe(true);
    type("order-qty", "3");
    fireEvent.click(screen.getByTestId("order-type-Limit"));
    expect((screen.getByTestId("order-submit") as HTMLButtonElement).disabled).toBe(true);
    expect(act1).not.toHaveBeenCalled();
  });

  it("lists open orders on the page and cancels one", async () => {
    const { g } = await ticket();
    const o = account(g).orders.find((x) => x.status === "Open") as OrderRow;
    expect(screen.getByTestId(`order-row-${o.id}`)).toBeTruthy();
    fireEvent.click(screen.getByTestId(`order-cancel-${o.id}`));
    await waitFor(() => expect(screen.queryByTestId(`order-row-${o.id}`)).toBeNull());
    expect(screen.getByText("No open orders.")).toBeTruthy();
  });

  it("follows the ticker typed into the field in the route", async () => {
    const { g, m } = await ticket();
    const other = tickers(g)[1];
    if (other === undefined) throw new Error("no second company");
    type("order-ticker", other.ticker);
    expect(m.route()).toBe(`page/F4/${other.ticker.toUpperCase()}`);
  });

  it("never shows a company's true value: null in the quote until Omniscient, and not read by the ticket", async () => {
    const { g, id } = await ticket();
    const row = g.client.store.getView("quotes")?.data.rows.find((r) => r.id === id);
    expect(row?.value).toBeNull();
    // The mock does not fill the true V in Omniscient (D1033), so put one in the view as the real sim would.
    if (row === undefined) throw new Error("no quote");
    row.value = 987.65;
    type("order-qty", "10");
    expect(screen.getByTestId("term-order").textContent).not.toContain("987.65");
    expect(screen.getByTestId("order-last").textContent).toBe(usd(row.last));
  });
});
