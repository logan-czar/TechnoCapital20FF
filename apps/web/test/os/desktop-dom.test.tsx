// @vitest-environment happy-dom
// The desktop in the DOM (React Testing Library; pivot 15.2, 15.3, 2.2, 12): icons and the
// launcher from an app list, debug-only apps hidden until Omniscient is on, windows opened,
// focused, dragged, minimised, restored and closed, `openApp`, the taskbar's clock controls sent to
// a fake client, the phone's notifications and app slot, and the desktop kept between visits.
//
// The apps are made up here (an app is a spec and a lazy component, os/apps.ts); the last tests
// use the real registry and the real root. happy-dom has no layout, so the desktop keeps the
// bounds it guesses from the page size (1024 by 768 less the taskbar).

import type { ClockView, Notice, NotificationRow, PlayerAction, UiControl } from "@tc20ff/sim";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { lazy, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import { type SettingsStorage, SettingsStore } from "../../src/config/settings.ts";
import { openApp } from "../../src/links/nav.ts";
import { type AppProps, type AppSpec, registeredApps } from "../../src/os/apps.ts";
import { Desktop, TASKBAR_H } from "../../src/os/Desktop.tsx";
import { DESKTOP_KEY, DESKTOP_WRITE_DELAY_MS } from "../../src/os/persist.ts";
import { CASCADE_ORIGIN } from "../../src/os/wm.ts";
import type { SimClient } from "../../src/sim/client.ts";
import { SimContext } from "../../src/sim/hooks.ts";
import { type Frame, SimStore } from "../../src/sim/store.ts";

// The debug workspace's heavy panes are not under test here (shell/reopen.test.tsx has the workspace).
vi.mock("../../src/panes/MapPane.tsx", () => ({ MapPane: () => <div>map body</div> }));

/** What the made-up apps did: mounts and unmounts by app id. */
let mounts: Record<string, number>;
let unmounts: Record<string, number>;

/** An app's component: says its name and route, counts its mounts, and can navigate. */
function body(id: string) {
  function Body({ route, onRoute }: AppProps) {
    // biome-ignore lint/correctness/useExhaustiveDependencies: counts mounts, so it runs once per mount
    useEffect(() => {
      mounts[id] = (mounts[id] ?? 0) + 1;
      return () => {
        unmounts[id] = (unmounts[id] ?? 0) + 1;
      };
    }, []);
    return (
      <div data-testid={`body-${id}`}>
        {id} at {route ?? "home"}
        <button type="button" onClick={() => onRoute("race/12")}>
          go to race 12
        </button>
        <input aria-label={`${id} search`} />
      </div>
    );
  }
  return lazy(async () => ({ default: Body }));
}

function spec(id: string, over: Partial<AppSpec> = {}): AppSpec {
  return {
    id,
    title: `${id[0]?.toUpperCase()}${id.slice(1)}`,
    icon: id,
    Component: body(id),
    defaultSize: { width: 500, height: 320 },
    singleton: true,
    ...over,
  };
}

let APPS: AppSpec[];
const apps = (debug: boolean) => APPS.filter((s) => debug || s.debugOnly !== true);

let store: SimStore;
let control: ReturnType<typeof vi.fn<(c: UiControl) => Promise<unknown>>>;
let acted: ReturnType<typeof vi.fn<(a: PlayerAction) => Promise<unknown>>>;
let client: SimClient;
let tick: number;

function clock(over: Partial<ClockView>): ClockView {
  return {
    now: tick++,
    date: { year: 2020, month: 1, day: 14 },
    hour: 9,
    weekday: "Tue",
    speed: 0,
    selected_speed: 2,
    paused: true,
    skipping: null,
    quarter_phase: "Reaction",
    next_phase: "Locked",
    days_to_next_phase: 3,
    next_release: 0,
    watchlist: [],
    omniscient: false,
    fixed_pauses: { OwnFill: true, MarginCall: true, ElectionDay: true, Holding: true },
    ...over,
  } as ClockView;
}

/** v_notifications rows as the sim appends them (a notification of the player's, with the given overrides). */
function note(id: number, over: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id,
    time: 100 + id,
    kind: "Fill",
    text: `Notification ${id}`,
    refs: [],
    rule: null,
    paused: false,
    fixed: null,
    ...over,
  };
}

/** A frame that appends `rows` to the notifications held (the first one posts the view), and says how far the player has read. */
function notify(rows: NotificationRow[], readThrough = -1, notices: Notice[] = []): void {
  act(() =>
    store.applyFrame({
      kind: "Frame",
      notices,
      clock: clock({}),
      views: {
        notifications: { data: { items: [], read_through: readThrough }, version: ++tick, dirty: false },
        appended: [{ view: "notifications", field: "items", reset: false, rows }],
      },
    } as unknown as Frame),
  );
}

