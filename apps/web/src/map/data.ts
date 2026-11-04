// Loading the map data at runtime: the TopoJSON shapes and the province CSV rows. Both are
// served from the repo folders (see the gameData plugin in vite.config.ts): the shapes
// from assets/map, the CSVs from this page's world.

import { selectedWorld, worldDataBase } from "../sim/world.ts";
import { parseCsv } from "./csv.ts";
import {
  buildMapModel,
  type CentroidRow,
  type MapModel,
  type ProvinceRow,
  type ProvinceTopology,
} from "./model.ts";

export const TOPOLOGY_URL = "/data/map/provinces.topo.json";
export const CENTROIDS_URL = "/data/map/province-centroids.csv";
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

/** This page's world's CSV folder (the provinces' countries differ by world, 1995-rework 2.2). */
const WORLD_BASE = (): string => worldDataBase(selectedWorld());

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res;
}

export async function loadProvinceRows(): Promise<ProvinceRow[]> {
  const texts = await Promise.all(
    REGION_SLUGS.map(async (slug) => (await fetchOk(`${WORLD_BASE()}provinces-${slug}.csv`)).text()),
  );
  return texts.flatMap((t) =>
    parseCsv(t).map((r) => ({ id: r.id ?? "", name: r.name ?? "", country: r.country ?? "" })),
  );
}

export async function loadCountryCodes(): Promise<string[]> {
  const text = await (await fetchOk(`${WORLD_BASE()}countries.csv`)).text();
  return parseCsv(text).map((r) => r.iso3 ?? "");
}

/** province-centroids.csv rows: label points, areas and the tiny flag (served from assets/map). */
export function parseCentroids(text: string): CentroidRow[] {
  return parseCsv(text).map((r) => ({
    id: r.province_id ?? "",
    x: Number(r.x),
    y: Number(r.y),
    label_x: Number(r.label_x),
    label_y: Number(r.label_y),
    area_px: Number(r.area_px),
    tiny: r.tiny === "Y",
  }));
}

let loading: Promise<MapModel> | undefined;

/** Fetches and builds the model once; StrictMode's second effect run gets the same promise. */
export function loadMapModel(): Promise<MapModel> {
  loading ??= Promise.all([
    fetchOk(TOPOLOGY_URL).then((r) => r.json() as Promise<ProvinceTopology>),
    loadProvinceRows(),
    loadCountryCodes(),
    fetchOk(CENTROIDS_URL).then(async (r) => parseCentroids(await r.text())),
  ]).then(([topology, rows, countries, centroids]) => buildMapModel(topology, rows, countries, centroids));
  return loading;
}
