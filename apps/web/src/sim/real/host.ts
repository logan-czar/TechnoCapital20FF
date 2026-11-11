// The real sim's host moved to packages/sim-host (pivot 15.1), where the Electron sim process uses
// it too. This re-export keeps the tests that drive a RealHost in-process pointing here.
export * from "@tc20ff/sim-host";