/** A frame from the sim: the clock, and the notices that came with it. */
function frame(over: Partial<ClockView> = {}, notices: Notice[] = []): void {
  act(() => store.applyFrame({ kind: "Frame", notices, clock: clock(over), views: {} } as Frame));
}

function desktop(storage: SettingsStorage | null = null) {
  return render(
    <SimContext.Provider value={client}>
      <Desktop storage={storage} apps={apps} />
    </SimContext.Provider>,
  );
}

/** Opens an app from its desktop icon and waits for its content. */
async function openIcon(id: string): Promise<HTMLElement> {
  fireEvent.doubleClick(screen.getByTestId(`app-${id}`));
  await screen.findByTestId(`body-${id}`);
  return screen.getByTestId(`win-${id}`);
}

const controls = (): UiControl[] => control.mock.calls.map((c) => c[0]);

beforeEach(() => {
  mounts = {};
  unmounts = {};
  tick = 100;
  APPS = [spec("news"), spec("polls"), spec("debug", { debugOnly: true })];
  store = new SimStore();
  store.setStatus({ ready: true, started: true });
  control = vi.fn(async () => ({ kind: "Ok", notices: [] }));
  acted = vi.fn(async () => ({ kind: "Ok", notices: [] }));
  client = { store, control, act: acted, ready: Promise.resolve(), newGame: vi.fn() } as unknown as SimClient;
  frame();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the apps the desktop lists", () => {
  it("shows an icon and a launcher entry for each app", () => {
    desktop();
    expect(screen.getByTestId("app-news").textContent).toBe("News");
    expect(screen.getByTestId("app-polls")).toBeTruthy();
    expect(screen.queryByTestId("launch-news")).toBeNull();
    fireEvent.click(screen.getByTestId("tb-launcher"));
    expect(screen.getByTestId("launch-news").textContent).toBe("News");
    expect(screen.getByTestId("launch-polls")).toBeTruthy();
  });

  it("hides a debug-only app until Omniscient is on, and again when it goes off", async () => {
    desktop();
    fireEvent.click(screen.getByTestId("tb-launcher"));
    expect(screen.queryByTestId("app-debug")).toBeNull();
    expect(screen.queryByTestId("launch-debug")).toBeNull();
    // Hidden, it cannot be opened by a link either.
    act(() => void openApp("debug"));
    expect(screen.queryByTestId("win-debug")).toBeNull();

    frame({ omniscient: true });
    expect(screen.getByTestId("app-debug")).toBeTruthy();
    expect(screen.getByTestId("launch-debug")).toBeTruthy();
    await openIcon("debug");
    expect(screen.getByTestId("tb-win-debug")).toBeTruthy();

    // Off again: the icon, the window and its taskbar button go; the others stay.
    frame({ omniscient: false });
    expect(screen.queryByTestId("app-debug")).toBeNull();
    expect(screen.queryByTestId("win-debug")).toBeNull();
    expect(screen.queryByTestId("tb-win-debug")).toBeNull();
    expect(screen.getByTestId("app-news")).toBeTruthy();
    // On once more: the window is where it was left.
    frame({ omniscient: true });
    expect(await screen.findByTestId("win-debug")).toBeTruthy();
  });

  it("sends SetOmniscient from the taskbar's toggle (dev builds have it)", () => {
    desktop();
    fireEvent.click(screen.getByTestId("tb-omniscient"));
    expect(controls()).toEqual([{ kind: "SetOmniscient", on: true }]);
  });
});

