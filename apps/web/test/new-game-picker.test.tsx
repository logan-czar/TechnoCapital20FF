// @vitest-environment happy-dom
// The new-game screen (shell/NewGamePicker.tsx; pivot 3.5): the baked starts, "Generate a new history"
// with its progress screen and Cancel, a refusal (the mock cannot generate), the developer's scenario
// picker and the stable test ids ("Stable growth" is a substring of "Unstable growth").

import type { BakedStart, NewGameChoices, Reply } from "@tc20ff/sim";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.tsx";
import { SettingsStore } from "../src/config/settings.ts";
import {
  GeneratingScreen,
  type NewGameApi,
  NewGamePicker,
  PHASE_LABEL,
  startsOf,
} from "../src/shell/NewGamePicker.tsx";
import type { SimClient } from "../src/sim/client.ts";
import { type ProgressInfo, SimStore } from "../src/sim/store.ts";

const choices: NewGameChoices = {
  world_id: "1995",
  scenarios: [
    { id: "stable", label: "Stable growth" },
    { id: "unstable", label: "Unstable growth" },
    { id: "random", label: "Random" },
  ],
};

const baked: BakedStart = {
  id: "alpha",
  label: "Alpha: a fixed 2020",
  seed: 5,
  save_version: 7,
  hash: "00" as unknown as BakedStart["hash"],
  scenario: "hidden",
  date: "2020-10-20",
  file: "alpha.tcsave",
  bytes: 1,
};

const ok: Reply = { kind: "Ok", notices: [] };

function fakeApi(over: Partial<NewGameApi> = {}): NewGameApi {
  return {
    baked: vi.fn(async () => ok),
    generate: vi.fn(async () => ok),
    scenario: vi.fn(async () => ok),
    cancel: vi.fn(),
    load: vi.fn(),
    ...over,
  };
}

afterEach(cleanup);

