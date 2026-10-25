// Port of crates/sim/src/finance/mod.rs: the finance module's public face: `register` (the jobs)
// and `start` (the world start, spec 7.1). The rest of the module is reached by path.

export { register, start } from "./jobs.ts";
