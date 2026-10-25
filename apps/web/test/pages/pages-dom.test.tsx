// @vitest-environment happy-dom
// The pages in a pane, with React Testing Library: the shell halves of crates/game/tests/
// workspace.rs (every_page_kind_builds, panes_keep_their_own_history, sections_collapse_and_hide,
// hover_cards_follow_links, layouts_and_density, link_clicks_open_pages) and b1_pages.rs
// (b1_pages_open_and_their_links_navigate) for the pages this step ports. The views come from a
// real game's first frame (the worker's host, run in-process).

import type { CompanyId, CountryId } from "@tc20ff/sim";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { IDockviewPanelProps } from "dockview-react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SettingsContext } from "../../src/config/hooks.ts";
import { SettingsStore, settingsKey } from "../../src/config/settings.ts";
import { HOVER_DELAY_MS, HOVER_GRACE_MS, HoverCards, Link } from "../../src/links/Link.tsx";
import { buildNameIndex } from "../../src/links/names.ts";
import { NavContext, type PageNav } from "../../src/links/nav.ts";
import { PageBody, PagePane, type PagePaneParams } from "../../src/pages/PagePane.tsx";
import { PENDING_NOTE } from "../../src/pages/PendingPage.tsx";
import { Picker, pickId, pickOf } from "../../src/pages/Picker.tsx";
import { PAGE_KINDS, type PageKind, type PageRef, setProvinceKeys } from "../../src/pages/ref.ts";
import { pageSpecOf } from "../../src/pages/registry.ts";
import { type ViewsData, viewsData } from "../../src/pages/views.ts";
import { WorkspaceContext, type WorkspaceControl } from "../../src/shell/panes.ts";
import type { SimClient } from "../../src/sim/client.ts";
import { SimContext } from "../../src/sim/hooks.ts";
import { RealHost } from "../../src/sim/real/host.ts";
import { type Frame, SimStore } from "../../src/sim/store.ts";

let store: SimStore;
let views: ViewsData;

