// The page's root: starts the game, then draws the desktop (pivot 15.2; os/Desktop.tsx). Before a
// game is running it shows the start-up line, the new-game picker of a world that has one
// (pivot 3.5, 1995-rework 4.1), or what stopped the sim. Everything a player does after that is in a window.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { SettingsContext, useApplySettings } from "./config/hooks.ts";
import type { SettingsStore } from "./config/settings.ts";
import { Desktop } from "./os/Desktop.tsx";
import { type NewGameApi, NewGamePicker, startsOf } from "./shell/NewGamePicker.tsx";
import { Toasts } from "./shell/Toasts.tsx";
import type { SimClient } from "./sim/client.ts";
import { SimContext, useStatus } from "./sim/hooks.ts";

/** The seed of the first game. */
const DEFAULT_SEED = 1;
/** The app a new game opens on an empty desktop (D1050). */
export const FIRST_APP = "news";

/**
 * True where the developer's scenario and seed picker is offered: the dev server, and the app run
 * with the end-to-end test hooks (the Electron shell sets `tcHost.flags.testHooks`). A production
 * player does not choose the hidden scenario (pivot 3.2).
 */
function developerStart(): boolean {
  const host = (globalThis as { tcHost?: { flags?: { testHooks?: boolean } } }).tcHost;
  return import.meta.env.DEV || host?.flags?.testHooks === true;
}

function Shell({ client, settings }: { client: SimClient; settings: SettingsStore }) {
  const status = useStatus();
  useApplySettings();
  // StrictMode runs effects twice in development: start the game once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // A world with a new-game picker waits for the player's choice (1995-rework 4.1).
    void client.ready.then(() => {
      // A game the host already started (the desktop app's `--save`) is kept.
      const { choices, started: running } = client.store.status;
      if (choices === null && !running) void client.newGame(DEFAULT_SEED);
    });
  }, [client]);

  const load = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const r = await client.load(new Uint8Array(await file.arrayBuffer()));
      if (r.kind === "Ok") client.store.pushMessage("info", "Save loaded. The game is paused.");
    },
    [client],
  );

  // What the picker asks of the game (pivot 3.5): a baked start, a generated history, or the 1995
  // world's own first day under a scenario.
  const api = useMemo<NewGameApi>(
    () => ({
      baked: (id) => client.newGame(DEFAULT_SEED, undefined, { kind: "baked", id }),
      generate: (seed) => client.newGame(seed, undefined, { kind: "generate" }),
      scenario: (seed, scenario) => client.newGame(seed, scenario),
      cancel: () => void client.cancel(),
      load: (file) => void load(file),
    }),
    [client, load],
  );

  if (status.fatal) return <p className="center error">The simulation stopped: {status.fatal}</p>;
  if (!status.started && status.choices !== null) {
    return (
      <NewGamePicker
        choices={status.choices}
        starts={startsOf(status)}
        progress={status.progress}
        dev={developerStart()}
        api={api}
      />
    );
  }
  if (!status.started) return <p className="center">Starting the simulation...</p>;
  // The desktop is kept between visits only when the settings are (tests keep neither).
  return (
    <Desktop storage={settings.persistent ? undefined : null} firstApp={FIRST_APP}>
      <Toasts />
    </Desktop>
  );
}

export function App({ client, settings }: { client: SimClient; settings: SettingsStore }) {
  return (
    <SimContext.Provider value={client}>
      <SettingsContext.Provider value={settings}>
        <Shell client={client} settings={settings} />
      </SettingsContext.Provider>
    </SimContext.Provider>
  );
}
