// The debug workspace's window (pivot 15.3): what App.tsx's shell drew full-screen before the
// desktop. A bar with the old top bar's tools that the taskbar did not take over (Skip, the Panes
// menu, Alerts, the command bar, Save and Load), the dockview workspace, and Pdoomberg over it.
// The clock, pause, step and speeds are the taskbar's now (os/Taskbar.tsx).
//
// Keys, while the window is open and not minimised: Ctrl+K the command bar, B Pdoomberg (Esc
// closes it), and the settings keys (config/settings.ts `settingsKey`).

import "./debug.css";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "../../config/hooks.ts";
import { settingsKey } from "../../config/settings.ts";
import type { OpenTarget } from "../../links/nav.ts";
import type { AppProps } from "../../os/apps.ts";
import type { PageRef } from "../../pages/ref.ts";
import { DEFAULT_ROUTE, type PdoombergRoute } from "../../pdoomberg/models.ts";
import { FIXED_PANES, type PaneSpec, type WorkspaceControl } from "../../shell/panes.ts";
import { PanesMenu } from "../../shell/TopBar.tsx";
import { SKIPS, skipName } from "../../shell/text.ts";
import { Workspace } from "../../shell/Workspace.tsx";
import { useClock, useNotices, useSim, useViewData } from "../../sim/hooks.ts";

// cmdk and fuse.js load the first time the command bar opens.
const CommandBar = lazy(() => import("../../shell/CommandBar.tsx"));
// Pdoomberg (pdoomberg/, M9.4) loads the first time it opens (D520).
const Pdoomberg = lazy(() => import("../../pdoomberg/Pdoomberg.tsx").then((m) => ({ default: m.Pdoomberg })));

/** True when the keyboard belongs to a text field (the command bar, a picker). */
function typingIn(e: KeyboardEvent): boolean {
  const t = e.target;
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

/** The Skip menu (spec 8, 9.1): runs at max speed to a quarter's next date, then pauses. */
function SkipMenu() {
  const sim = useSim();
  const skipping = useClock()?.skipping ?? null;
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node && menu.current?.contains(e.target))) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <>
      <div className="menu" ref={menu}>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          Skip
        </button>
        {open && (
          <div className="items dbg-skip-items">
            {SKIPS.map(([kind, label]) => (
              <button
                type="button"
                key={kind}
                onClick={() => {
                  setOpen(false);
                  void sim.control({ kind: "SkipTo", skip: kind });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {skipping && <span className="skipping">Skipping to {skipName(skipping)}...</span>}
    </>
  );
}

/** After a run's end the game carries on, but nothing past there is tuned (1995-rework 8.3). */
function Untuned() {
  const run = useViewData("history")?.run;
  if (!run?.ended) return null;
  return (
    <span className="untuned" title="The run has ended. Nothing past here is tuned.">
      Past {run.reveal_year}: untuned
    </span>
  );
}

/** The alerts indicator: how many alert-level notices arrived since the alerts pane was last opened. */
function AlertsButton({ seen, onOpen }: { seen: number; onOpen: () => void }) {
  const notices = useNotices();
  const unseen = notices.filter(
    (e) =>
      e.seq > seen && (e.notice.kind === "Alert" ? e.notice.level !== "Log" : e.notice.kind === "Paused"),
  ).length;
  return (
    <button type="button" className="bell" onClick={onOpen} title="Alerts">
      Alerts
      {unseen > 0 && <span className="count">{unseen}</span>}
    </button>
  );
}

export default function DebugWorkspace(_props: AppProps) {
  const client = useSim();
  const settings = useSettings();
  const control = useRef<WorkspaceControl | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [commands, setCommands] = useState(false);
  const [seen, setSeen] = useState(0);
  // Pdoomberg's route is kept while the terminal is closed (pages/mod.rs PdoombergRoute).
  const [pdbOpen, setPdbOpen] = useState(false);
  const [route, setRoute] = useState<PdoombergRoute>(DEFAULT_ROUTE);

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
  const workspace = useCallback(() => control.current, []);

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

  return (
    <div className="dbg" data-testid="debug-workspace">
      <header className="topbar dbg-bar">
        <SkipMenu />
        <Untuned />
        <span className="grow" />
        <PanesMenu workspace={workspace} />
        <AlertsButton seen={seen} onOpen={openAlerts} />
        <button type="button" onClick={() => setPdbOpen(true)} title="B">
          Pdoomberg
        </button>
        <button type="button" onClick={() => setCommands(true)} title="Ctrl+K">
          Command...
        </button>
        <button type="button" onClick={() => void save()}>
          Save
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Load
        </button>
      </header>
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