describe("windows", () => {
  it("opens a window from an icon and from the launcher, the last one focused", async () => {
    desktop();
    const news = await openIcon("news");
    expect(news.dataset.focused).toBe("true");
    expect(screen.getByTestId("body-news").textContent).toContain("news at home");
    expect(screen.getByTestId("win-news-address").textContent).toBe("orr://news");
    expect(screen.getByTestId("tb-win-news").dataset.focused).toBe("true");

    fireEvent.click(screen.getByTestId("tb-launcher"));
    fireEvent.click(screen.getByTestId("launch-polls"));
    await screen.findByTestId("body-polls");
    // The launcher closed, and the new window is in front.
    expect(screen.queryByTestId("launch-polls")).toBeNull();
    expect(screen.getByTestId("win-polls").dataset.focused).toBe("true");
    expect(news.dataset.focused).toBe("false");
    expect(Number(screen.getByTestId("win-polls").style.zIndex)).toBeGreaterThan(Number(news.style.zIndex));
  });

  it("opens from the keyboard: Enter on a focused icon", async () => {
    desktop();
    // A keyboard activation is a click with no pointer (detail 0); one mouse click only selects.
    fireEvent.click(screen.getByTestId("app-news"), { detail: 1 });
    expect(screen.queryByTestId("win-news")).toBeNull();
    fireEvent.click(screen.getByTestId("app-news"), { detail: 0 });
    expect(await screen.findByTestId("win-news")).toBeTruthy();
  });

  it("focuses a window when it is pressed, and when something in it takes the keyboard", async () => {
    desktop();
    const news = await openIcon("news");
    const polls = await openIcon("polls");
    expect(polls.dataset.focused).toBe("true");
    fireEvent.pointerDown(screen.getByTestId("body-news"));
    expect(news.dataset.focused).toBe("true");
    expect(polls.dataset.focused).toBe("false");
    expect(Number(news.style.zIndex)).toBeGreaterThan(Number(polls.style.zIndex));
    act(() => screen.getByLabelText("polls search").focus());
    expect(polls.dataset.focused).toBe("true");
    // Opening a singleton that is open focuses it and opens no second window.
    fireEvent.doubleClick(screen.getByTestId("app-news"));
    expect(news.dataset.focused).toBe("true");
    expect(screen.getAllByTestId("body-news")).toHaveLength(1);
  });

  it("minimises a window (its app unmounts), restores it from the taskbar and closes it", async () => {
    desktop();
    await openIcon("news");
    await openIcon("polls");
    expect(mounts.polls).toBe(1);

    fireEvent.click(screen.getByTestId("win-polls-min"));
    expect(screen.queryByTestId("win-polls")).toBeNull();
    expect(screen.queryByTestId("body-polls")).toBeNull();
    expect(unmounts.polls).toBe(1);
    // Its taskbar button stays, and focus passed to the window behind.
    expect(screen.getByTestId("tb-win-polls").dataset.state).toBe("minimised");
    expect(screen.getByTestId("win-news").dataset.focused).toBe("true");

    fireEvent.click(screen.getByTestId("tb-win-polls"));
    await screen.findByTestId("body-polls");
    expect(mounts.polls).toBe(2);
    expect(screen.getByTestId("win-polls").dataset.focused).toBe("true");
    // The taskbar button of the focused window minimises it; of another, focuses it.
    fireEvent.click(screen.getByTestId("tb-win-news"));
    expect(screen.getByTestId("win-news").dataset.focused).toBe("true");
    fireEvent.click(screen.getByTestId("tb-win-news"));
    expect(screen.queryByTestId("win-news")).toBeNull();

    fireEvent.click(screen.getByTestId("win-polls-close"));
    expect(screen.queryByTestId("win-polls")).toBeNull();
    expect(screen.queryByTestId("tb-win-polls")).toBeNull();
    expect(unmounts.polls).toBe(2);
    expect(screen.getByTestId("tb-win-news")).toBeTruthy();
  });

  it("maximises to the whole desktop and back", async () => {
    desktop();
    const news = await openIcon("news");
    expect(news.style.width).toBe("500px");
    fireEvent.click(screen.getByTestId("win-news-max"));
    expect(news.dataset.state).toBe("maximised");
    expect(news.style.left).toBe("0px");
    expect(news.style.width).toBe(`${window.innerWidth}px`);
    expect(news.style.height).toBe(`${window.innerHeight - TASKBAR_H}px`);
    // A maximised window has no resize handles.
    expect(screen.queryByTestId("win-news-edge-se")).toBeNull();
    fireEvent.click(screen.getByTestId("win-news-max"));
    expect(news.dataset.state).toBe("normal");
    expect(news.style.width).toBe("500px");
  });

  it("drags by the title bar, resizes by an edge and snaps at the desktop's side", async () => {
    desktop();
    const news = await openIcon("news");
    const bar = news.querySelector(".os-titlebar") as HTMLElement;
    expect(news.style.left).toBe(`${CASCADE_ORIGIN}px`);

    fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 100, clientY: 40 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 160, clientY: 90 });
    expect(news.style.left).toBe(`${CASCADE_ORIGIN + 60}px`);
    expect(news.style.top).toBe(`${CASCADE_ORIGIN + 50}px`);
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 160, clientY: 90 });
    // Released: further moves do nothing.
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 400, clientY: 300 });
    expect(news.style.left).toBe(`${CASCADE_ORIGIN + 60}px`);

    const edge = screen.getByTestId("win-news-edge-se");
    fireEvent.pointerDown(edge, { pointerId: 2, button: 0, clientX: 600, clientY: 400 });
    fireEvent.pointerMove(edge, { pointerId: 2, clientX: 650, clientY: 380 });
    fireEvent.pointerUp(edge, { pointerId: 2, clientX: 650, clientY: 380 });
    expect(news.style.width).toBe("550px");
    expect(news.style.height).toBe("300px");

    // A drag let go at the left edge snaps the window to the left half.
    fireEvent.pointerDown(bar, { pointerId: 3, button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(bar, { pointerId: 3, clientX: 2, clientY: 300 });
    fireEvent.pointerUp(bar, { pointerId: 3, clientX: 2, clientY: 300 });
    expect(news.style.left).toBe("0px");
    expect(news.style.top).toBe("0px");
    expect(news.style.width).toBe(`${Math.floor(window.innerWidth / 2)}px`);
    expect(news.style.height).toBe(`${window.innerHeight - TASKBAR_H}px`);
    // Double-clicking the title bar puts it back as it was before the snap.
    fireEvent.doubleClick(bar);
    expect(news.style.width).toBe("550px");
  });

  it("moves and snaps from the keyboard with the title bar focused", async () => {
    desktop();
    const news = await openIcon("news");
    const bar = news.querySelector(".os-titlebar") as HTMLElement;
    fireEvent.keyDown(bar, { key: "ArrowRight" });
    expect(news.style.left).toBe(`${CASCADE_ORIGIN + 24}px`);
    fireEvent.keyDown(bar, { key: "ArrowDown", shiftKey: true });
    expect(news.style.height).toBe("344px");
    fireEvent.keyDown(bar, { key: "ArrowRight", ctrlKey: true });
    expect(news.style.left).toBe(`${Math.floor(window.innerWidth / 2)}px`);
    fireEvent.keyDown(bar, { key: "ArrowDown", ctrlKey: true });
    expect(screen.queryByTestId("win-news")).toBeNull();
  });

  it("shows where the app navigated to in the title bar's address", async () => {
    desktop();
    await openIcon("news");
    fireEvent.click(within(screen.getByTestId("win-news")).getByText("go to race 12"));
    expect(screen.getByTestId("win-news-address").textContent).toBe("orr://news/race/12");
    expect(screen.getByTestId("body-news").textContent).toContain("news at race/12");
  });

  it("opens several windows of an app that is not a singleton", async () => {
    APPS = [spec("news", { singleton: false })];
    desktop();
    fireEvent.doubleClick(screen.getByTestId("app-news"));
    fireEvent.doubleClick(screen.getByTestId("app-news"));
    expect(await screen.findAllByTestId("body-news")).toHaveLength(2);
    expect(screen.getByTestId("win-news-1")).toBeTruthy();
    expect(screen.getByTestId("win-news-2").dataset.focused).toBe("true");
  });

  it("keeps a crashed app inside its window", async () => {
    const Broken = lazy(async () => ({
      default: (_: AppProps): never => {
        throw new Error("no data");
      },
    }));
    APPS = [spec("news"), spec("polls", { Component: Broken })];
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    desktop();
    await openIcon("news");
    fireEvent.doubleClick(screen.getByTestId("app-polls"));
    expect((await screen.findByRole("alert")).textContent).toContain("Polls stopped working");
    expect(screen.getByTestId("body-news")).toBeTruthy();
    quiet.mockRestore();
  });
});

