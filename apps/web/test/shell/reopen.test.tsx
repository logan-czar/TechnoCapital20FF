// @vitest-environment happy-dom
// Reopening closed panes (D979): the real workspace and dockview with stub pane bodies. Close any
// tab, all of them too, and bring it back from the Panes menu or Alt+Shift+R.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { historyFromSaved, historyNew, historyOpen, historyToSaved } from "../../src/pages/history.ts";
import type { PageRef } from "../../src/pages/ref.ts";
import {
  FIXED_PANES,
  MAX_CLOSED,
  type PaneSpec,
  pushClosed,
  type WorkspaceControl,
} from "../../src/shell/panes.ts";
import { PanesMenu } from "../../src/shell/TopBar.tsx";
import { LAYOUT_KEY, Workspace } from "../../src/shell/Workspace.tsx";

vi.mock("../../src/panes/MapPane.tsx", () => ({ MapPane: () => <div>map body</div> }));
vi.mock("../../src/panes/ChartPane.tsx", () => ({ ChartPane: () => <div>chart body</div> }));
vi.mock("../../src/panes/CompaniesPane.tsx", () => ({ CompaniesPane: () => <div>companies body</div> }));
vi.mock("../../src/panes/NewsPane.tsx", () => ({ NewsPane: () => <div>news body</div> }));
vi.mock("../../src/panes/AlertsPane.tsx", () => ({ AlertsPane: () => <div>alerts body</div> }));
vi.mock("../../src/panes/ListPanes.tsx", () => ({
  IndustriesPane: () => <div>industries body</div>,
  CountriesPane: () => <div>countries body</div>,
}));
// A page pane shows the page its saved history is on, and how many pages are behind it.
vi.mock("../../src/pages/PagePane.tsx", () => ({
  PagePane: ({ params }: { params: { history?: unknown } }) => {
    const h = historyFromSaved(params.history);
    return (
      <div>
        page {h?.current.kind} back {h?.back.length}
      </div>
    );
  },
}));

const WORLD: PageRef = { kind: "world" };
const NEWS: PageRef = { kind: "news" };
const fixed = (id: string): PaneSpec => FIXED_PANES.find((p) => p.id === id) as PaneSpec;
const pageSpec = (id: string, page: PageRef): PaneSpec => ({
  id,
  kind: "page",
  title: page.kind,
  params: { history: historyToSaved(historyNew(page)) },
});

describe("the closed list", () => {
  it("keeps the most recent first, one entry per pane or page, at most MAX_CLOSED", () => {
    let c = pushClosed([], fixed("map"));
    c = pushClosed(c, pageSpec("page-1", WORLD));
    c = pushClosed(c, fixed("map"));
    expect(c.map((s) => s.id)).toEqual(["map", "page-1"]);
    // The same page closed in another pane replaces the older entry.
    c = pushClosed(c, pageSpec("page-2", WORLD));
    expect(c.map((s) => s.id)).toEqual(["page-2", "map"]);
    for (const p of FIXED_PANES) c = pushClosed(c, p);
    for (let i = 0; i < MAX_CLOSED; i++) c = pushClosed(c, { id: `x${i}`, kind: "companies", title: "x" });
    expect(c).toHaveLength(MAX_CLOSED);
    expect(c[0]?.id).toBe(`x${MAX_CLOSED - 1}`);
  });
});

