import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { SettingsStore } from "./config/settings.ts";
import { spawnSim } from "./sim/spawn.ts";
import "./styles.css";

// One worker for the page's life (StrictMode renders twice, so it is made here, not in a component).
const client = spawnSim();
// The UI settings, from localStorage (blocked storage: in memory only).
const settings = new SettingsStore(storage());

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App client={client} settings={settings} />
    </StrictMode>,
  );
}