describe("openApp", () => {
  it("opens a window at a route, and focuses and re-routes the one that is open", async () => {
    desktop();
    let ok = false;
    act(() => {
      ok = openApp("news", "race/3");
    });
    expect(ok).toBe(true);
    expect((await screen.findByTestId("body-news")).textContent).toContain("news at race/3");
    await openIcon("polls");
    act(() => void openApp("news", "person/9"));
    expect(screen.getByTestId("win-news").dataset.focused).toBe("true");
    expect(screen.getByTestId("win-news-address").textContent).toBe("orr://news/person/9");
    expect(screen.getAllByTestId("body-news")).toHaveLength(1);
  });

  it("ignores an app the desktop does not have, and does nothing once the desktop is gone", () => {
    const { unmount } = desktop();
    act(() => void openApp("nothing"));
    expect(screen.queryByTestId("win-nothing")).toBeNull();
    unmount();
    expect(openApp("news")).toBe(false);
  });
});

describe("the taskbar's clock (pivot 2.2)", () => {
  it("shows the game date and hour", () => {
    desktop();
    expect(screen.getByTestId("tb-clock").textContent).toBe("09:00Tue 14 Jan 2020");
    frame({ hour: 17, date: { year: 2020, month: 3, day: 2 }, weekday: "Mon" });
    expect(screen.getByTestId("tb-clock").textContent).toBe("17:00Mon 02 Mar 2020");
  });

  it("sends Resume while paused and Pause while running", () => {
    desktop();
    expect(screen.getByTestId("tb-pause").getAttribute("aria-label")).toBe("Resume");
    fireEvent.click(screen.getByTestId("tb-pause"));
    frame({ paused: false, speed: 2 });
    expect(screen.getByTestId("tb-pause").getAttribute("aria-label")).toBe("Pause");
    fireEvent.click(screen.getByTestId("tb-pause"));
    expect(controls()).toEqual([{ kind: "Resume" }, { kind: "Pause" }]);
  });

  it("sends Step for one hour", () => {
    desktop();
    fireEvent.click(screen.getByTestId("tb-step"));
    expect(controls()).toEqual([{ kind: "Step", hours: 1 }]);
  });

  it("sends SetSpeed, and marks the speed picked", () => {
    desktop();
    expect(screen.getByTestId("tb-speed-2").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByTestId("tb-speed-4"));
    fireEvent.click(screen.getByTestId("tb-speed-6"));
    expect(controls()).toEqual([
      { kind: "SetSpeed", speed: 4 },
      { kind: "SetSpeed", speed: 6 },
    ]);
    frame({ paused: false, speed: 4, selected_speed: 4 });
    expect(screen.getByTestId("tb-speed-4").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("tb-speed-2").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("tb-speed-6").textContent).toBe("Max");
  });

  it("keeps the keys: Space pauses or resumes, 1 to 6 set the speed, the full stop steps", async () => {
    desktop();
    fireEvent.keyDown(document.body, { code: "Space", key: " " });
    fireEvent.keyDown(document.body, { key: "3" });
    fireEvent.keyDown(document.body, { key: "." });
    fireEvent.keyDown(document.body, { key: "7" });
    expect(controls()).toEqual([
      { kind: "Resume" },
      { kind: "SetSpeed", speed: 3 },
      { kind: "Step", hours: 1 },
    ]);

    // Not while typing in an app's field, not with a chord held, and Space on a button is that button's.
    control.mockClear();
    await openIcon("news");
    fireEvent.keyDown(screen.getByLabelText("news search"), { code: "Space", key: " " });
    fireEvent.keyDown(screen.getByLabelText("news search"), { key: "2" });
    fireEvent.keyDown(document.body, { key: "2", ctrlKey: true });
    fireEvent.keyDown(screen.getByTestId("tb-step"), { code: "Space", key: " " });
    expect(controls()).toEqual([]);
    // Inside a window, outside a field, they work: a window is no dialog.
    fireEvent.keyDown(screen.getByTestId("body-news"), { code: "Space", key: " " });
    expect(controls()).toEqual([{ kind: "Resume" }]);
  });
});

