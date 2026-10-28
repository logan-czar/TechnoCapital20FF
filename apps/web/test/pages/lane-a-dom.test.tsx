// @vitest-environment happy-dom
// Lane A's pages in a pane, with React Testing Library: b1_pages.rs company_sections_and_tabs_persist
// and live_values_follow_the_views, workspace.rs sections_collapse_and_hide (on the Company page),
// and the alert half of market_pages.rs recap_opens_from_its_alert_and_by_quarter (the alert in the
// alerts list opens its recap in the focused pane, D304). The views come from a real game run
// in-process by the worker's host.

import type { CompanyId, Notice } from "@tc20ff/sim";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SettingsContext } from "../../src/config/hooks.ts";
import { fromText, SettingsStore, toText } from "../../src/config/settings.ts";
import { HoverCards } from "../../src/links/Link.tsx";
import { NavContext } from "../../src/links/nav.ts";
import { SECTIONS } from "../../src/pages/kinds/company.tsx";
import { PageBody } from "../../src/pages/PagePane.tsx";
import { PENDING_NOTE } from "../../src/pages/PendingPage.tsx";
import { PAGE_KINDS, setProvinceKeys } from "../../src/pages/ref.ts";
import { pageSpecOf } from "../../src/pages/registry.ts";
import { arrangeSections, currentTab } from "../../src/pages/sections.ts";
import { LIVE_REFRESH_MS } from "../../src/pages/views.ts";
import { AlertsPane } from "../../src/panes/AlertsPane.tsx";
import type { SimClient } from "../../src/sim/client.ts";
import { SimContext } from "../../src/sim/hooks.ts";
import { RealHost } from "../../src/sim/real/host.ts";
import { type Frame, SimStore } from "../../src/sim/store.ts";
import { price } from "../../src/widgets/cells.ts";

let host: RealHost;
let store: SimStore;

