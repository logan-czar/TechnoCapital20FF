import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { SettingsContext, useApplySettings, useSettings } from "./config/hooks.ts";
import { type SettingsStore, settingsKey } from "./config/settings.ts";
import type { OpenTarget } from "./links/nav.ts";
import type { PageRef } from "./pages/ref.ts";
import { DEFAULT_ROUTE, type PdoombergRoute } from "./pdoomberg/models.ts";
import { FIXED_PANES, type PaneSpec, type WorkspaceControl } from "./shell/panes.ts";
import { Toasts } from "./shell/Toasts.tsx";
import { TopBar } from "./shell/TopBar.tsx";
import { Workspace } from "./shell/Workspace.tsx";
import type { SimClient } from "./sim/client.ts";
import { SimContext, useStatus } from "./sim/hooks.ts";

// cmdk and fuse.js load the first time the command bar opens.
const CommandBar = lazy(() => import("./shell/CommandBar.tsx"));
// Full-screen Pdoomberg (pdoomberg/, M9.4) loads the first time it opens (D520).
const Pdoomberg = lazy(() => import("./pdoomberg/Pdoomberg.tsx").then((m) => ({ default: m.Pdoomberg })));

/** True when the keyboard belongs to a text field (the command bar, a picker). */
function typingIn(e: KeyboardEvent): boolean {
  const t = e.target;
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

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
  // Pdoomberg's route is kept while the terminal is closed (pages/mod.rs PdoombergRoute).
  const [pdbOpen, setPdbOpen] = useState(false);
  const [route, setRoute] = useState<PdoombergRoute>(DEFAULT_ROUTE);

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
      } else if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !typingIn(e) && !commands) {
        // B opens Pdoomberg, Esc closes it (rail.rs route_keys, 20-ui 20.2.6; D453: not while the
        // command bar has the keyboard or a chord is held).
        if (e.key === "b" || e.key === "B") setPdbOpen(true);
        else if (e.key === "Escape") setPdbOpen(false);
      } else if (settingsKey(e, settings, () => control.current?.openPage({ kind: "settings" }, "focused"))) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings, commands]);

  const open = useCallback((spec: PaneSpec) => control.current?.open(spec), []);
  const openPage = useCallback(
    (page: PageRef, target: OpenTarget) => control.current?.openPage(page, target),
    [],
  );
  const closeCommands = useCallback(() => setCommands(false), []);
  const openPdoomberg = useCallback((r: PdoombergRoute) => {
    setRoute(r);
    setPdbOpen(true);
  }, []);
  const closePdoomberg = useCallback(() => setPdbOpen(false), []);
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
      {pdbOpen && (
        <Suspense fallback={null}>
          <Pdoomberg route={route} onRoute={setRoute} onOpenPage={openPage} onClose={closePdoomberg} />
        </Suspense>
      )}
      <Toasts />
      {commands && (
        <Suspense fallback={null}>
          <CommandBar
            onClose={closeCommands}
            onOpenPane={open}
            onOpenPage={(page, target) => {
              // A page opens in the workspace, so the terminal steps aside (D517).
              setPdbOpen(false);
              openPage(page, target);
            }}
            onPdoomberg={openPdoomberg}
          />
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
