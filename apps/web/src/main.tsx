import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The UI shell lands in Step 2 (W4): worker bridge, dockview workspace, map. Until then this
// page only proves the toolchain builds.
function App() {
  return <p>TechnoCapital20FF: TypeScript port in progress (docs/build/ts-migration-plan.md).</p>;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