beforeAll(() => {
  const loaded = loadWorld(defaultDataDir());
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  host = new RealHost(loaded.value);
  const frame = host.handle({ kind: "NewGame", seed: 42, id: 1 }).find((m) => m.kind === "Frame") as Frame;
  store = new SimStore();
  store.applyFrame(frame);
  return () => setProvinceKeys(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const client = () => ({ store, control: vi.fn() }) as unknown as SimClient;

function shell(children: ReactNode) {
  const settings = new SettingsStore(null);
  const nav = { open: vi.fn() };
  render(
    <SimContext.Provider value={client()}>
      <SettingsContext.Provider value={settings}>
        <NavContext.Provider value={nav}>
          <HoverCards>{children}</HoverCards>
        </NavContext.Provider>
      </SettingsContext.Provider>
    </SimContext.Provider>,
  );
  return { settings, nav };
}

const LANE_A = ["company", "character", "zone", "exchange", "province", "recap"] as const;
const LISTS = ["companies", "characters", "countries", "exchanges", "zones"] as const;

describe("lane A's pages", () => {
  it("every lane A kind is registered: none opens the pending page", () => {
    for (const k of [...LANE_A, ...LISTS]) {
      expect(PAGE_KINDS).toContain(k);
      expect(pageSpecOf(k), k).toBeDefined();
    }
    const co = store.getView("company_rows")?.data.rows[0]?.id as CompanyId;
    shell(<PageBody page={{ kind: "company", id: co }} />);
    expect(screen.queryByText(PENDING_NOTE)).toBeNull();
  });

  it("the Company page's sections fold, move and hide, its tabs show one at a time, and the config keeps them (company_sections_and_tabs_persist; sections_collapse_and_hide)", () => {
    const id = store.getView("company_rows")?.data.rows[0]?.id as CompanyId;
    const { settings } = shell(<PageBody page={{ kind: "company", id }} />);
    const shown = () =>
      [...document.querySelectorAll("[data-section]")].map((e) => e.getAttribute("data-section"));
    expect(shown()).toEqual(SECTIONS.map((s) => s.id));
    // Fold the board.
    fireEvent.click(screen.getByRole("button", { name: "[-] Board" }));
    expect(settings.config.sections.company?.collapsed).toContain("board");
    // Move Tech up, hide the cap table.
    fireEvent.click(screen.getByRole("button", { name: /Move the section up: Tech/ }));
    fireEvent.click(screen.getByRole("button", { name: /Hide the section.*: Cap table/ }));
    const s = settings.config.sections.company;
    expect(s?.hidden).toContain("cap_table");
    expect(arrangeSections(SECTIONS, s).map((x) => x.section.id)).toEqual([
      "overview",
      "chart",
      "board",
      "units",
      "tech",
      "financials",
    ]);
    expect(shown(), "the page redrew without it").not.toContain("cap_table");
    expect(screen.getByText("[show Cap table]")).toBeTruthy();
    // The config's text form keeps it.
    const back = fromText(toText(settings.config));
    expect(back.ok && back.value.sections).toEqual(settings.config.sections);
    // The tab strip: Units only, then All.
    fireEvent.click(screen.getByRole("tab", { name: "Units" }));
    expect(currentTab(settings.config, "company", SECTIONS)).toBe("units");
    const open = () =>
      [...document.querySelectorAll("[data-section]")]
        .filter((e) => e.querySelector(".section-body"))
        .map((e) => e.getAttribute("data-section"));
    expect(open(), "only the tab's section has a body").toEqual(["units"]);
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    expect(settings.config.sections.company?.collapsed).toEqual([]);
    expect(open(), "every tab again").toContain("units");
    // Show the hidden cap table from its line under the sections.
    fireEvent.click(screen.getByText("[show Cap table]"));
    expect(shown()).toContain("cap_table");
  });

  it("a listed company's price follows v_quotes without a rebuild (live_values_follow_the_views)", () => {
    vi.useFakeTimers();
    const id = store.getView("quotes")?.data.rows[0]?.id as CompanyId;
    shell(<PageBody page={{ kind: "company", id }} />);
    const priceText = () => {
      const f = [...document.querySelectorAll(".field")].find(
        (e) => e.querySelector(".field-label")?.textContent === "Price",
      );
      return f?.querySelector(".field-value > span")?.textContent ?? null;
    };
    const last = () => price(store.getView("quotes")?.data.rows.find((r) => r.id === id)?.last ?? Number.NaN);
    const before = priceText();
    expect(before).toBe(last());
    // Run the game until the price moves, then post the frame the worker would.
    const sim = host.sim;
    if (!sim) throw new Error("no game");
    const simPrice = () => price(sim.views().quotes.data.rows.find((r) => r.id === id)?.last ?? Number.NaN);
    for (let i = 0; i < 2_000 && simPrice() === before; i++) sim.step();
    expect(simPrice(), "the game moved the price").not.toBe(before);
    const frame = host
      .handle({ kind: "Control", id: 2, control: { kind: "Pause" } })
      .find((m) => m.kind === "Frame");
    act(() => store.applyFrame(frame as Frame));
    act(() => vi.advanceTimersByTime(LIVE_REFRESH_MS + 50));
    const now = priceText();
    expect(now, "the price moved").not.toBe(before);
    expect(now).toBe(last());
  });

  it("the recap alert in the alerts list opens its recap in the focused pane (recap_opens_from_its_alert_and_by_quarter, D304)", () => {
    const alert: Notice = {
      kind: "Alert",
      alert_kind: "QuarterlyRecap",
      level: "Pause",
      payload: { kind: "Quarter", quarter: { year: 2020, q: 1 } },
    };
    store.notices = [{ seq: 1, time: 0, notice: alert }];
    const { nav } = shell(<AlertsPane />);
    const link = document.querySelector(".scroll .item button, .scroll .item a, .scroll .item [role=button]");
    if (!link) throw new Error("the alert is a link");
    fireEvent.click(link);
    expect(nav.open).toHaveBeenLastCalledWith({ kind: "recap", quarter: { year: 2020, q: 1 } }, "focused");
    store.notices = [];
  });
});
