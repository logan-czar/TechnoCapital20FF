// The page's root: starts the game, then draws the desktop (pivot 15.2; os/Desktop.tsx). Before a
// game is running it shows the start-up line, the new-game picker of a world that has one
// (1995-rework 4.1), or what stopped the sim. Everything a player does after that is in a window.

import { useCallback, useEffect, useRef } from "react";
import { SettingsContext, useApplySettings } from "./config/hooks.ts";
import type { SettingsStore } from "./config/settings.ts";
import { Desktop } from "./os/Desktop.tsx";
import { NewGamePicker } from "./shell/NewGamePicker.tsx";
import { Toasts } from "./shell/Toasts.tsx";
import type { SimClient } from "./sim/client.ts";
import { SimContext, useStatus } from "./sim/hooks.ts";

/** The seed of the first game. */
const DEFAULT_SEED = 1;

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
      if (client.store.status.choices === null) void client.newGame(DEFAULT_SEED);
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

  if (status.fatal) return <p className="center error">The simulation stopped: {status.fatal}</p>;
  if (!status.started && status.choices !== null) {
    return (
      <NewGamePicker
        choices={status.choices}
        onStart={(seed, scenario) => void client.newGame(seed, scenario)}
        onLoad={(file) => void load(file)}
      />
    );
  }
  if (!status.started) return <p className="center">Starting the simulation...</p>;
  // The desktop is kept between visits only when the settings are (tests keep neither).
  return (
    <Desktop storage={settings.persistent ? undefined : null}>
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
