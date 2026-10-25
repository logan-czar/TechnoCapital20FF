import { useCallback, useEffect, useRef, useState } from "react";
import { CommandBar } from "./shell/CommandBar.tsx";
import { FIXED_PANES, type PaneSpec, type WorkspaceControl } from "./shell/panes.ts";
import { TopBar } from "./shell/TopBar.tsx";
import { Workspace } from "./shell/Workspace.tsx";
import type { SimClient } from "./sim/client.ts";
import { SimContext, useStatus } from "./sim/hooks.ts";

/** The seed of the first game. */
const DEFAULT_SEED = 1;

function Shell({ client }: { client: SimClient }) {
  const status = useStatus();
  const control = useRef<WorkspaceControl | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [commands, setCommands] = useState(false);
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    void client.ready.then(() => client.newGame(DEFAULT_SEED));
  }, [client]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommands((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = useCallback((spec: PaneSpec) => control.current?.open(spec), []);
  const openAlerts = useCallback(() => {
    setSeen(client.store.notices.at(-1)?.seq ?? 0);
    open(FIXED_PANES.find((p) => p.id === "alerts") as PaneSpec);
  }, [client, open]);
  const onControl = useCallback((c: WorkspaceControl) => {
    control.current = c;
  }, []);

  const save = useCallback(async () => {
    const bytes = await client.save();
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "technocapital20ff.save";
    a.click();
    URL.revokeObjectURL(url);
  }, [client]);
  const load = useCallback(
    async (file: File | undefined) => {
      if (file) await client.load(new Uint8Array(await file.arrayBuffer()));
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
      <CommandBar open={commands} onClose={() => setCommands(false)} onOpenPane={open} />
    </div>
  );
}

export function App({ client }: { client: SimClient }) {
  return (
    <SimContext.Provider value={client}>
      <Shell client={client} />
    </SimContext.Provider>
  );
}