describe("the phone (pivot 12)", () => {
  it("is put down at first, and picked up and put down from the taskbar", () => {
    desktop();
    expect(screen.getByTestId("phone").dataset.open).toBe("false");
    expect(screen.queryByTestId("phone-notifications")).toBeNull();
    fireEvent.click(screen.getByTestId("tb-phone"));
    expect(screen.getByTestId("phone").dataset.open).toBe("true");
    expect(screen.getByTestId("phone").textContent).toContain("Nothing yet");
    fireEvent.click(screen.getByTestId("phone-down"));
    expect(screen.getByTestId("phone").dataset.open).toBe("false");
  });

  it("counts unread notifications on the taskbar, from the view's read_through", () => {
    desktop();
    expect(screen.getByTestId("tb-phone").getAttribute("aria-label")).toBe("Phone");
    notify([note(0), note(1), note(2)], 0);
    // Two are after the last one read.
    expect(screen.getByTestId("tb-phone").getAttribute("aria-label")).toBe("Phone, 2 new");
    expect(screen.getByTestId("tb-phone").textContent).toContain("2");
    notify([], 2);
    expect(screen.getByTestId("tb-phone").getAttribute("aria-label")).toBe("Phone");
  });

  it("lists the notifications newest first, marks the unread and the pausing ones, and reads them", () => {
    desktop();
    notify(
      [
        note(0, { kind: "Alert", text: "Price alert" }),
        note(1, { kind: "Holding", text: "Roll call on H.R. 7", paused: true, fixed: "Holding" }),
        note(2, { kind: "Resolution", text: "Contract resolved Yes", paused: true, fixed: "OwnFill" }),
      ],
      0,
    );
    fireEvent.click(screen.getByTestId("tb-phone"));
    const items = within(screen.getByTestId("phone-notifications")).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector(".os-phone-note-text")?.textContent)).toEqual([
      "Contract resolved Yes",
      "Roll call on H.R. 7",
      "Price alert",
    ]);
    // Newer than read_through when the list came up: marked new. The ones that paused say so.
    expect(items.map((li) => li.getAttribute("data-unread"))).toEqual(["true", "true", "false"]);
    expect(items.map((li) => li.getAttribute("data-paused"))).toEqual(["true", "true", "false"]);
    expect(screen.getByTestId("phone-note-2").textContent).toContain("Paused the game");
    expect(screen.getByTestId("phone-note-0").textContent).not.toContain("Paused the game");
    // Seeing the list reads it, up to the newest.
    expect(acted).toHaveBeenCalledWith({ kind: "NotificationsRead", through: 2 });
    expect(acted).toHaveBeenCalledTimes(1);
    // One that arrives while it is up is read too, and is marked new.
    notify([note(3, { text: "Fill of your order" })], 2);
    expect(acted).toHaveBeenLastCalledWith({ kind: "NotificationsRead", through: 3 });
    expect(screen.getByTestId("phone-note-3").getAttribute("data-unread")).toBe("true");
  });

  it("does not read the notifications while the phone is down, and says nothing when there are none", () => {
    desktop();
    fireEvent.click(screen.getByTestId("tb-phone"));
    expect(screen.getByTestId("phone").textContent).toContain("Nothing yet");
    expect(acted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("phone-down"));
    notify([note(0)]);
    expect(acted).not.toHaveBeenCalled();
    expect(screen.getByTestId("tb-phone").getAttribute("aria-label")).toBe("Phone, 1 new");
  });

  it("does not call a notification a pause once its fixed pause is switched off", () => {
    desktop();
    notify([note(0, { kind: "ElectionDay", text: "Election day", paused: true, fixed: "ElectionDay" })]);
    frame({ fixed_pauses: { OwnFill: true, MarginCall: true, ElectionDay: false, Holding: true } });
    fireEvent.click(screen.getByTestId("tb-phone"));
    expect(screen.getByTestId("phone-note-0").getAttribute("data-paused")).toBe("false");
  });

  it("opens what a notification names, in the app that shows it", async () => {
    const opened: [string, string | null][] = [];
    const { setAppOpener } = await import("../../src/links/nav.ts");
    desktop();
    // The desktop's own opener is replaced to see where the link goes.
    act(() => setAppOpener((app, route) => void opened.push([app, route])));
    notify([note(0, { kind: "Holding", text: "Roll call on H.R. 7", refs: [{ kind: "Bill", id: 7 }] })]);
    fireEvent.click(screen.getByTestId("tb-phone"));
    fireEvent.click(screen.getByTestId("link-bill-7"));
    expect(opened).toEqual([["records", "bill/7"]]);
  });

  it("lists on its home screen the apps that have a compact view, and shows the one chosen with a back gesture", async () => {
    desktop();
    fireEvent.click(screen.getByTestId("tb-phone"));
    // No app has a compact view: no tiles, only the notifications.
    expect(screen.queryByTestId("phone-apps")).toBeNull();
    cleanup();

    const Compact = lazy(async () => ({
      default: ({ route, onRoute }: AppProps) => (
        <button type="button" data-testid="compact" onClick={() => onRoute("contract/7")}>
          compact polls at {route ?? "home"}
        </button>
      ),
    }));
    APPS = [spec("news"), spec("polls", { PhoneView: Compact })];
    desktop();
    fireEvent.click(screen.getByTestId("tb-phone"));
    // Only the app with a compact view is on the phone.
    expect(screen.queryByTestId("phone-app-news")).toBeNull();
    fireEvent.click(screen.getByTestId("phone-app-polls"));
    const view = await screen.findByTestId("compact");
    expect(view.textContent).toBe("compact polls at home");
    fireEvent.click(view);
    expect(screen.getByTestId("compact").textContent).toBe("compact polls at contract/7");
    // Back and in again: the app keeps its place while the phone is up.
    fireEvent.click(screen.getByTestId("phone-back"));
    expect(screen.queryByTestId("compact")).toBeNull();
    expect(screen.getByTestId("phone-apps")).toBeTruthy();
    fireEvent.click(screen.getByTestId("phone-app-polls"));
    expect((await screen.findByTestId("compact")).textContent).toBe("compact polls at contract/7");
  });
});