describe("the picker", () => {
  it("offers the baked starts and a generated history, and starts the one picked", async () => {
    const api = fakeApi();
    render(<NewGamePicker choices={choices} starts={[baked]} api={api} />);
    fireEvent.click(screen.getByTestId("new-game-baked-alpha"));
    expect(api.baked).toHaveBeenCalledWith("alpha");
    cleanup();

    render(<NewGamePicker choices={choices} api={api} />);
    // None baked: only the generated history (the list may be empty).
    expect(screen.queryByTestId("new-game-baked-alpha")).toBeNull();
    fireEvent.click(screen.getByTestId("new-game-generate"));
    await waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1));
    expect(Number.isSafeInteger((api.generate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toBe(true);
  });

  it("shows the progress screen while it generates, and Cancel stops it and brings the choices back", async () => {
    let settle: (r: Reply) => void = () => {};
    const api = fakeApi({
      generate: vi.fn(
        () =>
          new Promise<Reply>((res) => {
            settle = res;
          }),
      ),
    });
    const view = render(<NewGamePicker choices={choices} api={api} progress={null} />);
    fireEvent.click(screen.getByTestId("new-game-generate"));
    expect(screen.getByTestId("new-game-progress")).toBeTruthy();
    expect(screen.queryByTestId("new-game-generate")).toBeNull();
    expect(screen.getByTestId("new-game-phase").textContent).toBe("Starting");

    const progress: ProgressInfo = {
      id: 1,
      phase: "Presim",
      done: 250,
      total: 1000,
      date: { year: 2003, month: 4, day: 9 },
    };
    view.rerender(<NewGamePicker choices={choices} api={api} progress={progress} />);
    expect(screen.getByTestId("new-game-phase").textContent).toBe(PHASE_LABEL.Presim);
    expect(screen.getByTestId("new-game-percent").textContent).toBe("25%");
    expect(screen.getByTestId("new-game-date").textContent).toBe("Reached 09 Apr 2003");
    expect((screen.getByTestId("new-game-bar") as HTMLProgressElement).value).toBe(0.25);

    fireEvent.click(screen.getByTestId("new-game-cancel"));
    expect(api.cancel).toHaveBeenCalledTimes(1);
    await act(async () => settle({ kind: "Cancelled" }));
    expect(screen.getByTestId("new-game-generate")).toBeTruthy();
    expect(screen.getByTestId("new-game-error").textContent).toContain("Cancelled");
  });

  it("says why a start did not happen (the mock cannot generate), and lets the player try another", async () => {
    const refused: Reply = {
      kind: "Refused",
      message: "unsupported: this build's sim does not handle NewGame yet",
    };
    const api = fakeApi({ generate: vi.fn(async () => refused) });
    render(<NewGamePicker choices={choices} starts={[baked]} api={api} />);
    fireEvent.click(screen.getByTestId("new-game-generate"));
    expect((await screen.findByTestId("new-game-error")).textContent).toContain("unsupported");
    expect(screen.getByTestId("new-game-baked-alpha")).toHaveProperty("disabled", false);
  });

  it("keeps the scenario and seed picker for developers, with a test id for each scenario", async () => {
    const api = fakeApi();
    render(<NewGamePicker choices={choices} api={api} />);
    expect(screen.queryByTestId("new-game-dev")).toBeNull();
    expect(screen.queryByTestId("new-game-seed")).toBeNull();
    cleanup();

    render(<NewGamePicker choices={choices} api={api} dev />);
    fireEvent.change(screen.getByTestId("new-game-seed"), { target: { value: "42" } });
    // Each scenario has its own id: "Stable growth" is inside "Unstable growth", so a label would match both.
    expect(screen.getByTestId("new-game-scenario-stable").textContent).toContain("Stable growth");
    expect(screen.getByTestId("new-game-scenario-unstable").textContent).toContain("Unstable growth");
    fireEvent.click(screen.getByTestId("new-game-scenario-stable"));
    await waitFor(() => expect(api.scenario).toHaveBeenCalledWith(42, "stable"));
  });

  it("refuses a seed that is not a whole number", () => {
    render(<NewGamePicker choices={choices} api={fakeApi()} dev />);
    fireEvent.change(screen.getByTestId("new-game-seed"), { target: { value: "x" } });
    expect(screen.getByTestId("new-game-generate")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("new-game-scenario-stable")).toHaveProperty("disabled", true);
  });

  it("loads a save from the file chooser", () => {
    const api = fakeApi();
    render(<NewGamePicker choices={choices} api={api} />);
    const file = new File([new Uint8Array([1])], "x.tcsave");
    fireEvent.change(screen.getByTestId("new-game-file"), { target: { files: [file] } });
    expect(api.load).toHaveBeenCalledWith(file);
  });
});

describe("the progress screen", () => {
  it("has an indeterminate bar before the first report", () => {
    render(<GeneratingScreen progress={null} onCancel={() => {}} />);
    expect(screen.getByTestId("new-game-bar").hasAttribute("value")).toBe(false);
    expect(screen.queryByTestId("new-game-percent")).toBeNull();
  });

  it("names every phase, and shows no date for one that has none", () => {
    for (const phase of ["Load", "Presim", "Hydrate", "Save"] as const) {
      expect(PHASE_LABEL[phase].length).toBeGreaterThan(0);
    }
    render(
      <GeneratingScreen
        progress={{ id: 1, phase: "Hydrate", done: 1, total: 1, date: null }}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId("new-game-percent").textContent).toBe("100%");
    expect(screen.queryByTestId("new-game-date")).toBeNull();
  });
});

describe("the root", () => {
  /** A client whose store holds the 1995 world's choices and no game: the picker's state. */
  function pickerClient(newGame: SimClient["newGame"]): SimClient {
    const store = new SimStore();
    store.setStatus({ ready: true, started: false, choices });
    return { store, newGame, cancel: vi.fn(), ready: Promise.resolve() } as unknown as SimClient;
  }

  it("shows the picker and sends a generated history as start: generate", async () => {
    const newGame = vi.fn(async () => ok as Reply);
    render(<App client={pickerClient(newGame)} settings={new SettingsStore(null)} />);
    fireEvent.click(screen.getByTestId("new-game-generate"));
    await waitFor(() => expect(newGame).toHaveBeenCalledTimes(1));
    const [seed, scenario, start] = newGame.mock.calls[0] as unknown as [number, string | undefined, unknown];
    expect(Number.isSafeInteger(seed)).toBe(true);
    expect(scenario).toBeUndefined();
    expect(start).toEqual({ kind: "generate" });
  });

  it("reads the baked starts the store keeps, none until the contracts change adds them", () => {
    const store = new SimStore();
    expect(startsOf(store.status)).toEqual([]);
    expect(startsOf({ ...store.status, starts: [baked] } as typeof store.status)).toEqual([baked]);
  });
});
