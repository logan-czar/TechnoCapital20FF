// The starting world data: one row type per CSV file, loading and the load-time checks
// (build-plan 2.1, M0.2 to M0.6). Ported from crates/sim-data/src/lib.rs. The core is pure and runs
// in a Web Worker; Node file helpers (`loadWorld`, `loadMap`, `defaultDataDir`) are in
// "@tc20ff/sim-data/node".

export * from "./checks.ts";
export * from "./error.ts";
export * from "./load.ts";
export * from "./map.ts";
export * from "./rows.ts";
export * from "./world.ts";
