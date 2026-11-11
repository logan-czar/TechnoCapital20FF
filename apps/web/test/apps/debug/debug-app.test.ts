// The debug workspace's registration (apps/debug/app.tsx; pivot 15.3): it is a debug-only app, so
// the registry lists it only for a desktop with Omniscient on, and it is the one app that is.

import { describe, expect, it } from "vitest";
import { appSpecOf, registeredApps } from "../../../src/os/apps.ts";

describe("the debug app", () => {
  it("is debug-only, a singleton, and large because it was the whole screen", () => {
    expect(appSpecOf("debug")).toMatchObject({ id: "debug", debugOnly: true, singleton: true });
    expect(appSpecOf("debug")?.defaultSize.width).toBeGreaterThanOrEqual(1366);
  });

  it("is listed with Omniscient on and not without it, and every other app is listed either way", () => {
    expect(registeredApps(false).map((s) => s.id)).not.toContain("debug");
    expect(registeredApps(true).map((s) => s.id)).toContain("debug");
    const plain = registeredApps(false).length;
    expect(registeredApps(true).length).toBe(
      plain + registeredApps(true).filter((s) => s.debugOnly === true).length,
    );
  });
});
