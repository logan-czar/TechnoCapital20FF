// Headless runner (build-plan 2.1). Step 2/4 (W5) ports crates/headless: --check-data, run, soak, check.

const USAGE = "usage: headless --check-data | run | soak | check (not ported yet)";

console.error(USAGE);
process.exitCode = 2;
