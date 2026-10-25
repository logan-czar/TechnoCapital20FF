import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { spawnSim } from "./sim/spawn.ts";
import "./styles.css";

// One worker for the page's life (StrictMode renders twice, so it is made here, not in a component).
const client = spawnSim();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App client={client} />
    </StrictMode>,
  );
}