beforeAll(() => {
  const loaded = loadWorld(defaultDataDir());
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  const host = new RealHost(loaded.value);
  const frame = host.handle({ kind: "NewGame", seed: 42, id: 1 }).find((m) => m.kind === "Frame") as Frame;
  store = new SimStore();
  store.applyFrame(frame);
  const sim = host.sim;
  if (!sim) throw new Error("no game");
  views = viewsData(sim.views());
  return () => setProvinceKeys(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const client = () => ({ store }) as unknown as SimClient;

function noWorkspace(): WorkspaceControl {
  return {
    open: vi.fn(),
    openPage: vi.fn(),
    registerPane: () => () => {},
    persist: vi.fn(),
    layout: () => ({ grid: { root: {} }, panels: { map: {}, "page-1": {} } }),
    restore: vi.fn(() => true),
  };
}

interface Shell {
  settings: SettingsStore;
  nav: PageNav & { open: ReturnType<typeof vi.fn> };
  ws: WorkspaceControl;
}

function shell(children: ReactNode, s: Partial<Shell> = {}): Shell {
  const out: Shell = {
    settings: s.settings ?? new SettingsStore(null),
    nav: { open: vi.fn() },
    ws: s.ws ?? noWorkspace(),
  };

  render(
    <SimContext.Provider value={client()}>
      <SettingsContext.Provider value={out.settings}>
        <WorkspaceContext.Provider value={out.ws}>
          <NavContext.Provider value={out.nav}>
            <HoverCards>{children}</HoverCards>
          </NavContext.Provider>
        </WorkspaceContext.Provider>
      </SettingsContext.Provider>
    </SimContext.Provider>,
  );
  return out;
}

/** A page of every kind, as workspace.rs every_page_kind_builds picks them. */
function samplePages(): PageRef[] {
  const v = views;
  const company = v.company_rows?.rows[0]?.id as CompanyId;
  const pick: Record<PageKind, PageRef> = {
    world: { kind: "world" },
    company: { kind: "company", id: company },
    industry: { kind: "industry", id: v.industry_rows?.rows[0]?.id as never },
    character: { kind: "character", id: 0 as never },
    country: { kind: "country", id: 0 as CountryId },
    province: { kind: "province", id: 0 as never },
    zone: { kind: "zone", id: 0 as never },
    exchange: { kind: "exchange", id: 0 as never },
    event: { kind: "event", id: 0 as never },
    recap: { kind: "recap", quarter: { year: 2020, q: 1 } },
    headline: { kind: "headline", id: 0 as never },
    companies: { kind: "companies" },
    industries: { kind: "industries" },
    news: { kind: "news" },
    characters: { kind: "characters" },
    countries: { kind: "countries" },
    exchanges: { kind: "exchanges" },
    zones: { kind: "zones" },
    events: { kind: "events" },
    settings: { kind: "settings" },
  };
  return PAGE_KINDS.map((k) => pick[k]);
}

describe("pages in a pane", () => {
  it("every page kind draws with its title; the unported ones say so (every_page_kind_builds)", () => {
    const index = buildNameIndex(views);
    for (const page of samplePages()) {
      shell(<PageBody page={page} />);
      const title = index.title(page);
      expect(screen.getAllByText(title, { exact: false }).length, `${page.kind}: ${title}`).toBeGreaterThan(
        0,
      );
      const pending = screen.queryByText(PENDING_NOTE);
      expect(pending === null, `${page.kind} pending`).toBe(pageSpecOf(page.kind) !== undefined);
      cleanup();
    }
  });

  it("the Country page shows its sections, which fold, move and hide from their headers (sections_collapse_and_hide)", () => {
    const { settings } = shell(<PageBody page={{ kind: "country", id: 0 as CountryId }} />);
    const sections = () =>
      [...document.querySelectorAll("[data-section]")].map((e) => e.getAttribute("data-section"));
    expect(sections()).toEqual(["economy", "companies", "provinces"]);
    expect(document.querySelectorAll(".table-box").length, "its two tables").toBe(2);
    fireEvent.click(screen.getByRole("button", { name: /Hide the section.*: Provinces/ }));
    expect(sections()).toEqual(["economy", "companies"]);
    expect(settings.config.sections.country?.hidden).toEqual(["provinces"]);
    fireEvent.click(screen.getByText("[show Provinces]"));
    expect(sections()).toEqual(["economy", "companies", "provinces"]);
    fireEvent.click(screen.getByRole("button", { name: /Move the section up: HQ'd companies/ }));
    expect(sections()).toEqual(["companies", "economy", "provinces"]);
    const fold = screen.getByRole("button", { name: "[-] Economy" });
    fireEvent.click(fold);
    expect(screen.queryByText("Sovereign rating"), "a folded section has no body").toBeNull();
    expect(settings.config.sections.country?.collapsed).toEqual(["economy"]);
  });

  it("a link click opens its page in the focused pane, Shift or middle in a new one, right click none (link_clicks_open_pages)", () => {
    const { nav } = shell(<PageBody page={{ kind: "world" }} />);
    const link = screen.getByRole("button", { name: "Industries" });
    fireEvent.click(link, { button: 2 });
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 2 }));
    expect(nav.open).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(nav.open).toHaveBeenLastCalledWith({ kind: "industries" }, "focused");
    fireEvent.click(link, { shiftKey: true });
    expect(nav.open).toHaveBeenLastCalledWith({ kind: "industries" }, "new");
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(nav.open).toHaveBeenLastCalledWith({ kind: "industries" }, "new");
  });

  it("a hover card shows after the delay and goes after the grace time (hover_cards_follow_links)", () => {
    vi.useFakeTimers();
    const c = views.countries?.countries[0];
    if (!c) throw new Error("countries");
    shell(<Link page={{ kind: "country", id: c.id }}>{c.name}</Link>);
    const link = screen.getByRole("button", { name: c.name });
    fireEvent.mouseEnter(link);
    act(() => vi.advanceTimersByTime(HOVER_DELAY_MS - 10));
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => vi.advanceTimersByTime(20));
    const card = screen.getByRole("tooltip");
    expect(within(card).getByText("ISO3")).toBeTruthy();
    expect(within(card).getByText(c.iso3)).toBeTruthy();
    // The card's own title links the page too.
    expect(within(card).getByRole("button", { name: c.name })).toBeTruthy();
    fireEvent.mouseLeave(link);
    act(() => vi.advanceTimersByTime(HOVER_GRACE_MS + 10));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("a page pane", () => {
  function pane(ws = noWorkspace()) {
    const api = {
      id: "page-1",
      title: "",
      setTitle(t: string) {
        this.title = t;
      },
      updateParameters: vi.fn(),
    };
    const props = { api, params: {}, containerApi: {} } as unknown as IDockviewPanelProps<PagePaneParams>;
    // A pane's own nav is the one its links use, so no outer NavContext is needed.
    const settings = new SettingsStore(null);
    render(
      <SimContext.Provider value={client()}>
        <SettingsContext.Provider value={settings}>
          <WorkspaceContext.Provider value={ws}>
            <HoverCards>
              <PagePane {...props} />
            </HoverCards>
          </WorkspaceContext.Provider>
        </SettingsContext.Provider>
      </SimContext.Provider>,
    );
    return { api, ws };
  }

  it("keeps its own history: a link opens in it, Back and the breadcrumb return (panes_keep_their_own_history)", () => {
    const { api, ws } = pane();
    expect(api.title).toBe("World");
    const c = views.countries?.countries[0];
    if (!c) throw new Error("countries");
    // From World to Settings by a link, then back.
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(api.title).toBe("Settings");
    expect(api.updateParameters).toHaveBeenLastCalledWith({
      history: { back: ["world"], current: "settings", forward: [] },
    });
    expect(ws.persist).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "World" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    // The breadcrumb jumps back to World.
    fireEvent.click(screen.getByRole("button", { name: "World" }));
    expect(screen.getByRole("heading", { name: "World" })).toBeTruthy();
    // Shift+click asks the workspace for a new pane and leaves this one.
    fireEvent.click(screen.getByRole("button", { name: "Countries" }), { shiftKey: true });
    expect(ws.openPage).toHaveBeenLastCalledWith({ kind: "countries" }, "new");
    expect(screen.getByRole("heading", { name: "World" })).toBeTruthy();
  });

  it("opens the Country page and follows its links (b1_pages_open_and_their_links_navigate)", () => {
    const ws = noWorkspace();
    let handle: Parameters<WorkspaceControl["registerPane"]>[1] | null = null;
    ws.registerPane = (_id, h) => {
      handle = h;
      return () => {};
    };
    pane(ws);
    const c = views.countries?.countries.find((x) => x.hq_companies.length > 0);
    if (!c || !handle) throw new Error("setup");
    const h: NonNullable<typeof handle> = handle;
    act(() => h.open({ kind: "country", id: c.id }));
    expect(screen.getByRole("heading", { name: c.name })).toBeTruthy();
    expect(screen.queryByText(PENDING_NOTE)).toBeNull();
    // The zone link goes to the zone's page (pending in this step, but routed).
    const zone = buildNameIndex(views).title({ kind: "zone", id: c.zone });
    fireEvent.click(screen.getAllByRole("button", { name: zone })[0] as HTMLElement);
    expect(h.current()).toEqual({ kind: "zone", id: c.zone });
    act(() => h.back());
    expect(h.current()).toEqual({ kind: "country", id: c.id });
  });
});

describe("the picker (live.rs spawn_picker)", () => {
  it("lists All and its options, and a chip sets the pick and closes them", () => {
    const onChange = vi.fn();
    shell(
      <Picker
        label="Industry"
        options={[
          ["Oil", pickOf(0)],
          ["Chips", pickOf(1)],
        ]}
        value={0}
        onChange={onChange}
      />,
    );
    const head = screen.getByRole("button", { name: /Industry: All v/ });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(head);
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["All", "Oil", "Chips"]);
    fireEvent.click(options[2] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith(2);
    expect(pickId(2)).toBe(1);
    expect(pickId(0)).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("the Settings page", () => {
  it("sets density and font size, and saves, loads and deletes layouts (layouts_and_density)", () => {
    const ws = noWorkspace();
    const { settings } = shell(<PageBody page={{ kind: "settings" }} />, { ws });
    fireEvent.click(screen.getByRole("button", { name: "compact" }));
    expect(settings.config.density).toBe("compact");
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    expect(settings.config.font_scale).toBeCloseTo(1.05, 6);
    expect(screen.getByText(/Font size 105%/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(settings.config.font_scale).toBe(1);
    expect(screen.getByText("No saved layouts.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: 'Save the workspace as "Layout 1"' }));
    expect(Object.keys(settings.config.layouts)).toEqual(["Layout 1"]);
    expect(screen.getByText("Layout 1 (2 panes)")).toBeTruthy();
    expect(screen.getByRole("button", { name: 'Save the workspace as "Layout 2"' })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    expect(ws.restore).toHaveBeenCalledWith(settings.config.layouts["Layout 1"]);
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(settings.config.layouts).toEqual({});
    expect(screen.getByText("None: this run keeps its settings in memory.")).toBeTruthy();
    expect(screen.getByText("Alt+Left, Backspace")).toBeTruthy();
  });

  it("answers the settings keys: Ctrl+J, Ctrl+= / - / 0, Ctrl+, (workspace.rs SHORTCUTS)", () => {
    const s = new SettingsStore(null);
    const open = vi.fn();
    const key = (k: string, ctrl = true) =>
      settingsKey({ key: k, ctrlKey: ctrl, metaKey: false, altKey: false }, s, open);
    expect(key("j")).toBe(true);
    expect(s.config.density).toBe("compact");
    expect(key("=")).toBe(true);
    expect(s.config.font_scale).toBeCloseTo(1.05, 6);
    expect(key("-")).toBe(true);
    expect(key("-")).toBe(true);
    expect(s.config.font_scale).toBeCloseTo(0.95, 6);
    expect(key("0")).toBe(true);
    expect(s.config.font_scale).toBe(1);
    expect(key(",")).toBe(true);
    expect(open).toHaveBeenCalledOnce();
    expect(key("j", false), "no Ctrl: not a settings key").toBe(false);
    expect(key("x")).toBe(false);
  });
});