describe("the pause note and the pause settings (pivot 2.4)", () => {
  it("names the notification that paused the game, and jumps to it on the phone", () => {
    desktop();
    expect(screen.queryByTestId("tb-pause-note")).toBeNull();
    notify([note(0), note(1, { text: "Roll call on H.R. 7", paused: true, fixed: "Holding" })]);
    frame({}, [{ kind: "Paused", reason: { kind: "Notification", id: 1 } }]);
    const banner = screen.getByTestId("tb-pause-note");
    expect(banner.textContent).toContain("Roll call on H.R. 7");
    expect(screen.getByTestId("phone").dataset.open).toBe("false");

    fireEvent.click(banner);
    expect(screen.getByTestId("phone").dataset.open).toBe("true");
    expect(screen.getByTestId("phone-note-1").getAttribute("data-current")).toBe("true");
    expect(screen.getByTestId("phone-note-0").getAttribute("data-current")).toBe("false");
  });

  it("goes when the game runs again, or paused for another reason", () => {
    desktop();
    notify([note(0, { text: "Fill of your order", paused: true, fixed: "OwnFill" })]);
    frame({ paused: true }, [{ kind: "Paused", reason: { kind: "Notification", id: 0 } }]);
    expect(screen.getByTestId("tb-pause-note")).toBeTruthy();
    frame({ paused: false, speed: 2 });
    expect(screen.queryByTestId("tb-pause-note")).toBeNull();
    // Paused again by the player: not the notification's doing.
    frame({ paused: true }, [{ kind: "Paused", reason: { kind: "Player" } }]);
    expect(screen.queryByTestId("tb-pause-note")).toBeNull();
  });

  it("shows no note for a pause of another kind", () => {
    desktop();
    notify([note(0)]);
    frame({}, [{ kind: "Paused", reason: { kind: "StepDone" } }]);
    expect(screen.queryByTestId("tb-pause-note")).toBeNull();
  });

  it("sets a fixed pause from the settings, and shows the two that cannot be turned off locked", () => {
    desktop();
    expect(screen.queryByTestId("pause-settings")).toBeNull();
    fireEvent.click(screen.getByTestId("tb-pauses"));
    const box = (p: string) => screen.getByTestId(`pause-${p}`) as HTMLInputElement;
    // A fill and a margin call are always on (pivot 2.4).
    for (const p of ["OwnFill", "MarginCall"]) {
      expect(box(p).checked).toBe(true);
      expect(box(p).disabled).toBe(true);
    }
    for (const p of ["ElectionDay", "Holding"]) {
      expect(box(p).checked).toBe(true);
      expect(box(p).disabled).toBe(false);
    }
    expect(screen.getAllByText("cannot be turned off")).toHaveLength(2);

    fireEvent.click(box("ElectionDay"));
    expect(controls()).toEqual([{ kind: "SetFixedPause", pause: "ElectionDay", on: false }]);
    // The state is the clock view's: it shows what the sim says.
    frame({ fixed_pauses: { OwnFill: true, MarginCall: true, ElectionDay: false, Holding: true } });
    expect(box("ElectionDay").checked).toBe(false);
    fireEvent.click(box("ElectionDay"));
    expect(controls().at(-1)).toEqual({ kind: "SetFixedPause", pause: "ElectionDay", on: true });
    fireEvent.click(box("OwnFill"));
    expect(controls()).toHaveLength(2);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("pause-settings")).toBeNull();
  });
});

