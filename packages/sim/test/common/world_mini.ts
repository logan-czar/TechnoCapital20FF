/// <reference types="node" />
// The frozen test world (packages/sim/test/fixtures/world-mini/README.md): the CSVs the 2020 world
// loaded, copied once, with its manifest as a file. Tests that need a world with no era load this
// one, so they do not depend on a playable world's data.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseManifest, type WorldManifest } from "@tc20ff/sim-data";

/** The frozen test world: its folder (for `loadWorld`) and its manifest. */
export interface WorldMini {
  dir: string;
  manifest: WorldManifest;
}

let cached: WorldMini | undefined;

/** The frozen test world's folder and manifest, read once. */
export function worldMini(): WorldMini {
  if (cached === undefined) {
    const dir = join(import.meta.dirname, "..", "fixtures", "world-mini");
    const manifest = parseManifest(readFileSync(join(dir, "manifest.json"), "utf8"));
    if (!manifest.ok) throw new Error(`world-mini manifest: ${JSON.stringify(manifest.error)}`);
    cached = { dir, manifest: manifest.value };
  }
  return cached;
}
