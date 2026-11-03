// mapgen command line (build-plan P7; ported from the Rust crate, D1017):
//
//   node apps/mapgen/src/main.ts build --geojson provinces.geojson [--geojson more.geojson ...]
//        --land land.geojson --csv provinces-north-america.csv [--csv ...] --out assets/map
//        --qa work/mapgen-qa.csv --pipeline-version pa-1
//        --source natural_earth=v5.1.2 --source geoboundaries=v6.0.0
//
// Options: --width 8192 --height 4096 --lat-max 84. A full world takes about 40 seconds and 1.1 GB.

import { basename } from "node:path";
import { build, landMask, type ProvinceShape, TINY_PX } from "./build.ts";
import { type CsvProvince, readCsv, readPolygons, readProvinces, writeAssets, writeQa } from "./io.ts";
import { Frame, HEIGHT, LAT_MAX_DEG, WIDTH } from "./miller.ts";

interface Args {
  geojson: string[];
  land: string | null;
  csv: string[];
  out: string | null;
  qa: string | null;
  pipelineVersion: string;
  sources: [string, string][];
  width: number;
  height: number;
  latMax: number;
}

function parse(argv: readonly string[]): Args {
  const [mode, ...rest] = argv;
  if (mode !== "build") throw new Error("usage: mapgen build [options] (see the source header)");
  const a: Args = {
    geojson: [],
    land: null,
    csv: [],
    out: null,
    qa: null,
    pipelineVersion: "dev",
    sources: [],
    width: WIDTH,
    height: HEIGHT,
    latMax: LAT_MAX_DEG,
  };
  for (let k = 0; k < rest.length; k++) {
    const flag = rest[k]!;
    const val = () => {
      const v = rest[++k];
      if (v === undefined) throw new Error(`${flag} needs a value`);
      return v;
    };
    const num = () => {
      const v = Number(val());
      if (!Number.isFinite(v)) throw new Error(`${flag}: not a number`);
      return v;
    };
    switch (flag) {
      case "--geojson":
        a.geojson.push(val());
        break;
      case "--land":
        a.land = val();
        break;
      case "--csv":
        a.csv.push(val());
        break;
      case "--out":
        a.out = val();
        break;
      case "--qa":
        a.qa = val();
        break;
      case "--pipeline-version":
        a.pipelineVersion = val();
        break;
      case "--source": {
        const v = val();
        const eq = v.indexOf("=");
        if (eq < 0) throw new Error("--source takes name=version");
        a.sources.push([v.slice(0, eq), v.slice(eq + 1)]);
        break;
      }
      case "--width":
        a.width = num();
        break;
      case "--height":
        a.height = num();
        break;
      case "--lat-max":
        a.latMax = num();
        break;
      default:
        throw new Error(`unknown argument ${flag}`);
    }
  }
  return a;
}

function run(argv: readonly string[]): void {
  const a = parse(argv);
  const frame = new Frame(a.width, a.height, a.latMax);
  if (a.out === null) throw new Error("--out is required");
  if (a.geojson.length === 0) throw new Error("--geojson is required");
  const csv: CsvProvince[] = a.csv.flatMap(readCsv);
  csv.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const t = performance.now();
  const secs = () => ((performance.now() - t) / 1000).toFixed(1);
  // one file per built region; every region's provinces go into the same bitmap
  const provinces: ProvinceShape[] = a.geojson.flatMap(readProvinces);
  const seen = new Set<string>();
  for (const p of provinces) {
    if (seen.has(p.id)) throw new Error(`province ${p.id} appears in more than one --geojson`);
    seen.add(p.id);
  }
  const land = a.land === null ? null : landMask(frame, readPolygons(a.land));
  console.error(`mapgen: ${provinces.length} provinces read in ${secs()}s`);
  const map = build(frame, provinces, land);
  console.error(`mapgen: rasterized and measured in ${secs()}s`);
  const meta = {
    pipeline_version: a.pipelineVersion,
    sources: a.sources,
    coverage: a.csv.map((p) => basename(p)),
  };
  for (const p of writeAssets(map, meta, a.out)) console.error(`mapgen: wrote ${p}`);
  if (a.qa !== null) {
    writeQa(map, csv, a.qa);
    console.error(`mapgen: wrote ${a.qa}`);
  }
  const tiny = map.stats.filter((s) => s.area_px < TINY_PX).length;
  const forced = map.stats.filter((s) => s.forced).length;
  console.error(
    `mapgen: ${map.ids.length} provinces, ${tiny} tiny, ${forced} given a pixel, ` +
      `${map.adjacency.length} adjacencies, ${map.sea.length} sea links`,
  );
}

try {
  run(process.argv.slice(2));
} catch (e) {
  console.error(`mapgen: ${(e as Error).message}`);
  process.exitCode = 1;
}
