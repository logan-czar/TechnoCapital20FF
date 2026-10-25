import { useEffect, useState } from "react";
import { loadMapModel } from "../map/data.ts";
import type { MapModel } from "../map/model.ts";
import { ProvinceMap } from "../map/ProvinceMap.tsx";

export function MapPane() {
  const [model, setModel] = useState<MapModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadMapModel().then(setModel, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  if (error) return <p className="center error">Map failed to load: {error}</p>;
  if (!model) return <p className="center">Loading the map...</p>;
  return (
    <div className="pane">
      <div className="fill">
        <ProvinceMap model={model} />
      </div>
    </div>
  );
}