describe("the first run (D1050)", () => {
  it("opens the first app on an empty desktop, and leaves a saved desktop alone", async () => {
    render(
      <SimContext.Provider value={client}>
        <Desktop storage={null} apps={apps} firstApp="news" />
      </SimContext.Provider>,
    );
    expect(await screen.findByTestId("body-news")).toBeTruthy();
    expect(screen.getByTestId("win-news")).toBeTruthy();
    // Closed by the player, it stays closed.
    fireEvent.click(screen.getByTestId("win-news-close"));
    expect(screen.queryByTestId("win-news")).toBeNull();
  });

  it("does not open it over windows the player had", async () => {
    const storage = {
      data: new Map<string, string>(),
      getItem(k: string) {
        return this.data.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        this.data.set(k, v);
      },
      removeItem(k: string) {
        this.data.delete(k);
      },
    };
    const first = desktop(storage);
    await openIcon("polls");
    first.unmount();
    render(
      <SimContext.Provider value={client}>
        <Desktop storage={storage} apps={apps} firstApp="news" />
      </SimContext.Provider>,
    );
    expect(await screen.findByTestId("win-polls")).toBeTruthy();
    expect(screen.queryByTestId("win-news")).toBeNull();
  });

  it("opens nothing when the app is not there", () => {
    render(
      <SimContext.Provider value={client}>
        <Desktop storage={null} apps={apps} firstApp="nosuchapp" />
      </SimContext.Provider>,
    );
    expect(screen.queryByTestId("win-nosuchapp")).toBeNull();
  });
});

