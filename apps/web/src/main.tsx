import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadMapModel } from "./map/data.ts";
import type { MapModel } from "./map/model.ts";
import { ProvinceMap } from "./map/ProvinceMap.tsx";

// The UI shell lands in Step 2 (W4): worker bridge, dockview workspace. Until then the page is the
// full-window province map (D954).
function App() {
  const [model, setModel] = useState<MapModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadMapModel().then(setModel, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  if (error) return <p style={{ color: "#ff6b6b", padding: 16 }}>Map failed to load: {error}</p>;
  if (!model) return <p style={{ color: "#9aa7b8", padding: 16 }}>Loading the map...</p>;
  return <ProvinceMap model={model} />;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