describe("reopening in the workspace", () => {
  let ws: WorkspaceControl;

  beforeEach(() => {
    localStorage.clear();
    render(
      <>
        <PanesMenu workspace={() => ws} />
        <Workspace
          onControl={(c) => {
            ws = c;
          }}
        />
      </>,
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  const tabs = () => [...document.querySelectorAll(".dv-tab")].map((t) => t.textContent?.trim());
  const closeTab = (title: string) => {
    const tab = [...document.querySelectorAll(".dv-tab")].find((t) => t.textContent?.trim() === title);
    const x = tab?.querySelector(".dv-default-tab-action");
    if (!x) throw new Error(`no tab ${title}`);
    act(() => {
      fireEvent.pointerDown(x);
      fireEvent.click(x);
    });
  };
  const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Panes" }));
  const menuItem = (label: string) => {
    const b = [...document.querySelectorAll<HTMLButtonElement>(".panes-menu button")].find((x) =>
      x.textContent?.startsWith(label),
    );
    if (!b) throw new Error(`no menu item ${label}`);
    return b;
  };
  const pick = (label: string) => {
    openMenu();
    fireEvent.click(menuItem(label));
  };
  const key = () =>
    act(() => {
      fireEvent.keyDown(window, { key: "R", code: "KeyR", altKey: true, shiftKey: true });
    });

  it("brings back every fixed pane from the menu, after all of them closed", () => {
    expect(tabs()).toEqual(["Map"]);
    closeTab("Map");
    expect(tabs()).toEqual([]);
    expect(screen.getByText(/All panes are closed/)).toBeTruthy();
    for (const p of FIXED_PANES) pick(p.title);
    expect(tabs().sort()).toEqual(FIXED_PANES.map((p) => p.title).sort());
    expect(screen.queryByText(/All panes are closed/)).toBeNull();
    for (const p of FIXED_PANES) closeTab(p.title);
    expect(tabs()).toEqual([]);
    for (const p of FIXED_PANES) pick(p.title);
    expect(tabs()).toHaveLength(FIXED_PANES.length);
  });

  it("reopens the last closed pane of either kind by key, most recent first", () => {
    act(() => ws.openPage(NEWS, "new"));
    expect(tabs()).toEqual(["Map", "news"]);
    closeTab("news");
    closeTab("Map");
    expect(ws.closed().map((c) => c.title)).toEqual(["Map", "news"]);
    key();
    expect(tabs()).toEqual(["Map"]);
    key();
    expect(tabs().sort()).toEqual(["Map", "news"]);
    expect(ws.closed()).toEqual([]);
    // Nothing left: the key does nothing, and the menu says so.
    key();
    expect(tabs()).toHaveLength(2);
    openMenu();
    expect(menuItem("Nothing to reopen").disabled).toBe(true);
  });

  it("does not take the key while the player types", () => {
    closeTab("Map");
    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "R", code: "KeyR", altKey: true, shiftKey: true });
    input.remove();
    expect(tabs()).toEqual([]);
  });

  it("reopens a closed page from the menu with its history, focused", () => {
    act(() => ws.openPage(WORLD, "new"));
    // A pane moved on to another page, as PagePane saves it.
    const title = "Moved";
    const moved: PaneSpec = {
      id: "ignored",
      kind: "page",
      title,
      params: { history: historyToSaved(historyOpen(historyNew(WORLD), NEWS)) },
    };
    closeTab("world");
    expect(ws.closed()[0]?.title).toBe("world");
    act(() => ws.reopen(moved));
    expect(tabs()).toContain(title);
    expect(document.querySelector(".dv-active-group .dv-active-tab")?.textContent).toContain(title);
    expect(screen.getByText("page news back 1")).toBeTruthy();
    closeTab(title);
    openMenu();
    expect(menuItem("Moved")).toBeTruthy();
    fireEvent.click(menuItem("Moved"));
    expect(screen.getByText("page news back 1")).toBeTruthy();
    expect(ws.closed().map((c) => c.title)).toEqual(["world"]);
  });

  it("marks the open fixed panes and drops one opened another way from the closed list", () => {
    closeTab("Map");
    expect(ws.closed().map((c) => c.id)).toEqual(["map"]);
    act(() => ws.open(fixed("map")));
    expect(ws.closed()).toEqual([]);
    openMenu();
    expect(menuItem("Map").textContent).toContain("open");
    expect(menuItem("Companies").textContent).not.toContain("open");
  });

  it("does not count panes a loaded layout replaced as closed, and reopens beside the loaded panes", () => {
    act(() => ws.open(fixed("companies")));
    const saved = ws.layout();
    closeTab("Companies");
    act(() => ws.open(fixed("news")));
    const before = ws.closed().map((c) => c.id);
    act(() => {
      expect(ws.restore(saved)).toBe(true);
    });
    expect(tabs().sort()).toEqual(["Companies", "Map"]);
    expect(ws.closed().map((c) => c.id)).toEqual(before.filter((id) => id !== "companies"));
    pick("Pdoomberg Wire");
    expect(tabs().sort()).toEqual(["Companies", "Map", "Pdoomberg Wire"]);
  });

  it("restarts from the map when the saved layout has no panes", () => {
    closeTab("Map");
    cleanup();
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(ws.layout()));
    render(
      <Workspace
        onControl={(c) => {
          ws = c;
        }}
      />,
    );
    expect(tabs()).toEqual(["Map"]);
  });
});