describe("the desktop between visits", () => {
  function memory(): SettingsStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  }

  it("saves the windows and the phone a moment after a change, and opens them again", async () => {
    const storage = memory();
    const first = desktop(storage);
    await openIcon("news");
    await openIcon("polls");
    act(() => void openApp("news", "race/3"));
    fireEvent.click(screen.getByTestId("win-polls-min"));
    fireEvent.click(screen.getByTestId("tb-phone"));
    // Leaving the page writes what is pending at once.
    first.unmount();
    expect(storage.data.has(DESKTOP_KEY)).toBe(true);

    desktop(storage);
    expect((await screen.findByTestId("body-news")).textContent).toContain("news at race/3");
    expect(screen.getByTestId("tb-win-polls").dataset.state).toBe("minimised");
    expect(screen.queryByTestId("win-polls")).toBeNull();
    expect(screen.getByTestId("phone").dataset.open).toBe("true");
  });

  it("writes after the delay without leaving the page", async () => {
    const storage = memory();
    desktop(storage);
    await openIcon("news");
    vi.useFakeTimers();
    fireEvent.click(screen.getByTestId("win-news-max"));
    expect(storage.data.has(DESKTOP_KEY)).toBe(false);
    act(() => void vi.advanceTimersByTime(DESKTOP_WRITE_DELAY_MS));
    expect(storage.data.get(DESKTOP_KEY)).toContain('"maximised"');
  });

  it("drops a saved window whose app is gone, and starts empty from a document that does not read", async () => {
    const storage = memory();
    const first = desktop(storage);
    await openIcon("news");
    await openIcon("polls");
    first.unmount();
    APPS = [spec("polls")];
    const second = desktop(storage);
    expect(await screen.findByTestId("win-polls")).toBeTruthy();
    expect(screen.queryByTestId("tb-win-news")).toBeNull();
    second.unmount();

    storage.data.set(DESKTOP_KEY, "{not json");
    desktop(storage);
    expect(screen.getByTestId("app-polls")).toBeTruthy();
    expect(screen.queryByTestId("win-polls")).toBeNull();
  });

  it("works from memory when storage throws", async () => {
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {},
    };
    const d = desktop(broken);
    await openIcon("news");
    fireEvent.click(screen.getByTestId("win-news-max"));
    expect(screen.getByTestId("win-news").dataset.state).toBe("maximised");
    expect(() => d.unmount()).not.toThrow();
  });
});

describe("the real registry and root", () => {
  it("lists the debug workspace only with Omniscient, opening large", () => {
    expect(registeredApps(false).find((s) => s.id === "debug")).toBeUndefined();
    const debug = registeredApps(true).find((s) => s.id === "debug");
    expect(debug).toMatchObject({ title: "Debug workspace", singleton: true, debugOnly: true });
    expect(debug?.defaultSize.width).toBeGreaterThanOrEqual(1366);
  });

  it("opens the news app on the first run, with no debug workspace on the desktop", async () => {
    localStorage.clear();
    render(<App client={client} settings={new SettingsStore(null)} />);
    expect(screen.getByTestId("desktop")).toBeTruthy();
    expect(await screen.findByTestId("win-news-1", undefined, { timeout: 10000 })).toBeTruthy();
    expect(screen.queryByTestId("app-debug")).toBeNull();
    expect(screen.queryByTestId("win-debug")).toBeNull();
  }, 20000);

  it("draws the desktop as the root once the game has started, with the workspace in a window", async () => {
    localStorage.clear();
    render(<App client={client} settings={new SettingsStore(null)} />);
    expect(screen.getByTestId("desktop")).toBeTruthy();
    expect(screen.getByTestId("taskbar")).toBeTruthy();
    // The old full-screen layout is not the root: no top bar until the workspace's window opens.
    expect(document.querySelector(".topbar")).toBeNull();
    // The debug workspace is listed once Omniscient is on (pivot 15.3).
    expect(screen.queryByTestId("app-debug")).toBeNull();
    frame({ omniscient: true });
    fireEvent.doubleClick(screen.getByTestId("app-debug"));
    const workspace = await screen.findByTestId("debug-workspace", undefined, { timeout: 10000 });
    expect(screen.getByTestId("win-debug").contains(workspace)).toBe(true);
    expect(within(workspace).getByText("Panes")).toBeTruthy();
    expect(await within(workspace).findByText("map body")).toBeTruthy();
    // A larger default than the test's page: fitted to the desktop.
    expect(screen.getByTestId("win-debug").style.width).toBe(`${window.innerWidth}px`);
  }, 20000);

  it("shows the start-up line before a game exists, and what stopped the sim", () => {
    store.setStatus({ started: false });
    const { unmount } = render(<App client={client} settings={new SettingsStore(null)} />);
    expect(screen.getByText("Starting the simulation...")).toBeTruthy();
    expect(screen.queryByTestId("desktop")).toBeNull();
    unmount();
    store.setStatus({ fatal: "out of memory" });
    render(<App client={client} settings={new SettingsStore(null)} />);
    expect(screen.getByText(/The simulation stopped: out of memory/)).toBeTruthy();
  });
});
