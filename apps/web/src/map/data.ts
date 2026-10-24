// Loading the map data at runtime: the TopoJSON shapes and the province CSV rows. Both are
// served from the repo folders (see the gameData plugin in vite.config.ts): the shapes
// from assets/map, the CSVs from docs/design/data.

import { parseCsv } from "./csv.ts";
import { buildMapModel, type MapModel, type ProvinceRow, type ProvinceTopology } from "./model.ts";

export const TOPOLOGY_URL = "/data/map/provinces.topo.json";
/** The region files of docs/design/data, as `provinces-<slug>.csv`. */
export const REGION_SLUGS = [
  "east-asia-oceania",
  "europe",
  "latin-america",
  "mena",
  "north-america",
  "russia-central-asia",
  "south-asia",
  "sub-saharan-africa",
] as const;

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res;
}

export async function loadProvinceRows(): Promise<ProvinceRow[]> {
  const texts = await Promise.all(
    REGION_SLUGS.map(async (slug) => (await fetchOk(`/data/design/provinces-${slug}.csv`)).text()),
  );
  return texts.flatMap((t) =>
    parseCsv(t).map((r) => ({ id: r.id ?? "", name: r.name ?? "", country: r.country ?? "" })),
  );
}

export async function loadMapModel(): Promise<MapModel> {
  const [topology, rows] = await Promise.all([
    fetchOk(TOPOLOGY_URL).then((r) => r.json() as Promise<ProvinceTopology>),
    loadProvinceRows(),
  ]);
  return buildMapModel(topology, rows);
}
