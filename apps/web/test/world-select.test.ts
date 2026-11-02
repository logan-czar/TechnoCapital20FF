// Picking the starting world from the page URL (1995-rework 3.2; sim/world.ts).

import { afterEach, describe, expect, it, vi } from "vitest";
import { knownWorld, selectedWorld, worldDataBase } from "../src/sim/world.ts";

describe("the starting world", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const at = (search: string): string | null => {
    vi.stubGlobal("location", { search });
    return selectedWorld();
  };

  it("is 1995 unless the URL asks for the 2020 world, or the mock sim, which plays it", () => {
    expect(at("")).toBe("1995");
    expect(at("?world=1995")).toBe("1995");
    expect(at("?world=1984")).toBe("1995");
    expect(at("?world=2020")).toBeNull();
    expect(at("?mock=1")).toBeNull();
  });

  it("reads a worker's name as one of the folder worlds, else the 2020 world", () => {
    expect(knownWorld("1995")).toBe("1995");
    expect(knownWorld("1984")).toBeNull();
    expect(knownWorld("")).toBeNull();
    expect(knownWorld("../secrets")).toBeNull();
    expect(knownWorld(null)).toBeNull();
    expect(knownWorld(undefined)).toBeNull();
  });

  it("names where its CSVs are served", () => {
    expect(worldDataBase(null)).toBe("/data/design/");
    expect(worldDataBase("1995")).toBe("/data/worlds/1995/");
  });
});
