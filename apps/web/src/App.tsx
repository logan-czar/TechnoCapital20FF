import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { SettingsContext, useApplySettings, useSettings } from "./config/hooks.ts";
import { type SettingsStore, settingsKey } from "./config/settings.ts";
import type { OpenTarget } from "./links/nav.ts";
import type { PageRef } from "./pages/ref.ts";
import { FIXED_PANES, type PaneSpec, type WorkspaceControl } from "./shell/panes.ts";
import { Toasts } from "./shell/Toasts.tsx";
import { TopBar } from "./shell/TopBar.tsx";
import { Workspace } from "./shell/Workspace.tsx";
import type { SimClient } from "./sim/client.ts";
import { SimContext, useStatus } from "./sim/hooks.ts";

// cmdk and fuse.js load the first time the command bar opens.
const CommandBar = lazy(() => import("./shell/CommandBar.tsx"));

/** The seed of the first game. */
const DEFAULT_SEED = 1;

function Shell({ client }: { client: SimClient }) {
  const status = useStatus();
  const settings = useSettings();
  useApplySettings();
  const control = useRef<WorkspaceControl | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // StrictMode runs effects twice in development: start the game once.
  const started = useRef(false);
  const [commands, setCommands] = useState(false);
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void client.ready.then(() => client.newGame(DEFAULT_SEED));
  }, [client]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommands((o) => !o);
      } else if (settingsKey(e, settings, () => control.current?.openPage({ kind: "settings" }, "focused"))) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings]);

  const open = useCallback((spec: PaneSpec) => control.current?.open(spec), []);
  const openPage = useCallback(
    (page: PageRef, target: OpenTarget) => control.current?.openPage(page, target),
    [],
  );
  const closeCommands = useCallback(() => setCommands(false), []);
  const openAlerts = useCallback(() => {
    setSeen(client.store.notices.at(-1)?.seq ?? 0);
    const alerts = FIXED_PANES.find((p) => p.id === "alerts");
    if (alerts) open(alerts);
  }, [client, open]);
  const onControl = useCallback((c: WorkspaceControl) => {
    control.current = c;
  }, []);

  const save = useCallback(async () => {
    const bytes = await client.save();
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "technocapital20ff.save";
    a.click();
    URL.revokeObjectURL(url);
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
  if (!status.started) return <p className="center">Starting the simulation...</p>;
  return (
    <div className="app">
      <TopBar
        seen={seen}
        onOpenAlerts={openAlerts}
        onOpenCommands={() => setCommands(true)}
        onSave={() => void save()}
        onLoad={() => fileInput.current?.click()}
      />
      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => {
          void load(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="workspace">
        <Workspace onControl={onControl} />
      </div>
      <Toasts />
      {commands && (
        <Suspense fallback={null}>
          <CommandBar onClose={closeCommands} onOpenPane={open} onOpenPage={openPage} />
        </Suspense>
      )}
    </div>
  );
}

export function App({ client, settings }: { client: SimClient; settings: SettingsStore }) {
  return (
    <SimContext.Provider value={client}>
      <SettingsContext.Provider value={settings}>
        <Shell client={client} />
      </SettingsContext.Provider>
    </SimContext.Provider>
  );
}
