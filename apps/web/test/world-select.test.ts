// Picking the starting world from the page URL (1995-rework 3.2; sim/world.ts).

import { afterEach, describe, expect, it, vi } from "vitest";
import { knownWorld, selectedWorld, worldDataBase } from "../src/sim/world.ts";

describe("the starting world", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const at = (search: string): string => {
    vi.stubGlobal("location", { search });
    return selectedWorld();
  };

  it("is 1995 unless the URL names another folder world; the mock sim plays the default", () => {
    expect(at("")).toBe("1995");
    expect(at("?world=1995")).toBe("1995");
    expect(at("?world=1984")).toBe("1995");
    // The hand-built 2020 world is gone (D1055): its id is an unknown world now.
    expect(at("?world=2020")).toBe("1995");
    expect(at("?mock=1")).toBe("1995");
  });

  it("reads a worker's name as one of the folder worlds, else none", () => {
    expect(knownWorld("1995")).toBe("1995");
    expect(knownWorld("2020")).toBeNull();
    expect(knownWorld("1984")).toBeNull();
    expect(knownWorld("")).toBeNull();
    expect(knownWorld("../secrets")).toBeNull();
    expect(knownWorld(null)).toBeNull();
    expect(knownWorld(undefined)).toBeNull();
  });

  it("names where its CSVs are served", () => {
    expect(worldDataBase("1995")).toBe("/data/worlds/1995/");
  });
});
